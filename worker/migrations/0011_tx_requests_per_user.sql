-- 0011 (was 0006 before renumbering; 0009 reserved for email, 0010 inactive accounts):
-- Texas TDPSA broker requests are per-user optout_requests rows (kind = 'tx', user_id FK -> users ON DELETE CASCADE).
-- One row per (user, broker request id); service_id holds the client id (e.g. "tx-acme-data-llc").
-- Scoped to service_id LIKE 'tx-%': POST /api/optouts/signup also writes kind = 'tx' rows (service_id = 'signup'),
-- one per submission, and those must stay repeatable.
CREATE UNIQUE INDEX optout_tx_user_service ON optout_requests(user_id, service_id) WHERE kind = 'tx' AND service_id LIKE 'tx-%';
