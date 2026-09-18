function isGoogleSearchHost() {
  return /^(www\.)?google\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/i.test(
    location.hostname,
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

if (isGoogleSearchHost()) {
  const destination = destinationFromUrlQuery();
  if (destination) location.replace(destination);
}
