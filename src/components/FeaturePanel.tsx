import { TileIcon } from "./TopNav";
import { AppLink } from "../router";

const CARDS = [
  {
    id: "overview",
    tag: "Overview",
    headline: "What DROP Texas is",
    description: "A short look at the service and the statuses you may see later.",
    button: "See the overview",
    href: "/overview",
  },
  {
    id: "how-drop-works",
    tag: "How it works",
    headline: "Three steps to opt out",
    description: "Sign up, confirm your details, and we send opt-out requests to data brokers for you.",
    button: "See how it works",
    href: "/how-it-works",
  },
  {
    id: "personal-information",
    tag: "Personal information",
    headline: "Only what the form needs",
    description:
      "We ask for your name (including an optional middle name), mailing address, email, Texas residency, and (if you choose to provide it) your phone number. We do not sell those details.",
    button: "See what we ask",
    href: "/personal-information",
  },
  {
    id: "data-brokers",
    tag: "Data brokers",
    headline: "Requests go to named brokers",
    description:
      "Opt-out requests can go to Acxiom, Experian, Equifax, TransUnion, Spokeo, Whitepages, and others named on this page.",
    button: "See the brokers",
    href: "/data-brokers",
  },
  {
    id: "unique-identifiers",
    tag: "Unique identifiers",
    headline: "How a record is matched",
    description:
      "Brokers often use an email, a phone number, or another ID. This form uses your name (including an optional middle name), mailing address, email, Texas residency, and (if you choose to provide it) your phone number.",
    button: "See the identifiers",
    href: "/unique-identifiers",
  },
  {
    id: "tdpsa",
    tag: "TDPSA",
    headline: "A Texas privacy law",
    description:
      "The Texas box means the Texas Data Privacy and Security Act. An unchecked box still uses TDPSA for now and is marked non-Texas.",
    button: "Read about TDPSA",
    href: "/tdpsa",
  },
] as const;

export function FeaturePanel() {
  return (
    <div className="feature-wrap">
      <div className="feature-panel">
        {CARDS.map((card) => (
          <article key={card.id} className={`feature-card feature-card-${card.id}`}>
            <span className="feature-tag">{card.tag}</span>
            <TileIcon id={card.id} size={48} />
            <h3>{card.headline}</h3>
            <p>{card.description}</p>
            <AppLink className="feature-btn" href={card.href}>
              {card.button} &gt;
            </AppLink>
          </article>
        ))}
      </div>
    </div>
  );
}
