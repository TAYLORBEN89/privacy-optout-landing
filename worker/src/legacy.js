// Cloudflare Worker: REST API for opt-out records, backed by KV (binding RECORDS).
// Routes (same for /txrequests): GET /records, POST /records, GET|PUT|DELETE /records/:id
// Auth: Authorization: Bearer <API_TOKEN secret>. CORS limited to env.ALLOWED_ORIGIN.
// Collections: /records -> 'record:' keys (opt-out checklist), /txrequests -> 'txreq:' keys (Texas TDPSA broker requests).
const COLLECTIONS = { records: 'record:', txrequests: 'txreq:', settings: 'settings:' };
// /settings/profile holds the user's identifiers for request emails (kept out of the public bundle).

const allowedOrigins = (env) => (env.ALLOWED_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);

function cors(env, origin) {
  const list = allowedOrigins(env);
  return {
    'Access-Control-Allow-Origin': origin && list.includes(origin) ? origin : list[0] || '',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const json = (env, body, status = 200, origin = env.__origin) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(env, origin) } });

function authorized(req, env) {
  const h = req.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!env.API_TOKEN || token.length !== env.API_TOKEN.length) return false;
  let diff = 0; // constant-time compare
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ env.API_TOKEN.charCodeAt(i);
  return diff === 0;
}
const validId = (id) => /^[a-z0-9_-]{1,64}$/i.test(id);

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin');
    if (origin && !allowedOrigins(env).includes(origin)) return new Response('Forbidden origin', { status: 403 });
    env = { ...env, __origin: origin };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, origin) });
    if (!authorized(req, env)) return json(env, { error: 'unauthorized' }, 401);

    const url = new URL(req.url);
    const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    const PREFIX = COLLECTIONS[parts[0]];
    if (!PREFIX || parts.length > 2) return json(env, { error: 'not found' }, 404);
    const id = parts[1] ? decodeURIComponent(parts[1]) : null;
    if (id !== null && !validId(id)) return json(env, { error: 'invalid id' }, 400);

    try {
      if (!id && req.method === 'GET') {
        const out = [];
        let cursor;
        do {
          const page = await env.RECORDS.list({ prefix: PREFIX, cursor });
          for (const k of page.keys) { const v = await env.RECORDS.get(k.name, 'json'); if (v) out.push(v); }
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);
        return json(env, out);
      }
      if (!id && req.method === 'POST') {
        const body = await req.json();
        const newId = body.id && validId(body.id) ? body.id : crypto.randomUUID();
        const rec = { ...body, id: newId, updatedAt: new Date().toISOString() };
        await env.RECORDS.put(PREFIX + newId, JSON.stringify(rec));
        return json(env, rec, 201);
      }
      if (id && req.method === 'GET') {
        const v = await env.RECORDS.get(PREFIX + id, 'json');
        return v ? json(env, v) : json(env, { error: 'not found' }, 404);
      }
      if (id && req.method === 'PUT') {
        const body = await req.json();
        const rec = { ...body, id, updatedAt: new Date().toISOString() };
        await env.RECORDS.put(PREFIX + id, JSON.stringify(rec));
        return json(env, rec);
      }
      if (id && req.method === 'DELETE') {
        await env.RECORDS.delete(PREFIX + id);
        return json(env, null, 204);
      }
      return json(env, { error: 'method not allowed' }, 405);
    } catch (e) {
      return json(env, { error: 'bad request' }, 400);
    }
  },
};
