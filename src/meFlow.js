// Decides what the account page shows after GET /api/me. Pure, so it is unit-tested (scripts/mfa-upgrade.test.mjs).
// A limited session that can verify (can_mfa_verify: TOTP enrolled, not a password pre-auth) is upgraded once
// through a protected probe (403 mfa_required -> prompt -> mfa/verify -> retry), then /api/me is read once more.
// At most one upgrade attempt: no recursion, no loop. Limited password sessions keep the TOTP-setup path.
export const canVerify = (u) => !!(u?.limited && u?.can_mfa_verify);

export async function resolveMe({ me, probe }) {
  let u = await me();
  if (canVerify(u)) {
    await probe(); // throws if cancelled or not upgraded
    u = await me();
    if (u.limited) return { user: u, stage: 'password' }; // still limited after one try: stop, do not retry
  }
  return { user: u, stage: u.limited ? 'enroll' : 'signed-in' };
}
