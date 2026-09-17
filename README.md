# Vibe Surfing

Manifest V3 Chrome extension: highlight text, build a **context-aware** Google query, and open I’m Feeling Lucky (`btnI=1`).

## Develop

```bash
npm install
npm run dev
```

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. **Load unpacked** and select the `dist/` folder this project writes

Production build: `npm run build`, then load `dist/` the same way.

## Chrome Built-in AI (optional)

When Gemini Nano is **already ready**, the Prompt API writes a 4–8 word Lucky query from the highlight, optional note, title, H1, meta description, and surrounding paragraph. It disambiguates the entity and prefers official/canonical pages. It does **not** default to careers unless the page or note is about jobs.

If the model is missing, downloading, or unavailable, the fallback is `{selection}` plus the note and a couple of distinctive title/H1 words.

Enable flags, relaunch Chrome, then wait for the on-device model:

- `chrome://flags/#optimization-guide-on-device-model` → Enabled BypassRequirement
- `chrome://flags/#prompt-api-for-gemini-nano` → Enabled
- `chrome://components/` → Optimization Guide On Device Model

## Demo flow

1. Open an article and highlight an entity (company, person, product, etc.)
2. Optionally type extra intent in **add a note…**, then click **Surf** (or press Enter). Right-click → Surf skips the note.
3. A new **active** tab opens Google Lucky. If Google shows a Redirect Notice, the helper follows the destination link (or a normal SERP for that query).

## Debug

- Content script: inspect the page → Console
- Service worker: `chrome://extensions/` → **service worker** under Vibe Surfing
# vibe-surfing-chrome-extension
