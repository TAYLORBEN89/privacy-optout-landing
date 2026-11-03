import { BROKER_PROFILES, BROKER_SOURCES_READ } from "../data/brokerProfiles";
import { DISCLAIMER } from "../copy";

function accessedLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BrokersPage() {
  return (
    <div className="brokers-page">
      <article className="panel brokers-intro">
        <h1>Data brokers</h1>
        <p>
          A data broker collects personal information and shares or licenses it. This page covers the nine
          names in the carousel on the DROP Texas home page.
        </p>
        <p>
          Each card lists categories taken from that organization’s own privacy notice. DMAchoice and Catalog
          Choice are mail-preference services. Their notices describe information people give them to opt out,
          not a marketing profile of the general public.
        </p>
        <p>
          This is a plain summary of those notices. It is not a complete record of what any company holds about
          you, and it is not legal advice.
        </p>
      </article>
      <ul className="broker-grid">
        {BROKER_PROFILES.map((broker) => (
          <li key={broker.name} className="broker-card panel" data-broker={broker.name}>
            <h2>{broker.name}</h2>
            {broker.limited ? <p className="broker-limited">Limited public information</p> : null}
            <p className="broker-scope">{broker.scope}</p>
            <ul>
              {broker.categories.map((category) => (
                <li key={category}>{category}</li>
              ))}
            </ul>
            {broker.note ? <p className="broker-note">{broker.note}</p> : null}
            <a href={broker.source.url} target="_blank" rel="noopener noreferrer">
              {broker.source.name}
            </a>
            <p className="broker-accessed">Accessed {accessedLabel(BROKER_SOURCES_READ)}.</p>
          </li>
        ))}
      </ul>
      <p className="independence">{DISCLAIMER}</p>
    </div>
  );
}
