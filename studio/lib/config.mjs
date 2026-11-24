/**
 * StickFlow configuration loader.
 *
 * `stickflow.config.json` is the single source of truth for default TTS
 * engine, storage roots, dashboard settings and publish preferences. The file
 * stays human-readable and is written atomically by both the CLI and the
 * dashboard.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CONFIG_FILE = process.env.STICKFLOW_CONFIG
  ? path.resolve(process.env.STICKFLOW_CONFIG)
  : path.join(ROOT, 'stickflow.config.json');
export const STYLE_IDS = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'];
export const RATIOS = ['16:9', '9:16'];
export const ENGINE_IDS = ['qwen', 'kokoro'];
export const QWEN_MODES = ['custom_voice', 'clone'];

export const DEFAULTS = Object.freeze({
  version: 1,
  storage: {
    root: 'Storage',
    sections: {video: 'Videos', short: 'Shorts'},
    library: '_library',
  },
  projectDefaults: {style: 'B1', ratio: '16:9', fps: 30, captionLead: 0.15},
  tts: {
    defaultEngine: 'qwen',
    fallbackToKokoro: true,
    engines: {
      qwen: {
        enabled: true,
        python: 'E:/My_GitHub_Repos/storyFlow/backend/qwen_tts/.venv/Scripts/python.exe',
        model: 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice',
        baseModel: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base',
        mode: 'custom_voice',
        speaker: 'Aiden',
        language: 'English',
        maxNewTokens: 1024,
        vramFraction: 0.72,
        speed: 1.0,
        offline: true,
        reference: {audio: null, text: '', xVectorOnly: true, voiceId: null},
      },
      kokoro: {
        enabled: true,
        python: 'skills/stickflow/.kokoro-venv/Scripts/python.exe',
        model: 'skills/stickflow/assets/kokoro/kokoro-v1.0.onnx',
        voices: 'skills/stickflow/assets/kokoro/voices-v1.0.bin',
        voice: 'bm_george',
        speed: 0.95,
        pause: 0.25,
      },
    },
  },
  dashboard: {host: '127.0.0.1', port: 57321},
  publishing: {timezone: 'Asia/Colombo', platforms: ['youtube', 'tiktok', 'instagram', 'facebook']},
});

const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

/** Merge plain objects recursively; arrays and scalars are replaced. */
export function deepMerge(base, override) {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (isObject(base) && isObject(override)) {
    const result = {...base};
    for (const [key, value] of Object.entries(override)) {
      result[key] = key in base ? deepMerge(base[key], value) : value;
    }
    return result;
  }
  return override === undefined ? base : override;
}

export function resolveFrom(root, value) {
  if (typeof value !== 'string' || !value.trim()) return value;
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(root, value);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function validateConfig(raw) {
  const errors = [];
  const fail = message => errors.push(message);
  if (!isObject(raw)) return ['Configuration must be a JSON object.'];
  if (raw.version !== 1) fail('version must be 1.');
  if (!isObject(raw.storage)) fail('storage must be an object.');
  else {
    if (typeof raw.storage.root !== 'string' || !raw.storage.root.trim()) fail('storage.root must be a path.');
    if (!isObject(raw.storage.sections)) fail('storage.sections must be an object.');
    else {
      for (const key of ['video', 'short']) {
        const value = raw.storage.sections[key];
        if (typeof value !== 'string' || !value.trim()) fail(`storage.sections.${key} must be a folder name.`);
        if (value && /[\\/:*?"<>|]/.test(value)) fail(`storage.sections.${key} contains invalid characters.`);
      }
    }
    if (typeof raw.storage.library !== 'string' || !raw.storage.library.trim()) fail('storage.library must be a folder name.');
  }
  if (!isObject(raw.projectDefaults)) fail('projectDefaults must be an object.');
  else {
    if (!STYLE_IDS.includes(raw.projectDefaults.style)) fail(`projectDefaults.style must be one of ${STYLE_IDS.join(', ')}.`);
    if (!RATIOS.includes(raw.projectDefaults.ratio)) fail(`projectDefaults.ratio must be ${RATIOS.join(' or ')}.`);
    if (!Number.isInteger(raw.projectDefaults.fps) || raw.projectDefaults.fps < 12 || raw.projectDefaults.fps > 60) {
      fail('projectDefaults.fps must be an integer from 12 to 60.');
    }
    if (!Number.isFinite(raw.projectDefaults.captionLead) || raw.projectDefaults.captionLead < 0 || raw.projectDefaults.captionLead > 5) {
      fail('projectDefaults.captionLead must be from 0 to 5 seconds.');
    }
  }
  if (!isObject(raw.tts)) fail('tts must be an object.');
  else {
    if (!ENGINE_IDS.includes(raw.tts.defaultEngine)) fail(`tts.defaultEngine must be one of ${ENGINE_IDS.join(', ')}.`);
    if (typeof raw.tts.fallbackToKokoro !== 'boolean') fail('tts.fallbackToKokoro must be true or false.');
    if (!isObject(raw.tts.engines)) fail('tts.engines must be an object.');
    else {
      const qwen = raw.tts.engines.qwen;
      if (!isObject(qwen)) fail('tts.engines.qwen must be an object.');
      else {
        if (typeof qwen.enabled !== 'boolean') fail('tts.engines.qwen.enabled must be true or false.');
        if (typeof qwen.python !== 'string' || !qwen.python.trim()) fail('tts.engines.qwen.python must be a path.');
        if (typeof qwen.model !== 'string' || !qwen.model.trim()) fail('tts.engines.qwen.model must be a model id.');
        if (typeof qwen.baseModel !== 'string' || !qwen.baseModel.trim()) fail('tts.engines.qwen.baseModel must be a model id.');
        if (!QWEN_MODES.includes(qwen.mode)) fail(`tts.engines.qwen.mode must be one of ${QWEN_MODES.join(', ')}.`);
        if (typeof qwen.speaker !== 'string' || !qwen.speaker.trim()) fail('tts.engines.qwen.speaker must be a name.');
        if (typeof qwen.language !== 'string' || !qwen.language.trim()) fail('tts.engines.qwen.language must be a name.');
        if (!Number.isInteger(qwen.maxNewTokens) || qwen.maxNewTokens < 64 || qwen.maxNewTokens > 2048) {
          fail('tts.engines.qwen.maxNewTokens must be an integer from 64 to 2048.');
        }
        if (!Number.isFinite(qwen.vramFraction) || qwen.vramFraction <= 0 || qwen.vramFraction > 1) {
          fail('tts.engines.qwen.vramFraction must be greater than 0 and at most 1.');
        }
        if (!Number.isFinite(qwen.speed) || qwen.speed < 0.5 || qwen.speed > 2) fail('tts.engines.qwen.speed must be from 0.5 to 2.');
        if (typeof qwen.offline !== 'boolean') fail('tts.engines.qwen.offline must be true or false.');
        if (!isObject(qwen.reference)) fail('tts.engines.qwen.reference must be an object.');
        else {
          if (qwen.reference.audio !== null && typeof qwen.reference.audio !== 'string') fail('tts.engines.qwen.reference.audio must be a path or null.');
          if (typeof qwen.reference.text !== 'string') fail('tts.engines.qwen.reference.text must be a string.');
          if (typeof qwen.reference.xVectorOnly !== 'boolean') fail('tts.engines.qwen.reference.xVectorOnly must be true or false.');
          if (qwen.mode === 'clone' && !qwen.reference.audio) fail('tts.engines.qwen.reference.audio is required when mode is clone.');
        }
      }
      const kokoro = raw.tts.engines.kokoro;
      if (!isObject(kokoro)) fail('tts.engines.kokoro must be an object.');
      else {
        if (typeof kokoro.enabled !== 'boolean') fail('tts.engines.kokoro.enabled must be true or false.');
        if (typeof kokoro.python !== 'string' || !kokoro.python.trim()) fail('tts.engines.kokoro.python must be a path.');
        if (typeof kokoro.model !== 'string' || !kokoro.model.trim()) fail('tts.engines.kokoro.model must be a path.');
        if (typeof kokoro.voices !== 'string' || !kokoro.voices.trim()) fail('tts.engines.kokoro.voices must be a path.');
        if (typeof kokoro.voice !== 'string' || !kokoro.voice.trim()) fail('tts.engines.kokoro.voice must be a voice id.');
        if (!Number.isFinite(kokoro.speed) || kokoro.speed < 0.5 || kokoro.speed > 2) fail('tts.engines.kokoro.speed must be from 0.5 to 2.');
        if (!Number.isFinite(kokoro.pause) || kokoro.pause < 0 || kokoro.pause > 2) fail('tts.engines.kokoro.pause must be from 0 to 2.');
      }
      if (raw.tts.defaultEngine && raw.tts.engines[raw.tts.defaultEngine] && raw.tts.engines[raw.tts.defaultEngine].enabled === false) {
        fail(`tts.defaultEngine "${raw.tts.defaultEngine}" is disabled.`);
      }
    }
  }
  if (!isObject(raw.dashboard)) fail('dashboard must be an object.');
  else {
    if (typeof raw.dashboard.host !== 'string' || !raw.dashboard.host.trim()) fail('dashboard.host must be a hostname.');
    if (!Number.isInteger(raw.dashboard.port) || raw.dashboard.port < 1024 || raw.dashboard.port > 65535) {
      fail('dashboard.port must be an integer from 1024 to 65535.');
    }
  }
  if (!isObject(raw.publishing)) fail('publishing must be an object.');
  else {
    if (typeof raw.publishing.timezone !== 'string' || !raw.publishing.timezone.trim()) fail('publishing.timezone must be an IANA timezone.');
    if (!Array.isArray(raw.publishing.platforms) || !raw.publishing.platforms.every(p => typeof p === 'string' && p.trim())) {
      fail('publishing.platforms must be an array of platform names.');
    }
  }
  return errors;
}

/** Read the raw JSON file exactly as stored. */
export function loadRawConfig(file = CONFIG_FILE) {
  if (!fs.existsSync(file)) {
    throw new Error(`StickFlow configuration not found: ${file}`);
  }
  const raw = readJson(file);
  const errors = validateConfig(raw);
  if (errors.length) throw new Error(`Invalid StickFlow configuration:\n- ${errors.join('\n- ')}`);
  return raw;
}

/**
 * Load and resolve paths. Relative paths resolve from the repository root so
 * the config is portable across machines.
 */
export function loadConfig({file = CONFIG_FILE, root = ROOT} = {}) {
  const raw = loadRawConfig(file);
  const merged = deepMerge(DEFAULTS, raw);
  const qwen = merged.tts.engines.qwen;
  const kokoro = merged.tts.engines.kokoro;
  const storageRoot = resolveFrom(root, merged.storage.root);
  const library = path.resolve(storageRoot, merged.storage.library);
  return {
    ...merged,
    paths: {
      root,
      configFile: file,
      storageRoot,
      library,
      voices: path.join(library, 'voices'),
      migrations: path.join(library, 'migrations'),
      qwenPython: resolveFrom(root, qwen.python),
      qwenReference: qwen.reference.audio ? resolveFrom(root, qwen.reference.audio) : null,
      kokoroPython: resolveFrom(root, kokoro.python),
      kokoroModel: resolveFrom(root, kokoro.model),
      kokoroVoices: resolveFrom(root, kokoro.voices),
    },
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, {recursive: true});
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withLock(file, callback) {
  const lock = `${file}.lock`;
  ensureDir(path.dirname(file));
  const started = Date.now();
  let handle;
  while (handle === undefined) {
    try {
      const fd = fs.openSync(lock, 'wx');
      fs.writeSync(fd, `${process.pid}\n`);
      fs.closeSync(fd);
      handle = true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - started > 3000) throw new Error(`Configuration is locked: ${lock}`);
      sleep(25);
    }
  }
  try {
    return callback();
  } finally {
    try { fs.unlinkSync(lock); } catch {}
  }
}

export function writeRawConfig(raw, file = CONFIG_FILE) {
  const errors = validateConfig(raw);
  if (errors.length) throw new Error(`Invalid StickFlow configuration:\n- ${errors.join('\n- ')}`);
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    if (!['EEXIST', 'EPERM', 'EACCES'].includes(error.code)) throw error;
    fs.rmSync(file, {force: true});
    fs.renameSync(tmp, file);
  }
}

/**
 * Read-modify-write with a short exclusive lock. `mutator` receives a deep
 * clone of the raw config and may return a replacement object.
 */
export function updateRawConfig(mutator, {file = CONFIG_FILE} = {}) {
  return withLock(file, () => {
    const current = loadRawConfig(file);
    const draft = JSON.parse(JSON.stringify(current));
    const next = mutator(draft) ?? draft;
    writeRawConfig(next, file);
    return next;
  });
}

export function getPath(object, dotted) {
  return dotted.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object);
}

export function setPath(object, dotted, value) {
  const parts = dotted.split('.');
  let cursor = object;
  for (const part of parts.slice(0, -1)) {
    if (!isObject(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
  return object;
}

export function parseConfigValue(text) {
  const trimmed = String(text).trim();
  try { return JSON.parse(trimmed); } catch { return trimmed; }
}

export function defaultConfig(overrides = {}) {
  return deepMerge(structuredClone(DEFAULTS), overrides);
}

/** Lightweight engine health that never loads a model. */
export function engineHealth(config) {
  const qwen = config.tts.engines.qwen;
  const kokoro = config.tts.engines.kokoro;
  const qwenReasons = [];
  if (!fs.existsSync(config.paths.qwenPython)) qwenReasons.push(`Python interpreter not found: ${config.paths.qwenPython}`);
  const qwenSite = path.join(path.dirname(path.dirname(config.paths.qwenPython)), 'Lib', 'site-packages', 'qwen_tts');
  if (!fs.existsSync(qwenSite)) qwenReasons.push(`qwen_tts package not found: ${qwenSite}`);
  const hub = path.join(os.homedir(), '.cache', 'huggingface', 'hub');
  const custom = path.join(hub, 'models--Qwen--Qwen3-TTS-12Hz-0.6B-CustomVoice');
  const base = path.join(hub, 'models--Qwen--Qwen3-TTS-12Hz-0.6B-Base');
  if (qwen.mode === 'custom_voice' && !fs.existsSync(custom)) qwenReasons.push('CustomVoice weights missing from the Hugging Face cache.');
  if (qwen.mode === 'clone' && !fs.existsSync(base)) qwenReasons.push('Base (clone) weights missing from the Hugging Face cache.');
  if (qwen.mode === 'clone' && !config.paths.qwenReference) qwenReasons.push('Clone mode has no reference audio.');
  if (qwen.mode === 'clone' && config.paths.qwenReference && !fs.existsSync(config.paths.qwenReference)) {
    qwenReasons.push(`Reference audio not found: ${config.paths.qwenReference}`);
  }

  const kokoroReasons = [];
  if (!fs.existsSync(config.paths.kokoroPython)) kokoroReasons.push(`Python interpreter not found: ${config.paths.kokoroPython}`);
  const kokoroSite = path.join(path.dirname(path.dirname(config.paths.kokoroPython)), 'Lib', 'site-packages', 'kokoro_onnx');
  if (!fs.existsSync(kokoroSite)) kokoroReasons.push(`kokoro_onnx package not found: ${kokoroSite}`);
  if (!fs.existsSync(config.paths.kokoroModel)) kokoroReasons.push(`Kokoro model not found: ${config.paths.kokoroModel}`);
  if (!fs.existsSync(config.paths.kokoroVoices)) kokoroReasons.push(`Kokoro voices not found: ${config.paths.kokoroVoices}`);

  return {
    qwen: {
      enabled: qwen.enabled,
      available: qwen.enabled && qwenReasons.length === 0,
      mode: qwen.mode,
      speaker: qwen.speaker,
      reference: config.paths.qwenReference,
      python: config.paths.qwenPython,
      reasons: qwenReasons,
      cache: {customVoice: fs.existsSync(custom), base: fs.existsSync(base)},
    },
    kokoro: {
      enabled: kokoro.enabled,
      available: kokoro.enabled && kokoroReasons.length === 0,
      voice: kokoro.voice,
      python: config.paths.kokoroPython,
      reasons: kokoroReasons,
    },
  };
}

