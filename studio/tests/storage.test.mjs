import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  deterministicProjectId, findProject, humanizeId, newProjectId, safeResolve,
  sectionDir, sectionFolder, sectionForRatio, slugify, writeJsonAtomic,
} from '../lib/storage.mjs';

function configFor(root) {
  return {
    storage: {root: 'Storage', sections: {video: 'Videos', short: 'Shorts'}, library: '_library'},
    paths: {storageRoot: path.join(root, 'Storage')},
  };
}

test('slugify produces filename-safe ids', () => {
  assert.equal(slugify('The Great Pyramid!'), 'the-great-pyramid');
  assert.equal(slugify('  ...  '), 'project');
  assert.equal(slugify('Café déjà vu'), 'cafe-deja-vu');
});

test('humanizeId removes the short hash suffix', () => {
  assert.equal(humanizeId('great-pyramid-3f9a1c'), 'Great Pyramid');
  assert.equal(humanizeId('b1-demo'), 'B1 Demo');
});

test('newProjectId is unique and readable', () => {
  const first = newProjectId('My Video');
  const second = newProjectId('My Video');
  assert.match(first, /^my-video-[0-9a-f]{6}$/);
  assert.notEqual(first, second);
  assert.equal(deterministicProjectId('My Video', 'output/my-video'), deterministicProjectId('My Video', 'output/my-video'));
});

test('section helpers map ratios to folders', () => {
  assert.equal(sectionForRatio('9:16'), 'short');
  assert.equal(sectionForRatio('16:9'), 'video');
  const config = configFor('C:/work');
  assert.equal(sectionFolder(config, 'short'), 'Shorts');
  assert.equal(sectionFolder(config, 'video'), 'Videos');
  assert.equal(sectionDir(config, 'short'), path.join('C:/work', 'Storage', 'Shorts'));
});

test('safeResolve rejects traversal outside the storage root', () => {
  const root = path.join(os.tmpdir(), 'stickflow-safe-root');
  assert.equal(safeResolve(root, 'Videos/example/film.mp4'), path.resolve(root, 'Videos/example/film.mp4'));
  assert.throws(() => safeResolve(root, '../outside.mp4'), /escapes/);
});

test('findProject matches id, slug prefix and title', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stickflow-storage-'));
  const config = configFor(root);
  const dir = path.join(config.paths.storageRoot, 'Videos', 'great-pyramid-3f9a1c');
  fs.mkdirSync(dir, {recursive: true});
  writeJsonAtomic(path.join(dir, 'project-meta.json'), {id: 'great-pyramid-3f9a1c', title: 'The Great Pyramid'});

  assert.equal(findProject(config, 'great-pyramid-3f9a1c').dir, dir);
  assert.equal(findProject(config, 'great-pyramid').dir, dir);
  assert.equal(findProject(config, 'Pyramid').dir, dir);
  assert.equal(findProject(config, 'missing'), null);
  fs.rmSync(root, {recursive: true, force: true});
});
