import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { Song } from '../models/Song.js';

/**
 * Seeds demo songs. Place matching MP3 files under storage/audio/
 * and optional JPEG covers under storage/covers/ (see fileUrl / coverUrl).
 */
const demoSongs = [
  {
    title: 'Demo Track One',
    artist: 'Studio A',
    album: 'MVP Sessions',
    duration: 180,
    fileUrl: 'demo1.mp3',
    coverUrl: 'demo1.jpg',
  },
  {
    title: 'Demo Track Two',
    artist: 'Studio B',
    album: 'MVP Sessions',
    duration: 210,
    fileUrl: 'demo2.mp3',
    coverUrl: '',
  },
  {
    title: 'Night Drive',
    artist: 'Studio A',
    album: 'Synth Roads',
    duration: 195,
    fileUrl: 'demo1.mp3',
    coverUrl: '',
  },
];

async function run() {
  await connectDb();
  await Song.deleteMany({ title: { $in: demoSongs.map((s) => s.title) } });
  await Song.insertMany(demoSongs);
  console.log('Seed complete. Add MP3 files to storage/audio/ matching fileUrl names.');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
