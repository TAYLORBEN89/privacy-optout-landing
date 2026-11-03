import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { importPiiKeys } from "../worker/piiCrypto";

const b64 = (n: number) => Buffer.from(new Uint8Array(n).fill(7)).toString("base64");

describe("SIGNUP_PII_KEY format", () => {
  it("accepts `openssl rand -base64 32` output as-is, including its trailing newline", async () => {
    let generated: string;
    try {
      generated = execFileSync("openssl", ["rand", "-base64", "32"], { encoding: "utf8" });
    } catch {
      generated = `${b64(32)}\n`;
    }
    expect(generated.trim()).toHaveLength(44);
    await expect(importPiiKeys(generated)).resolves.toHaveProperty("enc");
  });

  it("rejects a missing key with signup_key_missing", async () => {
    await expect(importPiiKeys(undefined)).rejects.toMatchObject({ name: "signup_key_missing" });
    await expect(importPiiKeys("  ")).rejects.toMatchObject({ name: "signup_key_missing" });
  });

  it("rejects wrong length, hex and base64url with signup_key_invalid", async () => {
    const bad = [
      b64(16),
      b64(64),
      "a".repeat(64), // 32 bytes as hex
      b64(32).replace(/=$/, ""), // unpadded
      Buffer.from(new Uint8Array(32).fill(251)).toString("base64url"), // contains - or _
    ];
    for (const key of bad) {
      await expect(importPiiKeys(key), key.slice(0, 6)).rejects.toMatchObject({ name: "signup_key_invalid" });
    }
  });
});
