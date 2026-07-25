## Deploy Web to Cloudflare

From the repository root:

```bash
cd web && pnpm build && pnpm exec wrangler pages deploy dist --project-name a-note-web --branch master
```

If prompted, authenticate first with:

```bash
cd web && pnpm exec wrangler login
```