import { useEffect, useState, type RefObject } from "react";

function motionPreference(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(motionPreference);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setReduced(true);
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export function useInView<T extends Element>(ref: RefObject<T | null>): boolean {
  const reduced = usePrefersReducedMotion();
  const [seen, setSeen] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setSeen(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced, ref]);

  return seen;
}
