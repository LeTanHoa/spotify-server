import mongoose from 'mongoose';

/**
 * Equivalent to `users` table:
 * id, email, password_hash, username, created_at
 */
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    username: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export const User = mongoose.model('User', userSchema);
