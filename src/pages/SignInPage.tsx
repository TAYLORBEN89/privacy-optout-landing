import { useEffect } from "react";
import { accountsSignInUrl } from "../../shared/accounts";

function replaceLocation(url: string): void {
  window.location.replace(url);
}

export function SignInPage({
  goTo = replaceLocation,
}: {
  goTo?: (url: string) => void;
}) {
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("return_to");
    goTo(accountsSignInUrl(requested ?? "/start"));
  }, [goTo]);

  return <p className="panel">Sending you to sign in…</p>;
}
