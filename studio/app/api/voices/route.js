import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadConfig} from '../../../lib/config.mjs';
import {addVoice, describeVoice, listVoices} from '../../../lib/voices.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = loadConfig();
  return Response.json({voices: listVoices(config).map(describeVoice)}, {headers: {'Cache-Control': 'no-store'}});
}

export async function POST(request) {
  const config = loadConfig();
  let form;
  try { form = await request.formData(); } catch { return Response.json({error: 'Expected multipart form data'}, {status: 400}); }
  const file = form.get('file');
  const name = String(form.get('name') || '').trim();
  const text = String(form.get('text') || '').trim();
  if (!name) return Response.json({error: 'Voice name is required'}, {status: 400});
  if (!file || typeof file === 'string' || !file.size) return Response.json({error: 'Reference audio is required'}, {status: 400});
  if (file.size > 30 * 1024 * 1024) return Response.json({error: 'Reference audio must be under 30 MB'}, {status: 400});
  const extension = path.extname(file.name || 'reference.wav').toLowerCase() || '.wav';
  const temp = path.join(os.tmpdir(), `stickflow-voice-${crypto.randomUUID()}${extension}`);
  try {
    fs.writeFileSync(temp, Buffer.from(await file.arrayBuffer()));
    const result = addVoice(config, {
      name,
      audio: temp,
      text,
      xVectorOnly: String(form.get('xVectorOnly') || '') === 'true' || !text,
      setDefault: String(form.get('setDefault') || 'true') !== 'false',
    });
    return Response.json({
      voice: describeVoice(result.voice),
      config: result.config,
    });
  } catch (error) {
    return Response.json({error: error.message}, {status: 400});
  } finally {
    try { fs.unlinkSync(temp); } catch {}
  }
}
