// Personal details used in TDPSA request emails. Edit here if anything changes.
// The profile (name, aliases, addresses, phones, emails) is NOT in this bundle or in browser storage. It lives
// server-side at GET/PUT /profile (signed-in session, encrypted in D1) and is edited in the "Your identifiers" panel.
export const EMPTY_PROFILE = { id: 'profile', name: '', aliases: [], addresses: [], phones: [], emails: [], replyTo: '' };

export const RESPONSE_DAYS = 45; // Tex. Bus. & Com. Code § 541.052: respond within 45 days (one 45-day extension allowed with notice)
export const AG_COMPLAINT_URL = 'https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/texas-data-privacy-and-security-act';

export function buildEmail(broker, PROFILE) {
  const subject = `Texas Data Privacy and Security Act request: deletion and opt-out – ${PROFILE.name}`;
  const body = `To the privacy team at ${broker.name}:

I am a Texas resident. Under the Texas Data Privacy and Security Act (Tex. Bus. & Com. Code ch. 541), I request that you:

1. Delete all personal data you hold about me (§ 541.051(b)(3)), and instruct any processors and third parties you shared it with to do the same.
2. Opt me out of the sale of my personal data, targeted advertising, and profiling (§ 541.051(b)(5)).
3. Confirm whether you process my personal data and, if so, which categories and sources (§ 541.051(b)(1)).

Identifying information (use only to locate and act on my records):
Name: ${PROFILE.name}${PROFILE.aliases.length ? '\nAlso known as: ' + PROFILE.aliases.join(', ') : ''}
Current and past addresses:
${PROFILE.addresses.map((a) => '  - ' + a).join('\n')}
Phone numbers: ${PROFILE.phones.join(', ')}
Email addresses: ${PROFILE.emails.join(', ')}

Please respond within 45 days as required by § 541.052. If you decline any part of this request, please explain why and tell me how to appeal (§ 541.053). Please do not add this information to your records for any other purpose.

Reply to: ${PROFILE.replyTo || PROFILE.emails[0] || ''}

Thank you,
${PROFILE.name}`;
  return { subject, body };
}
