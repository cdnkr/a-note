# Annotate Chrome extension handoff

## Workspace and artifacts

- Workspace: `$HOME/code/annotate/extension`
- Product/install overview: `$HOME/code/annotate/extension/README.md`
- Manifest/action wiring: `manifest.json`, `background.js`
- Shared URL/XPath utilities: `lib.js`
- Main page UI and behavior: `content.js`
- Unit tests: `test/lib.test.js`
- The workspace was created from an empty directory and is not currently a Git repository.

## Current status

The Manifest V3 extension is functional and has been iteratively styled from user feedback. There is no build step. The last verification passed all 5 Node tests and JavaScript syntax checks.

The latest completed change adds a persisted 12-colour annotation palette to the compact toolbar and automatically switches note/icon foreground contrast for light colours.

## Established product behavior

- Clicking the Chrome extension icon toggles the in-page UI directly; there is no popup.
- The bottom-right toolbar slides in/out from the right and contains the colour-aware `A`, viewport screenshot, current-colour circle, annotation plus, and close-mode controls.
- The colour circle opens a top widget matching the screenshot preview styling. The active swatch has a dark border, and changing it updates all note backgrounds, target/saved outlines, and the `A` background immediately.
- Active page annotations are outlined and shown as cobalt note boxes beside their DOM target. Comments resolving to the same element stack vertically.
- Page comments reveal first-to-last with a 50ms stagger and dismiss last-to-first before the host is hidden.
- Each page note contains compact Share/Delete ghost controls on its right edge.
- The plus control toggles DOM-selection mode and uses a dark active state with a white plus. After an element is selected, it immediately returns to its inactive state.
- The inline composer occupies the exact future annotation position. If comments already resolve to that DOM element, it appears directly beneath their stack.
- The composer is one unified white surface, fades in/out, auto-grows from 126px to 240px, and has no textarea border or focus ring. A 38px ghost × is inset 8px at bottom-left; a 38px cobalt up-arrow Save button is inset 8px at bottom-right.
- Escape also cancels the composer.
- Note Share captures only that note and highlight; viewport capture keeps all currently visible notes. Both upload immediately and open the fixed preview with Share, Download, Copy Link, and close controls.
- Share pages always remain in the web app. Extension detection, original-page redirects, share import, and the missing-import rail have been removed.
- Exact-URL local storage, unresolved annotations, and SPA route behavior are documented in `README.md` and implemented in `lib.js`/`content.js`.

## Visual direction

- Reference aesthetic: clean white surfaces, cobalt primary (`#405cf5`), restrained shadows, high-radius cards, neutral greys.
- The user strongly prefers incremental visual adjustments and compact controls.
- The neutral palette uses ink black, snow, canvas, fog, pebble, graphite, slate, steel, and ash; these are CSS variables in `content.js`.
- Do not reintroduce a popup, annotation-list panel, launcher text/count, chevrons, colored composer accent bars, composer headings, or textarea rings.

## Verification

Run from the workspace:

```sh
npm test
node --check content.js
node --check background.js
node --check lib.js
```

If the shell cannot find Node/npm, load the Codex workspace dependencies and use its bundled Node executable.

## Continuation notes

- Most UI code and CSS live in the single `content.js`; search by class name before editing.
- The user appears to be visually testing by reloading the unpacked extension. Remind them to reload `chrome://extensions` only when necessary.
- Automated browser visual QA has not been performed in this session. Preserve the Shadow DOM isolation and verify any positioning changes under window and nested-container scrolling.
- Share parameters `x` and `c` are intentionally reserved and stripped from the canonical storage URL.
- Keep reduced-motion behavior intact when adding animations.
- No credentials or external services are involved.

## Suggested skills

- `chrome:control-chrome` — useful if the next agent needs visual/browser QA against the user’s already-loaded unpacked extension and current Chrome page state.
- No image-generation skill is recommended; this UI is code-native HTML/CSS and the supplied screenshots are only layout/style references.
