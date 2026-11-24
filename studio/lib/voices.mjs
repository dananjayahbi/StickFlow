/**
 * Qwen reference-voice library.
 *
 * A voice is a folder under `Storage/_library/voices/<id>/` with the reference
 * audio and a `voice.json`. Choosing a voice updates
 * `stickflow.config.json` to clone mode.
 */
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, updateRawConfig} from './config.mjs';
import {humanizeId, shortHash, slugify, readJson, writeJsonAtomic} from './storage.mjs';
import {probeMedia} from './metadata.mjs';

export const VOICE_FILE = 'voice.json';

export const QWEN_SPEAKERS = [
  {id: 'Aiden', label: 'Aiden — sunny American male, documentary'},
  {id: 'Ryan', label: 'Ryan — dynamic male, rhythmic pacing'},
  {id: 'Vivian', label: 'Vivian — bright young female (Chinese)'},
  {id: 'Serena', label: 'Serena — warm gentle female (Chinese)'},
  {id: 'Uncle_Fu', label: 'Uncle Fu — seasoned mellow male (Chinese)'},
  {id: 'Dylan', label: 'Dylan — youthful Beijing male (Chinese)'},
  {id: 'Eric', label: 'Eric — lively Sichuan male (Chinese)'},
  {id: 'Ono_Anna', label: 'Ono Anna — playful Japanese female'},
  {id: 'Sohee', label: 'Sohee — warm Korean female'},
];

export const KOKORO_VOICES = [
  {id: 'bm_george', label: 'George — British male, documentary'},
  {id: 'am_michael', label: 'Michael — American male, warm explainer'},
  {id: 'af_sarah', label: 'Sarah — American female, clear'},
  {id: 'af_heart', label: 'Heart — American female, softer'},
  {id: 'bf_emma', label: 'Emma — British female'},
  {id: 'am_adam', label: 'Adam — American male'},
  {id: 'af_bella', label: 'Bella — American female'},
];

export function listVoices(config) {
  const root = config.paths.voices;
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const dir = path.join(root, entry.name);
      const meta = readJson(path.join(dir, VOICE_FILE), null);
      if (!meta) return null;
      return {...meta, id: entry.name, dir, audioPath: path.join(dir, meta.audio)};
    })
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function configPathFor(file) {
  const relative = path.relative(ROOT, file).split(path.sep).join('/');
  return relative.startsWith('..') ? file.split(path.sep).join('/') : relative;
}

function updateVoiceConfig(voice, {xVectorOnly = true, configFile} = {}) {
  return updateRawConfig(config => {
    const qwen = config.tts.engines.qwen;
    qwen.mode = 'clone';
    qwen.reference = {
      ...qwen.reference,
      audio: configPathFor(voice.audioPath),
      text: voice.text || '',
      xVectorOnly: Boolean(xVectorOnly),
      voiceId: voice.id,
    };
    return config;
  }, {file: configFile});
}

export function addVoice(config, {name, audio, text = '', xVectorOnly = true, setDefault = true} = {}) {
  if (!name || !String(name).trim()) throw new Error('Voice name is required.');
  if (!audio || !fs.existsSync(audio)) throw new Error(`Reference audio not found: ${audio}`);
  const probe = probeMedia(audio);
  if (!probe?.hasAudio) throw new Error(`Reference file has no audio stream: ${audio}`);
  if (probe.duration && (probe.duration < 0.8 || probe.duration > 90)) {
    throw new Error(`Reference audio should be 0.8-90 seconds; got ${probe.duration.toFixed(2)}s.`);
  }
  const bytes = fs.readFileSync(audio);
  const id = `${slugify(name, 'voice')}-${shortHash(`${name}:${bytes.length}:${bytes.subarray(0, 4096).toString('hex')}`, 6)}`;
  const dir = path.join(config.paths.voices, id);
  fs.mkdirSync(dir, {recursive: true});
  const extension = path.extname(audio).toLowerCase() || '.wav';
  const target = path.join(dir, `reference${extension}`);
  fs.copyFileSync(audio, target);
  const voice = {
    schemaVersion: 1,
    id,
    dir,
    name: String(name).trim(),
    engine: 'qwen',
    mode: 'clone',
    audio: `reference${extension}`,
    audioPath: target,
    text: String(text || ''),
    xVectorOnly: Boolean(xVectorOnly),
    duration: probe.duration ?? null,
    sampleRate: probe.sampleRate ?? null,
    createdAt: new Date().toISOString(),
    source: audio,
  };
  writeJsonAtomic(path.join(dir, VOICE_FILE), voice);
  const raw = setDefault ? updateVoiceConfig(voice, {xVectorOnly, configFile: config.paths.configFile}) : null;
  return {voice, config: raw};
}

export function useVoice(config, identifier, {xVectorOnly} = {}) {
  const needle = String(identifier || '').toLowerCase();
  const voice = listVoices(config).find(item => item.id.toLowerCase() === needle)
    || listVoices(config).find(item => item.id.toLowerCase().startsWith(`${needle}-`))
    || listVoices(config).find(item => String(item.name || '').toLowerCase().includes(needle));
  if (!voice) throw new Error(`Voice not found: ${identifier}`);
  const raw = updateVoiceConfig(voice, {xVectorOnly: xVectorOnly ?? voice.xVectorOnly, configFile: config.paths.configFile});
  return {voice, config: raw};
}

export function usePreset(config, speaker) {
  const allowed = QWEN_SPEAKERS.map(item => item.id);
  if (!allowed.includes(speaker)) throw new Error(`Unknown Qwen speaker "${speaker}". Use ${allowed.join(', ')}.`);
  const raw = updateRawConfig(configFile => {
    const qwen = configFile.tts.engines.qwen;
    qwen.mode = 'custom_voice';
    qwen.speaker = speaker;
    return configFile;
  }, {file: config.paths.configFile});
  return {speaker, config: raw};
}

export function describeVoice(voice) {
  return {
    id: voice.id,
    name: voice.name || humanizeId(voice.id),
    duration: voice.duration,
    text: voice.text ? `${voice.text.slice(0, 60)}${voice.text.length > 60 ? '…' : ''}` : '',
    audio: voice.audioPath,
  };
}
