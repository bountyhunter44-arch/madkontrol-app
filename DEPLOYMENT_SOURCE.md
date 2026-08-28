# Deployment source of truth

**This repo (`madkontrollen-web`) is the HOSTING source for `madkontrollen.dk` (Firebase site `madkontrollen`).**

Firebase project: `madkontrollen`. Hosting target `madkontrollen` → site `madkontrollen` (see `.firebaserc`).

## Role split

| Concern | Source repo | Deploy |
|---|---|---|
| **Hosting** (`public/`) | **`madkontrollen-web`** (this repo) | `firebase deploy --only hosting --project madkontrollen` |
| **Cloud Functions / backend** | `../madkontrollen-canonical` | `firebase deploy --only functions:<names> --project madkontrollen` |

Deploy **Hosting only** from here. Deploy **Functions only** from `madkontrollen-canonical`.
Do **not** deploy Hosting from `madkontrollen-canonical` — its `public/` is a recovery-union
superset that diverges destructively from live (would delete ~27 live files and publish
unapproved/Regnskab module pages).

## Verified against live (2026-08-13, read-only)

- Full live file manifest pulled via Hosting REST API (`sites/madkontrollen/versions/<v>/files`).
- `live \ web = 0` — every live file exists in this repo (a Hosting deploy removes nothing).
- `web \ live = 2` — only `public/admin/cvr-identity.js` and `public/core/module-pricing.js`
  are in this repo but not yet live (they would go live on the next Hosting deploy).
- SHA-256 of representative files (local vs. raw live bytes) match exactly:
  `index.html`, `i18n/da.js`, `funktioner/digital-egenkontrol.html`, `css/feature-pages.css`,
  `platform/module-showcase.js`, `firebase-config.json`, `images/aroi-d-logo.png`.

## SSO note

The Regnskab SSO backend functions (`startRegnskabSso`, `redeemRegnskabSsoCode`) live in and are
deployed from `madkontrollen-canonical` (fail-closed / inactive until EWCP Regnskab is ready).
The SSO client pages (`/sso/`, `/vendor/`) are **not** in this repo yet and must be added here
(not in canonical) when SSO is taken live — under separate approval.
