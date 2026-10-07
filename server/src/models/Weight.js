import mongoose from 'mongoose';
import { byUser } from './User.js';

// A sample of one batch's birds in one coop, weighed together
const weightSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    coopId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Snapshot of the coop name at the time of the record
    coopName: { type: String, required: true },
    // Snapshot of the farm that coop is on
    farm: { type: String, trim: true, default: '' },
    date: { type: Date, required: [true, 'Date is required'] },
    // Birds weighed, and what they weighed together
    birds: { type: Number, required: true, min: 1 },
    totalWeightKg: {
      type: Number,
      required: [true, 'Total weight is required'],
      min: [0.001, 'Total weight must be more than 0'],
    },
    // Worked out from the two above, in grams per bird
    avgWeightG: { type: Number, required: true },
    remarks: { type: String, trim: true, default: '' },
    createdBy: byUser,
  },
  { timestamps: true }
);

export default mongoose.model('Weight', weightSchema);
