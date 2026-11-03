import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../vite.config";

describe("accounts live flag", () => {
  it("does not force VITE_ACCOUNTS_LIVE in a production build", () => {
    const source = readFileSync("vite.config.ts", "utf8");
    expect(source).not.toContain("VITE_ACCOUNTS_LIVE");
    const resolved = typeof config === "function" ? config({ mode: "production", command: "build" }) : config;
    const define = (resolved as { define?: Record<string, string> }).define ?? {};
    expect(define["import.meta.env.VITE_ACCOUNTS_LIVE"]).toBeUndefined();
  });

  it("builds /account as Coming soon when the flag is unset", () => {
    const env = { ...process.env };
    delete env.VITE_ACCOUNTS_LIVE;
    execFileSync("npx", ["vite", "build", "--minify", "false"], {
      env,
      stdio: "pipe",
    });
    const js = readdirSync("dist/assets")
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFileSync(`dist/assets/${name}`, "utf8"))
      .join("\n");
    expect(js).toContain("Coming soon");
    expect(js).toContain("Start my opt-out");
    const liveCheck = js.match(/function accountsLive\(raw\) \{[\s\S]*?\n\}/);
    expect(liveCheck?.[0]).toContain("void 0");
    expect(liveCheck?.[0]).not.toContain('? "true"');
  });
});
