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
            <p className="hero-sub">Let's get you started.</p>
            <p className="lede">
              DROP Texas gives you more control over your data. You can demand data brokers delete your personal information and not sell it.
            </p>
            <p className="lede note">
              If you live in Texas, check the box. That means the Texas Data Privacy and Security Act
              (TDPSA). If you live somewhere else, you can still submit. An unchecked box still uses
              TDPSA for now, and the request is marked non-Texas.
            </p>
            <AppLink className="cta" href={getStartedHref}>
              Start Removing Me
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
            We collect only your name, address, email, and Texas residency so we can send opt-out requests
            for you. We never sell your data.
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
          Start Removing Me
        </AppLink>
      </section>
    </>
  );
}
