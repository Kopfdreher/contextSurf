import {
  detectMapsIntent,
  generateSearchQuery,
  mapsUrl,
  tidyEntity,
} from "./utils/promptEngine.js";
import pillCss from "./content.css?inline";

const HOST_ID = "ts-host";
const PILL_LABEL = "🌊 surf";
const NOTE_KEY = "textSurfLastNote";
const DEFAULT_PLACEHOLDER = "add a note…";
const NOTE_DEBOUNCE_MS = 150;
const PILL_PAD = 8;
const PILL_EST_WIDTH = 280;
const PILL_EST_HEIGHT = 44;
const HL_PAD = 4;

let shadowRoot = null;
let barEl = null;
let noteInput = null;
let pillButton = null;
let lastContext = null;
let lastNote = "";
let hideTimer = 0;
let persistTimer = 0;
let ignoreSelectionHide = false;
let overlayEls = [];
let overlayRange = null;
let shortcutHold = false;
let lastPointer = { x: 0, y: 0 };
let hoverRaf = 0;

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function hostEl() {
  return document.getElementById(HOST_ID);
}

function isInsideHost(node) {
  const host = hostEl();
  if (!host) return false;
  if (host.contains(node)) return true;
  return shadowRoot?.contains(node) ?? false;
}

function isHostActive() {
  const host = hostEl();
  if (!host || host.style.display === "none") return false;
  const active = shadowRoot?.activeElement;
  return Boolean(active) || isInsideHost(document.activeElement);
}

function metaContent(...selectors) {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute("content");
    if (value?.trim()) return value.replace(/\s+/g, " ").trim().slice(0, 240);
  }
  return "";
}

function pageContextFields() {
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

function typedNote() {
  return (noteInput?.value || "").replace(/\s+/g, " ").trim();
}

function extraNoteValue() {
  return typedNote() || lastNote;
}

function applyPlaceholder() {
  if (!noteInput) return;
  noteInput.placeholder = lastNote || DEFAULT_PLACEHOLDER;
}

function persistTypedNote(value, { immediate = false } = {}) {
  const typed = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!typed) return;
  lastNote = typed;
  window.clearTimeout(persistTimer);
  const write = () => chrome.storage.local.set({ [NOTE_KEY]: lastNote });
  if (immediate) {
    void write();
    return;
  }
  persistTimer = window.setTimeout(write, NOTE_DEBOUNCE_MS);
}

void chrome.storage.local.get(NOTE_KEY).then((stored) => {
  if (typeof stored[NOTE_KEY] === "string") {
    lastNote = stored[NOTE_KEY];
    applyPlaceholder();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[NOTE_KEY]) return;
  const next = changes[NOTE_KEY].newValue;
  const value = typeof next === "string" ? next : "";
  if (value === lastNote) return;
  lastNote = value;
  applyPlaceholder();
});

function clampPillPosition(rect) {
  const left = Math.min(
    Math.max(PILL_PAD, rect.left),
    Math.max(PILL_PAD, window.innerWidth - PILL_EST_WIDTH - PILL_PAD),
  );
  const below = rect.bottom + PILL_PAD;
  const top =
    below + PILL_EST_HEIGHT > window.innerHeight
      ? Math.max(PILL_PAD, rect.top - PILL_EST_HEIGHT - PILL_PAD)
      : below;
  return { left, top };
}

function applyHostLayer(host) {
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.top = "0";
  host.style.left = "0";
  host.style.width = "100%";
  host.style.height = "100%";
  host.style.zIndex = "2147483647";
  host.style.pointerEvents = "none";
}

function getHost() {
  let host = hostEl();
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    applyHostLayer(host);
    document.documentElement.appendChild(host);
    shadowRoot = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = pillCss;

    barEl = document.createElement("form");
    barEl.className = "ts-bar";
    barEl.addEventListener("submit", (event) => {
      event.preventDefault();
      void onSurfClick();
    });

    noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.className = "ts-note";
    noteInput.placeholder = "add a note…";
    noteInput.autocomplete = "off";
    noteInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
    });
    noteInput.addEventListener("input", () => {
      persistTypedNote(noteInput.value);
    });
    applyPlaceholder();

    pillButton = document.createElement("button");
    pillButton.type = "submit";
    pillButton.className = "ts-pill";
    pillButton.textContent = PILL_LABEL;

    shadowRoot.addEventListener("mousedown", (event) => {
      const path = event.composedPath();
      if (path.includes(noteInput)) return;
      event.preventDefault();
      event.stopPropagation();
    });
    shadowRoot.addEventListener("click", (event) => {
      if (event.target?.classList?.contains("ts-hl")) {
        event.preventDefault();
        event.stopPropagation();
        void onSurfClick();
      }
    });

    barEl.append(noteInput, pillButton);
    shadowRoot.append(style, barEl);
  } else {
    applyHostLayer(host);
    if (!shadowRoot) {
      shadowRoot = host.shadowRoot;
      barEl = shadowRoot?.querySelector(".ts-bar");
      noteInput = shadowRoot?.querySelector(".ts-note");
      pillButton = shadowRoot?.querySelector(".ts-pill");
    }
  }
  return host;
}

function clearOverlay() {
  for (const el of overlayEls) el.remove();
  overlayEls = [];
}

function paintOverlay(range) {
  clearOverlay();
  if (!range || !shadowRoot) return;
  const rects = range.getClientRects();
  for (const rect of rects) {
    if (rect.width === 0 && rect.height === 0) continue;
    const el = document.createElement("div");
    el.className = "ts-hl";
    el.style.left = `${rect.left - HL_PAD}px`;
    el.style.top = `${rect.top - HL_PAD}px`;
    el.style.width = `${rect.width + HL_PAD * 2}px`;
    el.style.height = `${rect.height + HL_PAD * 2}px`;
    shadowRoot.append(el);
    overlayEls.push(el);
  }
}

function positionBar(rect) {
  if (!barEl || !rect) return;
  const pos = clampPillPosition(rect);
  barEl.style.left = `${pos.left}px`;
  barEl.style.top = `${pos.top}px`;
}

function hidePill() {
  const host = hostEl();
  shortcutHold = false;
  ignoreSelectionHide = false;
  overlayRange = null;
  if (hoverRaf) {
    cancelAnimationFrame(hoverRaf);
    hoverRaf = 0;
  }
  document.documentElement.style.removeProperty("cursor");
  clearOverlay();
  lastContext = null;
  persistTypedNote(typedNote(), { immediate: true });
  if (noteInput) {
    noteInput.disabled = false;
    noteInput.value = "";
    applyPlaceholder();
  }
  if (pillButton) {
    pillButton.disabled = false;
    pillButton.textContent = PILL_LABEL;
  }
  if (barEl) barEl.classList.remove("is-error");
  if (host) host.style.display = "none";
}

function isWordChar(ch) {
  return /[\p{L}\p{N}_-]/u.test(ch);
}

function expandToWord(node, offset) {
  if (!node || node.nodeType !== Node.TEXT_NODE || isInsideHost(node)) {
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

function rangesEqual(a, b) {
  return Boolean(
    a &&
      b &&
      a.startContainer === b.startContainer &&
      a.endContainer === b.endContainer &&
      a.startOffset === b.startOffset &&
      a.endOffset === b.endOffset,
  );
}

function wordRangeAtCaret() {
  const selection = window.getSelection();
  if (!selection?.anchorNode) return null;
  return expandToWord(selection.anchorNode, selection.anchorOffset);
}

function wordRangeAtPoint(x, y) {
  const fromHit = (hit) => {
    if (!hit) return null;
    return expandToWord(hit.startContainer, hit.startOffset);
  };
  const first = fromHit(document.caretRangeFromPoint(x, y));
  if (first) return first;
  const host = hostEl();
  if (!host || host.style.display === "none") return null;
  host.style.visibility = "hidden";
  const retry = fromHit(document.caretRangeFromPoint(x, y));
  host.style.visibility = "";
  return retry;
}

function wordAtCaret() {
  return (wordRangeAtCaret()?.toString() || "").replace(/\s+/g, " ").trim();
}

function selectWordAtCaret() {
  const range = wordRangeAtCaret();
  if (!range) return false;
  ignoreSelectionHide = true;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function contextFromRange(range) {
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
    extraNote: extraNoteValue(),
    ...pageContextFields(),
    rect,
  };
}

function highlightFromRange(range, { resetNote = false } = {}) {
  if (!range) return false;
  if (rangesEqual(overlayRange, range)) return true;
  const context = contextFromRange(range);
  if (!context) return false;
  overlayRange = range.cloneRange();
  showPill(context, { overlay: true, resetNote });
  paintOverlay(overlayRange);
  document.documentElement.style.cursor = "pointer";
  return true;
}

function highlightWordAtPoint(x, y) {
  const range = wordRangeAtPoint(x, y);
  if (!range) return false;
  return highlightFromRange(range, { resetNote: !overlayEls.length });
}

function startShortcutHold() {
  shortcutHold = true;
  ignoreSelectionHide = true;
  const fromPoint = highlightWordAtPoint(lastPointer.x, lastPointer.y);
  if (fromPoint) return true;
  const caret = wordRangeAtCaret();
  if (caret) return highlightFromRange(caret, { resetNote: !overlayEls.length });
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.rangeCount) {
    return highlightFromRange(selection.getRangeAt(0), {
      resetNote: !overlayEls.length,
    });
  }
  return true;
}

function previewSurf({ overlay = false } = {}) {
  if (overlay) return startShortcutHold();
  const selection = window.getSelection();
  const hasHighlight =
    selection && !selection.isCollapsed && selection.toString().trim();
  if (!hasHighlight && !selectWordAtCaret()) return false;
  const context = extractContext();
  if (!context || context.rect.width === 0) {
    if (!shortcutHold) ignoreSelectionHide = false;
    return false;
  }
  window.setTimeout(() => {
    if (!shortcutHold) ignoreSelectionHide = false;
  }, 50);
  showPill(context);
  return true;
}

function extractContext() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  if (isInsideHost(selection.anchorNode)) {
    return null;
  }

  const selectedText = selection.toString().replace(/\s+/g, " ").trim();
  if (!selectedText) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const block =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  const surroundingContext = (block?.innerText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

  return {
    selectedText,
    surroundingContext,
    extraNote: extraNoteValue(),
    ...pageContextFields(),
    rect: range.getBoundingClientRect(),
  };
}

function showPill(context, { overlay = false, resetNote = true } = {}) {
  const host = getHost();
  lastContext = context;
  host.style.display = "block";
  positionBar(context.rect);
  if (!overlay) clearOverlay();
  if (barEl) barEl.classList.remove("is-error");
  if (noteInput && resetNote) {
    noteInput.disabled = false;
    noteInput.value = "";
    applyPlaceholder();
  }
  if (pillButton && resetNote) {
    pillButton.disabled = false;
    pillButton.textContent = PILL_LABEL;
  }
}

function syncOverlay() {
  if (!shortcutHold || !overlayRange) return false;
  try {
    const rect = overlayRange.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      hidePill();
      return true;
    }
    if (lastContext) lastContext = { ...lastContext, rect };
    positionBar(rect);
    paintOverlay(overlayRange);
    return true;
  } catch {
    hidePill();
    return true;
  }
}

function withExtraNote(context) {
  return {
    ...context,
    extraNote: extraNoteValue(),
  };
}

async function runSurf(selectedText, context) {
  const note = context?.extraNote || "";
  const entity = await tidyEntity(selectedText, context);
  const subject = entity || selectedText;
  if (detectMapsIntent(note)) {
    const url = mapsUrl(subject, note);
    if (!url) throw new Error("Empty maps query");
    await sendMessage({ type: "OPEN_URL", url });
    return;
  }
  const query = await generateSearchQuery(subject, {
    ...context,
    selectedText: subject,
  });
  if (!query) throw new Error("Empty query");
  await sendMessage({ type: "OPEN_URL", query });
}

async function onSurfClick() {
  const context = lastContext || extractContext();
  if (!context?.selectedText) {
    if (!shortcutHold) hidePill();
    return;
  }
  const payload = withExtraNote(context);
  persistTypedNote(typedNote(), { immediate: true });
  const stayHeld = shortcutHold;
  if (stayHeld) {
    void runSurf(payload.selectedText, payload).catch(() => {
      if (barEl) barEl.classList.add("is-error");
    });
    return;
  }
  if (pillButton) {
    pillButton.disabled = true;
    pillButton.textContent = "🌊 surfing…";
  }
  if (noteInput) noteInput.disabled = true;
  try {
    await runSurf(payload.selectedText, payload);
    hidePill();
  } catch {
    if (pillButton) {
      pillButton.disabled = false;
      pillButton.textContent = PILL_LABEL;
    }
    if (noteInput) noteInput.disabled = false;
    if (barEl) barEl.classList.add("is-error");
  }
}

function onMouseUp(event) {
  if (shortcutHold) return;
  if (isInsideHost(event.target)) return;
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    if (shortcutHold) return;
    const context = extractContext();
    if (!context || context.rect.width === 0) {
      if (!isHostActive()) hidePill();
      return;
    }
    showPill(context);
  }, 10);
}

function onSelectionChange() {
  if (ignoreSelectionHide || shortcutHold || isHostActive()) return;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    hidePill();
  }
}

function isOptionS(event) {
  return (
    event.altKey &&
    !event.metaKey &&
    !event.ctrlKey &&
    (event.code === "KeyS" || event.key === "s" || event.key === "S")
  );
}

function onKeyDown(event) {
  if (!isOptionS(event) || event.repeat) return;
  event.preventDefault();
  event.stopPropagation();
  if (!shortcutHold) startShortcutHold();
}

function onKeyUp(event) {
  const releasedAlt =
    event.key === "Alt" ||
    event.key === "AltLeft" ||
    event.key === "AltRight" ||
    event.code === "AltLeft" ||
    event.code === "AltRight";
  if (!releasedAlt) return;
  if (shortcutHold || overlayEls.length) hidePill();
}

function onMouseMove(event) {
  lastPointer = { x: event.clientX, y: event.clientY };
  if (!shortcutHold) return;
  if (isInsideHost(event.target)) return;
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    if (!shortcutHold) return;
    highlightWordAtPoint(lastPointer.x, lastPointer.y);
  });
}

function onHoldPointerDown(event) {
  if (!shortcutHold) return;
  if (isInsideHost(event.target)) return;
  event.preventDefault();
}

function onHoldClick(event) {
  if (!shortcutHold) return;
  if (isInsideHost(event.target)) return;
  if (!lastContext) return;
  event.preventDefault();
  event.stopPropagation();
  void onSurfClick();
}

function onScrollOrResize() {
  if (syncOverlay()) return;
  if (!isHostActive()) hidePill();
}

document.addEventListener("mouseup", onMouseUp);
document.addEventListener("selectionchange", onSelectionChange);
document.addEventListener("mousemove", onMouseMove, true);
document.addEventListener("mousedown", onHoldPointerDown, true);
document.addEventListener("click", onHoldClick, true);
window.addEventListener("keydown", onKeyDown, true);
window.addEventListener("keyup", onKeyUp, true);
window.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
window.addEventListener("resize", onScrollOrResize);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "TEXTSURF_SELECTION") {
    return;
  }
  if (message.preview) {
    sendResponse({ ok: startShortcutHold() });
    return;
  }
  const context = lastContext || extractContext();
  const selectedText =
    context?.selectedText ||
    String(message.selectedText || "")
      .replace(/\s+/g, " ")
      .trim() ||
    wordAtCaret();
  if (!selectedText) {
    sendResponse({ ok: false });
    return;
  }
  void runSurf(selectedText, {
    selectedText,
    extraNote: extraNoteValue(),
    surroundingContext: context?.surroundingContext ?? "",
    ...pageContextFields(),
  })
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
  return true;
});
