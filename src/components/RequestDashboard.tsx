import { useMemo, useState } from "react";
import { optOutLabel, type OptOutRecord } from "../api/account";
import { REGISTRY_BROKERS, type RegistryBroker } from "../data/registryBrokers";
import { REGISTRY_GROUPS } from "../data/registryGroups";

function isAccountSignup(record: OptOutRecord): boolean {
  return record.service_id === "signup" || record.kind === "tx";
}

function recordFor(broker: RegistryBroker, optouts: readonly OptOutRecord[]): OptOutRecord | undefined {
  const direct = optouts.find(
    (record) => record.broker_id === broker.id || (broker.siteId != null && record.broker_id === broker.siteId),
  );
  if (direct) return direct;
  if (!broker.siteId) return undefined;
  return optouts.find(isAccountSignup);
}

export function RequestDashboard({ optouts }: { optouts: readonly OptOutRecord[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      REGISTRY_GROUPS.map((group) => {
        const brokers = REGISTRY_BROKERS.filter((broker) => broker.group === group.id);
        const shown = needle ? brokers.filter((broker) => broker.name.toLowerCase().includes(needle)) : brokers;
        return { group, brokers, shown };
      }).filter((item) => item.shown.length > 0),
    [needle],
  );

  return (
    <section className="broker-dashboard" aria-labelledby="broker-dashboard-heading">
      <h2 id="broker-dashboard-heading">Registered brokers</h2>
      <p>
        These {REGISTRY_BROKERS.length} companies are in the Texas Secretary of State data broker registry. They are grouped by the step their filing describes. A status appears beside a company only when a request exists.
      </p>
      <label className="broker-find" htmlFor="broker-find">
        Find a company
        <input id="broker-find" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {groups.map(({ group, brokers, shown }) => (
        <details key={group.id} className="broker-group" {...(needle.length > 0 ? { open: true } : {})}>
          <summary>
            <span>{group.title}</span>
            <span className="broker-count">{needle ? `${shown.length} of ${brokers.length}` : brokers.length}</span>
          </summary>
          <p>{group.steps}</p>
          <ul>
            {shown.map((broker) => {
              const record = recordFor(broker, optouts);
              return (
                <li key={broker.id} className="broker-row">
                  <span className="broker-row-name">{broker.name}</span>
                  {record ? <span className="broker-status">{optOutLabel(record)}</span> : null}
                  {broker.url ? (
                    <a
                      className="broker-optout"
                      href={broker.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Opt-out page for ${broker.name}`}
                    >
                      Opt-out page
                    </a>
                  ) : null}
                  {broker.optOutEmail ? (
                    <a className="broker-mail" href={`mailto:${broker.optOutEmail}`}>
                      {broker.optOutEmail}
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </section>
  );
}
