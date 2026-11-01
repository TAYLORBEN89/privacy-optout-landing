import { useEffect } from "react";
import { SignupForm } from "../SignupForm";
import { DISCLAIMER } from "../copy";
import { type StartAction, signInHrefFor } from "../authGate";

function assignLocation(url: string): void {
  window.location.assign(url);
}

export function StartPage({
  action,
  goTo = assignLocation,
}: {
  action: StartAction;
  goTo?: (url: string) => void;
}) {
  useEffect(() => {
    if (action === "redirect") goTo(signInHrefFor("/start"));
  }, [action, goTo]);

  if (action === "loading") return <p className="panel">Checking sign-in…</p>;
  if (action === "redirect") return <p className="panel">Sending you to sign in…</p>;
  if (action === "unavailable") {
    return (
      <p className="panel">
        Sign-in could not be checked. You can try{" "}
        <a href={signInHrefFor("/start")}>sign in</a> again.
      </p>
    );
  }

  return (
    <section className="form-section" aria-labelledby="form-heading">
      <p className="note">{DISCLAIMER}</p>
      <SignupForm />
    </section>
  );
}