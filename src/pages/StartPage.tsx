import { useEffect } from "react";
import { SignupForm } from "../SignupForm";
import { type StartAction, signInHrefFor } from "../authGate";
import { AuthErrorNotice } from "../components/AuthErrorNotice";

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

  let body = (
    <section className="form-section" aria-labelledby="form-heading">
      <SignupForm />
    </section>
  );
  if (action === "loading") body = <p className="panel">Checking sign-in…</p>;
  else if (action === "redirect") body = <p className="panel">Sending you to sign in…</p>;
  else if (action === "unavailable") {
    body = (
      <p className="panel">
        Sign-in could not be checked. You can try <a href={signInHrefFor("/start")}>sign in</a> again.
      </p>
    );
  }

  return (
    <>
      <AuthErrorNotice />
      {body}
    </>
  );
}