const YT_PREFIX = 'youtube:';

/** Stored `fileUrl` for YouTube tracks: `youtube:VIDEO_ID` */
export function youtubeIdFromStoredFileUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return null;
  if (!fileUrl.startsWith(YT_PREFIX)) return null;
  const id = fileUrl.slice(YT_PREFIX.length);
  return /^[\w-]{11}$/.test(id) ? id : null;
}

/**
 * Parse a watch/share/embed URL or a bare 11-char id into a video id.
 */
export function parseYoutubeVideoId(input) {
  const t = String(input).trim();
  if (/^[\w-]{11}$/.test(t)) return t;

  let u;
  try {
    u = new URL(t);
  } catch {
    return null;
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();

  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch' || u.pathname.startsWith('/watch')) {
      const v = u.searchParams.get('v');
      return v && /^[\w-]{11}$/.test(v) ? v : null;
    }
    const embed = u.pathname.match(/^\/embed\/([\w-]{11})/);
    if (embed) return embed[1];
    const shorts = u.pathname.match(/^\/shorts\/([\w-]{11})/);
    if (shorts) return shorts[1];
  }

  return null;
}
