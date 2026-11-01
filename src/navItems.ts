export interface NavItem {
  id: string;
  label: string;
  href: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "overview", label: "Overview", href: "/#overview" },
  { id: "how-drop-works", label: "How DROP Works", href: "/#how-drop-works" },
  { id: "personal-information", label: "Personal Information", href: "/#personal-information" },
  { id: "data-brokers", label: "Data Brokers", href: "/#data-brokers" },
  { id: "unique-identifiers", label: "Unique Identifiers", href: "/#unique-identifiers" },
  { id: "tdpsa", label: "TDPSA", href: "/#tdpsa" },
  { id: "help", label: "Help with DROP", href: "/#help" },
  { id: "share", label: "Share DROP", href: "/#share" },
];
