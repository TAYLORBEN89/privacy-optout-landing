import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteFooter } from "../src/Footer";
import { routePage } from "../src/routePage";
import { HelpPage } from "../src/pages/topics";

export function renderRoute(path: string): { page: string; withFooter: string } {
  const page = renderToStaticMarkup(
    routePage(path, { getStartedHref: "/start", action: "form", csrfToken: null, me: null }),
  );
  const withFooter = renderToStaticMarkup(
    createElement(
      "div",
      null,
      routePage(path, { getStartedHref: "/start", action: "form", csrfToken: null, me: null }) as ReactElement,
      createElement(SiteFooter),
    ),
  );
  return { page, withFooter };
}

export function helpFaqItems(): { question: string; answer: string }[] {
  const html = renderToStaticMarkup(createElement(HelpPage));
  const items: { question: string; answer: string }[] = [];
  const re = /<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
  for (const match of html.matchAll(re)) {
    const question = strip(match[1]);
    const answer = strip(match[2]);
    if (question && answer) items.push({ question, answer });
  }
  return items;
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
