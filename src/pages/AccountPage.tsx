import { useEffect, useState, type FormEvent } from "react";
import {
  deleteAccount,
  exportAccount,
  fetchAccountProfile,
  fetchOptOuts,
  fetchSessions,
  formatUnix,
  optOutLabel,
  patchDisplayName,
  revokeSession,
  startProviderStepUp,
  type AccountProfile,
  type AccountSession,
  type OptOutRecord,
} from "../api/account";
import type { ApiErr, ApiOk } from "../api/http";
import type { MeOk } from "../authGate";
import { type StartAction, signInHrefFor } from "../authGate";
import { navigate } from "../router";

const EMPTY_PROFILE: AccountProfile = { display_name: null, identifiers_locked: true };

function providerLabel(provider: string): string {
  if (provider === "google") return "Google";
  if (provider === "apple") return "Apple";
  if (provider === "microsoft") return "Microsoft";
  return provider;
}

function optOutTitle(record: OptOutRecord): string {
  return record.broker_id || record.kind || "Opt-out";
}

function downloadExport(data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "drop-texas-export.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AccountView({
  profile,
  optouts,
  sessions,
  providers,
  editing,
  draft,
  profileError,
  historyError,
  sessionsError,
  saveError,
  actionError,
  notice,
  stepUp,
  stepUpError,
  confirmDelete,
  onEdit,
  onDraft,
  onSaveName,
  onCancelEdit,
  onRevoke,
  onExport,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
  onStepUp,
}: {
  profile: AccountProfile;
  optouts: OptOutRecord[];
  sessions: AccountSession[];
  providers: string[];
  editing: boolean;
  draft: string;
  profileError: boolean;
  historyError: boolean;
  sessionsError: boolean;
  saveError: boolean;
  actionError: string | null;
  notice: string | null;
  stepUp: boolean;
  stepUpError: string | null;
  confirmDelete: boolean;
  onEdit: () => void;
  onDraft: (value: string) => void;
  onSaveName: (event: FormEvent) => void;
  onCancelEdit: () => void;
  onRevoke: (id: string) => void;
  onExport: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onStepUp: (provider: string) => void;
}) {
  return (
    <article className="panel account-page">
      <h1>Your account</h1>

      <section className="account-section" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Profile</h2>
        {profileError ? <p role="alert">Profile could not be loaded.</p> : null}
        {editing ? (
          <form className="name-edit" onSubmit={onSaveName}>
            <label htmlFor="display-name">Display name</label>
            <input
              id="display-name"
              name="display_name"
              type="text"
              value={draft}
              onChange={(event) => onDraft(event.target.value)}
              autoComplete="nickname"
            />
            <div className="account-actions">
              <button type="submit">Save</button>
              <button type="button" className="quiet-button" onClick={onCancelEdit}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="name-row">
            <span>Display name: {profile.display_name?.trim() ? profile.display_name : "Not provided"}</span>
            <button type="button" className="quiet-button" onClick={onEdit}>
              Edit
            </button>
          </p>
        )}
        {saveError ? <p role="alert">Could not save your display name.</p> : null}
      </section>

      <section className="account-section" aria-labelledby="history-heading">
        <h2 id="history-heading">Opt-out history</h2>
        {historyError ? <p role="alert">Opt-out history could not be loaded.</p> : null}
        {!historyError && optouts.length === 0 ? <p>No requests yet</p> : null}
        {optouts.length > 0 ? (
          <table className="account-table">
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {optouts.map((record) => (
                <tr key={record.id}>
                  <td>{optOutTitle(record)}</td>
                  <td>{optOutLabel(record)}</td>
                  <td>{formatUnix(record.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="account-section" aria-labelledby="reminders-heading">
        <h2 id="reminders-heading">Re-verification reminders</h2>
        <p>No reminders yet</p>
      </section>

      <section className="account-section" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">Sessions</h2>
        {sessionsError ? <p role="alert">Sessions could not be loaded.</p> : null}
        {!sessionsError && sessions.length === 0 ? <p>No sessions yet</p> : null}
        {sessions.length > 0 ? (
          <table className="account-table">
            <thead>
              <tr>
                <th scope="col">Sign-in</th>
                <th scope="col">Created</th>
                <th scope="col">Last seen</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    {providerLabel(session.auth_method)}
                    {session.current ? <span className="device-badge">This device</span> : null}
                  </td>
                  <td>{formatUnix(session.created_at)}</td>
                  <td>{formatUnix(session.last_seen_at)}</td>
                  <td>
                    <button type="button" className="quiet-button" onClick={() => onRevoke(session.id)}>
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="account-section" aria-labelledby="controls-heading">
        <h2 id="controls-heading">Data controls</h2>
        <div className="account-actions">
          <button type="button" onClick={onExport}>
            Export my data
          </button>
          <button type="button" className="danger-button" onClick={onAskDelete}>
            Delete my account
          </button>
        </div>
        {notice ? <p>{notice}</p> : null}
        {actionError ? <p role="alert">{actionError}</p> : null}
      </section>

      {confirmDelete ? (
        <div className="dialog-backdrop">
          <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title">Delete my account</h2>
            <p>This permanently removes your account and sign-in.</p>
            <div className="account-actions">
              <button type="button" className="danger-button" onClick={onConfirmDelete}>
                Confirm delete
              </button>
              <button type="button" className="quiet-button" onClick={onCancelDelete}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stepUp ? (
        <div className="dialog-backdrop">
          <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="stepup-title">
            <h2 id="stepup-title">Confirm it's you</h2>
            <p>Sign in again to continue.</p>
            <div className="account-actions">
              {providers.map((provider) => (
                <button key={provider} type="button" onClick={() => onStepUp(provider)}>
                  Continue with {providerLabel(provider)}
                </button>
              ))}
            </div>
            {stepUpError ? <p role="alert">{stepUpError}</p> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function AccountPage({
  action,
  me,
  fetchImpl = fetch,
  goTo = (url: string) => {
    window.location.assign(url);
  },
}: {
  action: StartAction;
  me: MeOk | null;
  fetchImpl?: typeof fetch;
  goTo?: (url: string) => void;
}) {
  const [profile, setProfile] = useState<AccountProfile>(EMPTY_PROFILE);
  const [optouts, setOptouts] = useState<OptOutRecord[]>([]);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [profileError, setProfileError] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [sessionsError, setSessionsError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stepUp, setStepUp] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const csrfToken = me?.csrf_token ?? null;
  const providers = me?.providers.map((item) => item.provider).filter((provider) => provider.length > 0) ?? [];

  useEffect(() => {
    if (action === "redirect") navigate(signInHrefFor("/account"));
  }, [action]);

  useEffect(() => {
    if (action !== "form") return;
    let live = true;
    Promise.all([fetchAccountProfile(fetchImpl), fetchOptOuts(fetchImpl), fetchSessions(fetchImpl)]).then(
      ([profileResult, optoutResult, sessionResult]) => {
        if (!live) return;
        applyResult(profileResult, setProfileError, (data) => {
          setProfile(data);
          setDraft(data.display_name ?? "");
        });
        applyResult(optoutResult, setHistoryError, setOptouts);
        applyResult(sessionResult, setSessionsError, setSessions);
        if (
          (!profileResult.ok && profileResult.stepUp) ||
          (!optoutResult.ok && optoutResult.stepUp) ||
          (!sessionResult.ok && sessionResult.stepUp)
        ) {
          setStepUp(true);
        }
        setLoaded(true);
      },
    );
    return () => {
      live = false;
    };
  }, [action, fetchImpl]);

  function applyResult<T>(result: ApiOk<T> | ApiErr, setError: (value: boolean) => void, setData: (data: T) => void) {
    if (!result.ok) {
      setError(!result.stepUp);
      return;
    }
    setError(false);
    setData(result.data);
  }

  async function onSaveName(event: FormEvent) {
    event.preventDefault();
    setSaveError(false);
    if (!csrfToken) {
      setSaveError(true);
      return;
    }
    const result = await patchDisplayName(draft.trim(), csrfToken, fetchImpl);
    if (!result.ok) {
      if (result.stepUp) setStepUp(true);
      else setSaveError(true);
      return;
    }
    setProfile((current) => ({ ...current, display_name: draft.trim() || null }));
    setEditing(false);
  }

  async function onRevoke(id: string) {
    setActionError(null);
    if (!csrfToken) {
      setActionError("Sign in again to continue.");
      return;
    }
    const result = await revokeSession(id, csrfToken, fetchImpl);
    if (!result.ok) {
      if (result.stepUp) setStepUp(true);
      else setActionError("Could not revoke that session.");
      return;
    }
    setSessions((current) => current.filter((session) => session.id !== id));
  }

  async function onExport() {
    setActionError(null);
    setNotice(null);
    const result = await exportAccount(fetchImpl);
    if (!result.ok) {
      if (result.stepUp) setStepUp(true);
      else setActionError("Export is not available yet.");
      return;
    }
    downloadExport(result.data);
    setNotice("Your export is downloading.");
  }

  async function onConfirmDelete() {
    setActionError(null);
    if (!csrfToken) {
      setActionError("Sign in again to delete your account.");
      return;
    }
    const result = await deleteAccount(csrfToken, fetchImpl);
    if (!result.ok) {
      if (result.stepUp) setStepUp(true);
      else setActionError("Account deletion is not available yet.");
      return;
    }
    setConfirmDelete(false);
    goTo("/");
  }

  async function onStepUp(provider: string) {
    setStepUpError(null);
    if (!csrfToken) {
      setStepUpError("Sign in again to continue.");
      return;
    }
    const result = await startProviderStepUp(provider, csrfToken, fetchImpl);
    if (!result.ok || typeof result.data?.url !== "string" || result.data.url.length === 0) {
      setStepUpError("Could not start confirmation. Try again.");
      return;
    }
    goTo(result.data.url);
  }

  if (action === "loading") return <p className="panel">Checking sign-in…</p>;
  if (action === "redirect") return <p className="panel">Sending you to sign in…</p>;
  if (action === "unavailable") {
    return (
      <p className="panel">
        Sign-in could not be checked. You can try <a href={signInHrefFor("/account")}>sign in</a> again.
      </p>
    );
  }
  if (!loaded) return <p className="panel">Loading your account…</p>;

  return (
    <AccountView
      profile={profile}
      optouts={optouts}
      sessions={sessions}
      providers={providers}
      editing={editing}
      draft={draft}
      profileError={profileError}
      historyError={historyError}
      sessionsError={sessionsError}
      saveError={saveError}
      actionError={actionError}
      notice={notice}
      stepUp={stepUp}
      stepUpError={stepUpError}
      confirmDelete={confirmDelete}
      onEdit={() => {
        setDraft(profile.display_name ?? "");
        setEditing(true);
      }}
      onDraft={setDraft}
      onSaveName={(event) => void onSaveName(event)}
      onCancelEdit={() => setEditing(false)}
      onRevoke={(id) => void onRevoke(id)}
      onExport={() => void onExport()}
      onAskDelete={() => setConfirmDelete(true)}
      onConfirmDelete={() => void onConfirmDelete()}
      onCancelDelete={() => setConfirmDelete(false)}
      onStepUp={(provider) => void onStepUp(provider)}
    />
  );
}
