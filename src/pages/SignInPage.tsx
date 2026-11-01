import { useEffect } from "react";
import { accountsSignInUrl } from "../../shared/accounts";
import { accountsLive } from "../authGate";
import { ACCOUNTS_COMING_SOON, ACCOUNTS_COMING_SOON_TITLE } from "../copy";

function replaceLocation(url: string): void {
  window.location.replace(url);
}

export function SignInPage({
  goTo = replaceLocation,
  live = accountsLive(),
}: {
  goTo?: (url: string) => void;
  live?: boolean;
}) {
  useEffect(() => {
    if (!live) return;
    const requested = new URLSearchParams(window.location.search).get("return_to");
    goTo(accountsSignInUrl(requested ?? "/start"));
  }, [goTo, live]);

  if (!live) {
    return (
      <article className="panel">
        <h1>{ACCOUNTS_COMING_SOON_TITLE}</h1>
        <p>{ACCOUNTS_COMING_SOON}</p>
      </article>
    );
  }

  return <p className="panel">Sending you to sign in…</p>;
}
