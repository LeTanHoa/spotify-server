import mongoose from 'mongoose';

/**
 * Equivalent to `history` table for recently played and simple recommendations.
 */
const historySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
    playedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

historySchema.index({ userId: 1, playedAt: -1 });

export const History = mongoose.model('History', historySchema);
