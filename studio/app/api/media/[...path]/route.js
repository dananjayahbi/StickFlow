import fs from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {loadConfig} from '../../../../lib/config.mjs';
import {safeResolve} from '../../../../lib/storage.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.srt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function decodePart(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function mime(file) {
  return TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function headersFor(file, stat, extra = {}) {
  return {
    'Content-Type': mime(file),
    'Content-Length': String(stat.size),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
    ...extra,
  };
}

export async function GET(request, context) {
  const params = await context.params;
  const parts = (params.path || []).map(decodePart);
  if (!parts.length) return new Response('Not found', {status: 404});
  const config = loadConfig();
  let file;
  try {
    file = safeResolve(config.paths.storageRoot, path.join(...parts));
  } catch {
    return new Response('Forbidden', {status: 403});
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return new Response('Not found', {status: 404});
  }
  const stat = fs.statSync(file);
  const range = request.headers.get('range');
  if (!range) {
    const stream = Readable.toWeb(fs.createReadStream(file));
    return new Response(stream, {status: 200, headers: headersFor(file, stat)});
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) {
    return new Response('Invalid range', {status: 416, headers: {'Content-Range': `bytes */${stat.size}`}});
  }
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : stat.size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= stat.size || start > end) {
    return new Response('Range not satisfiable', {status: 416, headers: {'Content-Range': `bytes */${stat.size}`}});
  }
  const stream = Readable.toWeb(fs.createReadStream(file, {start, end}));
  return new Response(stream, {
    status: 206,
    headers: headersFor(file, stat, {
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
    }),
  });
}

export async function HEAD(_request, context) {
  const params = await context.params;
  const parts = (params.path || []).map(decodePart);
  if (!parts.length) return new Response(null, {status: 404});
  const config = loadConfig();
  let file;
  try {
    file = safeResolve(config.paths.storageRoot, path.join(...parts));
  } catch {
    return new Response(null, {status: 403});
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response(null, {status: 404});
  return new Response(null, {status: 200, headers: headersFor(file, fs.statSync(file))});
}
