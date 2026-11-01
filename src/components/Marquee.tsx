import { BROKERS } from "../data/brokers";
import { AppLink } from "../router";

export function BrokerMarquee() {
  const names = BROKERS.map((name) => (
    <li key={name} className="broker-name">
      {name}
    </li>
  ));
  const clones = BROKERS.map((name) => (
    <li key={`${name}-clone`} className="broker-name" data-clone="true" aria-hidden="true">
      {name}
    </li>
  ));

  return (
    <section className="marquee-section" aria-labelledby="broker-marquee-label">
      <h2 id="broker-marquee-label" className="marquee-label">
        Brokers we opt you out from
      </h2>
      <div className="marquee">
        <ul className="marquee-track">
          {names}
          {clones}
        </ul>
      </div>
      <AppLink className="marquee-more" href="/#data-brokers">
        See all brokers &gt;
      </AppLink>
    </section>
  );
}
