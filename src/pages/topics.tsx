import { useState, type ReactNode } from "react";
import { BROKERS } from "../data/brokers";
import { DISCLAIMER } from "../copy";
import { AppLink } from "../router";
import { storageNotice } from "../../worker/storage";

const SITE = "https://droptexas.com";
const SHARE_TEXT =
  "DROP Texas is a free service for Texans to request data brokers not sell their personal information.";

export function Topic({
  title: _title,
  description: _description,
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
      heading="Delete personal information"
      tone="overview"
      description="What DROP Texas does, who it is for, and what an opt-out request is."
    >
      <p>
        You can delete personal information from a broker's future sales by sending an opt-out. DROP
        Texas gives you one free form for that request. Brokers decide whether they have a record and
        how they respond. This does not check that a record was deleted.
      </p>
      <h2>Who can delete personal information here</h2>
      <p>
        Anyone can use the form. A checked Texas box records the Texas Data Privacy and Security Act.
        An unchecked box still uses that law for now and is marked non-Texas. A parent or guardian can
        send a request for a child under 13. Teens 13 to 17 can submit for themselves. Read{" "}
        <AppLink href="/children">protecting children's information</AppLink> for that path.
      </p>
      <h2>What an opt-out request is</h2>
      <p>
        An opt-out of sale asks a company not to sell personal information it holds about you. It is
        not the same as a deletion request, a credit freeze, or a listing on the National Do Not Call
        Registry. Those are separate steps. You use this form to send opt-out requests. It does not
        freeze credit or enroll you in Do Not Call.
      </p>
      <h2>What DROP Texas does</h2>
      <p>
        You say whether you live in Texas, enter the details the request uses, and submit. Your requests
        go to the companies named on the{" "}
        <AppLink href="/brokers">brokers page</AppLink>. There is no fee. The{" "}
        <AppLink href="/how-it-works">how it works</AppLink> page walks through the form.
      </p>
      <h2>What this does not do</h2>
      <p>
        DROP Texas does not check that a broker deleted a record. It does not pull back copies already
        sold. It does not place a credit freeze. If a status is shown later, it is one of Submitted,
        Confirmed, Pending, Not completed, or No record found. None of those words means a deletion
        was verified.
      </p>
      <p>{DISCLAIMER}</p>
    </Topic>
  );
}

export function HowItWorksPage() {
  return (
    <Topic
      title="How it works"
      heading="Opt out of data brokers"
      tone="how"
      description="Sign up, confirm your details, and send opt-out requests to data brokers yourself."
    >
      <p>
        You opt out of data brokers from this form. You can stop at any time before you submit. After
        you submit, you have sent the requests. Brokers answer on their own schedule.
      </p>
      <ol className="plain-steps">
        <li>
          <h2>Say whether you live in Texas before you opt out of data brokers</h2>
          <p>
            A checked box records the Texas Data Privacy and Security Act, Business and Commerce Code
            chapter 541. An unchecked box still uses that chapter for now and is marked non-Texas. No
            government agency reviews this form. The{" "}
            <AppLink href="/tdpsa">TDPSA page</AppLink> summarizes the rights in that chapter.
          </p>
        </li>
        <li>
          <h2>Enter the details the request uses</h2>
          <p>
            The form asks for your name (including an optional middle name), date of birth, mailing
            address, email, Texas residency, and (if you choose to provide it) your phone number. Most broker
            opt-out forms require a physical address. The form does not ask for a device ID, a
            password, or a government ID number. The{" "}
            <AppLink href="/personal-information">personal information</AppLink> page explains why
            each field is asked, and{" "}
            <AppLink href="/unique-identifiers">unique identifiers</AppLink> explains what this form
            does not collect.
          </p>
          <p>
            For a child under 13, a parent or guardian chooses My child and also provides the child's
            name, date of birth and, if different, address. Teens 13 to 17 can submit for themselves.
          </p>
        </li>
        <li>
          <h2>Submit the form</h2>
          <p>{storageNotice()}</p>
          <p>
            After a live submit, your opt-out requests go to the companies on the{" "}
            <AppLink href="/brokers">brokers page</AppLink>. You do not fill out a separate form at
            each company.
          </p>
        </li>
      </ol>
      <h2>After you submit</h2>
      <p>
        Companies decide whether they have a record and how they respond. If a status is shown later,
        it is one of Submitted, Confirmed, Pending, Not completed, or No record found. None of those
        words means a deletion was verified. DROP Texas does not check that a broker deleted a record.
      </p>
      <h2>If you do not want to continue</h2>
      <p>
        Close the form before you submit. Nothing is sent until you submit. The preview storage note
        on the form tells you whether anything is saved yet.
      </p>
    </Topic>
  );
}

export function PersonalInformationPage() {
  return (
    <Topic
      title="Personal information"
      heading="Personal information"
      tone="personal"
      description="What the DROP Texas form asks for, why each field is used, and what is not collected."
    >
      <p>
        The form asks only for the personal information a broker typically needs to find a record and
        honor an opt-out. DROP Texas does not sell that information. It is not used for marketing,
        calls, or texts from us.
      </p>
      <h2>Personal information the form asks</h2>
      <ul>
        <li>Name, including an optional middle name, so the request names the same person the broker may hold.</li>
        <li>Date of birth, which many brokers use to tell people with the same name apart.</li>
        <li>Mailing address. Most broker opt-out forms require a physical address.</li>
        <li>Email, so a broker can match an online record and so we can reach you about the request.</li>
        <li>Texas residency, which records whether the request is marked Texas or non-Texas.</li>
        <li>
          Phone number, if you choose to provide it. If you do, it is used only to find records and to
          fill in the opt-out sent to brokers.
        </li>
      </ul>
      <h2>Child requests</h2>
      <p>
        For a child under 13, a parent or guardian also provides the child's name, date of birth and,
        if different, address. Companies may ask for proof of guardianship. The{" "}
        <AppLink href="/children">children's information page</AppLink> has the sourced notes and the
        child form.
      </p>
      <h2>What the form does not ask</h2>
      <p>
        The form does not ask for a Social Security number, a driver license number, a device ID, an
        account password, or a payment card. Extra identifiers some brokers hold are described on{" "}
        <AppLink href="/unique-identifiers">unique identifiers</AppLink>.
      </p>
      <h2>How it is handled</h2>
      <p>
        Pages and API calls are served over HTTPS. DROP Texas does not sell the information you enter.
        Personal information you type here is not sold, and it is not used for marketing calls or texts.
      </p>
      <p>{storageNotice()}</p>
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
      description="What a data broker is, which companies DROP Texas names, and what an opt-out of sale does."
    >
      <p>
        Data brokers collect, process, or transfer personal data they did not collect from you in
        person. They can then sell a profile, or access to one, to other businesses. You often have no
        account there, so you never chose the sale.
      </p>
      <h2>What an opt-out asks data brokers</h2>
      <p>
        An opt-out request asks a data broker not to sell your personal information. It is not a
        promise that the broker deletes every copy, and it does not pull back data already sold. DROP
        Texas does not check that a broker deleted a record.
      </p>
      <h2>Companies this site names</h2>
      <p>
        The home page carousel names {BROKERS.join(", ")}. Each name has a card on the{" "}
        <AppLink href="/brokers">brokers page</AppLink>, with categories taken from that company’s own
        privacy notice. Names are not added to that list until they are in the broker registry this
        project uses.
      </p>
      <p>
        Some of those companies also act as consumer reporting agencies. An opt-out of sale is not a
        credit freeze and is not a dispute of a credit file. A freeze is a separate step you take with
        the bureaus. The FTC explains it at{" "}
        <a
          href="https://consumer.ftc.gov/articles/credit-freeze-or-fraud-alert"
          target="_blank"
          rel="noopener noreferrer"
        >
          consumer.ftc.gov
        </a>
        .
      </p>
      <h2>Texas data broker registration</h2>
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
      heading="People search sites"
      tone="identifiers"
      description="How brokers match a person, which details this form uses, and which identifiers it does not collect."
    >
      <p>
        People search sites match records with identifiers: a name plus a date of birth, an address, an
        email, a phone number, and, at some companies, device IDs or government identifiers. The more
        of those a company holds, the easier it is to attach new data to the same person.
      </p>
      <h2>What people search sites use to match you</h2>
      <p>
        The form asks for your name (including an optional middle name), date of birth, mailing
        address, email, Texas residency, and, if you choose, your phone number. Those are the details
        most opt-out forms use. For a child request, a parent or guardian also provides the child's
        name, date of birth and, if different, address.
      </p>
      <h2>What this form does not collect</h2>
      <p>
        Some brokers match people with extra identifiers. This form does not ask for device IDs,
        advertising IDs, account passwords, Social Security numbers, or other government ID numbers.
        Collecting those would put more of your information in one place without a matching field on
        every broker form this service uses.
      </p>
      <h2>What a broker's own notice may list</h2>
      <p>
        The <AppLink href="/brokers">brokers page</AppLink> lists categories each company names in its
        own privacy notice, such as email, phone, or address, when that notice says so. What any one
        broker actually holds about you can differ from that list.
      </p>
      <p>
        The <AppLink href="/personal-information">personal information</AppLink> page covers how DROP
        Texas handles the fields you do enter. People search sites still decide which of those fields
        they keep. This page does not list a private record.
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
      description="A plain-English summary of consumer rights in Texas Business and Commerce Code chapter 541, and which right DROP Texas uses."
    >
      <h2>What the Texas Data Privacy and Security Act is used for here</h2>
      <p>
        DROP Texas is a private service. You can send an opt-out of the sale of personal data under
        the Texas Data Privacy and Security Act. This form does not ask a company to confirm, correct,
        delete, or port your data. Those other rights exist in the chapter. This service is built
        around the opt-out of sale.
      </p>
      <p>
        The Texas box records chapter 541. An unchecked box still uses TDPSA for now and is marked
        non-Texas. No government agency reviews this form.
      </p>
      <h2>Who the chapter covers</h2>
      <p>
        A consumer under Section 541.001(7) is a Texas resident acting in a personal or household
        context. That term does not include someone acting in a commercial or employment context.
      </p>
      <h2>Consumer rights in Section 541.051</h2>
      <p>Section 541.051(b) says a controller shall comply with an authenticated request to:</p>
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
      <h2>Time to respond</h2>
      <p>
        Section 541.052(b) says the controller shall respond not later than the 45th day after it receives
        the request. It may extend that once by another 45 days when reasonably necessary, if it tells you
        the reason during the first 45 days. That deadline is in the statute. It is not a promise that a
        DROP Texas opt-out finishes in 45 days.
      </p>
      <h2>Appeals and enforcement</h2>
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
      heading="Privacy help"
      tone="help"
      description="Answers about signup, request statuses, children, Texas law, and what DROP Texas does not do."
    >
      {/* TODO: no support email is configured. Do not invent a contact address on this page. */}
      <p>
        Privacy help, in short answers, for the questions people ask before they submit. The{" "}
        <AppLink href="/overview">overview</AppLink> and{" "}
        <AppLink href="/how-it-works">how it works</AppLink> pages cover the same ground in order.
      </p>
      <h2>Privacy help questions</h2>
      <div className="faq">
        <details>
          <summary>What is DROP Texas?</summary>
          <p>
            DROP Texas is a free service with a form you use to ask data brokers not to sell your
            personal information. You fill out one form and send the requests. Brokers decide whether
            they have a record and how they respond.
          </p>
        </details>
        <details>
          <summary>What does a request cost?</summary>
          <p>
            The service does not charge a fee. You can also opt out yourself at each broker, for free.
            There is no subscription for making the request through this site.
          </p>
        </details>
        <details>
          <summary>What do I enter?</summary>
          <p>
            The form asks for your name (including an optional middle name), date of birth, mailing
            address, email, Texas residency, and, if you choose to provide it, your phone number. For a
            child request, a parent or guardian also provides the child's name, date of birth and, if
            different, address. The page needs JavaScript to show the form. It does not ask for a
            Social Security number, a password, or a device ID.
          </p>
        </details>
        <details>
          <summary>What do the statuses mean?</summary>
          <p>
            If a status is shown later, it is one of Submitted, Confirmed, Pending, Not completed, or
            No record found. None of those words means a deletion was verified. DROP Texas does not
            check that a broker deleted a record.
          </p>
        </details>
        <details>
          <summary>Do I have to live in Texas?</summary>
          <p>
            No. A checked Texas box records the Texas Data Privacy and Security Act. An unchecked box
            still uses that law for now and is marked non-Texas.
          </p>
        </details>
        <h2>Privacy help on time limits and children</h2>
        <details>
          <summary>How fast must a company answer a TDPSA request?</summary>
          <p>
            Section 541.052(b) gives a controller 45 days to respond to a consumer’s request, with one
            possible 45-day extension. That deadline is in the statute. It is not a promise that a broker
            will finish a DROP Texas opt-out in that time. The{" "}
            <AppLink href="/tdpsa">TDPSA page</AppLink> has the rest of that summary.
          </p>
        </details>
        <details>
          <summary>Can I send a request for a child?</summary>
          <p>
            A parent or legal guardian can choose My child on the form for a child under 13. Teens 13
            to 17 can submit for themselves. Companies may ask for proof of guardianship. The{" "}
            <AppLink href="/children">children's information page</AppLink> has the sourced notes.
          </p>
        </details>
        <details>
          <summary>What if a broker does not respond?</summary>
          <p>
            You send the request. A company still decides how to answer. If a status stays
            Pending or Not completed, that is what is known. The statute's appeal and attorney general
            complaint path is described on the TDPSA page. This site is not a government complaint form.
          </p>
        </details>
        <details>
          <summary>Does this freeze my credit or stop robocalls?</summary>
          <p>
            No. A credit freeze is a separate step with the credit bureaus. The National Do Not Call
            Registry is a separate step at{" "}
            <a href="https://www.donotcall.gov" target="_blank" rel="noopener noreferrer">
              donotcall.gov
            </a>
            . DROP Texas does not place a freeze and does not enroll you in that registry.
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
      <p>You can share DROP Texas with one link. The page below shows what that link is, and what it is not.</p>
      <h2>Why share DROP Texas</h2>
      <p>
        Most people never find every broker's opt-out form. A Texan who wants fewer companies selling
        their personal information can use this site without paying a fee. Sharing the link is how they
        hear about it.
      </p>
      <h2>What you are sharing</h2>
      <p>You can share this private service at {SITE}.</p>
      <p>{SHARE_TEXT}</p>
      <p>
        You are sharing a free private service, not a promise that a broker deleted a record, and not a
        government program. {DISCLAIMER}
      </p>
      <h2>How to share</h2>
      <p>Copy the link, or open email, X, or Facebook with the text already filled in.</p>
      <p>
        Share DROP Texas only as a private form, not as a state program. Say that brokers still decide
        how they answer. Do not promise that a record was deleted. The person you tell can read the
        statute and then choose whether to use the form. There is no fee for them either.
      </p>
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
      heading="Children's data"
      tone="children"
      description="Sourced notes on children's information, Texas law, and how a parent can send a request for a child under 13."
      ctaHref="/start?for=child"
    >
      <p>
        Children's data can show up in a broker file even when a child never filled out a form. The notes
        below cite public reports and the Texas statute. A parent uses the DROP Texas form for a child
        under 13.
      </p>
      <h2>Students' information and children's data offered for sale</h2>
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
        A parent or legal guardian can choose My child on the request form for a child under 13 and send
        the requests for free. Companies decide how to respond, and they may ask for proof of guardianship.
      </p>
      <p>Teens who are 13 to 17 can submit a request for themselves.</p>
    </Topic>
  );
}
