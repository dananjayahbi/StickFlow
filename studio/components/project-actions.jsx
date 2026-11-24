'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Check, CloudUpload, RefreshCw, Save} from 'lucide-react';

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export default function ProjectActions({project, platforms}) {
  const router = useRouter();
  const [title, setTitle] = useState(project.title || '');
  const [description, setDescription] = useState(project.description || '');
  const [tags, setTags] = useState((project.tags || []).join(', '));
  const [status, setStatus] = useState(project.status || 'draft');
  const [visibility, setVisibility] = useState(project.visibility || 'private');
  const [selected, setSelected] = useState(project.publish?.platforms || []);
  const [scheduledFor, setScheduledFor] = useState(toLocalInput(project.publish?.scheduledFor));
  const [externalUrl, setExternalUrl] = useState(project.publish?.externalUrl || '');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const body = () => ({
    title: title.trim(),
    description: description.trim(),
    tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
    status,
    visibility,
    publish: {
      platforms: selected,
      scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
      externalUrl: externalUrl.trim() || null,
    },
  });

  const save = async () => {
    setBusy('save'); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body()),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Save failed');
      setMessage('Saved.');
      router.refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const publish = async () => {
    setBusy('publish'); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/publish`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
          platforms: selected,
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
          externalUrl: externalUrl.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Publish failed');
      setStatus('published');
      setVisibility('gallery');
      setMessage('Published to the dashboard gallery.');
      router.refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const reindex = async () => {
    setBusy('reindex'); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/reindex`, {method: 'POST'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Reindex failed');
      setMessage('Metadata refreshed from disk.');
      router.refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  return (
    <div className="stack">
      <div className="form-grid">
        <label className="field">
          <span className="label">Title</span>
          <input className="input" value={title} onChange={event => setTitle(event.target.value)} />
        </label>
        <label className="field">
          <span className="label">Status</span>
          <select className="select" value={status} onChange={event => setStatus(event.target.value)}>
            {['draft', 'preview', 'rendered', 'approved', 'published', 'archived'].map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="label">Description</span>
        <textarea className="textarea" value={description} onChange={event => setDescription(event.target.value)} placeholder="Short publish note or episode description…" />
      </label>

      <div className="form-grid">
        <label className="field">
          <span className="label">Tags</span>
          <input className="input" value={tags} onChange={event => setTags(event.target.value)} placeholder="history, egypt, shorts" />
        </label>
        <label className="field">
          <span className="label">Gallery visibility</span>
          <select className="select" value={visibility} onChange={event => setVisibility(event.target.value)}>
            <option value="private">Private</option>
            <option value="gallery">Gallery</option>
          </select>
        </label>
      </div>

      <div className="field">
        <span className="label">Platforms</span>
        <div className="row">
          {platforms.map(platform => (
            <label className="check" key={platform}>
              <input
                type="checkbox"
                checked={selected.includes(platform)}
                onChange={event => setSelected(current => event.target.checked ? [...current, platform] : current.filter(item => item !== platform))}
              />
              {platform}
            </label>
          ))}
        </div>
      </div>

      <div className="form-grid">
        <label className="field">
          <span className="label">Scheduled for</span>
          <input className="input" type="datetime-local" value={scheduledFor} onChange={event => setScheduledFor(event.target.value)} />
        </label>
        <label className="field">
          <span className="label">External URL</span>
          <input className="input" value={externalUrl} onChange={event => setExternalUrl(event.target.value)} placeholder="https://youtube.com/…" />
        </label>
      </div>

      {error ? <div className="notice notice-red">{error}</div> : null}
      {message ? <div className="notice notice-green"><Check size={13} style={{display: 'inline', verticalAlign: '-2px'}} /> {message}</div> : null}

      <div className="form-actions">
        <button className="btn btn-primary" onClick={save} disabled={Boolean(busy)}><Save size={14} /> {busy === 'save' ? 'Saving…' : 'Save'}</button>
        <button className="btn btn-red" onClick={publish} disabled={Boolean(busy)}><CloudUpload size={14} /> {busy === 'publish' ? 'Publishing…' : 'Publish now'}</button>
        <button className="btn" onClick={reindex} disabled={Boolean(busy)}><RefreshCw size={14} /> {busy === 'reindex' ? 'Reading…' : 'Reindex'}</button>
      </div>
      {project.publish?.publishedAt ? <div className="small muted">Published {new Date(project.publish.publishedAt).toLocaleString()}.</div> : null}
    </div>
  );
}
