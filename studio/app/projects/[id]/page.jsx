import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft, ExternalLink} from 'lucide-react';
import {loadConfig} from '../../../lib/config.mjs';
import {findProject} from '../../../lib/storage.mjs';
import {artifactFiles, readMeta, registerProject} from '../../../lib/metadata.mjs';
import {enrichProject, mediaUrl} from '../../../lib/summary.mjs';
import {formatBytes, formatDate, formatDuration} from '../../../lib/format.mjs';
import {EngineBadge, StatusBadge} from '../../../components/ui.jsx';
import ProjectActions from '../../../components/project-actions.jsx';

export const dynamic = 'force-dynamic';

const LABELS = {
  film: 'Final film',
  preview: 'Preview',
  video: 'Active video',
  contactSheet: 'Contact sheet',
  narration: 'Narration',
  words: 'Word timings',
  captions: 'Captions',
  script: 'Script',
  generation: 'TTS metadata',
  report: 'Render report',
  poster: 'Poster',
};

export default async function ProjectPage({params}) {
  const {id} = await params;
  const config = loadConfig();
  const found = findProject(config, id);
  if (!found) notFound();
  const meta = readMeta(found.dir) ?? registerProject(found.dir, config, {id: found.id, section: found.section});
  const project = enrichProject(config, {...meta, dir: found.dir, id: found.id, section: found.section});
  const artifacts = artifactFiles(found.dir);
  const seen = new Set();

  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">{project.section === 'short' ? 'Short · 9:16' : 'Video · 16:9'} · {project.style || 'no style'}</div>
          <h1 className="page-title">{project.title}</h1>
          <p className="page-sub">{project.description || 'No description yet. Add one below for the gallery and publish kit.'}</p>
        </div>
        <div className="row">
          <Link href="/projects" className="btn btn-ghost"><ArrowLeft size={14} /> Projects</Link>
          <StatusBadge status={project.status} />
          <EngineBadge engine={project.tts?.engine} />
        </div>
      </header>

      <div className="grid-2">
        <div className="stack">
          <section className="card">
            <div className="player">
              {project.videoUrl
                ? <video key={project.videoUrl} controls preload="metadata" poster={project.posterUrl || undefined} src={project.videoUrl} />
                : <div className="poster-fallback" style={{height: '100%'}}>No rendered video yet</div>}
            </div>
            <div className="card-pad">
              <div className="meta-grid">
                <div><div className="meta-key">Duration</div><div className="meta-val">{formatDuration(project.duration)}</div></div>
                <div><div className="meta-key">Picture</div><div className="meta-val">{project.video ? `${project.video.width}×${project.video.height} · ${project.video.fps || '—'} fps` : '—'}</div></div>
                <div><div className="meta-key">Voice</div><div className="meta-val">{project.tts?.engine || '—'}{project.tts?.voice ? ` · ${project.tts.voice}` : ''}</div></div>
                <div><div className="meta-key">Updated</div><div className="meta-val">{formatDate(project.updatedAt, {withTime: true})}</div></div>
                <div><div className="meta-key">Project id</div><div className="meta-val mono tiny">{project.id}</div></div>
                <div><div className="meta-key">Storage folder</div><div className="meta-val mono tiny">{project.relativeDir}</div></div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2 className="card-title">Publish & metadata</h2><span className="card-note">Writes project-meta.json only</span></div>
            <div className="card-pad">
              <ProjectActions project={project} platforms={config.publishing.platforms} />
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head"><h2 className="card-title">Artifacts</h2><span className="card-note">{Object.keys(artifacts).filter(key => artifacts[key]).length} files</span></div>
            <div className="card-pad">
              {Object.entries(artifacts).map(([key, info]) => {
                if (!info || seen.has(info.path)) return null;
                seen.add(info.path);
                const url = mediaUrl(config, info.path);
                return (
                  <div className="artifact" key={key}>
                    <div>
                      <div>{LABELS[key] || key}</div>
                      <div className="tiny mono faint">{info.path.split(/[\\/]/).slice(-1)[0]} · {formatBytes(info.bytes)}</div>
                    </div>
                    <a href={url} target="_blank" rel="noreferrer"><ExternalLink size={13} style={{display: 'inline', verticalAlign: '-2px'}} /> open</a>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2 className="card-title">Folder</h2></div>
            <div className="card-pad">
              <div className="code">{found.dir}</div>
              <p className="small muted" style={{marginBottom: 0}}>
                Rendering still happens here with <span className="mono">autopilot.mjs</span>. The dashboard only reads and updates metadata.
              </p>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2 className="card-title">Publish state</h2></div>
            <div className="card-pad">
              <div className="meta-grid">
                <div><div className="meta-key">Visibility</div><div className="meta-val">{project.visibility || 'private'}</div></div>
                <div><div className="meta-key">Published</div><div className="meta-val">{formatDate(project.publish?.publishedAt, {withTime: true})}</div></div>
                <div><div className="meta-key">Scheduled</div><div className="meta-val">{formatDate(project.publish?.scheduledFor, {withTime: true})}</div></div>
                <div><div className="meta-key">Platforms</div><div className="meta-val">{(project.publish?.platforms || []).join(', ') || '—'}</div></div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
