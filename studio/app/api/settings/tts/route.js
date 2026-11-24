import {loadConfig, updateRawConfig} from '../../../../lib/config.mjs';
import {buildSettings} from '../../../../lib/summary.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(buildSettings(loadConfig()), {headers: {'Cache-Control': 'no-store'}});
}

export async function PATCH(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({error: 'Invalid JSON'}, {status: 400}); }
  try {
    const current = loadConfig();
    updateRawConfig(config => {
      if (body.defaultEngine) {
        if (!['qwen', 'kokoro'].includes(body.defaultEngine)) throw new Error('Unknown default engine.');
        config.tts.defaultEngine = body.defaultEngine;
      }
      if (typeof body.fallbackToKokoro === 'boolean') config.tts.fallbackToKokoro = body.fallbackToKokoro;
      if (body.qwen) {
        const qwen = config.tts.engines.qwen;
        if (body.qwen.mode) {
          if (!['custom_voice', 'clone'].includes(body.qwen.mode)) throw new Error('Unknown Qwen mode.');
          qwen.mode = body.qwen.mode;
        }
        if (body.qwen.speaker) qwen.speaker = body.qwen.speaker;
        if (body.qwen.language) qwen.language = body.qwen.language;
        if (body.qwen.speed !== undefined) qwen.speed = Number(body.qwen.speed);
        if (body.qwen.maxNewTokens !== undefined) qwen.maxNewTokens = Number(body.qwen.maxNewTokens);
        if (body.qwen.vramFraction !== undefined) qwen.vramFraction = Number(body.qwen.vramFraction);
      }
      if (body.kokoro) {
        const kokoro = config.tts.engines.kokoro;
        if (body.kokoro.voice) kokoro.voice = body.kokoro.voice;
        if (body.kokoro.speed !== undefined) kokoro.speed = Number(body.kokoro.speed);
        if (body.kokoro.pause !== undefined) kokoro.pause = Number(body.kokoro.pause);
      }
      return config;
    }, {file: current.paths.configFile});
    return Response.json(buildSettings(loadConfig()));
  } catch (error) {
    return Response.json({error: error.message}, {status: 400});
  }
}
