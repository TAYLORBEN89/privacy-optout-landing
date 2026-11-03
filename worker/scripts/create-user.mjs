#!/usr/bin/env node
// Create the FIRST user via the one-time POST /admin/bootstrap route (prepared statements stay in the Worker).
// Prompts for everything (nothing secret goes in argv or shell history). The route only works while the
// users table is empty and the ADMIN_BOOTSTRAP_TOKEN secret is set; it self-disables after the first user.
//
//   node scripts/create-user.mjs                 # API at http://localhost:8787 (wrangler dev)
//   API_URL=https://api.droptexas.com node scripts/create-user.mjs
//
// Afterwards: delete the secret (`wrangler secret delete ADMIN_BOOTSTRAP_TOKEN`), log in, and enroll TOTP.
import readline from 'node:readline';

const API_URL = (process.env.API_URL || 'http://localhost:8787').replace(/\/$/, '');
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173'; // must be in ALLOWED_ORIGIN

function ask(q, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); else rl.output.write(''); };
    rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a); });
  });
}

const token = await ask('Bootstrap token (ADMIN_BOOTSTRAP_TOKEN): ', true);
const email = (await ask('Email: ')).trim();
const password = await ask('Password (min 12 chars): ', true);
const confirm = await ask('Confirm password: ', true);
if (password !== confirm) { console.error('Passwords do not match.'); process.exit(1); }

const res = await fetch(`${API_URL}/admin/bootstrap`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Authorization: `Bearer ${token}` },
  body: JSON.stringify({ email, password }),
});
const body = await res.json().catch(() => ({}));
if (res.status === 201) console.log(`Created user ${body.user_id}. Next: log in and enroll TOTP; then delete ADMIN_BOOTSTRAP_TOKEN.`);
else { console.error(`Failed (${res.status}): ${body.error || 'unknown'} (404 = wrong token, token unset, or a user already exists)`); process.exit(1); }
