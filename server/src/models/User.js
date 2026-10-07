import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    // Digits only; this is what people log in with
    phone: { type: String, required: [true, 'Phone number is required'], unique: true },
    passwordHash: { type: String, required: true, select: false },
    // A new account can do nothing until the manager approves it
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);

// Who did something, stored on batches, coops and records. The name is a
// snapshot so the activity log still reads right if the user is renamed.
export const byUser = {
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
};
