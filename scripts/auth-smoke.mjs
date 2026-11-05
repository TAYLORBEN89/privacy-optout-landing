/** npm run auth:smoke [url] — stubbed upstream echoes the cookie NAMES the proxy forwards (no real credentials, no network). */
import { createServer } from "vite";
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const { run } = await server.ssrLoadModule("/scripts/auth-smoke-core.ts");
  process.exitCode = (await run(process.argv[2] || "https://droptexas.com")) ? 0 : 1;
} finally {
  await server.close();
}
