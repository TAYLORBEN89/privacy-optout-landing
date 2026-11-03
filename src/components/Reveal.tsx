import { useEffect, useRef, useState, type ReactNode } from "react";

const REVEAL_FALLBACK_MS = 1500;

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function alreadyInView(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return true;
  return rect.top < window.innerHeight && rect.bottom > 0;
}

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion() || alreadyInView(node)) return;

    setWaiting(true);
    const show = () => setWaiting(false);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) show();
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    const timer = window.setTimeout(show, REVEAL_FALLBACK_MS);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={ref} className={`reveal${waiting ? " is-waiting" : " is-in"} ${className}`.trim()}>
      {children}
    </div>
  );
}
