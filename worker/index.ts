import { handleRequest } from "./handle";

/**
 * Optional backend service. Not declared in wrangler.jsonc until
 * privacy-dashboard-api is deployed, so the generated Env type omits it.
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
 * POST /api/signup stays local. Other /api paths forward to env.API when present.
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
          forwardApi: api ? () => api.fetch(request) : undefined,
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
