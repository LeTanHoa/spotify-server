import { Playlist } from '../models/Playlist.js';
import { Song } from '../models/Song.js';
import { publicSongFromDoc } from '../lib/publicSong.js';

function toPublicPlaylist(p, songsPopulated = false) {
  const base = {
    id: p._id,
    userId: p.userId,
    name: p.name,
    createdAt: p.createdAt,
    songs: (p.songs || []).map((entry) => ({
      songId: entry.songId?._id || entry.songId,
      orderIndex: entry.orderIndex,
      song:
        songsPopulated && entry.songId && typeof entry.songId === 'object'
          ? publicSongFromDoc(entry.songId)
          : undefined,
    })),
  };
  return base;
}

export async function createPlaylist(req, res) {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const playlist = await Playlist.create({
      userId: req.user.sub,
      name: String(name).trim(),
      songs: [],
    });
    return res.status(201).json({ playlist: toPublicPlaylist(playlist.toObject()) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create playlist' });
  }
}

export async function addSongToPlaylist(req, res) {
  try {
    const { playlist_id: playlistIdBody, playlistId, song_id: songIdBody, songId: songIdField } =
      req.body;
    const pid = playlistId || playlistIdBody;
    const sid = songIdField || songIdBody;

    if (!pid || !sid) {
      return res.status(400).json({ error: 'playlistId and songId are required' });
    }

    const playlist = await Playlist.findOne({ _id: pid, userId: req.user.sub });
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const song = await Song.findById(sid);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const exists = playlist.songs.some((s) => String(s.songId) === String(song._id));
    if (exists) {
      return res.status(409).json({ error: 'Song already in playlist' });
    }

    const nextIndex =
      playlist.songs.length === 0
        ? 0
        : Math.max(...playlist.songs.map((s) => s.orderIndex)) + 1;

    playlist.songs.push({ songId: song._id, orderIndex: nextIndex });
    await playlist.save();

    return res.json({ playlist: toPublicPlaylist(playlist.toObject()) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to add song' });
  }
}

export async function getPlaylist(req, res) {
  try {
    const playlist = await Playlist.findOne({
      _id: req.params.id,
      userId: req.user.sub,
    }).populate('songs.songId');

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const ordered = playlist.toObject();
    ordered.songs.sort((a, b) => a.orderIndex - b.orderIndex);

    return res.json({ playlist: toPublicPlaylist(ordered, true) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to get playlist' });
  }
}

export async function listMyPlaylists(req, res) {
  try {
    const playlists = await Playlist.find({ userId: req.user.sub })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({
      playlists: playlists.map((p) => ({
        id: p._id,
        name: p.name,
        createdAt: p.createdAt,
        songCount: (p.songs || []).length,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list playlists' });
  }
}
