import mongoose from 'mongoose';

/**
 * Equivalent to `songs` table:
 * title, artist, album, duration, file_url (storage key), cover_url, created_at
 * file_url / cover_url are internal keys; clients never receive raw bucket paths when using S3.
 */
const songSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    artist: { type: String, required: true, trim: true },
    album: { type: String, default: '', trim: true },
    duration: { type: Number, required: true }, // seconds
    fileUrl: { type: String, required: true }, // S3 key or relative filename for local
    coverUrl: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

songSchema.index({ title: 'text', artist: 'text', album: 'text' });

export const Song = mongoose.model('Song', songSchema);
