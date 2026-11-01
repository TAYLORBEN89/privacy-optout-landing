import { FeaturePanel } from "../components/FeaturePanel";
import { TopNav } from "../components/TopNav";
import { PeopleArt } from "../components/Illustrations";
import { BrokerMarquee } from "../components/Marquee";
import { Reveal } from "../components/Reveal";
import { Stats } from "../components/Stats";
import { AppLink } from "../router";
import { buildStats } from "../data/stats";
import { storageNotice } from "../../worker/storage";

export function HomePage({ getStartedHref }: { getStartedHref: string }) {
  return (
    <>
      <section id="overview" className="hero" aria-labelledby="page-title">
        <div className="hero-inner">
            <h1 id="page-title">
              <span>Demanding privacy</span>
              <span>for the people</span>
              <span>by the people</span>
            </h1>
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

      <section id="how-drop-works" className="block" aria-labelledby="how-heading">
        <Reveal>
          <div className="panel nest">
            <h2 id="how-heading">How DROP Works</h2>
            <p>Three steps. You can stop at any time before you submit.</p>
            <div className="inner-card">
              <ol className="steps">
                <li>
                  <h3>
                    <span className="step-label">Step 1</span>
                    Say whether you live in Texas
                  </h3>
                  <p>Checked means TDPSA. Unchecked still uses TDPSA for now and is marked non-Texas.</p>
                </li>
                <li>
                  <h3>
                    <span className="step-label">Step 2</span>
                    Enter your name, mailing address, and email
                  </h3>
                  <p>Most broker opt-out forms require a physical address.</p>
                </li>
                <li>
                  <h3>
                    <span className="step-label">Step 3</span>
                    Submit the form
                  </h3>
                  <p>{storageNotice()}</p>
                </li>
              </ol>
            </div>
            <AppLink className="cta" href={getStartedHref}>
              Start Removing Me
            </AppLink>
          </div>
        </Reveal>
      </section>

      <Stats stats={buildStats()} />

      <section id="data-brokers" className="block" aria-labelledby="brokers-heading">
        <Reveal>
          <div className="panel nest">
            <h2 id="brokers-heading">Data Brokers</h2>
            <div className="inner-card">
              <p>
                An opt-out request asks a data broker not to sell your personal information. DROP Texas
                does not check that a broker deleted a record.
              </p>
              <p>
                If a status is shown later, it is one of Submitted, Confirmed, Pending, Not completed, or
                No record found.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <section id="unique-identifiers" className="block" aria-labelledby="ids-heading">
        <Reveal>
          <div className="panel">
            <h2 id="ids-heading">Unique Identifiers</h2>
            <p>
              Some brokers match people with extra identifiers. This form does not ask for device IDs,
              account passwords, or government ID numbers. Your name, mailing address, and email are
              the details the request uses.
            </p>
          </div>
        </Reveal>
      </section>

      <section id="tdpsa" className="block" aria-labelledby="tdpsa-heading">
        <Reveal>
          <div className="panel">
            <h2 id="tdpsa-heading">TDPSA</h2>
            <p>
              DROP Texas is a private service. The Texas box records the Texas Data Privacy and
              Security Act (TDPSA). An unchecked box still uses TDPSA for now and is marked
              non-Texas. No government agency reviews this form.
            </p>
          </div>
        </Reveal>
      </section>

      <section id="help" className="block" aria-labelledby="help-heading">
        <Reveal>
          <div className="panel">
            <h2 id="help-heading">Help with DROP</h2>
            <p>
              Choose Start Removing Me, sign in if asked, then send your name, mailing address, and
              email. You should see confirmation received. {storageNotice()} The page needs JavaScript
              to show the form.
            </p>
          </div>
        </Reveal>
      </section>

      <section id="share" className="block" aria-labelledby="share-heading">
        <Reveal>
          <div className="panel">
            <h2 id="share-heading">Share DROP</h2>
            <p>You can share this private service at https://droptexas.com.</p>
          </div>
        </Reveal>
      </section>

      <section className="more-about" aria-labelledby="more-heading">
        <Reveal>
          <div className="more-card">
            <PeopleArt />
            <div>
              <h2 id="more-heading">More about us</h2>
              <p>DROP Texas is an independent opt-out service. Read a short note on who runs it.</p>
              <AppLink className="text-link" href="/about">
                More about DROP Texas
              </AppLink>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="closing" aria-labelledby="closing-heading">
        <h2 id="closing-heading">Ready to take back your privacy?</h2>
        <AppLink className="cta" href={getStartedHref}>
          Start Removing Me
        </AppLink>
      </section>
    </>
  );
}
