# DROP Texas — Incident Response Plan (one page, DRAFT)

**Plain statement:** The operator is the **only responder**. There is **no backup contact** and **no lawyer**. No phone number is listed yet. If the operator is unavailable, incidents wait until they return.

**Roles:** The operator handles everything: incident lead, technical fixes, communications, legal notifications.
**Primary contact: email** help@droptexas.com (not published until help@droptexas.com is set up as an iCloud Mail custom-domain address and a test message is received). No phone number is listed.
**Security reports:** researchers email help@droptexas.com with "Security" in the subject; acknowledge within **3 business days** (confirmed by Ben 2026-10-31), then triage with the severity levels below.
External: Cloudflare support (dashboard) and the Texas AG Data Breach Report form (texasattorneygeneral.gov/consumer-protection/data-breach-reporting).

**Severity**
- **SEV1:** confirmed unauthorized access to user data (identifiers, account emails, TOTP secrets) or to `TOTP_ENC_KEY`, `API_TOKEN`, or Cloudflare/GitHub credentials.
- **SEV2:** suspected exposure (secret pushed to the public repo, unexplained D1/KV writes, audit-log anomalies), or an outage over 24 h.
- **SEV3:** vulnerability with no sign of exploitation; minor outage.

**Steps**
1. **Detect:** sources are Cloudflare Workers Logs (kept only 3–7 days, so export what you need to the incident note right away), audit_log (`session.reuse_detected`, `totp.fail` spikes), GitHub secret-scanning alerts, and user or researcher reports. Start an incident note with the time and the facts.
2. **Contain:** rotate secrets (`wrangler secret put`), revoke all sessions, disable the route or put Cloudflare Access in front, revoke leaked tokens, and purge any secret from public repo history.
3. **Eradicate:** fix the root cause in an expedited PR and check the Cloudflare and GitHub audit logs.
4. **Recover:** redeploy reviewed code, restore from backup if needed, and verify.
5. **Notify** (Tex. Bus. & Com. Code §521.053, checked 2026-10-31):
   - Affected individuals: without unreasonable delay, within **60 days** of determining a breach.
   - **Texas AG within 30 days** if **250 or more Texans** are affected, via the AG's online form.
   - If more than 10,000 people are notified, also tell the nationwide credit bureaus.
   - There is no lawyer to advise; the operator follows the statute text and the AG's published guidance.
6. **Review:** written post-mortem within 14 days; actions go into the change log and roadmap.

**Contact tree:** Operator → Cloudflare support → affected users / Texas AG as required. There is no backup step. Run a tabletop exercise every 6 months.
