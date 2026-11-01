import { useEffect, useId, useRef, useState } from "react";
import { LOGOUT_PATH } from "./api";
import { UserGlyph, Wordmark } from "./Brand";
import { nextMenuOpen } from "./menuState";
import { NAV_ITEMS } from "./navItems";
import { AppLink } from "./router";

function focusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
}

export function Header({
  signedIn,
  csrf,
  signInHref,
  onSignedOut,
}: {
  signedIn: boolean;
  csrf: string | null;
  signInHref: string;
  onSignedOut: () => void;
}) {
  const menuId = useId();
  const accountId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const root = dialogRef.current;
    const returnFocus = menuButtonRef.current;
    focusable(root ?? document.body)[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(nextMenuOpen(true, "escape"));
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const nodes = focusable(root);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      returnFocus?.focus();
    };
  }, [menuOpen]);

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
        <button
          ref={menuButtonRef}
          type="button"
          className="menu-button"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => nextMenuOpen(open, "toggle"))}
        >
          <span className="menu-bars" aria-hidden="true" />
          <span className="visually-hidden">{menuOpen ? "Close menu" : "Open menu"}</span>
        </button>
        <Wordmark header />
        <div className="account">
          {signedIn ? (
            <button
              type="button"
              className="icon-button"
              aria-label="Account"
              aria-expanded={accountOpen}
              aria-controls={accountId}
              onClick={() => setAccountOpen((open) => !open)}
            >
              <UserGlyph />
            </button>
          ) : (
            <AppLink className="icon-button" href={signInHref} aria-label="Sign in">
              <UserGlyph />
            </AppLink>
          )}
          {signedIn && accountOpen ? (
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
      {menuOpen ? (
        <div className="drawer-root">
          <button
            type="button"
            className="drawer-backdrop"
            aria-label="Close menu"
            onClick={() => setMenuOpen(nextMenuOpen(true, "backdrop"))}
          />
          <div ref={dialogRef} id={menuId} className="drawer" role="dialog" aria-modal="true" aria-label="Site menu">
            <nav aria-label="DROP Texas">
              <ul>
                {NAV_ITEMS.map((item) => (
                  <li key={item.id}>
                    <AppLink href={item.href} onClick={() => setMenuOpen(nextMenuOpen(true, "navigate"))}>
                      {item.label}
                    </AppLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
