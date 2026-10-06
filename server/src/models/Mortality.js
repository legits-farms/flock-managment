import mongoose from 'mongoose';
import { evidenceFields } from '../evidence.js';
import { byUser } from './User.js';

const mortalitySchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
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
