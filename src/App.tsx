import { SignupForm } from "./SignupForm";

export function App() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <p className="brand">DropTexas</p>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-inner">
            <h1>Privacy is a right. This service is free for Texans.</h1>
            <p className="lede">
              This free service helps you opt out. Texas residency tells us which state privacy law
              applies. If you live somewhere else, you can still submit.
            </p>
            <a className="cta" href="#opt-out">
              Start Removing Me
            </a>
          </div>
        </section>
        <div className="form-section">
          <SignupForm />
        </div>
      </main>
    </>
  );
}
