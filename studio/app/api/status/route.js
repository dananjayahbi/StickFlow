import {loadConfig} from '../../../lib/config.mjs';
import {buildStatus} from '../../../lib/summary.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = loadConfig();
  return Response.json(buildStatus(config), {
    headers: {'Cache-Control': 'no-store'},
  });
}
