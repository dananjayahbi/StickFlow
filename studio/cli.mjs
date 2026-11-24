#!/usr/bin/env node
/**
 * StickFlow Studio CLI.
 *
 * Commands:
 *   context                 resolved config, engine health, storage counts
 *   new "Title"             scaffold a project inside Storage/
 *   list                    list registered projects
 *   status <id|path>        show one project and its artifacts
 *   register <id|path>      refresh project-meta.json from actual files
 *   migrate-legacy          copy old output/ projects into Storage/
 *   config get [path]       read configuration
 *   config set <path> <v>   write configuration atomically
 *   doctor                  local readiness checks
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, CONFIG_FILE, ENGINE_IDS, RATIOS, STYLE_IDS,
  engineHealth, getPath, loadConfig, loadRawConfig, parseConfigValue, setPath, updateRawConfig,
} from './lib/config.mjs';
import {
  ensureDir, ensureLibrary, findProject, humanizeId, loadVoiceReferences, newProjectId,
  readJson, sectionDir, sectionForRatio, storageRelative, listProjectDirs, slugify,
  VALID_STATUSES, VALID_VISIBILITY,
} from './lib/storage.mjs';
import {artifactFiles, readProjectSummary, registerProject} from './lib/metadata.mjs';
import {planMigration} from './lib/migrate.mjs';

const [command, ...args] = process.argv.slice(2);
const has = flag => args.includes(flag);
const option = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1] ?? fallback;
};
const positional = () => args.filter((arg, index) => !arg.startsWith('--') && !(index > 0 && args[index - 1].startsWith('--')));
const jsonOut = () => has('--json');

function line(...values) { console.log(values.join(' ')); }
function table(rows, columns) {
  const widths = columns.map(column => Math.max(column.label.length, ...rows.map(row => String(row[column.key] ?? '').length)));
  line(columns.map((column, index) => column.label.padEnd(widths[index])).join('  '));
  line(columns.map((_, index) => '-'.repeat(widths[index])).join('  '));
  for (const row of rows) line(columns.map((column, index) => String(row[column.key] ?? '').padEnd(widths[index])).join('  '));
}

function resolveProject(config, identifier) {
  const found = findProject(config, identifier);
  if (!found) throw new Error(`Project not found: ${identifier}. Run "node studio/cli.mjs list".`);
  return found;
}

function summarize(config) {
  const dirs = listProjectDirs(config);
  const projects = dirs.map(item => readProjectSummary(item.dir, config, item.section));
  const statuses = {};
  let duration = 0;
  let bytes = 0;
  for (const project of projects) {
    statuses[project.status] = (statuses[project.status] || 0) + 1;
    duration += Number(project.duration) || 0;
    bytes += Number(project.video?.bytes) || 0;
  }
  return {
    total: projects.length,
    statuses,
    durationSeconds: Math.round(duration * 1000) / 1000,
    videoBytes: bytes,
    recent: projects
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, 5)
      .map(project => ({id: project.id, title: project.title, status: project.status, duration: project.duration, updatedAt: project.updatedAt})),
  };
}

function context(config) {
  const health = engineHealth(config);
  const counts = summarize(config);
  return {
    root: ROOT,
    configFile: CONFIG_FILE,
    defaultEngine: config.tts.defaultEngine,
    fallbackToKokoro: config.tts.fallbackToKokoro,
    projectDefaults: config.projectDefaults,
    storage: {
      root: config.paths.storageRoot,
      videos: sectionDir(config, 'video'),
      shorts: sectionDir(config, 'short'),
      library: config.paths.library,
      voices: config.paths.voices,
    },
    engines: health,
    counts,
    voices: loadVoiceReferences(config).map(voice => ({id: voice.id, name: voice.name, engine: voice.engine, audio: voice.audio})),
  };
}

function commandContext() {
  const config = loadConfig();
  const payload = context(config);
  if (jsonOut()) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  line(`StickFlow root      ${payload.root}`);
  line(`Config              ${payload.configFile}`);
  line(`Default TTS         ${payload.defaultEngine} (fallback to Kokoro: ${payload.fallbackToKokoro})`);
  line(`Storage             ${payload.storage.root}`);
  line(`Videos              ${payload.storage.videos}`);
  line(`Shorts              ${payload.storage.shorts}`);
  line(`Voice library       ${payload.storage.voices}`);
  line('');
  for (const [engine, state] of Object.entries(payload.engines)) {
    line(`${engine.padEnd(8)} ${state.available ? 'ready' : 'unavailable'}${state.reasons?.length ? ` — ${state.reasons.join('; ')}` : ''}`);
  }
  line('');
  line(`Projects            ${payload.counts.total} (${Object.entries(payload.counts.statuses).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none'})`);
  line(`Total duration      ${payload.counts.durationSeconds}s`);
  if (payload.voices.length) line(`Saved voices        ${payload.voices.map(voice => voice.name || voice.id).join(', ')}`);
}

function commandNew() {
  const title = positional()[0];
  if (!title) throw new Error('Usage: node studio/cli.mjs new "Title" [--style B1] [--ratio 16:9] [--slug my-slug]');
  const config = loadConfig();
  const style = option('--style', config.projectDefaults.style);
  const ratio = option('--ratio', config.projectDefaults.ratio);
  if (!STYLE_IDS.includes(style)) throw new Error(`Unknown style ${style}. Use ${STYLE_IDS.join(', ')}.`);
  if (!RATIOS.includes(ratio)) throw new Error(`Unknown ratio ${ratio}. Use ${RATIOS.join(' or ')}.`);
  const section = sectionForRatio(ratio);
  const baseSlug = option('--slug', slugify(title));
  const id = newProjectId(baseSlug);
  const parent = sectionDir(config, section);
  ensureDir(parent);
  const dir = path.join(parent, id);
  if (fs.existsSync(dir)) throw new Error(`Project folder already exists: ${dir}`);

  const initArgs = [path.join(ROOT, 'skills/stickflow/scripts/autopilot.mjs'), 'init', dir, '--style', style];
  if (style !== 'B5') initArgs.push('--ratio', ratio);
  const init = spawnSync(process.execPath, initArgs, {encoding: 'utf8', timeout: 120000});
  if (init.status !== 0) {
    if (fs.existsSync(dir)) fs.rmSync(dir, {recursive: true, force: true});
    throw new Error(`Project scaffold failed: ${(init.stderr || init.stdout || '').trim()}`);
  }

  ensureDir(path.join(dir, 'source'));
  ensureDir(path.join(dir, 'assets'));
  const meta = registerProject(dir, config, {
    id,
    title: String(title).trim(),
    section,
    format: ratio,
    style,
    status: 'draft',
    visibility: 'private',
  });
  const payload = {
    project: dir,
    projectFile: path.join(dir, 'project.json'),
    metaFile: path.join(dir, 'project-meta.json'),
    id,
    title: meta.title,
    style,
    ratio,
    storage: storageRelative(config, dir),
  };
  if (jsonOut()) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  line(`Created ${meta.title}`);
  line(`  folder   ${dir}`);
  line(`  style    ${style} · ${ratio}`);
  line(`  metadata ${payload.metaFile}`);
  line('');
  line('Next: write script.txt, generate narration, then run autopilot validate/preview.');
}

function commandList() {
  const config = loadConfig();
  const dirs = listProjectDirs(config);
  const rows = dirs.map(item => {
    const meta = readProjectSummary(item.dir, config, item.section);
    return {
      id: meta.id,
      title: meta.title,
      section: meta.section ?? item.section,
      status: meta.status ?? 'unregistered',
      duration: meta.duration ? `${Number(meta.duration).toFixed(1)}s` : '—',
      engine: meta.tts?.engine ?? '—',
      size: meta.video?.bytes ? `${(meta.video.bytes / 1024 / 1024).toFixed(1)} MB` : '—',
      updated: meta.updatedAt ? String(meta.updatedAt).slice(0, 10) : '—',
    };
  }).sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  if (jsonOut()) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (!rows.length) { line('No projects yet. Run: node studio/cli.mjs new "My Video"'); return; }
  table(rows, [
    {key: 'id', label: 'ID'}, {key: 'title', label: 'TITLE'}, {key: 'section', label: 'SECTION'},
    {key: 'status', label: 'STATUS'}, {key: 'duration', label: 'DURATION'}, {key: 'engine', label: 'TTS'},
    {key: 'size', label: 'SIZE'}, {key: 'updated', label: 'UPDATED'},
  ]);
}

function commandStatus() {
  const identifier = positional()[0];
  if (!identifier) throw new Error('Usage: node studio/cli.mjs status <id|path>');
  const config = loadConfig();
  const project = resolveProject(config, identifier);
  const meta = readProjectSummary(project.dir, config, project.section);
  const artifacts = artifactFiles(project.dir);
  if (jsonOut()) {
    console.log(JSON.stringify({project: project.dir, meta, artifacts}, null, 2));
    return;
  }
  line(`${meta.title}  [${meta.status}]`);
  line(`  id        ${meta.id}`);
  line(`  folder    ${project.dir}`);
  line(`  format    ${meta.format ?? '—'} · style ${meta.style ?? '—'}`);
  line(`  duration  ${meta.duration ? `${Number(meta.duration).toFixed(2)}s` : '—'}`);
  line(`  tts       ${meta.tts?.engine ?? '—'}${meta.tts?.voice ? ` / ${meta.tts.voice}` : ''}`);
  line(`  tags      ${(meta.tags || []).join(', ') || '—'}`);
  line('');
  for (const [name, info] of Object.entries(artifacts)) {
    if (!info) continue;
    line(`  ${name.padEnd(12)} ${(info.bytes / 1024).toFixed(0).padStart(8)} KB  ${path.relative(project.dir, info.path)}`);
  }
}

function commandRegister() {
  const identifier = positional()[0];
  if (!identifier) throw new Error('Usage: node studio/cli.mjs register <id|path> [--title T] [--status S] [--visibility V]');
  const config = loadConfig();
  const project = resolveProject(config, identifier);
  const status = option('--status');
  const visibility = option('--visibility');
  if (status && !VALID_STATUSES.includes(status)) throw new Error(`Invalid status ${status}.`);
  if (visibility && !VALID_VISIBILITY.includes(visibility)) throw new Error(`Invalid visibility ${visibility}.`);
  const meta = registerProject(project.dir, config, {
    title: option('--title'),
    status,
    visibility,
    tags: has('--tags') ? option('--tags').split(',').map(tag => tag.trim()).filter(Boolean) : undefined,
  });
  if (jsonOut()) console.log(JSON.stringify(meta, null, 2));
  else line(`Registered ${meta.id} · ${meta.status} · ${meta.duration ? `${meta.duration.toFixed(2)}s` : 'no video'}`);
}

function commandMigrate() {
  const config = loadConfig();
  ensureLibrary(config);
  const result = planMigration(config, {apply: has('--apply')});
  const rows = result.actions.map(action => ({
    kind: action.kind,
    title: action.title,
    id: action.id,
    section: action.section,
    source: path.relative(ROOT, action.source),
    target: storageRelative(config, action.target),
    extra: action.copies.length ? `${action.copies.length} paired file(s)` : '',
    skipped: action.skipped ? 'yes' : '',
  }));
  if (jsonOut()) {
    console.log(JSON.stringify({apply: result.apply, manifest: result.manifest, actions: rows}, null, 2));
    return;
  }
  table(rows, [
    {key: 'kind', label: 'KIND'}, {key: 'title', label: 'TITLE'}, {key: 'section', label: 'SECTION'},
    {key: 'source', label: 'SOURCE'}, {key: 'target', label: 'TARGET'}, {key: 'extra', label: 'EXTRA'}, {key: 'skipped', label: 'SKIP'},
  ]);
  line('');
  if (result.apply) {
    line(`Migration applied. Manifest: ${result.manifest}`);
    line('Originals in output/ were not modified.');
  } else {
    line('Dry run only. Re-run with --apply to copy into Storage/.');
  }
}

function commandConfig() {
  const action = positional()[0] ?? 'get';
  if (action === 'get') {
    const key = positional()[1];
    const config = has('--resolved') ? loadConfig() : loadRawConfig();
    const value = key ? getPath(config, key) : config;
    if (value === undefined) throw new Error(`Unknown config path: ${key}`);
    console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    return;
  }
  if (action === 'set') {
    const key = positional()[1];
    const rawValue = positional().slice(2).join(' ');
    if (!key || rawValue === '') throw new Error('Usage: node studio/cli.mjs config set <dotted.path> <value>');
    const next = updateRawConfig(config => setPath(config, key, parseConfigValue(rawValue)));
    console.log(JSON.stringify({updated: key, value: getPath(next, key)}, null, 2));
    return;
  }
  throw new Error('Usage: node studio/cli.mjs config get [path] | config set <path> <value>');
}

function commandDoctor() {
  const config = loadConfig();
  const health = engineHealth(config);
  const checks = {
    node: Number(process.versions.node.split('.')[0]) >= 20,
    config: fs.existsSync(CONFIG_FILE),
    storage: fs.existsSync(config.paths.storageRoot) || (() => { try { ensureDir(config.paths.storageRoot); return true; } catch { return false; } })(),
    ffmpeg: spawnSync(process.env.FFMPEG || 'ffmpeg', ['-version'], {encoding: 'utf8'}).status === 0,
    ffprobe: spawnSync(process.env.FFPROBE || 'ffprobe', ['-version'], {encoding: 'utf8'}).status === 0,
    qwen: health.qwen.available,
    kokoro: health.kokoro.available,
  };
  console.log(JSON.stringify({checks, health, configFile: CONFIG_FILE, storageRoot: config.paths.storageRoot}, null, 2));
  if (!checks.node || !checks.config || !checks.storage || !checks.ffmpeg || !checks.ffprobe || !checks[config.tts.defaultEngine]) process.exitCode = 1;
}

async function main() {
  if (command === 'context') commandContext();
  else if (command === 'new') commandNew();
  else if (command === 'list') commandList();
  else if (command === 'status') commandStatus();
  else if (command === 'register') commandRegister();
  else if (command === 'migrate-legacy') commandMigrate();
  else if (command === 'config') commandConfig();
  else if (command === 'doctor') commandDoctor();
  else {
    line('StickFlow Studio CLI');
    line('');
    line('  node studio/cli.mjs context [--json]');
    line('  node studio/cli.mjs new "Title" [--style B1] [--ratio 16:9]');
    line('  node studio/cli.mjs list [--json]');
    line('  node studio/cli.mjs status <id|path> [--json]');
    line('  node studio/cli.mjs register <id|path> [--title T] [--status S] [--visibility V]');
    line('  node studio/cli.mjs migrate-legacy [--apply] [--json]');
    line('  node studio/cli.mjs config get [path] | config set <path> <value>');
    line('  node studio/cli.mjs doctor');
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
