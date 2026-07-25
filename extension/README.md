# A-Note

A local-first Chrome extension for attaching short comments to webpage elements and sharing annotated screenshots through the A-Note web app.

## Install locally

1. Run `npm install` and `npm run build` in this directory.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select the generated `dist` directory.
5. Click the **A-Note** extension icon to toggle annotate mode directly on the page. No popup is used.

## How it works

- Every page is keyed in `chrome.storage.local` by its full URL, including ordinary query parameters and the hash.
- A saved annotation contains either an element XPath or an exact text-range target, short text content (up to 240 characters), an ID, and its creation time. Selecting a target creates and persists an inline annotation immediately in edit mode; it may remain empty for outline- or highlight-only screenshots. Clicking saved comment text edits it, and each input immediately updates `chrome.storage.local`.
- New annotations use a ranked XPath candidate strategy: stable unique IDs and test attributes first, then semantic tags, label/text anchors, nearby stable ancestors or siblings, token-safe classes, and finally an absolute path. Every candidate must resolve uniquely to the selected element before it can be stored. SVG steps are namespace-safe, while elements inside open Shadow DOM use a compound host XPath plus deterministic paths within each shadow root.
- After the `A` mark, the bottom-right toolbar exposes annotation colour, element selection, text highlighting, viewport capture, and close-mode controls in that order; there is no annotation-list panel.
- The colour control opens a 12-colour palette. The choice is stored globally for the extension and updates every handwritten note, target outline, text highlight, colour indicator, and toolbar `A`; the `A` retains automatic foreground contrast.
- Saved notes are transparent Excalifont text that shrink to their content up to a 340px maximum. Their neutral Capture screenshot and Delete controls form a horizontal pair immediately beside the text, mirrored to the edge farthest from the target; below-target notes use whichever side has more viewport room. Every Capture screenshot action captures the note and its highlighted element in their current colour and position, uploads a new JPEG, replaces the locally stored link, and opens the screenshot preview.
- The toolbar screenshot button captures the current viewport with all visible notes. Extension controls fade out before capture, while offscreen and unresolved annotations remain excluded.
- The screenshot preview provides Share, Download, and Copy Link controls. Viewport previews are temporary, but their uploaded links remain durable.
- Public share links always display the screenshot in the web app, even when the extension is installed. New links include the active colour token so the share page uses the same primary colour; links without a supported token use cobalt. Shared annotations are no longer imported back onto the original page.
- Annotations whose XPath no longer resolves remain in local storage and reappear if their target becomes available again.
- Single-page-app URL changes are detected, so each route keeps its own exact-URL annotation set without a full reload.
- In active mode, every resolved element has a transparent colour-matched outline offset 5px beyond its bounds, while selected text receives an exact, translucent colour-matched background across every selected line. Comments are shown beside either target, and multiple untouched comments on one target stack vertically.
- Element selection uses a one-shot crosshair mode. Text highlighting uses a one-shot I-beam mode and the browser-native CSS Custom Highlight API, so page DOM is not wrapped or rewritten. Releasing a non-empty selection immediately creates and focuses a blank annotation; blank text annotations survive blur and Escape.
- Clicking an existing text highlight while neither selection tool is active creates another blank comment for that range. Text ranges are restored by their element XPath and character offsets, with exact quote context used to recover after ordinary page re-renders.
- Dragging handwritten comment text gives that annotation a manual document position and adds a curved colour-matched connector to the closest sides of the comment and target outline. Manual coordinates are kept in memory across UI re-renders and in page `localStorage` across refreshes; they are applied only when the viewport width exactly matches the width at which the comment was moved.
- The bottom toolbar and screenshot preview remain fixed to the browser viewport. Element outlines and saved comment stacks are document-anchored and stay attached to their element as it scrolls.

## Development

Readable extension code lives in `src`, while the manifest and static assets live
in `public`. Vite creates the minified, loadable extension in `dist`.

Build once or continuously with:

```sh
npm run build
npm run build:watch
```

Run the build and complete test suite with:

```sh
npm test
```

## Web app configuration

Update `src/config.js` with the deployed web origin and API URL before publishing. For unpacked local development, add the local extension origin to `web/.dev.vars` and set `src/config.js` to the Wrangler Pages development origin.

The extension never receives R2 credentials. Its background worker captures the active tab and uploads a validated JPEG multipart request to the Cloudflare Pages Function.

## Bundled font

Saved annotation text uses Excalifont, bundled as the official unmodified WOFF2 subsets. Excalifont is licensed under the SIL Open Font License 1.1; its copyright notice and complete license are included in `fonts/OFL.txt`.
