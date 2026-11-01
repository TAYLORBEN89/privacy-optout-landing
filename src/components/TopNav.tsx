import { NAV_ITEMS } from "../navItems";
import { AppLink } from "../router";

const BLURBS: Record<string, string> = {
  overview: "No catch, no fees.",
  "how-drop-works": "One form, then we take it from there.",
  "personal-information": "Only what's needed. Never sold.",
  "data-brokers": "Major brokers, one request.",
  "unique-identifiers": "Matched to your record.",
  tdpsa: "Backed by Texas law.",
  help: "Answers to common questions.",
  share: "Pass it on to a fellow Texan.",
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
  children: "#6d28d9",
};

export function TileIcon({
  id,
  size = 40,
  strokeWidth = 2,
  explore = false,
}: {
  id: string;
  size?: number;
  strokeWidth?: number;
  explore?: boolean;
}) {
  const common = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
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
  if (id === "unique-identifiers" && explore) {
    return (
      <svg {...common}>
        <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
        <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
        <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
        <path d="M2 12a10 10 0 0 1 18-6" />
        <path d="M2 16h.01" />
        <path d="M21.8 16c.2-2 .131-5.354 0-6" />
        <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
        <path d="M8.65 22c.21-.66.45-1.32.57-2" />
        <path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2" />
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
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (id === "children") {
    return (
      <svg {...common}>
        <circle cx="12" cy="7.5" r="2.4" />
        <path d="M7.2 19.2v-.4a3.2 3.2 0 0 1 3.2-3.2h3.2a3.2 3.2 0 0 1 3.2 3.2v.4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98" />
      <path d="M15.41 6.51 8.59 10.49" />
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
                <TileIcon id={item.id} strokeWidth={1.5} explore />
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
