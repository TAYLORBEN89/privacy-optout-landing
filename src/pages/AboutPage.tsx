import { DISCLAIMER } from "../copy";

export function AboutPage() {
  return (
    <article className="panel">
      <h1>About DROP Texas</h1>
      <p>
        About DROP Texas: it is a private, free opt-out service. It gives you a form to ask data brokers
        not to sell your personal information. It is not a government program.
      </p>
      <h2>More about DROP Texas</h2>
      <p>
        A checked Texas box records the Texas Data Privacy and Security Act. An unchecked box still uses
        that law for now and is marked non-Texas. No government office reviews the form.
      </p>
      <p>
        The form asks for your name, date of birth, mailing address, and email. It asks whether you live
        in Texas. Phone is optional. For a child under 13, a parent or guardian also adds the child's
        name and date of birth and, if different, address.
      </p>
      <p>
        You send the opt-out requests. Brokers decide whether they have a record and how they answer.
        DROP Texas does not check that a broker deleted a record. A status on a later screen is not
        proof of deletion.
      </p>
      <p>
        There is no fee. Read chapter 541 yourself
        at{" "}
        <a href="https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm" target="_blank" rel="noopener noreferrer">
          statutes.capitol.texas.gov
        </a>
        . Then use the form when you are ready. This is not legal advice.
      </p>
      <p>
        A checked Texas box means the Texas Data Privacy and Security Act (TDPSA). An unchecked box
        still uses TDPSA for now and is marked non-Texas.
      </p>
      <p className="independence">{DISCLAIMER}</p>
    </article>
  );
}