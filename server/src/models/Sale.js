import mongoose from 'mongoose';
import { byUser } from './User.js';

export const GENDERS = ['male', 'female'];
// Whose boxes the birds left in: the customer's own, ours on loan, or ours sold with the birds
export const BOX_MODES = ['own', 'borrow', 'buy'];

// How much of the bill has been paid, and how it was paid
export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'];
export const PAYMENT_MODES = ['cash', 'upi', 'bank'];

// Photos of one weighed set, and of a whole sale. Keeps a request under the JSON body limit.
export const MAX_SET_PHOTOS = 2;
export const MAX_SALE_PHOTOS = 8;

// A live photo of a set, geotagged and time stamped like the record photos. The
// image bytes are left out of normal queries and only loaded by the photo endpoint.
const photoSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true, select: false },
    contentType: { type: String, default: 'image/jpeg', select: false },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      accuracy: Number,
    },
    capturedAt: { type: Date, required: true },
  },
  { _id: false }
);

// One weighing of birds out of one coop. Names and farms are snapshots from
// the time of the sale.
const setSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    coopId: { type: mongoose.Schema.Types.ObjectId, required: true },
    coopName: { type: String, required: true },
    farm: { type: String, default: '' },
    // Left out while sales are not split into male and female
    gender: { type: String, enum: GENDERS },
    birds: { type: Number, required: true, min: 1 },
    boxes: { type: Number, default: 0, min: 0 },
    boxWeightEmpty: { type: Number, default: 0, min: 0 },
    boxWeightGross: { type: Number, default: 0, min: 0 },
    // Loaded weight less the empty boxes
    weightKg: { type: Number, default: 0, min: 0 },
    photos: { type: [photoSchema], default: [] },
  },
  { _id: false }
);

// Birds sold to one customer, weighed out in sets and billed per kg
const saleSchema = new mongoose.Schema(
  {
    date: { type: Date, required: [true, 'Sale date is required'] },
    customer: {
      name: { type: String, required: [true, 'Customer name is required'], trim: true },
      phone: { type: String, required: [true, 'Phone number is required'], trim: true },
      address: { type: String, trim: true, default: '' },
    },
    sets: { type: [setSchema], default: [] },
    // Price per kg of the sets without a gender; the two below are for those with one
    ratePerKg: { type: Number, default: 0, min: 0 },
    maleRate: { type: Number, default: 0, min: 0 },
    femaleRate: { type: Number, default: 0, min: 0 },
    boxMode: { type: String, enum: BOX_MODES, default: 'own' },
    // Boxes lent or sold, the price of a sold box, and how many lent ones are back
    boxQty: { type: Number, default: 0, min: 0 },
    boxRate: { type: Number, default: 0, min: 0 },
    boxReturned: { type: Number, default: 0, min: 0 },
    // Who was there when the birds were weighed
    present: [{ _id: false, name: { type: String, trim: true }, phone: { type: String, trim: true } }],
    notes: { type: String, trim: true, default: '' },
    payment: {
      status: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid' },
      // Rupees received so far: the whole bill when paid, nothing when unpaid
      amountPaid: { type: Number, default: 0, min: 0 },
      // The two below are only set once something is paid
      mode: { type: String, enum: PAYMENT_MODES },
      // UTR of a UPI or bank payment, or any note for cash
      reference: { type: String, trim: true, default: '' },
      // Picture of the payment, e.g. a UPI screenshot. The image bytes are left
      // out of normal queries and only loaded by the photo endpoint.
      proof: {
        data: { type: Buffer, select: false },
        contentType: { type: String, select: false },
      },
      hasProof: { type: Boolean, default: false },
    },
    // Worked out from the sets and rates when the sale is saved
    birds: { type: Number, required: true, min: 1 },
    maleBirds: { type: Number, default: 0 },
    femaleBirds: { type: Number, default: 0 },
    weightKg: { type: Number, default: 0 },
    maleWeightKg: { type: Number, default: 0 },
    femaleWeightKg: { type: Number, default: 0 },
    // Bill of the sets without a gender
    birdBill: { type: Number, default: 0 },
    maleBill: { type: Number, default: 0 },
    femaleBill: { type: Number, default: 0 },
    boxBill: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    createdBy: byUser,
  },
  { timestamps: true }
);

saleSchema.index({ 'sets.batch': 1 });

export default mongoose.model('Sale', saleSchema);
