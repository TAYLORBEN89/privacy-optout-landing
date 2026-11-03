import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import Account from './Account.jsx';
import './styles.css';
import { clearLegacyStorage } from './legacyStorage.js';

clearLegacyStorage(); // wipe plaintext caches (records, Texas requests, identifiers, access key) left by older versions

// The legacy shared-key KV dashboard (App.jsx + storage.js) needs VITE_API_URL pointing at a host that routes every
// path to the Worker. Production builds leave VITE_API_URL empty (same-origin /api/*), so there the legacy dashboard
// is compiled out entirely (dead branch -> no chunk) and every route shows the account area / sign-in.
// Dev builds that set VITE_API_URL (e.g. http://localhost:8787) keep it at "#/"; "#/account" is the new account area.
// `npm run check:no-legacy` builds with VITE_API_URL empty and fails if legacy code is in dist/.
// Written as a direct ternary on the env literal so Rollup can drop the dynamic import when it is empty.
const App = import.meta.env.VITE_API_URL ? lazy(() => import('./App.jsx')) : null;

function Root() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const f = () => setHash(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => { if (!App && !hash.startsWith('#/account')) history.replaceState(null, '', '#/account'); }, [hash]);
  if (!App || hash.startsWith('#/account')) return <Account />;
  return <Suspense fallback={null}><App /></Suspense>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);
