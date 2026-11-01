import { useEffect } from "react";

function setMeta(selector: string, content: string): string | null {
  const node = document.querySelector(selector);
  if (!node) return null;
  const previous = node.getAttribute("content");
  node.setAttribute("content", content);
  return previous;
}

export function PageMeta({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const descriptionWas = setMeta('meta[name="description"]', description);
    const openGraphWas = setMeta('meta[property="og:description"]', description);
    const twitterWas = setMeta('meta[name="twitter:description"]', description);
    return () => {
      document.title = previousTitle;
      if (descriptionWas !== null) setMeta('meta[name="description"]', descriptionWas);
      if (openGraphWas !== null) setMeta('meta[property="og:description"]', openGraphWas);
      if (twitterWas !== null) setMeta('meta[name="twitter:description"]', twitterWas);
    };
  }, [title, description]);
  return null;
}
