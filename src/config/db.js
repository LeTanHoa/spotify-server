import mongoose from 'mongoose';

/**
 * Connects to MongoDB once at startup.
 * Collections map to the documented relational model (users, songs, playlists, etc.).
 */
export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
