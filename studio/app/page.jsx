import Link from 'next/link';
import {ArrowUpRight, Clapperboard, HardDrive, Play, Sparkles} from 'lucide-react';
import {loadConfig} from '../lib/config.mjs';
import {buildStatus} from '../lib/summary.mjs';
import {formatBytes, formatDuration} from '../lib/format.mjs';
import {Badge, EmptyState, ProjectRow} from '../components/ui.jsx';

export const dynamic = 'force-dynamic';

function EngineCard({name, state, detail, defaultEngine}) {
  return (
    <div className="engine-card">
      <div className="spread">
        <div className="engine-name">
          {name}
          {defaultEngine === name.toLowerCase() ? <Badge tone={name === 'Qwen' ? 'qwen' : 'kokoro'}>default</Badge> : null}
        </div>
        <Badge tone={state.available ? 'published' : 'archived'} dot>{state.available ? 'ready' : 'unavailable'}</Badge>
      </div>
      <div className="engine-status">{detail}</div>
      {state.reasons?.length ? <div className="engine-reason">{state.reasons.join(' · ')}</div> : null}
    </div>
  );
}

export default function OverviewPage() {
  const config = loadConfig();
  const status = buildStatus(config);
  const qwen = status.engines.qwen;
  const kokoro = status.engines.kokoro;
  const qwenDetail = qwen.mode === 'clone'
    ? `Clone reference · ${qwen.reference ? 'loaded' : 'missing'}`
    : `Preset · ${qwen.speaker}`;
  return (
    <>
      <header className="page-head">
        <div>
          <div className="eyebrow">Local studio</div>
          <h1 className="page-title">Everything you made,<br />in one quiet place.</h1>
          <p className="page-sub">
            StickFlow renders locally. This dashboard reads the same project folders,
            tracks the voice engine, and gives you a gallery and publish plan without
            touching the renderer.
          </p>
        </div>
        <div className="row">
          <Link href="/gallery" className="btn"><Play size={15} /> Gallery</Link>
          <Link href="/settings" className="btn btn-primary"><Sparkles size={15} /> Studio settings</Link>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Projects</div>
          <div className="stat-value">{status.counts.total}</div>
          <div className="stat-meta">{status.counts.sections.short || 0} shorts · {status.counts.sections.video || 0} videos</div>
        </div>
        <div className="stat">
          <div className="stat-label">Published</div>
          <div className="stat-value">{status.counts.published}</div>
          <div className="stat-meta">{status.counts.scheduled} scheduled</div>
        </div>
        <div className="stat">
          <div className="stat-label">Runtime</div>
          <div className="stat-value">{formatDuration(status.counts.durationSeconds)}</div>
          <div className="stat-meta">across all finished cuts</div>
        </div>
        <div className="stat">
          <div className="stat-label">Storage</div>
          <div className="stat-value">{formatBytes(status.storage.bytes)}</div>
          <div className="stat-meta"><HardDrive size={11} style={{display: 'inline', verticalAlign: '-1px'}} /> local only</div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Recent projects</h2>
            <Link href="/projects" className="small muted">All projects <ArrowUpRight size={12} style={{display: 'inline', verticalAlign: '-1px'}} /></Link>
          </div>
          {status.recent.length
            ? <div className="list">{status.recent.map(project => <ProjectRow key={project.id} project={project} />)}</div>
            : <EmptyState title="No videos yet" action={<Link href="/settings" className="btn">Check settings</Link>}>
                Create a project with <span className="mono">node studio\cli.mjs new &quot;My Video&quot;</span>.
              </EmptyState>}
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Voice engines</h2>
              <Link href="/settings" className="small muted">Change</Link>
            </div>
            <EngineCard name="Qwen" state={qwen} detail={qwenDetail} defaultEngine={status.defaultEngine} />
            <div style={{borderTop: '1px solid var(--line)'}} />
            <EngineCard name="Kokoro" state={kokoro} detail={`Preset · ${kokoro.voice}`} defaultEngine={status.defaultEngine} />
          </section>

          <section className="card card-pad">
            <div className="row" style={{marginBottom: 10}}>
              <Clapperboard size={16} />
              <strong>New video</strong>
              <Badge tone="draft">CLI first</Badge>
            </div>
            <div className="code">
              <span className="comment"># scaffold + narrate + preview</span><br />
              node studio\cli.mjs new &quot;My Video&quot;<br />
              node skills\stickflow\scripts\tts.mjs --out-dir &lt;project&gt;<br />
              node skills\stickflow\scripts\autopilot.mjs preview &lt;project&gt;
            </div>
            <p className="small muted" style={{marginBottom: 0}}>
              Rendering stays in the project folder. Publish it here when the cut is ready.
            </p>
          </section>
        </div>
      </div>

      <div className="notice" style={{marginTop: 18}}>
        Local dashboard at <span className="mono">127.0.0.1:{config.dashboard.port}</span> · config <span className="mono">{config.paths.configFile}</span>
      </div>
    </>
  );
}
