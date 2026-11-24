import {loadConfig} from '../../../lib/config.mjs';
import {collectProjects} from '../../../lib/summary.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const config = loadConfig();
  const url = new URL(request.url);
  const section = url.searchParams.get('section');
  const status = url.searchParams.get('status');
  const style = url.searchParams.get('style');
  const query = url.searchParams.get('q');
  let projects = collectProjects(config);
  if (section) projects = projects.filter(project => project.section === section);
  if (status) projects = projects.filter(project => project.status === status);
  if (style) projects = projects.filter(project => project.style === style);
  if (query) {
    const needle = query.toLowerCase();
    projects = projects.filter(project =>
      String(project.title || '').toLowerCase().includes(needle) ||
      String(project.description || '').toLowerCase().includes(needle) ||
      (project.tags || []).some(tag => String(tag).toLowerCase().includes(needle)));
  }
  return Response.json({projects}, {headers: {'Cache-Control': 'no-store'}});
}
