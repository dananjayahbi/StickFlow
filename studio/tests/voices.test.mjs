import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {defaultConfig, loadConfig, loadRawConfig, writeRawConfig} from '../lib/config.mjs';
import {addVoice, describeVoice, listVoices, usePreset, useVoice} from '../lib/voices.mjs';

function writeWav(file, seconds = 1.2, sampleRate = 24000) {
  const samples = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(samples * 2);
  for (let index = 0; index < samples; index += 1) {
    const value = Math.sin((2 * Math.PI * 220 * index) / sampleRate) * 0.18;
    data.writeInt16LE(Math.round(value * 32767), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stickflow-voices-'));
  const storage = path.join(root, 'Storage');
  fs.mkdirSync(storage, {recursive: true});
  const file = path.join(root, 'stickflow.config.json');
  const raw = defaultConfig();
  raw.storage.root = storage;
  writeRawConfig(raw, file);
  const config = loadConfig({file, root});
  const wav = path.join(root, 'reference.wav');
  writeWav(wav);
  return {root, file, config, wav};
}

test('addVoice copies the reference and switches Qwen to clone mode', () => {
  const {root, file, config, wav} = setup();
  const result = addVoice(config, {name: 'Morgan', audio: wav, text: '', xVectorOnly: true});
  assert.match(result.voice.id, /^morgan-[0-9a-f]{6}$/);
  assert.ok(fs.existsSync(path.join(result.voice.dir, 'reference.wav')));
  const saved = loadRawConfig(file);
  assert.equal(saved.tts.engines.qwen.mode, 'clone');
  assert.equal(saved.tts.engines.qwen.reference.voiceId, result.voice.id);
  assert.match(saved.tts.engines.qwen.reference.audio, /Storage\/_library\/voices\/morgan-/);
  const voices = listVoices(loadConfig({file, root}));
  assert.equal(voices.length, 1);
  assert.equal(describeVoice(voices[0]).name, 'Morgan');
  fs.rmSync(root, {recursive: true, force: true});
});

test('preset and saved voice can be switched repeatedly', () => {
  const {root, file, config, wav} = setup();
  const added = addVoice(config, {name: 'Morgan', audio: wav});
  const preset = usePreset(config, 'Ryan');
  assert.equal(preset.config.tts.engines.qwen.mode, 'custom_voice');
  assert.equal(preset.config.tts.engines.qwen.speaker, 'Ryan');
  const reused = useVoice(loadConfig({file, root}), added.voice.id);
  assert.equal(reused.config.tts.engines.qwen.mode, 'clone');
  const final = loadRawConfig(file);
  assert.equal(final.tts.engines.qwen.reference.voiceId, added.voice.id);
  fs.rmSync(root, {recursive: true, force: true});
});
