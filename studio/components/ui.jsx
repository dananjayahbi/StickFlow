import Link from 'next/link';

export function Badge({children, tone, dot = false, className = ''}) {
  return (
    <span className={`badge ${tone ? `badge-${tone}` : ''} ${className}`.trim()}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({status}) {
  return <Badge tone={status || 'draft'} dot>{status || 'draft'}</Badge>;
}

export function EngineBadge({engine}) {
  if (!engine || engine === 'unknown') return <Badge>unknown</Badge>;
  if (engine === 'qwen') return <Badge tone="qwen">Qwen</Badge>;
  if (engine === 'kokoro') return <Badge tone="kokoro">Kokoro</Badge>;
  return <Badge>{engine}</Badge>;
}

export function EmptyState({title, children, action}) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children ? <p className="muted">{children}</p> : null}
      {action}
    </div>
  );
}

export function ProjectRow({project}) {
  return (
    <Link href={`/projects/${encodeURIComponent(project.id)}`} className="list-row">
      {project.posterUrl
        ? <img src={project.posterUrl} alt="" className="thumb" />
        : <div className="thumb thumb-empty">NO FRAME</div>}
      <div className="list-main">
        <div className="list-title">{project.title}</div>
        <div className="list-meta">
          <span>{project.style || '—'}</span>
          <span>{project.section === 'short' ? '9:16' : '16:9'}</span>
          <span>{project.duration ? `${Number(project.duration).toFixed(1)}s` : 'no video'}</span>
          <span>{project.tts?.engine || 'no TTS'}</span>
        </div>
      </div>
      <StatusBadge status={project.status} />
    </Link>
  );
}

export function ProjectCard({project}) {
  return (
    <Link href={`/projects/${encodeURIComponent(project.id)}`} className="gallery-card">
      <div className="poster">
        {project.posterUrl
          ? <img src={project.posterUrl} alt="" />
          : <div className="poster-fallback">No poster</div>}
        <div className="poster-badge"><StatusBadge status={project.status} /></div>
        {project.duration ? <span className="poster-duration">{Number(project.duration).toFixed(1)}s</span> : null}
      </div>
      <div className="gallery-body">
        <h3 className="gallery-title">{project.title}</h3>
        <div className="gallery-meta">
          <span>{project.style || '—'}</span>
          <span>·</span>
          <span>{project.section === 'short' ? 'Shorts' : 'Videos'}</span>
          <span>·</span>
          <span>{project.tts?.engine || 'no TTS'}</span>
        </div>
      </div>
    </Link>
  );
}
