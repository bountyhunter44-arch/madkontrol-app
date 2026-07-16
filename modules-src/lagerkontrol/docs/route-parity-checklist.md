# Lagerkontrol Route Parity Checklist

Status: Fase 1C staging read-only shell parity.

Use this checklist before copying any live route into the closed Lagerkontrol module. Live runtime remains `public/modules/lagerkontrol`.

## Fase 1C shell status

| Route | Staging shell oprettet | parityStatus | Writes disabled | Næste trin |
| --- | --- | --- | --- | --- |
| `bilag.html` | ja | readonly-list | ja | read-only data binding for `varemodtagelse.html` |
| `dashboard.html` | ja | readonly-summary | ja | read-only data binding for `varer.html` |
| `index.html` | ja | shell-only | ja | read-only data binding |
| `optaelling.html` | ja | shell-only | ja | read-only data binding |
| `presentation.html` | ja | shell-only | ja | read-only data binding |
| `rapporter.html` | ja | shell-only | ja | read-only data binding |
| `settings.html` | ja | shell-only | ja | read-only data binding |
| `supplier-import.html` | ja | shell-only | ja | read-only data binding |
| `svind.html` | ja | shell-only | ja | read-only data binding |
| `varebibliotek.html` | ja | shell-only | ja | read-only data binding |
| `varemodtagelse.html` | ja | shell-only | ja | read-only data binding |
| `varer.html` | ja | readonly-list | ja | read-only data binding for `bilag.html` or `varemodtagelse.html` |

## `bilag.html`

- Formål: Upload og vis leverandørbilag til lagerdokumentation eller fremtidig bogføring.
- Primære data: supplier documents, file metadata, booking status, OCR status.
- Firestore collections: `companies/{companyId}/supplier_documents`.
- Callables: none for upload flow; `lagerProcessSupplierDocument` may be triggered from document handling and must stay disabled in read-only staging.
- Writes: ja i live runtime.
- Staging shell oprettet: ja.
- parityStatus: readonly-list.
- Writes disabled i staging: ja.
- Datafelter vist i staging: dokumentnavn, leverandør, dokumenttype, dato, totalbeløb, momsbeløb, bogføringsstatus, kilde, oprettet/dokumentdato og OCR-status.
- Næste trin: read-only data binding for `varemodtagelse.html`.
- Skal med i ny web-app: ja.
- Skal med i APK: ja, især kamera/upload.
- Afhængigheder: Firebase Auth, Storage, audit fields, platform context, future Bogføring contract.
- Testkriterier: read-only shell lists existing documents without upload/write buttons enabled.

## `dashboard.html`

- Formål: Overblik over lagerstatus, KPI'er, bevægelser, lav lagerstand og hurtige handlinger.
- Primære data: items, movements, receipts, spillage, counts, reports, pricing indexes.
- Firestore collections: `inventory_items`, `inventory_movements`, `goods_receipts`, `inventory_spillage`, `inventory_counts`, `inventory_reports`, `pricing_indexes`.
- Callables: none.
- Writes: nej for ren visning, men live dashboard linker til write-flows.
- Staging shell oprettet: ja.
- parityStatus: readonly-summary.
- Writes disabled i staging: ja.
- Dataområder vist i staging: antal varer, aktive partier, seneste optællinger, seneste varebevægelser, seneste leverandørbilag, seneste varemodtagelser.
- Næste trin: read-only data binding for `varer.html`.
- Skal med i ny web-app: ja.
- Skal med i APK: ja.
- Afhængigheder: platform context, auth, normalized inventory quantities.
- Testkriterier: dashboard kan renderes read-only uden at oprette eller ændre data.

## `index.html`

- Formål: Modulentry/landing for Lagerkontrol runtime.
- Primære data: module shell state and route navigation.
- Firestore collections: same read model as dashboard once mounted.
- Callables: none.
- Writes: nej for entry alene.
- Staging shell oprettet: ja.
- parityStatus: shell-only.
- Writes disabled i staging: ja.
- Næste trin: read-only data binding.
- Skal med i ny web-app: ja.
- Skal med i APK: ja.
- Afhængigheder: CSS, JS app shell, platform context.
- Testkriterier: opens shell, resolves read-only adapter status and does not call production writes.

## `optaelling.html`

- Formål: Lageroptælling.
- Primære data: inventory counts, items, movement comparison.
- Firestore collections: `inventory_counts`, `inventory_items`, `inventory_movements`.
- Callables: none.
- Writes: ja i live runtime.
- Staging shell oprettet: ja.
- parityStatus: shell-only.
- Writes disabled i staging: ja.
- Næste trin: read-only data binding.
- Skal med i ny web-app: ja.
- Skal med i APK: ja.
- Afhængigheder: platform context, audit fields, inventory quantity normalization.
- Testkriterier: read-only version shows existing counts and disables submit.

## `presentation.html`

- Formål: Produktpræsentation og CTA til onboarding eller åbning af modulet.
- Primære data: static product copy, links.
- Firestore collections: none.
- Callables: none.
- Writes: nej.
- Staging shell oprettet: ja.
- parityStatus: shell-only.
- Writes disabled i staging: ja.
- Næste trin: read-only data binding.
- Skal med i ny web-app: ja, eventuelt i platform/showroom i stedet.
- Skal med i APK: nej.
- Afhængigheder: assets, onboarding link, module showcase.
- Testkriterier: links peger til godkendt platform launcher/onboarding, ikke gammel skjult dependency.

## `rapporter.html`

- Formål: Lager- og bevægelsesrapporter.
- Primære data: movements, reports, items, spillage, receipts.
- Firestore collections: `inventory_reports`, `inventory_movements`, `inventory_items`, `inventory_spillage`, `goods_receipts`.
- Callables: none.
- Writes: nej for visning; ja hvis rapport-snapshot gemmes i senere version.
- Staging shell oprettet: ja.
- parityStatus: shell-only.
- Writes disabled i staging: ja.
- Næste trin: read-only data binding.
- Skal med i ny web-app: ja.
- Skal med i APK: måske, primært read-only.
- Afhængigheder: platform context, report formatting.
- Testkriterier: read-only rapporter kan åbnes uden snapshot writes.

## `settings.html`

- Formål: Modulindstillinger, pricing indexes and future location settings.
- Primære data: inventory settings, pricing indexes.
- Firestore collections: `inventory_settings`, `pricing_indexes`.
- Callables: none.
- Writes: ja i live runtime for settings/indexes.
- Staging shell oprettet: ja.
- parityStatus: shell-only.
- Writes disabled i staging: ja.
- Næste trin: read-only data binding.
- Skal med i ny web-app: ja.
- Skal med i APK: måske.
- Afhængigheder: platform context, roles/admin access.
- Testkriterier: read-only staging shows settings and disables save.

## `supplier-import.html`

- Formål: Import af grossistkatalog fra CSV/Excel.
- Primære data: supplier profiles, catalog items, catalog imports.
- Firestore collections: `supplier_profiles`, `supplier_catalog_items`, `supplier_catalog_imports`.
- Callables: none in current import; future parser may be backend.
- Writes: ja i live runtime.
- Staging shell oprettet: ja.
- parityStatus: shell-only.
- Writes disabled i staging: ja.
- Næste trin: read-only data binding.
- Skal med i ny web-app: ja.
- Skal med i APK: nej eller senere.
- Afhængigheder: XLSX parser, platform context, audit fields.
- Testkriterier: read-only staging can preview route contract but cannot import/write.

## `svind.html`

- Formål: Registrering og visning af svind.
- Primære data: spillage, items, movements.
- Firestore collections: `inventory_spillage`, `inventory_items`, `inventory_movements`.
- Callables: none.
- Writes: ja i live runtime.
- Staging shell oprettet: ja.
- parityStatus: shell-only.
- Writes disabled i staging: ja.
- Næste trin: read-only data binding.
- Skal med i ny web-app: ja.
- Skal med i APK: ja.
- Afhængigheder: normalized quantities, audit fields, platform context.
- Testkriterier: existing waste entries visible; registration disabled in read-only.

## `varebibliotek.html`

- Formål: Globalt varebibliotek og kopiering til virksomhedens lager.
- Primære data: global catalog, inventory items.
- Firestore collections: `global_inventory_catalog`, `companies/{companyId}/inventory_items`.
- Callables: none.
- Writes: ja i live runtime when adding to local inventory.
- Staging shell oprettet: ja.
- parityStatus: shell-only.
- Writes disabled i staging: ja.
- Næste trin: read-only data binding.
- Skal med i ny web-app: ja.
- Skal med i APK: ja.
- Afhængigheder: global catalog access, platform context.
- Testkriterier: read-only catalog loads; add-to-inventory disabled.

## `varemodtagelse.html`

- Formål: Modtag varer, opret batches, upload dokumentation and append movement.
- Primære data: items, batches, receipts, documents, movements.
- Firestore collections: `inventory_items`, `inventory_batches`, `goods_receipts`, `supplier_documents`, `inventory_movements`.
- Callables: none for base save; document processing may later use `lagerProcessSupplierDocument`.
- Writes: ja i live runtime.
- Staging shell oprettet: ja.
- parityStatus: shell-only.
- Writes disabled i staging: ja.
- Næste trin: read-only data binding.
- Skal med i ny web-app: ja.
- Skal med i APK: ja.
- Afhængigheder: Storage, audit fields, normalized quantity, optional Egenkontrol API/event metadata.
- Testkriterier: read-only staging displays route and disables receipt/upload writes.

## `varer.html`

- Formål: Vareoprettelse og vedligeholdelse af lageritems.
- Primære data: inventory items, categories, suppliers.
- Firestore collections: `inventory_items`.
- Callables: none.
- Writes: ja i live runtime.
- Staging shell oprettet: ja.
- parityStatus: readonly-list.
- Writes disabled i staging: ja.
- Datafelter vist i staging: varenavn, kategori, enhed, beholdning, minimumsbeholdning, kostpris, salgspris, aktiv/inaktiv status.
- Næste trin: read-only data binding for `bilag.html` eller `varemodtagelse.html`.
- Skal med i ny web-app: ja.
- Skal med i APK: ja.
- Afhængigheder: platform context, audit fields, inventory quantity normalization.
- Testkriterier: existing items visible; create/edit disabled in read-only.
