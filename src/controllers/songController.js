import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { parseFile } from 'music-metadata';
import { Song } from '../models/Song.js';
import { parseYoutubeVideoId, youtubeIdFromStoredFileUrl } from '../lib/youtube.js';

const audioUploadDir = path.resolve(process.cwd(), process.env.LOCAL_AUDIO_DIR || './storage/audio');

export const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(audioUploadDir, { recursive: true });
      cb(null, audioUploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.mp3';
      const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      cb(null, `${base}${ext}`);
    },
  }),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /^audio\//i.test(file.mimetype) ||
      file.mimetype === 'application/octet-stream' ||
      /\.(mp3|m4a|aac|wav|ogg|flac|opus|webm)$/i.test(file.originalname);
    if (!ok) {
      cb(new Error('Chỉ chấp nhận file âm thanh (mp3, wav, ogg, …)'));
      return;
    }
    cb(null, true);
  },
});

function isBlockedHostname(hostname) {
  const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0') return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }
  if (h === '::1') return true;
  return false;
}

function defaultTitleFromUrl(parsed) {
  try {
    const seg = parsed.pathname.split('/').filter(Boolean).pop();
    if (!seg) return 'Không tên';
    return decodeURIComponent(seg.replace(/\.[^.]+$/, '')) || 'Không tên';
  } catch {
    return 'Không tên';
  }
}

function toPublicSong(doc) {
  const youtubeId = youtubeIdFromStoredFileUrl(doc.fileUrl);
  return {
    id: doc._id,
    title: doc.title,
    artist: doc.artist,
    album: doc.album,
    duration: doc.duration,
    createdAt: doc.createdAt,
    ...(youtubeId ? { youtubeId } : {}),
    // file_url / cover_url intentionally omitted — use /stream and /cover endpoints
  };
}

export async function listSongs(req, res) {
  try {
    const { search, q: qParam } = req.query;
    const term = (search || qParam || '').trim();

    let query = {};
    if (term) {
      query = { $text: { $search: term } };
    }

    let finder = Song.find(query);
    if (term) {
      finder = finder
        .select({ score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
    } else {
      finder = finder.sort({ createdAt: -1 });
    }
    const songs = await finder.limit(200).lean();

    return res.json({ songs: songs.map((s) => toPublicSong(s)) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list songs' });
  }
}

export async function getSong(req, res) {
  try {
    const song = await Song.findById(req.params.id).lean();
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }
    return res.json({ song: toPublicSong(song) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to get song' });
  }
}

export async function createSongFromLink(req, res) {
  try {
    const { url, title, artist, album } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Thiếu link URL' });
    }
    const trimmed = url.trim();

    const ytId = parseYoutubeVideoId(trimmed);
    if (ytId) {
      const song = await Song.create({
        title: (title || '').trim() || 'YouTube',
        artist: (artist || '').trim() || 'YouTube',
        album: (album || '').trim() || '',
        duration: 0,
        fileUrl: `youtube:${ytId}`,
        coverUrl: '',
      });
      return res.status(201).json({ song: toPublicSong(song) });
    }

    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      return res.status(400).json({ error: 'URL không hợp lệ' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'Chỉ hỗ trợ http hoặc https' });
    }
    if (isBlockedHostname(parsed.hostname)) {
      return res.status(400).json({ error: 'URL này không được phép' });
    }

    const song = await Song.create({
      title: (title || '').trim() || defaultTitleFromUrl(parsed),
      artist: (artist || '').trim() || 'Không rõ',
      album: (album || '').trim() || '',
      duration: 0,
      fileUrl: trimmed,
      coverUrl: '',
    });
    return res.status(201).json({ song: toPublicSong(song) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Không thêm được từ link' });
  }
}

export async function createSongFromUpload(req, res) {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'Chưa có file nhạc' });
  }
  try {
    let duration = 0;
    let title = (req.body.title || '').trim();
    let artist = (req.body.artist || '').trim();
    let album = (req.body.album || '').trim();
    try {
      const meta = await parseFile(file.path);
      duration = Math.round(meta.format.duration || 0);
      if (!title) title = (meta.common.title || '').trim();
      if (!artist) {
        const a = meta.common.artists?.[0] ?? meta.common.artist;
        artist = (Array.isArray(a) ? a.join(', ') : String(a || '')).trim();
      }
      if (!album) album = (meta.common.album || '').trim();
    } catch {
      /* metadata optional */
    }
    if (!title) title = path.parse(file.originalname).name || 'Không tên';
    if (!artist) artist = 'Không rõ';

    const song = await Song.create({
      title,
      artist,
      album: album || '',
      duration,
      fileUrl: path.basename(file.path),
      coverUrl: '',
    });
    return res.status(201).json({ song: toPublicSong(song) });
  } catch (err) {
    console.error(err);
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
    return res.status(500).json({ error: 'Không lưu được bài hát' });
  }
}
