// Structured logging for Workers Logs. Only allowlisted fields are ever emitted; request bodies, headers,
// cookies, tokens, query strings and PII never reach the log. Free-text is scrubbed defensively as well.
const ALLOWED = new Set(['method', 'route', 'status', 'ms', 'error', 'counts', 'deleted', 'warned', 'job', 'surface']);
const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g;
const LONG_TOKEN = /[A-Za-z0-9_\-+/=]{20,}/g;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

export const scrub = (s) => String(s).slice(0, 300).replace(EMAIL, '[email]').replace(LONG_TOKEN, '[redacted]').replace(PHONE, '[number]');

// /optouts/<uuid>/pii -> /optouts/:id/pii ; unknown segments collapse so user input never lands in the log.
export function routeOf(pathname) {
  return pathname.replace(/\/+$/, '').split('/').map((seg) => {
    if (!seg) return seg;
    if (/^[0-9a-f-]{36}$/i.test(seg)) return ':id';
    return /^[a-z][a-z0-9-]{0,30}$/.test(seg) ? seg : ':x';
  }).join('/') || '/';
}

function clean(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (!ALLOWED.has(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (v && typeof v === 'object') out[k] = Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'number'));
    else if (v != null) out[k] = scrub(v);
  }
  return out;
}

export function log(event, fields) { console.log(JSON.stringify({ event: scrub(event), ...clean(fields) })); }
export function logError(event, err, fields) {
  console.error(JSON.stringify({ event: scrub(event), ...clean(fields), error: scrub(err?.name || 'Error') }));
}
