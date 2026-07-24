# annotate

A local-first Chrome extension for attaching short comments to webpage elements and sharing annotated screenshots through the Annotate web app.

## Install locally

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Click the **annotate** extension icon to toggle annotate mode directly on the page. No popup is used.

## How it works

- Every page is keyed in `chrome.storage.local` by its full URL, including ordinary query parameters and the hash.
- A saved annotation contains an XPath, short text content (up to 240 characters), an ID, and its creation time.
- After the `A` mark, the bottom-right toolbar exposes annotation colour, Add, viewport capture, and close-mode controls in that order; there is no annotation-list panel.
- The colour control opens a 12-colour palette. The choice is stored globally for the extension and updates every handwritten note, target outline, saved-element highlight, colour indicator, and toolbar `A`; the `A` retains automatic foreground contrast.
- Saved notes are transparent Excalifont text that shrink to their content up to a 340px maximum. Their neutral Share and Delete controls form a horizontal pair immediately beside the text, mirrored to the edge farthest from the target; below-target notes use whichever side has more viewport room. Every Share captures the note and its highlighted element in their current colour and position, uploads a new JPEG, replaces the locally stored link, and opens the screenshot preview.
- The toolbar screenshot button captures the current viewport with all visible notes. Extension controls fade out before capture, while offscreen and unresolved annotations remain excluded.
- The screenshot preview provides Share, Download, and Copy Link controls. Viewport previews are temporary, but their uploaded links remain durable.
- Public share links always display the screenshot in the web app, even when the extension is installed. New links include the active colour token so the share page uses the same primary colour; links without a supported token use cobalt. Shared annotations are no longer imported back onto the original page.
- Annotations whose XPath no longer resolves remain in local storage and reappear if their target becomes available again.
- Single-page-app URL changes are detected, so each route keeps its own exact-URL annotation set without a full reload.
- In active mode, every resolved element has a transparent colour-matched outline offset 5px beyond its bounds, and its comments are shown beside it. Multiple untouched comments on one element stack vertically.
- Dragging handwritten comment text gives that annotation a manual document position and adds a curved colour-matched connector to the closest sides of the comment and target outline. Manual coordinates are kept in memory across UI re-renders and in page `localStorage` across refreshes; they are applied only when the viewport width exactly matches the width at which the comment was moved.
- The bottom toolbar and screenshot preview remain fixed to the browser viewport. Element outlines, saved comment stacks, and the new-annotation composer are document-anchored and stay attached to their element as it scrolls.

## Development

There is no build step. Run the URL/storage unit tests with:

```sh
npm test
```

## Web app configuration

Update `config.js` with the deployed web origin and API URL before publishing. For unpacked local development, add the local extension origin to `web/.dev.vars` and set `config.js` to the Wrangler Pages development origin.

The extension never receives R2 credentials. Its background worker captures the active tab and uploads a validated JPEG multipart request to the Cloudflare Pages Function.

## Bundled font

Saved annotation text uses Excalifont, bundled as the official unmodified WOFF2 subsets. Excalifont is licensed under the SIL Open Font License 1.1; its copyright notice and complete license are included in `fonts/OFL.txt`.
