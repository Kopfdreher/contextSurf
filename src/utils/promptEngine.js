const READY_STATES = new Set(["available", "readily", "readily-available"]);
const TITLE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "is",
  "are",
  "as",
  "its",
  "this",
  "that",
  "into",
]);

function hostnameFromUrl(pageUrl) {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sanitizeQuery(raw) {
  return String(raw ?? "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function distinctiveTokens(text, selectedText, limit) {
  const selected = new Set(
    String(selectedText || "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );
  const words = String(text ?? "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !TITLE_STOPWORDS.has(word.toLowerCase()));
  const unique = [];
  for (const word of words) {
    const key = word.toLowerCase();
    if (selected.has(key)) continue;
    if (unique.some((item) => item.toLowerCase() === key)) continue;
    unique.push(word);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function fallbackQuery(selectedText, context) {
  const note = sanitizeQuery(context?.extraNote);
  const extras = distinctiveTokens(
    `${context?.pageTitle || ""} ${context?.h1 || ""}`,
    selectedText,
    2,
  );
  const hostname = hostnameFromUrl(context?.pageUrl);
  const parts = [selectedText, note, ...extras];
  const filled = parts.filter(Boolean);
  if (filled.length <= 1 && hostname) filled.push(hostname);
  return filled.join(" ").trim();
}

function contextBlock(context) {
  return [
    `Page title: ${context?.pageTitle ?? ""}`,
    `H1: ${context?.h1 ?? ""}`,
    `URL: ${context?.pageUrl ?? ""}`,
    `Description: ${context?.description ?? ""}`,
    `Surrounding: ${context?.surroundingContext ?? ""}`,
    `User note: ${context?.extraNote ?? ""}`,
  ].join("\n");
}

async function withLanguageModel(run) {
  if (typeof LanguageModel === "undefined") {
    return null;
  }
  const availability = await LanguageModel.availability();
  if (!READY_STATES.has(availability)) {
    return null;
  }
  const session = await LanguageModel.create();
  try {
    return await run(session);
  } finally {
    if (session.destroy) session.destroy();
  }
}

export async function generateSearchQuery(selectedText, context) {
  const fallback = fallbackQuery(selectedText, context);
  try {
    const output = await withLanguageModel((session) =>
      session.prompt(
        `You write Google I'm Feeling Lucky queries: the first result should be the page the reader wants next.
ENTITY is highlighted on a page. Disambiguate it using title, H1, URL, description, and surrounding text (e.g. Stripe the payments company vs animal stripes).
If a user note is present, it is the strongest signal for intent.
Prefer a query that lands on an official/canonical page (homepage, product, docs, Wikipedia) rather than a random blog or aggregator.
Do NOT default to careers or jobs unless the page or note is clearly about hiring/work.
Output ONLY 4-8 words. No quotes or explanation. If the entity is ambiguous, include one disambiguator (industry, place, or product).

ENTITY: "${selectedText}"
${contextBlock(context)}`,
      ),
    );
    return sanitizeQuery(output) || fallback;
  } catch {
    return fallback;
  }
}
