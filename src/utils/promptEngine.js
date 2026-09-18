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

const MAPS_SEARCH = /\b(google\s+maps|maps?)\b/i;
const MAPS_DIR = /\b(routes?|directions?)\b/i;
const MAPS_STRIP =
  /\b(google\s+maps|maps?|routes?|directions?)\b/gi;

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

function leftoverNote(note) {
  return sanitizeQuery(String(note || "").replace(MAPS_STRIP, " "));
}

export function detectMapsIntent(note) {
  const text = String(note || "");
  if (!text.trim()) return null;
  if (MAPS_DIR.test(text)) return "dir";
  if (MAPS_SEARCH.test(text)) return "search";
  return null;
}

export function mapsUrl(selectedText, note) {
  const kind = detectMapsIntent(note);
  if (!kind) return "";
  const leftover = leftoverNote(note);
  const q = [selectedText, leftover].filter(Boolean).join(" ").trim();
  if (!q) return "";
  const encoded = encodeURIComponent(q);
  if (kind === "dir") {
    return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
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
    .filter(
      (word) => word.length > 2 && !TITLE_STOPWORDS.has(word.toLowerCase()),
    );
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
  const note = leftoverNote(context?.extraNote);
  const parts = [selectedText, note];
  if (!note) {
    parts.push(
      ...distinctiveTokens(
        `${context?.pageTitle || ""} ${context?.h1 || ""}`,
        selectedText,
        2,
      ),
    );
  }
  const filled = parts.filter(Boolean);
  if (filled.length <= 1) {
    const hostname = hostnameFromUrl(context?.pageUrl);
    if (hostname) filled.push(hostname);
  }
  return filled.join(" ").trim();
}

function contextBlock(context) {
  return [
    `1. HIGHLIGHT (highest): ${context?.selectedText ?? ""}`,
    `2. USER NOTE (intent, below highlight, above page): ${context?.extraNote ?? ""}`,
    `3. PAGE (disambiguate only): title=${context?.pageTitle ?? ""}; h1=${context?.h1 ?? ""}; url=${context?.pageUrl ?? ""}; description=${context?.description ?? ""}; surrounding=${context?.surroundingContext ?? ""}`,
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
  const payload = { ...context, selectedText };
  const fallback = fallbackQuery(selectedText, payload);
  try {
    const output = await withLanguageModel((session) =>
      session.prompt(
        `You write Google I'm Feeling Lucky queries.
Priority (do not invert):
1. The highlighted ENTITY is the subject. Keep it in the query.
2. The user note is intent (careers, pricing, docs, etc.). Stronger than the article, weaker than the highlight. Do not drop the entity for the note.
3. Page title, H1, URL, description, and surrounding text are weakest. Use them only to disambiguate the entity (e.g. Stripe payments vs animal stripes). Never let them replace 1 or 2.
Do NOT default to careers unless the highlight or note is about jobs.
Prefer official/canonical first results (homepage, docs, Wikipedia, product).
Output ONLY 4-8 words. No quotes.

${contextBlock(payload)}`,
      ),
    );
    return sanitizeQuery(output) || fallback;
  } catch {
    return fallback;
  }
}
