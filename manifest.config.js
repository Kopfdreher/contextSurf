import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "textSurf",
  version: "1.0.0",
  description:
    "Highlight text, infer intent from the page, and open a relevant destination.",
  permissions: ["contextMenus", "tabs", "storage"],
  host_permissions: ["<all_urls>"],
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
      matches: ["<all_urls>"],
      js: ["src/googleRedirect.js"],
      run_at: "document_start",
    },
  ],
});
