/**
 * StoryFlow-style project storage for StickFlow.
 *
 *   Storage/Videos/<project-id>/   native 16:9
 *   Storage/Shorts/<project-id>/   native 9:16
 *   Storage/_library/              shared voices, fonts, audio, migrations
 *
 * A project keeps the engine contract (`project.json`) and every generated
 * artifact in one self-contained folder.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const META_FILE = 'project-meta.json';
export const PROJECT_FILE = 'project.json';
export const SCRIPT_FILE = 'script.txt';

export const VALID_STATUSES = ['draft', 'preview', 'rendered', 'approved', 'published', 'archived'];
export const VALID_VISIBILITY = ['private', 'gallery'];

export function sectionForRatio(ratio) {
  return ratio === '9:16' ? 'short' : 'video';
}

export function sectionFolder(config, section) {
  const key = section === 'short' || section === 'shorts' ? 'short' : 'video';
  return config.storage.sections[key];
}

export function storageRoot(config) {
  return config.paths?.storageRoot ?? path.resolve(config.storage.root);
}

export function sectionDir(config, section) {
  return path.join(storageRoot(config), sectionFolder(config, section));
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

export function readJson(file, fallback = undefined) {
  if (!file) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

export function writeJsonAtomic(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    if (!['EEXIST', 'EPERM', 'EACCES'].includes(error.code)) throw error;
    fs.rmSync(file, {force: true});
    fs.renameSync(tmp, file);
  }
}

/** ASCII, filename-safe slug used for project folders. */
export function slugify(value, fallback = 'project') {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || fallback;
}

/** Turn `great-pyramid-3f9a1c` into `Great Pyramid`. */
export function humanizeId(value) {
  return String(value ?? '')
    .replace(/-[0-9a-f]{6}$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim() || 'Untitled';
}

export function shortHash(value, length = 6) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, length);
}

export function newProjectId(title) {
  return `${slugify(title)}-${crypto.randomBytes(3).toString('hex')}`;
}

/** Stable id so a repeated migration never creates duplicates. */
export function deterministicProjectId(title, sourceKey) {
  return `${slugify(title)}-${shortHash(sourceKey)}`;
}

/**
 * Resolve `candidate` and guarantee it stays inside `root`. Used for every
 * dashboard media request and every CLI path that comes from user input.
 */
export function safeResolve(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, candidate);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (resolved !== resolvedRoot && !resolved.startsWith(prefix)) {
    throw new Error(`Path escapes ${resolvedRoot}: ${candidate}`);
  }
  return resolved;
}

export function storageRelative(config, file) {
  const root = storageRoot(config);
  return path.relative(root, path.resolve(file)).split(path.sep).join('/');
}

export function projectRelative(dir, file) {
  return path.relative(dir, path.resolve(file)).split(path.sep).join('/');
}

export function isProjectDir(dir) {
  return fs.existsSync(path.join(dir, PROJECT_FILE)) || fs.existsSync(path.join(dir, META_FILE));
}

export function listProjectDirs(config) {
  const dirs = [];
  for (const section of ['video', 'short']) {
    const root = sectionDir(config, section);
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      if (isProjectDir(dir)) dirs.push({dir, id: entry.name, section});
    }
  }
  return dirs;
}

/**
 * Find a project by absolute path, folder id, slug-prefix or title fragment.
 * Returns `{dir, id, section}` or null.
 */
export function findProject(config, identifier) {
  if (!identifier) return null;
  const raw = String(identifier);
  const candidate = path.resolve(raw);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    const parent = path.basename(path.dirname(candidate)).toLowerCase();
    const section = parent === config.storage.sections.short.toLowerCase() ? 'short' : 'video';
    return {dir: candidate, id: path.basename(candidate), section};
  }

  const needle = raw.toLowerCase().replace(/\\/g, '/');
  const projects = listProjectDirs(config);
  const exact = projects.find(project => project.id.toLowerCase() === needle);
  if (exact) return exact;

  const byPrefix = projects.find(project => project.id.toLowerCase().startsWith(`${needle}-`) || project.id.toLowerCase().startsWith(needle));
  if (byPrefix) return byPrefix;

  const byTitle = projects.find(project => {
    const meta = readJson(path.join(project.dir, META_FILE), {});
    return String(meta.title ?? '').toLowerCase().includes(needle);
  });
  return byTitle ?? null;
}

export function projectPaths(dir) {
  return {
    dir,
    project: path.join(dir, PROJECT_FILE),
    meta: path.join(dir, META_FILE),
    script: path.join(dir, SCRIPT_FILE),
    output: path.join(dir, 'output'),
    source: path.join(dir, 'source'),
    assets: path.join(dir, 'assets'),
  };
}

export function fileInfo(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    return {path: file, bytes: stat.size, modifiedAt: stat.mtime.toISOString()};
  } catch {
    return null;
  }
}

/** Ensure the shared library folders exist (idempotent). */
export function ensureLibrary(config) {
  for (const dir of [config.paths.library, config.paths.voices, config.paths.migrations]) ensureDir(dir);
  return config.paths.library;
}

export function loadVoiceReferences(config) {
  const root = config.paths.voices;
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const dir = path.join(root, entry.name);
      const meta = readJson(path.join(dir, 'voice.json'), null);
      if (!meta) return null;
      return {...meta, id: entry.name, dir};
    })
    .filter(Boolean);
}
