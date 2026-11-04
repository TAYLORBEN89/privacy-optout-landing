/** Fetch /texas-proposal after deploy and confirm the page and header link shipped. */

export function proposalSmokeProblems(text) {
  const problems = [];
  if (!text.includes("The Texas Proposal")) problems.push("missing The Texas Proposal heading");
  const hasLink =
    text.includes('href="/texas-proposal"') ||
    text.includes("href='/texas-proposal'") ||
    text.includes("href:`/texas-proposal`");
  if (!hasLink) problems.push("missing header link to /texas-proposal");
  return problems;
}

async function shippedText(pageUrl) {
  const page = await fetch(pageUrl);
  if (!page.ok) throw new Error(`${pageUrl} returned ${page.status}`);
  const html = await page.text();
  const base = new URL(pageUrl);
  let combined = html;
  for (const match of html.matchAll(/\bsrc="([^"]+\.js)"/g)) {
    const scriptUrl = new URL(match[1], base).href;
    const script = await fetch(scriptUrl);
    if (!script.ok) throw new Error(`${scriptUrl} returned ${script.status}`);
    combined += `\n${await script.text()}`;
  }
  return combined;
}

const invoked = process.argv[1]?.endsWith("proposal-smoke.mjs");
if (invoked) {
  const pageUrl = process.argv[2];
  if (!pageUrl) {
    console.error("Usage: node scripts/proposal-smoke.mjs https://droptexas.com/texas-proposal");
    process.exit(2);
  }
  const problems = proposalSmokeProblems(await shippedText(pageUrl));
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`texas proposal smoke ok: ${pageUrl}`);
}
