import { defineManifest } from "@crxjs/vite-plugin";

const GOOGLE_SEARCH = [
  "https://www.google.com/*",
  "https://google.com/*",
  "https://www.google.de/*",
  "https://google.de/*",
  "https://www.google.at/*",
  "https://google.at/*",
  "https://www.google.ch/*",
  "https://google.ch/*",
  "https://www.google.co.uk/*",
  "https://google.co.uk/*",
  "https://www.google.fr/*",
  "https://google.fr/*",
];

export default defineManifest({
  manifest_version: 3,
  name: "textSurf",
  version: "1.0.0",
  description:
    "Highlight or hover text, add an optional note, and open a search or Maps tab.",
  permissions: ["contextMenus", "storage"],
  icons: {
    16: "icons/icon16.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
  action: {
    default_popup: "src/popup/popup.html",
    default_title: "textSurf",
    default_icon: {
      16: "icons/icon16.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png",
    },
  },
  commands: {
    "textsurf-run": {
      suggested_key: {
        default: "Alt+S",
        mac: "Alt+S",
      },
      description: "Surf the selected text",
    },
    "textsurf-lucky": {
      suggested_key: {
        mac: "Alt+Space",
      },
      description: "Open the note bar and Feeling Lucky search",
    },
  },
  background: {
    service_worker: "src/background.js",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content.js"],
    },
    {
      matches: GOOGLE_SEARCH,
      js: ["src/googleRedirect.js"],
      run_at: "document_start",
    },
  ],
});
