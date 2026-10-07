import mongoose from 'mongoose';
import { evidenceFields } from '../evidence.js';
import { byUser } from './User.js';

// Where the birds were lost. Box mortality (dead on arrival) is not a record:
// it is entered with the batch.
export const MORTALITY_TYPES = ['shift', 'brooding', 'coop'];

// Records without a type go by their coop: a brooding house or an ordinary coop
export const placeType = (coopName) => (/^brooding\b/i.test(coopName.trim()) ? 'brooding' : 'coop');

const mortalitySchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    type: { type: String, enum: MORTALITY_TYPES },
    // Only set when the birds were lost during a shift entered with the shift form
    shift: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    coopId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Snapshot of the coop name at the time of the record
    coopName: { type: String, required: true },
    birds: { type: Number, required: true, min: 1 },
    reason: { type: String, required: [true, 'Reason is required'], trim: true },
    ...evidenceFields,
    createdBy: byUser,
  },
  { timestamps: true }
);

export default mongoose.model('Mortality', mortalitySchema);
