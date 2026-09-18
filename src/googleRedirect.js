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

const destination = destinationFromUrlQuery();
if (destination) location.replace(destination);
