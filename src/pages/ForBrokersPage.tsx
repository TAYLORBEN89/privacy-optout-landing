import { DISCLAIMER } from "../copy";
import { HashFlow } from "../components/HashFlow";

/** Placeholder until the starter kit repo is published. Do not point this at a repo that does not exist. */
export const STARTER_KIT_URL = "#starter-kit-coming-soon";

const TECH_URL = "https://privacy.ca.gov/drop-for-data-brokers/technical-specifications/working-with-data/";
const REG_URL = "https://cppa.ca.gov/regulations/pdf/data_broker_drop_reg.pdf";
const TDPSA_URL = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm";
const BROKER_LAW_URL = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.510.htm";
const REGISTRY_URL = "https://texas-sos.appianportalsgov.com/data-broker-registry";

export function ForBrokersPage() {
  return (
    <article className="panel proposal-page for-brokers-page">
      <section aria-labelledby="for-brokers-title">
        <h1 id="for-brokers-title">For Data Brokers</h1>
        <p>
          This page is for data brokers registered in Texas. It explains the hashed format DROP Texas
          plans to offer, why a broker might take part on a voluntary basis, and where the starter kit
          will be.
        </p>
      </section>

      <section className="proposal-hash" aria-labelledby="for-brokers-hash">
        <h2 id="for-brokers-hash">How the hash system works</h2>
        <p>
          Identifiers are standardized, then hashed one way with SHA-256. The broker hashes its own
          records the same way and compares the hashes, so it matches against its own records without
          being given the raw identifiers. Each broker answers on its own, each with its own 45-day
          response window.
        </p>
        <p>
          The steps below follow the{" "}
          <a href={TECH_URL} target="_blank" rel="noopener noreferrer">
            technical guide
          </a>{" "}
          and the{" "}
          <a href={REG_URL} target="_blank" rel="noopener noreferrer">
            data broker regulation
          </a>{" "}
          for California's DROP, the Delete Request and Opt-out Platform. DROP Texas is not the
          California Privacy Protection Agency, is not California's DROP, and is not affiliated with
          them.
        </p>
        <HashFlow />
      </section>

      <section aria-labelledby="for-brokers-why">
        <h2 id="for-brokers-why">Why take part voluntarily</h2>
        <p>
          Texans already have these rights under Texas law. The Texas Data Privacy and Security Act
          (TDPSA),{" "}
          <a href={TDPSA_URL} target="_blank" rel="noopener noreferrer">
            Business and Commerce Code chapter 541
          </a>
          , gives Texans a right to ask a business the law covers to delete personal data about them,
          and to opt out of the sale of that data and of targeted advertising.
        </p>
        <p>
          A covered business must answer that request no later than 45 days after it receives it. It
          may extend the deadline once, by another 45 days, when that is reasonably necessary. It has
          to tell the person about the extension, and why, inside the first 45 days.
        </p>
        <p>
          Data brokers register with the Texas Secretary of State under{" "}
          <a href={BROKER_LAW_URL} target="_blank" rel="noopener noreferrer">
            Business and Commerce Code chapter 510
          </a>
          . The{" "}
          <a href={REGISTRY_URL} target="_blank" rel="noopener noreferrer">
            registry
          </a>{" "}
          lists hundreds of registered data brokers, and each one has its own request process. One
          shared hashed format would give those requests one consistent shape to match against.
        </p>
        <p>
          Taking part is voluntary. Texas does not run a platform like California's DROP, and Texas
          does not require brokers to use one. A status a broker reports is not proof that a record
          was deleted.
        </p>
      </section>

      <section aria-labelledby="for-brokers-security">
        <h2 id="for-brokers-security">Security</h2>
        <p>
          DROP Texas is built to SOC 2 standards. That is not a certification claim. Pages and form
          posts use HTTPS in transit.
        </p>
      </section>

      <section aria-labelledby="for-brokers-kit">
        <h2 id="for-brokers-kit">Starter kit</h2>
        <p>
          A starter kit for brokers is being built. It will cover the standardize and hash steps above.
          The link below is a placeholder until the kit is published.
        </p>
        <p>
          <a className="starter-kit-link" href={STARTER_KIT_URL} aria-disabled="true">
            Starter kit (not published yet)
          </a>
        </p>
        <p>Questions: help@droptexas.com.</p>
      </section>

      <p className="independence">{DISCLAIMER}</p>
    </article>
  );
}
