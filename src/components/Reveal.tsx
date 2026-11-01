import { useRef, type ReactNode } from "react";
import { useInView } from "../hooks/useInView";

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  return (
    <div ref={ref} className={`reveal${seen ? " is-in" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
