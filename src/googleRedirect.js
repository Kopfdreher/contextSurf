const QUERY_KEY = "textSurfLastQuery";
const OVERLAY_ID = "ts-surfing";
const STYLE_ID = "ts-surfing-style";
const FALLBACK_MS = 1500;

function isMapsGoogle(hostname, pathname) {
  return (
    hostname.startsWith("maps.google.") ||
    (hostname.includes("google.") && pathname.startsWith("/maps"))
  );
}

function looksLikeLuckyOrInterstitial() {
  const params = new URLSearchParams(location.search);
  return params.has("btnI") || location.pathname.startsWith("/url");
}

function isRedirectNoticeDom() {
  const title = (document.title || "").toLowerCase();
  if (title.includes("redirect notice")) return true;
  const heading = document.querySelector("h1, h2");
  const headingText = (heading?.textContent || "").toLowerCase();
  return headingText.includes("redirect notice");
}

function isNormalSerp() {
  if (looksLikeLuckyOrInterstitial() || isRedirectNoticeDom()) return false;
  return Boolean(
    document.querySelector("#search, #rso, #center_col, textarea[name='q']"),
  );
}

function firstDestinationHref() {
  const root = document.documentElement;
  if (!root) return "";
  const links = [...root.querySelectorAll("a[href]")];
  for (const link of links) {
    try {
      const url = new URL(link.href, location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (isMapsGoogle(url.hostname, url.pathname)) return url.toString();
      if (url.hostname.includes("google.")) continue;
      return url.toString();
    } catch {
      /* skip */
    }
  }
  return "";
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

async function fallbackToSerp() {
  const stored = await chrome.storage.session.get(QUERY_KEY);
  const query = stored[QUERY_KEY];
  if (query) {
    location.replace(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    );
  } else {
    hideOverlay();
  }
}

function jumpIfPossible() {
  const destination = firstDestinationHref();
  if (!destination) return false;
  location.replace(destination);
  return true;
}

function watchForDestination() {
  if (jumpIfPossible()) return;
  const observer = new MutationObserver(() => {
    if (isNormalSerp()) {
      observer.disconnect();
      hideOverlay();
      return;
    }
    if (jumpIfPossible()) observer.disconnect();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.setTimeout(() => {
    if (jumpIfPossible()) {
      observer.disconnect();
      return;
    }
    if (isNormalSerp()) {
      observer.disconnect();
      hideOverlay();
      return;
    }
    observer.disconnect();
    void fallbackToSerp();
  }, FALLBACK_MS);
}

if (looksLikeLuckyOrInterstitial()) {
  showOverlay();
  watchForDestination();
} else {
  const boot = new MutationObserver(() => {
    if (isRedirectNoticeDom()) {
      boot.disconnect();
      showOverlay();
      watchForDestination();
    }
  });
  boot.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => boot.disconnect(), FALLBACK_MS);
}
