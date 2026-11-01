import { NAV_ITEMS } from "../navItems";
import { AppLink } from "../router";

function TileIcon({ id }: { id: string }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (id === "overview") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (id === "how-drop-works") {
    return (
      <svg {...common}>
        <path d="M5 7h14M5 12h14M5 17h9" />
      </svg>
    );
  }
  if (id === "personal-information") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3" />
        <path d="M6 19c1.2-3 3.4-4.5 6-4.5S16.8 16 18 19" />
      </svg>
    );
  }
  if (id === "data-brokers") {
    return (
      <svg {...common}>
        <path d="M4 20V9l5-3 5 3v11" />
        <path d="M14 20V11l5-2v11" />
        <path d="M7 13h2M7 16h2" />
      </svg>
    );
  }
  if (id === "unique-identifiers") {
    return (
      <svg {...common}>
        <circle cx="8" cy="12" r="3" />
        <path d="M11 12h9l-2 2M16 12l2-2" />
      </svg>
    );
  }
  if (id === "tdpsa") {
    return (
      <svg {...common}>
        <path d="M12 3.5 19 6.5v5.2c0 4.2-2.8 7.2-7 8.8-4.2-1.6-7-4.6-7-8.8V6.5L12 3.5z" />
      </svg>
    );
  }
  if (id === "help") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.9-1.2 1.6V14" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="7" cy="12" r="2.2" />
      <circle cx="16" cy="7.5" r="2.2" />
      <circle cx="16" cy="16.5" r="2.2" />
      <path d="M9 11.2 14 8.4M9 12.8l5 2.6" />
    </svg>
  );
}

const BLURBS: Record<string, string> = {
  overview: "See what DROP Texas does",
  "how-drop-works": "Three steps, then you submit",
  "personal-information": "The details the form asks for",
  "data-brokers": "Who receives your opt-out",
  "unique-identifiers": "How a broker matches you",
  tdpsa: "The Texas privacy law",
  help: "Answers before you start",
  share: "Pass this service along",
};

function Chevron() {
  return (
    <svg className="tile-chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TopNav() {
  return (
    <nav className="top-nav" aria-label="On this site">
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
    </nav>
  );
}
