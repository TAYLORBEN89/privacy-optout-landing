import keyArt from "../assets/benefit-icons/key.png";
import mailArt from "../assets/benefit-icons/mail.png";
import shieldArt from "../assets/benefit-icons/shield.png";
import clockArt from "../assets/benefit-icons/clock.png";
import tagArt from "../assets/benefit-icons/tag.png";
import scalesArt from "../assets/benefit-icons/scales.png";
import houseArt from "../assets/benefit-icons/house.png";
import { AppLink } from "../router";

const ART: Record<string, string> = {
  overview: keyArt,
  "how-drop-works": mailArt,
  "personal-information": shieldArt,
  "data-brokers": clockArt,
  "unique-identifiers": tagArt,
  tdpsa: scalesArt,
  children: houseArt,
};

const CARDS = [
  {
    id: "overview",
    tag: "Control",
    headline: "More control of your data",
    description:
      "Using DROP helps you limit what data brokers collect and sell about you. A profile may include contact details and people in your household.",
    button: "See how control works",
    href: "/benefits/control",
  },
  {
    id: "how-drop-works",
    tag: "Spam",
    headline: "Reduced spam and scams",
    description:
      "Limiting how your data gets sold can reduce unwanted texts, calls, and emails. Results vary by person and can take time to notice a change.",
    button: "See how this helps",
    href: "/benefits/spam",
  },
  {
    id: "personal-information",
    tag: "Security",
    headline: "Greater security",
    description:
      "Less of your information in circulation can lower the risk of identity theft and targeted fraud. This does not freeze your credit or stop every scam.",
    button: "See the security benefit",
    href: "/benefits/security",
  },
  {
    id: "data-brokers",
    tag: "Time",
    headline: "Hours back from paperwork",
    description:
      "Each broker has its own opt-out form. DROP Texas sends those requests from the one form you fill out, so you are not repeating yourself.",
    button: "See the time you save",
    href: "/benefits/time",
  },
  {
    id: "unique-identifiers",
    tag: "Cost",
    headline: "Free to make the request",
    description:
      "DROP Texas does not charge a fee to send opt-out requests. You can also ask each broker yourself. There is no subscription for the ask.",
    button: "See what is free",
    href: "/benefits/cost",
  },
  {
    id: "tdpsa",
    tag: "Texas law",
    headline: "A right you can use",
    description:
      "Texas law lets you opt out of the sale of your personal data. DROP Texas sends that request. Each broker still decides how it responds to you.",
    button: "See the right",
    href: "/benefits/rights",
  },
  {
    id: "children",
    tag: "Children",
    headline: "Protection for your children",
    description:
      "A parent or guardian can ask brokers not to sell a child's information. DROP Texas sends that request at no cost for any child under 13.",
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
            <img className="benefit-art" src={ART[card.id]} alt="" />
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
