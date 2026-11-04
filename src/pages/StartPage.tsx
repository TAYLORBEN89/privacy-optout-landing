import { useEffect } from "react";
import { SignupForm } from "../SignupForm";
import { accountsLive, type StartAction, signInHrefFor } from "../authGate";
import { AuthErrorNotice } from "../components/AuthErrorNotice";

function assignLocation(url: string): void {
  window.location.assign(url);
}

export function StartPage({
  action,
  csrfToken = null,
  goTo = assignLocation,
  live = accountsLive(),
}: {
  action: StartAction;
  csrfToken?: string | null;
  goTo?: (url: string) => void;
  live?: boolean;
}) {
  useEffect(() => {
    if (action !== "redirect") return;
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    goTo(signInHrefFor(here, live));
  }, [action, goTo, live]);

  let body = (
    <section className="form-section" aria-labelledby="form-heading">
      <SignupForm csrfToken={csrfToken} />
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