/**
 * Small cross-process lock used to serialize GPU-heavy Qwen work.
 *
 * StickFlow and StoryFlow share one GTX 1660 Ti. Loading both checkpoints at
 * once evicts memory and can crash either process, so Qwen narration takes a
 * file lock before spawning the model process.
 */
import fs from 'node:fs';
import path from 'node:path';

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function acquireLock(file, {timeoutMs = 45 * 60 * 1000, staleMs = 60 * 60 * 1000, label = 'lock'} = {}) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const started = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeSync(fd, `${JSON.stringify({pid: process.pid, startedAt: new Date().toISOString(), label})}\n`);
      fs.closeSync(fd);
      return () => {
        try { fs.unlinkSync(file); } catch {}
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const age = Date.now() - fs.statSync(file).mtimeMs;
        if (age > staleMs) {
          fs.rmSync(file, {force: true});
          continue;
        }
      } catch {}
      if (Date.now() - started > timeoutMs) {
        throw new Error(`Timed out waiting for ${label}: ${file}`);
      }
      sleep(500);
    }
  }
}
