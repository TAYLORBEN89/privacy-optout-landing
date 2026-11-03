import { describe, it, expect } from 'vitest';
import { validatePhone, validateSignup, PHONE_FIELD_LABEL, SIGNUP_FIELDS } from '../src/shared/signup.ts';

const base = { firstName: 'Pat', lastName: 'Example', dob: '1990-04-02', addressLine1: '1 Main St', city: 'Somewhere', state: 'TX', zip: '75001', email: 'p@example.test', texasResident: true };

describe('validatePhone', () => {
  it.each([
    ['(512) 555-0100', '+15125550100'],
    ['512-555-0100', '+15125550100'],
    ['512.555.0101', '+15125550101'],
    ['5125550102', '+15125550102'],
    ['+1 5125550103', '+15125550103'],
    ['+1 (512) 555-0104', '+15125550104'],
    ['1-512-555-0105', '+15125550105'],
    ['  512 555 0199  ', '+15125550199'],
  ])('accepts %s -> %s', (input, out) => {
    expect(validatePhone(input)).toEqual({ value: out });
  });
  it.each([undefined, null, '', '   '])('empty %p is allowed (null)', (v) => {
    expect(validatePhone(v)).toEqual({ value: null });
  });
  it.each([
    '012-555-0100', '112-555-0100', '512-055-0100', '512-155-0100',
    '512-555-010', '512-555-01000', '2-512-555-0100', '+44 20 5555 0100', '+2 512 555 0100',
    '512-555-ABCD', '512<555>0100', '5'.repeat(40), 5125550100, true,
  ])('rejects %p with a static message', (v) => {
    const r = validatePhone(v);
    expect(r).toEqual({ error: { code: 'invalid', message: 'Enter a valid US phone number.' } });
  });
});

describe('validateSignup phone', () => {
  it('exposes UI copy and field name', () => {
    expect(PHONE_FIELD_LABEL).toBe('Phone number (optional)');
    expect(SIGNUP_FIELDS).toContain('phone');
  });
  it('normalizes phone and keeps it optional', () => {
    expect(validateSignup({ ...base, phone: '(512) 555-0100' })).toMatchObject({ ok: true, value: { phone: '+15125550100' } });
    expect(validateSignup(base)).toMatchObject({ ok: true, value: { phone: null } });
  });
  it('reports a bad phone without echoing it', () => {
    const r = validateSignup({ ...base, phone: '012-555-0100' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors)).toEqual(['phone']);
    expect(JSON.stringify(r)).not.toContain('555');
  });
});
