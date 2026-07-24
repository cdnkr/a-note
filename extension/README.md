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
- The bottom-right toolbar exposes viewport capture, annotation colour, annotation selection, and close-mode controls directly; there is no annotation-list panel.
- The colour control opens a 12-colour palette. The choice is stored globally for the extension and updates every note, target outline, saved-element highlight, and the toolbar `A`; light colours automatically use dark foreground controls and text.
- Each visible note contains ghost Share and Delete buttons. The first Share captures only that note and its highlighted element, uploads the JPEG, stores the immutable link locally, and opens the screenshot preview. Later shares reuse the same screenshot and link.
- The toolbar screenshot button captures the current viewport with all visible notes. Extension controls fade out before capture, while offscreen and unresolved annotations remain excluded.
- The screenshot preview provides Share, Download, and Copy Link controls. Viewport previews are temporary, but their uploaded links remain durable.
- Public share links always display the screenshot in the web app, even when the extension is installed. Shared annotations are no longer imported back onto the original page.
- Annotations whose XPath no longer resolves remain in local storage and reappear if their target becomes available again.
- Single-page-app URL changes are detected, so each route keeps its own exact-URL annotation set without a full reload.
- In active mode, every resolved element is outlined and its comments are shown beside it. Multiple comments on one element stack vertically.
- The bottom toolbar and screenshot preview remain fixed to the browser viewport. Element outlines, saved comment stacks, and the new-annotation composer are document-anchored and stay attached to their element as it scrolls.

## Development

There is no build step. Run the URL/storage unit tests with:

```sh
npm test
```

## Web app configuration

Update `config.js` with the deployed web origin and API URL before publishing. For unpacked local development, add the local extension origin to `web/.dev.vars` and set `config.js` to the Wrangler Pages development origin.

The extension never receives R2 credentials. Its background worker captures the active tab and uploads a validated JPEG multipart request to the Cloudflare Pages Function.
