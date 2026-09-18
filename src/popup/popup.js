const FLAG_KEY = "textSurfOpenInBackground";

const checkbox = document.getElementById("background");

void chrome.storage.local.get(FLAG_KEY).then((stored) => {
  checkbox.checked = Boolean(stored[FLAG_KEY]);
});

checkbox.addEventListener("change", () => {
  void chrome.storage.local.set({ [FLAG_KEY]: checkbox.checked });
});
