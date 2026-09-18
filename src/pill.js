import pillCss from "./content.css?inline";
import { NOTE_KEY } from "./utils/keys.js";

const HOST_ID = "ts-host";
const PILL_LABEL = "🌊 surf";
const DEFAULT_PLACEHOLDER = "add a note…";
const NOTE_DEBOUNCE_MS = 150;
const PILL_PAD = 8;
const PILL_EST_WIDTH = 280;
const PILL_EST_HEIGHT = 44;
const HL_PAD = 4;

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

export function createPill({ onSurf }) {
  let shadowRoot = null;
  let barEl = null;
  let noteInput = null;
  let pillButton = null;
  let lastNote = "";
  let persistTimer = 0;
  let overlayEls = [];

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

  function typedNote() {
    return (noteInput?.value || "").replace(/\s+/g, " ").trim();
  }

  function extraNote() {
    return typedNote() || lastNote;
  }

  function applyPlaceholder() {
    if (!noteInput) return;
    noteInput.placeholder = lastNote || DEFAULT_PLACEHOLDER;
  }

  function persistNote({ immediate = false } = {}) {
    const typed = typedNote();
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
        void onSurf();
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
        persistNote();
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

  function show(context, { overlay = false, resetNote = true } = {}) {
    const host = getHost();
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

  function hide() {
    persistNote({ immediate: true });
    clearOverlay();
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
    const host = hostEl();
    if (host) host.style.display = "none";
  }

  function setBusy(busy) {
    if (pillButton) {
      pillButton.disabled = busy;
      pillButton.textContent = busy ? "🌊 surfing…" : PILL_LABEL;
    }
    if (noteInput) noteInput.disabled = busy;
  }

  function setError(isError) {
    barEl?.classList.toggle("is-error", isError);
  }

  return {
    hostEl,
    isInsideHost,
    isHostActive,
    extraNote,
    persistNote,
    show,
    hide,
    paintOverlay,
    clearOverlay,
    positionBar,
    hasOverlay: () => overlayEls.length > 0,
    setBusy,
    setError,
  };
}
