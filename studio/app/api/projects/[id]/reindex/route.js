import {loadConfig} from '../../../../../lib/config.mjs';
import {findProject} from '../../../../../lib/storage.mjs';
import {registerProject} from '../../../../../lib/metadata.mjs';
import {enrichProject} from '../../../../../lib/summary.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request, context) {
  const config = loadConfig();
  const params = await context.params;
  const found = findProject(config, params.id);
  if (!found) return Response.json({error: 'Project not found'}, {status: 404});
  try {
    const meta = registerProject(found.dir, config, {id: found.id, section: found.section});
    return Response.json({project: enrichProject(config, {...meta, dir: found.dir, id: found.id, section: found.section})});
  } catch (error) {
    return Response.json({error: error.message}, {status: 400});
  }
}
