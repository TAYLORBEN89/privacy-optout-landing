import { useEffect, useRef, useState } from "react";
import { countAt, formatStat, visibleCitedStats, type CitedStat } from "../data/stats";
import { usePrefersReducedMotion } from "../hooks/useInView";
import { AppLink } from "../router";

const DURATION_MS = 1500;

function StatValue({
  stat,
  started,
  reduced,
}: {
  stat: CitedStat;
  started: boolean;
  reduced: boolean;
}) {
  const finalText = formatStat(stat.value, stat.prefix, stat.suffix, stat.decimals);
  const [shown, setShown] = useState(reduced ? stat.value : 0);

  useEffect(() => {
    if (reduced || !started) {
      setShown(reduced ? stat.value : 0);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      if (elapsed >= DURATION_MS) {
        setShown(stat.value);
        return;
      }
      setShown(countAt(elapsed, DURATION_MS, stat.value, stat.decimals));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, started, stat.decimals, stat.value]);

  return (
    <p className="stat-value">
      <span className="stat-count" aria-hidden="true">
        {formatStat(shown, stat.prefix, stat.suffix, stat.decimals)}
      </span>
      <span className="visually-hidden">{finalText}</span>
    </p>
  );
}

export function Stats() {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const [started, setStarted] = useState(false);
  const stats = visibleCitedStats();

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
            <StatValue stat={stat} started={started} reduced={reduced} />
            <p className="stat-label">{stat.label}</p>
            <a
              className="stat-source"
              href={stat.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Source: ${stat.sourceName}`}
            >
              Source
            </a>
          </li>
        ))}
        <li data-stat="optouts">
          <p className="stat-value stat-pending">Coming soon</p>
          <p className="stat-label">Opt-outs filed</p>
        </li>
      </ul>
      <AppLink className="stats-more" href="/about">
        More about DROP Texas &gt;
      </AppLink>
    </section>
  );
}
