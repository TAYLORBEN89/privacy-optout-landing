import { useEffect } from "react";
import { canonicalFor, headInner, pageByPath } from "../shared/seo";

/**
 * Keeps the tab title and social tags in sync after a client-side navigation.
 * Crawlers that do not run JavaScript get the same tags from the per-route
 * HTML file written at build time.
 */
export function SeoHead({ path }: { path: string }) {
  useEffect(() => {
    const page = pageByPath(path);
    if (!page) return;
    document.documentElement.lang = "en-US";
    const template = document.createElement("template");
    template.innerHTML = headInner(page);
    const nextNodes = [...template.content.children];
    for (const node of nextNodes) {
      const element = node as HTMLElement;
      if (element.tagName === "TITLE") {
        document.title = page.title;
        continue;
      }
      if (element.tagName === "META") {
        const key = element.getAttribute("name")
          ? `meta[name="${element.getAttribute("name")}"]`
          : `meta[property="${element.getAttribute("property")}"]`;
        const current = document.head.querySelector(key);
        if (current) current.setAttribute("content", element.getAttribute("content") ?? "");
        else document.head.appendChild(element.cloneNode(true));
        continue;
      }
      if (element.tagName === "LINK" && element.getAttribute("rel") === "canonical") {
        let link = document.head.querySelector('link[rel="canonical"]');
        if (!link) {
          link = document.createElement("link");
          link.setAttribute("rel", "canonical");
          document.head.appendChild(link);
        }
        link.setAttribute("href", canonicalFor(page.path));
      }
    }
  }, [path]);
  return null;
}
