import { describe, it, expect } from 'vitest';
import { mapEntry } from '../scripts/kv-mapping.mjs';

describe('legacy KV -> D1 mapping', () => {
  const tx = (status) => mapEntry('txreq:b1', { id: 'b1', status, updatedAt: '2026-05-01T00:00:00Z' }, 'u').row;
  it('maps Texas statuses per owner decision', () => {
    expect(tx('appealed')).toMatchObject({ status: 'pending', sub_status: 'appealed', finished_at: null });
    expect(tx('no_data')).toMatchObject({ status: 'confirmed', sub_status: 'no_record' });
    expect(tx('no_data').finished_at).toBeGreaterThan(0);
    expect(tx('ag_complaint')).toMatchObject({ status: 'denied', sub_status: 'ag_complaint' });
    expect(tx('completed')).toMatchObject({ status: 'confirmed', kind: 'tx' });
  });
  it('maps checklist records and confirmation numbers', () => {
    const m = mapEntry('record:acxiom', { id: 'acxiom', status: 'confirmed', confirmation: ' C-1 ', updatedAt: '2026-01-05T00:00:00Z' }, 'u');
    expect(m.row).toMatchObject({ kind: 'optout', status: 'confirmed', service_id: 'acxiom', legacy_key: 'record:acxiom' });
    expect(m.confirmation.confirmation_no).toBe('C-1');
    expect(mapEntry('settings:profile', {}, 'u').skip).toBeTruthy();
  });
});
