const FLAG_KEY = "textSurfOpenInBackground";
const COMMAND_ID = "textsurf-run";

const checkbox = document.getElementById("background");
const shortcutEl = document.getElementById("shortcut");
const changeBtn = document.getElementById("change");

function formatShortcut(shortcut) {
  if (!shortcut) return "not set";
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  if (!mac) return shortcut.replaceAll("Command+", "Ctrl+");
  return shortcut
    .replaceAll("Command", "⌘")
    .replaceAll("Ctrl", "⌃")
    .replaceAll("Alt", "⌥")
    .replaceAll("Shift", "⇧")
    .replaceAll("+", "");
}

void chrome.storage.local.get(FLAG_KEY).then((stored) => {
  checkbox.checked = Boolean(stored[FLAG_KEY]);
});

checkbox.addEventListener("change", () => {
  void chrome.storage.local.set({ [FLAG_KEY]: checkbox.checked });
});

void chrome.commands.getAll().then((commands) => {
  const command = commands.find((item) => item.name === COMMAND_ID);
  shortcutEl.textContent = formatShortcut(command?.shortcut);
});

changeBtn.addEventListener("click", () => {
  void chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});
