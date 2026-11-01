import { BROKERS } from "./brokers";

export interface StatEntry {
  id: string;
  label: string;
  /** Null means the figure is not cited or not measured. Never invent a number. */
  value: number | null;
  source: string;
  sourceUrl: string | null;
}

export function statText(value: number | null): string {
  return value === null ? "Coming soon" : String(value);
}

/**
 * Only `brokers` has a real value: the length of the list in brokers.ts.
 * Other figures stay null until a cited source exists.
 */
export function buildStats(brokerCount: number = BROKERS.length): StatEntry[] {
  return [
    {
      id: "brokers",
      label: "Brokers in our registry",
      value: brokerCount,
      source: "Count of names in the DROP Texas broker list shipped with this site.",
      sourceUrl: null,
    },
    {
      id: "requests",
      label: "Opt-out requests filed",
      value: null,
      source: "TODO: needs a cited source once request storage is live.",
      sourceUrl: null,
    },
    {
      id: "sold-per-second",
      label: "Personal data sold every second",
      value: null,
      source: "TODO: needs a cited source.",
      sourceUrl: null,
    },
    {
      id: "people-in-files",
      label: "People in broker files",
      value: null,
      source: "TODO: needs a cited source.",
      sourceUrl: null,
    },
  ];
}

export function countAt(elapsedMs: number, durationMs: number, target: number): number {
  if (target <= 0) return 0;
  if (elapsedMs >= durationMs) return target;
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return Math.round(target * progress);
}
