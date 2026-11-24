'use client';

import {useMemo, useState} from 'react';
import {Search} from 'lucide-react';
import {ProjectCard, EmptyState} from './ui.jsx';

export default function GalleryView({projects}) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const [status, setStatus] = useState('all');
  const [style, setStyle] = useState('all');
  const [includePrivate, setIncludePrivate] = useState(false);

  const styles = useMemo(() => [...new Set(projects.map(project => project.style).filter(Boolean))].sort(), [projects]);
  const statuses = useMemo(() => [...new Set(projects.map(project => project.status).filter(Boolean))].sort(), [projects]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter(project => {
      if (!includePrivate && project.visibility !== 'gallery') return false;
      if (section !== 'all' && project.section !== section) return false;
      if (status !== 'all' && project.status !== status) return false;
      if (style !== 'all' && project.style !== style) return false;
      if (!needle) return true;
      return String(project.title || '').toLowerCase().includes(needle)
        || String(project.description || '').toLowerCase().includes(needle)
        || (project.tags || []).some(tag => String(tag).toLowerCase().includes(needle));
    });
  }, [projects, query, section, status, style, includePrivate]);

  return (
    <>
      <div className="toolbar">
        <div style={{position: 'relative', flex: '1 1 220px', maxWidth: 340}}>
          <Search size={14} style={{position: 'absolute', left: 11, top: 11, color: 'var(--faint)'}} />
          <input
            className="input"
            style={{paddingLeft: 32}}
            placeholder="Search titles, tags, notes…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <select className="select" value={section} onChange={event => setSection(event.target.value)}>
          <option value="all">All formats</option>
          <option value="video">Videos · 16:9</option>
          <option value="short">Shorts · 9:16</option>
        </select>
        <select className="select" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          {statuses.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="select" value={style} onChange={event => setStyle(event.target.value)}>
          <option value="all">All styles</option>
          {styles.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <label className="check small"><input type="checkbox" checked={includePrivate} onChange={event => setIncludePrivate(event.target.checked)} /> Include private</label>
        <span className="small muted nowrap">{filtered.length} of {projects.length}</span>
      </div>

      {filtered.length
        ? <div className="gallery-grid">{filtered.map(project => <ProjectCard key={project.id} project={project} />)}</div>
        : <div className="card"><EmptyState title="Nothing in the gallery yet">Publish a project or include private work.</EmptyState></div>}
    </>
  );
}
