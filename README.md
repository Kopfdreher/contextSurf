# textSurf

Highlight text, add an optional note, and open the most relevant destination.

## Load

```bash
npm install
npm run build
```

`chrome://extensions/` → Developer mode → **Load unpacked** → `dist/`

Click the toolbar icon to open settings: **open tabs in background**, and **Change shortcut** (default **Alt+S** / Option+S, plus **Option+Space** for notes). Chrome may leave a key unset if it conflicts; assign it there if needed.

Hold **Option+S** (Alt+S) and hover a word to highlight it. Click the highlight or **surf** to open a tab; keep holding to hover more words and open more tabs. Release Option to dismiss.

Press **Option+Space** to open the note bar in the upper-right corner (no highlight or page context). Type a note and press Enter to open an I’m Feeling Lucky tab.

## How it ranks signals

1. **Highlighted text** — always the subject  
2. **Note** — intent (stronger than the article)  
3. **Page** (title, H1, surrounding) — disambiguate only  

The last note is a **placeholder**: type to replace it (even if you dismiss without surfing), or press Enter with an empty field to reuse it. Click **×** to delete it. It is stored in `chrome.storage.local` for the Chrome profile.

Messy highlights (ticket prices, copyright) are trimmed to a short name (Nano, or a first-line heuristic) before Maps or Lucky.

Maps shortcuts in the note (`maps`, `google maps`, `map`, `route`, `direction`) open Google Maps (search or directions) instead of Lucky. Otherwise the Prompt API (or a string fallback) writes a Lucky query.

## Built-in AI (optional)

- `chrome://flags/#optimization-guide-on-device-model` → Enabled BypassRequirement  
- `chrome://flags/#prompt-api-for-gemini-nano` → Enabled  

Without Nano, fallback is `{selection}` + note, or title words if the note is empty.

## Privacy

See [PRIVACY.md](PRIVACY.md). Chrome Web Store listing URL after you push:

`https://github.com/Kopfdreher/vibe-surfing-chrome-extension/blob/main/PRIVACY.md`
