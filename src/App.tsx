import { SignupForm } from "./SignupForm";
import { storageNotice } from "../worker/storage";

const DISCLAIMER =
  "Drop Texas is a private, free service. It is not affiliated with or endorsed by the State of California, CalPrivacy, or any government agency.";

function Wordmark() {
  return (
    <p className="brand">
      <svg className="mark" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#ee0014" />
        <rect x="7" y="8" width="8" height="16" rx="2" fill="#ffffff" />
        <circle cx="20" cy="16" r="6.5" fill="#ffffff" />
      </svg>
      <span>Drop Texas</span>
    </p>
  );
}

export function App() {
  return (
    <>
      <div className="top-stack">
        <p className="banner" role="note">
          Drop Texas is a private-sector service, not a government entity.
        </p>
        <header className="topbar">
          <div className="topbar-inner">
            <Wordmark />
          </div>
        </header>
      </div>
      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-inner">
            <h1 id="page-title">Privacy is a right. This service is free for Texans.</h1>
            <p className="lede">
              Drop Texas is a free way to send an opt-out request. If you live in Texas, check the
              box. That means the Texas Data Privacy and Security Act (TDPSA). If you live somewhere
              else, you can still submit. An unchecked box still uses TDPSA for now, and the request
              is marked non-Texas.
            </p>
            <a className="cta" href="#opt-out">
              Start Removing Me
            </a>
          </div>
        </section>

        <section className="block" aria-labelledby="who-heading">
          <div className="panel">
            <h2 id="who-heading">Who it's for</h2>
            <p>
              Use this if you want help sending an opt-out request. You say whether you live in
              Texas. This form is not reviewed by a government agency.
            </p>
            <ul>
              <li>If you live in Texas, check the box. A checked box means TDPSA.</li>
              <li>
                If you live somewhere else, leave the box unchecked. You can still submit. The
                request still uses TDPSA for now, and it is marked non-Texas.
              </li>
              <li>There is no fee to submit.</li>
            </ul>
          </div>
        </section>

        <section className="block" aria-labelledby="how-heading">
          <div className="panel">
            <h2 id="how-heading">How it works</h2>
            <p>Three steps. You can stop at any time before you submit.</p>
            <ol className="steps">
              <li>
                <h3>
                  <span className="step-label">Step 1</span>
                  Say whether you live in Texas
                </h3>
                <p>
                  Checked means TDPSA. Unchecked still uses TDPSA for now and is marked non-Texas.
                  This is not a state ID check.
                </p>
              </li>
              <li>
                <h3>
                  <span className="step-label">Step 2</span>
                  Enter your name, mailing address, and email
                </h3>
                <p>
                  Most broker opt-out forms require a physical address. You do not add account
                  passwords or government ID numbers.
                </p>
              </li>
              <li>
                <h3>
                  <span className="step-label">Step 3</span>
                  Submit the form
                </h3>
                <p>Start Removing Me takes you there. {storageNotice()}</p>
              </li>
            </ol>
            <a className="cta" href="#opt-out">
              Start Removing Me
            </a>
          </div>
        </section>

        <section className="block" aria-labelledby="info-heading">
          <div className="panel">
            <h2 id="info-heading">What happens to your information</h2>
            <p>
              The form asks only for your name, mailing address, email, and whether you live in
              Texas.
            </p>
            <ul>
              <li>Those details are meant to prepare an opt-out request and to record the TDPSA label.</li>
              <li>{storageNotice()} Nothing on this page is sent to a data broker.</li>
              <li>We do not sell the information you type here.</li>
            </ul>
            <p>
              If a request is sent later, the status words are Submitted, Confirmed, Pending, and
              No record found. Confirmed means confirmation received. It does not mean deletion was
              verified.
            </p>
          </div>
        </section>

        <section className="form-section" aria-labelledby="form-heading">
          <p className="note">{DISCLAIMER}</p>
          <SignupForm />
        </section>

        <section className="block" aria-labelledby="faq-heading">
          <div className="panel">
            <h2 id="faq-heading">Questions</h2>
            <div className="faq">
              <details>
                <summary>Is Drop Texas a government site?</summary>
                <p>No. Read the note at the top of this page.</p>
              </details>
              <details>
                <summary>Who can submit?</summary>
                <p>
                  Anyone can submit. Check the box if you live in Texas. Leave it unchecked if you
                  do not. Either way, the request uses TDPSA for now. Unchecked requests are marked
                  non-Texas.
                </p>
              </details>
              <details>
                <summary>Why do you ask if I live in Texas?</summary>
                <p>
                  A checked box means TDPSA. An unchecked box still uses TDPSA for now and is marked
                  non-Texas so a later version can support other states. No government agency
                  reviews this form.
                </p>
              </details>
              <details>
                <summary>What do you do with my name, address, and email?</summary>
                <p>
                  They are the details an opt-out request would use. {storageNotice()} We do not
                  sell the information you type here.
                </p>
              </details>
              <details>
                <summary>What does submit mean?</summary>
                <p>
                  You get confirmation received. {storageNotice()} Submit does not mean a data
                  broker deleted your information. Later statuses, if shown, are only Submitted,
                  Confirmed, Pending, or No record found.
                </p>
              </details>
              <details>
                <summary>Is this free?</summary>
                <p>Yes. There is no fee to submit.</p>
              </details>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <Wordmark />
          <p className="independence">{DISCLAIMER}</p>
          <a className="cta" href="#opt-out">
            Start Removing Me
          </a>
        </div>
      </footer>
    </>
  );
}
