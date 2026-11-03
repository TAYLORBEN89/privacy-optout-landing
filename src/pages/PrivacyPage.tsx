import { ACCOUNTS_COMING_SOON, ACCOUNTS_COMING_SOON_TITLE, DISCLAIMER } from "../copy";

/**
 * REVIEW: Cybersecurity and Compliance Agents must review this copy before launch.
 * Only claims that are true of this stack belong here. HSTS is not set in this
 * Worker, so it is omitted. Do not write "certified".
 */

const COLLECTED =
  "your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to provide it) your phone number";

const SECTIONS: { id: string; title: string; paragraphs: string[] }[] = [
  {
    id: "collect",
    title: "Data we collect",
    paragraphs: [
      `The form asks for ${COLLECTED}. The browser checks those fields, and the server checks them again.`,
      "For a child request, a parent or guardian also provides the child's name, date of birth and, if different, address.",
      "If you provide a phone number, it is used only to find your records at data brokers and to fill in the opt-out, do-not-sell, and deletion requests sent to them. It is not used for marketing, calls, or texts, and it is not sold or shared except with the brokers as part of those requests.",
      "DROP Texas does not send requests for you today.",
      "We keep what you give us only as long as your requests need it. Email help@droptexas.com to have it deleted at any time.",
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
    id: "transit",
    title: "Encryption in transit",
    paragraphs: ["Every page and API call is served over HTTPS (TLS 1.2 or newer) through Cloudflare."],
  },
  {
    id: "rest",
    title: "Encryption at rest",
    paragraphs: ["Information that is saved is stored in Cloudflare Workers KV, which Cloudflare encrypts at rest. Planned, not live yet: moving storage to Cloudflare D1 and adding our own AES-GCM encryption of identifiers."],
  },
  {
    id: "coming-soon",
    title: ACCOUNTS_COMING_SOON_TITLE,
    paragraphs: [ACCOUNTS_COMING_SOON],
  },
  {
    id: "limits",
    title: "What we don't do",
    paragraphs: ["We do not sell your data. This site does not load advertising trackers."],
  },
  {
    id: "compliance",
    title: "Compliance",
    paragraphs: ["DROP Texas is built to SOC 2 standards. Not audited, not certified."],
  },
];

function SectionIcon({ id }: { id: string }) {
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
    "data-icon": id,
  };
  if (id === "collect") {
    return (
      <svg {...common}>
        <path d="M8 7h8M8 12h8M8 17h5" />
      </svg>
    );
  }
  if (id === "transit") {
    return (
      <svg {...common}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }
  if (id === "rest") {
    return (
      <svg {...common}>
        <ellipse cx="12" cy="7" rx="7" ry="3" />
        <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
        <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      </svg>
    );
  }
  if (id === "coming-soon") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </svg>
    );
  }
  if (id === "limits") {
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
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <SectionIcon id={section.id} />
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
