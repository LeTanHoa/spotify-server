import { Favorite } from '../models/Favorite.js';
import { Song } from '../models/Song.js';
import { publicSongFromDoc } from '../lib/publicSong.js';

export async function listFavorites(req, res) {
  try {
    const rows = await Favorite.find({ userId: req.user.sub })
      .sort({ createdAt: -1 })
      .populate('songId')
      .lean();

    const songs = [];
    for (const row of rows) {
      const doc = row.songId;
      if (!doc) continue;
      const pub = publicSongFromDoc(doc);
      if (pub) songs.push(pub);
    }

    return res.json({ songs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load favorites' });
  }
}

export async function addFavorite(req, res) {
  try {
    const { songId } = req.body || {};
    if (!songId) {
      return res.status(400).json({ error: 'songId is required' });
    }
    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    try {
      await Favorite.create({ userId: req.user.sub, songId: song._id });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(200).json({ song: publicSongFromDoc(song.toObject()), already: true });
      }
      throw e;
    }

    return res.status(201).json({ song: publicSongFromDoc(song.toObject()) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to add favorite' });
  }
}

export async function removeFavorite(req, res) {
  try {
    const { songId } = req.params;
    const result = await Favorite.findOneAndDelete({ userId: req.user.sub, songId });
    if (!result) {
      return res.status(404).json({ error: 'Favorite not found' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to remove favorite' });
  }
}
