import mongoose from 'mongoose';
import { byUser } from './User.js';

// Birds of one batch moved from one coop to another, possibly on another farm.
// Names and farms are snapshots from the time of the shift.
const shiftSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    fromCoopId: { type: mongoose.Schema.Types.ObjectId, required: true },
    fromCoopName: { type: String, required: true },
    fromFarm: { type: String, default: '' },
    toCoopId: { type: mongoose.Schema.Types.ObjectId, required: true },
    toCoopName: { type: String, required: true },
    toFarm: { type: String, default: '' },
    birds: { type: Number, required: true, min: 1 },
    reason: { type: String, required: [true, 'Reason is required'], trim: true },
    date: { type: Date, required: [true, 'Shift date is required'] },
    createdBy: byUser,
  },
  { timestamps: true }
);

export default mongoose.model('Shift', shiftSchema);
