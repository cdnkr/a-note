# annotate

A local-first Chrome extension for attaching short comments to elements on a webpage and sharing an individual annotation through the Annotate web app.

## Install locally

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Click the **annotate** extension icon to toggle annotate mode directly on the page. No popup is used.

## How it works

- Every page is keyed in `chrome.storage.local` by its full URL, including ordinary query parameters and the hash.
- A saved annotation contains an XPath, short text content (up to 240 characters), an ID, and its creation time.
- The first **Copy link** captures the visible viewport with the target's cobalt border and the shared comment, uploads it through the web app, and stores the immutable share URL locally. Other annotations and extension controls are excluded from the screenshot. Later copies reuse that URL.
- Opening a web share with the extension installed redirects to the original page with an `annotateShare` ID. The extension imports the record, removes the parameter, and displays the annotation.
- If an imported XPath does not resolve after a short SPA grace period, its screenshot and comment appear in the stacked left-side missing-element rail. Local notes without screenshots remain in the panel's **Element not found** group.
- Single-page-app URL changes are detected, so each route keeps its own exact-URL annotation set without a full reload.
- In active mode, every resolved element is outlined and its comments are shown beside it. Multiple comments on one element stack vertically.
- The bottom-right control widget remains fixed to the browser viewport. Element outlines, saved comment stacks, and the new-annotation composer are document-anchored and stay attached to their element as it scrolls.

## Development

There is no build step. Run the URL/storage unit tests with:

```sh
npm test
```

## Web app configuration

Update `config.js` with the deployed web origin and API URL, and replace the matching placeholder in `manifest.json` before publishing. For unpacked local development, add the local extension ID to `web/.dev.vars` and set `config.js` to the Wrangler Pages development origin.

The extension never receives R2 credentials. Its background worker captures the active tab and uploads a validated JPEG multipart request to the Cloudflare Pages Function.
