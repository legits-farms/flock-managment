import mongoose from 'mongoose';
import { evidenceFields } from '../evidence.js';
import { byUser } from './User.js';

const vaccinationSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    coopId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Snapshot of the coop name at the time of the record
    coopName: { type: String, required: true },
    date: { type: Date, required: [true, 'Vaccination date is required'] },
    vaccine: { type: String, required: [true, 'Vaccine is required'], trim: true },
    remarks: { type: String, trim: true, default: '' },
    birds: { type: Number, required: true, min: 1 },
    ...evidenceFields,
    createdBy: byUser,
  },
  { timestamps: true }
);

export default mongoose.model('Vaccination', vaccinationSchema);
