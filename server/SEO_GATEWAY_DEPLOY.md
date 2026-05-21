# SEO Gateway VPS Deploy Notes

This is a preparation note only. Do not run these commands until the VPS, DNS, certificate strategy, and service account path are confirmed.

## What It Runs

The SEO gateway serves wildcard SEO pages from physical files on the VPS.

Example:

```bash
https://aroi-d.madkontrollen.dk/
https://aroi-d.madkontrollen.dk/robots.txt
https://aroi-d.madkontrollen.dk/sitemap.xml
```

Routes to physical output:

```bash
public/sites/aroi-d.madkontrollen.dk/index.html
public/sites/aroi-d.madkontrollen.dk/robots.txt
public/sites/aroi-d.madkontrollen.dk/sitemap.xml
```

The Express app uses the host header via `req.hostname.toLowerCase()` and reads files from `public/sites/${host}/`.

## Environment

Copy and adapt:

```bash
cp server/seo-gateway.env.example .env.seo-gateway
```

Required values:

```bash
PORT=3100
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/serviceAccountKey.json
SEO_GATEWAY_CACHE_TTL_SECONDS=300
SEO_ALLOWED_ROOT_DOMAIN=madkontrollen.dk
SEO_SITES_ROOT=/absolute/path/madkontrol-app/public/sites
SEO_GATEWAY_INTERNAL_TOKEN=replace-with-long-random-token
```

Security checks before starting:

```bash
test -f "$GOOGLE_APPLICATION_CREDENTIALS"
chmod 600 "$GOOGLE_APPLICATION_CREDENTIALS"
git check-ignore serviceAccountKey.json
git check-ignore .env.seo-gateway
```

Never place `serviceAccountKey.json` under `public/`, `functions/public/`, or any Nginx-served directory.

## Install

```bash
npm install
```

## Local Checks

```bash
node --check server/seo-gateway.js
node server/seo-gateway.test.mjs
node --check ecosystem.seo-gateway.config.cjs
npm run seo:gateway
```

## Start With PM2

Edit `ecosystem.seo-gateway.config.cjs` first so `GOOGLE_APPLICATION_CREDENTIALS` points to the real absolute path on the VPS.

```bash
pm2 start ecosystem.seo-gateway.config.cjs
pm2 status
pm2 logs madkontrollen-seo-gateway
```

Persist PM2:

```bash
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup`.

## Nginx Wildcard Proxy

Use [seo-gateway.nginx.conf.example](./seo-gateway.nginx.conf.example) as a template only. Do not overwrite an existing Nginx config blindly.

Minimum proxy target:

```nginx
server {
    listen 80;
    server_name *.madkontrollen.dk;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Validate and reload:

```bash
nginx -t
systemctl reload nginx
```

## Smoke Tests

Run against the local gateway before enabling public traffic and again after Nginx is reloaded:

```bash
curl -H "Host: aroi-d.madkontrollen.dk" http://127.0.0.1:3100/
curl -H "Host: aroi-d.madkontrollen.dk" http://127.0.0.1:3100/sitemap.xml
curl -H "Host: aroi-d.madkontrollen.dk" http://127.0.0.1:3100/robots.txt
```

Expected:

- `/` returns `text/html`
- `/sitemap.xml` returns `application/xml`
- `/robots.txt` returns `text/plain`

## Cache Invalidation

The gateway keeps a short in-memory cache. Published SEO routes can be invalidated with the internal endpoint:

```bash
curl -X POST http://127.0.0.1:3100/__internal/seo-cache/invalidate \
  -H "Authorization: Bearer $SEO_GATEWAY_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"citySlug":"herning","businessSlug":"aroi-d"}'
```

Expected response:

```json
{"ok":true,"citySlug":"herning","businessSlug":"aroi-d","invalidated":3}
```

The token must be a long random value in `.env.seo-gateway` or the PM2 environment. Do not commit the real token.

Keep this endpoint internal. Prefer firewall or Nginx rules so it is only reachable from localhost or trusted backend hosts.

## Rebuild Endpoint

Published SEO sites are rebuilt on the VPS after the Firebase Function has saved the complete SEO payload in Firestore.

```bash
curl -X POST http://127.0.0.1:3100/internal/rebuild-site \
  -H "Authorization: Bearer $SEO_GATEWAY_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domain":"aroi-d.madkontrollen.dk","reason":"publish"}'
```

Expected physical output:

```bash
public/sites/aroi-d.madkontrollen.dk/index.html
public/sites/aroi-d.madkontrollen.dk/robots.txt
public/sites/aroi-d.madkontrollen.dk/sitemap.xml
```

The token must match the server-side Firebase Functions config. The browser must never receive this token.

Configure Functions with either a full rebuild URL:

```bash
firebase functions:config:set seo_gateway.rebuild_url="https://YOUR-GATEWAY/internal/rebuild-site" seo_gateway.internal_token="YOUR-LONG-RANDOM-TOKEN"
```

or a base URL:

```bash
firebase functions:config:set seo_gateway.base_url="https://YOUR-GATEWAY" seo_gateway.internal_token="YOUR-LONG-RANDOM-TOKEN"
```

## DNS Wildcard

Create or verify:

```text
*.madkontrollen.dk A 46.62.246.141
```

DNS must point to the VPS before public wildcard subdomains can resolve.

## HTTPS

Decide certificate strategy before production traffic:

- wildcard certificate for `*.madkontrollen.dk`
- or a Certbot DNS validation strategy supported by the DNS provider

Do not rely on HTTP-only traffic for production.

## Notes

- The gateway serves physical files first from `public/sites/{host}/`.
- The internal rebuild endpoint writes `index.html`, `robots.txt`, and `sitemap.xml` under `public/sites/{domain}/` on the VPS.
- The older Firestore renderer remains as fallback for non-file legacy routes.
- Cache keys include route type plus `publishVersion`, `version`, or a Firestore timestamp from the website document when available.
- Cache TTL defaults to 300 seconds.
- Add `?preview=1` or `?nocache=1` to bypass in-memory cache.
- The gateway writes physical SEO files on rebuild. It does not deploy Firebase Hosting.
- `server/seed-seo-test-site.js` is dev-only and requires `SEO_GATEWAY_ALLOW_DEV_SEED=1`.
- Do not run the seed script against production unless you intentionally want the test documents.
