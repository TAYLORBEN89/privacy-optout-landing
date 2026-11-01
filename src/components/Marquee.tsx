import { BROKERS } from "../data/brokers";

export function BrokerMarquee() {
  const chips = BROKERS.map((name) => (
    <li key={name} className="chip">
      {name}
    </li>
  ));
  const clones = BROKERS.map((name) => (
    <li key={`${name}-clone`} className="chip" data-clone="true" aria-hidden="true">
      {name}
    </li>
  ));

  return (
    <section className="marquee-section" aria-labelledby="broker-marquee-label">
      <h2 id="broker-marquee-label">Brokers we opt you out from</h2>
      <div className="marquee">
        <ul className="marquee-track">
          {chips}
          {clones}
        </ul>
      </div>
    </section>
  );
}
