import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, {after} from 'node:test';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stickflow-tools-'));
process.env.STICKFLOW_CONFIG = path.join(root, 'stickflow.config.json');

const {defaultConfig, loadRawConfig, writeRawConfig} = await import('../lib/config.mjs');
const {registerProject} = await import('../lib/metadata.mjs');
const tools = await import('../mcp/tools.mjs');

const storage = path.join(root, 'Storage');
const projectDir = path.join(storage, 'Videos', 'demo-abc123');
fs.mkdirSync(path.join(projectDir, 'output'), {recursive: true});
fs.writeFileSync(path.join(projectDir, 'project.json'), `${JSON.stringify({
  version: 1, style: 'B1', width: 1280, height: 720, fps: 30,
  voice: {path: 'narration.wav', lead: 0, tail: 0}, captions: [], shots: [{start: 0, end: 1, layers: []}],
}, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(projectDir, 'output', 'film.mp4'), 'not a real video', 'utf8');
const raw = defaultConfig();
raw.storage.root = storage;
writeRawConfig(raw, process.env.STICKFLOW_CONFIG);
const config = (await import('../lib/config.mjs')).loadConfig();
registerProject(projectDir, config, {id: 'demo-abc123', title: 'Demo'});

test('status and project listing read the temp store', () => {
  const status = tools.status();
  assert.equal(status.counts.total, 1);
  assert.equal(status.defaultEngine, 'qwen');
  assert.equal(status.engines.qwen.available, true);
  const listed = tools.listProjects({});
  assert.equal(listed.count, 1);
  assert.equal(listed.projects[0].id, 'demo-abc123');
  const detail = tools.getProject({project: 'demo'});
  assert.equal(detail.project.title, 'Demo');
  assert.ok(detail.artifacts.film);
});

test('publish and voice changes write to the temp config', () => {
  const published = tools.publish({project: 'demo', platforms: ['youtube'], tags: ['test']});
  assert.equal(published.published, true);
  assert.equal(published.project.status, 'published');
  assert.deepEqual(published.project.publish.platforms, ['youtube']);
  const changed = tools.setDefaultTts({engine: 'kokoro', kokoroVoice: 'af_sarah'});
  assert.equal(changed.defaultEngine, 'kokoro');
  assert.equal(changed.kokoro.voice, 'af_sarah');
  assert.equal(loadRawConfig(process.env.STICKFLOW_CONFIG).tts.defaultEngine, 'kokoro');
  const reindexed = tools.reindex({});
  assert.equal(reindexed.updated, 1);
});

after(() => {
  fs.rmSync(root, {recursive: true, force: true});
});

