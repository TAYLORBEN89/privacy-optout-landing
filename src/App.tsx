import { SignupForm } from "./SignupForm";

const INDEPENDENCE_NOTE =
  "DROP Texas is an independent, free service. It is not affiliated with or endorsed by the State of Texas, the State of California, or the California Privacy Protection Agency.";

export function App() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <p className="brand">DROP Texas</p>
        </div>
      </header>
      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-inner">
            <h1 id="page-title">Privacy is a right. This service is free for Texans.</h1>
            <p className="lede">
              DROP Texas helps you ask data brokers to delete personal information they hold about
              you and to stop selling it. The service is free. If you live in Texas, that tells us
              which state privacy law applies. If you live somewhere else, you can still submit.
            </p>
            <p className="note">
              DROP Texas is an independent, free service. It is not a government website.
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
              Use this if you want help opting out. You tell us whether you live in Texas. We do
              not verify that with a state agency.
            </p>
            <ul>
              <li>If you live in Texas, check the box. We use that to decide which state privacy law applies.</li>
              <li>If you live somewhere else, leave the box unchecked. You can still submit.</li>
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
                <p>That answer is how we choose which state privacy law applies. It is not a state ID check.</p>
              </li>
              <li>
                <h3>
                  <span className="step-label">Step 2</span>
                  Enter your name, mailing address, and email
                </h3>
                <p>Those details are what a request needs so a data broker can look for you. You do not add account passwords or government ID numbers.</p>
              </li>
              <li>
                <h3>
                  <span className="step-label">Step 3</span>
                  Submit the form
                </h3>
                <p>
                  Start Removing Me takes you there. This preview checks the form and does not store
                  what you enter.
                </p>
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
            <p>The form asks only for your name, mailing address, email, and whether you live in Texas.</p>
            <ul>
              <li>Those details are meant to prepare an opt-out and to choose which state privacy law applies.</li>
              <li>This preview does not save them. Nothing on this page is sent to a data broker.</li>
              <li>We do not sell the information you type here.</li>
            </ul>
            <p>
              Later, if requests are saved and sent, each data broker decides what it can delete.
              Some may not have a record for you. Some may be allowed to keep information. This
              service cannot promise a particular result.
            </p>
          </div>
        </section>

        <section className="form-section" aria-labelledby="form-heading">
          <p className="note">{INDEPENDENCE_NOTE}</p>
          <SignupForm />
        </section>

        <section className="block" aria-labelledby="faq-heading">
          <div className="panel">
            <h2 id="faq-heading">Questions</h2>
            <div className="faq">
              <details>
                <summary>Is DROP Texas a government site?</summary>
                <p>{INDEPENDENCE_NOTE}</p>
              </details>
              <details>
                <summary>Who can submit?</summary>
                <p>
                  Anyone can submit. If you live in Texas, say so. That answer is how we plan to
                  choose a state privacy law. If you live somewhere else, leave the box unchecked
                  and submit anyway.
                </p>
              </details>
              <details>
                <summary>Why do you ask if I live in Texas?</summary>
                <p>
                  Privacy laws are different from state to state. Your answer is for that choice.
                  The State of Texas does not review this form.
                </p>
              </details>
              <details>
                <summary>What do you do with my name, address, and email?</summary>
                <p>
                  They are the details a request would use. This preview checks them and does not
                  store them. It does not send them to a data broker.
                </p>
              </details>
              <details>
                <summary>Does submitting delete my information today?</summary>
                <p>
                  No. Submitting here only checks the form. It does not contact data brokers, and
                  it does not save your details. Even after this service starts sending requests,
                  a broker may not delete everything it holds.
                </p>
              </details>
              <details>
                <summary>Is this free?</summary>
                <p>Yes. DROP Texas does not charge you to submit.</p>
              </details>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <p className="brand">DROP Texas</p>
          <p className="independence">{INDEPENDENCE_NOTE}</p>
          <a className="cta" href="#opt-out">
            Start Removing Me
          </a>
        </div>
      </footer>
    </>
  );
}
