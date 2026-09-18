function metaContent(...selectors) {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute("content");
    if (value?.trim()) return value.replace(/\s+/g, " ").trim().slice(0, 240);
  }
  return "";
}

export function pageContextFields() {
  return {
    pageTitle: document.title,
    pageUrl: window.location.href,
    h1: (document.querySelector("h1")?.innerText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200),
    description: metaContent(
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ),
  };
}

export function contextFromRange(range, extraNote = "") {
  if (!range) return null;
  const selectedText = range.toString().replace(/\s+/g, " ").trim();
  if (!selectedText) return null;
  const block =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  const surroundingContext = (block?.innerText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return {
    selectedText,
    surroundingContext,
    extraNote,
    ...pageContextFields(),
    rect,
  };
}

export function extractContext({ extraNote = "", skipNode } = {}) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  if (skipNode?.(selection.anchorNode)) return null;
  return contextFromRange(selection.getRangeAt(0), extraNote);
}
