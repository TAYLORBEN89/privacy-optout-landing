import { useEffect, useMemo, useState } from 'react';
import bundled from './data/tx-brokers.json';
import { AuthError, ProfileAuthError, loadProfile, loadTxRequests, saveProfile, saveTxRequest } from './storage.js';
import { AG_COMPLAINT_URL, EMPTY_PROFILE, RESPONSE_DAYS, buildEmail } from './txProfile.js';

// Texas data broker registry -> TDPSA deletion/opt-out requests.
// The tool never sends email: it builds the text, offers Copy and a mailto: link, and tracks what the user sent.
const REG_KEY = 'privacy-dashboard:tx-registry';
export const TX_STATUSES = [
  { id: 'not_sent', label: 'Not sent' },
  { id: 'sent', label: 'Sent – awaiting reply' },
  { id: 'extended', label: 'Extended (+45 days)' },
  { id: 'completed', label: 'Completed / deleted' },
  { id: 'no_data', label: 'No data held' },
  { id: 'denied', label: 'Not completed' },
  { id: 'appealed', label: 'Appealed' },
  { id: 'ag_complaint', label: 'AG complaint filed' },
];
const OPEN = ['sent', 'extended', 'appealed'];
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const isOverdue = (r) => r && OPEN.includes(r.status) && r.deadline && r.deadline < today();
const reqId = (b) => 'tx-' + (b.reg || b.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);

// Map a registry export (XLSX or CSV, any row offset) to broker objects.
async function parseRegistry(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const h = rows.findIndex((r) => r.some((c) => /full legal name/i.test(String(c))));
  if (h < 0) throw new Error('Could not find a "Full Legal Name" column. Is this the Texas SOS registry export?');
  const head = rows[h].map((c) => String(c).trim().toLowerCase());
  const col = (re) => head.findIndex((c) => re.test(c));
  const ix = { reg: col(/registration number/), name: col(/full legal name/), email: col(/email/), website: col(/^website/),
    rightsLink: col(/consumer rights/), phone: col(/telephone/), address: col(/physical address/), submitted: col(/submitted/) };
  const byName = new Map();
  for (const r of rows.slice(h + 1)) {
    const g = (k) => (ix[k] >= 0 ? String(r[ix[k]] ?? '').trim() : '');
    if (!g('name')) continue;
    const b = { reg: g('reg'), name: g('name'), email: g('email'), website: g('website'), rightsLink: g('rightsLink'),
      phone: g('phone'), address: g('address').replace(/\s*,\s*/g, ', '), submitted: g('submitted').slice(0, 10) };
    byName.set(b.name.toLowerCase(), b);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function loadRegistry() {
  try { const r = JSON.parse(localStorage.getItem(REG_KEY)); if (r?.brokers?.length) return r; } catch { /* ignore */ }
  return { ...bundled, label: `Bundled export from ${bundled.exportedOn}` };
}

const href = (u) => (!u ? '' : /^https?:\/\//i.test(u) ? u : 'https://' + u);

function BrokerRow({ broker, req, onChange, profile }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const r = req || { id: reqId(broker), status: 'not_sent', sentDate: '', deadline: '', notes: '' };
  const overdue = isOverdue(r);
  const { subject, body } = useMemo(() => buildEmail(broker, profile), [broker, profile]);
  const set = (patch) => onChange({ ...r, broker: broker.name, email: broker.email, reg: broker.reg, ...patch });
  const setSent = (v) => set({ sentDate: v, deadline: v ? addDays(v, RESPONSE_DAYS) : '', status: v && r.status === 'not_sent' ? 'sent' : r.status });
  const setStatus = (s) => {
    const patch = { status: s };
    if (s === 'extended' && r.sentDate) patch.deadline = addDays(r.sentDate, RESPONSE_DAYS * 2);
    if (s === 'appealed') { patch.appealDate = today(); patch.deadline = addDays(today(), 60); } // § 541.053: 60 days to act on appeal
    set(patch);
  };
  const copy = async () => { await navigator.clipboard.writeText(`To: ${broker.email}\nSubject: ${subject}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const mailto = `mailto:${broker.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const statusClass = r.status === 'not_sent' ? '' : ['completed', 'no_data'].includes(r.status) ? 'status-confirmed' : ['denied', 'ag_complaint'].includes(r.status) ? 'status-reverify' : 'status-submitted';

  return (
    <div className={`card tx-row ${statusClass} ${overdue ? 'overdue' : ''}`}>
      <div className="card-head">
        <div className="tx-title">
          <h3>{broker.name}</h3>
          <div className="tx-meta">
            {broker.email ? <a href={`mailto:${broker.email}`}>{broker.email}</a> : <span className="muted">no email listed</span>}
            {broker.website && <> · <a href={href(broker.website)} target="_blank" rel="noreferrer">website</a></>}
            {broker.rightsLink && <> · <a href={href(broker.rightsLink)} target="_blank" rel="noreferrer">rights / opt-out page</a></>}
          </div>
        </div>
        <div className="tx-actions">
          <select value={r.status} onChange={(e) => setStatus(e.target.value)}>
            {TX_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="toggle small" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Request'}</button>
        </div>
      </div>
      {overdue && <div className="badge-red">No response — deadline passed {r.deadline}. Consider an appeal or an AG complaint.</div>}
      {r.status === 'denied' && <div className="tx-hint">Not completed: reply with an appeal (the company has 60 days to answer, § 541.053). If the appeal is denied, <a href={AG_COMPLAINT_URL} target="_blank" rel="noreferrer">file a complaint with the Texas AG</a>.</div>}
      {r.status === 'appealed' && <div className="tx-hint">Appeal sent {r.appealDate}. If it is denied or unanswered by {r.deadline}, <a href={AG_COMPLAINT_URL} target="_blank" rel="noreferrer">file a Texas AG complaint</a>.</div>}
      {open && (
        <>
          <div className="tx-email">
            <div className="tx-email-head"><strong>Subject:</strong> {subject}</div>
            <pre>{body}</pre>
            <div className="tx-email-actions">
              <button className="toggle small" onClick={copy}>{copied ? 'Copied ✓' : 'Copy email'}</button>
              {broker.email && <a className="toggle small btn-link" href={mailto}>Open in mail app</a>}
              {r.status === 'not_sent' && <button className="toggle small" onClick={() => setSent(today())}>Mark sent today</button>}
            </div>
          </div>
          <div className="grid">
            <label>Date sent<input type="date" value={r.sentDate} onChange={(e) => setSent(e.target.value)} /></label>
            <label>Response deadline<input type="date" value={r.deadline} onChange={(e) => set({ deadline: e.target.value })} /></label>
            <label className="full">Response notes<textarea rows="2" value={r.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
          </div>
        </>
      )}
      {!open && r.sentDate && <div className="tx-meta muted">Sent {r.sentDate} · due {r.deadline}{r.notes ? ' · ' + r.notes.slice(0, 80) : ''}</div>}
    </div>
  );
}

const FIELDS = [
  ['name', 'Full legal name', false], ['aliases', 'Aliases / other names (one per line)', true],
  ['addresses', 'Addresses, current first (one per line)', true], ['phones', 'Phone numbers (one per line)', true],
  ['emails', 'Email addresses (one per line)', true], ['replyTo', 'Reply-to email', false],
];
function ProfileEditor({ profile, onSave, readOnly }) {
  const [open, setOpen] = useState(!profile.name);
  const [draft, setDraft] = useState(profile);
  const [msg, setMsg] = useState('');
  useEffect(() => setDraft(profile), [profile]);
  const val = (k, multi) => (multi ? (draft[k] || []).join('\n') : draft[k] || '');
  const setVal = (k, multi, v) => setDraft({ ...draft, [k]: multi ? v.split('\n') : v });
  const save = async () => {
    const clean = { ...draft, id: 'profile' };
    for (const [k, , multi] of FIELDS) if (multi) clean[k] = (clean[k] || []).map((x) => x.trim()).filter(Boolean);
    if (readOnly) return;
    try { await onSave(clean); setMsg('Saved to your Worker ✓'); } catch (e) {
      setMsg(e instanceof AuthError || e?.status === 401 || e?.status === 403
        ? 'Not saved: sign in at #/account (nothing is stored in this browser)'
        : 'Not saved: the server could not be reached. Try again.');
    }
    setTimeout(() => setMsg(''), 2500);
  };
  const n = (k) => (profile[k] || []).length;
  return (
    <section className="progress-wrap">
      <div className="progress-label">
        <strong>Your identifiers</strong>
        <button className="link-btn" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Edit'}</button>
      </div>
      {!open && <p className="tx-note">{profile.name || 'Not set'} · {n('aliases')} aliases · {n('addresses')} addresses · {n('phones')} phones · {n('emails')} emails. Used in every request email; stored in your Worker, not in the website code.</p>}
      {open && (
        <div className="grid">
          {FIELDS.map(([k, label, multi]) => (
            <label key={k} className={multi ? 'full' : ''}>{label}
              {multi ? <textarea rows={k === 'addresses' || k === 'phones' ? 6 : 3} value={val(k, true)} onChange={(e) => setVal(k, true, e.target.value)} />
                : <input type="text" value={val(k, false)} onChange={(e) => setVal(k, false, e.target.value)} />}
            </label>
          ))}
          <div className="full tx-email-actions"><button className="toggle small" onClick={save} disabled={readOnly}>Save identifiers</button>{msg && <span className="tx-note">{msg}</span>}</div>
        </div>
      )}
    </section>
  );
}

export default function TexasBrokers({ onAuthFail }) {
  const [profile, setProfile] = useState(null);
  const [profileNote, setProfileNote] = useState('');
  const [profileSource, setProfileSource] = useState(null); // 'session' | 'legacy' | null (not loaded: read-only)
  useEffect(() => {
    loadProfile().then(({ profile: p, source }) => { setProfile({ ...EMPTY_PROFILE, ...(p || {}) }); setProfileSource(source); }).catch((e) => {
      if (e instanceof AuthError) { onAuthFail(e); return; } // legacy key rejected: same path as every other legacy call
      setProfile(EMPTY_PROFILE); setProfileSource(null);
      setProfileNote(e instanceof ProfileAuthError
        ? 'Sign in at #/account to load and save your identifiers. They are stored encrypted on the server, never in this browser.'
        : 'Could not load your identifiers (server unreachable). Editing is disabled so nothing gets overwritten; reload to retry.');
    });
  }, []);
  const storeProfile = async (p) => { await saveProfile(p, profileSource); setProfile(p); };
  const [registry, setRegistry] = useState(loadRegistry);
  const [reqs, setReqs] = useState(null);
  const [online, setOnline] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(50);
  const [err, setErr] = useState('');

  useEffect(() => { loadTxRequests().then(({ map, online }) => { setReqs(map); setOnline(online); }).catch(onAuthFail); }, []);

  // Offline = read-only: the server state is unknown, so an edit here could overwrite it with defaults.
  const update = (r) => { if (!online) return; setReqs((m) => ({ ...m, [r.id]: r })); saveTxRequest(r).then(setOnline).catch(onAuthFail); };

  const upload = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const brokers = await parseRegistry(f);
      const reg = { source: f.name, exportedOn: today(), label: `Uploaded ${f.name} on ${today()}`, brokers };
      localStorage.setItem(REG_KEY, JSON.stringify(reg)); setRegistry(reg); setErr('');
    } catch (x) { setErr(String(x.message || x)); }
    e.target.value = '';
  };
  const resetRegistry = () => { localStorage.removeItem(REG_KEY); setRegistry(loadRegistry()); };

  if (!reqs || !profile) return <p>Loading…</p>;
  const brokers = registry.brokers;
  const reqFor = (b) => reqs[reqId(b)];
  const all = brokers.map((b) => reqFor(b)).filter(Boolean);
  const sent = all.filter((r) => r.status !== 'not_sent').length;
  const done = all.filter((r) => ['completed', 'no_data'].includes(r.status)).length;
  const overdue = brokers.filter((b) => isOverdue(reqFor(b)));

  const ql = q.trim().toLowerCase();
  const shown = brokers.filter((b) => {
    if (ql && !(`${b.name} ${b.email} ${b.website}`.toLowerCase().includes(ql))) return false;
    const r = reqFor(b); const s = r?.status || 'not_sent';
    if (filter === 'not_sent') return s === 'not_sent';
    if (filter === 'open') return OPEN.includes(s);
    if (filter === 'overdue') return isOverdue(r);
    if (filter === 'closed') return ['completed', 'no_data', 'denied', 'ag_complaint'].includes(s);
    return true;
  });

  return (
    <>
      {profileNote && <div className="tx-note">{profileNote}</div>}
      <ProfileEditor profile={profile} onSave={storeProfile} readOnly={!profileSource} />
      <section className="progress-wrap">
        <div className="progress-label">
          <strong>{done} / {brokers.length} brokers completed</strong>
          <span>{sent} requests sent {online ? '' : <span className="offline">· offline: read-only, reload to retry</span>}</span>
        </div>
        <div className="progress">
          <div className="bar confirmed" style={{ width: `${(done / brokers.length) * 100}%` }} />
          <div className="bar partial" style={{ width: `${((sent - done) / brokers.length) * 100}%` }} />
        </div>
        <p className="tx-note">
          {registry.label} · {brokers.length} registered brokers from the <a href="https://texas-sos.appianportalsgov.com/data-broker-registry" target="_blank" rel="noreferrer">Texas SOS data broker registry</a>.
          Each request is a TDPSA deletion + opt-out email. Nothing is sent from here: copy it or open it in your mail app and send it yourself, then mark it sent. Companies have {RESPONSE_DAYS} days to respond.
        </p>
        <div className="tx-upload">
          <label className="toggle small">Upload newer registry export (.xlsx / .csv)<input type="file" accept=".xlsx,.xls,.csv" onChange={upload} hidden /></label>
          {registry.label?.startsWith('Uploaded') && <button className="link-btn" onClick={resetRegistry}>Use bundled list</button>}
          {err && <span className="badge-red">{err}</span>}
        </div>
      </section>

      {overdue.length > 0 && (
        <section className="alerts">
          <h2>⚠ Past the 45-day deadline ({overdue.length})</h2>
          <ul>{overdue.map((b) => <li key={b.name}>{b.name}: due {reqFor(b).deadline}</li>)}</ul>
          <p className="tx-alert-note">Next step: send an appeal to the company. If it is denied or ignored, <a href={AG_COMPLAINT_URL} target="_blank" rel="noreferrer">file a complaint with the Texas Attorney General</a>.</p>
        </section>
      )}

      <div className="tx-filters">
        <input type="search" placeholder={`Search ${brokers.length} brokers…`} value={q} onChange={(e) => { setQ(e.target.value); setLimit(50); }} />
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(50); }}>
          <option value="all">All</option><option value="not_sent">Not sent</option><option value="open">Awaiting reply</option>
          <option value="overdue">Overdue</option><option value="closed">Closed</option>
        </select>
        <span className="count">{shown.length} shown</span>
      </div>
      <div className="tx-list">
        <fieldset disabled={!online} style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}>{shown.slice(0, limit).map((b) => <BrokerRow key={reqId(b)} profile={profile} broker={b} req={reqFor(b)} onChange={update} />)}</fieldset>
      </div>
      {shown.length > limit && <button className="toggle more" onClick={() => setLimit(limit + 100)}>Show more ({shown.length - limit} left)</button>}
    </>
  );
}
