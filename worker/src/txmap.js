// Texas request status vocabulary (frontend) <-> D1 optout_requests.status (+ sub_status keeps the precise state).
// Same mapping as scripts/kv-mapping.mjs: appealed/extended -> pending, no_data -> confirmed (sub_status no_record),
// ag_complaint -> denied.
export const TX_TO_DB = {
  not_sent: 'queued', sent: 'submitted', extended: 'pending', appealed: 'pending',
  completed: 'confirmed', no_data: 'confirmed', denied: 'denied', ag_complaint: 'denied',
};
export const txSubStatus = (s) => (s === 'no_data' ? 'no_record' : s);
export const txFromSub = (sub, status) => (sub === 'no_record' ? 'no_data' : TX_TO_DB[sub] === status ? sub : null);
const iso = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : '');
export const epochOfDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? Math.floor(Date.parse(`${d}T12:00:00Z`) / 1000) : null);
export function toClient(row) {
  return {
    id: row.service_id, status: txFromSub(row.sub_status, row.status) || 'not_sent',
    sentDate: iso(row.submitted_at), deadline: iso(row.deadline), notes: row.notes || '', updatedAt: row.updated_at,
  };
}
