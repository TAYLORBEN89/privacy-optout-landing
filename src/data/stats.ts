import { BROKERS } from "./brokers";
import { TDPSA_RESPONSE_DAYS, tdpsaRightCount } from "./rights";

export interface StatEntry {
  id: string;
  label: string;
  /** Null means the figure is not measured. Never invent a number. */
  value: number | null;
  prefix: string;
  source: string;
  sourceUrl: string | null;
}

export function statText(value: number | null, prefix = ""): string {
  return value === null ? "Coming soon" : `${prefix}${value}`;
}

/** Ease-out cubic. t is 0 at the start and 1 at the end. */
export function easeOut(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return 1 - (1 - t) ** 3;
}

export function countAt(elapsedMs: number, durationMs: number, target: number): number {
  if (target <= 0) return 0;
  if (elapsedMs >= durationMs) return target;
  const progress = easeOut(elapsedMs / durationMs);
  return Math.round(target * progress);
}

/**
 * Visible figures are the broker-list length, the $0 service cost, the TDPSA
 * response window, and the consumer-right count. Opt-outs stay empty until a
 * stored count exists. Uncited figures are omitted.
 */
export function buildStats(brokerCount: number = BROKERS.length): StatEntry[] {
  return [
    {
      id: "brokers",
      label: "Data brokers covered",
      value: brokerCount,
      prefix: "",
      source: "Count of names in the DROP Texas broker list shipped with this site.",
      sourceUrl: null,
    },
    {
      id: "cost",
      label: "Cost to Texans",
      value: 0,
      prefix: "$",
      source: "DROP Texas does not charge Texans a fee.",
      sourceUrl: null,
    },
    {
      id: "response-days",
      label: "Days a business has to respond under TDPSA",
      value: TDPSA_RESPONSE_DAYS,
      prefix: "",
      source: "Tex. Bus. & Com. Code § 541.052(b).",
      sourceUrl: "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm",
    },
    {
      id: "rights",
      label: "Rights under Texas law",
      value: tdpsaRightCount(),
      prefix: "",
      source:
        "Count of consumer-right entries in the Your Rights list. Sec. 541.054 describes consumer rights in Sections 541.051, 541.052, and 541.053.",
      sourceUrl: "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm",
    },
    {
      id: "optouts",
      label: "Opt-outs filed",
      value: null,
      prefix: "",
      source: "TODO: needs a cited source once request storage is live.",
      sourceUrl: null,
    },
  ];
}
