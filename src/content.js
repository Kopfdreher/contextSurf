import {
  detectMapsIntent,
  generateSearchQuery,
  mapsUrl,
  tidyEntity,
} from "./utils/promptEngine.js";
import {
  contextFromRange,
  extractContext as readSelectionContext,
  pageContextFields,
} from "./utils/pageContext.js";
import {
  rangesEqual,
  wordAtCaret,
  wordRangeAtCaret,
  wordRangeAtPoint,
} from "./utils/wordRange.js";
import { FLAG_KEY } from "./utils/keys.js";
import { createPill } from "./pill.js";

let lastContext = null;
let hideTimer = 0;
let overlayRange = null;
let shortcutHold = false;
let lastPointer = { x: 0, y: 0 };
let hoverRaf = 0;
let openInBackground = false;

void chrome.storage.local.get(FLAG_KEY).then((stored) => {
  openInBackground = Boolean(stored[FLAG_KEY]);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[FLAG_KEY]) return;
  openInBackground = Boolean(changes[FLAG_KEY].newValue);
});

const pill = createPill({
  onSurf: () => {
    void onSurfClick();
  },
});

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

function skipHost(node) {
  return pill.isInsideHost(node);
}

function extractContext() {
  return readSelectionContext({
    extraNote: pill.extraNote(),
    skipNode: skipHost,
  });
}

function hideAll() {
  shortcutHold = false;
  overlayRange = null;
  if (hoverRaf) {
    cancelAnimationFrame(hoverRaf);
    hoverRaf = 0;
  }
  document.documentElement.style.removeProperty("cursor");
  lastContext = null;
  pill.hide();
}

function highlightFromRange(range, { resetNote = false } = {}) {
  if (!range) return false;
  if (rangesEqual(overlayRange, range)) return true;
  const context = contextFromRange(range, pill.extraNote());
  if (!context) return false;
  overlayRange = range.cloneRange();
  lastContext = context;
  pill.show(context, { overlay: true, resetNote });
  pill.paintOverlay(overlayRange);
  document.documentElement.style.cursor = "pointer";
  return true;
}

function highlightWordAtPoint(x, y) {
  const range = wordRangeAtPoint(x, y, {
    skip: skipHost,
    host: pill.hostEl(),
  });
  if (!range) return false;
  return highlightFromRange(range, { resetNote: !pill.hasOverlay() });
}

function startShortcutHold() {
  shortcutHold = true;
  const fromPoint = highlightWordAtPoint(lastPointer.x, lastPointer.y);
  if (fromPoint) return true;
  const caret = wordRangeAtCaret(skipHost);
  if (caret) {
    return highlightFromRange(caret, { resetNote: !pill.hasOverlay() });
  }
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.rangeCount) {
    return highlightFromRange(selection.getRangeAt(0), {
      resetNote: !pill.hasOverlay(),
    });
  }
  return true;
}

function showSelectionPill(context) {
  lastContext = context;
  pill.show(context);
}

function syncOverlay() {
  if (!shortcutHold || !overlayRange) return false;
  try {
    const rect = overlayRange.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      hideAll();
      return true;
    }
    if (lastContext) lastContext = { ...lastContext, rect };
    pill.positionBar(rect);
    pill.paintOverlay(overlayRange);
    return true;
  } catch {
    hideAll();
    return true;
  }
}

function withExtraNote(context) {
  return {
    ...context,
    extraNote: pill.extraNote(),
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
    if (!shortcutHold) hideAll();
    return;
  }
  const payload = withExtraNote(context);
  pill.persistNote({ immediate: true });
  if (shortcutHold) {
    const surf = runSurf(payload.selectedText, payload).catch(() => {
      pill.setError(true);
    });
    if (!openInBackground) hideAll();
    void surf;
    return;
  }
  pill.setBusy(true);
  try {
    await runSurf(payload.selectedText, payload);
    hideAll();
  } catch {
    pill.setBusy(false);
    pill.setError(true);
  }
}

function onMouseUp(event) {
  if (shortcutHold) return;
  if (pill.isInsideHost(event.target)) return;
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    if (shortcutHold) return;
    const context = extractContext();
    if (!context || context.rect.width === 0) {
      if (!pill.isHostActive()) hideAll();
      return;
    }
    showSelectionPill(context);
  }, 10);
}

function onSelectionChange() {
  if (shortcutHold || pill.isHostActive()) return;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    hideAll();
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
    event.code === "AltLeft" ||
    event.code === "AltRight";
  if (!releasedAlt) return;
  if (shortcutHold || pill.hasOverlay()) hideAll();
}

function onMouseMove(event) {
  lastPointer = { x: event.clientX, y: event.clientY };
  if (!shortcutHold) return;
  if (pill.isInsideHost(event.target)) return;
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    if (!shortcutHold) return;
    highlightWordAtPoint(lastPointer.x, lastPointer.y);
  });
}

function onHoldPointerDown(event) {
  if (!shortcutHold) return;
  if (pill.isInsideHost(event.target)) return;
  event.preventDefault();
}

function onHoldClick(event) {
  if (!shortcutHold) return;
  if (pill.isInsideHost(event.target)) return;
  if (!lastContext) return;
  event.preventDefault();
  event.stopPropagation();
  void onSurfClick();
}

function onScrollOrResize() {
  if (syncOverlay()) return;
  if (!pill.isHostActive()) hideAll();
}

document.addEventListener("mouseup", onMouseUp);
document.addEventListener("selectionchange", onSelectionChange);
document.addEventListener("mousemove", onMouseMove, true);
document.addEventListener("mousedown", onHoldPointerDown, true);
document.addEventListener("click", onHoldClick, true);
window.addEventListener("keydown", onKeyDown, true);
window.addEventListener("keyup", onKeyUp, true);
window.addEventListener("scroll", onScrollOrResize, {
  passive: true,
  capture: true,
});
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
    wordAtCaret(skipHost);
  if (!selectedText) {
    sendResponse({ ok: false });
    return;
  }
  void runSurf(selectedText, {
    selectedText,
    extraNote: pill.extraNote(),
    surroundingContext: context?.surroundingContext ?? "",
    ...pageContextFields(),
  })
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
  return true;
});
