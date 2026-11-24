'use client';

import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {CalendarClock, CheckCircle2, Loader2, Trash2} from 'lucide-react';
import {formatDate, formatDuration} from '../lib/format.mjs';
import {Badge, EngineBadge, StatusBadge} from './ui.jsx';

function localDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function schedulePatch(id, scheduledFor) {
  return fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({publish: {scheduledFor}}),
  }).then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not update the plan');
    return data;
  });
}

export default function PlannerView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [dates, setDates] = useState({});

  const load = async () => {
    setError('');
    try {
      const response = await fetch('/api/planner', {cache: 'no-store'});
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || 'Could not load the planner');
      setData(next);
    } catch (err) { setError(err.message); }
  };

  useEffect(() => { load(); }, []);

  const calendar = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let index = 0; index < startDay; index += 1) cells.push(null);
    for (let day = 1; day <= days; day += 1) cells.push(day);
    while (cells.length % 7) cells.push(null);
    const byDay = new Map();
    for (const item of data?.scheduled || []) {
      const key = localDateKey(item.publish.scheduledFor);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(item);
    }
    return {year, month, cells, byDay, today: localDateKey(new Date())};
  }, [data]);

  const addToPlan = async project => {
    const date = dates[project.id];
    if (!date) return;
    setBusy(project.id); setError('');
    try {
      await schedulePatch(project.id, new Date(`${date}T12:00:00`).toISOString());
      setDates(current => ({...current, [project.id]: ''}));
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const clearPlan = async project => {
    setBusy(project.id); setError('');
    try {
      await schedulePatch(project.id, null);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  if (!data) return <div className="card card-pad row"><Loader2 size={16} className="spin" /> Loading publish plan…</div>;

  const monthName = new Date(calendar.year, calendar.month, 1).toLocaleDateString(undefined, {month: 'long', year: 'numeric'});

  return (
    <div className="stack">
      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Scheduled</div><div className="stat-value">{data.scheduled.length}</div><div className="stat-meta">with a publish date</div></div>
        <div className="stat"><div className="stat-label">Published</div><div className="stat-value">{data.published.length}</div><div className="stat-meta">marked live</div></div>
        <div className="stat"><div className="stat-label">Unscheduled</div><div className="stat-value">{data.unscheduled.length}</div><div className="stat-meta">ready when you are</div></div>
        <div className="stat"><div className="stat-label">Timezone</div><div className="stat-value" style={{fontSize: 22, paddingTop: 8}}>{data.timezone}</div><div className="stat-meta">displayed in local time</div></div>
      </div>

      {error ? <div className="notice notice-red">{error}</div> : null}

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2 className="card-title">{monthName}</h2><Badge><CalendarClock size={11} /> plan</Badge></div>
          <div className="card-pad">
            <div className="calendar">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div className="calendar-head" key={day}>{day}</div>)}
              {calendar.cells.map((day, index) => {
                if (!day) return <div className="calendar-day out" key={`empty-${index}`} />;
                const key = `${calendar.year}-${String(calendar.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const items = calendar.byDay.get(key) || [];
                return (
                  <div className={`calendar-day ${key === calendar.today ? 'today' : ''}`} key={key}>
                    <div className="calendar-date">{day}</div>
                    {items.slice(0, 3).map(item => (
                      <Link href={`/projects/${encodeURIComponent(item.id)}`} className="calendar-item" key={item.id} title={item.title}>{item.title}</Link>
                    ))}
                    {items.length > 3 ? <div className="tiny faint">+{items.length - 3} more</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2 className="card-title">Scheduled</h2><span className="card-note">{data.scheduled.length} items</span></div>
          {data.scheduled.length ? (
            <div className="list">
              {data.scheduled.map(project => (
                <div className="list-row" key={project.id}>
                  <div className="list-main">
                    <div className="list-title"><Link href={`/projects/${encodeURIComponent(project.id)}`}>{project.title}</Link></div>
                    <div className="list-meta">
                      <span>{formatDate(project.publish.scheduledFor, {withTime: true})}</span>
                      <span>{project.publish.platforms?.join(', ') || 'no platform'}</span>
                      <StatusBadge status={project.status} />
                    </div>
                  </div>
                  <button className="btn btn-sm btn-ghost" title="Remove from plan" onClick={() => clearPlan(project)} disabled={busy === project.id}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          ) : <div className="empty"><div className="empty-title">Nothing on the calendar</div><p className="muted">Give a finished video a date below.</p></div>}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Ready to schedule</h2><span className="card-note">{data.unscheduled.length} projects</span></div>
        {data.unscheduled.length ? (
          <div className="list">
            {data.unscheduled.map(project => (
              <div className="list-row" key={project.id}>
                <div className="list-main">
                  <div className="list-title"><Link href={`/projects/${encodeURIComponent(project.id)}`}>{project.title}</Link></div>
                  <div className="list-meta">
                    <span>{formatDuration(project.duration)}</span>
                    <span>{project.style || '—'}</span>
                    <EngineBadge engine={project.tts?.engine} />
                  </div>
                </div>
                <input
                  className="input"
                  type="date"
                  style={{width: 150}}
                  value={dates[project.id] || ''}
                  onChange={event => setDates(current => ({...current, [project.id]: event.target.value}))}
                />
                <button className="btn btn-sm" onClick={() => addToPlan(project)} disabled={busy === project.id || !dates[project.id]}>
                  {busy === project.id ? 'Saving…' : 'Add to plan'}
                </button>
              </div>
            ))}
          </div>
        ) : <div className="empty"><div className="empty-title">Everything has a date</div></div>}
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Published</h2><span className="card-note">{data.published.length} live</span></div>
        {data.published.length ? (
          <div className="list">
            {data.published.map(project => (
              <div className="list-row" key={project.id}>
                <CheckCircle2 size={16} style={{color: 'var(--green)'}} />
                <div className="list-main">
                  <div className="list-title"><Link href={`/projects/${encodeURIComponent(project.id)}`}>{project.title}</Link></div>
                  <div className="list-meta">
                    <span>{project.publish?.publishedAt ? formatDate(project.publish.publishedAt) : 'published'}</span>
                    <span>{project.publish?.platforms?.join(', ') || 'no platform'}</span>
                  </div>
                </div>
                <Badge tone="published">live</Badge>
              </div>
            ))}
          </div>
        ) : <div className="empty"><div className="empty-title">No published projects yet</div></div>}
      </section>
    </div>
  );
}
