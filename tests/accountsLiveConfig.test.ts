import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ConfigEnv, UserConfig, UserConfigExport } from "vite";
import config from "../vite.config";

function resolveUserConfig(exported: UserConfigExport, env: ConfigEnv): UserConfig | Promise<UserConfig> {
  if (typeof exported === "function") return exported(env);
  return exported;
}

describe("accounts live flag", () => {
  it("does not force VITE_ACCOUNTS_LIVE in a production build", async () => {
    const source = readFileSync("vite.config.ts", "utf8");
    expect(source).not.toContain("VITE_ACCOUNTS_LIVE");
    const resolved = await resolveUserConfig(config, { mode: "production", command: "build" });
    expect(resolved.define?.["import.meta.env.VITE_ACCOUNTS_LIVE"]).toBeUndefined();
  });

  it("builds sign-in into the shipped script without a coming-soon placeholder", () => {
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
    expect(js).toContain("Continue with Google");
    expect(js).toContain("Continue with Microsoft");
    expect(js).toContain("/api/auth/google/start");
    expect(js).toContain("/api/auth/microsoft/start");
    expect(js).toContain("return_to=");
    expect(js).toContain("/brand/google-sign-in.svg");
    expect(js).toContain("/brand/microsoft-sign-in.svg");
    expect(js).not.toMatch(/coming soon/i);
  });
});
