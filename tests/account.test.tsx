/**
 * @vitest-environment happy-dom
 */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exportAccount, linkIdentity, optOutLabel, patchDisplayName, submitStart, unlinkIdentity, type OptOutRecord } from "../src/api/account";
import { isStepUpRequired, stepUpChoices } from "../src/api/stepUp";
import { LOGOUT_PATH } from "../src/api";
import { App } from "../src/App";
import { fetchMe, signInHrefFor, type MeOk } from "../src/authGate";
import { Header } from "../src/Header";
import { AccountPage, AccountView } from "../src/pages/AccountPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
  providers: [{ provider: "google" }, { provider: "microsoft" }],
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

  it("shows Not completed for denied, and No record found when sub_status is no_record", () => {
    const source = readFileSync("src/api/account.ts", "utf8");
    expect(source).not.toContain("TODO: label for denied needs Ben's decision");
    expect(optOutLabel({ status: "denied", sub_status: null })).toBe("Not completed");
    expect(optOutLabel({ status: "denied" })).toBe("Not completed");
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
    render(<Header signedIn csrf="csrf-1" signInHref={signInHrefFor("/start")} accountsLive onSignedOut={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "Account" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    const logout = calls.find((call) => call.url === LOGOUT_PATH);
    expect(logout?.init?.method).toBe("POST");
    expect(logout?.init?.credentials).toBe("same-origin");
    expect(logout?.init?.headers).toMatchObject({ "X-CSRF-Token": "csrf-1" });
  });
});

describe("step-up", () => {
  it("matches only HTTP 403 with error step_up_required", () => {
    expect(isStepUpRequired(403, { error: "step_up_required" })).toBe(true);
    expect(isStepUpRequired(401, { error: "step_up_required" })).toBe(false);
    expect(isStepUpRequired(403, { code: "stepup" })).toBe(false);
    expect(isStepUpRequired(403, { error: "stepup" })).toBe(false);
    expect(isStepUpRequired(403, { error: "step-up required" })).toBe(false);
    expect(isStepUpRequired(403, { message: "step_up_required" })).toBe(false);
    expect(isStepUpRequired(404, { error: "step_up_required" })).toBe(false);
    expect(isStepUpRequired(403, "step_up_required")).toBe(false);
  });

  it("offers linked Google or Microsoft accounts, plus password when one is set", () => {
    expect(stepUpChoices([{ provider: "google" }, { provider: "microsoft" }], false)).toEqual({
      providers: ["google", "microsoft"],
      offerPassword: false,
    });
    expect(stepUpChoices([{ provider: "google" }, { provider: "other" }], true)).toEqual({
      providers: ["google"],
      offerPassword: true,
    });
    expect(stepUpChoices([], false)).toEqual({
      providers: [],
      offerPassword: false,
    });
  });

  it("asks to confirm it's you and follows the provider step-up url", async () => {
    const user = userEvent.setup();
    const calls: { url: string; init?: RequestInit }[] = [];
    const goTo = vi.fn();
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => undefined);
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/account/profile")) return json(200, { display_name: "Ada Lovelace", identifiers_locked: true });
      if (url.endsWith("/api/account/sessions")) return json(200, { sessions: [] });
      if (url.endsWith("/api/account/optouts")) return json(403, { error: "step_up_required" });
      if (url.endsWith("/api/auth/google/stepup")) {
        return json(200, {
          action: "https://accounts.droptexas.com/oauth/google/bound",
          method: "POST",
          fields: { st: "step-token" },
        });
      }
      return json(404, { error: "not_found" });
    }) as typeof fetch;

    render(<AccountPage action="form" me={me} fetchImpl={fetchImpl} goTo={goTo} />);
    expect(await screen.findByRole("dialog", { name: "Confirm it's you" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Microsoft" })).toBeTruthy();
    expect(screen.queryByText("Password + authenticator code")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    const step = calls.find((call) => call.url.endsWith("/api/auth/google/stepup"));
    expect(step?.init?.method).toBe("POST");
    expect(step?.init?.credentials).toBe("same-origin");
    expect(step?.init?.headers).toMatchObject({ "X-CSRF-Token": "csrf-1" });
    expect(String(step?.init?.body)).toContain("/account");
    expect(goTo).not.toHaveBeenCalled();
    const form = document.body.querySelector("form");
    expect(form?.getAttribute("action")).toBe("https://accounts.droptexas.com/oauth/google/bound");
    expect(form?.method.toLowerCase()).toBe("post");
    expect((form?.querySelector("input[name=st]") as HTMLInputElement | null)?.value).toBe("step-token");
    expect(submit).toHaveBeenCalled();
    form?.remove();
  });

  it("posts the password and authenticator code, then clears the fields", async () => {
    const user = userEvent.setup();
    const calls: { url: string; init?: RequestInit }[] = [];
    const logs: unknown[][] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args);
    });
    vi.spyOn(console, "info").mockImplementation((...args) => {
      logs.push(args);
    });
    vi.spyOn(console, "debug").mockImplementation((...args) => {
      logs.push(args);
    });
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      const url = String(input);
      if (url.endsWith("/api/account/profile")) return json(200, { display_name: "Ada Lovelace", identifiers_locked: true });
      if (url.endsWith("/api/account/sessions")) return json(200, { sessions: [] });
      if (url.endsWith("/api/account/optouts")) return json(403, { error: "step_up_required" });
      if (url.endsWith("/api/auth/stepup/password")) return json(200, { ok: true, stepped_up_until: 1_700_000_600 });
      return json(404, { error: "not_found" });
    }) as typeof fetch;

    render(
      <AccountPage
        action="form"
        me={{ ...me, user: { ...me.user, has_password: true }, providers: [{ provider: "microsoft" }] }}
        fetchImpl={fetchImpl}
      />,
    );
    expect(await screen.findByRole("dialog", { name: "Confirm it's you" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Microsoft" })).toBeTruthy();
    expect(screen.getByText("Password + authenticator code")).toBeTruthy();
    await user.type(screen.getByLabelText("Password"), "secret-pass");
    await user.type(screen.getByLabelText("Authenticator code"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    const step = calls.find((call) => call.url.endsWith("/api/auth/stepup/password"));
    expect(step?.init?.method).toBe("POST");
    expect(step?.init?.credentials).toBe("same-origin");
    expect(step?.init?.headers).toMatchObject({ "X-CSRF-Token": "csrf-1" });
    expect(String(step?.init?.body)).toBe(JSON.stringify({ password: "secret-pass", code: "123456" }));
    expect(logs.flat().join(" ")).not.toContain("secret-pass");
    expect(logs.flat().join(" ")).not.toContain("123456");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Confirm it's you" })).toBeNull();
  });

  it("posts the data export with the csrf token", async () => {
    const user = userEvent.setup();
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      const url = String(input);
      if (url.endsWith("/api/account/export")) return json(200, { ok: true });
      if (url.endsWith("/api/account/profile")) return json(200, { display_name: "Ada Lovelace", identifiers_locked: true });
      if (url.endsWith("/api/account/optouts")) return json(200, { optouts: [] });
      if (url.endsWith("/api/account/sessions")) return json(200, { sessions: [] });
      return json(404, { error: "not_found" });
    }) as typeof fetch;

    await exportAccount("csrf-1", fetchImpl);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:export");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    render(<AccountPage action="form" me={me} fetchImpl={fetchImpl} />);
    await user.click(await screen.findByRole("button", { name: "Export my data" }));

    const posts = calls.filter((call) => call.url.endsWith("/api/account/export"));
    expect(posts).toHaveLength(2);
    for (const post of posts) {
      expect(post.init?.method).toBe("POST");
      expect(post.init?.credentials).toBe("same-origin");
      expect(post.init?.headers).toMatchObject({ "X-CSRF-Token": "csrf-1" });
    }
  });
});

describe("submitStart", () => {
  it("posts hidden fields to an allowed host and refuses anything else", () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => undefined);
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => undefined);
    expect(
      submitStart({
        action: "https://droptexas.com/oauth/google/bound",
        method: "POST",
        fields: { st: "token-1", extra: "yes" },
      }),
    ).toBe(true);
    const form = document.body.querySelector("form");
    expect(form?.getAttribute("action")).toBe("https://droptexas.com/oauth/google/bound");
    expect(form?.method.toLowerCase()).toBe("post");
    expect((form?.querySelector("input[name=st]") as HTMLInputElement | null)?.value).toBe("token-1");
    expect((form?.querySelector("input[name=extra]") as HTMLInputElement | null)?.value).toBe("yes");
    expect(submit).toHaveBeenCalledOnce();
    expect(assign).not.toHaveBeenCalled();
    form?.remove();

    for (const action of [
      "http://droptexas.com/oauth/google/bound",
      "https://evil.example/oauth/google/bound",
      "https://droptexas.com.evil.com/oauth/google/bound",
      "https://accounts.droptexas.com.evil.com/bound",
      "javascript:alert(1)",
    ]) {
      expect(submitStart({ action, method: "POST", fields: { st: "t" } })).toBe(false);
    }
    expect(
      submitStart({
        action: "https://accounts.droptexas.com/oauth/microsoft/bound",
        method: "GET",
        fields: { st: "t" },
      }),
    ).toBe(false);
    expect(document.body.querySelector("form")).toBeNull();
    expect(submit).toHaveBeenCalledOnce();
  });
});

describe("linked identities", () => {
  it("links and unlinks Google or Microsoft, and asks for step-up", async () => {
    const user = userEvent.setup();
    const calls: { url: string; init?: RequestInit }[] = [];
    const goTo = vi.fn();
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => undefined);
    let unlinked = false;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/account/profile")) return json(200, { display_name: "Ada Lovelace", identifiers_locked: true });
      if (url.endsWith("/api/account/optouts")) return json(200, { optouts: [] });
      if (url.endsWith("/api/account/sessions")) return json(200, { sessions: [] });
      if (url.endsWith("/api/account/identities/microsoft/link")) {
        return json(200, {
          action: "https://accounts.droptexas.com/oauth/microsoft/bound",
          method: "POST",
          fields: { st: "link-token" },
        });
      }
      if (url.endsWith("/api/account/identities/google")) {
        if (!unlinked) {
          unlinked = true;
          return json(403, { error: "step_up_required" });
        }
        return json(200, { ok: true });
      }
      return json(404, { error: "not_found" });
    }) as typeof fetch;

    render(
      <AccountPage
        action="form"
        me={{ ...me, providers: [{ provider: "google" }] }}
        fetchImpl={fetchImpl}
        goTo={goTo}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "Link Microsoft" }));
    const link = calls.find((call) => call.url.endsWith("/api/account/identities/microsoft/link"));
    expect(link?.init?.method).toBe("POST");
    expect(link?.init?.credentials).toBe("same-origin");
    expect(link?.init?.headers).toMatchObject({ "X-CSRF-Token": "csrf-1" });
    expect(String(link?.init?.body)).toBe(JSON.stringify({ return_to: "/account" }));
    expect(goTo).not.toHaveBeenCalled();
    const form = document.body.querySelector("form");
    expect(form?.getAttribute("action")).toBe("https://accounts.droptexas.com/oauth/microsoft/bound");
    expect((form?.querySelector("input[name=st]") as HTMLInputElement | null)?.value).toBe("link-token");
    expect(submit).toHaveBeenCalled();
    form?.remove();
    expect(screen.queryByRole("button", { name: /Apple/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Unlink Google" }));
    expect(await screen.findByRole("dialog", { name: "Confirm it's you" })).toBeTruthy();
    const denied = calls.find((call) => call.url.endsWith("/api/account/identities/google"));
    expect(denied?.init?.method).toBe("DELETE");
    expect(denied?.init?.headers).toMatchObject({ "X-CSRF-Token": "csrf-1" });

    const rejected = await linkIdentity("other", "csrf-1", fetchImpl);
    expect(rejected.ok).toBe(false);
    const removed = await unlinkIdentity("other", "csrf-1", fetchImpl);
    expect(removed.ok).toBe(false);
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
        stepUpProviders={["google"]}
        offerPassword={false}
        linkedProviders={["google"]}
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
        onPasswordStepUp={() => undefined}
        onLink={() => undefined}
        onUnlink={() => undefined}
      />,
    );
    expect(screen.getByText("Display name: Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Submitted")).toBeTruthy();
    expect(screen.getByText("No record found")).toBeTruthy();
    expect(screen.getByText("Not completed")).toBeTruthy();
    expect(screen.queryByText("denied")).toBeNull();
    expect(screen.queryByText("Pending")).toBeNull();
    expect(screen.getByText("This device")).toBeTruthy();
    expect(screen.getByText("No reminders yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unlink Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Link Microsoft" })).toBeTruthy();
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

const otherSession = {
  id: "sess-2",
  auth_method: "microsoft",
  created_at: 1_700_000_000,
  last_seen_at: 1_700_000_100,
  expires_at: 1_700_100_000,
  current: false,
};

function accountFetch(
  onCall: (url: string, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/account/profile")) return json(200, { display_name: "Ada Lovelace", identifiers_locked: true });
    if (url.endsWith("/api/account/optouts")) return json(200, { optouts: [] });
    if (url.endsWith("/api/account/sessions") && !url.includes("/revoke")) {
      return json(200, { sessions: [otherSession] });
    }
    return onCall(url, init);
  }) as typeof fetch;
}

describe("session revoke and account delete", () => {
  it("revokes a session with the csrf token and removes the row", async () => {
    const user = userEvent.setup();
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = accountFetch(async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/api/account/sessions/sess-2/revoke")) return json(200, { ok: true });
      return json(404, { error: "not_found" });
    });
    render(<AccountPage action="form" me={me} fetchImpl={fetchImpl} />);
    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    await waitFor(() => {
      expect(calls.some((call) => call.url.endsWith("/api/account/sessions/sess-2/revoke"))).toBe(true);
    });
    const revoke = calls.find((call) => call.url.endsWith("/api/account/sessions/sess-2/revoke"));
    expect(revoke?.init?.method).toBe("POST");
    expect(revoke?.init?.headers).toMatchObject({ "X-CSRF-Token": "csrf-1" });
    expect(await screen.findByText("No sessions yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
  });

  it("opens step-up when revoke returns 403 step_up_required and shows an error otherwise", async () => {
    const user = userEvent.setup();
    let mode: "step" | "error" = "step";
    const fetchImpl = accountFetch(async (url) => {
      if (!url.endsWith("/api/account/sessions/sess-2/revoke")) return json(404, { error: "not_found" });
      if (mode === "step") return json(403, { error: "step_up_required" });
      return json(500, { error: "nope" });
    });
    const view = render(<AccountPage action="form" me={me} fetchImpl={fetchImpl} />);
    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    expect(await screen.findByRole("dialog", { name: "Confirm it's you" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeTruthy();

    mode = "error";
    view.unmount();
    render(<AccountPage action="form" me={me} fetchImpl={fetchImpl} />);
    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not revoke that session.");
    expect(screen.queryByRole("dialog", { name: "Confirm it's you" })).toBeNull();
  });

  it("does not delete until confirmed, then posts and leaves, or asks for step-up", async () => {
    const user = userEvent.setup();
    const calls: { url: string; init?: RequestInit }[] = [];
    const goTo = vi.fn();
    let stepUp = false;
    const fetchImpl = accountFetch(async (url, init) => {
      calls.push({ url, init });
      if (!url.endsWith("/api/account/delete")) return json(404, { error: "not_found" });
      if (stepUp) return json(403, { error: "step_up_required" });
      return json(200, { ok: true });
    });
    const view = render(<AccountPage action="form" me={me} fetchImpl={fetchImpl} goTo={goTo} />);
    await user.click(await screen.findByRole("button", { name: "Delete my account" }));
    expect(screen.getByRole("dialog", { name: "Delete my account" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Delete my account" })).toBeNull();
    expect(calls.some((call) => call.url.endsWith("/api/account/delete"))).toBe(false);

    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    await waitFor(() => {
      expect(calls.some((call) => call.url.endsWith("/api/account/delete"))).toBe(true);
    });
    const deleted = calls.find((call) => call.url.endsWith("/api/account/delete"));
    expect(deleted?.init?.method).toBe("POST");
    expect(deleted?.init?.headers).toMatchObject({ "X-CSRF-Token": "csrf-1" });
    expect(goTo).toHaveBeenCalledWith("/");

    goTo.mockClear();
    stepUp = true;
    view.unmount();
    render(<AccountPage action="form" me={me} fetchImpl={fetchImpl} goTo={goTo} />);
    await user.click(await screen.findByRole("button", { name: "Delete my account" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByRole("dialog", { name: "Confirm it's you" })).toBeTruthy();
    expect(goTo).not.toHaveBeenCalled();
  });
});

describe("accounts coming soon", () => {
  it("does not show the account page while VITE_ACCOUNTS_LIVE is unset", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
      "http://localhost/account",
    );
    expect(window.location.pathname).toBe("/account");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Coming soon" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Your account" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete my account" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Export my data" })).toBeNull();
    (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
      "http://localhost/",
    );
    vi.unstubAllGlobals();
  });
});
