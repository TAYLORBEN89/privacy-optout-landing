import { AUTH_PROVIDERS, authStartPath } from "../api";
import { DISCLAIMER, SIGN_IN_NOTE, SIGN_IN_TITLE, TRUST_LABEL } from "../copy";
import { AppLink } from "../router";

const LABELS: Record<(typeof AUTH_PROVIDERS)[number], string> = {
  google: "Continue with Google",
  apple: "Continue with Apple",
  microsoft: "Continue with Microsoft",
};

export function SignInPage() {
  return (
    <article className="signin-card">
      <h1>{SIGN_IN_TITLE}</h1>
      <ul className="providers">
        {AUTH_PROVIDERS.map((provider) => (
          <li key={provider}>
            <a className="provider" href={authStartPath(provider)}>
              {LABELS[provider]}
            </a>
          </li>
        ))}
        <li>
          <button type="button" className="provider provider-more" disabled>
            More options
          </button>
        </li>
      </ul>
      <p>{SIGN_IN_NOTE}</p>
      <p>
        <AppLink className="text-link" href="/security">
          {TRUST_LABEL}
        </AppLink>
      </p>
      <p className="independence">{DISCLAIMER}</p>
    </article>
  );
}