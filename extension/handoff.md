# Annotate Chrome extension handoff

## Workspace and artifacts

- Workspace: `$HOME/code/annotate/extension`
- Product/install overview: `$HOME/code/annotate/extension/README.md`
- Manifest/action wiring: `manifest.json`, `background.js`
- Shared URL/XPath utilities: `lib.js`
- Shared annotation geometry: `layout.js`
- Main page UI and behavior: `content.js`
- Unit tests: `test/*.test.js`

## Current status

The Manifest V3 extension is functional and has been iteratively styled from user feedback. There is no build step. The last verification passed all 12 Node tests and JavaScript syntax checks.

The latest completed change restyles saved annotations as shrink-to-fit transparent Excalifont text, moves Share/Delete into a horizontal pair beside the text, and expands transparent colour-matched outlines 5px beyond their targets.

## Established product behavior

- Clicking the Chrome extension icon toggles the in-page UI directly; there is no popup.
- The bottom-right toolbar slides in/out from the right and contains the colour-aware `A`, current-colour circle, annotation plus, viewport screenshot, and close-mode controls in that order.
- The colour circle opens a top widget matching the screenshot preview styling. The active swatch has a dark border, and changing it updates handwritten note text, target/saved outlines, the colour indicator, and the `A` background immediately.
- Active page annotations have transparent outlines with 5px breathing room and appear as background-free Excalifont text beside their DOM target. Comments resolving to the same element stack vertically.
- Page comments reveal first-to-last with a 50ms stagger and dismiss last-to-first before the host is hidden.
- Each page note has compact neutral Share/Delete ghost controls in a horizontal pair immediately beside the text and mirrored to the edge farthest from the target. Below-target notes choose the roomier side.
- The plus control toggles DOM-selection mode and uses a dark active state with a white plus. After an element is selected, it immediately returns to its inactive state.
- The inline composer occupies the exact future annotation position. If comments already resolve to that DOM element, it appears directly beneath their stack.
- The composer is one unified white surface, fades in/out, auto-grows from 126px to 240px, and has no textarea border or focus ring. A 38px ghost × is inset 8px at bottom-left; a 38px cobalt up-arrow Save button is inset 8px at bottom-right.
- Escape also cancels the composer.
- Every Note Share captures that note and highlight in their current colour and position, replaces the note's stored link, and opens the fixed preview. Viewport capture keeps all currently visible notes. Both upload immediately and expose Share, Download, Copy Link, and close controls.
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
node --check layout.js
```

If the shell cannot find Node/npm, load the Codex workspace dependencies and use its bundled Node executable.

## Continuation notes

- Most UI code and CSS live in the single `content.js`; search by class name before editing.
- The user appears to be visually testing by reloading the unpacked extension. Remind them to reload `chrome://extensions` only when necessary.
- Automated browser visual QA could not be performed because the ChatGPT Chrome bridge was missing its native-host manifest. Preserve the Shadow DOM isolation and verify the font, action rails, and positioning under window and nested-container scrolling after reloading the unpacked extension.
- Share parameters `x` and `c` are intentionally reserved and stripped from the canonical storage URL.
- Keep reduced-motion behavior intact when adding animations.
- No credentials or external services are involved.

## Suggested skills

- `chrome:control-chrome` — useful if the next agent needs visual/browser QA against the user’s already-loaded unpacked extension and current Chrome page state.
- No image-generation skill is recommended; this UI is code-native HTML/CSS and the supplied screenshots are only layout/style references.
