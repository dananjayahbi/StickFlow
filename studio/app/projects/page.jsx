import Link from 'next/link';
import {loadConfig} from '../../lib/config.mjs';
import {collectProjects} from '../../lib/summary.mjs';
import {formatDate, formatDuration} from '../../lib/format.mjs';
import {EmptyState, EngineBadge, StatusBadge} from '../../components/ui.jsx';

export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  const config = loadConfig();
  const projects = collectProjects(config);
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Projects</div>
          <h1 className="page-title">The working shelf.</h1>
          <p className="page-sub">Every folder in Storage, registered or not. Open a project to reindex, inspect artifacts, or publish it.</p>
        </div>
        <div className="row">
          <Link href="/gallery" className="btn">Gallery view</Link>
          <Link href="/planner" className="btn btn-primary">Plan publishing</Link>
        </div>
      </header>

      {projects.length ? (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Format</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Voice</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr key={project.id}>
                  <td>
                    <div className="row" style={{gap: 10, flexWrap: 'nowrap'}}>
                      {project.posterUrl
                        ? <img src={project.posterUrl} alt="" className="thumb" style={{width: 64, height: 36}} />
                        : <div className="thumb thumb-empty" style={{width: 64, height: 36}}>NONE</div>}
                      <div style={{minWidth: 0}}>
                        <div style={{fontWeight: 600}}>{project.title}</div>
                        <div className="tiny mono faint">{project.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="small">{project.section === 'short' ? '9:16' : '16:9'}<div className="tiny faint">{project.style || '—'}</div></td>
                  <td><StatusBadge status={project.status} /></td>
                  <td className="small mono">{formatDuration(project.duration)}</td>
                  <td><EngineBadge engine={project.tts?.engine} /></td>
                  <td className="small muted">{formatDate(project.updatedAt)}</td>
                  <td><Link href={`/projects/${encodeURIComponent(project.id)}`} className="btn btn-sm">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <EmptyState title="No projects in Storage" action={<Link href="/settings" className="btn">Settings</Link>}>
            Create one with <span className="mono">node studio\cli.mjs new &quot;My Video&quot;</span>.
          </EmptyState>
        </div>
      )}
    </>
  );
}
