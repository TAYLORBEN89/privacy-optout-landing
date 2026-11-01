import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

export function currentPath(): string {
  return window.location.pathname || "/";
}

export function usePathname(): string {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const sync = () => setPath(currentPath());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return path;
}

export function navigate(to: string): void {
  const url = new URL(to, window.location.origin);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) {
    if (url.hash) {
      document.getElementById(url.hash.slice(1))?.scrollIntoView();
    }
    return;
  }
  window.history.pushState({}, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
  if (url.hash) {
    window.setTimeout(() => {
      document.getElementById(url.hash.slice(1))?.scrollIntoView();
    }, 0);
  } else {
    window.scrollTo(0, 0);
  }
}

export function AppLink({
  href,
  className,
  children,
  onClick,
  role,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  role?: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const sameDocument = href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/api/");
    if (!sameDocument) return;
    event.preventDefault();
    onClick?.();
    navigate(href);
  }

  return (
    <a href={href} className={className} role={role} onClick={handleClick}>
      {children}
    </a>
  );
}
