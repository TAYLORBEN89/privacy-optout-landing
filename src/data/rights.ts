/**
 * Tex. Bus. & Com. Code § 541.052(b): a controller shall respond not later than
 * the 45th day after receipt, and may extend that once by another 45 days.
 */
export const TDPSA_RESPONSE_DAYS = 45;

export interface TdpsaPoint {
  id: string;
  text: string;
  cite: string;
  /**
   * Sec. 541.054 calls the consumer rights those described by Sections 541.051,
   * 541.052, and 541.053. The non-discrimination note and attorney-general
   * enforcement line stay in the summary and are not counted as rights.
   */
  consumerRight: boolean;
}

export const TDPSA_POINTS: readonly TdpsaPoint[] = [
  // Tex. Bus. & Com. Code § 541.051(b)(1)
  {
    id: "access",
    cite: "541.051(b)(1)",
    consumerRight: true,
    text: "Confirm whether a company is processing your personal data and access that data.",
  },
  // Tex. Bus. & Com. Code § 541.051(b)(2)
  {
    id: "correct",
    cite: "541.051(b)(2)",
    consumerRight: true,
    text: "Correct inaccuracies in your personal data, taking into account the data and why it is used.",
  },
  // Tex. Bus. & Com. Code § 541.051(b)(3)
  {
    id: "delete",
    cite: "541.051(b)(3)",
    consumerRight: true,
    text: "Delete personal data provided by or obtained about you.",
  },
  // Tex. Bus. & Com. Code § 541.051(b)(4): digital format, data the consumer previously provided, portable and readily usable to the extent technically feasible.
  {
    id: "portable",
    cite: "541.051(b)(4)",
    consumerRight: true,
    text: "If your data is in a digital format, get a portable copy of data you previously provided, when that is technically feasible.",
  },
  // Tex. Bus. & Com. Code § 541.051(b)(5)(A)–(C). Profiling that furthers a legal or similarly significant decision only; not all profiling.
  {
    id: "opt-out",
    cite: "541.051(b)(5)",
    consumerRight: true,
    text: "Opt out of the sale of personal data, targeted advertising, and profiling that furthers a legal or similarly significant decision.",
  },
  // Tex. Bus. & Com. Code § 541.052(b): response by the 45th day; one 45-day extension when reasonably necessary, with notice and the reason inside the first 45 days.
  {
    id: "response",
    cite: "541.052(b)",
    // A business obligation on the company, not a consumer right.
    consumerRight: false,
    text: `A company must respond within ${TDPSA_RESPONSE_DAYS} days, and may extend that once by ${TDPSA_RESPONSE_DAYS} days if it tells you why during the first ${TDPSA_RESPONSE_DAYS} days.`,
  },
  // Tex. Bus. & Com. Code § 541.053(a): a consumer may appeal a controller's refusal to take action.
  {
    id: "appeal",
    cite: "541.053(a)",
    consumerRight: true,
    text: "You can appeal a refusal to act on your request.",
  },
  // Tex. Bus. & Com. Code § 541.101(b)(3). Sec. 541.101(c) still allows some price or quality differences tied to an opt-out or a voluntary loyalty program.
  {
    id: "nondiscrimination",
    cite: "541.101(b)(3)",
    consumerRight: false,
    text: "A company may not discriminate against you for exercising these rights.",
  },
  // Tex. Bus. & Com. Code § 541.151: the attorney general has exclusive authority to enforce this chapter.
  {
    id: "enforcement",
    cite: "541.151",
    consumerRight: false,
    text: "The Texas Attorney General enforces this law.",
  },
];

/** 5 rights under § 541.051(b) plus appeal under § 541.053 = 6. */
export function tdpsaRightCount(points: readonly TdpsaPoint[] = TDPSA_POINTS): number {
  return points.filter((point) => point.consumerRight).length;
}
