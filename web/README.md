# A-Note web

The public landing page, screenshot share pages, and Cloudflare Pages Functions API for A-Note.

## Local development

1. Copy `.env.example` to `.env.local` and set the future Chrome Web Store URL.
2. Copy `.dev.vars.example` to `.dev.vars` and add that `chrome-extension://...` origin to `ALLOWED_UPLOAD_ORIGINS`.
3. Set the matching local `webAppOrigin`, `apiBaseUrl`, and allowed origin values in `../extension/src/config.js`.
4. Run `pnpm install`, then `pnpm build` and `pnpm pages:dev` to serve the built site and Functions with local R2 storage.

The Vite-only `pnpm dev` command is useful for visual frontend work, but
`/api/shares` needs `pnpm pages:dev`. Use this project script instead of a bare
`wrangler pages dev` command so the server runs with the project-local Wrangler
version from the lockfile.

## Cloudflare deployment

- Create private `a-shares` and `a-shares-preview` R2 buckets, or update the names in `wrangler.toml`.
- Configure the Pages project with the `SHARES` R2 binding and set `APP_ORIGIN` plus the comma-separated `ALLOWED_UPLOAD_ORIGINS` environment variable.
- Build with `pnpm build` and publish `dist`; Pages discovers the route handlers under `functions/`.
- Replace the placeholder app origin in `../extension/src/config.js` and set the production `VITE_CHROME_STORE_URL` value before the coordinated launch.
- Keep the R2 bucket private. Browsers upload only to the Pages Function and never receive R2 credentials.

## Upload protection

Create one Cloudflare WAF rate-limit rule matching the exact path `/api/shares`, with a starting threshold of 10 requests per 10 seconds and a 10-second block. The Function validates upload origins, client identifiers, target URLs, JPEG MIME types, and payload sizes.

This is guarded anonymous access rather than user authentication: origin checks and rate limiting deter casual abuse but cannot authenticate a determined custom HTTP client.
