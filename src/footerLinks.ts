export const FOOTER_COPYRIGHT = "© 2026 DROP Texas. All rights reserved.";

export const TEXAS_STATUTE_URL = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm";

export interface FooterLink {
  label: string;
  href: string;
}

export const FOOTER_GROUPS: readonly { id: string; title: string; links: readonly FooterLink[] }[] = [
  {
    id: "explore",
    title: "Explore DROP Texas",
    links: [
      { label: "Overview", href: "/overview" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Personal Information", href: "/personal-information" },
      { label: "Data Brokers", href: "/data-brokers" },
      { label: "Unique Identifiers", href: "/unique-identifiers" },
    ],
  },
  {
    id: "learn",
    title: "Learn",
    links: [
      { label: "TDPSA", href: "/tdpsa" },
      { label: "Brokers", href: "/brokers" },
      { label: "Texas statute", href: TEXAS_STATUTE_URL },
    ],
  },
  {
    id: "company",
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Share", href: "/share" },
    ],
  },
  {
    id: "help",
    title: "Help",
    links: [
      { label: "Help", href: "/help" },
      { label: "Start", href: "/start" },
    ],
  },
  {
    id: "security",
    title: "Security and Privacy",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Security", href: "/security" },
    ],
  },
];

/** Desktop rows. Another footer should match this list and FOOTER_COPYRIGHT. */
export const FOOTER_DESKTOP_ROWS: readonly (readonly FooterLink[])[] = [
  [
    { label: "Overview", href: "/overview" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "Data Brokers", href: "/data-brokers" },
    { label: "Brokers list", href: "/brokers" },
    { label: "TDPSA", href: "/tdpsa" },
    { label: "Help", href: "/help" },
  ],
  [
    { label: "About", href: "/about" },
    { label: "Share", href: "/share" },
    { label: "Start", href: "/start" },
    { label: "Privacy", href: "/privacy" },
    { label: "Security", href: "/security" },
  ],
];
