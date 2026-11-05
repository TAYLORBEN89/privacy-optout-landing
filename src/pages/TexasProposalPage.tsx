import { DISCLAIMER, TEXAS_PROPOSAL_MISSION } from "../copy";
import { AppLink } from "../router";
import { HashFlow } from "../components/HashFlow";
import banner1500Jpg from "../assets/banner/x-banner-1500.jpg";
import banner1500Webp from "../assets/banner/x-banner-1500.webp";
import banner750Jpg from "../assets/banner/x-banner-750.jpg";
import banner750Webp from "../assets/banner/x-banner-750.webp";

const BANNER_SIZES = "(max-width: 960px) calc(100vw - 32px), 900px";

const TECH_URL = "https://privacy.ca.gov/drop-for-data-brokers/technical-specifications/working-with-data/";
const REG_URL = "https://cppa.ca.gov/regulations/pdf/data_broker_drop_reg.pdf";
const TDPSA_URL = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm";
const BROKER_LAW_URL = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.510.htm";
const SOS_URL = "https://www.sos.texas.gov/statdoc/data-brokers.shtml";
const REGISTRY_URL = "https://texas-sos.appianportalsgov.com/data-broker-registry";
const PULL_QUOTE = "a right you can't enforce isn't a right at all";

function MissionCopy({ text }: { text: string }) {
  const start = text.toLowerCase().indexOf(PULL_QUOTE);
  if (start < 0) return text;
  return (
    <>
      {text.slice(0, start)}
      <q className="proposal-quote">{text.slice(start, start + PULL_QUOTE.length)}</q>
      {text.slice(start + PULL_QUOTE.length)}
    </>
  );
}

export function TexasProposalPage() {
  return (
    <article className="panel proposal-page">
      <section className="proposal-mission" aria-labelledby="proposal-title">
        <h1 id="proposal-title">The Texas Proposal</h1>
        <p>
          <MissionCopy text={TEXAS_PROPOSAL_MISSION} />
        </p>
      </section>

      <picture className="proposal-banner">
        <source type="image/webp" srcSet={`${banner750Webp} 750w, ${banner1500Webp} 1500w`} sizes={BANNER_SIZES} />
        <img
          src={banner1500Jpg}
          srcSet={`${banner750Jpg} 750w, ${banner1500Jpg} 1500w`}
          sizes={BANNER_SIZES}
          width={1500}
          height={500}
          loading="lazy"
          decoding="async"
          alt="Dark blue Texas hill country at dusk with the words: A right you can't enforce isn't a right at all, droptexas.com"
        />
      </picture>

      <section className="proposal-hash" aria-labelledby="hash-heading">
        <h2 id="hash-heading">How the hash system works</h2>
        <p>
          California's DROP, the Delete Request and Opt-out Platform, matches a request without
          handing a broker the raw identifiers. DROP Texas is not the California Privacy Protection
          Agency, is not California's DROP, and is not affiliated with them. The steps below follow
          the agency's{" "}
          <a href={TECH_URL} target="_blank" rel="noopener noreferrer">
            technical guide
          </a>{" "}
          and its{" "}
          <a href={REG_URL} target="_blank" rel="noopener noreferrer">
            data broker regulation
          </a>
          .
        </p>
        <HashFlow />
      </section>

      <section aria-labelledby="tdpsa-heading">
        <h2 id="tdpsa-heading">The right, and the practical burden</h2>
        <p>
          Texas law, the Texas Data Privacy and Security Act (TDPSA), already gives Texans a right to
          ask a business the law covers to delete personal data about them, and to opt out of the sale
          of that data and of targeted advertising. The text is{" "}
          <a href={TDPSA_URL} target="_blank" rel="noopener noreferrer">
            Business and Commerce Code chapter 541
          </a>
          .
        </p>
        <p>
          A covered business must answer that request no later than 45 days after it receives it. It
          may extend the deadline once, by another 45 days, when that is reasonably necessary because
          of how complex the requests are or how many there are. It has to tell the person about the
          extension, and why, inside the first 45 days.
        </p>
        <p>
          Using that right with data brokers is a different task from the right itself. Brokers
          register with the Texas Secretary of State under a separate law,{" "}
          <a href={BROKER_LAW_URL} target="_blank" rel="noopener noreferrer">
            Business and Commerce Code chapter 510
          </a>
          . That registration law was chapter 509 until it was redesignated as chapter 510, effective
          September 1, 2025. It is not the TDPSA. The Secretary of State keeps the{" "}
          <a href={REGISTRY_URL} target="_blank" rel="noopener noreferrer">
            registry
          </a>{" "}
          and describes it on its{" "}
          <a href={SOS_URL} target="_blank" rel="noopener noreferrer">
            data brokers page
          </a>
          . The registry lists hundreds of registered data brokers. Each one has its own request
          process. Following up inside each 45-day response window is more than most people can keep
          doing. That is a practical burden for everyday Texans. It is not a claim that the TDPSA
          cannot be enforced.
        </p>
      </section>

      <section aria-labelledby="plan-heading">
        <h2 id="plan-heading">What DROP Texas plans to offer</h2>
        <p>
          DROP Texas plans to offer brokers this same hashed format on a voluntary basis. That is an
          intention. It is not a claim that brokers take part today, and it is not a claim that DROP
          Texas sends requests for people. A status a broker might report is not proof that a record
          was deleted.
        </p>
        <p>
          Texas does not run a platform like California's DROP, and Texas does not require brokers to
          use one.
        </p>
        <p>
          Data brokers can read more on the <AppLink href="/for-brokers">For Data Brokers page</AppLink>.
        </p>
      </section>

      <section aria-labelledby="support-heading">
        <h2 id="support-heading">Support the Texas Proposal</h2>
        <p>
          If you support this goal, share the page and write to help@droptexas.com. The{" "}
          <AppLink href="/share">share page</AppLink> has the link to copy.
        </p>
      </section>

      <p className="independence">{DISCLAIMER}</p>
    </article>
  );
}
