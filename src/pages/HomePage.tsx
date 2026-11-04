import protectedArt from "../assets/personal-protected.png";
import { FeaturePanel } from "../components/FeaturePanel";
import { TopNav } from "../components/TopNav";
import { BrokerMarquee } from "../components/Marquee";
import { RightsSection } from "../components/Rights";
import { ValuesSection } from "../components/Values";
import { Stats } from "../components/Stats";
import { AppLink } from "../router";
import hero1280Jpg from "../assets/hero/hero-photo-1280.jpg";
import hero1280Webp from "../assets/hero/hero-photo-1280.webp";
import hero1744Jpg from "../assets/hero/hero-photo-1744.jpg";
import hero1744Webp from "../assets/hero/hero-photo-1744.webp";
import heroLeftJpg from "../assets/hero/hero-photo-left-640.jpg";
import heroLeftWebp from "../assets/hero/hero-photo-left-640.webp";
import { storageNotice } from "../../worker/storage";

export function HomePage({ getStartedHref }: { getStartedHref: string }) {
  return (
    <>
      <section id="overview" className="hero hero--hills" aria-labelledby="page-title">
        <picture className="hero-bg" aria-hidden="true">
          <source media="(max-width: 640px)" type="image/webp" srcSet={`${heroLeftWebp} 640w`} sizes="100vw" />
          <source media="(max-width: 640px)" type="image/jpeg" srcSet={`${heroLeftJpg} 640w`} sizes="100vw" />
          <source type="image/webp" srcSet={`${hero1280Webp} 1280w, ${hero1744Webp} 1744w`} sizes="100vw" />
          <img
            src={hero1744Jpg}
            srcSet={`${hero1280Jpg} 1280w, ${hero1744Jpg} 1744w`}
            sizes="100vw"
            width={1744}
            height={1136}
            alt=""
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </picture>
        <div className="hero-inner">
            <h1 id="page-title">Texas data broker opt-out</h1>
            <h2 className="hero-sub">Let's get you started.</h2>
            <p className="hero-focus">DROP Texas is a free Texas data broker opt-out for Texans.</p>
            <p className="lede hero-line">
              <span className="hero-rule">DROP Texas is a free service that helps you </span>
              <span className="hero-rule">gain control of your data. </span>
              <span className="hero-rule">Your data. Your rules.</span>
            </p>
            <AppLink className="cta" href={getStartedHref}>
              Start my opt-out
            </AppLink>
            <p className="hero-secondary">
              <AppLink className="hero-proposal-link" href="/texas-proposal">
                Read the Texas Proposal
              </AppLink>
            </p>
        </div>
      </section>

      <section className="explore" aria-labelledby="explore-heading">
        <h2 id="explore-heading" className="explore-label">
          Explore the Texas data broker opt-out
        </h2>
        <TopNav />
      </section>

      <FeaturePanel />

      {/* A real, permissioned quote can be added here later. Do not invent a testimonial. */}
      <section id="personal-information" className="yellow-band" aria-labelledby="personal-heading">
        <div className="personal-protect">
          <img className="personal-icon" src={protectedArt} alt="A person icon with a padlock for the Texas data broker opt-out" />
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
        <p>
          This Texas data broker opt-out is free. The Texas data broker opt-out does not check that a
          broker deleted a record.
        </p>
        <AppLink className="cta" href={getStartedHref}>
          Start my opt-out
        </AppLink>
      </section>
    </>
  );
}
