const MENU_ID = "textsurf-menu";
const QUERY_KEY = "textSurfLastQuery";
const FLAG_KEY = "textSurfOpenInBackground";

function luckyUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&btnI=1`;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '"%s" ➔ Surf',
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, {
    type: "TEXTSURF_SELECTION",
    selectedText: info.selectionText,
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "OPEN_URL") return;
  const query = String(message.query || "").trim();
  const direct = String(message.url || "").trim();
  if (!query && !direct) {
    sendResponse({ ok: false });
    return;
  }
  const url = direct || luckyUrl(query);
  void chrome.storage.session
    .set({ [QUERY_KEY]: query })
    .then(() => chrome.storage.local.get(FLAG_KEY))
    .then((stored) =>
      chrome.tabs.create({
        url,
        active: !stored[FLAG_KEY],
      }),
    )
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
  return true;
});
