import { useEffect } from "react";
import { SignupForm } from "../SignupForm";
import { DISCLAIMER } from "../copy";
import { type StartAction, signInHrefFor } from "../authGate";
import { navigate } from "../router";

export function StartPage({ action }: { action: StartAction }) {
  useEffect(() => {
    if (action === "redirect") navigate(signInHrefFor("/start"));
  }, [action]);

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