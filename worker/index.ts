import { handleRequest } from "./handle";
import { D1SignupStore } from "./storage";

/**
 * Accounts API. The generated Env type is refreshed by `wrangler types`.
 * The cast stays so this file typechecks before that refresh.
 */
type ApiService = {
  fetch(request: Request): Promise<Response>;
};

function optionalApi(env: Env): ApiService | undefined {
  const candidate = (env as Env & { API?: ApiService }).API;
  if (candidate && typeof candidate.fetch === "function") return candidate;
  return undefined;
}

/**
 * Worker entry. Static assets are served by the ASSETS binding.
 * POST /api/signup stays local and writes to D1, then records one pending
 * opt-out row per named broker. It does not POST personal information to
 * broker sites. Other /api paths forward to env.API when present.
 */
export default {
  async fetch(request, env): Promise<Response> {
    const api = optionalApi(env);
    try {
      return await handleRequest(
        {
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
        },
        {
          fetchAsset: () => env.ASSETS.fetch(request),
          forwardApi: api ? (upstream) => api.fetch(upstream) : undefined,
          callApi: api,
          signupStore: new D1SignupStore(env.DB, (env as Env & { SIGNUP_PII_KEY?: string }).SIGNUP_PII_KEY),
        },
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "unhandled_error",
          error: error instanceof Error ? error.name : "Error",
        }),
      );
      return new Response(
        JSON.stringify({
          ok: false,
          errors: {},
          form: { code: "unavailable", message: "Something went wrong. Try again." },
        }),
        {
          status: 500,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      );
    }
  },
} satisfies ExportedHandler<Env>;
