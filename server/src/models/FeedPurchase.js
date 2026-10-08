import mongoose from 'mongoose';
import { byUser } from './User.js';

// Feed bought into the store. What the birds are given out of it is in Feed.
const feedPurchaseSchema = new mongoose.Schema(
  {
    date: { type: Date, required: [true, 'Date is required'] },
    feedType: { type: String, required: [true, 'Feed type is required'], trim: true },
    feedCompany: { type: String, trim: true, default: '' },
    quantityKg: {
      type: Number,
      required: [true, 'Feed quantity is required'],
      min: [0.001, 'Feed quantity must be more than 0'],
    },
    ratePerKg: {
      type: Number,
      required: [true, 'Price per kg is required'],
      min: [0, 'Price per kg cannot be negative'],
    },
    // Worked out from the two above, in rupees
    amount: { type: Number, required: true },
    remarks: { type: String, trim: true, default: '' },
    createdBy: byUser,
  },
  { timestamps: true }
);

export default mongoose.model('FeedPurchase', feedPurchaseSchema);
