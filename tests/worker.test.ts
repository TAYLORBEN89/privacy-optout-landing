import { testSigner } from "./helpers/proxyKeys";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateSignup } from "../shared/signup";
import { BROKER_SENDS } from "../worker/brokerSends";
import { handleRequest, type RequestDeps } from "../worker/handle";
import type { OptOutInsert, SignupRecord, SignupStore } from "../worker/storage";

const valid = {
  firstName: "Ada",
  lastName: "Lovelace",
  dob: "1990-01-15",
  addressLine1: "123 Main St",
  city: "Austin",
  state: "TX",
  zip: "78701",
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

function sessionDeps(): Pick<RequestDeps, "callApi" | "proxySigner"> {
  return {
    proxySigner: testSigner,
    callApi: {
      fetch: async () =>
        new Response(JSON.stringify({ user: { id: "user-1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    },
  };
}

function signed(): RequestDeps {
  return { ...assets(), ...sessionDeps() };
}

function saving(): { deps: RequestDeps; saved: SignupRecord[]; optouts: OptOutInsert[] } {
  const saved: SignupRecord[] = [];
  const optouts: OptOutInsert[] = [];
  const signupStore: SignupStore = {
    save: async (record) => {
      saved.push(record);
      return "signup-1";
    },
    saveOptOuts: async (rows) => {
      optouts.push(...rows);
    },
  };
  return { deps: { ...assets(), signupStore, ...sessionDeps() }, saved, optouts };
}

function post(body: unknown, headers: HeadersInit = {}): Request {
  return new Request("https://optout.example/api/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://optout.example",
      cookie: "__Host-sid=abc",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/signup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a valid submission with no session and stores nothing", async () => {
    const { deps, saved } = saving();
    const response = await handleRequest(post({ ...valid, firstName: "Zephyr", email: "zephyr@example.com" }, { cookie: "" }), deps);
    expect(response.status).toBe(401);
    const text = await response.text();
    const payload = JSON.parse(text) as { form: { code: string } };
    expect(payload.form.code).toBe("sign_in_required");
    expect(text).not.toContain("Zephyr");
    expect(text).not.toContain("zephyr@example.com");
    expect(saved).toHaveLength(0);
  });

  it("rejects an invalid or expired session and stores nothing", async () => {
    const { deps, saved } = saving();
    const response = await handleRequest(post({ ...valid, firstName: "Zephyr", email: "zephyr@example.com" }), {
      ...deps,
      callApi: {
        fetch: async () => new Response("{}", { status: 401, headers: { "content-type": "application/json" } }),
      },
    });
    expect(response.status).toBe(401);
    const text = await response.text();
    expect((JSON.parse(text) as { form: { code: string } }).form.code).toBe("sign_in_required");
    expect(text).not.toContain("Zephyr");
    expect(text).not.toContain("zephyr@example.com");
    expect(saved).toHaveLength(0);
  });

  it.each([
    ["an empty body", ""],
    ["malformed JSON", "{"],
    ["a partial body", { name: "Test" }],
    ["a full valid body", valid],
  ])("returns 401 for %s with no session and stores nothing", async (_label, body) => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      lines.push(String(message));
    });
    vi.spyOn(console, "error").mockImplementation((message) => {
      lines.push(String(message));
    });
    const { deps, saved } = saving();
    const response = await handleRequest(post(body, { cookie: "" }), deps);
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      ok: false,
      errors: {},
      form: { code: "sign_in_required", message: "Sign in to submit this request." },
    });
    expect(text).not.toContain("Test");
    expect(text).not.toContain("Ada");
    expect(text).not.toContain("ada@example.com");
    expect(saved).toHaveLength(0);
    expect(lines.join("\n")).not.toMatch(/Test|Ada|ada@example|signup_rejected|invalid_json/);
  });

  it.each([
    ["an empty body", ""],
    ["malformed JSON", "{"],
    ["a partial body", { name: "Test" }],
    ["a full valid body", valid],
  ])("returns 401 for %s with an expired session and stores nothing", async (_label, body) => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      lines.push(String(message));
    });
    vi.spyOn(console, "error").mockImplementation((message) => {
      lines.push(String(message));
    });
    const { deps, saved } = saving();
    const response = await handleRequest(post(body), {
      ...deps,
      callApi: {
        fetch: async () => new Response("{}", { status: 401, headers: { "content-type": "application/json" } }),
      },
    });
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      ok: false,
      errors: {},
      form: { code: "sign_in_required", message: "Sign in to submit this request." },
    });
    expect(text).not.toContain("Test");
    expect(text).not.toContain("Ada");
    expect(text).not.toContain("ada@example.com");
    expect(saved).toHaveLength(0);
    expect(lines.join("\n")).not.toMatch(/Test|Ada|ada@example|signup_rejected|invalid_json/);
  });

  it("returns validation errors for a signed-in invalid body and stores nothing", async () => {
    const { deps, saved } = saving();
    const response = await handleRequest(post({ name: "Test" }), deps);
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { ok: false; errors: Record<string, { code: string }> };
    expect(payload.ok).toBe(false);
    expect(payload.errors.firstName?.code).toBeTruthy();
    expect(JSON.stringify(payload)).not.toContain("Test");
    expect(saved).toHaveLength(0);
  });

  it("accepts a non-Texan without echoing the submission", async () => {
    const { deps, saved } = saving();
    const response = await handleRequest(post(valid), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
    expect(saved).toHaveLength(1);
    expect(saved[0]?.jurisdiction).toBe("TDPSA");
    expect(saved[0]?.nonTexasFlag).toBe(true);
    expect(saved[0]?.firstName).toBe("Ada");
    expect(saved[0]?.userId).toBe("user-1");
  });

  it("rejects a missing or impossible date of birth with the shared error", async () => {
    for (const dob of [undefined, "2024-02-31"]) {
      const body = { ...valid, dob };
      const expected = validateSignup(body);
      const response = await handleRequest(post(body), signed());
      const payload = (await response.json()) as { errors: { dob?: { code: string; message: string } } };
      expect(response.status).toBe(400);
      expect(expected.ok).toBe(false);
      if (!expected.ok) {
        expect(payload.errors.dob?.code).toBe(expected.errors.dob?.code);
        expect(payload.errors.dob?.message).toBe(expected.errors.dob?.message);
      }
    }
  });

  it("rejects a child request that breaks the age or attestation rules", async () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const latest = `${y}-${m}-${d}`;
    const body = {
      ...valid,
      dob: latest,
      submitter: "child",
      guardianAttestation: false,
      child: { firstName: "Grace", lastName: "Hopper", dob: latest, sameAddress: true },
    };
    const expected = validateSignup(body);
    const response = await handleRequest(post(body), signed());
    const payload = (await response.json()) as { errors: Record<string, { code: string }> };
    expect(response.status).toBe(400);
    expect(expected.ok).toBe(false);
    if (!expected.ok) {
      expect(payload.errors.dob?.code).toBe(expected.errors.dob?.code);
      expect(payload.errors.guardianAttestation?.code).toBe(expected.errors.guardianAttestation?.code);
    }

    const selfBody = { ...valid, submitter: "self", child: { firstName: "Grace" } };
    const selfResponse = await handleRequest(post(selfBody), signed());
    const selfPayload = (await selfResponse.json()) as { errors: { submitter?: { code: string } } };
    expect(selfResponse.status).toBe(400);
    expect(selfPayload.errors.submitter?.code).toBe("unexpected");
  });

  it("returns the shared schema errors for a bad body", async () => {
    const body = {
      firstName: "",
      lastName: "Lovelace",
      addressLine1: "",
      city: "Austin",
      state: "ZZ",
      zip: "7870",
      email: "nope",
      texasResident: "yes",
    };
    const expected = validateSignup(body);
    const response = await handleRequest(post(body), signed());
    const payload = (await response.json()) as {
      ok: false;
      errors: Record<string, { code: string; message: string }>;
    };
    expect(response.status).toBe(400);
    expect(expected.ok).toBe(false);
    if (!expected.ok) {
      expect(payload.errors.firstName.code).toBe(expected.errors.firstName?.code);
      expect(payload.errors.addressLine1.code).toBe(expected.errors.addressLine1?.code);
      expect(payload.errors.state.code).toBe(expected.errors.state?.code);
      expect(payload.errors.zip.code).toBe(expected.errors.zip?.code);
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

    const jsonResponse = await handleRequest(post("{"), signed());
    expect(jsonResponse.status).toBe(400);
    const payload = (await jsonResponse.json()) as { form: { code: string } };
    expect(payload.form.code).toBe("invalid_json");
  });

  it("rejects an oversized body before treating it as field data", async () => {
    const huge = JSON.stringify({ ...valid, firstName: "A".repeat(9000) });
    const response = await handleRequest(post(huge), signed());
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
      ...valid,
      firstName: "Zephyr",
      lastName: "Quill",
      addressLine1: "500 Secret Hollow",
      email: "zephyr.quill@example.com",
      texasResident: true,
      ssn: "123-45-6789",
    };
    const { deps } = saving();
    const response = await handleRequest(post(body), deps);
    expect(response.status).toBe(200);
    const dumped = `${JSON.stringify(await response.clone().json())}\n${lines.join("\n")}`;
    expect(dumped).not.toContain("Zephyr");
    expect(dumped).not.toContain("Secret Hollow");
    expect(dumped).not.toContain("zephyr.quill");
    expect(dumped).not.toContain("123-45-6789");
    expect(lines.join("\n")).toContain("signup_accepted");
  });

  it("records one pending opt-out per named broker and does not POST personal information", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      lines.push(String(message));
    });
    vi.spyOn(console, "error").mockImplementation((message) => {
      lines.push(String(message));
    });

    const { deps, optouts } = saving();
    const response = await handleRequest(
      post({ ...valid, email: "ada@example.com", phone: "+15125550100", addressLine1: "500 Secret Hollow" }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(optouts).toHaveLength(BROKER_SENDS.length);
    expect(optouts.map((row) => row.brokerId)).toEqual(BROKER_SENDS.map((target) => target.id));
    for (const row of optouts) {
      expect(row.status).toBe("pending");
      expect(row.subStatus).toBeNull();
      expect(row.httpStatus).toBeNull();
      expect(row.submittedAt).toBeNull();
      expect(row.signupId).toBe("signup-1");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    const dumped = lines.join("\n");
    expect(dumped).toContain("optout_recorded");
    expect(dumped).toContain("profile_url");
    expect(dumped).toContain("fcra_and_form");
    expect(dumped).not.toContain("ada@example.com");
    expect(dumped).not.toContain("+15125550100");
    expect(dumped).not.toContain("Secret Hollow");
    expect(dumped).not.toContain("confirmed");
    expect(dumped).not.toContain("no_record");
  });

  it("keeps the signup when recording broker rows fails, and does not log the failure text", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      lines.push(String(message));
    });
    vi.spyOn(console, "error").mockImplementation((message) => {
      lines.push(String(message));
    });
    const deps: RequestDeps = {
      ...assets(),
      ...sessionDeps(),
      signupStore: {
        save: async () => "signup-1",
        saveOptOuts: async () => {
          throw new Error("ada@example.com disk_full");
        },
      },
    };
    const response = await handleRequest(post({ ...valid, firstName: "Zephyr" }), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const dumped = lines.join("\n");
    expect(dumped).toContain("optout_dispatch_failed");
    expect(dumped).toContain("signup_accepted");
    expect(dumped).not.toContain("ada@example.com");
    expect(dumped).not.toContain("disk_full");
    expect(dumped).not.toContain("Zephyr");
  });

  it("accepts an empty phone and stores a valid one only as E.164", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      lines.push(String(message));
    });

    const { deps, saved } = saving();
    const missing = await handleRequest(post(valid), deps);
    expect(missing.status).toBe(200);

    const empty = await handleRequest(post({ ...valid, phone: "" }), deps);
    expect(empty.status).toBe(200);

    const blank = await handleRequest(post({ ...valid, phone: null }), deps);
    expect(blank.status).toBe(200);

    const accepted = await handleRequest(post({ ...valid, phone: "1 (512) 555-0100" }), deps);
    expect(accepted.status).toBe(200);
    const acceptedBody = JSON.stringify(await accepted.json());
    expect(acceptedBody).not.toContain("512");
    expect(lines.join("\n")).not.toContain("5125550100");
    expect(lines.join("\n")).not.toContain("+15125550100");
    expect(saved.at(-1)?.phone).toBe("+15125550100");
  });

  it("rejects a phone number that is not a US number", async () => {
    const response = await handleRequest(post({ ...valid, phone: "123" }), signed());
    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      ok: false;
      errors: { phone?: { code: string; message: string } };
    };
    expect(payload.errors.phone).toEqual({
      code: "invalid",
      message: "Enter a valid US phone number.",
    });
    expect(JSON.stringify(payload)).not.toContain("123");
  });

  it("returns 503 when live storage has no store, without echoing the body", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      lines.push(String(message));
    });
    const response = await handleRequest(post({ ...valid, firstName: "Zephyr" }), { ...assets(), ...sessionDeps() });
    expect(response.status).toBe(503);
    const dumped = `${JSON.stringify(await response.json())}\n${lines.join("\n")}`;
    expect(dumped).not.toContain("Zephyr");
    expect(lines.join("\n")).toContain("signup_store_missing");
  });

  it("returns 500 when the store fails, without echoing the body", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      lines.push(String(message));
    });
    const deps: RequestDeps = {
      ...assets(),
      ...sessionDeps(),
      signupStore: {
        save: async () => {
          throw new Error("disk_full");
        },
        saveOptOuts: async () => {},
      },
    };
    const response = await handleRequest(post({ ...valid, firstName: "Zephyr" }), deps);
    expect(response.status).toBe(500);
    const dumped = `${JSON.stringify(await response.json())}\n${lines.join("\n")}`;
    expect(dumped).not.toContain("Zephyr");
    expect(dumped).not.toContain("disk_full");
    expect(lines.join("\n")).toContain("signup_store_failed");
  });

  it("redirects www to the apex before API forwarding or assets", async () => {
    let forwarded = false;
    let usedAsset = false;
    const deps = {
      fetchAsset: async () => {
        usedAsset = true;
        return new Response("asset", { status: 200 });
      },
      forwardApi: () => {
        forwarded = true;
        return Promise.resolve(new Response("api", { status: 200 }));
      },
    };

    const get = await handleRequest(
      new Request("https://www.droptexas.com/account?tab=history"),
      deps,
    );
    expect(get.status).toBe(301);
    expect(get.headers.get("location")).toBe("https://droptexas.com/account?tab=history");

    const post = await handleRequest(
      new Request("https://www.droptexas.com/api/signup?return_to=%2Fstart", {
        method: "POST",
        body: JSON.stringify({ email: "ada@example.com" }),
        headers: { "content-type": "application/json" },
      }),
      deps,
    );
    expect(post.status).toBe(308);
    expect(post.headers.get("location")).toBe("https://droptexas.com/api/signup?return_to=%2Fstart");
    expect(forwarded).toBe(false);
    expect(usedAsset).toBe(false);

    const apex = await handleRequest(new Request("https://droptexas.com/account?tab=history"), assets());
    expect(apex.status).toBe(200);
    const local = await handleRequest(new Request("http://localhost:8787/account?tab=history"), assets());
    expect(local.status).toBe(200);
  });

  it("serves non-API requests from static assets", async () => {
    const response = await handleRequest(new Request("https://optout.example/"), assets());
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Privacy is a right.");
  });

  it("serves the SPA shell for client routes", async () => {
    for (const path of [
      "/security",
      "/privacy",
      "/brokers",
      "/overview",
      "/how-it-works",
      "/personal-information",
      "/data-brokers",
      "/unique-identifiers",
      "/tdpsa",
      "/children",
      "/benefits/control",
      "/benefits/spam",
      "/benefits/security",
      "/benefits/time",
      "/benefits/cost",
      "/benefits/rights",
      "/benefits/children",
      "/help",
      "/share",
      "/start",
      "/about",
      "/account",
    ]) {
      const response = await handleRequest(new Request(`https://optout.example${path}`), assets());
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    }
  });

  it("returns JSON 404 for unknown API paths when the binding is absent", async () => {
    const response = await handleRequest(new Request("https://optout.example/api/me"), assets());
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    const payload = (await response.json()) as { form: { code: string } };
    expect(payload.form.code).toBe("not_found");
  });

  it("forwards other API paths and keeps Set-Cookie when the binding is present", async () => {
    const original = new Request("https://optout.example/api/me", {
      headers: { cookie: "sid=1", origin: "https://optout.example" },
    });
    let forwarded: Request | null = null;
    const response = await handleRequest(original, {
      ...assets(),
      proxySigner: testSigner,
      forwardApi: (upstream) => {
        forwarded = upstream;
        return Promise.resolve(
          new Response(JSON.stringify({ user: { email: "ada@example.com" }, csrf: "tok" }), {
            status: 200,
            headers: { "set-cookie": "__Host-sid=abc; Path=/; HttpOnly; Secure", "content-type": "application/json" },
          }),
        );
      },
    });
    expect(forwarded).not.toBeNull();
    expect(forwarded!.headers.get("cookie")).toBeNull();
    expect(response.headers.get("set-cookie")).toBe("__Host-sid=abc; Path=/; HttpOnly; Secure");
    expect(response.status).toBe(200);
  });

  it("sends noindex for account and sign-in paths that fall back to the shell", async () => {
    for (const path of ["/account/history", "/account/settings/export", "/signin/callback", "/signin/oauth/callback"]) {
      const response = await handleRequest(new Request(`https://droptexas.com${path}`), assets());
      expect(response.status, path).toBe(200);
      expect(response.headers.get("content-type"), path).toContain("text/html");
      expect(response.headers.get("x-robots-tag"), path).toBe("noindex");
      expect(await response.text(), path).toContain('name="robots" content="noindex, nofollow"');
    }
    const indexed = await handleRequest(new Request("https://droptexas.com/account/history"), {
      fetchAsset: async () =>
        new Response('<head><meta name="robots" content="index, follow" /></head>', {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    });
    const shell = await indexed.text();
    expect(shell).toContain('name="robots" content="noindex, nofollow"');
    expect(shell).not.toContain("index, follow");
    const rewritten = await handleRequest(new Request("https://droptexas.com/account/history"), {
      fetchAsset: async () =>
        new Response("<head><title>Account</title></head>", {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "content-length": "999",
            etag: '"stale"',
          },
        }),
    });
    expect(rewritten.status).toBe(200);
    expect(rewritten.headers.get("x-robots-tag")).toBe("noindex");
    expect(rewritten.headers.get("content-length")).toBeNull();
    expect(rewritten.headers.get("etag")).toBeNull();
    const notModified = await handleRequest(new Request("https://droptexas.com/signin/callback"), {
      fetchAsset: async () =>
        new Response(null, {
          status: 304,
          headers: {
            etag: '"abc"',
            "content-type": "text/html",
          },
        }),
    });
    expect(notModified.status).toBe(304);
    expect(notModified.headers.get("x-robots-tag")).toBe("noindex");
    expect(notModified.headers.get("etag")).toBe('"abc"');
    expect(await notModified.text()).toBe("");
    const account = await handleRequest(new Request("https://droptexas.com/account"), assets());
    expect(account.headers.get("x-robots-tag")).toBe("noindex");
    const signIn = await handleRequest(new Request("https://droptexas.com/signin"), assets());
    expect(signIn.status).toBe(302);
    expect(signIn.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("redirects /signin to the accounts host and drops an unsafe return path", async () => {
    const kept = await handleRequest(new Request("https://droptexas.com/signin?return_to=/account"), assets());
    expect(kept.status).toBe(302);
    expect(kept.headers.get("location")).toBe("https://accounts.droptexas.com/signin?return_to=%2Faccount");

    const step = await handleRequest(
      new Request(`https://droptexas.com/signin?return_to=${encodeURIComponent("/start#step-4")}`),
      assets(),
    );
    expect(step.status).toBe(302);
    expect(step.headers.get("location")).toBe("https://accounts.droptexas.com/signin?return_to=%2Fstart%23step-4");

    const dropped = await handleRequest(
      new Request("https://droptexas.com/signin?return_to=//evil.example"),
      assets(),
    );
    expect(dropped.status).toBe(302);
    expect(dropped.headers.get("location")).toBe("https://accounts.droptexas.com/signin?return_to=%2Fstart");
  });

  it("forwards /api/auth/complete and every other API path instead of the SPA shell", async () => {
    const paths = [
      "/api/auth/complete?code=abc",
      "/api/me",
      "/api/account/profile",
      "/api/account/identities/google/link",
      "/api/auth/microsoft/stepup",
    ];
    for (const path of paths) {
      let usedAsset = false;
      let forwarded = false;
      const method = path.includes("/link") || path.endsWith("/stepup") ? "POST" : "GET";
      const response = await handleRequest(new Request(`https://droptexas.com${path}`, { method, headers: { origin: "https://droptexas.com" } }), {
        proxySigner: testSigner,
        fetchAsset: async () => {
          usedAsset = true;
          return new Response("<!doctype html>", { headers: { "content-type": "text/html" } });
        },
        forwardApi: () => {
          forwarded = true;
          return Promise.resolve(new Response(null, { status: 204 }));
        },
      });
      expect(usedAsset, path).toBe(false);
      expect(forwarded, path).toBe(true);
      expect(response.status, path).toBe(204);
      expect(response.headers.get("content-type") ?? "", path).not.toContain("text/html");
    }
  });

  it("forwards /api/auth/complete and does not serve the SPA shell", async () => {
    let usedAsset = false;
    const missing = await handleRequest(new Request("https://droptexas.com/api/auth/complete?code=abc"), {
      fetchAsset: async () => {
        usedAsset = true;
        return new Response("<!doctype html>", { headers: { "content-type": "text/html" } });
      },
    });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).toContain("application/json");
    expect(usedAsset).toBe(false);

    let forwarded = false;
    const bound = await handleRequest(new Request("https://droptexas.com/api/auth/complete?code=abc"), {
      proxySigner: testSigner,
      fetchAsset: async () => {
        usedAsset = true;
        return new Response("<!doctype html>", { headers: { "content-type": "text/html" } });
      },
      forwardApi: () => {
        forwarded = true;
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      },
    });
    expect(forwarded).toBe(true);
    expect(usedAsset).toBe(false);
    expect(bound.status).toBe(200);
  });

  it("returns JSON 404 for removed auth routes and does not forward them", async () => {
    for (const path of ["/api/auth/apple/start", "/api/auth/apple/stepup"]) {
      let forwarded = false;
      const response = await handleRequest(new Request(`https://optout.example${path}`), {
        ...assets(),
        forwardApi: () => {
          forwarded = true;
          return Promise.resolve(new Response("nope", { status: 200 }));
        },
      });
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(forwarded).toBe(false);
    }
  });

  it("keeps signup local even when a backend binding exists", async () => {
    let forwarded = false;
    const { deps } = saving();
    const response = await handleRequest(post(valid), {
      ...deps,
      forwardApi: () => {
        forwarded = true;
        return Promise.resolve(new Response("nope", { status: 500 }));
      },
    });
    expect(forwarded).toBe(false);
    expect(response.status).toBe(200);
  });

  it("stores the session user and posts the signup to the account when a csrf token is present", async () => {
    const calls: Request[] = [];
    const { deps, saved } = saving();
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      lines.push(String(message));
    });
    const response = await handleRequest(
      post(valid, { cookie: "__Host-sid=abc", "x-csrf-token": "csrf-1" }),
      {
        ...deps,
        proxySigner: testSigner,
        callApi: {
          fetch: async (accountRequest) => {
            calls.push(accountRequest);
            const path = new URL(accountRequest.url).pathname;
            if (path === "/api/me") {
              return new Response(JSON.stringify({ user: { id: "user-1", display_name: "Ada Lovelace" }, csrf_token: "csrf-1" }), {
                status: 200,
                headers: { "content-type": "application/json" },
              });
            }
            return new Response(JSON.stringify({ ok: true, id: "acct-1" }), { status: 201 });
          },
        },
      },
    );
    expect(response.status).toBe(200);
    expect(saved[0]?.userId).toBe("user-1");
    const posted = calls.find((accountRequest) => new URL(accountRequest.url).pathname === "/api/optouts/signup");
    expect(posted?.method).toBe("POST");
    expect(posted?.headers.get("x-csrf-token")).toBeNull();
    expect(posted?.headers.get("origin")).toBe("https://droptexas.com");
    expect(posted?.headers.get("x-internal-auth")).toMatch(/^v1\.k1\./);
    const sent = JSON.parse(await posted!.text()) as { fullName: string; mailingAddress: string };
    expect(sent.fullName).toBe("Ada Lovelace");
    expect(sent.mailingAddress).toContain("123 Main St");
    expect(sent.mailingAddress).toContain("Austin, TX 78701");
    const dumped = lines.join("\n");
    expect(dumped).toContain("signup_account_linked");
    expect(dumped).not.toContain("Ada");
    expect(dumped).not.toContain("ada@example.com");
  });

  it("keeps the local signup when the account link is refused", async () => {
    const { deps, saved } = saving();
    const response = await handleRequest(post(valid, { cookie: "__Host-sid=abc", "x-csrf-token": "csrf-1" }), {
      ...deps,
      callApi: {
        fetch: async (accountRequest) => {
          const path = new URL(accountRequest.url).pathname;
          if (path === "/api/me") {
            return new Response(JSON.stringify({ user: { id: "user-1" } }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        },
      },
    });
    expect(response.status).toBe(200);
    expect(saved[0]?.userId).toBe("user-1");
  });
});
