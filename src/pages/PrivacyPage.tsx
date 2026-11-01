import { DISCLAIMER } from "../copy";

/**
 * REVIEW: Cybersecurity and Compliance Agents must review this copy before launch.
 * Only claims that are true of this stack belong here. HSTS is not set in this
 * Worker, so it is omitted. Do not write "certified".
 */

const SECTIONS = [
  {
    title: "Data we collect",
    body: "The form asks only for your name, mailing address, email, and whether you live in Texas. The browser checks those fields, and the server checks them again.",
  },
  {
    title: "Encryption in transit",
    body: "Every page and API call is served over HTTPS with TLS through Cloudflare.",
  },
  {
    title: "Encryption at rest",
    body: "Information that is saved is stored in Cloudflare D1 and Workers KV. Cloudflare encrypts those stores at rest.",
  },
  {
    title: "Secure sign-in",
    body: "You sign in with Google or Microsoft at accounts.droptexas.com. The session cookie is HttpOnly and uses the __Host- prefix. Changes send a CSRF token. Exporting your data or deleting your account asks you to confirm it is you first.",
  },
  {
    title: "Your controls",
    body: "From your account you can export your data, delete your account, and sign out of other sessions.",
  },
  {
    title: "What we don't do",
    body: "We do not sell your data. This site does not load advertising trackers.",
  },
  {
    title: "Compliance",
    body: "DROP Texas is built to SOC 2 standards. That is not a certification.",
  },
] as const;

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
              <p>{section.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="independence">{DISCLAIMER}</p>
    </article>
  );
}
