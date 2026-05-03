import fs from 'fs';
import path from 'path';
import { createReadStream, existsSync } from 'fs';
import { Readable } from 'stream';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { youtubeIdFromStoredFileUrl } from '../lib/youtube.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const STORAGE_MODE = process.env.STORAGE_MODE || 'local';

function isRemoteAudioUrl(fileUrl) {
  return typeof fileUrl === 'string' && /^https?:\/\//i.test(fileUrl);
}

/**
 * Proxy remote audio (direct MP3/stream URL) through the API for authenticated playback.
 */
async function streamRemoteAudio(url, req, res) {
  const upstreamHeaders = {};
  if (req.headers.range) upstreamHeaders.Range = req.headers.range;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  let r;
  try {
    r = await fetch(url, {
      headers: {
        ...upstreamHeaders,
        'User-Agent': 'spotify-mini/1.0',
        Accept: 'audio/*,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (err) {
    clearTimeout(timeout);
    console.error('Remote audio fetch failed:', err.message);
    if (!res.headersSent) res.status(502).end('Upstream unreachable');
    return;
  }
  clearTimeout(timeout);

  if (!r.ok && r.status !== 206) {
    if (!res.headersSent) res.status(502).end('Upstream error');
    return;
  }

  const ct = r.headers.get('content-type') || 'audio/mpeg';
  const cl = r.headers.get('content-length');
  const cr = r.headers.get('content-range');
  const ar = r.headers.get('accept-ranges');

  res.status(r.status === 206 ? 206 : 200);
  res.setHeader('Content-Type', ct);
  if (cl) res.setHeader('Content-Length', cl);
  if (cr) res.setHeader('Content-Range', cr);
  res.setHeader('Accept-Ranges', ar || 'bytes');

  if (!r.body) {
    res.end();
    return;
  }

  Readable.fromWeb(r.body).pipe(res);
}

let s3Client = null;

function getS3() {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return s3Client;
}

/**
 * Resolve absolute path for local audio/cover files.
 */
export function resolveLocalAudioPath(fileKey) {
  const base = path.resolve(process.cwd(), process.env.LOCAL_AUDIO_DIR || './storage/audio');
  const safe = path.normalize(fileKey).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(base, safe);
}

export function resolveLocalCoverPath(fileKey) {
  const base = path.resolve(process.cwd(), process.env.LOCAL_COVERS_DIR || './storage/covers');
  const safe = path.normalize(fileKey).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(base, safe);
}

/**
 * Stream audio to the HTTP response without exposing S3 URL to the client.
 * Supports HTTP Range for seeking in the browser player.
 */
export async function streamAudioToResponse(song, req, res) {
  if (youtubeIdFromStoredFileUrl(song.fileUrl)) {
    if (!res.headersSent) {
      res.status(400).json({ error: 'YouTube tracks play in the app player only' });
    }
    return;
  }

  if (isRemoteAudioUrl(song.fileUrl)) {
    await streamRemoteAudio(song.fileUrl, req, res);
    return;
  }

  if (STORAGE_MODE === 's3') {
    const bucket = process.env.S3_BUCKET;
    const prefix = process.env.S3_AUDIO_PREFIX || 'audio/';
    const key = song.fileUrl.startsWith(prefix) ? song.fileUrl : `${prefix}${song.fileUrl}`;

    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const s3 = getS3();

    // Optional: redirect to short-lived presigned URL (still time-bound; prefer streaming below)
    if (process.env.S3_USE_PRESIGN_REDIRECT === 'true') {
      const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
      return res.redirect(302, url);
    }

    const obj = await s3.send(cmd);
    const total = obj.ContentLength;
    const contentType = obj.ContentType || 'audio/mpeg';
    const range = req.headers.range;

    if (range && total != null) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', contentType);

      const rangeCmd = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: `bytes=${start}-${end}`,
      });
      const ranged = await s3.send(rangeCmd);
      ranged.Body.pipe(res);
      return;
    }

    res.setHeader('Content-Type', contentType);
    if (total != null) res.setHeader('Content-Length', total);
    res.setHeader('Accept-Ranges', 'bytes');
    obj.Body.pipe(res);
    return;
  }

  // Local filesystem
  const filePath = resolveLocalAudioPath(song.fileUrl);
  if (!existsSync(filePath)) {
    res.status(404).end('Audio file not found');
    return;
  }

  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;
  const contentType = 'audio/mpeg';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Content-Type', contentType);

    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', total);
  res.setHeader('Accept-Ranges', 'bytes');
  createReadStream(filePath).pipe(res);
}

/**
 * Cover art: stream from local or S3 (never return raw permanent public URL for S3 unless you configure public bucket).
 */
export async function streamCoverToResponse(song, res) {
  if (!song.coverUrl) {
    res.status(404).end();
    return;
  }
  if (STORAGE_MODE === 's3') {
    const bucket = process.env.S3_BUCKET;
    const prefix = process.env.S3_COVER_PREFIX || 'covers/';
    const key = song.coverUrl.startsWith(prefix) ? song.coverUrl : `${prefix}${song.coverUrl}`;
    const obj = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    res.setHeader('Content-Type', obj.ContentType || 'image/jpeg');
    obj.Body.pipe(res);
    return;
  }
  const filePath = resolveLocalCoverPath(song.coverUrl);
  if (!existsSync(filePath)) {
    res.status(404).end();
    return;
  }
  res.setHeader('Content-Type', 'image/jpeg');
  createReadStream(filePath).pipe(res);
}
