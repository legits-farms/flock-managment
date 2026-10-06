import mongoose from 'mongoose';
import { byUser } from './User.js';

// The fixed lists people pick from: farms, and the coops on each farm
const optionSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['farm', 'coop'], required: true },
    name: { type: String, required: true, trim: true },
    // Coops only: the farm the coop is on
    farm: { type: String, trim: true },
    // Lower-cased name (for a coop, "farm|name"), so "Coop 1" and "coop 1"
    // cannot both exist on the same farm
    key: { type: String, required: true },
    addedBy: byUser,
  },
  { timestamps: true }
);

optionSchema.index({ kind: 1, key: 1 }, { unique: true });

export default mongoose.model('Option', optionSchema);
