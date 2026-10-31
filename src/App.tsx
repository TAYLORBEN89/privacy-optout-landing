import { SignupForm } from "./SignupForm";

export function App() {
  return (
    <main className="wrap">
      <header className="hero">
        <p className="kicker">DropTexas</p>
        <h1>Privacy is a right. This service is free for Texans.</h1>
        <p className="lede">
          This free service helps you opt out. Texas residency tells us which state privacy law
          applies. If you live somewhere else, you can still submit.
        </p>
        <a className="cta" href="#opt-out">
          Start Removing Me
        </a>
      </header>
      <SignupForm />
    </main>
  );
}
