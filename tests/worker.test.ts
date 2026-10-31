import { afterEach, describe, expect, it, vi } from "vitest";
import { validateSignup } from "../shared/signup";
import { handleRequest } from "../worker/handle";

const valid = {
  fullName: "Ada Lovelace",
  mailingAddress: "123 Main St, Austin, TX 78701",
  email: "ada@example.com",
  texasResident: false,
};

function assets() {
  return {
    fetchAsset: async () =>
      new Response("<!doctype html><h1>Privacy is a right.</h1>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  };
}

function post(body: unknown, headers: HeadersInit = {}): Request {
  return new Request("https://optout.example/api/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://optout.example",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/signup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a non-Texan without echoing the submission", async () => {
    const response = await handleRequest(post(valid), assets());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns the shared schema errors for a bad body", async () => {
    const body = {
      fullName: "Ada",
      mailingAddress: "nope",
      email: "nope",
      texasResident: "yes",
    };
    const expected = validateSignup(body);
    const response = await handleRequest(post(body), assets());
    const payload = (await response.json()) as {
      ok: false;
      errors: Record<string, { code: string; message: string }>;
    };
    expect(response.status).toBe(400);
    expect(expected.ok).toBe(false);
    if (!expected.ok) {
      expect(payload.errors.fullName.code).toBe(expected.errors.fullName?.code);
      expect(payload.errors.mailingAddress.code).toBe(expected.errors.mailingAddress?.code);
      expect(payload.errors.email.code).toBe(expected.errors.email?.code);
      expect(payload.errors.texasResident.code).toBe(expected.errors.texasResident?.code);
    }
  });

  it("rejects the wrong method, content type, origin, and JSON", async () => {
    const getResponse = await handleRequest(
      new Request("https://optout.example/api/signup", { method: "GET" }),
      assets(),
    );
    expect(getResponse.status).toBe(405);

    const textResponse = await handleRequest(
      post("hello", { "content-type": "text/plain" }),
      assets(),
    );
    expect(textResponse.status).toBe(415);

    const originResponse = await handleRequest(
      post(valid, { origin: "https://evil.example" }),
      assets(),
    );
    expect(originResponse.status).toBe(403);

    const jsonResponse = await handleRequest(post("{"), assets());
    expect(jsonResponse.status).toBe(400);
    const payload = (await jsonResponse.json()) as { form: { code: string } };
    expect(payload.form.code).toBe("invalid_json");
  });

  it("rejects an oversized body before treating it as field data", async () => {
    const huge = JSON.stringify({ ...valid, fullName: "A".repeat(9000) + " B" });
    const response = await handleRequest(post(huge), assets());
    expect(response.status).toBe(413);
    const payload = (await response.json()) as { form: { code: string } };
    expect(payload.form.code).toBe("payload_too_large");
  });

  it("does not log field values or extra sensitive keys", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      lines.push(String(message));
    });
    vi.spyOn(console, "error").mockImplementation((message) => {
      lines.push(String(message));
    });

    const body = {
      fullName: "Zephyr Quill",
      mailingAddress: "500 Secret Hollow, Austin, TX 78701",
      email: "zephyr.quill@example.com",
      texasResident: true,
      ssn: "123-45-6789",
    };
    const response = await handleRequest(post(body), assets());
    expect(response.status).toBe(200);
    const dumped = `${JSON.stringify(await response.clone().json())}\n${lines.join("\n")}`;
    expect(dumped).not.toContain("Zephyr");
    expect(dumped).not.toContain("Secret Hollow");
    expect(dumped).not.toContain("zephyr.quill");
    expect(dumped).not.toContain("123-45-6789");
    expect(lines.join("\n")).toContain("signup_accepted");
  });

  it("serves non-API requests from static assets", async () => {
    const response = await handleRequest(new Request("https://optout.example/"), assets());
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Privacy is a right.");
  });
});
