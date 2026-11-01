import { useEffect, useState } from "react";
import { countAt, statText, type StatEntry } from "../data/stats";
import { usePrefersReducedMotion } from "../hooks/useInView";

const DURATION_MS = 900;

function StatValue({ value }: { value: number | null }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(value === null || reduced ? value : 0);

  useEffect(() => {
    if (value === null) {
      setShown(null);
      return;
    }
    if (reduced) {
      setShown(value);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = countAt(now - started, DURATION_MS, value);
      setShown(next);
      if (next < value) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, value]);

  return <p className="stat-value">{statText(shown)}</p>;
}

export function Stats({ stats }: { stats: StatEntry[] }) {
  return (
    <section className="stats" aria-labelledby="stats-heading">
      <h2 id="stats-heading">By the numbers</h2>
      <ul className="stat-grid">
        {stats.map((stat) => (
          <li key={stat.id} data-stat={stat.id}>
            <StatValue value={stat.value} />
            <p className="stat-label">{stat.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
