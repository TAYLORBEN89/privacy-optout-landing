/** Process groups from the Texas Secretary of State data broker registry, exported 2026-11-02. */
export const REGISTRY_GROUPS = [
  {
    id: "portal",
    title: "Request portal",
    steps:
      "Open the company's request form. Choose opt out of sale. Enter your name, email, and mailing address. Submit one request type if the form allows only one. If the company emails you a link, open it.",
  },
  {
    id: "opt-out-page",
    title: "Opt-out page",
    steps:
      "Open the company's opt-out page and complete the form there. If the page asks for a listing link, a captcha, or a phone check, that step stays with you.",
  },
  {
    id: "privacy-page",
    title: "Privacy page",
    steps:
      "Open the privacy page. Find your privacy choices or the request form, and choose opt out of sale. Use a phone number or a mailing address only when the page says that is how to send the request.",
  },
  {
    id: "other-page",
    title: "Company site",
    steps:
      "The filing points at the company's site, not a request form. Open the site, use the privacy link, and follow the privacy-page steps.",
  },
  {
    id: "email",
    title: "Email the opt-out",
    steps:
      "This filing says to email the opt-out. Send your name, mailing address, and email, and ask to opt out of sale under the Texas Data Privacy and Security Act. A reply that the message arrived is not a completed removal.",
  },
  {
    id: "no-link",
    title: "No rights link on file",
    steps:
      "This filing has no rights link. Do not email the registration contact. Use a request method only after the company's own page publishes one.",
  },
] as const;

export type RegistryGroupId = (typeof REGISTRY_GROUPS)[number]["id"];

export function registryGroup(id: RegistryGroupId) {
  const group = REGISTRY_GROUPS.find((item) => item.id === id);
  if (!group) throw new Error("unknown_registry_group");
  return group;
}
