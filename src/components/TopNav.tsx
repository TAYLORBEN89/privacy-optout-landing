import overviewArt from "../assets/explore-icons/overview.png";
import howArt from "../assets/explore-icons/how.png";
import personalArt from "../assets/explore-icons/personal.png";
import brokersArt from "../assets/explore-icons/brokers.png";
import identifiersArt from "../assets/explore-icons/identifiers.png";
import tdpsaArt from "../assets/explore-icons/tdpsa.png";
import helpArt from "../assets/explore-icons/help.png";
import shareArt from "../assets/explore-icons/share.png";
import { NAV_ITEMS } from "../navItems";
import { AppLink } from "../router";

const BLURBS: Record<string, string> = {
  overview: "Ask brokers to stop selling your information. No fee to send it.",
  "how-drop-works": "Fill out one form. We send the opt-out requests to the brokers.",
  "personal-information": "We ask only for what a broker needs, and we never sell it.",
  "data-brokers": "One request goes to companies that trade your name and phone.",
  "unique-identifiers": "Your name, birth date, and address help match your record.",
  tdpsa: "Texas law gives you the right to opt out of the sale of your data.",
  help: "Answers on what we send, what we keep, and what we skip.",
  share: "Pass this page to a Texan who wants their data sold less often.",
};

const ART: Record<string, string> = {
  overview: overviewArt,
  "how-drop-works": howArt,
  "personal-information": personalArt,
  "data-brokers": brokersArt,
  "unique-identifiers": identifiersArt,
  tdpsa: tdpsaArt,
  help: helpArt,
  share: shareArt,
};

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
                <img className="explore-art" src={ART[item.id]} alt="" />
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
