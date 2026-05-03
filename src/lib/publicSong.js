import { youtubeIdFromStoredFileUrl } from './youtube.js';

export function publicSongFromDoc(s) {
  if (!s) return null;
  const youtubeId = youtubeIdFromStoredFileUrl(s.fileUrl);
  return {
    id: s._id,
    title: s.title,
    artist: s.artist,
    album: s.album,
    duration: s.duration,
    ...(youtubeId ? { youtubeId } : {}),
  };
}
