import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {readMeta, registerProject} from '../lib/metadata.mjs';

function makeProject(root, id = 'my-video-abc123') {
  const dir = path.join(root, 'Storage', 'Videos', id);
  fs.mkdirSync(path.join(dir, 'output'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'project.json'), `${JSON.stringify({
    version: 1,
    style: 'B1',
    width: 1280,
    height: 720,
    fps: 30,
    voice: {path: 'narration.wav', lead: 0, tail: 0},
    captions: [],
    shots: [{start: 0, end: 1, layers: []}],
  }, null, 2)}\n`, 'utf8');
  return dir;
}

function configFor(root) {
  return {
    storage: {root: 'Storage', sections: {video: 'Videos', short: 'Shorts'}, library: '_library'},
    paths: {storageRoot: path.join(root, 'Storage')},
  };
}

test('registerProject writes a sidecar and infers draft status', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stickflow-meta-'));
  const dir = makeProject(root);
  const meta = registerProject(dir, configFor(root), {id: 'my-video-abc123', title: 'My Video'});
  assert.equal(meta.title, 'My Video');
  assert.equal(meta.section, 'video');
  assert.equal(meta.format, '16:9');
  assert.equal(meta.style, 'B1');
  assert.equal(meta.status, 'draft');
  assert.equal(meta.visibility, 'private');
  assert.ok(fs.existsSync(path.join(dir, 'project-meta.json')));
  assert.deepEqual(meta.assets.video, null);
  fs.rmSync(root, {recursive: true, force: true});
});

test('registerProject preserves existing title and status unless overridden', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stickflow-meta-'));
  const dir = makeProject(root);
  registerProject(dir, configFor(root), {id: 'my-video-abc123', title: 'First Title', status: 'approved'});
  const second = registerProject(dir, configFor(root), {});
  assert.equal(second.title, 'First Title');
  assert.equal(second.status, 'approved');
  fs.rmSync(root, {recursive: true, force: true});
});

test('registerProject derives script.txt from words.json', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stickflow-meta-'));
  const dir = makeProject(root);
  fs.writeFileSync(path.join(dir, 'words.json'), JSON.stringify({
    duration: 2,
    sentences: [{start: 0, end: 1, text: 'First sentence.'}, {start: 1, end: 2, text: 'Second sentence.'}],
    words: [],
  }), 'utf8');
  registerProject(dir, configFor(root), {id: 'my-video-abc123'});
  assert.equal(fs.readFileSync(path.join(dir, 'script.txt'), 'utf8'), 'First sentence.\nSecond sentence.\n');
  fs.rmSync(root, {recursive: true, force: true});
});

test('registerProject records preview status when only preview.mp4 exists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stickflow-meta-'));
  const dir = makeProject(root);
  fs.writeFileSync(path.join(dir, 'output', 'preview.mp4'), 'not a real video', 'utf8');
  const meta = registerProject(dir, configFor(root), {id: 'my-video-abc123'});
  assert.equal(meta.status, 'preview');
  assert.equal(meta.assets.preview, 'output/preview.mp4');
  assert.equal(readMeta(dir).id, 'my-video-abc123');
  fs.rmSync(root, {recursive: true, force: true});
});
