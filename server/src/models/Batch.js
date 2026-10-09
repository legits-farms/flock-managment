import mongoose from 'mongoose';
import { byUser } from './User.js';

const wholeNumber = {
  validator: Number.isInteger,
  message: '{PATH} must be a whole number',
};

const coopSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Coop name is required'], trim: true },
  birds: {
    type: Number,
    required: [true, 'Number of birds is required'],
    // Can drop to 0 when every bird is shifted out to another coop
    min: [0, 'Number of birds cannot be negative'],
    validate: wholeNumber,
  },
  // Only set when the coop is on another farm than the batch's own
  farm: { type: String, trim: true },
  // Created by a shift rather than by allocating the batch's birds
  fromShift: { type: Boolean, default: false },
  // Birds lost in this coop, added up from registered mortality records
  mortality: { type: Number, default: 0, min: 0 },
  // Birds sold out of this coop, added up from the sales
  sold: { type: Number, default: 0, min: 0 },
  addedBy: byUser,
});

// Birds alive in a coop now: those put in it, less the ones lost and sold
export const coopLive = (coop) => coop.birds - coop.mortality - (coop.sold ?? 0);

const batchSchema = new mongoose.Schema(
  {
    batchName: { type: String, required: [true, 'Batch name is required'], trim: true },
    startDate: { type: Date, required: [true, 'Batch start date is required'] },
    breed: { type: String, required: [true, 'Breed is required'], trim: true },
    age: {
      type: Number,
      required: [true, 'Age of the birds is required'],
      min: [0, 'Age cannot be negative'],
    },
    ageUnit: { type: String, enum: ['days', 'weeks'], default: 'days' },
    numberOfBirds: {
      type: Number,
      required: [true, 'Number of birds is required'],
      min: [1, 'Number of birds must be at least 1'],
      validate: wholeNumber,
    },
    // Birds found dead in the delivery boxes on arrival
    boxMortality: {
      type: Number,
      default: 0,
      min: [0, 'Mortality cannot be negative'],
      validate: [
        wholeNumber,
        {
          validator(value) {
            return typeof this.numberOfBirds !== 'number' || value <= this.numberOfBirds;
          },
          message: 'Mortality cannot be more than the number of birds',
        },
      ],
    },
    vendor: {
      name: { type: String, required: [true, 'Vendor name is required'], trim: true },
      phone: { type: String, trim: true, default: '' },
      details: { type: String, trim: true, default: '' },
    },
    shiftToFarm: { type: String, trim: true, default: '' },
    // Birds allocated out of this batch, one entry per coop
    coops: [coopSchema],
    // The person named on the Enter Batch form; createdBy is the account that was logged in
    enteredBy: {
      type: String,
      required: [true, 'Entered by is required'],
      trim: true,
      maxlength: [40, 'Entered by is too long'],
    },
    createdBy: byUser,
  },
  { timestamps: true }
);

export default mongoose.model('Batch', batchSchema);
