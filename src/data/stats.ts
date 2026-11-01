/**
 * Cited figures for the blue stats band.
 * Only entries with verified:true are rendered. Each one was checked against
 * the page in sourceUrl. Unverified claims stay in this list and are omitted.
 *
 * Seconds used for the per-year rates: 365 * 24 * 60 * 60 = 31,536,000.
 */

export const SECONDS_PER_COMMON_YEAR = 31_536_000;

export interface CitedStat {
  id: string;
  value: number;
  prefix: string;
  suffix: string;
  /** Decimal places shown while the number counts up. */
  decimals: number;
  label: string;
  sourceName: string;
  sourceUrl: string;
  sourceDate: string;
  verified: boolean;
}

export const CITED_STATS: readonly CitedStat[] = [
  // Privacy Rights Clearinghouse, posted 20 June 2025, with EFF.
  // "A unified database of 750+ data brokers" and "A total of 750 data brokers
  // have registered in at least one state." Snapshot collected 4–8 April 2025
  // from the California, Vermont, Texas, and Oregon registries.
  {
    id: "registered-brokers",
    value: 750,
    prefix: "",
    suffix: "+",
    decimals: 0,
    label: "data brokers registered across US state registries",
    sourceName: "Privacy Rights Clearinghouse and Electronic Frontier Foundation",
    sourceUrl: "https://privacyrights.org/resources-tools/reports/why-are-hundreds-data-brokers-not-registering-states",
    sourceDate: "2025-06-20",
    verified: true,
  },
  // Comcast Business press release, 5 October 2026: 79.3 billion events from
  // 1 March 2025 through 28 February 2026, "roughly 2,514 cybersecurity events
  // every second." 79.3e9 / 31,536,000 = 2,514.6.
  {
    id: "cyber-events",
    value: 2514,
    prefix: "~",
    suffix: "",
    decimals: 0,
    label: "cybersecurity events per second",
    sourceName: "Comcast Business 2026 Cybersecurity Threat Report",
    sourceUrl: "https://business.comcast.com/about-us/press-releases/2026/cb-2026-cybersecurity-threat-report",
    sourceDate: "2026-10-05",
    verified: true,
  },
  // Surfshark, published 3 February 2026: 425.7 million accounts breached in
  // 2025, "approximately 810 breaches per minute."
  // 425.7e6 / (365 * 24 * 60) = 809.9.
  {
    id: "account-breaches",
    value: 810,
    prefix: "~",
    suffix: "",
    decimals: 0,
    label: "account breaches per minute worldwide in 2025",
    sourceName: "Surfshark",
    sourceUrl: "https://surfshark.com/research/study/data-breach-recap-2025",
    sourceDate: "2026-02-03",
    verified: true,
  },
  // Grand View Research, last updated July 2026: estimated market size in 2026
  // is USD 307.3 billion. Shown as ~$307B.
  {
    id: "broker-market",
    value: 307,
    prefix: "~$",
    suffix: "B",
    decimals: 0,
    label: "data broker market size in 2026",
    sourceName: "Grand View Research",
    sourceUrl: "https://www.grandviewresearch.com/industry-analysis/data-broker-market-report",
    sourceDate: "2026-07",
    verified: true,
  },
  // IBM Cost of a Data Breach Report 2026, announced 29 July 2026.
  // IBM states a global average of USD 4.99 million and a United States
  // average of USD 11.5 million. The 2025 edition was USD 4.44 million
  // globally and USD 10.22 million in the United States.
  {
    id: "breach-cost",
    value: 4.99,
    prefix: "$",
    suffix: "M",
    decimals: 2,
    label: "average data breach cost worldwide ($11.5M in the US)",
    sourceName: "IBM Cost of a Data Breach Report 2026",
    sourceUrl: "https://www.ibm.com/think/topics/data-breach",
    sourceDate: "2026-07-29",
    verified: true,
  },
  // ICCL, 16 May 2022: Real-Time Bidding "tracks and shares what people view
  // online and their real-world location 178 Trillion times every year in
  // U.S. & Europe." 178e12 / 31,536,000 = 5,644,343 per second, about 5.64
  // million. A figure of 5,650 would be short by a factor of one thousand.
  {
    id: "bid-requests",
    value: 5.6,
    prefix: "",
    suffix: "M+",
    decimals: 1,
    label: "ad bid requests per second exposing data about people",
    sourceName: "Irish Council for Civil Liberties",
    sourceUrl: "https://www.iccl.ie/digital-data/iccl-report-on-the-scale-of-real-time-bidding-data-broadcasts-in-the-u-s-and-europe/",
    sourceDate: "2022-05-16",
    verified: true,
  },
];

export function visibleCitedStats(stats: readonly CitedStat[] = CITED_STATS): CitedStat[] {
  return stats.filter((stat) => stat.verified && stat.sourceUrl.length > 0);
}

export function formatStat(value: number, prefix: string, suffix: string, decimals: number): string {
  const body = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString("en-US");
  return `${prefix}${body}${suffix}`;
}

/** Ease-out cubic. t is 0 at the start and 1 at the end. */
export function easeOut(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return 1 - (1 - t) ** 3;
}

export function countAt(elapsedMs: number, durationMs: number, target: number, decimals = 0): number {
  if (target <= 0) return 0;
  if (elapsedMs >= durationMs) return target;
  const raw = target * easeOut(elapsedMs / durationMs);
  const factor = 10 ** decimals;
  return Math.round(raw * factor) / factor;
}
