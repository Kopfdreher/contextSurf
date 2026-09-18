# textSurf

Highlight text, add an optional note, and open the most relevant destination.

## Load

```bash
npm install
npm run build
```

`chrome://extensions/` → Developer mode → **Load unpacked** → `dist/`

Click the toolbar icon to open settings: **open tabs in background**, and **Change shortcut** (default **Alt+S** / Option+S). Chrome may leave the key unset if it conflicts; assign it there if needed.

Hold **Option+S** (Alt+S) and hover a word to highlight it. Click the highlight or **surf** to open the tab; release Option to dismiss.

## How it ranks signals

1. **Highlighted text** — always the subject  
2. **Note** — intent (stronger than the article)  
3. **Page** (title, H1, surrounding) — disambiguate only  

The last note is a **placeholder**: type to replace it, or press Enter with an empty field to reuse it. It is stored in `chrome.storage.local` for the Chrome profile.

Messy highlights (ticket prices, copyright) are trimmed to a short name (Nano, or a first-line heuristic) before Maps or Lucky.

Maps shortcuts in the note (`maps`, `google maps`, `map`, `route`, `direction`) open Google Maps (search or directions) instead of Lucky. Otherwise the Prompt API (or a string fallback) writes a Lucky query.

## Built-in AI (optional)

- `chrome://flags/#optimization-guide-on-device-model` → Enabled BypassRequirement  
- `chrome://flags/#prompt-api-for-gemini-nano` → Enabled  

Without Nano, fallback is `{selection}` + note, or title words if the note is empty.
