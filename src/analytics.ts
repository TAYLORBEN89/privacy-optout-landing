import type { SignupField, SignupIssues } from "../shared/signup";

/**
 * Lightweight product events. Payloads name the event, field, and error code.
 * They must not include names, addresses, emails, or other field values.
 *
 * The default sink does nothing. In Vite dev, main.tsx logs the event name.
 * Replace the sink later with a vendor that has the same payload limit.
 */
export type AnalyticsEvent =
  | { event: "form_started" }
  | { event: "field_error"; field: SignupField; code: string }
  | { event: "submitted" };

type AnalyticsSink = (event: AnalyticsEvent) => void;

let sink: AnalyticsSink = () => {};

export function setAnalyticsSink(next: AnalyticsSink): void {
  sink = next;
}

export function track(event: AnalyticsEvent): void {
  sink(event);
}

export function fieldErrorEvents(errors: SignupIssues): AnalyticsEvent[] {
  const events: AnalyticsEvent[] = [];
  const fields: SignupField[] = ["fullName", "mailingAddress", "email", "texasResident"];
  for (const field of fields) {
    const issue = errors[field];
    if (!issue) continue;
    events.push({ event: "field_error", field, code: issue.code });
  }
  return events;
}

export function installDevAnalytics(): void {
  if (!import.meta.env.DEV) return;
  setAnalyticsSink((event) => {
    console.debug("[optout]", event.event);
  });
}
