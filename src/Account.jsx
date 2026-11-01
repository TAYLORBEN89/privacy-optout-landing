// Account sign-in (D1 auth): Continue with Google/Microsoft, or email + password -> TOTP or backup code
// (fallback); TOTP enrollment with QR; backup codes. Signed-in users get the account area (AccountArea.jsx).
// The legacy shared-key dashboard is available at "#/" only in builds with VITE_API_URL set (dev); production omits it.
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import * as api from './authApi.js';
import AccountArea from './AccountArea.jsx';

const errText = (e) => (e?.status === 429 ? 'Too many attempts. Wait 15 minutes and try again.'
  : e?.status === 401 ? 'Invalid credentials.' : e?.message || 'Something went wrong.');

function BackupCodes({ codes, onDone }) {
  return (
    <div className="key-prompt">
      <h2>Backup codes</h2>
      <p className="sub">Save these somewhere safe. Each works once in place of an authenticator code. They will not be shown again.</p>
      <pre className="backup-codes">{codes.join('\n')}</pre>
      <button className="toggle" onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}>Copy</button>
      <button className="toggle" onClick={onDone}>I saved them</button>
    </div>
  );
}

function Enroll({ onEnrolled }) {
  const [data, setData] = useState(null);
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const started = useRef(false); // StrictMode runs effects twice; enroll must run once (each call replaces the pending secret)
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api.enroll().then(async (d) => { setData(d); setQr(await QRCode.toDataURL(d.otpauth_url, { margin: 1, width: 220 })); })
      .catch((e) => setErr(errText(e)));
  }, []);
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { const r = await api.confirmTotp(code.trim()); onEnrolled(r.backup_codes || []); }
    catch (e2) { setErr(e2?.status === 400 ? 'That code did not match. Try the next one.' : errText(e2)); }
  };
  return (
    <form className="key-prompt" onSubmit={submit}>
      <h2>Set up two-factor authentication</h2>
      <p className="sub">Scan with your authenticator app, then enter the 6-digit code.</p>
      {qr && <img src={qr} alt="TOTP QR code" width="220" height="220" />}
      {data && <details><summary>Can't scan?</summary><code>{data.secret}</code></details>}
      {err && <div className="badge-red">{err}</div>}
      <input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
      <button className="toggle" type="submit" disabled={!data}>Verify</button>
    </form>
  );
}

export default function Account() {
  const [stage, setStage] = useState('loading'); // loading | password | mfa | enroll | codes | signed-in
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preauth, setPreauth] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState([]);
  const [user, setUser] = useState(null);
  const [err, setErr] = useState('');

  const refreshMe = async () => {
    try { const u = await api.me(); setUser(u); setStage(u.limited ? 'enroll' : 'signed-in'); }
    catch { setStage('password'); }
  };
  useEffect(() => { refreshMe(); }, []);

  const doLogin = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const r = await api.login(email.trim(), password);
      setPassword('');
      if (r.mfa_required) { setPreauth(r.preauth_token); setStage('mfa'); } else await refreshMe();
    } catch (e2) { setErr(errText(e2)); }
  };
  const doVerify = async (e) => {
    e.preventDefault(); setErr('');
    try { await api.verify(preauth, code.trim()); setPreauth(''); setCode(''); await refreshMe(); }
    catch (e2) {
      setErr(errText(e2));
      if (e2?.status === 401) { setPreauth(''); setCode(''); setStage('password'); } // pre-auth token may be spent; restart
    }
  };
  const regen = async () => {
    if (!confirm('Replace all existing backup codes?')) return;
    try { setCodes((await api.regenerateBackupCodes()).backup_codes); setStage('codes'); } catch (e2) { setErr(errText(e2)); }
  };

  return (
    <div className="app">
      <header>
        <div><h1>DROP Texas</h1><p className="sub">DROP Texas · Free privacy opt-out for Texans</p></div>
        <div className="header-actions"><a className="link-btn" href="#/">Legacy dashboard (access key)</a></div>
      </header>
      {stage === 'loading' && <p>Loading…</p>}
      {stage === 'password' && (
        <form className="key-prompt" onSubmit={doLogin}>
          <h2>Sign in</h2>
          {err && <div className="badge-red">{err}</div>}
          {new URLSearchParams(location.search).get('auth_error') && <div className="badge-red">Sign-in didn't complete. Please try again.</div>}
          <div className="social">
            {api.PROVIDERS.map((p) => <a key={p.id} href={api.socialStartUrl(p.id)}>Continue with {p.label}</a>)}
          </div>
          <div className="divider">or use email and password</div>
          <input type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="toggle" type="submit">Continue</button>
        </form>
      )}
      {stage === 'mfa' && (
        <form className="key-prompt" onSubmit={doVerify}>
          <h2>Two-factor code</h2>
          <p className="sub">Enter the 6-digit code from your authenticator app, or one of your backup codes.</p>
          {err && <div className="badge-red">{err}</div>}
          <input autoComplete="one-time-code" placeholder="123456 or xxxx-xxxx-xxxx-xxxx" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          <button className="toggle" type="submit">Verify</button>
        </form>
      )}
      {stage === 'enroll' && <Enroll onEnrolled={(c) => { setCodes(c); setStage('codes'); }} />}
      {stage === 'codes' && <BackupCodes codes={codes} onDone={() => { setCodes([]); refreshMe(); }} />}
      {stage === 'signed-in' && user && (
        <>
          {err && <div className="badge-red">{err}</div>}
          <AccountArea me={user} reloadMe={refreshMe} onSignedOut={() => { api.setCsrf(''); setUser(null); setStage('password'); }} />
          {user.user.has_password && <p className="muted"><button className="link-btn" onClick={regen}>Regenerate backup codes</button></p>}
        </>
      )}
    </div>
  );
}
