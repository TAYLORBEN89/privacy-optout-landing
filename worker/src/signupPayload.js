// Versioned signup PII payloads (stored encrypted in pii_payloads, AAD "pii:<request_id>").
//   v2 (current, key `v: 2`): landing PR 12 shape. firstName/middleName/lastName, dob, addressLine1/2, city, state,
//       zip, email, phone, texasResident, jurisdiction, nonTexasFlag, submitter ('self'|'child'), child, guardianAttestation.
//   v1 (no `v` key): { fullName, mailingAddress, email, phone, texasResident, jurisdiction, nonTexasFlag }.
// Readers call readSignupPayload() so old and new records both work. It never changes the stored blob.
// Non-signup PII (PATCH /optouts/:id with a free-form `pii`) has no `v` and no signup keys: returned as-is.
export const SIGNUP_PAYLOAD_VERSION = 2;

export const toStoredSignup = (value) => ({ v: SIGNUP_PAYLOAD_VERSION, ...value });

const joinName = (p) => [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
const formatAddress = (p) => [p.addressLine1, p.addressLine2, `${p.city || ''}, ${p.state || ''} ${p.zip || ''}`.trim()]
  .filter((x) => x && x !== ',').join('\n');

const isV1Signup = (p) => p && p.v === undefined && typeof p.fullName === 'string' && typeof p.mailingAddress === 'string';

/**
 * Returns the payload with an explicit `v` and two derived, version-independent fields every reader (export, admin,
 * broker request emails) can use: `fullName` and `mailingAddress`. v1 records keep their original fields and get
 * the v2 structured fields as null (we never guess a split of a free-text name/address). submitter defaults to 'self'.
 */
export function readSignupPayload(p) {
  if (!p || typeof p !== 'object') return p;
  if (p.v === SIGNUP_PAYLOAD_VERSION) {
    return { ...p, fullName: joinName(p), mailingAddress: formatAddress(p) };
  }
  if (isV1Signup(p)) {
    return {
      v: 1, firstName: null, middleName: null, lastName: null, dob: null, addressLine1: null, addressLine2: null,
      city: null, state: null, zip: null, submitter: 'self', child: null, guardianAttestation: false,
      phone: null, ...p,
    };
  }
  return p; // not a signup payload (or an unknown future version): pass through unchanged
}
