import { DISCLAIMER } from "../copy";

/**
 * REVIEW: Cybersecurity and Compliance Agents must review this copy before launch.
 * Only claims that are true of this stack belong here. HSTS is not set in this
 * Worker, so it is omitted. Do not write "certified".
 * TODO(retention): no concrete retention period is stated for form fields.
 * Phone follows that same sentence. Do not invent a number of days.
 */

const COLLECTED =
  "your name, mailing address, email, Texas residency, and (if you choose to provide it) your phone number";

const SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: "Data we collect",
    paragraphs: [
      `The form asks for ${COLLECTED}. The browser checks those fields, and the server checks them again.`,
      "If you provide a phone number, it is used only to match and locate your records to find your records at data brokers and to fill in the opt-out, do-not-sell, and deletion requests sent to them. It is not used for marketing, calls, or texts, and it is not sold or shared except with the brokers as part of those requests.",
      "We keep it only as long as your requests need it. Email help@droptexas.com to have it deleted at any time.",
    ],
  },
  {
    title: "Encryption in transit",
    paragraphs: ["Every page and API call is served over HTTPS (TLS 1.2 or newer) through Cloudflare."],
  },
  {
    title: "Encryption at rest",
    paragraphs: ["Saved information is stored in Cloudflare D1 and Workers KV, which Cloudflare encrypts at rest (AES-256)."],
  },
  {
    title: "Coming soon",
    paragraphs: ["Sign in with Google or Microsoft, secure session cookies, and self-service export and delete. Until then, email help@droptexas.com to see or delete your data."],
  },
  {
    title: "What we don't do",
    paragraphs: ["We do not sell your data. This site does not load advertising trackers."],
  },
  {
    title: "Compliance",
    paragraphs: ["DROP Texas is built to SOC 2 standards. Not audited, not certified."],
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
