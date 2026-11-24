import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  defaultConfig, getPath, loadConfig, setPath, updateRawConfig, validateConfig, writeRawConfig,
} from '../lib/config.mjs';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stickflow-config-'));
}

function writeConfig(root, overrides = {}) {
  const file = path.join(root, 'stickflow.config.json');
  const raw = defaultConfig(overrides);
  raw.storage.root = 'Storage';
  raw.tts.engines.kokoro.python = 'kokoro/python.exe';
  raw.tts.engines.kokoro.model = 'kokoro/model.onnx';
  raw.tts.engines.kokoro.voices = 'kokoro/voices.bin';
  writeRawConfig(raw, file);
  return {file, raw};
}

test('loadConfig resolves relative paths from the repository root', () => {
  const root = tempDir();
  const {file} = writeConfig(root);
  const config = loadConfig({file, root});
  assert.equal(config.paths.storageRoot, path.join(root, 'Storage'));
  assert.equal(config.paths.library, path.join(root, 'Storage', '_library'));
  assert.equal(config.paths.voices, path.join(root, 'Storage', '_library', 'voices'));
  assert.equal(config.paths.kokoroPython, path.join(root, 'kokoro', 'python.exe'));
  assert.equal(config.paths.kokoroModel, path.join(root, 'kokoro', 'model.onnx'));
  assert.equal(config.paths.qwenPython, path.resolve('E:/My_GitHub_Repos/storyFlow/backend/qwen_tts/.venv/Scripts/python.exe'));
  fs.rmSync(root, {recursive: true, force: true});
});

test('validateConfig rejects an unknown default engine', () => {
  const raw = defaultConfig();
  raw.tts.defaultEngine = 'nope';
  const errors = validateConfig(raw);
  assert.ok(errors.some(error => error.includes('tts.defaultEngine')));
});

test('validateConfig requires reference audio in clone mode', () => {
  const raw = defaultConfig();
  raw.tts.engines.qwen.mode = 'clone';
  raw.tts.engines.qwen.reference.audio = null;
  const errors = validateConfig(raw);
  assert.ok(errors.some(error => error.includes('reference.audio')));
});

test('updateRawConfig writes atomically and leaves no lock file', () => {
  const root = tempDir();
  const {file} = writeConfig(root);
  updateRawConfig(config => {
    config.tts.defaultEngine = 'kokoro';
    config.projectDefaults.style = 'B2';
  }, {file});
  assert.equal(fs.existsSync(`${file}.lock`), false);
  const reloaded = loadConfig({file, root});
  assert.equal(reloaded.tts.defaultEngine, 'kokoro');
  assert.equal(reloaded.projectDefaults.style, 'B2');
  fs.rmSync(root, {recursive: true, force: true});
});

test('getPath and setPath handle dotted paths', () => {
  const object = {tts: {engines: {qwen: {speaker: 'Aiden'}}}};
  assert.equal(getPath(object, 'tts.engines.qwen.speaker'), 'Aiden');
  setPath(object, 'tts.engines.qwen.speaker', 'Ryan');
  assert.equal(object.tts.engines.qwen.speaker, 'Ryan');
});
