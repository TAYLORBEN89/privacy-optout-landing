// Signed-in account area: Profile, Opt-out history, Request status, Settings (sign-in methods, sessions, data).
// Clean, minimal layout: left nav + one content panel. Sensitive actions ask for a step-up (re-auth, 10 minutes).
import { useEffect, useState } from 'react';
import * as api from './authApi.js';

const fmt = (t) => (t ? new Date(t * 1000).toLocaleString() : '—');
const STATUS_LABEL = {
  queued: 'Queued', submitted: 'Submitted', in_progress: 'In progress', pending: 'Waiting on response',
  confirmed: 'Confirmed', denied: 'Not completed', reverify: 'Needs re-check',
};
const ACTIVE = new Set(['queued', 'submitted', 'in_progress', 'pending', 'reverify']);
const providerLabel = (id) => api.PROVIDERS.find((p) => p.id === id)?.label || id;

function StepUp({ me, onDone, onCancel }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const viaProvider = async (p) => {
    try { api.submitStart(await api.stepUpProvider(p)); } catch (e) { setErr(e.message); }
  };
  const viaPassword = async (e) => {
    e.preventDefault(); setErr('');
    try { await api.stepUpPassword(password, code.trim()); onDone(); } catch (e2) { setErr(e2.status === 429 ? 'Too many attempts.' : 'That did not match.'); }
  };
  return (
    <div className="acct-modal" role="dialog" aria-modal="true">
      <div className="acct-card">
        <h3>Confirm it's you</h3>
        <p className="muted">For your security, sign in again to continue. This lasts 10 minutes.</p>
        {err && <div className="badge-red">{err}</div>}
        {me.providers.map((p) => (
          <button key={p.provider} className="acct-btn" onClick={() => viaProvider(p.provider)}>Continue with {providerLabel(p.provider)}</button>
        ))}
        {me.user.has_password && (
          <form onSubmit={viaPassword} className="acct-form">
            <input type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <input inputMode="numeric" placeholder="Authenticator code" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="acct-btn primary" type="submit">Confirm</button>
          </form>
        )}
        <button className="link-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Profile({ guard }) {
  const [p, setP] = useState(null);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api.getProfile().then((d) => { setP(d); setName(d.display_name || ''); });
  useEffect(() => { load(); }, []);
  if (!p) return <p className="muted">Loading…</p>;
  const save = async (e) => { e.preventDefault(); await api.patchProfile({ display_name: name }); setMsg('Saved.'); };
  return (
    <section>
      <h2>Profile</h2>
      <form className="acct-row" onSubmit={save}>
        <label>Display name<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
        <button className="acct-btn" type="submit">Save</button>
      </form>
      {msg && <p className="muted">{msg}</p>}
      <h3>Sign-in email addresses</h3>
      {p.identifiers_locked
        ? <button className="acct-btn" onClick={() => guard(load)}>Show</button>
        : <ul className="acct-list">{p.sign_in_emails.map((e) => (
          <li key={e.provider + e.email}><span>{e.email}</span><span className="muted">{providerLabel(e.provider)}{e.verified ? '' : ' · unverified'}</span></li>
        ))}</ul>}
    </section>
  );
}

function OptoutTable({ rows, empty }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <table className="acct-table">
      <thead><tr><th>Request</th><th>Status</th><th>Created</th><th>Updated</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id}><td>{r.kind === 'tx' ? 'Texas privacy request' : 'Opt-out'}{r.broker_id ? ` · ${r.broker_id}` : ''}</td>
          <td><span className={`acct-pill s-${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
          <td>{fmt(r.created_at)}</td><td>{fmt(r.updated_at)}</td></tr>
      ))}</tbody>
    </table>
  );
}

function useOptouts() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.optouts().then((d) => setRows(d.optouts)).catch(() => setRows([])); }, []);
  return rows;
}
function History() {
  const rows = useOptouts();
  return <section><h2>Opt-out history</h2>{rows ? <OptoutTable rows={rows} empty="No requests yet." /> : <p className="muted">Loading…</p>}</section>;
}
function Status() {
  const rows = useOptouts();
  return <section><h2>Request status</h2>{rows ? <OptoutTable rows={rows.filter((r) => ACTIVE.has(r.status))} empty="Nothing in progress." /> : <p className="muted">Loading…</p>}</section>;
}

function Settings({ me, reloadMe, guard, onSignedOut }) {
  const [sess, setSess] = useState([]);
  const [err, setErr] = useState('');
  const loadSessions = () => api.sessions().then((d) => setSess(d.sessions)).catch(() => {});
  useEffect(() => { loadSessions(); }, []);
  const linked = new Set(me.providers.map((p) => p.provider));
  const run = (fn) => guard(async () => { setErr(''); try { await fn(); } catch (e) { if (e.body?.error !== 'step_up_required') setErr(e.message); else throw e; } });
  const download = async () => {
    const data = await api.exportData();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'account-export.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <section>
      <h2>Settings</h2>
      {err && <div className="badge-red">{err}</div>}
      <h3>Sign-in methods</h3>
      <ul className="acct-list">
        {api.PROVIDERS.map((p) => (
          <li key={p.id}><span>{p.label}</span>
            {linked.has(p.id)
              ? <button className="acct-btn" onClick={() => run(async () => { await api.unlinkProvider(p.id); await reloadMe(); })}>Remove</button>
              : <button className="acct-btn" onClick={() => run(async () => { api.submitStart(await api.linkProvider(p.id)); })}>Connect</button>}
          </li>
        ))}
        <li><span>Password + authenticator</span><span className="muted">{me.user.has_password ? 'On' : 'Not set up'}</span></li>
      </ul>
      <h3>Active sessions</h3>
      <ul className="acct-list">{sess.map((s) => (
        <li key={s.id}><span>{providerLabel(s.auth_method)} · last active {fmt(s.last_seen_at)}{s.current ? ' · this device' : ''}</span>
          {!s.current && <button className="acct-btn" onClick={() => run(async () => { await api.revokeSession(s.id); await loadSessions(); })}>Sign out</button>}</li>
      ))}</ul>
      <h3>Your data</h3>
      <div className="acct-row">
        <button className="acct-btn" onClick={() => run(download)}>Download my data</button>
        <button className="acct-btn danger" onClick={() => run(async () => {
          if (!confirm('Delete your account and all of its data? This cannot be undone.')) return;
          await api.deleteAccount(); onSignedOut();
        })}>Delete account</button>
      </div>
    </section>
  );
}

const TABS = [['profile', 'Profile'], ['history', 'Opt-out history'], ['status', 'Request status'], ['settings', 'Settings']];

export default function AccountArea({ me, reloadMe, onSignedOut }) {
  const [tab, setTab] = useState('profile');
  const [pending, setPending] = useState(null); // action waiting for step-up
  // Runs fn; if the API asks for step-up, shows the re-auth dialog and retries after a password step-up.
  const guard = async (fn) => {
    try { await fn(); } catch (e) { if (e?.body?.error === 'step_up_required') setPending(() => fn); }
  };
  const signOut = async () => { try { await api.logout(); } catch { /* ignore */ } onSignedOut(); };
  return (
    <div className="acct">
      <aside className="acct-nav">
        <div className="acct-who">{me.user.display_name || 'Your account'}</div>
        {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
        <button onClick={signOut}>Sign out</button>
      </aside>
      <main className="acct-main">
        {tab === 'profile' && <Profile guard={guard} />}
        {tab === 'history' && <History />}
        {tab === 'status' && <Status />}
        {tab === 'settings' && <Settings me={me} reloadMe={reloadMe} guard={guard} onSignedOut={onSignedOut} />}
      </main>
      {pending && <StepUp me={me} onCancel={() => setPending(null)} onDone={async () => { const f = pending; setPending(null); await reloadMe(); await guard(f); }} />}
    </div>
  );
}
