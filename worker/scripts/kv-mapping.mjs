// Pure mapping from legacy KV records to D1 optout_requests (+ confirmations). No I/O.
export const OPTOUT_STATUS = { not_started: 'queued', submitted: 'submitted', confirmed: 'confirmed', reverify: 'reverify' };
export const TX_STATUS = {
  not_sent: 'queued', sent: 'submitted', extended: 'pending', appealed: 'pending',
  completed: 'confirmed', no_data: 'confirmed', denied: 'denied', ag_complaint: 'denied',
};
const KNOWN = {
  record: new Set(['id', 'status', 'url', 'dateSubmitted', 'confirmation', 'notes', 'nextReverify', 'updatedAt']),
  txreq: new Set(['id', 'status', 'sentDate', 'deadline', 'notes', 'updatedAt']),
};
const epoch = (d) => {
  if (!d || typeof d !== 'string') return null;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};

/** Returns { row, confirmation, warnings, unmappedFields } for one KV entry. */
export function mapEntry(key, value, userId, nowSec = Math.floor(Date.now() / 1000)) {
  const [prefix, ...rest] = key.split(':');
  const legacyId = rest.join(':');
  const warnings = [];
  if (prefix !== 'record' && prefix !== 'txreq') return { skip: `unsupported prefix ${prefix}` };
  const v = value && typeof value === 'object' ? value : {};
  const SUB = { no_data: 'no_record' }; // Owner decision: "no data found" -> confirmed with sub_status no_record
  const tx = prefix === 'txreq';
  const table = tx ? TX_STATUS : OPTOUT_STATUS;
  let status = table[v.status];
  if (!status) { warnings.push(`unknown status ${JSON.stringify(v.status)} -> queued`); status = 'queued'; }
  const updated = epoch(v.updatedAt) ?? nowSec;
  const submitted = epoch(tx ? v.sentDate : v.dateSubmitted);
  const finished = status === 'confirmed' || status === 'denied' ? updated : null;
  const row = {
    id: crypto.randomUUID(), user_id: userId, kind: tx ? 'tx' : 'optout', service_id: legacyId.slice(0, 128),
    legacy_key: key, status, sub_status: tx ? (SUB[v.status] ?? String(v.status ?? '').slice(0, 32)) || null : null,
    submitted_at: submitted, confirmed_at: status === 'confirmed' ? updated : null, finished_at: finished,
    next_reverify: tx ? null : epoch(v.nextReverify), deadline: tx ? epoch(v.deadline) : null,
    notes: typeof v.notes === 'string' ? v.notes.slice(0, 2000) : null, created_at: submitted ?? updated, updated_at: updated,
  };
  const confirmation = !tx && typeof v.confirmation === 'string' && v.confirmation.trim()
    ? { request_id: row.id, confirmation_no: v.confirmation.trim().slice(0, 200), channel: 'legacy', received_at: updated } : null;
  const unmappedFields = Object.keys(v).filter((k) => !KNOWN[prefix].has(k));
  return { row, confirmation, warnings, unmappedFields };
}

export const ROW_COLS = ['id', 'user_id', 'kind', 'service_id', 'legacy_key', 'status', 'sub_status', 'submitted_at', 'confirmed_at',
  'finished_at', 'next_reverify', 'deadline', 'notes', 'created_at', 'updated_at'];
