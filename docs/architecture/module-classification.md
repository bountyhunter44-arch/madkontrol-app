# Madkontrollen Module Classification

Status: audit- og planlægningsdokument. Ingen runtime-filer er flyttet i denne fase.

## Formål

Madkontrollen skal være platform/showroom/køb/adgang. De enkelte moduler skal på sigt være lukkede produkter med egen web-runtime, egne assets, egne tests og eventuelt egen APK. POS er reference for den model.

Denne klassifikation beskriver hvad der ligger i `public/modules` i dag, hvad der er produkt, hvad der er platform, og hvad der bør behandles som arkiv/eksperiment indtil det er afklaret.

## Audit: public/modules

| Mappe | Aktuelle entry-filer | Backend/callables eller Firestore-signaler fundet | Direkte Egenkontrol-kobling | Klassifikation |
| --- | --- | --- | --- | --- |
| `account` | `data-export.html`, `index.html` | `export_audits`; data-export læser også Egenkontrol-data som eksport | Ja | Platform/service |
| `accounting` | Bilag-/bogføringsflader, `presentation.html`, `module.json` | Ingen callable fundet i audit | Svag/tekstlig | Produkt: Bogføringsappen |
| `admin` | `control-center.html`, `index.html` | Bruger core auth/layout; linker bl.a. myndighedsrapport | Ja | Platform/admin |
| `akademi` | Kurser/certifikater/staff/quizzes | Ingen callable fundet | Ja | Senere/arkiv |
| `akademi.html` | Dublet-lignende akademi-mappe | Ingen callable fundet | Ja | Arkiv/dublet, manuel vurdering |
| `bogfoering` | `index.html` | Ingen callable fundet | Nej | Produkt-alias til `accounting` |
| `business` | `index.html`, `vision.html` | `createStripeCheckoutSession` | Ja | Platform/checkout/showroom |
| `core` | `billed-arkiv.html`, `index.html` | `media_assets` | Ja | Platform/shared |
| `crm` | `index.html`, prospects/CVR enrichment | `createOnboardingCheckoutSession`, `enrichNextCvrBatch`; `prospects`, `cvr_enrichment_jobs` | Ja, bl.a. checkout cancel til Egenkontrol onboarding | Produktkandidat, men afhængigheder skal isoleres |
| `drift` | Menu/indkøb/opskrifter/leverandører/events | Ingen callable fundet | Ja | Overlap med Menu, manuel vurdering |
| `egenkontrol` | Mange runtime-filer inkl. `rutiner.html`, `rapporter.html` | `saveRoutineTask`, `startDayForLocation`, `pauseEgenkontrolRoutine`, `reactivateEgenkontrolRoutine`, process/report/risk callables; `task_entries`, `task_instances`, `task_templates`, `daily_runs`, `reports`, `deviations`, m.fl. | Selve modulet | Beskyttet eksisterende produkt/runtime |
| `i18n` | Sproghelpers | Ingen callable fundet | Tekstlig | Platform/shared |
| `kalkulation` | `index.html`, beregnings-JS | Ingen callable fundet | Ja | Produktkandidat, senere fase |
| `koerselskontrol` | `index.html`, `konto.html` | Ingen callable fundet | Nej | Produktkandidat, senere fase |
| `lager` | Dashboard/scanner/profit-dashboard | `inventory_items`, `inventory_transactions`, `deviations` | Nej | Legacy/forløber til Lagerkontrol |
| `lagerkontrol` | Fuldt modul med `module.json`, `lagerkontrol.js`, CSS, presentation og flere views | `lagerProcessSupplierDocument`; company-scopede lagercollections | HACCP-felter, men ikke runtime-afhængig af Egenkontrol | Produkt: første migrationskandidat |
| `local-events` | Modal/admin/event note, `module.json` | Ingen callable fundet | Nej | Senere/feature-modul |
| `menu` | Menu/recipes/ingredients/suppliers/events + AI/allergen helpers | `getCloudinarySignature` via menu AI image helper | Ja, event-side linker til Egenkontrol | Produkt: Menu/QR efter afkobling |
| `platform` | `unified-core.html`, schema | Ingen callable fundet | Nej | Platform/shared |
| `pos` | POS runtime, product CRUD, payments, `module.json` | Zettle/payment/image callables; `companies/{companyId}/locations/{locationId}/pos_*` | Nej | Referenceprodukt; skal ikke flyttes fra `D:\madkontrol-pos` i denne plan |
| `projectbase` | Projektstatus | Ingen callable fundet | Ja | Arkiv/intern dokumentation |
| `sensorer` | Sensorer | Ingen callable fundet | Nej | Senere/produktkandidat |
| `seo` | SEO generator, dashboard, site builder, reports | Mange SEO/Cloudinary/Stripe callables; `seo_generator_configs` | Enkel bundling-reference til `activeModules.includes("egenkontrol")` | Produkt: SEO Automatik |
| `skole` | Skole/akademi | Ingen callable fundet | Ja | Senere/arkiv |
| `storage` | `index.html` | Ingen callable fundet | Nej | Platform/shared eller arkiv |
| `vedligehold` | Vedligehold | Ingen callable fundet | Nej | Senere/produktkandidat |
| `water` | Dashboard/production/systems/technician | Water callables; `water_systems`, `water_production`, `water_sales` | Nej | Senere/produktkandidat |

## Backend-status

`functions/modules` indeholder i dag kun:

- `admin`
- `egenkontrol`
- `pos`

`functions/index.js` eksporterer stadig mange moduler og platformflows direkte, blandt andet:

- Egenkontrol callables og processer
- Quick onboarding og Stripe checkout
- SEO callables
- Water via `Object.assign(exports, require("./water-module"))`
- POS via `Object.assign(exports, require("./modules/pos"))`

Før moduler bliver helt lukkede, skal nye backend-flows ligge under modulernes egne mapper og eksporteres via en tynd eksplicit modul-entry. `functions/index.js` må være router/entrypoint, ikke modulernes source of truth.

## Produktmoduler

Disse skal behandles som selvstændige produkter:

- POS, reference og eksisterende separat projekt: `D:\madkontrol-pos`
- Lagerkontrol
- Bogføringsappen (`accounting`/`bogfoering`)
- Egenkontrol
- Menu/QR
- SEO Automatik

Disse er produktkandidater, men kræver særskilt afklaring:

- CRM
- Kalkulation
- Kørselskontrol
- Water
- Sensorer
- Vedligehold
- Local events

## Platform/shared

Følgende skal blive i platformen eller udskilles som fælles SDK/helpers:

- Auth, Firebase config og session
- Company/location context
- Entitlements/module access
- Dashboard/launcher
- Quick onboarding/checkout
- Module showcase/registry/pricing
- Shared layout indtil modulerne har egen shell
- Adminflader
- Billedarkiv/media service, hvis flere moduler bruger samme asset-lager

## Arkiv eller manuel vurdering

Følgende bør ikke løftes som produkt uden særskilt audit:

- `akademi.html` som ligner dublet af `akademi`
- `projectbase`
- ældre `lager` efter Lagerkontrol er stabil reference
- overlappet mellem `drift` og `menu`
- skole/akademi-varianter, indtil produktgrænse er besluttet

## Første migrationskandidat

`lagerkontrol` er bedst som første ikke-POS kandidat, fordi den allerede har:

- samlet modulmappe
- `module.json`
- separat JS/CSS
- tydelig presentation-side
- platform-context import
- afgrænset primær callable: `lagerProcessSupplierDocument`

Den har dog stadig direkte imports fra `/core` og `/platform`, og den skriver/læser direkte i Firestore. Det skal kapsles bag en modulkontrakt før den flyttes til et separat projekt.
