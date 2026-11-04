import { providerStartHref } from "../authGate";

const PROVIDERS = [
  { provider: "google", label: "Continue with Google", src: "/brand/google-sign-in.svg", width: 180, height: 40 },
  { provider: "microsoft", label: "Continue with Microsoft", src: "/brand/microsoft-sign-in.svg", width: 215, height: 41 },
] as const;

function requestedReturnTo(returnTo: string | null | undefined): string | null {
  if (returnTo !== undefined) return returnTo;
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("return_to");
}

export function SignInPage({ returnTo }: { returnTo?: string | null }) {
  const requested = requestedReturnTo(returnTo);
  return (
    <article className="panel sign-in-page">
      <h1>Sign in</h1>
      <p>Use Google or Microsoft. There is no password on this page.</p>
      <div className="sign-in-actions">
        {PROVIDERS.map((item) => (
          <a key={item.provider} className="provider-sign-in" href={providerStartHref(item.provider, requested)}>
            <img src={item.src} alt="" width={item.width} height={item.height} />
            <span className="visually-hidden">{item.label}</span>
          </a>
        ))}
      </div>
    </article>
  );
}
