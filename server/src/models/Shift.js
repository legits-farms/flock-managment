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
    // Birds that left the coop, and how many of those died on the way
    birds: { type: Number, required: true, min: 1 },
    mortality: { type: Number, default: 0, min: 0 },
    reason: { type: String, required: [true, 'Reason is required'], trim: true },
    date: { type: Date, required: [true, 'Shift date is required'] },
    createdBy: byUser,
  },
  { timestamps: true }
);

export default mongoose.model('Shift', shiftSchema);
