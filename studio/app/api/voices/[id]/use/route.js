import {loadConfig} from '../../../../../lib/config.mjs';
import {useVoice} from '../../../../../lib/voices.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request, context) {
  const config = loadConfig();
  const params = await context.params;
  try {
    const result = useVoice(config, params.id);
    return Response.json({voice: result.voice, config: result.config});
  } catch (error) {
    return Response.json({error: error.message}, {status: 400});
  }
}
