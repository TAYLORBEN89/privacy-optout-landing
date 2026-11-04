import { useEffect, useId, useState } from "react";
import { LOGOUT_PATH } from "./api";
import { UserGlyph, Wordmark } from "./Brand";
import { AppLink } from "./router";

export function Header({
  signedIn,
  csrf,
  onSignedOut,
  path = typeof window === "undefined" ? "/" : window.location.pathname,
}: {
  signedIn: boolean;
  csrf: string | null;
  onSignedOut: () => void;
  path?: string;
}) {
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  async function signOut() {
    if (!csrf) return;
    await fetch(LOGOUT_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRF-Token": csrf },
    });
    onSignedOut();
  }

  return (
    <header className="topbar topbar--hills">
      <div className="topbar-inner">
        <AppLink className="brand-home" href="/">
          <Wordmark header />
        </AppLink>
        <nav className="header-nav" aria-label="Primary">
          <AppLink
            className="proposal-link proposal-link-desktop"
            href="/texas-proposal"
            ariaCurrent={path === "/texas-proposal" ? "page" : undefined}
          >
            Texas Proposal
          </AppLink>
          <button
            type="button"
            className="proposal-menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
        </nav>
        <div className="account">
          <a className="account-button" href={signedIn ? "/account" : "/signin"} aria-label={signedIn ? "Account" : "Sign in"}>
            <UserGlyph />
          </a>
          {signedIn ? (
            <button type="button" className="sign-out" onClick={() => void signOut()}>
              Sign out
            </button>
          ) : null}
        </div>
      </div>
      <div className="proposal-menu-panel" id={menuId} hidden={!menuOpen}>
        <AppLink
          className="proposal-link"
          href="/texas-proposal"
          ariaCurrent={path === "/texas-proposal" ? "page" : undefined}
          onClick={() => setMenuOpen(false)}
        >
          Texas Proposal
        </AppLink>
      </div>
    </header>
  );
}
