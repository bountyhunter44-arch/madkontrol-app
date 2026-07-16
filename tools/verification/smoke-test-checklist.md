# Smoke Test Checklist

Use this after local changes and again after deploy.

## Common Frontend

- Test active production entrypoints only:
  - `module.json` entrypoints.
  - platform app-registry entrypoints.
  - live navigation/sidebar/header links.
  - known production pages listed in the module documentation.
- Do not report legacy/test files as critical production failures unless active navigation references them.
- Ignore these production smoke-test paths/patterns:
  - `legacy/*`
  - `test/*`
  - `backup/*`
  - `old/*`
  - `*-v2.html`
- Route returns HTTP 200.
- Page loads without blank screen.
- Browser console has no boot-stopping errors.
- Mobile width around 390px has no horizontal overflow.
- Primary buttons wrap correctly.
- Loading, empty, and error states are readable.

## Auth And Context

- Logged-in user resolves `uid`.
- `companyId` resolves.
- `locationId` resolves.
- Role and enabled apps are available where required.
- Missing context shows a user-facing empty state, not raw JSON.

## Data

- Create one record.
- Edit the record.
- Toggle active/inactive if supported.
- Delete the record or archive it safely.
- Verify Firestore document scope includes `companyId` and `locationId`.
- Verify no oversized blobs, raw API responses, or base64 payloads are stored.

## Egenkontrol

- Active entrypoint: `/modules/egenkontrol/front.html`.
- Active routine page: `/modules/egenkontrol/rutiner.html`.
- Active unit page: `/modules/egenkontrol/units.html`.
- Active report page: `/modules/egenkontrol/rapporter.html`.
- Check `public/modules/egenkontrol/controlLibraryOperational.js` with `node --check`.
- Do not treat `/modules/egenkontrol/legacy/rutiner-v2.html` as an active production error.

## Ordering Modules

- Active items are visible.
- Inactive items are hidden from customer ordering.
- Add-ons calculate subtotal correctly.
- Cart line can be removed.
- No payment is triggered unless explicitly in scope.

## SEO / Gateway

- Root page returns 200.
- `robots.txt` returns 200.
- `sitemap.xml` returns 200.
- CSS/assets load from correct relative path.
- VPS fallback/cache behavior is logged when relevant.
