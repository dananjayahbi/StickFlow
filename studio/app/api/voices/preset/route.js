import {loadConfig} from '../../../../lib/config.mjs';
import {usePreset} from '../../../../lib/voices.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const config = loadConfig();
  let body;
  try { body = await request.json(); } catch { return Response.json({error: 'Invalid JSON'}, {status: 400}); }
  try {
    const result = usePreset(config, body.speaker);
    return Response.json(result);
  } catch (error) {
    return Response.json({error: error.message}, {status: 400});
  }
}
