import { useEffect, useId, useState } from "react";
import { LOGOUT_PATH } from "./api";
import { accountsLive as accountsLiveDefault } from "./authGate";
import { UserGlyph, Wordmark } from "./Brand";
import { AppLink } from "./router";

export function Header({
  signedIn,
  csrf,
  signInHref,
  onSignedOut,
  accountsLive = accountsLiveDefault(),
}: {
  signedIn: boolean;
  csrf: string | null;
  signInHref: string;
  onSignedOut: () => void;
  accountsLive?: boolean;
}) {
  const accountId = useId();
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (!accountOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [accountOpen]);

  async function signOut() {
    if (!csrf) return;
    await fetch(LOGOUT_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRF-Token": csrf },
    });
    setAccountOpen(false);
    onSignedOut();
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Wordmark header />
        <div className="account">
          {accountsLive && signedIn ? (
            <button
              type="button"
              className="account-button"
              aria-label="Account"
              aria-expanded={accountOpen}
              aria-controls={accountId}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <UserGlyph />
            </button>
          ) : accountsLive ? (
            <a className="account-button" href={signInHref} aria-label="Account">
              <UserGlyph />
            </a>
          ) : (
            <span className="account-button" aria-hidden="true">
              <UserGlyph />
            </span>
          )}
          {accountsLive && signedIn && accountOpen ? (
            <div className="account-menu" id={accountId} role="menu">
              <AppLink href="/account" role="menuitem" onClick={() => setAccountOpen(false)}>
                Your requests
              </AppLink>
              <button type="button" role="menuitem" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
