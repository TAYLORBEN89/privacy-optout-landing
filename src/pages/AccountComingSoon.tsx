import { ACCOUNTS_COMING_SOON, ACCOUNTS_COMING_SOON_TITLE } from "../copy";
import { AppLink } from "../router";

export function AccountComingSoon() {
  return (
    <main className="account-soon" aria-labelledby="account-soon-heading">
      <h1 id="account-soon-heading">{ACCOUNTS_COMING_SOON_TITLE}</h1>
      <p>{ACCOUNTS_COMING_SOON}</p>
      <AppLink className="cta" href="/start">
        Start my opt-out
      </AppLink>
    </main>
  );
}
