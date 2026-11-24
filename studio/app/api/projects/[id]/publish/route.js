import {loadConfig} from '../../../../../lib/config.mjs';
import {findProject} from '../../../../../lib/storage.mjs';
import {publishProject} from '../../../../../lib/metadata.mjs';
import {enrichProject} from '../../../../../lib/summary.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, context) {
  const config = loadConfig();
  const params = await context.params;
  const found = findProject(config, params.id);
  if (!found) return Response.json({error: 'Project not found'}, {status: 404});
  let body = {};
  try { body = await request.json(); } catch {}
  try {
    const meta = publishProject(found.dir, config, {
      status: body.status,
      visibility: body.visibility,
      title: body.title,
      description: body.description,
      tags: body.tags,
      platforms: body.platforms,
      scheduledFor: body.scheduledFor,
      externalUrl: body.externalUrl,
    });
    return Response.json({project: enrichProject(config, {...meta, dir: found.dir, id: found.id, section: found.section})});
  } catch (error) {
    return Response.json({error: error.message}, {status: 400});
  }
}
