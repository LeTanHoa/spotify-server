import { Song } from '../models/Song.js';
import { History } from '../models/History.js';
import { streamAudioToResponse, streamCoverToResponse } from '../services/storage.js';
import { youtubeIdFromStoredFileUrl } from '../lib/youtube.js';

/** Lorem Picsum: same seed ⇒ same image; different songs ⇒ different “random” photos. */
function placeholderCoverUrl(songId) {
  const seed = encodeURIComponent(String(songId));
  const base = (process.env.COVER_PLACEHOLDER_BASE || 'https://picsum.photos').replace(/\/$/, '');
  return `${base}/seed/${seed}/400/400`;
}

/**
 * GET /stream/:songId — authenticated audio stream (no raw S3/file path in response body).
 * Optional ?record=1 records play in history (used when user starts playback).
 */
export async function streamSong(req, res) {
  try {
    const song = await Song.findById(req.params.songId);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (req.query.record === '1' || req.query.record === 'true') {
      const userId = req.user.sub;
      await History.create({ userId, songId: song._id, playedAt: new Date() });
    }

    await streamAudioToResponse(song, req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream failed' });
    }
  }
}

/**
 * GET /cover/:songId — authenticated cover image proxy.
 */
export async function coverSong(req, res) {
  try {
    const song = await Song.findById(req.params.songId);
    if (!song) {
      return res.status(404).end();
    }
    if (song.coverUrl && String(song.coverUrl).trim()) {
      await streamCoverToResponse(song, res);
      return;
    }

    const ytId = youtubeIdFromStoredFileUrl(song.fileUrl);
    if (ytId) {
      return res.redirect(302, `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`);
    }

    return res.redirect(302, placeholderCoverUrl(song._id));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).end();
  }
}

/**
 * Returns a relative stream URL template; frontend appends JWT as query for <audio>.
 */
export async function streamMeta(req, res) {
  try {
    const song = await Song.findById(req.params.songId).lean();
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    const base = (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(
      /\/$/,
      ''
    );
    // Playable path: append JWT as ?token= for <audio src> (see README)
    const streamPath = `${base}/stream/${song._id}`;
    const coverPath = `${base}/stream/cover/${song._id}`;
    return res.json({
      streamUrl: streamPath,
      coverUrl: coverPath,
      duration: song.duration,
      title: song.title,
      artist: song.artist,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load stream metadata' });
  }
}
