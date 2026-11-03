import { ACCOUNTS_COMING_SOON_TITLE } from "../copy";
import { AppLink } from "../router";

export function AccountComingSoon() {
  return (
    <main className="account-soon" aria-labelledby="account-soon-heading">
      <h1 id="account-soon-heading">{ACCOUNTS_COMING_SOON_TITLE}</h1>
      <p>Until then, email help@droptexas.com to see or delete your data.</p>
      <AppLink className="cta" href="/start">
        Start my opt-out
      </AppLink>
    </main>
  );
}
