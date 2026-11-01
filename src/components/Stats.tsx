import { useEffect, useRef, useState } from "react";
import { countAt, statText, type StatEntry } from "../data/stats";
import { usePrefersReducedMotion } from "../hooks/useInView";
import { AppLink } from "../router";

const DURATION_MS = 1500;

function StatValue({
  value,
  prefix,
  started,
  reduced,
}: {
  value: number | null;
  prefix: string;
  started: boolean;
  reduced: boolean;
}) {
  const finalText = statText(value, prefix);
  const [shown, setShown] = useState<number | null>(value === null || reduced ? value : 0);

  useEffect(() => {
    if (value === null) {
      setShown(null);
      return;
    }
    if (reduced || !started) {
      setShown(reduced ? value : 0);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = countAt(now - startedAt, DURATION_MS, value);
      setShown(next);
      if (next < value) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [prefix, reduced, started, value]);

  if (value === null) {
    return <p className="stat-value">Coming soon</p>;
  }

  return (
    <p className="stat-value">
      <span className="stat-count" aria-hidden="true">
        {statText(shown, prefix)}
      </span>
      <span className="visually-hidden">{finalText}</span>
    </p>
  );
}

export function Stats({ stats }: { stats: StatEntry[] }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (reduced) {
      setStarted(true);
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver !== "function") {
      setStarted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <section ref={ref} className="stats" aria-labelledby="stats-heading">
      <h2 id="stats-heading">
        <span>Privacy for every Texan.</span>
        <span>Free. Simple. Yours.</span>
      </h2>
      <ul className="stat-grid">
        {stats.map((stat) => (
          <li key={stat.id} data-stat={stat.id}>
            <StatValue value={stat.value} prefix={stat.prefix} started={started} reduced={reduced} />
            <p className="stat-label">{stat.label}</p>
          </li>
        ))}
      </ul>
      <AppLink className="stats-more" href="/about">
        More about DROP Texas &gt;
      </AppLink>
    </section>
  );
}
