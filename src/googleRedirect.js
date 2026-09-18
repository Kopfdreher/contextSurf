const OVERLAY_ID = "ts-surfing";
const STYLE_ID = "ts-surfing-style";
const OVERLAY_MS = 1000;

function isGoogleSearchHost() {
  return /^(www\.)?google\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/i.test(
    location.hostname,
  );
}

function isLuckyOrUrl() {
  return (
    location.pathname.startsWith("/url") ||
    new URLSearchParams(location.search).has("btnI")
  );
}

function destinationFromUrlQuery() {
  if (!location.pathname.startsWith("/url")) return "";
  const raw = new URLSearchParams(location.search).get("q");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function showOverlay() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html.ts-surfing-hide body { visibility: hidden !important; }
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      background: #111827;
      color: #f9fafb;
      font: 600 18px/1.4 ui-sans-serif, system-ui, sans-serif;
      visibility: visible !important;
      pointer-events: none;
    }
  `;
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.textContent = "🌊 surfing…";
  document.documentElement.classList.add("ts-surfing-hide");
  document.documentElement.append(style, overlay);
}

function hideOverlay() {
  document.documentElement.classList.remove("ts-surfing-hide");
  document.getElementById(STYLE_ID)?.remove();
  document.getElementById(OVERLAY_ID)?.remove();
}

if (isGoogleSearchHost() && isLuckyOrUrl()) {
  showOverlay();
  const destination = destinationFromUrlQuery();
  if (destination) {
    location.replace(destination);
  } else {
    window.setTimeout(hideOverlay, OVERLAY_MS);
  }
}
