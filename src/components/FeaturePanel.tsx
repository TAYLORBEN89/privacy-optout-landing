import { TileIcon } from "./TopNav";
import { AppLink } from "../router";

const CARDS = [
  {
    id: "overview",
    tag: "Overview",
    headline: "Take back your privacy for free",
    description: "Ask brokers to stop selling your information at no cost.",
    button: "See the overview",
    href: "/overview",
  },
  {
    id: "how-drop-works",
    tag: "How it works",
    headline: "Save hours of paperwork",
    description: "We handle the broker forms so you don't have to.",
    button: "See how it works",
    href: "/how-it-works",
  },
  {
    id: "personal-information",
    tag: "Personal information",
    headline: "Share less to protect more",
    description: "We collect the minimum and never sell it.",
    button: "See what we ask",
    href: "/personal-information",
  },
  {
    id: "data-brokers",
    tag: "Data brokers",
    headline: "Fewer lists with your name on them",
    description: "Reach the companies that trade your address and phone.",
    button: "See the brokers",
    href: "/data-brokers",
  },
  {
    id: "unique-identifiers",
    tag: "Unique identifiers",
    headline: "Get matched correctly",
    description: "The right details help brokers find the right record.",
    button: "See the identifiers",
    href: "/unique-identifiers",
  },
  {
    id: "tdpsa",
    tag: "TDPSA",
    headline: "Know your rights work for you",
    description: "Texas law gives you the right to opt out of the sale of your data.",
    button: "Read about TDPSA",
    href: "/tdpsa",
  },
  {
    id: "children",
    tag: "Children",
    headline: "Protect your children's information",
    description: "Shield kids' personal information from web abuse and predators.",
    button: "Learn more",
    href: "/children",
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
