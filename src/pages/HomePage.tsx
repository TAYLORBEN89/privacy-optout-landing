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
          <svg className="personal-icon" viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
            <rect x="8" y="14" width="48" height="36" rx="6" fill="none" stroke="#056cb8" strokeWidth="2.4" />
            <circle cx="24" cy="30" r="6" fill="none" stroke="#ee0014" strokeWidth="2.4" />
            <path d="M14 44c1.6-5 5-7.5 10-7.5s8.4 2.5 10 7.5" fill="none" stroke="#ee0014" strokeWidth="2.4" strokeLinecap="round" />
            <rect x="36" y="26" width="14" height="12" rx="2" fill="none" stroke="#b8860b" strokeWidth="2.4" />
            <path d="M39 26v-3a4 4 0 0 1 8 0v3" fill="none" stroke="#b8860b" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <p className="personal-kicker">Personal information</p>
          <h2 id="personal-heading">Your information, protected</h2>
          <p className="personal-sub">Only what we need. Nothing more.</p>
          <p className="personal-body">
            We collect only what's needed. That's your name, date of birth, address, email, phone and Texas residency.
            Parents filing for a child also share the child's name, date of birth and address if it's different. Your
            information is encrypted in transit, and we never sell it.
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
        <AppLink className="cta" href={getStartedHref}>
          Start my opt-out
        </AppLink>
      </section>
    </>
  );
}
