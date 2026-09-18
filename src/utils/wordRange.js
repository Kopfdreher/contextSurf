function isWordChar(ch) {
  return /[\p{L}\p{N}_-]/u.test(ch);
}

export function expandToWord(node, offset, { skip } = {}) {
  if (!node || node.nodeType !== Node.TEXT_NODE || skip?.(node)) {
    return null;
  }
  const text = node.textContent || "";
  if (!text) return null;
  let start = Math.min(Math.max(0, offset), text.length);
  let end = start;
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  if (start === end) return null;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}

export function rangesEqual(a, b) {
  return Boolean(
    a &&
      b &&
      a.startContainer === b.startContainer &&
      a.endContainer === b.endContainer &&
      a.startOffset === b.startOffset &&
      a.endOffset === b.endOffset,
  );
}

export function wordRangeAtCaret(skip) {
  const selection = window.getSelection();
  if (!selection?.anchorNode) return null;
  return expandToWord(selection.anchorNode, selection.anchorOffset, { skip });
}

export function wordRangeAtPoint(x, y, { skip, host } = {}) {
  const fromHit = (hit) => {
    if (!hit) return null;
    return expandToWord(hit.startContainer, hit.startOffset, { skip });
  };
  const first = fromHit(document.caretRangeFromPoint(x, y));
  if (first) return first;
  if (!host || host.style.display === "none") return null;
  host.style.visibility = "hidden";
  const retry = fromHit(document.caretRangeFromPoint(x, y));
  host.style.visibility = "";
  return retry;
}

export function wordAtCaret(skip) {
  return (wordRangeAtCaret(skip)?.toString() || "").replace(/\s+/g, " ").trim();
}
