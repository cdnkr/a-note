# A-Note web

The static A-Note landing page. `/privacy-policy` renders the extension's public
privacy policy. Historical `/s/*` screenshot URLs render a no-indexed retirement
notice instead of fetching or displaying uploaded data.

## Local development

Copy `.env.example` to `.env.local` and set the Chrome Web Store URL, then run:

```sh
pnpm install
pnpm dev
```

Use `pnpm test` for the test suite and `pnpm build` for the production bundle.
`pnpm pages:dev` serves the built static site through the project-local
Cloudflare Pages development server.

## Cloudflare deployment

Build with `pnpm build` and publish `dist` to Cloudflare Pages. The project no
longer needs Pages Functions, an R2 binding, upload-origin variables, or
screenshot storage. Existing deployed buckets are intentionally not modified by
the source change and can be retired separately after any desired retention
period.
