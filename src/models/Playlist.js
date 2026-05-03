import mongoose from 'mongoose';

const playlistSongSchema = new mongoose.Schema(
  {
    songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
    orderIndex: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

/**
 * playlists + playlist_songs:
 * user_id, name, created_at, and ordered song entries.
 */
const playlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    songs: { type: [playlistSongSchema], default: [] },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export const Playlist = mongoose.model('Playlist', playlistSchema);
