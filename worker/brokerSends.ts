import { BROKERS, type BrokerName } from "../src/data/brokers";

/**
 * Machine reasons a request stays pending. These are not field values.
 * account: the broker requires an account on its site.
 * captcha: the public form uses a captcha.
 * profile_url: the form requires a listing URL before it can be submitted.
 * fcra_and_form: a consumer reporting agency. Opting out of a sale is not a credit freeze or a file dispute, and the public form is interactive.
 * interactive_form: the official form cannot accept a Worker POST of name, address, and email.
 */
export const OPT_OUT_BLOCK_CODES = [
  "account",
  "captcha",
  "profile_url",
  "fcra_and_form",
  "interactive_form",
] as const;

export type OptOutBlockCode = (typeof OPT_OUT_BLOCK_CODES)[number];

export interface BrokerSendTarget {
  id: string;
  name: BrokerName;
  /** Page a person can open. This Worker does not POST personal information to it. */
  url: string;
  mode: "interactive";
  channel: "web_form";
  errorCode: OptOutBlockCode;
}

/**
 * The nine named brokers, in marquee order. Every target is interactive.
 * Dispatch records a pending row and does not send personal information.
 * Equifax, Experian, and TransUnion stay on their privacy statements.
 * optoutprescreen.com is a different product and is not used here.
 */
const SEND_BY_NAME: Record<BrokerName, Omit<BrokerSendTarget, "name">> = {
  DMAchoice: {
    id: "dmachoice",
    url: "https://www.dmachoice.org/",
    mode: "interactive",
    channel: "web_form",
    errorCode: "account",
  },
  "Catalog Choice": {
    id: "catalog-choice",
    url: "https://www.catalogchoice.org/",
    mode: "interactive",
    channel: "web_form",
    errorCode: "account",
  },
  Acxiom: {
    id: "acxiom",
    url: "https://www.acxiom.com/optout/",
    mode: "interactive",
    channel: "web_form",
    errorCode: "captcha",
  },
  Epsilon: {
    id: "epsilon",
    url: "https://legal.epsilon.com/dsr/",
    mode: "interactive",
    channel: "web_form",
    errorCode: "interactive_form",
  },
  Equifax: {
    id: "equifax",
    url: "https://www.equifax.com/privacy/privacy-statement",
    mode: "interactive",
    channel: "web_form",
    errorCode: "fcra_and_form",
  },
  Experian: {
    id: "experian",
    url: "https://www.experian.com/privacy/us-consumer-data-privacy-policy",
    mode: "interactive",
    channel: "web_form",
    errorCode: "fcra_and_form",
  },
  TransUnion: {
    id: "transunion",
    url: "https://www.transunion.com/privacy/transunion",
    mode: "interactive",
    channel: "web_form",
    errorCode: "fcra_and_form",
  },
  Spokeo: {
    id: "spokeo",
    url: "https://www.spokeo.com/optout",
    mode: "interactive",
    channel: "web_form",
    errorCode: "profile_url",
  },
  Whitepages: {
    id: "whitepages",
    url: "https://www.whitepages.com/opt-out",
    mode: "interactive",
    channel: "web_form",
    errorCode: "profile_url",
  },
};

export const BROKER_SENDS: readonly BrokerSendTarget[] = BROKERS.map((name) => ({
  name,
  ...SEND_BY_NAME[name],
}));

export function brokerSendById(id: string): BrokerSendTarget | undefined {
  return BROKER_SENDS.find((target) => target.id === id);
}
