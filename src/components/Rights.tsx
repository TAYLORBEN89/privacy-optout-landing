import { TDPSA_POINTS } from "../data/rights";
import { AppLink } from "../router";

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
        {TDPSA_POINTS.map((point) => (
          <li key={point.id}>
            <Check />
            <span>{point.text}</span>
          </li>
        ))}
      </ul>
      <p className="rights-note">This is a plain-English summary, not legal advice.</p>
      <AppLink className="rights-law" href="/about">
        About DROP Texas &gt;
      </AppLink>
    </section>
  );
}
