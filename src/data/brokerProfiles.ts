import type { BrokerName } from "./brokers";

/** Date these notices were read. Do not add a category that is not in the linked notice. */
export const BROKER_SOURCES_READ = "2026-11-01";

export interface BrokerSource {
  name: string;
  url: string;
}

export interface BrokerProfile {
  name: BrokerName;
  /**
   * What the linked notice is describing, so a preference-service policy is not
   * presented as a marketing file on the general public.
   */
  scope: string;
  categories: readonly string[];
  /** True only when the public notice does not support a useful category list. */
  limited: boolean;
  note: string | null;
  source: BrokerSource;
}

export const BROKER_PROFILES: readonly BrokerProfile[] = [
  {
    name: "DMAchoice",
    scope:
      "The Association of National Advertisers privacy policy for the DMAchoice.org preference service. It describes information collected when someone uses that service.",
    categories: [
      "Name, street address, telephone number, and email address",
      "Contact information provided about other household members, a deceased person, or someone the requester cares for",
      "Which promotional mail, email, or phone lists the person wants to opt out of",
      "Payment information, registration date, and login information, including a password",
      "Browser, device, operating system, and IP address",
      "Whether an email from the service was opened or a link in it was clicked",
      "Location from an IP address, and the street address given at registration or payment",
      "Age or date of death, when someone submits that information for the service",
    ],
    limited: false,
    note: null,
    source: {
      name: "DMAchoice privacy policy",
      url: "https://www.dmachoice.org/static/privacy_policy.php",
    },
  },
  {
    name: "Catalog Choice",
    scope:
      "Catalog Choice’s posted privacy policy. It describes information collected on catalogchoice.org, including when someone creates an account.",
    categories: [
      "IP address",
      "Click-stream data on the site, including the page served, the time, the source of the request, the browser type, and the preceding page",
      "First and last name, if the person creates an account",
      "Mailing address, including street, city, state, and ZIP code, if the person creates an account",
      "Telephone number and email address, if the person creates an account",
      "User ID and password, if the person registers for a feature that asks for them",
    ],
    limited: false,
    note: "The policy on their site says its effective date is March 25, 2015.",
    source: {
      name: "Catalog Choice privacy policy",
      url: "https://www.catalogchoice.org/privacy-policy",
    },
  },
  {
    name: "Acxiom",
    scope:
      "Acxiom’s U.S. data-product privacy notice. These are categories it says it licenses from third parties for its marketing and advertising products.",
    categories: [
      "Name, alias, postal address, email address, account name, and IP address",
      "Social Security number, driver’s license number, passport number, or state identification card number",
      "Mobile advertising ID",
      "Protected-class characteristics the notice names, including race, religion, philosophical beliefs, and gender",
      "Commercial or transaction information, described as personal property or buying activity",
      "Internet activity described as interest based on website type and source URL",
      "Geolocation",
      "Employment information",
      "Education information",
      "Inferences used to create a profile of preferences",
    ],
    limited: false,
    note: null,
    source: {
      name: "Acxiom U.S. data product privacy notices",
      url: "https://www.acxiom.com/privacy/us/",
    },
  },
  {
    name: "Epsilon",
    scope:
      "Epsilon’s U.S. products and services privacy policy. These are categories it says it processes for those services.",
    categories: [
      "Name, email address, telephone number, IP address, mobile advertising ID, and device ID",
      "Records of goods or services purchased, obtained, or considered, and other purchasing histories",
      "Marital status, age, and gender",
      "Inferences about preferences, characteristics, behavior, and aptitudes",
      "Browsing history, search history, online interests, and interaction with a website, application, or advertisement",
      "Occupation and veteran status",
      "Age or gender of other people in the household, including children",
      "Interests and hobbies",
      "Income tier, home equity, mortgage amount, and type of insurance",
      "Home value and whether the person owns a home",
      "Health data",
      "Political, religious, and philosophical beliefs",
      "Racial or ethnic data and language spoken",
      "Sex-life information, with contraception purchase given as an example",
    ],
    limited: false,
    note: "The same policy says Epsilon does not knowingly collect personal data directly from anyone under 18.",
    source: {
      name: "Epsilon U.S. products privacy policy",
      url: "https://legal.epsilon.com/us/NA-products-privacy-policy",
    },
  },
  {
    name: "Equifax",
    scope: "Equifax’s privacy statement. These are categories of personal data it says it collects.",
    categories: [
      "First and last name, email address, postal address, and phone number",
      "Social Security number, taxpayer identification number, passport number, driver’s license number, and other state identification numbers",
      "Device identifiers",
      "Age, gender, country of origin, and preferred language",
      "Payment card information, including account number and security code, when a payment is made to Equifax",
      "Financial account information, including balances, bank holdings, loan history, bill and rental payment history, bank account activity, and insurance information",
      "Products or services purchased or considered, and other purchasing or spending histories",
      "Browsing history, search history, and interaction with Equifax websites, applications, advertisements, or emails",
      "Browser, operating system, device ID, and IP address, which the notice says may identify a device’s general location",
      "Employment status, history, and compensation",
      "Education history, degrees, and student-loan information",
      "Profiles or scores reflecting preferences, characteristics, or a spending profile",
      "Public records, including court records, incarceration records, and business-ownership filings",
      "Photo identification, when Equifax requests it to authenticate someone",
    ],
    limited: false,
    note: null,
    source: {
      name: "Equifax privacy statement",
      url: "https://www.equifax.com/privacy/privacy-statement",
    },
  },
  {
    name: "Experian",
    scope:
      "Experian’s U.S. consumer data privacy policy. These are categories it says it has collected.",
    categories: [
      "First and last name, postal address, telephone number, email address, and unique online identifiers",
      "Social Security number and driver’s license number",
      "Records of products or services purchased, obtained, or considered, plus vehicle information and insurance claims or underwriting information",
      "Browsing history, search history, and interactions with a website, email, application, or advertisement",
      "Geolocation information",
      "Education information",
      "Inferences about predicted characteristics and preferences",
    ],
    limited: false,
    note: "The same notice says Experian does not collect sensitive personal information, including precise geolocation, in Texas and the other states named in that part of the notice.",
    source: {
      name: "Experian U.S. consumer data privacy policy",
      url: "https://www.experian.com/privacy/us-consumer-data-privacy-policy",
    },
  },
  {
    name: "TransUnion",
    scope:
      "TransUnion LLC’s privacy notice. These are categories it says it may have collected in the past 12 months.",
    categories: [
      "Name, home or other physical address, email address, and telephone number, including for a family member or child",
      "Social Security number, date of birth, employment information, and credit card account information",
      "Device identifiers, IP address, and information collected with cookies",
      "Age, race, ethnicity, religion, marital status, political party affiliation, country of origin, spoken language, and gender",
      "Records of online services purchased, obtained, or considered from TransUnion, plus property records and small-business data",
      "Websites visited, searches, and other behavior on TransUnion websites",
      "Location from an IP address, Wi-Fi access points, and cell towers",
      "Professional licenses, employment dates, and employer name",
      "Inferences such as site preferences, behavior, and personal preferences",
    ],
    limited: false,
    note: "The notice says TransUnion does not collect non-public education information under the Family Educational Rights and Privacy Act.",
    source: {
      name: "TransUnion LLC privacy notice",
      url: "https://www.transunion.com/privacy/transunion",
    },
  },
  {
    name: "Spokeo",
    scope:
      "Spokeo’s privacy policy. The first group is publicly available information it says it aggregates. The second group is information it says it collects from people who use Spokeo.",
    categories: [
      "Consumer-profile records with age, name, address, and other demographic details",
      "Phone numbers from white-pages directories",
      "Email addresses disclosed to survey companies",
      "Public property records, including deeds and assessor records",
      "Public social-network profiles",
      "Public court records, including arrest records, warrants, driving violations, sex-offender data, and fugitive records",
      "Business-directory listings with name, title, business address, website, and email",
      "Vital records, including birth certificates, marriage licenses, and death certificates",
      "Pages visited on Spokeo, links hovered or clicked, and items purchased",
      "IP address, mobile phone number, and device identifiers of someone using Spokeo",
      "Name, email address, phone number, and payment data given to create a Spokeo account",
      "Searches made on Spokeo",
    ],
    limited: false,
    note: null,
    source: {
      name: "Spokeo privacy policy",
      url: "https://www.spokeo.com/privacy-policy",
    },
  },
  {
    name: "Whitepages",
    scope: "Whitepages’ privacy policy. These are categories it says it collects.",
    categories: [
      "First and last name, email address, postal address, and phone number",
      "Age, country, and preferred language",
      "Account passwords",
      "Search terms, pages visited, links hovered or clicked, and items purchased",
      "Browsing history and websites visited before and after Whitepages",
      "IP address and device identifiers",
      "Location derived from an IP address",
      "Payment data, including name, credit card number, and security code",
      "The content of customer-support communications",
      "Directory and public-record data: name, current and former address, phone number, possible aliases, possible relatives and associates, date of birth, email address, property records, traffic and criminal records, license records, and permit records",
    ],
    limited: false,
    note: null,
    source: {
      name: "Whitepages privacy policy",
      url: "https://www.whitepages.com/privacy",
    },
  },
];
