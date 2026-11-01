import { DISCLAIMER } from "../copy";

/**
 * REVIEW: Cybersecurity and Compliance Agents must review this copy before launch.
 * Only claims that are true of this stack belong here. HSTS is not set in this
 * Worker, so it is omitted. Do not write "certified".
 * Retention values come from the approved schedule in compliance/data-retention.md.
 */

const COLLECTED =
  "your name, mailing address, email, Texas residency, and (if you choose to provide it) your phone number";

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: "Data we collect",
    paragraphs: [
      `The form asks for ${COLLECTED}. The browser checks those fields, and the server checks them again.`,
      "If you provide a phone number, it is used only to match and locate your records in the opt-out, do-not-sell, and deletion requests you send to data brokers. DROP Texas does not send requests for you today. It is not used for marketing, calls, or texts, and it is not sold or shared except with the brokers you choose to send those requests to.",
    ],
  },
  {
    title: "Encryption in transit",
    paragraphs: ["Every page and API call is served over HTTPS with TLS through Cloudflare."],
  },
  {
    title: "Encryption at rest",
    paragraphs: ["Information that is saved is stored in Cloudflare Workers KV, which Cloudflare encrypts at rest. Planned, not live yet: moving storage to Cloudflare D1 and adding our own AES-GCM encryption of identifiers."],
  },
  {
    title: "Secure sign-in",
    paragraphs: ["Planned, not live yet: per-user accounts with Google or Microsoft sign-in at accounts.droptexas.com, TOTP two-factor sign-in, HttpOnly __Host- session cookies, CSRF protection, rate limiting, and a security audit log."],
  },
  {
    title: "Your controls",
    paragraphs: ["Planned, not live yet: exporting your data, deleting your account, signing out of other sessions, and a daily job that deletes data when its retention period ends."],
  },
  {
    title: "How long we keep things",
    paragraphs: [
      "Planned, not yet automated. This is the approved schedule; the daily job that enforces it is approved but not live yet.",
      "An account phone number is kept while your account is active and deleted with the account, either when you ask or after 24 months without a sign-in (with a warning email 30 days before). A phone number copied into a specific broker request is deleted 30 days after the broker confirms, and never kept more than 90 days.",
      "Other identifiers copied into a request (name, addresses, emails) are deleted 30 days after the broker confirms, and never kept more than 90 days.",
      "Finished opt-out records are kept 24 months. Texas request records are kept 3 years.",
      "Inactive accounts are deleted after 24 months without a sign-in, with a warning email 30 days before.",
      "The security audit log is kept 12 months and is append-only.",
      "Worker logs are kept for Cloudflare's default retention period and never include request bodies or personal information.",
    ],
  },
  {
    title: "What we don't do",
    paragraphs: ["We do not sell your data. This site does not load advertising trackers."],
  },
  {
    title: "Compliance",
    paragraphs: ["DROP Texas is built to SOC 2 standards. It is not audited and not certified."],
  },
];

function SectionIcon({ index }: { index: number }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 28,
    height: 28,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (index === 0) {
    return (
      <svg {...common}>
        <path d="M8 7h8M8 12h8M8 17h5" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg {...common}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }
  if (index === 2) {
    return (
      <svg {...common}>
        <ellipse cx="12" cy="7" rx="7" ry="3" />
        <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
        <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      </svg>
    );
  }
  if (index === 3) {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3" />
        <path d="M6 19c1.2-3.2 3.4-4.8 6-4.8s4.8 1.6 6 4.8" />
      </svg>
    );
  }
  if (index === 4) {
    return (
      <svg {...common}>
        <path d="M12 4v10" />
        <path d="m8 10 4 4 4-4" />
        <path d="M6 18h12" />
      </svg>
    );
  }
  if (index === 5) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M8 12h8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 3.5 19 6.5v5c0 4-2.7 6.8-7 8.5-4.3-1.7-7-4.5-7-8.5v-5L12 3.5z" />
    </svg>
  );
}

export function PrivacyPage() {
  return (
    <article className="panel privacy-page">
      <h1>Privacy & Security</h1>
      <ul className="privacy-list">
        {SECTIONS.map((section, index) => (
          <li key={section.title}>
            <SectionIcon index={index} />
            <div>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="independence">{DISCLAIMER}</p>
    </article>
  );
}
