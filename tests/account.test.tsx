/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { optOutLabel, patchDisplayName, type OptOutRecord } from "../src/api/account";
import { isStepUpRequired } from "../src/api/stepUp";
import { LOGOUT_PATH } from "../src/api";
import { fetchMe, type MeOk } from "../src/authGate";
import { Header } from "../src/Header";
import { AccountPage, AccountView } from "../src/pages/AccountPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const me: MeOk = {
  ok: true,
  user: {
    id: "user-1",
    display_name: "Ada Lovelace",
    has_password: false,
    totp_enabled: false,
    created_at: 1_700_000_000,
  },
  providers: [{ provider: "google" }, { provider: "apple" }],
  auth_method: "google",
  mfa: false,
  limited: false,
  stepped_up_until: null,
  csrf_token: "csrf-1",
};

function record(status: string, sub_status: string | null, id = status): OptOutRecord {
  return {
    id,
    kind: "broker",
    status,
    sub_status,
    broker_id: "spokeo",
    service_id: null,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_100,
    submitted_at: null,
    confirmed_at: null,
    finished_at: null,
    deadline: null,
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("opt-out status labels", () => {
  it("maps pending, in_progress, and confirmed", () => {
    expect(optOutLabel({ status: "pending" })).toBe("Pending");
    expect(optOutLabel({ status: "in_progress" })).toBe("Submitted");
    expect(optOutLabel({ status: "confirmed" })).toBe("Confirmed");
  });

  it("shows No record found whenever sub_status is no_record", () => {
    expect(optOutLabel({ status: "confirmed", sub_status: "no_record" })).toBe("No record found");
    expect(optOutLabel({ status: "in_progress", sub_status: "no_record" })).toBe("No record found");
    expect(optOutLabel({ status: "pending", sub_status: "no_record" })).toBe("No record found");
  });

  it("shows Pending for denied until Ben chooses a label", () => {
    const source = readFileSync("src/api/account.ts", "utf8");
    expect(source).toContain("TODO: label for denied needs Ben's decision");
    expect(optOutLabel({ status: "denied", sub_status: null })).toBe("Pending");
    expect(optOutLabel({ status: "denied", sub_status: "no_record" })).toBe("No record found");
  });
});

describe("csrf_token", () => {
  it("reads csrf_token from GET /api/me and ignores a csrf field", async () => {
    const ok = await fetchMe(async () =>
      json(200, {
        user: me.user,
        providers: [{ provider: "google", verified: true, private_relay: false }],
        auth_method: "google",
        mfa: false,
        limited: false,
        stepped_up_until: null,
        csrf_token: "csrf-1",
      }),
    );
    expect(ok.ok && ok.csrf_token).toBe("csrf-1");

    const missing = await fetchMe(async () => json(200, { user: me.user, csrf: "legacy" }));
    expect(missing.ok).toBe(false);
  });

  it("sends X-CSRF-Token from csrf_token on profile updates and logout", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return json(200, { ok: true });
    }) as typeof fetch;

    await patchDisplayName("Ada", "csrf-1", fetchImpl);
    expect(calls[0]?.url).toBe("/api/account/profile");
    expect(calls[0]?.init?.method).toBe("PATCH");
    expect(calls[0]?.init?.credentials).toBe("same-origin");
    expect(calls[0]?.init?.headers).toMatchObject({ "X-CSRF-Token": "csrf-1" });
    expect(String(calls[0]?.init?.body)).toBe(JSON.stringify({ display_name: "Ada" }));

    const user = userEvent.setup();
    vi.stubGlobal("fetch", fetchImpl);
    render(<Header signedIn csrf="csrf-1" signInHref="/signin?return_to=/start" onSignedOut={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "Account" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    const logout = calls.find((call) => call.url === LOGOUT_PATH);
    expect(logout?.init?.method).toBe("POST");
    expect(logout?.init?.credentials).toBe("same-origin");
    expect(logout?.init?.headers).toMatchObject({ "X-CSRF-Token": "csrf-1" });
  });
});

describe("step-up", () => {
  it("treats 401 and 403 step-up errors as a prompt, and ignores other failures", () => {
    expect(isStepUpRequired(403, { error: "step_up_required" })).toBe(true);
    expect(isStepUpRequired(401, { code: "stepup" })).toBe(true);
    expect(isStepUpRequired(403, { error: "forbidden" })).toBe(false);
    expect(isStepUpRequired(404, { error: "step_up_required" })).toBe(false);
  });

  it("asks to confirm it's you and follows the provider step-up url", async () => {
    const user = userEvent.setup();
    const calls: { url: string; init?: RequestInit }[] = [];
    const goTo = vi.fn();
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/account/profile")) return json(200, { display_name: "Ada Lovelace", identifiers_locked: true });
      if (url.endsWith("/api/account/sessions")) return json(200, { sessions: [] });
      if (url.endsWith("/api/account/optouts")) return json(403, { error: "step_up_required" });
      if (url.endsWith("/api/auth/google/stepup")) return json(200, { url: "https://accounts.example/stepup" });
      return json(404, { error: "not_found" });
    }) as typeof fetch;

    render(<AccountPage action="form" me={me} fetchImpl={fetchImpl} goTo={goTo} />);
    expect(await screen.findByRole("dialog", { name: "Confirm it's you" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    const step = calls.find((call) => call.url.endsWith("/api/auth/google/stepup"));
    expect(step?.init?.method).toBe("POST");
    expect(step?.init?.credentials).toBe("same-origin");
    expect(step?.init?.headers).toMatchObject({ "X-CSRF-Token": "csrf-1" });
    expect(String(step?.init?.body)).toContain("/account");
    expect(goTo).toHaveBeenCalledWith("https://accounts.example/stepup");
  });
});

describe("account dashboard", () => {
  it("shows labels and hides confirmation numbers", () => {
    render(
      <AccountView
        profile={{ display_name: "Ada Lovelace", identifiers_locked: true }}
        optouts={[record("in_progress", null, "a"), record("confirmed", "no_record", "b"), record("denied", null, "c")]}
        sessions={[
          {
            id: "sess-1",
            auth_method: "google",
            created_at: 1_700_000_000,
            last_seen_at: 1_700_000_100,
            expires_at: 1_700_100_000,
            current: true,
          },
        ]}
        providers={["google"]}
        editing={false}
        draft=""
        profileError={false}
        historyError={false}
        sessionsError={false}
        saveError={false}
        actionError={null}
        notice={null}
        stepUp={false}
        stepUpError={null}
        confirmDelete={false}
        onEdit={() => undefined}
        onDraft={() => undefined}
        onSaveName={(event) => event.preventDefault()}
        onCancelEdit={() => undefined}
        onRevoke={() => undefined}
        onExport={() => undefined}
        onAskDelete={() => undefined}
        onConfirmDelete={() => undefined}
        onCancelDelete={() => undefined}
        onStepUp={() => undefined}
      />,
    );
    expect(screen.getByText("Display name: Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Submitted")).toBeTruthy();
    expect(screen.getByText("No record found")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("This device")).toBeTruthy();
    expect(screen.getByText("No reminders yet")).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: /confirmation/i })).toBeNull();
    expect(screen.queryByText(/verified/i)).toBeNull();
  });

  it("renders empty states when account endpoints 404", async () => {
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials ?? "same-origin").toBe("same-origin");
      expect(String(input)).toMatch(/^\/api\/account\/(profile|optouts|sessions)$/);
      return json(404, { ok: false, errors: {}, form: { code: "not_found", message: "Not found." } });
    }) as typeof fetch;

    render(<AccountPage action="form" me={me} fetchImpl={fetchImpl} />);
    expect(await screen.findByText("No requests yet")).toBeTruthy();
    expect(screen.getByText("No reminders yet")).toBeTruthy();
    expect(screen.getByText("No sessions yet")).toBeTruthy();
    expect(screen.getByText("Display name: Not provided")).toBeTruthy();
    expect(screen.queryByText(/confirmation/i)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders an error state when the account request fails on the network", async () => {
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    render(<AccountPage action="form" me={null} fetchImpl={fetchImpl} />);
    expect(await screen.findByText("Opt-out history could not be loaded.")).toBeTruthy();
    expect(screen.getByText("Profile could not be loaded.")).toBeTruthy();
    expect(screen.getByText("Sessions could not be loaded.")).toBeTruthy();
    expect(screen.getByText("No reminders yet")).toBeTruthy();
  });
});
