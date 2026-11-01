import { afterEach, describe, expect, it, vi } from "vitest";
import { validateSignup } from "../shared/signup";
import { handleRequest } from "../worker/handle";

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

  it("rejects a missing or impossible date of birth with the shared error", async () => {
    for (const dob of [undefined, "2024-02-31"]) {
      const body = { ...valid, dob };
      const expected = validateSignup(body);
      const response = await handleRequest(post(body), assets());
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
    const response = await handleRequest(post(body), assets());
    const payload = (await response.json()) as { errors: Record<string, { code: string }> };
    expect(response.status).toBe(400);
    expect(expected.ok).toBe(false);
    if (!expected.ok) {
      expect(payload.errors.dob?.code).toBe(expected.errors.dob?.code);
      expect(payload.errors.guardianAttestation?.code).toBe(expected.errors.guardianAttestation?.code);
    }

    const selfBody = { ...valid, submitter: "self", child: { firstName: "Grace" } };
    const selfResponse = await handleRequest(post(selfBody), assets());
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
    const response = await handleRequest(post(body), assets());
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

    const jsonResponse = await handleRequest(post("{"), assets());
    expect(jsonResponse.status).toBe(400);
    const payload = (await jsonResponse.json()) as { form: { code: string } };
    expect(payload.form.code).toBe("invalid_json");
  });

  it("rejects an oversized body before treating it as field data", async () => {
    const huge = JSON.stringify({ ...valid, firstName: "A".repeat(9000) });
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
      ...valid,
      firstName: "Zephyr",
      lastName: "Quill",
      addressLine1: "500 Secret Hollow",
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

  it("accepts an empty phone and stores a valid one only as E.164", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message) => {
      lines.push(String(message));
    });

    const missing = await handleRequest(post(valid), assets());
    expect(missing.status).toBe(200);

    const empty = await handleRequest(post({ ...valid, phone: "" }), assets());
    expect(empty.status).toBe(200);

    const blank = await handleRequest(post({ ...valid, phone: null }), assets());
    expect(blank.status).toBe(200);

    const accepted = await handleRequest(post({ ...valid, phone: "1 (512) 555-0100" }), assets());
    expect(accepted.status).toBe(200);
    const acceptedBody = JSON.stringify(await accepted.json());
    expect(acceptedBody).not.toContain("512");
    expect(lines.join("\n")).not.toContain("5125550100");
    expect(lines.join("\n")).not.toContain("+15125550100");
  });

  it("rejects a phone number that is not a US number", async () => {
    const response = await handleRequest(post({ ...valid, phone: "123" }), assets());
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
      forwardApi: () => {
        forwarded = original;
        return Promise.resolve(
          new Response(JSON.stringify({ user: { email: "ada@example.com" }, csrf: "tok" }), {
            status: 200,
            headers: { "set-cookie": "session=abc; HttpOnly", "content-type": "application/json" },
          }),
        );
      },
    });
    expect(forwarded).toBe(original);
    expect(original.headers.get("cookie")).toBe("sid=1");
    expect(response.headers.get("set-cookie")).toBe("session=abc; HttpOnly");
    expect(response.status).toBe(200);
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
      "/api/account/export",
      "/api/account/identities/google/link",
      "/api/auth/microsoft/stepup",
      "/api/optouts/signup",
    ];
    for (const path of paths) {
      let usedAsset = false;
      let forwarded = false;
      const response = await handleRequest(new Request(`https://droptexas.com${path}`), {
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
    const response = await handleRequest(post(valid), {
      forwardApi: () => {
        forwarded = true;
        return Promise.resolve(new Response("nope", { status: 500 }));
      },
    });
    expect(forwarded).toBe(false);
    expect(response.status).toBe(200);
  });
});
