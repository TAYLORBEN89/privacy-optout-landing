// DRAFT — do not deploy. Mirrors security-page-draft.md; that file is the source of truth for wording.
// Reuses the landing site's classes (.block, .panel, .banner) and CSS vars from src/styles.css.
type Status = "live" | "rolling" | "planned";

function Badge({ s }: { s: Status }) {
  const label = { live: "Live", rolling: "Rolling out", planned: "Planned" }[s];
  const color = s === "live" ? "var(--blue)" : "var(--danger)";
  return (
    <span style={{ marginLeft: 8, padding: "2px 8px", border: `1px solid ${color}`, color, borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
      {label}
    </span>
  );
}

function Section({ id, title, status, children }: { id: string; title: string; status?: Status; children: React.ReactNode }) {
  return (
    <section className="block" aria-labelledby={id}>
      <div className="panel">
        <h2 id={id}>{title}{status && <Badge s={status} />}</h2>
        {children}
      </div>
    </section>
  );
}

export function SecurityPage() {
  return (
    <main>
      <p className="banner" role="note">
        Account security below is built but not yet in production. Items marked "Rolling out" aren't live yet.
      </p>
      <section className="hero" aria-labelledby="sec-title">
        <div className="hero-inner">
          <h1 id="sec-title">Security at DROP Texas</h1>
          <p className="lede">How we protect your data, with what's finished and what isn't. Last updated October 31, 2026.</p>
        </div>
      </section>

      <Section id="transport" title="Connections to the site" status="live">
        <ul>
          <li>HTTP is redirected to HTTPS via Cloudflare.</li>
          <li>TLS 1.2 or newer only.</li>
          <li>Cloudflare connects to our servers with certificate validation (Full strict).</li>
          <li>HSTS is not on yet.</li>
        </ul>
      </Section>

      <Section id="data" title="What we store, and how" status="rolling">
        <ul>
          <li>Passwords: salted PBKDF2-SHA256 hash only.</li>
          <li>Authenticator secret and request identifiers (name, addresses, phones, emails): AES-GCM encrypted.</li>
          <li>Session tokens and backup codes: stored only as hashes.</li>
          <li>Account email: plain text today; hashing at rest is planned.</li>
          <li>Server logs: time, method, path, status, errors. No bodies or personal data.</li>
        </ul>
        <p><strong>No analytics, advertising, or tracking scripts. We do not sell personal data, use it for targeted advertising, or profile you.</strong></p>
        <p>Known gap: the current app caches some identifiers in plain text in browser local storage. The new version removes this.</p>
        <p>Cloudflare encrypts D1 and KV at rest (<a href="https://developers.cloudflare.com/d1/reference/data-security/">Cloudflare docs</a>).</p>
      </Section>

      <Section id="signin" title="Signing in" status="rolling">
        <ul>
          <li>Required authenticator-app codes, QR setup, 10 one-time backup codes. Codes can't be replayed.</li>
          <li>Same error for every failed sign-in.</li>
          <li>HttpOnly, Secure, SameSite=Strict session cookie; 12h idle, 7 days max; rotated, with reuse detection.</li>
          <li>CSRF token and Origin check on every change.</li>
          <li>Sign-in options may change before launch.</li>
        </ul>
      </Section>

      <Section id="limits" title="Limits on abuse" status="rolling">
        <ul>
          <li>5 failed sign-ins per IP and account per 15 minutes.</li>
          <li>30 opt-out changes per hour per account.</li>
          <li>Per-account login limit across IPs: planned.</li>
        </ul>
      </Section>

      <Section id="retention" title="How long we keep things" status="rolling">
        <ul>
          <li>Request identifiers: 30 days after broker confirms, 90 days max.</li>
          <li>Finished opt-out records: 24 months. Texas TDPSA records: 3 years after final status.</li>
          <li>Audit log: 12 months. Server logs: Cloudflare default (3 days; 7 days from Dec 1, 2026).</li>
          <li>Inactive accounts: deleted after 24 months without sign-in, warning 30 days before.</li>
          <li>Backups: planned.</li>
        </ul>
      </Section>

      <Section id="audit" title="Audit log" status="rolling">
        <p>Append-only at the database level. Records user, action, target and time; IP and user-agent are planned. Only an approved scheduled job removes entries older than 12 months, and each run is logged.</p>
      </Section>

      <Section id="build" title="Building it safely">
        <ul>
          <li>Prepared statements only, with a check script; CI enforcement planned.</li>
          <li>Dependency scanning (npm audit, Dependabot): planned.</li>
          <li>Built to SOC 2 standards. Not audited, not certified.</li>
        </ul>
      </Section>

      <Section id="breach" title="If something goes wrong">
        <p>We notify affected people without unreasonable delay and within 60 days (Tex. Bus. &amp; Com. Code §521.053), the Texas Attorney General within 30 days if 250+ Texans are affected, and credit bureaus if more than 10,000 people are notified.</p>
      </Section>

      <Section id="disclosure" title="Reporting a security issue">
        <p>Email <a href="mailto:help@droptexas.com">help@droptexas.com</a>. Scope: droptexas.com and its API.</p>
        <ul>
          <li>Use only your own or test accounts; don't access others' data.</li>
          <li>No denial-of-service or social engineering.</li>
          <li>We acknowledge within 3 business days {/* PLACEHOLDER: Ben to confirm */}.</li>
          <li>Good-faith research under these rules is authorized; we won't pursue legal action.</li>
          <li>No bug bounty.</li>
        </ul>
      </Section>
    </main>
  );
}
