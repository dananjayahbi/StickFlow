/**
 * Project metadata and artifact inspection.
 *
 * `project-meta.json` is a sidecar. It never enters `project.json`, so B1-B3
 * canonical fingerprints and preview approvals stay valid.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {humanizeId, projectPaths, projectRelative, readJson, writeJsonAtomic, META_FILE, VALID_STATUSES, VALID_VISIBILITY, fileInfo, sectionForRatio} from './storage.mjs';

export const META_SCHEMA_VERSION = 1;

const FFPROBE = process.env.FFPROBE || 'ffprobe';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

export function readMeta(dirOrFile) {
  const file = dirOrFile.endsWith?.('.json') ? dirOrFile : path.join(dirOrFile, META_FILE);
  return readJson(file, null);
}

export function writeMeta(dir, meta) {
  const file = typeof dir === 'string' && dir.endsWith('.json') ? dir : path.join(dir, META_FILE);
  writeJsonAtomic(file, meta);
  return meta;
}

export function probeMedia(file) {
  try {
    const result = spawnSync(FFPROBE, [
      '-v', 'error', '-show_format', '-show_streams', '-of', 'json', file,
    ], {encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024});
    if (result.status !== 0 || !result.stdout) return null;
    const data = JSON.parse(result.stdout);
    const video = (data.streams || []).find(stream => stream.codec_type === 'video');
    const audio = (data.streams || []).find(stream => stream.codec_type === 'audio');
    const parseRate = value => {
      if (!value || typeof value !== 'string') return null;
      const [num, den] = value.split('/').map(Number);
      if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
      return Math.round((num / den) * 1000) / 1000;
    };
    return {
      duration: Number(data.format?.duration) || null,
      bytes: Number(data.format?.size) || null,
      width: video?.width ?? null,
      height: video?.height ?? null,
      fps: parseRate(video?.avg_frame_rate || video?.r_frame_rate),
      videoCodec: video?.codec_name ?? null,
      audioCodec: audio?.codec_name ?? null,
      hasAudio: Boolean(audio),
    };
  } catch {
    return null;
  }
}

export function extractPoster(dir, video, {force = false} = {}) {
  if (!video || !fs.existsSync(video)) return null;
  const target = path.join(dir, 'output', 'poster.jpg');
  if (fs.existsSync(target) && !force) return target;
  const probe = probeMedia(video);
  const at = Math.max(0.1, Math.min(1.5, (probe?.duration ?? 4) * 0.08));
  const result = spawnSync(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(at), '-i', video,
    '-frames:v', '1', '-vf', 'scale=960:-2', '-q:v', '3', target,
  ], {encoding: 'utf8', timeout: 45000});
  return result.status === 0 && fs.existsSync(target) ? target : null;
}

function firstFile(list) {
  return list.find(file => file && fs.existsSync(file)) ?? null;
}

export function detectArtifacts(dir) {
  const paths = projectPaths(dir);
  const film = firstFile([path.join(paths.output, 'film.mp4')]);
  const preview = firstFile([path.join(paths.output, 'preview.mp4')]);
  const contactSheet = firstFile([
    path.join(paths.output, 'film-contact-sheet.png'),
    path.join(paths.output, 'preview-contact-sheet.png'),
    path.join(paths.output, 'poster.jpg'),
  ]);
  const narration = firstFile([
    path.join(dir, 'narration.wav'),
    path.join(dir, 'narration.m4a'),
    path.join(dir, 'narration.mp3'),
  ]);
  const words = firstFile([path.join(dir, 'words.json')]);
  const captions = firstFile([path.join(dir, 'captions.json')]);
  const script = firstFile([path.join(dir, 'script.txt')]);
  const generation = firstFile([path.join(dir, 'generation.json')]);
  const report = firstFile([
    path.join(paths.output, 'film-report.json'),
    path.join(paths.output, 'preview-report.json'),
  ]);
  const poster = firstFile([path.join(paths.output, 'poster.jpg')]);
  return {paths, film, preview, video: film ?? preview, contactSheet, narration, words, captions, script, generation, report, poster};
}

export function scriptFromWords(wordsFile) {
  const data = readJson(wordsFile, null);
  if (!data?.sentences?.length) return null;
  return `${data.sentences.map(sentence => String(sentence.text || '').trim()).filter(Boolean).join('\n')}\n`;
}

function relativeAssets(dir, artifacts) {
  const to = file => file ? projectRelative(dir, file) : null;
  return {
    video: to(artifacts.video),
    film: to(artifacts.film),
    preview: to(artifacts.preview),
    poster: to(artifacts.poster),
    contactSheet: to(artifacts.contactSheet),
    narration: to(artifacts.narration),
    words: to(artifacts.words),
    captions: to(artifacts.captions),
    script: to(artifacts.script),
    generation: to(artifacts.generation),
    report: to(artifacts.report),
  };
}

function reportDetails(reportFile) {
  const report = readJson(reportFile, null);
  if (!report) return null;
  return {
    frames: report.frames ?? null,
    duration: report.duration ?? null,
    outputSha256: report.output_sha256 ?? null,
    fullDecode: report.full_decode ?? null,
    captionCount: report.caption_count ?? null,
    shotCount: report.shot_count ?? null,
    voiceRate: report.voice_rate ?? null,
  };
}

function ttsDetails(generationFile, existing) {
  const generation = readJson(generationFile, null);
  if (generation) {
    return {
      engine: generation.engine ?? null,
      voice: generation.voice ?? generation.speaker ?? null,
      mode: generation.mode ?? null,
      reference: generation.reference ?? null,
      speed: generation.speed ?? null,
      generatedAt: generation.generatedAt ?? null,
    };
  }
  if (existing?.tts) return existing.tts;
  return {engine: null, voice: null, mode: null, reference: null, speed: null, generatedAt: null};
}

function statusFor(artifacts, existing, options) {
  if (options.status) return options.status;
  if (existing?.status) return existing.status;
  if (artifacts.film) return 'rendered';
  if (artifacts.preview) return 'preview';
  return 'draft';
}

function sectionFromDir(dir, config) {
  const parent = path.basename(path.dirname(dir)).toLowerCase();
  if (parent === String(config.storage.sections.short).toLowerCase()) return 'short';
  if (parent === String(config.storage.sections.video).toLowerCase()) return 'video';
  return null;
}

function formatFromProject(project) {
  if (!project?.width || !project?.height) return null;
  return project.height > project.width ? '9:16' : '16:9';
}

/**
 * Create or refresh `project-meta.json` from the engine manifest and actual
 * output files. Unknown user fields are preserved.
 */
export function registerProject(dir, config, options = {}) {
  const absolute = path.resolve(dir);
  const paths = projectPaths(absolute);
  const project = readJson(paths.project, null);
  const existing = readJson(paths.meta, null) ?? {};
  if (!project && !existing.id) throw new Error(`No project.json or project-meta.json in ${absolute}`);

  const artifacts = detectArtifacts(absolute);
  if (!artifacts.script && artifacts.words) {
    const script = scriptFromWords(artifacts.words);
    if (script) {
      fs.writeFileSync(paths.script, script, 'utf8');
      artifacts.script = paths.script;
    }
  }
  const probe = artifacts.video ? probeMedia(artifacts.video) : null;
  const section = options.section || sectionFromDir(absolute, config) || sectionForRatio(options.format || existing.format || formatFromProject(project) || '16:9');
  const format = options.format || existing.format || formatFromProject(project) || (probe?.height > probe?.width ? '9:16' : '16:9');
  const id = options.id || path.basename(absolute);
  const status = statusFor(artifacts, existing, options);
  if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status "${status}". Use ${VALID_STATUSES.join(', ')}.`);
  const visibility = options.visibility || existing.visibility || 'private';
  if (!VALID_VISIBILITY.includes(visibility)) throw new Error(`Invalid visibility "${visibility}". Use ${VALID_VISIBILITY.join(', ')}.`);

  let poster = artifacts.poster;
  if (!poster && artifacts.video) poster = extractPoster(absolute, artifacts.video);

  const stat = (() => {
    try { return fs.statSync(paths.project); } catch { return null; }
  })();
  const createdAt = existing.createdAt || options.createdAt || stat?.birthtime?.toISOString?.() || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  const meta = {
    schemaVersion: META_SCHEMA_VERSION,
    id,
    title: options.title || existing.title || humanizeId(id),
    slug: existing.slug || id.replace(/-[0-9a-f]{6}$/i, ''),
    section,
    format,
    style: options.style || existing.style || project?.style || null,
    status,
    visibility,
    legacy: options.legacy ?? existing.legacy ?? false,
    createdAt,
    updatedAt,
    duration: probe?.duration ?? existing.duration ?? null,
    video: probe ? {
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      videoCodec: probe.videoCodec,
      audioCodec: probe.audioCodec,
      hasAudio: probe.hasAudio,
      bytes: probe.bytes,
    } : existing.video ?? null,
    tts: options.tts || ttsDetails(artifacts.generation, existing),
    assets: relativeAssets(absolute, {...artifacts, poster}),
    render: reportDetails(artifacts.report) ?? existing.render ?? null,
    publish: {
      publishedAt: null,
      platforms: [],
      scheduledFor: null,
      externalUrl: null,
      ...(existing.publish || {}),
      ...(options.publish || {}),
    },
    tags: options.tags || existing.tags || [],
    description: options.description || existing.description || '',
    ...(existing.extra ? {extra: existing.extra} : {}),
  };

  writeMeta(absolute, meta);
  return meta;
}

/** Lightweight metadata used by list/status. Does not write anything. */
export function readProjectSummary(dir, config, section) {
  const meta = readMeta(dir);
  if (meta) return meta;
  const paths = projectPaths(dir);
  const project = readJson(paths.project, null);
  const artifacts = detectArtifacts(dir);
  return {
    schemaVersion: META_SCHEMA_VERSION,
    id: path.basename(dir),
    title: humanizeId(path.basename(dir)),
    section: section || sectionFromDir(dir, config) || 'video',
    format: formatFromProject(project),
    style: project?.style ?? null,
    status: artifacts.film ? 'rendered' : artifacts.preview ? 'preview' : 'draft',
    visibility: 'private',
    duration: null,
    registered: false,
    assets: relativeAssets(dir, artifacts),
  };
}

export function artifactFiles(dir) {
  const artifacts = detectArtifacts(dir);
  return Object.fromEntries(Object.entries(artifacts)
    .filter(([key]) => key !== 'paths')
    .map(([key, value]) => [key, value ? fileInfo(value) : null]));
}
