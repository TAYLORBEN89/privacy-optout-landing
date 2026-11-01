/**
 * Names shown in the public broker marquee.
 * TODO(broker-registry): the rest of the names come from the broker registry.
 * Do not add names here until they are in that registry.
 */
export const BROKERS = [
  "DMAchoice",
  "Catalog Choice",
  "Acxiom",
  "Epsilon",
  "Equifax",
  "Experian",
  "TransUnion",
  "Spokeo",
  "Whitepages",
] as const;

export type BrokerName = (typeof BROKERS)[number];
