import { testSigner as signer } from "../tests/helpers/proxyKeys";
/** Checks /api/auth/complete cookie forwarding with a stubbed upstream that echoes the cookie NAMES it received.
 * No real credentials. Usage: npm run auth:smoke [url]   (url is only used as the request origin; default https://droptexas.com) */
import { handleRequest } from "../worker/handle";
export async function run(base: string): Promise<boolean> {


async function names(method: string, path: string) {
  let got: string[] = [];
  await handleRequest(
    new Request(new URL(path, base), { method, headers: { origin: new URL(base).origin, cookie: "__Host-sid=smoke-sid; __Host-login=smoke-login; _ga=x" } }),
    { fetchAsset: async () => new Response(""), proxySigner: signer,
      forwardApi: async (r) => { got = (r.headers.get("cookie") || "").split(";").map((c) => c.split("=")[0].trim()).filter(Boolean); return new Response("{}"); } },
  );
  return got.join(",");
}
const complete = await names("GET", "/api/auth/complete?code=smoke");
const me = await names("GET", "/api/me");
const ok = complete === "__Host-sid,__Host-login" && me === "__Host-sid";
console.log(`auth/complete forwards: ${complete}\n/api/me forwards: ${me}\n${ok ? "auth smoke ok" : "auth smoke FAIL"}`);
return ok;
}
