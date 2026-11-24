import {loadConfig} from '../../../../lib/config.mjs';
import {findProject} from '../../../../lib/storage.mjs';
import {artifactFiles, readMeta, registerProject, updateMeta} from '../../../../lib/metadata.mjs';
import {enrichProject} from '../../../../lib/summary.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolve(context, config) {
  const params = await context.params;
  return findProject(config, params.id);
}

export async function GET(_request, context) {
  const config = loadConfig();
  const found = await resolve(context, config);
  if (!found) return Response.json({error: 'Project not found'}, {status: 404});
  let meta = readMeta(found.dir);
  if (!meta) meta = registerProject(found.dir, config, {id: found.id, section: found.section});
  return Response.json({
    project: enrichProject(config, {...meta, dir: found.dir, id: found.id, section: found.section}),
    artifacts: artifactFiles(found.dir),
    dir: found.dir,
  }, {headers: {'Cache-Control': 'no-store'}});
}

export async function PATCH(request, context) {
  const config = loadConfig();
  const found = await resolve(context, config);
  if (!found) return Response.json({error: 'Project not found'}, {status: 404});
  let body;
  try { body = await request.json(); } catch { return Response.json({error: 'Invalid JSON'}, {status: 400}); }
  if (!readMeta(found.dir)) registerProject(found.dir, config, {id: found.id, section: found.section});
  const allowed = ['title', 'status', 'visibility', 'tags', 'description', 'publish'];
  const patch = Object.fromEntries(Object.entries(body || {}).filter(([key]) => allowed.includes(key)));
  if (patch.tags && !Array.isArray(patch.tags)) return Response.json({error: 'tags must be an array'}, {status: 400});
  try {
    const meta = updateMeta(found.dir, patch);
    return Response.json({
      project: enrichProject(config, {...meta, dir: found.dir, id: found.id, section: found.section}),
    });
  } catch (error) {
    return Response.json({error: error.message}, {status: 400});
  }
}
