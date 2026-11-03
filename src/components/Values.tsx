import privacyArt from "../assets/values-icons/privacy.png";
import freeArt from "../assets/values-icons/free.png";
import needArt from "../assets/values-icons/need.png";
import honestArt from "../assets/values-icons/honest.png";
import independentArt from "../assets/values-icons/independent.png";
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
    body: "We collect just enough to fill in the requests you send: your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to provide it) your phone number. For a child request, a parent or guardian also provides the child's name, date of birth and, if different, address. Nothing more.",
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

const VALUE_ART: Record<(typeof VALUES)[number]["id"], string> = {
  privacy: privacyArt,
  free: freeArt,
  need: needArt,
  honest: honestArt,
  independent: independentArt,
};

function ValueIcon({ id }: { id: (typeof VALUES)[number]["id"] }) {
  return <img className="values-icon" src={VALUE_ART[id]} alt="" />;
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
