/**
 * Per-route SEO catalog. Titles are 50–60 characters. Descriptions are 140–156.
 * Focus keyphrases are unique. Routes are not renamed.
 */

export const SITE_ORIGIN = "https://droptexas.com";
export const SITE_NAME = "DROP Texas";
export const THEME_COLOR = "#056cb8";

export const OG_IMAGE = {
  url: `${SITE_ORIGIN}/og.png`,
  width: 420,
  height: 436,
  alt: "A person icon with a padlock for DROP Texas",
} as const;

export const SOS_BROKERS_URL = "https://www.sos.texas.gov/statdoc/data-brokers.shtml";
export const SOS_REGISTRY_URL = "https://texas-sos.appianportalsgov.com/data-broker-registry";
export const AG_TDPSA_URL =
  "https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/texas-data-privacy-and-security-act";
export const STATUTE_541_URL = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm";
export const STATUTE_510_URL = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.510.htm";

export interface SeoPage {
  path: string;
  title: string;
  description: string;
  focus: string;
  related: readonly string[];
  indexable: boolean;
  /** When set, the body-length check is n/a for this reason. */
  wordsNote?: string;
  /** When set, keyphrase-in-body checks are n/a for this reason. */
  bodyNote?: string;
}

export const SEO_PAGES: readonly SeoPage[] = [
  {
    path: "/",
    title: "Texas data broker opt-out, free for Texans | DROP Texas",
    description:
      "DROP Texas is a free Texas data broker opt-out for Texans. Ask data brokers not to sell your personal information. This is not a government website.",
    focus: "Texas data broker opt-out",
    related: ["free for Texans", "opt-out of sale", "personal information"],
    indexable: true,
  },
  {
    path: "/start",
    title: "Free data broker removal form for Texans | DROP Texas",
    description:
      "Start free data broker removal on the DROP Texas form. It asks for your name, address, email, and Texas residency. Phone is optional. Not a government site.",
    focus: "free data broker removal",
    related: ["opt-out form", "Texas residency", "optional phone"],
    indexable: true,
    wordsNote: "n/a (form page; not padded to 300 words)",
  },
  {
    path: "/privacy",
    title: "Texas privacy: how DROP Texas handles your data today",
    description:
      "Read the Texas privacy notes for DROP Texas: what the form collects, how long it is kept, and the fact that pages use HTTPS. Not a government website.",
    focus: "Texas privacy",
    related: ["form fields", "HTTPS", "retention"],
    indexable: true,
  },
  {
    path: "/security",
    title: "HTTPS in transit on every DROP Texas page and form",
    description:
      "DROP Texas serves pages and form posts with HTTPS in transit. See what the form stores and what that protection does not cover. Not a government site.",
    focus: "HTTPS in transit",
    related: ["form checks", "no sale of data", "SOC 2 standards"],
    indexable: true,
    wordsNote: "n/a (short control list, not an article)",
  },
  {
    path: "/brokers",
    title: "Texas data broker registry companies on DROP Texas",
    description:
      "See nine company notices on DROP Texas and where to open the Texas data broker registry. This page summarizes notices. It is not that registry.",
    focus: "Texas data broker registry",
    related: ["privacy notices", "Secretary of State", "nine companies"],
    indexable: true,
  },
  {
    path: "/overview",
    title: "Delete personal information: a Texas opt-out guide",
    description:
      "This guide does not delete personal information a broker already holds. It explains the opt-out of sale you send yourself with DROP Texas tools.",
    focus: "delete personal information",
    related: ["opt-out of sale", "not a deletion check", "free form"],
    indexable: true,
  },
  {
    path: "/how-it-works",
    title: "Opt out of data brokers using the free DROP Texas form",
    description:
      "See how to opt out of data brokers with the DROP Texas form, from the Texas box to submit. You send the requests. This is not a government program.",
    focus: "opt out of data brokers",
    related: ["Texas box", "one form", "broker responses"],
    indexable: true,
  },
  {
    path: "/personal-information",
    title: "Personal information collected on the DROP Texas form",
    description:
      "Personal information on the DROP Texas form is your name, birth date, address, email, Texas residency, and an optional phone. Nothing more is requested.",
    focus: "personal information",
    related: ["optional phone", "child request", "HTTPS"],
    indexable: true,
  },
  {
    path: "/data-brokers",
    title: "Data brokers: what they hold and how Texans opt out",
    description:
      "Data brokers collect personal information and may sell it. Read what that means in Texas and how an opt-out of sale is different from a credit freeze.",
    focus: "data brokers",
    related: ["opt-out of sale", "credit freeze", "Chapter 510"],
    indexable: true,
  },
  {
    path: "/unique-identifiers",
    title: "People search sites and the details they match to you",
    description:
      "People search sites match a name, address, email, or phone. See which of those the DROP Texas form uses, and which identifiers it does not collect.",
    focus: "people search sites",
    related: ["name and address", "email match", "no device ID"],
    indexable: true,
  },
  {
    path: "/tdpsa",
    title: "The Texas Data Privacy and Security Act | DROP Texas",
    description:
      "The Texas Data Privacy and Security Act gives Texans rights over personal data, including an opt-out of sale. This is a plain summary, not legal advice.",
    focus: "Texas Data Privacy and Security Act",
    related: ["chapter 541", "opt-out of sale", "45 days"],
    indexable: true,
  },
  {
    path: "/children",
    title: "Children's data and the DROP Texas opt-out form notes",
    description:
      "Children's data can appear in broker files and people-search pages. See the sourced notes and how a parent uses the DROP Texas form for a child under 13.",
    focus: "children's data",
    related: ["parent or guardian", "under 13", "Texas law"],
    indexable: true,
  },
  {
    path: "/benefits/control",
    title: "Control your data with free DROP Texas opt-out tools",
    description:
      "Control your data by asking data brokers not to sell it. DROP Texas gives you a free form for that request. Brokers still decide how they respond.",
    focus: "control your data",
    related: ["opt-out request", "free form", "broker response"],
    indexable: true,
  },
  {
    path: "/benefits/spam",
    title: "Cut down data broker mail with a Texas opt-out request",
    description:
      "Data broker mail, calls, and texts can start when a list is sold. An opt-out asks brokers to stop new sales. It does not join the Do Not Call list.",
    focus: "data broker mail",
    related: ["unwanted calls", "sold lists", "Do Not Call"],
    indexable: true,
  },
  {
    path: "/benefits/security",
    title: "Broker data exposure and what an opt-out can limit",
    description:
      "Broker data exposure grows when profiles are sold. An opt-out asks brokers not to sell those details onward. It is not a credit freeze or insurance.",
    focus: "broker data exposure",
    related: ["people-search page", "scam texts", "not a credit freeze"],
    indexable: true,
  },
  {
    path: "/benefits/time",
    title: "Use one opt-out form for Texas data broker requests",
    description:
      "One opt-out form collects the details many Texas data brokers ask for. You still send each request. DROP Texas does not promise a verified deletion.",
    focus: "one opt-out form",
    related: ["many brokers", "your own requests", "no deletion promise"],
    indexable: true,
  },
  {
    path: "/benefits/cost",
    title: "Free privacy tools to opt out of Texas data brokers",
    description:
      "Free privacy tools from DROP Texas let you make an opt-out request with no subscription. You can also ask each data broker yourself, for free.",
    focus: "free privacy tools",
    related: ["no subscription", "opt-out request", "ask a broker yourself"],
    indexable: true,
  },
  {
    path: "/benefits/rights",
    title: "Texas privacy rights in the TDPSA, in plain English",
    description:
      "Texas privacy rights include an opt-out of the sale of personal data under the TDPSA. This page is a plain summary. DROP Texas is not a government site.",
    focus: "Texas privacy rights",
    related: ["chapter 541", "opt-out of sale", "not legal advice"],
    indexable: true,
  },
  {
    path: "/benefits/children",
    title: "Child data privacy for Texas families | DROP Texas",
    description:
      "Child data privacy starts with a parent or guardian for a child under 13. The DROP Texas form can carry that request. Companies may ask for proof.",
    focus: "child data privacy",
    related: ["under 13", "parent or guardian", "proof of guardianship"],
    indexable: true,
  },
  {
    path: "/help",
    title: "Privacy help for Texans who use the DROP Texas form",
    description:
      "Privacy help for the DROP Texas form: what it costs, what you enter, what statuses mean, and what this private service does not do. Not legal advice.",
    focus: "privacy help",
    related: ["request status", "child request", "not a government site"],
    indexable: true,
  },
  {
    path: "/share",
    title: "Share DROP Texas with someone who wants an opt-out",
    description:
      "Share DROP Texas with a friend who wants a free, private opt-out form. You are sharing a private service, not a government program or a deletion promise.",
    focus: "share DROP Texas",
    related: ["copy the link", "private service", "no deletion promise"],
    indexable: true,
  },
  {
    path: "/about",
    title: "About DROP Texas, a private free opt-out service for Texans",
    description:
      "About DROP Texas: a private, free opt-out service run by a private enterprise. It is not a government website and is not affiliated with Texas.",
    focus: "about DROP Texas",
    related: ["private enterprise", "free opt-out", "not a government website"],
    indexable: true,
  },
  {
    path: "/account",
    title: "Your DROP Texas account holds your opt-out requests",
    description:
      "Your DROP Texas account holds the requests tied to your Google or Microsoft sign-in. This page is not for search indexing and is not a government site.",
    focus: "your DROP Texas account",
    related: ["not indexed", "opt-out requests", "help email"],
    indexable: false,
    wordsNote: "n/a (noindex account shell)",
    bodyNote: "n/a (noindex account shell)",
  },
  {
    path: "/signin",
    title: "Sign in to DROP Texas with Google or with Microsoft",
    description:
      "Sign in to DROP Texas with Google or Microsoft on this site. This private page is not indexed, and it is not a government login or a password form.",
    focus: "sign in to DROP Texas",
    related: ["not indexed", "Google or Microsoft", "no password"],
    indexable: false,
    wordsNote: "n/a (noindex auth route)",
    bodyNote: "n/a (noindex auth route)",
  },
];

export function canonicalFor(path: string): string {
  if (path === "/") return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path}`;
}

export function pageByPath(path: string): SeoPage | undefined {
  const normalized = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path || "/";
  return SEO_PAGES.find((page) => page.path === normalized);
}

export function indexablePages(): readonly SeoPage[] {
  return SEO_PAGES.filter((page) => page.indexable);
}

interface FaqItem {
  question: string;
  answer: string;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function jsonScript(data: unknown): string {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

export function structuredData(page: SeoPage, faq: readonly FaqItem[] = []): unknown {
  const url = canonicalFor(page.path);
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": `${SITE_ORIGIN}/#organization`,
      name: SITE_NAME,
      url: `${SITE_ORIGIN}/`,
      description:
        "DROP Texas is an independent, free service run by a private enterprise. It is not a government website and is not affiliated with the State of Texas or the Texas Attorney General.",
      logo: {
        "@type": "ImageObject",
        url: OG_IMAGE.url,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      url: `${SITE_ORIGIN}/`,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: page.title,
      description: page.description,
      isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
      about: { "@id": `${SITE_ORIGIN}/#organization` },
      breadcrumb: { "@id": `${url}#breadcrumb` },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement:
        page.path === "/"
          ? [{ "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` }]
          : [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}/` },
              { "@type": "ListItem", position: 2, name: page.focus, item: url },
            ],
    },
  ];
  if (page.path === "/help" && faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export function headInner(page: SeoPage, faq: readonly FaqItem[] = []): string {
  const url = canonicalFor(page.path);
  const robots = page.indexable ? "index, follow" : "noindex, nofollow";
  const title = escapeAttr(page.title);
  const description = escapeAttr(page.description);
  return [
    `<meta charset="UTF-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
    `<meta name="theme-color" content="${THEME_COLOR}" />`,
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:image" content="${OG_IMAGE.url}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escapeAttr(OG_IMAGE.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE.url}" />`,
    jsonScript(structuredData(page, faq)),
  ].join("\n    ");
}

/** Replace the document head, keeping Vite's stylesheet and module script tags. */
export function applyHead(html: string, page: SeoPage, faq: readonly FaqItem[] = []): string {
  const assetTags = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>|<script[^>]+type="module"[^>]*><\/script>/g)].map(
    (match) => match[0],
  );
  const head = `<head>\n    ${headInner(page, faq)}\n    ${assetTags.join("\n    ")}\n  </head>`;
  const withLang = html.replace(/<html[^>]*>/i, `<html lang="en-US">`);
  if (/<head[\s>]/i.test(withLang)) {
    return withLang.replace(/<head[\s\S]*?<\/head>/i, head);
  }
  return withLang.replace(/<html[^>]*>/i, (open) => `${open}\n  ${head}`);
}

export function sitemapXml(): string {
  const urls = indexablePages()
    .map((page) => `  <url><loc>${canonicalFor(page.path)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /signin\nDisallow: /api/\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
}
