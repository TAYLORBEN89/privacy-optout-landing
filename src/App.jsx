import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, SERVICES, STATUSES } from './services.js';
import TexasBrokers from './TexasBrokers.jsx';
import { AuthError, forgetKey, getKey, loadRecords, saveRecord, setKey } from './storage.js';

const svcById = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
const today = () => new Date().toISOString().slice(0, 10);

function addMonths(iso, months) {
  const d = new Date(iso + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
const isOverdue = (r) => r.nextReverify && r.nextReverify < today() && r.status !== 'not_started';

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')];
}

function Card({ record, onChange }) {
  const svc = svcById[record.id];
  const overdue = isOverdue(record);
  const set = (patch) => onChange({ ...record, ...patch });
  const setSubmitted = (v) => set({ dateSubmitted: v, nextReverify: v ? addMonths(v, svc.reverifyMonths) : '',
    status: v && record.status === 'not_started' ? 'submitted' : record.status });
  return (
    <div className={`card ${overdue ? 'overdue' : ''} status-${record.status}`}>
      <div className="card-head">
        <div>
          <h3>{svc.name}</h3>
          <a href={record.url} target="_blank" rel="noreferrer">{record.url.replace(/^https?:\/\//, '')}</a>
        </div>
        <select value={record.status} onChange={(e) => set({ status: e.target.value })}>
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      {overdue && <div className="badge-red">Re-verification overdue since {record.nextReverify}</div>}
      <div className="grid">
        <label>Date submitted<input type="date" value={record.dateSubmitted} onChange={(e) => setSubmitted(e.target.value)} /></label>
        <label>Next re-verification<input type="date" value={record.nextReverify} onChange={(e) => set({ nextReverify: e.target.value })} /></label>
        <label className="full">Confirmation #<input type="text" value={record.confirmation} placeholder="Optional" onChange={(e) => set({ confirmation: e.target.value })} /></label>
        <label className="full">Notes<textarea rows="2" value={record.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
      </div>
    </div>
  );
}

function KeyPrompt({ onSubmit, rejected }) {
  const [value, setValue] = useState('');
  return (
    <div className="app">
      <form className="key-prompt" onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value); }}>
        <h1>Privacy Opt-Out Dashboard</h1>
        <p className="sub">Enter your access key to continue.</p>
        {rejected && <div className="badge-red">That key was rejected. Please try again.</div>}
        <input type="password" autoFocus autoComplete="current-password" placeholder="Access key"
          value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="toggle" type="submit">Unlock</button>
      </form>
    </div>
  );
}

export default function App() {
  const [theme, toggle] = useTheme();
  const [records, setRecords] = useState(null);
  const [online, setOnline] = useState(true);
  const [hasKey, setHasKey] = useState(() => !!getKey());
  const [rejected, setRejected] = useState(false);
  const [tab, setTab] = useState(() => (location.hash === '#texas' ? 'texas' : 'checklist'));
  const go = (t) => { setTab(t); history.replaceState(null, '', t === 'texas' ? '#texas' : '#'); };

  const onAuthFail = (e) => {
    if (!(e instanceof AuthError)) throw e;
    forgetKey(); setRecords(null); setRejected(true); setHasKey(false);
  };

  useEffect(() => {
    if (!hasKey) return;
    loadRecords().then(({ records, online }) => { setRecords(records); setOnline(online); setRejected(false); }).catch(onAuthFail);
  }, [hasKey]);

  const update = (rec) => {
    setRecords((rs) => rs.map((r) => (r.id === rec.id ? rec : r)));
    saveRecord(rec).then(setOnline).catch(onAuthFail);
  };

  const forget = () => { forgetKey(); setRecords(null); setRejected(false); setHasKey(false); };

  const stats = useMemo(() => {
    if (!records) return null;
    const total = records.length;
    const confirmed = records.filter((r) => r.status === 'confirmed').length;
    const partial = records.filter((r) => r.status === 'submitted' || r.status === 'reverify').length;
    return { total, confirmed, partial, pct: (confirmed / total) * 100, partialPct: (partial / total) * 100 };
  }, [records]);

  if (!hasKey) return <KeyPrompt rejected={rejected} onSubmit={(k) => { setKey(k); setHasKey(true); }} />;

  if (!records) return <div className="app"><p>Loading…</p></div>;
  const overdue = records.filter(isOverdue);

  return (
    <div className="app">
      <header>
        <div>
          <h1>Privacy Opt-Out Dashboard</h1>
          <p className="sub">DropTexas · Free privacy opt-out for Texans {online ? '' : <span className="offline">· offline (cached)</span>}</p>
        </div>
        <div className="header-actions">
          <button className="toggle" onClick={toggle}>{theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</button>
          <button className="link-btn" onClick={forget} title="Remove the access key from this browser">Forget key</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={`tab ${tab === 'checklist' ? 'active' : ''}`} onClick={() => go('checklist')}>Opt-out checklist</button>
        <button className={`tab ${tab === 'texas' ? 'active' : ''}`} onClick={() => go('texas')}>Texas broker requests</button>
      </nav>

      {tab === 'texas' ? <TexasBrokers onAuthFail={onAuthFail} /> : <>

      <section className="progress-wrap">
        <div className="progress-label">
          <strong>{stats.confirmed} / {stats.total} confirmed</strong>
          <span>{stats.partial} in progress</span>
        </div>
        <div className="progress">
          <div className="bar confirmed" style={{ width: `${stats.pct}%` }} />
          <div className="bar partial" style={{ width: `${stats.partialPct}%` }} />
        </div>
      </section>

      {overdue.length > 0 && (
        <section className="alerts">
          <h2>⚠ Overdue re-verification ({overdue.length})</h2>
          <ul>{overdue.map((r) => <li key={r.id}>{svcById[r.id].name}: due {r.nextReverify}</li>)}</ul>
        </section>
      )}

      {CATEGORIES.map((cat) => {
        const items = records.filter((r) => svcById[r.id].category === cat.id);
        if (!items.length) return null;
        const done = items.filter((r) => r.status === 'confirmed').length;
        return (
          <section key={cat.id} className="category">
            <h2>{cat.label} <span className="count">{done}/{items.length}</span></h2>
            <div className="cards">{items.map((r) => <Card key={r.id} record={r} onChange={update} />)}</div>
          </section>
        );
      })}
      </>}
    </div>
  );
}
