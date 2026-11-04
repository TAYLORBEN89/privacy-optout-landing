/** Fetch /signin after deploy and confirm the real provider buttons shipped. */

export function signInSmokeProblems(text) {
  const problems = [];
  if (!text.includes("Continue with Google")) problems.push("missing Continue with Google");
  if (!text.includes("Continue with Microsoft")) problems.push("missing Continue with Microsoft");
  if (/coming soon/i.test(text)) problems.push("Coming soon is still present");
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

const invoked = process.argv[1]?.endsWith("signin-smoke.mjs");
if (invoked) {
  const pageUrl = process.argv[2];
  if (!pageUrl) {
    console.error("Usage: node scripts/signin-smoke.mjs https://droptexas.com/signin");
    process.exit(2);
  }
  const problems = signInSmokeProblems(await shippedText(pageUrl));
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`sign-in smoke ok: ${pageUrl}`);
}
