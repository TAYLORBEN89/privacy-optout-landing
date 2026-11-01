import { AppLink } from "../router";

const VALUES = [
  {
    id: "privacy",
    title: "Privacy is a right",
    body: "Your personal information belongs to you. We built DROP Texas so any Texan can tell data brokers to delete it and stop selling it.",
  },
  {
    id: "free",
    title: "Free for Texans",
    body: "No fees, no upsells, no premium tier. Asking for your privacy shouldn't cost money.",
  },
  {
    id: "need",
    title: "Only what we need",
    body: "We collect just enough to send your requests: your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to provide it) your phone number. Nothing more.",
  },
  {
    id: "honest",
    title: "Honest about results",
    body: "We show where each request stands (Submitted, Pending, Confirmed, or No record found) and never claim a deletion we can't verify.",
  },
  {
    id: "independent",
    title: "Independent",
    body: "DROP Texas is run by a private enterprise. It is not a government website and is not affiliated with the State of Texas or the Texas Attorney General.",
  },
] as const;

function ValueIcon({ id }: { id: (typeof VALUES)[number]["id"] }) {
  if (id === "privacy") {
    return (
      <svg className="values-icon" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <circle cx="34" cy="14" r="8" fill="#ffe7a3" />
        <path d="M24 7.5 36.5 12v11.5c0 8.2-5.4 13.6-12.5 16.5C16.9 37.1 11.5 31.7 11.5 23.5V12L24 7.5z" fill="#fff" stroke="#010101" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M24 16.5 31 19v6.2c0 4.2-3 7-7 8.6-4-1.6-7-4.4-7-8.6V19l7-2.5z" fill="#f8d0d4" />
        <path d="M19.2 25.2 22.6 28.5 29.2 21.4" fill="none" stroke="#ee0014" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "free") {
    return (
      <svg className="values-icon" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <circle cx="15" cy="33" r="8" fill="#ffe7a3" />
        <path d="M18.2 28.5V16.2a2.1 2.1 0 0 1 4.2 0V27" fill="none" stroke="#010101" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M22.4 26.2V14a2.1 2.1 0 0 1 4.2 0V27" fill="none" stroke="#010101" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M26.6 26.4V15.2a2.1 2.1 0 0 1 4.2 0V28" fill="none" stroke="#010101" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M30.8 27.4V18.4a2.1 2.1 0 0 1 4.2 0V31c0 5.6-3.8 9.6-9.6 9.6h-3.4c-5 0-8.2-3-8.2-7.6v-4.6a2.1 2.1 0 0 1 4.2 0" fill="#fff" stroke="#010101" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "need") {
    return (
      <svg className="values-icon" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <circle cx="34" cy="16" r="8" fill="#ffe7a3" />
        <rect x="12" y="22" width="22" height="16" rx="3" fill="#f8d0d4" stroke="#010101" strokeWidth="1.8" />
        <path d="M17 22v-4.2a6 6 0 0 1 12 0V22" fill="none" stroke="#010101" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="23" cy="29.5" r="1.7" fill="#ee0014" />
        <path d="M23 31.2v3" stroke="#ee0014" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "honest") {
    return (
      <svg className="values-icon" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <rect x="12" y="8" width="24" height="32" rx="3" fill="#fff6dc" stroke="#010101" strokeWidth="1.8" />
        <path d="M18 18.5 20.2 20.8 24.5 16" fill="none" stroke="#ee0014" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 26.5 20.2 28.8 24.5 24" fill="none" stroke="#ee0014" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 34.5 20.2 36.8 24.5 32" fill="none" stroke="#ee0014" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M27 18.5h5M27 26.5h5M27 34.5h5" fill="none" stroke="#010101" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="values-icon" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <circle cx="33" cy="14" r="7" fill="#ffe7a3" />
      <circle cx="22" cy="15" r="6" fill="#f8d0d4" stroke="#010101" strokeWidth="1.8" />
      <path d="M10.5 38.5c1.2-7 5.2-10.5 11.5-10.5s10.3 3.5 11.5 10.5" fill="#fff" stroke="#010101" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M29 31.5c3.2-.8 6.2.6 8 4.2" fill="none" stroke="#010101" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MosaicIcon({ kind }: { kind: "lock" | "shield" | "print" }) {
  if (kind === "lock") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="#5c534c" strokeWidth="1.6" />
        <path d="M8 11V8.2a4 4 0 0 1 8 0V11" fill="none" stroke="#5c534c" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "shield") {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M12 3.5 19 6.2v6.2c0 4.2-2.8 7-7 8.6-4.2-1.6-7-4.4-7-8.6V6.2L12 3.5z" fill="none" stroke="#5c534c" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 4.5c2 2.2 3 4.2 3 6.2a3 3 0 0 1-6 0c0-2 1-4 3-6.2z" fill="none" stroke="#5c534c" strokeWidth="1.6" />
      <path d="M12 7.2c1.1 1.2 1.6 2.2 1.6 3.3a1.6 1.6 0 0 1-3.2 0c0-1.1.5-2.1 1.6-3.3z" fill="none" stroke="#ee0014" strokeWidth="1.4" />
      <path d="M6.5 14.5c1.6 1 3.4 1.5 5.5 1.5s3.9-.5 5.5-1.5M7.5 17.6c1.4.7 2.9 1 4.5 1s3.1-.3 4.5-1M9 20.2c.9.4 1.9.6 3 .6s2.1-.2 3-.6" fill="none" stroke="#5c534c" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const TILES: { tone: string; icon?: "lock" | "shield" | "print" }[] = [
  { tone: "gray" },
  { tone: "mist" },
  { tone: "yellow-soft" },
  { tone: "gray" },
  { tone: "red-soft", icon: "lock" },
  { tone: "mist" },
  { tone: "yellow" },
  { tone: "gray" },
  { tone: "weave" },
  { tone: "red-soft", icon: "shield" },
  { tone: "gray" },
  { tone: "yellow-soft" },
  { tone: "mist" },
  { tone: "gray", icon: "print" },
  { tone: "yellow" },
  { tone: "gray" },
  { tone: "red" },
  { tone: "mist" },
  { tone: "yellow-soft" },
  { tone: "weave" },
  { tone: "gray", icon: "lock" },
  { tone: "mist" },
  { tone: "yellow" },
  { tone: "gray" },
];

export function ValuesSection() {
  return (
    <section className="values" aria-labelledby="values-heading">
      {/* Abstract mosaic only. No photographs of people. */}
      <div className="values-mosaic" aria-hidden="true">
        {TILES.map((tile, index) => (
          <div className="values-tile" data-tone={tile.tone} key={index}>
            {tile.icon ? <MosaicIcon kind={tile.icon} /> : null}
          </div>
        ))}
      </div>
      <div className="values-card">
        <p className="values-kicker">About us</p>
        <h2 id="values-heading">The values that drive DROP Texas</h2>
        <ul className="values-list">
          {VALUES.map((value) => (
            <li key={value.id}>
              <ValueIcon id={value.id} />
              <div>
                <h3>{value.title}</h3>
                <p>{value.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <AppLink className="values-more" href="/about">
          More about us &gt;
        </AppLink>
      </div>
    </section>
  );
}
