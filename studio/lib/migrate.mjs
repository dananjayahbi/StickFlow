/**
 * One-time, copy-first migration from the old flat `output/` folder into the
 * StoryFlow-style `Storage/Videos|Shorts/<project-id>/` layout.
 *
 * Originals are never moved or deleted. Re-running the command is idempotent:
 * existing targets are left alone and reported as skipped.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './config.mjs';
import {deterministicProjectId, ensureDir, sectionDir, storageRelative} from './storage.mjs';
import {registerProject, writeMeta} from './metadata.mjs';

const PAIRS = new Map([
  ['stickflow-the-great-pyramid.mp4', 'great-pyramid'],
  ['stickflow-b1-demo.mp4', 'demo-b1'],
]);

const SPECIAL = {
  'great-pyramid': {
    title: 'The Great Pyramid',
    slug: 'great-pyramid',
    status: 'published',
    visibility: 'gallery',
    tts: {engine: 'kokoro', voice: 'bm_george', mode: 'preset'},
  },
  'demo-b1': {
    title: 'B1 Demo',
    slug: 'b1-demo',
    status: 'rendered',
    visibility: 'private',
    tts: {engine: 'bundled', voice: null, mode: null},
  },
};

export function walkFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, {withFileTypes: true})) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function describeFiles(root) {
  const files = walkFiles(root);
  return {
    count: files.length,
    bytes: files.reduce((total, file) => total + fs.statSync(file).size, 0),
    hashes: files.map(file => ({
      path: path.relative(root, file).split(path.sep).join('/'),
      bytes: fs.statSync(file).size,
      sha256: hashFile(file),
    })),
  };
}

function titleFromVideo(filename) {
  return path.basename(filename, path.extname(filename))
    .replace(/^stickflow[-_ ]*/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim();
}

function contactSheetFor(video) {
  const base = path.basename(video, path.extname(video));
  const candidate = path.join(path.dirname(video), `${base}-contact-sheet.png`);
  return fs.existsSync(candidate) ? candidate : null;
}

function copyFile(source, target) {
  if (fs.existsSync(target)) return 'skip';
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  return 'copy';
}

function copyTree(source, target) {
  const existed = fs.existsSync(target);
  ensureDir(target);
  // Merge semantics: existing files are left untouched, missing files are
  // filled in, so a failed first pass can be completed by re-running.
  fs.cpSync(source, target, {recursive: true, force: false, errorOnExist: false});
  return existed ? 'merge' : 'copy';
}

function projectSection(project) {
  return project?.height > project?.width ? 'short' : 'video';
}

/**
 * Build the migration plan. `apply: true` performs the copies and metadata
 * writes; the default is a safe dry run.
 */
export function planMigration(config, {outputDir = path.join(ROOT, 'output'), apply = false} = {}) {
  if (!fs.existsSync(outputDir)) throw new Error(`Legacy output folder not found: ${outputDir}`);
  const actions = [];
  const projects = new Map();
  const looseVideos = [];

  for (const entry of fs.readdirSync(outputDir, {withFileTypes: true})) {
    const full = path.join(outputDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      if (fs.existsSync(path.join(full, 'project.json'))) projects.set(entry.name, full);
    } else if (entry.isFile() && /\.mp4$/i.test(entry.name)) {
      looseVideos.push(full);
    }
  }

  const paired = new Set();
  for (const video of looseVideos) {
    const key = path.basename(video).toLowerCase();
    const projectName = PAIRS.get(key);
    if (!projectName || !projects.has(projectName)) continue;
    paired.add(video);
    const source = projects.get(projectName);
    const project = JSON.parse(fs.readFileSync(path.join(source, 'project.json'), 'utf8'));
    const section = projectSection(project);
    const special = SPECIAL[projectName] || {};
    const title = special.title || projectName.replace(/-/g, ' ');
    const id = deterministicProjectId(special.slug || title, path.relative(ROOT, source));
    const target = path.join(sectionDir(config, section), id);
    const sheet = contactSheetFor(video);
    const action = {
      kind: 'project',
      title,
      id,
      section,
      source,
      target,
      status: special.status || 'rendered',
      visibility: special.visibility || 'private',
      tts: special.tts,
      sources: describeFiles(source),
      copies: [
        {from: video, to: path.join(target, 'output', 'film.mp4')},
        ...(sheet ? [{from: sheet, to: path.join(target, 'output', 'film-contact-sheet.png')}] : []),
      ],
      skipped: false,
      written: [],
    };
    actions.push(action);
  }

  for (const [projectName, source] of projects) {
    if ([...actions].some(action => action.source === source)) continue;
    const project = JSON.parse(fs.readFileSync(path.join(source, 'project.json'), 'utf8'));
    const section = projectSection(project);
    const special = SPECIAL[projectName] || {};
    const title = special.title || projectName.replace(/-/g, ' ');
    const id = deterministicProjectId(special.slug || title, path.relative(ROOT, source));
    const target = path.join(sectionDir(config, section), id);
    actions.push({
      kind: 'project',
      title,
      id,
      section,
      source,
      target,
      status: special.status || 'rendered',
      visibility: special.visibility || 'private',
      tts: special.tts,
      sources: describeFiles(source),
      copies: [],
      skipped: false,
      written: [],
    });
  }

  for (const video of looseVideos) {
    if (paired.has(video)) continue;
    const title = titleFromVideo(video);
    const id = deterministicProjectId(`legacy ${title}`, path.relative(ROOT, video));
    const target = path.join(sectionDir(config, 'video'), id);
    const sheet = contactSheetFor(video);
    actions.push({
      kind: 'legacy-video',
      title,
      id,
      section: 'video',
      source: video,
      target,
      status: 'rendered',
      visibility: 'private',
      tts: {engine: 'unknown', voice: null, mode: null},
      sources: null,
      copies: [
        {from: video, to: path.join(target, 'output', 'film.mp4')},
        ...(sheet ? [{from: sheet, to: path.join(target, 'output', 'film-contact-sheet.png')}] : []),
      ],
      skipped: false,
      written: [],
    });
  }

  if (apply) {
    ensureDir(path.join(config.paths.library, 'migrations'));
    for (const action of actions) {
      if (action.kind === 'project') {
        action.skipped = fs.existsSync(action.target);
        const result = copyTree(action.source, action.target);
        action.tree = result;
        for (const copy of action.copies) {
          const copied = copyFile(copy.from, copy.to);
          action.written.push({...copy, result: copied});
        }
        const meta = registerProject(action.target, config, {
          id: action.id,
          title: action.title,
          section: action.section,
          status: action.status,
          visibility: action.visibility,
          legacy: true,
          tts: action.tts,
          ...(action.status === 'published' ? {publish: {publishedAt: new Date(fs.statSync(action.copies[0]?.from || action.source).mtimeMs).toISOString()}} : {}),
          description: 'Migrated from the legacy output/ folder.',
        });
        action.meta = meta;
      } else {
        action.skipped = fs.existsSync(action.target);
        ensureDir(path.join(action.target, 'output'));
        for (const copy of action.copies) {
          const copied = copyFile(copy.from, copy.to);
          action.written.push({...copy, result: copied});
        }
        writeMeta(action.target, {
          schemaVersion: 1,
          id: action.id,
          title: action.title,
          status: 'rendered',
          legacy: true,
        });
        const meta = registerProject(action.target, config, {
          id: action.id,
          title: action.title,
          section: 'video',
          status: 'rendered',
          visibility: 'private',
          legacy: true,
          tts: action.tts,
          description: `Migrated from ${path.basename(action.source)}.`,
        });
        action.meta = meta;
      }
    }
    const manifest = path.join(config.paths.library, 'migrations', `manifest-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    const payload = {
      generatedAt: new Date().toISOString(),
      sourceRoot: outputDir,
      storageRoot: config.paths.storageRoot,
      actions: actions.map(action => ({
        ...action,
        target: storageRelative(config, action.target),
        sources: action.sources,
        meta: action.meta ? {id: action.meta.id, title: action.meta.title, status: action.meta.status} : undefined,
      })),
    };
    fs.writeFileSync(manifest, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return {apply, actions, manifest};
  }

  for (const action of actions) {
    action.targetRelative = storageRelative(config, action.target);
  }
  return {apply, actions, manifest: null};
}

export function summarizeMigration(result) {
  return result.actions.map(action => ({
    kind: action.kind,
    title: action.title,
    id: action.id,
    section: action.section,
    source: path.relative(ROOT, action.source),
    target: action.targetRelative ?? null,
    copies: action.copies.length,
    skipped: action.skipped,
  }));
}
