import { NAV_ITEMS } from "../navItems";
import { AppLink } from "../router";

const BLURBS: Record<string, string> = {
  overview: "What DROP Texas is and how it helps you.",
  "how-drop-works": "The steps from signup to opt-out requests.",
  "personal-information": "What we collect and why.",
  "data-brokers": "The companies we send opt-out requests to.",
  "unique-identifiers": "Emails, phones, and IDs brokers track you by.",
  tdpsa: "Your rights under the Texas Data Privacy and Security Act.",
  help: "Answers to common questions.",
  share: "Tell a friend about DROP Texas.",
};

const ACCENTS: Record<string, string> = {
  overview: "#ee0014",
  "how-drop-works": "#056cb8",
  "personal-information": "#1c8a4a",
  "data-brokers": "#b8860b",
  "unique-identifiers": "#0d7a72",
  tdpsa: "#9f1239",
  help: "#3b6fd8",
  share: "#d4890b",
};

export function TileIcon({ id, size = 40 }: { id: string; size?: number }) {
  const common = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    className: `tile-icon icon-${id}`,
    style: { color: ACCENTS[id] ?? "#ee0014" },
  };
  if (id === "overview") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4.5V7M12 17v2.5M4.5 12H7M17 12h2.5" />
        <path d="m12 8 2.2 5.2L12 12.2 9.8 13.2 12 8z" />
      </svg>
    );
  }
  if (id === "how-drop-works") {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="2.2" />
        <circle cx="6" cy="12" r="2.2" />
        <circle cx="6" cy="18" r="2.2" />
        <path d="M11 6h8M11 12h8M11 18h6" />
      </svg>
    );
  }
  if (id === "personal-information") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="12" r="2" />
        <path d="M13 10.5h5M13 13.5h3.5" />
      </svg>
    );
  }
  if (id === "data-brokers") {
    return (
      <svg {...common}>
        <path d="M4 20V9l8-4 8 4v11" />
        <path d="M9 20v-6h6v6" />
        <path d="M9 11h.01M12 11h.01M15 11h.01" />
      </svg>
    );
  }
  if (id === "unique-identifiers") {
    return (
      <svg {...common}>
        <path d="M12 19c0-3 .2-5 .2-7a3.2 3.2 0 0 1 6.4 0" />
        <path d="M8.2 19c0-4.2.6-7.2 1.4-9.2a5.2 5.2 0 0 1 9.6 2.4" />
        <path d="M12 19V11.5" />
        <path d="M9.4 19c.2-2.4.6-4.2 1.2-5.6" />
      </svg>
    );
  }
  if (id === "tdpsa") {
    return (
      <svg {...common}>
        <path d="M12 3.2 19.5 6.4v5.4c0 4.4-3 7.6-7.5 9-4.5-1.4-7.5-4.6-7.5-9V6.4L12 3.2z" />
        <path d="M9 12.2 11 14.2 15.2 10" />
      </svg>
    );
  }
  if (id === "help") {
    return (
      <svg {...common}>
        <path d="M6 16.5 8.2 14H17a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h.2" />
        <path d="M9.2 8.6a2.6 2.6 0 1 1 3.4 2.5c-.7.3-1.1.8-1.1 1.5V13" />
        <path d="M12.2 15.2h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M10 14H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
      <path d="M12 12.5 19 5.5M15 5.5h4v4" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg className="tile-chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TopNav() {
  return (
    <nav className="top-nav" aria-label="On this site">
      <div className="nav-panel">
        <ul className="nav-tiles">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <AppLink href={item.href}>
                <TileIcon id={item.id} />
                <span className="tile-copy">
                  <span className="tile-title">{item.label}</span>
                  <span className="tile-blurb">{BLURBS[item.id]}</span>
                </span>
                <Chevron />
              </AppLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
