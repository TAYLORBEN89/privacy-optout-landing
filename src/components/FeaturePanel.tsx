import { BenefitIcon } from "./BenefitIcon";
import { AppLink } from "../router";

const CARDS = [
  {
    id: "overview",
    tag: "Control",
    headline: "More control of your data",
    description: "Limit the information data brokers collect and sell about you.",
    button: "See how control works",
    href: "/benefits/control",
  },
  {
    id: "how-drop-works",
    tag: "Spam",
    headline: "Reduced spam and scams",
    description: "Fewer sold lists can mean fewer unwanted calls, texts, and emails.",
    button: "See how this helps",
    href: "/benefits/spam",
  },
  {
    id: "personal-information",
    tag: "Security",
    headline: "Greater security",
    description: "Less of your information in circulation can lower the risk of fraud.",
    button: "See the security benefit",
    href: "/benefits/security",
  },
  {
    id: "data-brokers",
    tag: "Time",
    headline: "Hours back from paperwork",
    description: "One form, instead of a separate opt-out at each broker.",
    button: "See the time you save",
    href: "/benefits/time",
  },
  {
    id: "unique-identifiers",
    tag: "Cost",
    headline: "Free to make the request",
    description: "DROP Texas does not charge you to send opt-out requests.",
    button: "See what is free",
    href: "/benefits/cost",
  },
  {
    id: "tdpsa",
    tag: "Texas law",
    headline: "A right you can use",
    description: "Texas law lets you opt out of the sale of your personal data.",
    button: "See the right",
    href: "/benefits/rights",
  },
  {
    id: "children",
    tag: "Children",
    headline: "Protection for your children",
    description: "A parent can ask brokers not to sell a child's information.",
    button: "See children's protection",
    href: "/benefits/children",
  },
] as const;

export function FeaturePanel() {
  return (
    <div className="feature-wrap">
      <div className="feature-panel">
        {CARDS.map((card) => (
          <article key={card.id} className={`feature-card feature-card-${card.id}`}>
            <span className="feature-tag">{card.tag}</span>
            <BenefitIcon id={card.id} />
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
