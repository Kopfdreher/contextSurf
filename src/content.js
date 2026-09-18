import {
  detectMapsIntent,
  generateSearchQuery,
  mapsUrl,
} from "./utils/promptEngine.js";
import pillCss from "./content.css?inline";

const HOST_ID = "vs-host";
const PILL_LABEL = "Surf";
const NOTE_KEY = "vibeSurfingLastNote";
const NOTE_DEBOUNCE_MS = 150;
const PILL_PAD = 8;
const PILL_EST_WIDTH = 280;
const PILL_EST_HEIGHT = 44;

let shadowRoot = null;
let barEl = null;
let noteInput = null;
let pillButton = null;
let lastContext = null;
let lastNote = "";
let hideTimer = 0;
let persistTimer = 0;

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

function noteFieldFocused() {
  return Boolean(noteInput && shadowRoot?.activeElement === noteInput);
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

function extraNoteValue() {
  return (noteInput?.value || lastNote || "").replace(/\s+/g, " ").trim();
}

function applySavedNote() {
  if (!noteInput) return;
  if (noteFieldFocused() && extraNoteValue() === lastNote) return;
  if (noteInput.value === lastNote) return;
  noteInput.value = lastNote;
}

function persistNote(value, { immediate = false } = {}) {
  lastNote = String(value ?? "").replace(/\s+/g, " ").trim();
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
    applySavedNote();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[NOTE_KEY]) return;
  const next = changes[NOTE_KEY].newValue;
  const value = typeof next === "string" ? next : "";
  if (value === lastNote) return;
  lastNote = value;
  applySavedNote();
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

function getHost() {
  let host = hostEl();
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    host.style.top = "0";
    host.style.left = "0";
    document.documentElement.appendChild(host);
    shadowRoot = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = pillCss;

    barEl = document.createElement("form");
    barEl.className = "vs-bar";
    barEl.addEventListener("submit", (event) => {
      event.preventDefault();
      void onSurfClick();
    });

    noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.className = "vs-note";
    noteInput.placeholder = "add a note…";
    noteInput.autocomplete = "off";
    noteInput.addEventListener("keydown", (event) => {
      event.stopPropagation();
    });
    noteInput.addEventListener("input", () => {
      persistNote(noteInput.value);
    });
    applySavedNote();

    pillButton = document.createElement("button");
    pillButton.type = "submit";
    pillButton.className = "vs-pill";
    pillButton.textContent = PILL_LABEL;

    host.addEventListener("mousedown", (event) => {
      const path = event.composedPath();
      if (path.includes(noteInput)) return;
      event.preventDefault();
      event.stopPropagation();
    });

    barEl.append(noteInput, pillButton);
    shadowRoot.append(style, barEl);
  } else if (!shadowRoot) {
    shadowRoot = host.shadowRoot;
    barEl = shadowRoot?.querySelector(".vs-bar");
    noteInput = shadowRoot?.querySelector(".vs-note");
    pillButton = shadowRoot?.querySelector(".vs-pill");
  }
  return host;
}

function hidePill() {
  const host = hostEl();
  lastContext = null;
  persistNote(noteInput?.value ?? lastNote, { immediate: true });
  if (noteInput) {
    noteInput.disabled = false;
    applySavedNote();
  }
  if (pillButton) {
    pillButton.disabled = false;
    pillButton.textContent = PILL_LABEL;
  }
  if (barEl) barEl.classList.remove("is-error");
  if (host) host.style.display = "none";
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

function showPill(context) {
  const host = getHost();
  lastContext = context;
  const pos = clampPillPosition(context.rect);
  host.style.display = "block";
  host.style.left = `${pos.left}px`;
  host.style.top = `${pos.top}px`;
  if (barEl) barEl.classList.remove("is-error");
  if (noteInput) {
    noteInput.disabled = false;
    applySavedNote();
  }
  if (pillButton) {
    pillButton.disabled = false;
    pillButton.textContent = PILL_LABEL;
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
  if (detectMapsIntent(note)) {
    const url = mapsUrl(selectedText, note);
    if (!url) throw new Error("Empty maps query");
    await sendMessage({ type: "OPEN_URL", url });
    return;
  }
  const query = await generateSearchQuery(selectedText, context);
  if (!query) throw new Error("Empty query");
  await sendMessage({ type: "OPEN_URL", query });
}

async function onSurfClick() {
  const context = lastContext || extractContext();
  if (!context?.selectedText) {
    hidePill();
    return;
  }
  const payload = withExtraNote(context);
  persistNote(payload.extraNote, { immediate: true });
  if (pillButton) {
    pillButton.disabled = true;
    pillButton.textContent = "Surfing…";
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
  if (isInsideHost(event.target)) return;
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    const context = extractContext();
    if (!context || context.rect.width === 0) {
      if (!isHostActive()) hidePill();
      return;
    }
    showPill(context);
  }, 10);
}

function onSelectionChange() {
  if (isHostActive()) return;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    hidePill();
  }
}

document.addEventListener("mouseup", onMouseUp);
document.addEventListener("selectionchange", onSelectionChange);
window.addEventListener(
  "scroll",
  () => {
    if (!isHostActive()) hidePill();
  },
  { passive: true },
);
window.addEventListener("resize", () => {
  if (!isHostActive()) hidePill();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SURF_SELECTION") {
    return;
  }
  const context = lastContext || extractContext();
  const selectedText =
    context?.selectedText ||
    String(message.selectedText || "")
      .replace(/\s+/g, " ")
      .trim();
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
