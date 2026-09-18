# textSurf privacy policy

Last updated: 18 September 2026

textSurf is a Chrome extension that opens a search or Maps tab from text you highlight or hover on a page.

## What we access

When you use Surf (keyboard shortcut, click, or the context menu), the extension reads, **on that tab only**:

- the word or selection you chose
- an optional note you type
- limited page context (title, heading, nearby text, page URL) to disambiguate the query

This happens locally in the browser. We do not operate a backend and we do not receive this data.

## What is stored on your device

In Chrome’s local storage for your profile:

- your last note (up to 100 characters), used as a placeholder
- whether new tabs should open in the background

You can clear the note with × in the bar. Uninstalling the extension removes this storage.

## What is sent to others

Opening a destination loads a **Google Search** (I’m Feeling Lucky) or **Google Maps** URL in a new tab. The query is the subject plus your note, in the same way as typing a search yourself. Google’s own privacy policy applies to that visit.

If Chrome’s on-device Prompt API (Gemini Nano) is available, it may run **on your device** to tidy the query. That is a Chrome feature, not our server.

## What we do not do

- no accounts or sign-in
- no analytics or advertising
- no sale or transfer of user data to third parties
- no use of data for credit, lending, or unrelated purposes
- no collection of passwords, payment data, health data, or a history of sites you visit

## Permissions

The extension uses `contextMenus`, `tabs`, `storage`, and access to pages you visit so it can show the bar and open a tab. A small script on Google search pages follows Lucky `/url` redirects in the tab you opened.

## Contact

Questions: open an issue on this GitHub repository.
