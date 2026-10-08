import mongoose from 'mongoose';
import { byUser } from './User.js';

// The fixed lists people pick from: farms, the coops on each farm, and the
// vaccines and feed types added to the standard ones
const optionSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['farm', 'coop', 'vaccine', 'feedType'], required: true },
    name: { type: String, required: true, trim: true },
    // Coops only: the farm the coop is on
    farm: { type: String, trim: true },
    // Vaccines only: the age it is given at, e.g. "5th Day" or "9th Week"
    schedule: { type: String, trim: true },
    // Lower-cased name (for a coop, "farm|name"; for a vaccine, "name|schedule"),
    // so "Coop 1" and "coop 1" cannot both exist on the same farm
    key: { type: String, required: true },
    addedBy: byUser,
  },
  { timestamps: true }
);

optionSchema.index({ kind: 1, key: 1 }, { unique: true });

export default mongoose.model('Option', optionSchema);
