# Lagerkontrol Migration Notes

Status: Fase 1A staging. No live runtime changes.

## Existing live runtime found

Current Lagerkontrol files:

```text
public/modules/lagerkontrol/bilag.html
public/modules/lagerkontrol/dashboard.html
public/modules/lagerkontrol/index.html
public/modules/lagerkontrol/lagerkontrol.css
public/modules/lagerkontrol/lagerkontrol.js
public/modules/lagerkontrol/module.json
public/modules/lagerkontrol/optaelling.html
public/modules/lagerkontrol/presentation.html
public/modules/lagerkontrol/rapporter.html
public/modules/lagerkontrol/README.md
public/modules/lagerkontrol/settings.html
public/modules/lagerkontrol/supplier-import.html
public/modules/lagerkontrol/svind.html
public/modules/lagerkontrol/varebibliotek.html
public/modules/lagerkontrol/varemodtagelse.html
public/modules/lagerkontrol/varer.html
public/modules/lagerkontrol/verification.md
```

Related legacy Lager files:

```text
public/modules/lager/dashboard.html
public/modules/lager/index.html
public/modules/lager/profit-dashboard.html
public/modules/lager/scanner.html
```

## Related helpers found

```text
public/core/firebase-config.js
public/core/auditFields.js
public/core/inventory-quantity.js
public/platform/context-provider.js
public/core/module-access.js
public/platform/module-showcase.js
public/platform/app-registry.js
```

## Existing backend status

No dedicated backend folder exists yet:

```text
functions/lagerkontrol              missing
functions/modules/lagerkontrol      missing
```

Current live callable is referenced from frontend:

```text
lagerProcessSupplierDocument
```

## What may be copied later

Later phases may copy or port:

- UI views from `public/modules/lagerkontrol/*.html`
- styling from `lagerkontrol.css`
- domain logic from `lagerkontrol.js`
- current `module.json` metadata
- verification notes

Copying must happen into a clean module source with parity checks, not by deleting live routes.

## What must not be touched now

- `public/modules/lagerkontrol` live runtime
- `public/modules/lager` legacy runtime
- `functions/index.js`
- Egenkontrol runtime
- POS project
- Stripe/payment flows
- Firestore rules
- hosting deploy

## Risks

- Live Lagerkontrol currently imports platform/core helpers directly.
- Live Lagerkontrol writes directly to Firestore and Storage.
- Some data is company-scoped, while future standalone modules may need location-scoped collections.
- `moduleKey` in live `module.json` is `lagerkontrol-pro`, while platform entitlement key appears to be `lagerkontrol`.
- Legacy `public/modules/lager` uses root `inventory_items` and `inventory_transactions`, which differs from Lagerkontrol Pro's company-scoped contract.
- Bogføring, Menu, POS and Egenkontrol integration language exists in UI/metadata, but should become API/event contracts before real coupling.

## Next steps for Fase 1B

1. Decide stable entitlement key: `lagerkontrol`.
2. Write a Lagerkontrol parity checklist from current live routes.
3. Define platform adapter implementation without production writes.
4. Create a read-only Firestore adapter against staging/emulator or mocked data.
5. Plan backend extraction for `lagerProcessSupplierDocument`.
6. Keep compatibility route `/modules/lagerkontrol/index.html` until the standalone app is proven.

## Fase 1B - staging read-only

Entitlement key is now fixed:

```text
lagerkontrol
```

Staging adapters are read-only:

- `src/adapters/platform-context-adapter.js`
- `src/adapters/firestore-adapter.js`
- `src/adapters/functions-adapter.js`

The adapters do not import production Firebase, do not write to Firestore, do not upload to Storage and do not call production callable functions by default.

Live runtime is not changed:

```text
public/modules/lagerkontrol/
```

Next phase should be either:

- route-for-route read-only copying into the new module source, or
- a module shell that mounts read-only route stubs and verifies parity before any production integration.

Production writes may only be enabled after a separate API approval and backend access review.

## Fase 1C - route-for-route shell parity

Route-for-route staging shells are now created under:

```text
modules-src/lagerkontrol/public/
```

Routes covered:

```text
bilag.html
dashboard.html
index.html
optaelling.html
presentation.html
rapporter.html
settings.html
supplier-import.html
svind.html
varebibliotek.html
varemodtagelse.html
varer.html
```

Shared metadata lives in:

```text
modules-src/lagerkontrol/src/routes/route-registry.js
```

Shared route rendering lives in:

```text
modules-src/lagerkontrol/src/components/route-shell.js
```

No live runtime changed. No production writes are enabled. No production callable or Storage integration is active in the staging shell.

Next phase is read-only data binding one route at a time, starting with a low-risk route such as `dashboard.html` or `varer.html`.

## Fase 1D - dashboard read-only data binding

`dashboard.html` now has a read-only summary binding in staging.

Implemented staging-only files:

```text
src/services/dashboard-service.js
src/components/dashboard-view.js
```

The dashboard summary shows:

- item count
- active batch count
- recent inventory counts
- recent inventory movements
- recent supplier documents
- recent goods receipts
- read-only warnings

The dashboard uses the read-only Firestore adapter. If no safe platform context or read client exists, it falls back to an empty staging summary instead of crashing.

No live runtime changed. No production writes are enabled. No callable writes are enabled. No Storage upload is enabled.

Recommended next route for Fase 1E:

```text
varer.html
```

## Fase 1E - varer read-only data binding

`varer.html` now has a read-only item list binding in staging.

Implemented staging-only files:

```text
src/services/items-service.js
src/components/items-view.js
```

The item list shows:

- item name
- category
- unit
- quantity/current stock when available
- minimum quantity/par level when available
- cost price when available
- sales price when available
- active/inactive status
- read-only warnings

The page uses the read-only Firestore adapter. If no safe platform context or read client exists, it falls back to an empty staging item list instead of crashing.

No live runtime changed. No production writes are enabled. No callable writes are enabled. No Storage upload is enabled.

Recommended next route for Fase 1F:

```text
bilag.html
```

Alternative if receipt flow should be mapped first:

```text
varemodtagelse.html
```

## Fase 1F - bilag read-only data binding

`bilag.html` now has a read-only supplier document list binding in staging.

Implemented staging-only files:

```text
src/services/documents-service.js
src/components/documents-view.js
```

The document list shows:

- document name or filename
- supplier
- document type
- document date or created date
- total amount
- VAT amount
- booking status
- source
- OCR status
- read-only warnings

Upload, OCR and bookkeeping actions are rendered only as disabled/inert controls.

The page uses the read-only Firestore adapter. If no safe platform context or read client exists, it falls back to an empty staging document list instead of crashing.

No live runtime changed. No production writes are enabled. No callable writes are enabled. No Storage upload is enabled.

Recommended next route for Fase 1G:

```text
varemodtagelse.html
```
