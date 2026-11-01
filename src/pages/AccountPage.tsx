import { useEffect, useState } from "react";
import {
  fetchOptOutHistory,
  fetchReminders,
  readProfile,
  type OptOutHistoryItem,
  type ReverificationReminder,
} from "../api/account";
import { type StartAction, signInHrefFor } from "../authGate";
import { navigate } from "../router";

export function AccountView({
  profile,
  requests,
  reminders,
}: {
  profile: { name: string | null; email: string | null };
  requests: OptOutHistoryItem[];
  reminders: ReverificationReminder[];
}) {
  return (
    <article className="panel">
      <h1>Your account</h1>
      <h2>Profile</h2>
      <p>Name: {profile.name ?? "Not provided"}</p>
      <p>Email: {profile.email ?? "Not provided"}</p>
      <h2>Opt-out history</h2>
      {requests.length === 0 ? (
        <p>No requests yet</p>
      ) : (
        <ul>
          {requests.map((item) => (
            <li key={item.id}>
              {item.confirmationNumber}: {item.status}
            </li>
          ))}
        </ul>
      )}
      <h2>Re-verification reminders</h2>
      {reminders.length === 0 ? (
        <p>No reminders yet</p>
      ) : (
        <ul>
          {reminders.map((item) => (
            <li key={item.id}>{item.note}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function AccountPage({ action, user }: { action: StartAction; user: unknown }) {
  const [requests, setRequests] = useState<OptOutHistoryItem[]>([]);
  const [reminders, setReminders] = useState<ReverificationReminder[]>([]);

  useEffect(() => {
    if (action === "redirect") navigate(signInHrefFor("/account"));
  }, [action]);

  useEffect(() => {
    if (action !== "form") return;
    let live = true;
    Promise.all([fetchOptOutHistory(), fetchReminders()])
      .then(([nextRequests, nextReminders]) => {
        if (!live) return;
        setRequests(nextRequests);
        setReminders(nextReminders);
      })
      .catch(() => {
        if (!live) return;
        setRequests([]);
        setReminders([]);
      });
    return () => {
      live = false;
    };
  }, [action]);

  if (action === "loading") return <p className="panel">Checking sign-in…</p>;
  if (action === "redirect") return <p className="panel">Sending you to sign in…</p>;
  if (action === "unavailable") {
    return (
      <p className="panel">
        Sign-in could not be checked. You can try <a href={signInHrefFor("/account")}>sign in</a> again.
      </p>
    );
  }

  return <AccountView profile={readProfile(user)} requests={requests} reminders={reminders} />;
}
