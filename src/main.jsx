import React from 'react';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import App from './App.jsx';
import Account from './Account.jsx';
import './styles.css';
// "#/account" = new session login (D1 auth). Anything else = legacy shared-key dashboard (kept until migration completes).
function Root() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const f = () => setHash(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return hash.startsWith('#/account') ? <Account /> : <App />;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);
