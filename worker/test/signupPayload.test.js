import { describe, it, expect } from 'vitest';
import { readSignupPayload, toStoredSignup, SIGNUP_PAYLOAD_VERSION } from '../src/signupPayload.js';

describe('signup payload versions', () => {
  it('stores v2 and derives fullName/mailingAddress', () => {
    const p = readSignupPayload(toStoredSignup({ firstName: 'A', middleName: 'B', lastName: 'C', addressLine1: '1 St', addressLine2: 'Apt 2', city: 'X', state: 'TX', zip: '75001' }));
    expect(p.v).toBe(SIGNUP_PAYLOAD_VERSION);
    expect(p.fullName).toBe('A B C');
    expect(p.mailingAddress).toBe('1 St\nApt 2\nX, TX 75001');
  });
  it('v1 gets v:1 and null structured fields, keeps originals', () => {
    const p = readSignupPayload({ fullName: 'A C', mailingAddress: 'addr', email: 'e@x.test', phone: '+15125550100' });
    expect(p).toMatchObject({ v: 1, fullName: 'A C', mailingAddress: 'addr', firstName: null, submitter: 'self', phone: '+15125550100' });
  });
  it('non-signup PII passes through untouched', () => {
    const x = { anything: 1 };
    expect(readSignupPayload(x)).toBe(x);
    expect(readSignupPayload(null)).toBe(null);
  });
});
