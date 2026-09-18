const QUERY_KEY = "textSurfLastQuery";

function isMapsGoogle(hostname, pathname) {
  return (
    hostname.startsWith("maps.google.") ||
    (hostname.includes("google.") && pathname.startsWith("/maps"))
  );
}

function isRedirectNotice() {
  const title = (document.title || "").toLowerCase();
  const text = (document.body?.innerText || "").slice(0, 2000).toLowerCase();
  return (
    title.includes("redirect notice") ||
    text.includes("redirect notice") ||
    text.includes("the page you requested")
  );
}

function firstDestinationHref() {
  const links = [...document.querySelectorAll("a[href]")];
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

async function maybeBypassNotice() {
  if (!isRedirectNotice() && !location.pathname.startsWith("/url")) {
    return;
  }

  const destination = firstDestinationHref();
  if (destination) {
    location.replace(destination);
    return;
  }

  const stored = await chrome.storage.session.get(QUERY_KEY);
  const query = stored[QUERY_KEY];
  if (query) {
    location.replace(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    );
  }
}

void maybeBypassNotice();
