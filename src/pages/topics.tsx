import { useState, type ReactNode } from "react";
import { BROKERS } from "../data/brokers";
import { DISCLAIMER } from "../copy";
import { PageMeta } from "../pageMeta";
import { AppLink } from "../router";
import { storageNotice } from "../../worker/storage";

const SITE = "https://droptexas.com";
const SHARE_TEXT =
  "DROP Texas is a free service for Texans to request data brokers not sell their personal information.";

function Topic({
  title,
  description,
  heading,
  tone,
  ctaHref = "/start",
  ctaLabel = "Start my opt-out",
  children,
}: {
  title: string;
  description: string;
  heading: string;
  tone: string;
  ctaHref?: string;
  ctaLabel?: string;
  children: ReactNode;
}) {
  return (
    <article className={`panel topic-page topic-${tone}`}>
      <PageMeta title={`${title} · DROP Texas`} description={description} />
      <header className="topic-hero">
        <div className="topic-shapes" aria-hidden="true">
          <span className="shape shape-a" />
          <span className="shape shape-b" />
          <span className="shape shape-c" />
        </div>
        <h1>{heading}</h1>
      </header>
      {children}
      <AppLink className="cta" href={ctaHref}>
        {ctaLabel}
      </AppLink>
      <p className="independence">{DISCLAIMER}</p>
    </article>
  );
}

export function OverviewPage() {
  return (
    <Topic
      title="Overview"
      heading="Overview"
      tone="overview"
      description="What DROP Texas does, and what an opt-out request is."
    >
      <p>
        You sign up, confirm your details, and DROP Texas sends opt-out requests for you. An opt-out
        request asks a data broker not to sell your personal information. DROP Texas does not check
        that a broker deleted a record.
      </p>
      <p>
        If a status is shown later, it is one of Submitted, Confirmed, Pending, Not completed, or No
        record found.
      </p>
    </Topic>
  );
}

export function HowItWorksPage() {
  return (
    <Topic
      title="How it works"
      heading="How DROP works"
      tone="how"
      description="Sign up, confirm your details, and DROP Texas sends opt-out requests to data brokers for you."
    >
      <p>Three steps. You can stop at any time before you submit.</p>
      <ol className="plain-steps">
        <li>
          <h2>Say whether you live in Texas</h2>
          <p>Checked means TDPSA. Unchecked still uses TDPSA for now and is marked non-Texas.</p>
        </li>
        <li>
          <h2>Enter the details the request uses</h2>
          <p>
            The form asks for your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to
            provide it) your phone number. For a child request, a parent or guardian also provides the child's name, date of birth and, if different, address. Most broker opt-out forms require a physical address. The form
            does not ask for a device ID, a password, or a government ID number.
          </p>
        </li>
        <li>
          <h2>Submit the form</h2>
          <p>{storageNotice()}</p>
        </li>
      </ol>
    </Topic>
  );
}

export function PersonalInformationPage() {
  return (
    <Topic
      title="Personal information"
      heading="Personal information"
      tone="personal"
      description="The form asks for your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to provide it) your phone number. For a child request, a parent or guardian also provides the child's name, date of birth and, if different, address."
    >
      <p>
        The form asks for your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to
        provide it) your phone number. For a child request, a parent or guardian also provides the child's name, date of birth and, if different, address.
      </p>
      <p>DROP Texas does not sell that information.</p>
      <p>
        <AppLink href="/privacy">How we protect it</AppLink>
      </p>
    </Topic>
  );
}

export function DataBrokersPage() {
  return (
    <Topic
      title="Data brokers"
      heading="Data brokers"
      tone="brokers"
      description="An opt-out request asks a data broker not to sell your personal information. DROP Texas does not check that a record was deleted."
    >
      <p>
        An opt-out request asks a data broker not to sell your personal information. DROP Texas does
        not check that a broker deleted a record.
      </p>
      <p>
        The home page carousel names {BROKERS.join(", ")}. Each name has a card on the{" "}
        <AppLink href="/brokers">brokers page</AppLink>, with categories taken from that company’s own
        privacy notice.
      </p>
      <p>
        Texas also has a data broker registration law. It was Chapter 509 of the Business and Commerce
        Code and was redesignated as Chapter 510, effective September 1, 2025. A data broker, in that
        chapter, is a business that collects, processes, or transfers personal data it did not collect
        directly from the person. A broker that meets the revenue tests in Section 510.003 must register
        with the Texas Secretary of State. The registration fee is $300, and the Secretary of State keeps
        a public registry. Consumer reporting agencies are outside the chapter only to the extent their
        activity is covered by the Fair Credit Reporting Act. Read the chapter at{" "}
        <a href="https://statutes.capitol.texas.gov/Docs/BC/htm/BC.510.htm" target="_blank" rel="noopener noreferrer">
          statutes.capitol.texas.gov
        </a>
        .
      </p>
    </Topic>
  );
}

export function UniqueIdentifiersPage() {
  return (
    <Topic
      title="Unique identifiers"
      heading="Unique identifiers"
      tone="identifiers"
      description="The form asks for your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to provide it) your phone number. For a child request, a parent or guardian also provides the child's name, date of birth and, if different, address."
    >
      <p>
        Some brokers match people with extra identifiers. This form does not ask for device IDs, account
        passwords, or government ID numbers.
      </p>
      <p>
        The form asks for your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to
        provide it) your phone number. For a child request, a parent or guardian also provides the child's name, date of birth and, if different, address.
      </p>
      <p>
        The <AppLink href="/brokers">brokers page</AppLink> lists categories each company names in its own
        privacy notice, such as email, phone, or address, when that notice says so.
      </p>
    </Topic>
  );
}

export function TdpsaPage() {
  return (
    <Topic
      title="TDPSA"
      heading="The Texas Data Privacy and Security Act"
      tone="tdpsa"
      description="A plain-English summary of consumer rights in Texas Business and Commerce Code chapter 541."
    >
      <p>
        DROP Texas is a private service. The Texas box records the Texas Data Privacy and Security Act
        (TDPSA), Texas Business and Commerce Code chapter 541. An unchecked box still uses TDPSA for now
        and is marked non-Texas. No government agency reviews this form.
      </p>
      <p>
        A consumer under Section 541.001(7) is a Texas resident acting in an individual or household
        context. That term does not include someone acting in a commercial or employment context. Section
        541.051(b) says a controller shall comply with an authenticated request to:
      </p>
      <ul>
        <li>Confirm whether it is processing your personal data and access that data. Section 541.051(b)(1).</li>
        <li>Correct inaccuracies, taking into account the data and why it is used. Section 541.051(b)(2).</li>
        <li>Delete personal data provided by or obtained about you. Section 541.051(b)(3).</li>
        <li>
          If the data is in a digital format, get a portable copy of data you previously provided, when
          that is technically feasible. Section 541.051(b)(4).
        </li>
        <li>
          Opt out of processing for targeted advertising, the sale of personal data, or profiling that
          furthers a decision with a legal or similarly significant effect. Section 541.051(b)(5).
        </li>
      </ul>
      <p>
        Section 541.052(b) says the controller shall respond not later than the 45th day after it receives
        the request. It may extend that once by another 45 days when reasonably necessary, if it tells you
        the reason during the first 45 days.
      </p>
      <p>
        Section 541.053 says you can appeal a refusal to act on a request. If the appeal is denied, the
        controller must point you to the attorney general complaint mechanism in Section 541.152.
      </p>
      <p>
        Section 541.101(b)(3) says a controller may not discriminate against you for exercising these
        rights. Section 541.101(c) still allows some price or quality differences tied to an opt-out or a
        voluntary loyalty program.
      </p>
      <p>
        Section 541.151 says the attorney general has exclusive authority to enforce the chapter. Section
        541.156 says the chapter does not create a private right of action. Before filing a penalty action,
        Section 541.154 requires the attorney general to give written notice at least 30 days ahead. The
        action may not be brought if the person cures the violation in those 30 days and provides the
        written statement the section describes. Section 541.155 sets a civil penalty of not more than
        $7,500 for each violation after that cure period, or for breaching the written statement.
      </p>
      <p>
        This is a plain-English summary, not legal advice. Read the chapter at{" "}
        <a href="https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm" target="_blank" rel="noopener noreferrer">
          statutes.capitol.texas.gov
        </a>
        .
      </p>
    </Topic>
  );
}

export function HelpPage() {
  return (
    <Topic
      title="Help"
      heading="Help"
      tone="help"
      description="Answers about signup, request statuses, and the Texas Data Privacy and Security Act."
    >
      {/* TODO: no support email is configured. Do not invent a contact address on this page. */}
      <div className="faq">
        <details>
          <summary>What is DROP Texas?</summary>
          <p>DROP Texas is a free service for Texans to request data brokers not sell their personal information.</p>
        </details>
        <details>
          <summary>What does a request cost?</summary>
          <p>The service does not charge a fee.</p>
        </details>
        <details>
          <summary>What do I enter?</summary>
          <p>
            The form asks for your name (including an optional middle name), date of birth, mailing address, email, Texas residency, and (if you choose to
            provide it) your phone number. For a child request, a parent or guardian also provides the child's name, date of birth and, if different, address. The page needs JavaScript to show the form.
          </p>
        </details>
        <details>
          <summary>What do the statuses mean?</summary>
          <p>
            If a status is shown later, it is one of Submitted, Confirmed, Pending, Not completed, or No
            record found. None of those words means a deletion was verified.
          </p>
        </details>
        <details>
          <summary>Do I have to live in Texas?</summary>
          <p>No. An unchecked Texas box still uses TDPSA for now and is marked non-Texas.</p>
        </details>
        <details>
          <summary>How fast must a company answer a TDPSA request?</summary>
          <p>
            Section 541.052(b) gives a controller 45 days to respond to a consumer’s request, with one
            possible 45-day extension. That deadline is in the statute. It is not a promise that a broker
            will finish a DROP Texas opt-out in that time.
          </p>
        </details>
        <details>
          <summary>Is this a government site?</summary>
          <p>{DISCLAIMER}</p>
        </details>
      </div>
    </Topic>
  );
}

export function SharePage() {
  const [copied, setCopied] = useState(false);
  const mailto = `mailto:?subject=${encodeURIComponent("DROP Texas")}&body=${encodeURIComponent(`${SHARE_TEXT} ${SITE}`)}`;
  const xIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SITE)}`;
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(SITE);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Topic
      title="Share"
      heading="Share DROP Texas"
      tone="share"
      description="Share https://droptexas.com by copying the link, or with email, X, or Facebook."
    >
      <p>You can share this private service at {SITE}.</p>
      <p>{SHARE_TEXT}</p>
      <div className="share-actions">
        <button type="button" className="share-copy" onClick={copyLink}>
          {copied ? "Link copied" : "Copy link"}
        </button>
        <input className="share-url" readOnly value={SITE} aria-label="Link to copy" />
        <a href={mailto}>Email</a>
        <a href={xIntent} target="_blank" rel="noopener noreferrer">
          Share on X
        </a>
        <a href={facebook} target="_blank" rel="noopener noreferrer">
          Share on Facebook
        </a>
      </div>
    </Topic>
  );
}

export function ChildrenPage() {
  return (
    <Topic
      title="Protecting children's information"
      heading="Protecting children's information"
      tone="children"
      description="Sourced notes on children's information, Texas law, and how a parent can send a request for a child under 13."
      ctaHref="/start?for=child"
    >
      <h2>Students' information offered for sale</h2>
      <p>
        In 2019, a New Jersey data broker, ALC Inc., advertised a list of 1.2 million students aged 14–17 with names,
        addresses, high schools, and hobbies, at $100 per 1,000 records.{" "}
        <a
          href="https://www.inquirer.com/business/technology/alc-princeton-data-broker-personal-info-million-kids-vermont-law-20190319.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          The Philadelphia Inquirer
        </a>
        .
      </p>
      <h2>Brokers that say they sell minors' data</h2>
      <p>
        24 of 480 data brokers registered in California disclosed that they sell minors' data.{" "}
        <a
          href="https://therecord.media/dozens-of-data-brokers-disclose-selling-info-on-kids-geolocation-data-reproductive-health"
          target="_blank"
          rel="noopener noreferrer"
        >
          The Record
        </a>
        .
      </p>
      <h2>Edmodo</h2>
      <p>
        In 2023 the FTC said ed-tech provider Edmodo collected students' personal information, including names, emails,
        dates of birth, phone numbers, and device IDs, without parental consent and used it for advertising.{" "}
        <a
          href="https://www.ftc.gov/news-events/news/press-releases/2023/05/ftc-says-ed-tech-provider-edmodo-unlawfully-used-childrens-personal-information-advertising"
          target="_blank"
          rel="noopener noreferrer"
        >
          Federal Trade Commission
        </a>
        .
      </p>
      <h2>OpenX</h2>
      <p>
        In 2021 the FTC said the ad exchange OpenX would pay $2 million to settle allegations that it collected
        personal information from children under 13 without parental consent. The FTC also said OpenX collected
        geolocation information from users who asked not to be tracked, and that child-directed apps took part in its
        ad exchange.{" "}
        <a
          href="https://www.ftc.gov/news-events/news/press-releases/2021/12/advertising-platform-openx-will-pay-2-million-collecting-personal-information-children-violation"
          target="_blank"
          rel="noopener noreferrer"
        >
          Federal Trade Commission
        </a>
        .
      </p>
      <h2>Kurbo by WW</h2>
      <p>
        In 2022 the FTC acted against WW International, formerly Weight Watchers, and its Kurbo app for collecting
        personal information from children under 13 without parental permission. The settlement requires a $1.5 million
        penalty, deletion of that personal information, and destruction of algorithms derived from it.{" "}
        <a
          href="https://www.ftc.gov/news-events/news/press-releases/2022/03/ftc-takes-action-against-company-formerly-known-weight-watchers-illegally-collecting-kids-sensitive"
          target="_blank"
          rel="noopener noreferrer"
        >
          Federal Trade Commission
        </a>
        .
      </p>
      <h2>Texas privacy law</h2>
      <p>
        Under the Texas Data Privacy and Security Act, Texas Business and Commerce Code chapter 541, a child is under
        13 (section 541.001). Data collected from a known child is sensitive data. A parent or legal guardian may
        exercise the consumer rights on behalf of a child (section 541.051), including asking a company to delete data
        or stop selling it. Companies may ask for verification (section 541.052).{" "}
        <a href="https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm" target="_blank" rel="noopener noreferrer">
          Texas Business and Commerce Code chapter 541
        </a>
        .
      </p>
      <h2>Texas data broker law</h2>
      <p>
        Under Texas Business and Commerce Code chapter 510, a registered data broker that knowingly holds a known
        child's data must disclose how it collects and sells that data and how it handles opt-outs (section 510.005).{" "}
        <a href="https://statutes.capitol.texas.gov/Docs/BC/htm/BC.510.htm" target="_blank" rel="noopener noreferrer">
          Texas Business and Commerce Code chapter 510
        </a>
        .
      </p>
      <h2>How DROP Texas helps</h2>
      <p>
        A parent or legal guardian can choose My child on the request form for a child under 13. DROP Texas sends the
        requests for free. Companies decide how to respond, and they may ask for proof of guardianship.
      </p>
      <p>Teens who are 13 to 17 can submit a request for themselves.</p>
    </Topic>
  );
}
