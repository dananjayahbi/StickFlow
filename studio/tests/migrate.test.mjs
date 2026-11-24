import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {planMigration} from '../lib/migrate.mjs';

function configFor(root) {
  return {
    storage: {root: 'Storage', sections: {video: 'Videos', short: 'Shorts'}, library: '_library'},
    paths: {
      storageRoot: path.join(root, 'Storage'),
      library: path.join(root, 'Storage', '_library'),
    },
  };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stickflow-migrate-'));
  const output = path.join(root, 'output');
  const project = path.join(output, 'demo');
  fs.mkdirSync(path.join(project, 'output'), {recursive: true});
  fs.writeFileSync(path.join(project, 'project.json'), `${JSON.stringify({
    version: 1, style: 'B1', width: 1280, height: 720, fps: 30,
    voice: {path: 'narration.wav', lead: 0, tail: 0}, captions: [], shots: [{start: 0, end: 1, layers: []}],
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(project, 'narration.wav'), 'fake audio', 'utf8');
  fs.writeFileSync(path.join(project, 'output', 'preview.mp4'), 'fake video', 'utf8');
  fs.writeFileSync(path.join(output, 'My-Short.mp4'), 'fake short', 'utf8');
  fs.writeFileSync(path.join(output, 'My-Short-contact-sheet.png'), 'fake sheet', 'utf8');
  return {root, output, config: configFor(root)};
}

test('planMigration is a dry run by default', () => {
  const {root, output, config} = fixture();
  const result = planMigration(config, {outputDir: output, apply: false});
  assert.equal(result.apply, false);
  assert.equal(result.manifest, null);
  assert.equal(result.actions.length, 2);
  assert.ok(result.actions.some(action => action.kind === 'project'));
  assert.ok(result.actions.some(action => action.kind === 'legacy-video'));
  assert.equal(fs.existsSync(path.join(root, 'Storage')), false);
  fs.rmSync(root, {recursive: true, force: true});
});

test('planMigration copies projects and loose videos without touching originals', () => {
  const {root, output, config} = fixture();
  const result = planMigration(config, {outputDir: output, apply: true});
  assert.equal(result.apply, true);
  assert.ok(result.manifest && fs.existsSync(result.manifest));

  const originals = fs.readdirSync(output).sort();
  assert.deepEqual(originals, ['My-Short-contact-sheet.png', 'My-Short.mp4', 'demo'].sort());

  const project = result.actions.find(action => action.kind === 'project');
  assert.ok(fs.existsSync(path.join(project.target, 'project.json')));
  assert.ok(fs.existsSync(path.join(project.target, 'project-meta.json')));
  assert.ok(fs.existsSync(path.join(project.target, 'output', 'preview.mp4')));

  const legacy = result.actions.find(action => action.kind === 'legacy-video');
  assert.ok(fs.existsSync(path.join(legacy.target, 'output', 'film.mp4')));
  assert.ok(fs.existsSync(path.join(legacy.target, 'output', 'film-contact-sheet.png')));
  assert.ok(fs.existsSync(path.join(legacy.target, 'project-meta.json')));

  const manifest = JSON.parse(fs.readFileSync(result.manifest, 'utf8'));
  assert.equal(manifest.actions.length, 2);
  assert.ok(manifest.actions.every(action => action.target.startsWith('Videos/')));
  fs.rmSync(root, {recursive: true, force: true});
});

test('planMigration is idempotent', () => {
  const {root, output, config} = fixture();
  planMigration(config, {outputDir: output, apply: true});
  const second = planMigration(config, {outputDir: output, apply: true});
  assert.ok(second.actions.every(action => action.skipped === true));
  fs.rmSync(root, {recursive: true, force: true});
});
