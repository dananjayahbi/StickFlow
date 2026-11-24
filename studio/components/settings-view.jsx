'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {Check, Loader2, Mic, Save, Upload} from 'lucide-react';
import {Badge} from './ui.jsx';
import {formatDuration} from '../lib/format.mjs';

export default function SettingsView({initial}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState(() => ({
    defaultEngine: initial.tts.defaultEngine,
    fallbackToKokoro: initial.tts.fallbackToKokoro,
    qwenMode: initial.tts.qwen.mode,
    qwenSpeaker: initial.tts.qwen.speaker,
    kokoroVoice: initial.tts.kokoro.voice,
  }));
  const [upload, setUpload] = useState({name: '', text: '', file: null});
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setError('');
    try {
      const response = await fetch('/api/settings/tts', {cache: 'no-store'});
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || 'Could not load settings');
      setData(next);
      setDraft({
        defaultEngine: next.tts.defaultEngine,
        fallbackToKokoro: next.tts.fallbackToKokoro,
        qwenMode: next.tts.qwen.mode,
        qwenSpeaker: next.tts.qwen.speaker,
        kokoroVoice: next.tts.kokoro.voice,
      });
    } catch (err) { setError(err.message); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!draft) return;
    setBusy('save'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/settings/tts', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          defaultEngine: draft.defaultEngine,
          fallbackToKokoro: draft.fallbackToKokoro,
          qwen: {mode: draft.qwenMode, speaker: draft.qwenSpeaker},
          kokoro: {voice: draft.kokoroVoice},
        }),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || 'Save failed');
      setData(next);
      setMessage('Voice settings saved.');
      router.refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const useVoice = async id => {
    setBusy(`voice:${id}`); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/voices/${encodeURIComponent(id)}/use`, {method: 'POST'});
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || 'Could not use voice');
      setMessage('Voice selected. Qwen will clone this reference.');
      await load();
      router.refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const usePreset = async speaker => {
    setBusy('preset'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/voices/preset', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({speaker}),
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || 'Could not select speaker');
      setMessage(`Preset speaker ${speaker} selected.`);
      await load();
      router.refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const submitUpload = async event => {
    event.preventDefault();
    if (!upload.name.trim()) { setError('Give the voice a name.'); return; }
    if (!upload.file) { setError('Choose a reference audio file.'); return; }
    setUploading(true); setError(''); setMessage('');
    try {
      const form = new FormData();
      form.set('name', upload.name.trim());
      form.set('text', upload.text.trim());
      form.set('file', upload.file);
      form.set('setDefault', 'true');
      const response = await fetch('/api/voices', {method: 'POST', body: form});
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || 'Upload failed');
      setMessage(`Voice “${next.voice.name}” uploaded and selected.`);
      setUpload({name: '', text: '', file: null});
      event.target.reset();
      await load();
      router.refresh();
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  };

  if (!draft || !data) {
    return <div className="card card-pad row"><Loader2 size={16} className="spin" /> Loading studio settings…</div>;
  }

  const qwen = data.engines.qwen;
  const kokoro = data.engines.kokoro;
  const qwenDefault = draft.defaultEngine === 'qwen';

  return (
    <div className="stack">
      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2 className="card-title">Default engine</h2><span className="card-note">Used by new narration</span></div>
          <div className="card-pad stack">
            <label className={`notice ${qwenDefault ? 'notice-green' : ''}`} style={{display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer'}}>
              <input type="radio" name="engine" checked={qwenDefault} onChange={() => setDraft({...draft, defaultEngine: 'qwen'})} style={{marginTop: 3, accentColor: 'var(--red)'}} />
              <span style={{flex: 1}}>
                <span className="spread"><strong>Qwen3-TTS · GPU</strong><Badge tone={qwen.available ? 'published' : 'archived'} dot>{qwen.available ? 'ready' : 'unavailable'}</Badge></span>
                <span className="small muted" style={{display: 'block', marginTop: 4}}>Expressive 0.6B model on the GTX 1660 Ti. About 25–40 seconds for a short read.</span>
              </span>
            </label>
            <label className={`notice ${!qwenDefault ? 'notice-green' : ''}`} style={{display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer'}}>
              <input type="radio" name="engine" checked={!qwenDefault} onChange={() => setDraft({...draft, defaultEngine: 'kokoro'})} style={{marginTop: 3, accentColor: 'var(--red)'}} />
              <span style={{flex: 1}}>
                <span className="spread"><strong>Kokoro-82M · CPU</strong><Badge tone={kokoro.available ? 'published' : 'archived'} dot>{kokoro.available ? 'ready' : 'unavailable'}</Badge></span>
                <span className="small muted" style={{display: 'block', marginTop: 4}}>Fast, lightweight, fully offline. Good for drafts and fallback.</span>
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={draft.fallbackToKokoro} onChange={event => setDraft({...draft, fallbackToKokoro: event.target.checked})} />
              Fall back to Kokoro if Qwen fails
            </label>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2 className="card-title">Kokoro</h2><Badge tone="kokoro">CPU</Badge></div>
          <div className="card-pad stack">
            <label className="field">
              <span className="label">Voice</span>
              <select className="select" value={draft.kokoroVoice} onChange={event => setDraft({...draft, kokoroVoice: event.target.value})}>
                {data.kokoroVoices.map(voice => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
              </select>
            </label>
            <div className="notice">
              Qwen remains the preferred voice. Kokoro is the fast fallback and the right choice when the GPU is busy.
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Qwen voice</h2><span className="card-note">{qwen.mode === 'clone' ? 'Cloning a reference' : 'Preset speaker'}</span></div>
        <div className="card-pad stack">
          <div className="row">
            <label className="check"><input type="radio" checked={draft.qwenMode === 'custom_voice'} onChange={() => setDraft({...draft, qwenMode: 'custom_voice'})} /> Preset speaker</label>
            <label className="check"><input type="radio" checked={draft.qwenMode === 'clone'} onChange={() => setDraft({...draft, qwenMode: 'clone'})} /> Clone a reference</label>
          </div>

          {draft.qwenMode === 'custom_voice' ? (
            <div className="grid-2">
              <label className="field">
                <span className="label">Speaker</span>
                <select className="select" value={draft.qwenSpeaker} onChange={event => setDraft({...draft, qwenSpeaker: event.target.value})}>
                  {data.speakers.map(speaker => <option key={speaker.id} value={speaker.id}>{speaker.label}</option>)}
                </select>
              </label>
              <div className="field">
                <span className="label">Use now</span>
                <button className="btn" onClick={() => usePreset(draft.qwenSpeaker)} disabled={Boolean(busy)}><Mic size={14} /> {busy === 'preset' ? 'Selecting…' : 'Select this speaker'}</button>
              </div>
            </div>
          ) : (
            <div className="stack">
              <div className="notice">
                Clone mode uses the Qwen Base checkpoint and your reference audio. Add a clean 3–20 second sample, optionally with its transcript.
              </div>
              <div className="list">
                {data.voices.length ? data.voices.map(voice => (
                  <div className="list-row" key={voice.id} style={{paddingLeft: 0, paddingRight: 0}}>
                    <div className="list-main">
                      <div className="list-title">{voice.name}</div>
                      <div className="list-meta">
                        <span>{formatDuration(voice.duration)}</span>
                        <span>{voice.text || 'x-vector only'}</span>
                      </div>
                    </div>
                    <button className="btn btn-sm" onClick={() => useVoice(voice.id)} disabled={Boolean(busy)}>
                      {busy === `voice:${voice.id}` ? 'Selecting…' : 'Use voice'}
                    </button>
                  </div>
                )) : <div className="small muted">No reference voices yet.</div>}
              </div>
            </div>
          )}

          <form className="stack" onSubmit={submitUpload} style={{borderTop: '1px solid var(--line)', paddingTop: 18}}>
            <div className="row" style={{justifyContent: 'space-between'}}><strong>Upload a reference voice</strong><span className="tiny mono faint">3–20 seconds · WAV/MP3/M4A</span></div>
            <div className="form-grid">
              <label className="field"><span className="label">Name</span><input className="input" value={upload.name} onChange={event => setUpload({...upload, name: event.target.value})} placeholder="Morgan — warm narrator" /></label>
              <label className="field"><span className="label">Audio file</span><input className="input" type="file" accept="audio/*" onChange={event => setUpload({...upload, file: event.target.files?.[0] || null})} /></label>
            </div>
            <label className="field"><span className="label">Transcript (optional)</span><textarea className="textarea" value={upload.text} onChange={event => setUpload({...upload, text: event.target.value})} placeholder="Exact words in the reference clip. Improves cloning when provided." /></label>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={uploading}><Upload size={14} /> {uploading ? 'Uploading…' : 'Upload & use'}</button>
            </div>
          </form>
        </div>
      </section>

      {error ? <div className="notice notice-red">{error}</div> : null}
      {message ? <div className="notice notice-green"><Check size={13} style={{display: 'inline', verticalAlign: '-2px'}} /> {message}</div> : null}

      <div className="card card-pad">
        <div className="spread">
          <div className="small muted">Config: <span className="mono">{data.configFile}</span></div>
          <button className="btn btn-primary" onClick={save} disabled={Boolean(busy)}><Save size={14} /> {busy === 'save' ? 'Saving…' : 'Save voice settings'}</button>
        </div>
      </div>
    </div>
  );
}
