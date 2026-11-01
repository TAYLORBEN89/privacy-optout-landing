import protectedArt from "../assets/personal-protected.png";
import { FeaturePanel } from "../components/FeaturePanel";
import { TopNav } from "../components/TopNav";
import { BrokerMarquee } from "../components/Marquee";
import { RightsSection } from "../components/Rights";
import { ValuesSection } from "../components/Values";
import { Stats } from "../components/Stats";
import { AppLink } from "../router";
import { storageNotice } from "../../worker/storage";

export function HomePage({ getStartedHref }: { getStartedHref: string }) {
  return (
    <>
      <section id="overview" className="hero" aria-labelledby="page-title">
        <div className="hero-inner">
            <h1 id="page-title">Privacy is a right.</h1>
            <h2 className="hero-sub">Let's get you started.</h2>
            <p className="lede hero-line">
              <span className="hero-rule">DROP Texas is a free service that helps you </span>
              <span className="hero-rule">gain control of your data. </span>
              <span className="hero-rule">Your data. Your rules.</span>
            </p>
            <AppLink className="cta" href={getStartedHref}>
              Start my opt-out
            </AppLink>
        </div>
      </section>

      <section className="explore" aria-labelledby="explore-heading">
        <h2 id="explore-heading" className="explore-label">
          Explore DROP Texas
        </h2>
        <TopNav />
      </section>

      <FeaturePanel />

      {/* A real, permissioned quote can be added here later. Do not invent a testimonial. */}
      <section id="personal-information" className="yellow-band" aria-labelledby="personal-heading">
        <div className="personal-protect">
          <img className="personal-icon" src={protectedArt} alt="" />
          <p className="personal-kicker">Personal information</p>
          <h2 id="personal-heading">Your information, protected</h2>
          <p className="personal-sub">Only what we need. Nothing more.</p>
          <p className="personal-body">
            <span className="personal-line">Your information is encrypted in transit and never sold.</span>{" "}
            <span className="personal-line">We ask only for your name, date of birth, address,</span>{" "}
            <span className="personal-line">email, phone and Texas residency.</span>
          </p>
          <p className="personal-preview">{storageNotice()}</p>
          <AppLink className="cta" href="/privacy">
            How we protect it
          </AppLink>
        </div>
      </section>

      <BrokerMarquee />

      <RightsSection />

      <ValuesSection />

      <Stats />

      <section className="closing" aria-labelledby="closing-heading">
        <h2 id="closing-heading">Ready to take back your privacy?</h2>
        <p className="closing-sub">Let's get you started.</p>
        <AppLink className="cta" href={getStartedHref}>
          Start my opt-out
        </AppLink>
      </section>
    </>
  );
}
