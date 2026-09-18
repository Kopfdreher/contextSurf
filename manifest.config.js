import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Vibe Surfing",
  version: "1.0.0",
  description:
    "Highlight text, infer intent from the page, and open a relevant destination.",
  permissions: ["contextMenus", "tabs", "storage"],
  host_permissions: ["<all_urls>"],
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
      matches: ["https://www.google.com/*", "https://www.google.de/*"],
      js: ["src/googleRedirect.js"],
      run_at: "document_idle",
    },
  ],
});
