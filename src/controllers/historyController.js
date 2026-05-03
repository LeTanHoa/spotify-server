import { History } from '../models/History.js';
import { Song } from '../models/Song.js';
import { publicSongFromDoc } from '../lib/publicSong.js';

/** Recently played: last N distinct songs for the user */
export async function recent(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const rows = await History.find({ userId: req.user.sub })
      .sort({ playedAt: -1 })
      .limit(limit * 3)
      .populate('songId')
      .lean();

    const seen = new Set();
    const songs = [];
    for (const row of rows) {
      if (!row.songId) continue;
      const id = String(row.songId._id);
      if (seen.has(id)) continue;
      seen.add(id);
      const base = publicSongFromDoc(row.songId);
      if (base) songs.push({ ...base, playedAt: row.playedAt });
      if (songs.length >= limit) break;
    }

    return res.json({ songs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load history' });
  }
}

/**
 * Simple recommendation: songs from same artists the user listened to,
 * excluding already played (recent window), shuffled.
 */
export async function recommend(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 15, 40);
    const recentRows = await History.find({ userId: req.user.sub })
      .sort({ playedAt: -1 })
      .limit(80)
      .populate('songId')
      .lean();

    const artists = new Set();
    const playedIds = new Set();
    for (const row of recentRows) {
      if (row.songId) {
        playedIds.add(String(row.songId._id));
        if (row.songId.artist) artists.add(row.songId.artist);
      }
    }

    if (artists.size === 0) {
      const fallback = await Song.find().sort({ createdAt: -1 }).limit(limit).lean();
      return res.json({
        songs: fallback.map((s) => publicSongFromDoc(s)).filter(Boolean),
        reason: 'popular_new',
      });
    }

    const candidates = await Song.find({
      artist: { $in: [...artists] },
      _id: { $nin: [...playedIds].map((id) => id) },
    })
      .limit(80)
      .lean();

    let picks = candidates.sort(() => Math.random() - 0.5).slice(0, limit);
    if (picks.length === 0) {
      const fallback = await Song.find({ _id: { $nin: [...playedIds] } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      picks = fallback;
    }
    return res.json({
      songs: picks.map((s) => publicSongFromDoc(s)).filter(Boolean),
      reason: picks.length && candidates.length ? 'same_artists' : 'fallback',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to recommend' });
  }
}

export async function recordPlay(req, res) {
  try {
    const { songId } = req.body;
    if (!songId) {
      return res.status(400).json({ error: 'songId is required' });
    }
    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    await History.create({ userId: req.user.sub, songId: song._id, playedAt: new Date() });
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to record play' });
  }
}
