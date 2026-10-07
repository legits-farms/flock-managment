import mongoose from 'mongoose';
import { byUser } from './User.js';

// Feed given to one batch's birds in one coop
const feedSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    coopId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Snapshot of the coop name at the time of the record
    coopName: { type: String, required: true },
    // Snapshot of the farm that coop is on
    farm: { type: String, trim: true, default: '' },
    date: { type: Date, required: [true, 'Date is required'] },
    feedType: { type: String, required: [true, 'Feed type is required'], trim: true },
    quantityKg: {
      type: Number,
      required: [true, 'Feed quantity is required'],
      min: [0.001, 'Feed quantity must be more than 0'],
    },
    remarks: { type: String, trim: true, default: '' },
    createdBy: byUser,
  },
  { timestamps: true }
);

export default mongoose.model('Feed', feedSchema);
