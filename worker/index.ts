import { handleRequest } from "./handle";

/**
 * Worker entry. Static assets are served by the ASSETS binding.
 * API routes are handled in ./handle.ts and are not persisted.
 */
export default {
  async fetch(request, env): Promise<Response> {
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
