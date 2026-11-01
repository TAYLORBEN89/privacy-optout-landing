import { AppLink } from "../router";
import { Topic } from "./topics";

export function ControlBenefitPage() {
  return (
    <Topic
      title="More control of your data"
      heading="More control of your data"
      tone="overview"
      description="Using DROP helps you limit the information data brokers collect and sell about you."
    >
      <p>
        Using DROP helps you limit the information data brokers collect and sell about you. Data brokers
        collect a wide range of your personal information, which may include your Social Security number,
        data about your children, search history, and much more.
      </p>
      <h2>The problem</h2>
      <p>
        A data broker builds a profile from records it did not get from you in person. It can then sell
        that profile, or access to it, to other businesses. You do not get a say in each sale unless you
        send a request the broker will accept.
      </p>
      <h2>Examples</h2>
      <ul>
        <li>A people-search page lists your name, age, addresses, and relatives for anyone who searches.</li>
        <li>A marketing broker sells a list that includes your phone number or email.</li>
        <li>
          Some brokers' own notices say they may hold government identifiers, information about people in
          your household, or online activity such as searches. What any one broker holds varies.
        </li>
      </ul>
      <h2>How DROP Texas helps</h2>
      <p>
        You submit one form. DROP Texas sends opt-out requests that ask brokers not to sell your personal
        information. The form asks for your name, date of birth, address, email, and, if you choose, your
        phone. It does not ask for a Social Security number.
      </p>
      <p>
        Brokers decide whether they have a record and how they respond. DROP Texas does not check that a
        broker deleted a record. An opt-out limits future sales. It does not pull back every copy already
        sold.
      </p>
    </Topic>
  );
}

export function SpamBenefitPage() {
  return (
    <Topic
      title="Reduced spam and scams"
      heading="Reduced spam and scams"
      tone="how"
      description="Limiting how your data gets sold can reduce unwanted texts, calls, and emails. Results vary and can take time."
    >
      <p>
        Limiting how your data gets sold can reduce the volume of unwanted texts, calls, or emails you
        receive. Results will vary by consumer and may take time to notice.
      </p>
      <h2>The problem</h2>
      <p>
        Once a phone number, email, or address is sold, companies you have never contacted can use it.
        Some of those messages are ads. Some are scams that use a real detail about you so the message
        looks personal.
      </p>
      <h2>Examples</h2>
      <ul>
        <li>A robocall uses your name because that name was on a sold list.</li>
        <li>Offer mail shows up at a new address because a broker sold the move.</li>
        <li>A text names your city or the last digits of your phone number and pretends to be a bank or a delivery.</li>
      </ul>
      <h2>How DROP Texas helps</h2>
      <p>
        An opt-out asks brokers not to keep selling the contact details that feed those lists. Fewer new
        sales can mean fewer companies get your number for the first time.
      </p>
      <p>
        This does not stop a company you already do business with from emailing you. It does not sign you
        up for the National Do Not Call Registry. You can do that yourself at{" "}
        <a href="https://www.donotcall.gov" target="_blank" rel="noopener noreferrer">
          donotcall.gov
        </a>
        . Spam that never came from a broker list will not change because of an opt-out.
      </p>
    </Topic>
  );
}

export function SecurityBenefitPage() {
  return (
    <Topic
      title="Greater security"
      heading="Greater security"
      tone="personal"
      description="Limiting the spread of your personal information can reduce your risk of identity theft and targeted fraud."
    >
      <p>
        Limiting the spread of your personal information can reduce your risk of identity theft and
        targeted fraud.
      </p>
      <h2>The problem</h2>
      <p>
        Identity theft and targeted fraud get easier when more strangers can look up the facts used to
        impersonate you: your age, past addresses, phone number, relatives, and email. A people-search
        page or a sold profile puts those facts in one place.
      </p>
      <h2>Examples</h2>
      <ul>
        <li>Someone uses your age and a past address to answer a security question.</li>
        <li>A scam text uses your real phone number and city so it looks like your bank.</li>
        <li>A caller names a relative listed on a broker page and pretends there is a family emergency.</li>
      </ul>
      <h2>How DROP Texas helps</h2>
      <p>
        Opt-out requests ask brokers not to sell those details onward. Less circulation does not erase
        what was already copied, and it does not stop every scam. It removes one way new sellers get a
        fresh copy.
      </p>
      <p>
        DROP Texas does not place a credit freeze and it is not identity-theft insurance. A freeze is a
        separate step you take with the credit bureaus. The Federal Trade Commission explains that step
        at{" "}
        <a
          href="https://consumer.ftc.gov/articles/credit-freeze-or-fraud-alert"
          target="_blank"
          rel="noopener noreferrer"
        >
          consumer.ftc.gov
        </a>
        .
      </p>
    </Topic>
  );
}

export function TimeBenefitPage() {
  return (
    <Topic
      title="Hours back from paperwork"
      heading="Hours back from paperwork"
      tone="brokers"
      description="DROP Texas sends opt-out requests from one form, instead of a separate form at each data broker."
    >
      <p>
        Each data broker runs its own opt-out. The forms ask for the same name and address, then differ
        in the extra steps. Most people stop after one or two.
      </p>
      <h2>The problem</h2>
      <p>
        There is no single public form that reaches every broker. You have to find each company's page,
        prove you are the person in the record, and repeat that for the next company. New brokers appear
        after you finish the ones you know about.
      </p>
      <h2>Examples</h2>
      <ul>
        <li>One people-search site wants a mailing address. Another wants an email confirmation. A third only offers a web form.</li>
        <li>A marketing-list broker asks you to type every email and phone number it should suppress.</li>
        <li>Doing this yourself across dozens of companies takes hours, and the list of companies is not stable.</li>
      </ul>
      <h2>How DROP Texas helps</h2>
      <p>
        You fill out one form. DROP Texas sends the opt-out requests. The{" "}
        <AppLink href="/brokers">brokers page</AppLink> names companies the home page carousel covers and
        links to categories from each company's own privacy notice.
      </p>
      <p>
        Companies still answer on their own schedule. DROP Texas does not check that a broker deleted a
        record. Sending the requests is the time you get back. Confirming each outcome is still the
        broker's job.
      </p>
    </Topic>
  );
}

export function CostBenefitPage() {
  return (
    <Topic
      title="Free to make the request"
      heading="Free to make the request"
      tone="identifiers"
      description="DROP Texas does not charge a fee to send opt-out requests. You can also ask brokers yourself for free."
    >
      <p>
        Asking a data broker not to sell your personal information should not require a subscription.
        DROP Texas does not charge a fee to send the requests.
      </p>
      <h2>The problem</h2>
      <p>
        Some removal services bill every month. The charge is for their labor, not a fee the broker is
        allowed to demand before it honors an opt-out. People pay because finding every broker and every
        form takes time they do not have.
      </p>
      <h2>Examples</h2>
      <ul>
        <li>A paid service renews monthly while you are not shown which requests went out.</li>
        <li>A broker's own opt-out page is free, but it is buried in a privacy notice and easy to miss.</li>
        <li>A family paying for several people multiplies a subscription that the underlying requests do not require.</li>
      </ul>
      <h2>How DROP Texas helps</h2>
      <p>
        The form is free. You can also opt out yourself, one broker at a time, for free. DROP Texas is a
        way to send those requests without paying us.
      </p>
      <p>
        Free does not mean a broker must delete a record, and it does not mean every company will agree.
        If a status is shown later, it is one of Submitted, Confirmed, Pending, Not completed, or No
        record found. None of those words means a deletion was verified.
      </p>
    </Topic>
  );
}

export function RightsBenefitPage() {
  return (
    <Topic
      title="A right you can use"
      heading="A right you can use"
      tone="tdpsa"
      description="Texas law gives you the right to opt out of the sale of your personal data. DROP Texas sends that request for you."
    >
      <p>
        Texas law gives you the right to opt out of the sale of your personal data. The right matters
        only if a company receives a request it can act on.
      </p>
      <h2>The problem</h2>
      <p>
        The Texas Data Privacy and Security Act, Business and Commerce Code chapter 541, says a
        controller must honor an authenticated consumer request to opt out of the sale of personal data,
        targeted advertising, and certain profiling. The statute does not file the request for you. Each
        company still expects you to find its process.
      </p>
      <h2>Examples</h2>
      <ul>
        <li>
          Section 541.051(b)(5) is the opt-out of sale, targeted advertising, and profiling that furthers
          a decision with a legal or similarly significant effect.
        </li>
        <li>
          Section 541.052(b) gives a controller 45 days to respond, with one possible 45-day extension.
          That deadline is in the statute. It is not a promise that a DROP Texas opt-out finishes in 45
          days.
        </li>
        <li>
          If a company refuses, Section 541.053 lets you appeal. The chapter does not give you a private
          lawsuit. The attorney general enforces it.
        </li>
      </ul>
      <h2>How DROP Texas helps</h2>
      <p>
        The request DROP Texas sends is an opt-out of sale under that right. A plain-English summary of
        the rest of the chapter is on the <AppLink href="/tdpsa">TDPSA page</AppLink>. The statute is at{" "}
        <a href="https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm" target="_blank" rel="noopener noreferrer">
          statutes.capitol.texas.gov
        </a>
        .
      </p>
      <p>
        This is not legal advice, and DROP Texas is not a government site. An unchecked Texas box on the
        form still uses TDPSA for now and is marked non-Texas.
      </p>
    </Topic>
  );
}

export function ChildrenBenefitPage() {
  return (
    <Topic
      title="Protection for your children"
      heading="Protection for your children"
      tone="children"
      description="A parent or guardian can ask data brokers not to sell a child's personal information. DROP Texas sends that request for free."
      ctaHref="/start?for=child"
    >
      <p>
        A parent or guardian can ask data brokers not to sell a child's personal information. Children
        are not going to find each broker's form, and a profile can include them because they live with
        an adult whose data was sold.
      </p>
      <h2>The problem</h2>
      <p>
        Children's information shows up in places built for adults: people-search pages that list
        household members, student lists offered for sale, and apps that collected data from children
        under 13. Once that information is in a broker's file, other companies can buy it.
      </p>
      <h2>Examples</h2>
      <ul>
        <li>A people-search page lists a child's name because the child shares an address with a parent.</li>
        <li>Student lists have been advertised with names, addresses, schools, and hobbies.</li>
        <li>
          Apps and ad companies have collected personal information from children under 13 without a
          parent's permission. The sourced cases are on the{" "}
          <AppLink href="/children">children's information page</AppLink>.
        </li>
      </ul>
      <h2>How DROP Texas helps</h2>
      <p>
        On the request form, a parent or legal guardian chooses My child for a child under 13 and enters
        the child's name and date of birth. DROP Texas sends the opt-out requests for free. Companies
        decide how to respond, and they may ask for proof of guardianship.
      </p>
      <p>
        Teens who are 13 to 17 can submit a request for themselves. Under the Texas Data Privacy and
        Security Act, a parent or guardian may also exercise the consumer's rights for a known child.
        That summary, with the statute links, is on the{" "}
        <AppLink href="/children">children's information page</AppLink>.
      </p>
    </Topic>
  );
}
