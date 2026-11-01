const STATUTE_URL = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm";

function Check() {
  return (
    <svg className="rights-check" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="#ee0014" strokeWidth="1.4" />
      <path d="M4.6 8.2 7 10.5 11.4 5.7" fill="none" stroke="#ee0014" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RightsSection() {
  return (
    <section className="rights" aria-labelledby="rights-heading">
      <h2 id="rights-heading">Your rights under the TDPSA</h2>
      {/* Plain English for a "consumer": a Texas resident acting in an individual or household context. Sec. 541.001(7). */}
      <p className="rights-body">
        The Texas Data Privacy and Security Act gives Texans rights over the personal data companies collect about them. DROP Texas helps you use them.
      </p>
      <ul className="rights-list">
        {/* Tex. Bus. & Com. Code § 541.051(b)(1) */}
        <li>
          <Check />
          <span>Confirm whether a company is processing your personal data and access that data.</span>
        </li>
        {/* Tex. Bus. & Com. Code § 541.051(b)(2) */}
        <li>
          <Check />
          <span>Correct inaccuracies in your personal data, taking into account the data and why it is used.</span>
        </li>
        {/* Tex. Bus. & Com. Code § 541.051(b)(3) */}
        <li>
          <Check />
          <span>Delete personal data provided by or obtained about you.</span>
        </li>
        {/* Tex. Bus. & Com. Code § 541.051(b)(4): digital format, data the consumer previously provided, portable and readily usable to the extent technically feasible. */}
        <li>
          <Check />
          <span>If your data is in a digital format, get a portable copy of data you previously provided, when that is technically feasible.</span>
        </li>
        {/* Tex. Bus. & Com. Code § 541.051(b)(5)(A)–(C). Profiling that furthers a legal or similarly significant decision only; not all profiling. */}
        <li>
          <Check />
          <span>Opt out of the sale of personal data, targeted advertising, and profiling that furthers a legal or similarly significant decision.</span>
        </li>
        {/* Tex. Bus. & Com. Code § 541.052(b): response by the 45th day; one 45-day extension when reasonably necessary, with notice and the reason inside the first 45 days. */}
        <li>
          <Check />
          <span>A company must respond within 45 days, and may extend that once by 45 days if it tells you why during the first 45 days.</span>
        </li>
        {/* Tex. Bus. & Com. Code § 541.053(a): a consumer may appeal a controller's refusal to take action. */}
        <li>
          <Check />
          <span>You can appeal a refusal to act on your request.</span>
        </li>
        {/* Tex. Bus. & Com. Code § 541.101(b)(3). Sec. 541.101(c) still allows some price or quality differences tied to an opt-out or a voluntary loyalty program. */}
        <li>
          <Check />
          <span>A company may not discriminate against you for exercising these rights.</span>
        </li>
        {/* Tex. Bus. & Com. Code § 541.151: the attorney general has exclusive authority to enforce this chapter. */}
        <li>
          <Check />
          <span>The Texas Attorney General enforces this law.</span>
        </li>
      </ul>
      <p className="rights-note">This is a plain-English summary, not legal advice.</p>
      <a className="rights-law" href={STATUTE_URL} target="_blank" rel="noopener noreferrer">
        Read the full law &gt;
      </a>
    </section>
  );
}
