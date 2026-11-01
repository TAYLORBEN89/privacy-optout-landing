import { existsSync } from "node:fs";
import { createServer, type ViteDevServer } from "vite";
import puppeteer, { type Browser } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const CHROME = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find((file) =>
  existsSync(file),
);

describe("horizontal overflow", () => {
  let server: ViteDevServer;
  let browser: Browser;
  let origin = "";

  beforeAll(async () => {
    if (!CHROME) throw new Error("Chrome is required to measure page overflow");
    server = await createServer({
      server: { host: "127.0.0.1", port: 0 },
      logLevel: "error",
    });
    await server.listen();
    const address = server.httpServer?.address();
    const port = typeof address === "object" && address ? address.port : 0;
    origin = `http://127.0.0.1:${port}`;
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it.each([320, 390, 1440])("keeps the page within the viewport at %ipx", async (width) => {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 800, deviceScaleFactor: 1 });
    await page.goto(`${origin}/`, { waitUntil: "load", timeout: 20_000 });
    const box = await page.evaluate(() => {
      const marquee = document.querySelector(".marquee-section")?.getBoundingClientRect();
      const sections = [...document.querySelectorAll("section")].map((node) => {
        const rect = node.getBoundingClientRect();
        return { id: node.id || node.className, left: rect.left, right: rect.right };
      });
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        marquee: marquee ? { left: marquee.left, right: marquee.right } : null,
        sections,
      };
    });
    await page.close();
    expect(box.scrollWidth).toBeLessThanOrEqual(box.innerWidth);
    expect(box.marquee).not.toBeNull();
    expect(box.marquee?.left).toBeGreaterThanOrEqual(-1);
    expect(box.marquee?.right).toBeGreaterThanOrEqual(box.innerWidth - 1);
    expect(box.marquee?.right).toBeLessThanOrEqual(box.innerWidth + 1);
    const wide = box.sections.filter((section) => section.left < -1 || section.right > box.innerWidth + 1);
    expect(wide).toEqual([]);
  });

  it.each([320, 390, 1440])("keeps /brokers within the viewport at %ipx", async (width) => {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 800, deviceScaleFactor: 1 });
    await page.goto(`${origin}/brokers`, { waitUntil: "load", timeout: 20_000 });
    const box = await page.evaluate(() => {
      const sections = [...document.querySelectorAll("section, .broker-card")].map((node) => {
        const rect = node.getBoundingClientRect();
        return { id: node.id || (node as HTMLElement).className, left: rect.left, right: rect.right };
      });
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        cards: document.querySelectorAll(".broker-card").length,
        sections,
      };
    });
    await page.close();
    expect(box.cards).toBe(9);
    expect(box.scrollWidth).toBeLessThanOrEqual(box.innerWidth);
    const wide = box.sections.filter((section) => section.left < -1 || section.right > box.innerWidth + 1);
    expect(wide).toEqual([]);
  });

  it.each([390, 1440])("keeps the explore pages within the viewport at %ipx", async (width) => {
    const paths = [
      "/overview",
      "/how-it-works",
      "/personal-information",
      "/data-brokers",
      "/unique-identifiers",
      "/tdpsa",
      "/children",
      "/help",
      "/share",
    ];
    for (const path of paths) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 800, deviceScaleFactor: 1 });
      await page.goto(`${origin}${path}`, { waitUntil: "load", timeout: 20_000 });
      const box = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        heading: document.querySelector(".topic-page h1")?.textContent ?? "",
      }));
      await page.close();
      expect(box.heading.length).toBeGreaterThan(0);
      expect(box.scrollWidth).toBeLessThanOrEqual(box.innerWidth);
    }
  });
});
