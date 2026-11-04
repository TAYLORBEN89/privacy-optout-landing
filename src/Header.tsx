import { LOGOUT_PATH } from "./api";
import { UserGlyph, Wordmark } from "./Brand";
import { AppLink } from "./router";

export function Header({
  signedIn,
  csrf,
  onSignedOut,
}: {
  signedIn: boolean;
  csrf: string | null;
  onSignedOut: () => void;
  path?: string;
}) {
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
    </header>
  );
}
