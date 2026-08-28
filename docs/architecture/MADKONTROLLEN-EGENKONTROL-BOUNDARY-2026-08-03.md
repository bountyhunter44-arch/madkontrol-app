# Madkontrollen module-boundary (2026-08-03)

## Autoritativ afgrænsning
- **EWCP** (ewcp.dk) er platform + salgssted for de forskellige EWCP-produkter (modulmarked + separat Stripe pr. modul).
- **Madkontrollen** ER ét EWCP-produkt: **Egenkontrol**.
- Reglen gælder **`public/modules/`** (offentlig produktkode) — IKKE `functions/modules/` (backendens tekniske
  kodeorganisering; Stripe/provisioning/webhook forbliver urørt).
- Mål: `public/modules/` må kun indeholde `egenkontrol/`.

## Gennemført i denne omgang (FASE 0–5) — verificeret, ikke-destruktivt
1. **i18n flyttet**: `public/modules/i18n/ → public/i18n/` (git mv). Importører opdateret:
   `public/modules/egenkontrol/rutiner.html`, `public/modules/egenkontrol/riskAnalysisHtmlRenderer.js`,
   `public/core/i18n.js`, `public/dashboard.html`. 0 tilbageværende `/modules/i18n/`-referencer. `node --check` OK.
2. **Billedarkiv flyttet**: `public/modules/core/billed-arkiv.html → public/core/billed-arkiv.html` (git mv).
   Opdateret: `public/core/layout.js`, `public/components/sidebar.html`. 0 tilbageværende blivende-kode-referencer.
3. **Egenkontrol gjort selvstændig**: fjernet 2 legacy/ikke-egenkontrol-sider med søskende-modul-links
   (`egenkontrol/front.html` = "Madkontrollen Pro Demo", 301-redirectet til `/`; `egenkontrol/akademi.html` = promo
   for det fjernede akademi-modul). 0 søskende-modul-links i egenkontrol nu.
4. **Forsiden repositioneret** (`public/index.html`): fjernet `module-preview-links`-sektionen (previews til
   kalkulation/POS/lagerkontrol/menu/seo/koerselskontrol/drift) + fjernet "Modulplatform"-titel/meta →
   single-product egenkontrol-positionering. Quick onboarding-CTA'er (9) + loginmodal bevaret.
5. **Sitemap renset** (`public/sitemap.xml`): fjernet modul-URL'er (pos/lagerkontrol/accounting/seo). Ingen onboarding
   i sitemap. Onboarding-sider forbliver `noindex,follow`.

## BLOKKER — FASE 6 (fjernelse af produktmapper) STOPPET (rule 14: uventet aktiv afhængighed)
Ud over forsiden **refererer app-shell-navigationen + EWCP-platform-registrene stadig aktivt** til de fjernbare
moduler. Fjernelse af mapperne nu ville efterlade dangling nav-links + bryde app-shell/registre, og kan ikke
runtime-verificeres (dashboard/layout kræver Firebase-auth). Konkrete aktive afhængigheder:

| Fil | Reference | Type |
|---|---|---|
| `public/core/layout.js` | `/modules/seo/generator.html`, `/modules/drift/menu.html`, `/modules/kalkulation/index.html` | app top-nav |
| `public/components/sidebar.html` | `/modules/drift/*`, `/modules/kalkulation/index.html` | app sidebar-nav |
| `public/components/header.html` | `/modules/drift/menu.html` | app header-nav |
| `public/components/module-lock.js` | pos/lagerkontrol/accounting landing/entry | modul-lås-register |
| `public/core/onboarding-module-registry.js` | lagerkontrol/koerselskontrol/seo/menu/kalkulation/accounting | onboarding-modulregister |
| `public/platform/app-registry.js` | alle moduler (entry/fallback/presentation) | platform-modulkatalog |
| `public/platform/module-showcase.js` | alle moduler (landing/entry) | platform-showcase |
| `public/core/billed-arkiv.html` | `/modules/accounting/bilag-historik.html` | delt billedarkiv (accounting-assets) |
| `public/apps/menu/module.json` | `/modules/drift/drift.js` | menu-app-config |

## Resterende arbejde (kræver separat, testbar sub-opgave + GO)
1. Refaktorér app-shell-nav (layout.js, sidebar.html, header.html) → kun egenkontrol.
2. Reducér/fjern platform-modulregistrene (app-registry.js, module-showcase.js, module-lock.js,
   onboarding-module-registry.js) til egenkontrol-only — dette er reelt EWCP-platform-katalog, som hører til ewcp.dk.
3. Fjern accounting-grenen i `public/core/billed-arkiv.html` (eller behold billedarkiv egenkontrol-only).
4. Bekræft `public/apps/` (menu-app) grænse.
5. FØRST DEREFTER: fjern de 11 produktmapper (accounting, bogfoering, business, crm, drift, kalkulation,
   koerselskontrol, lagerkontrol, menu, pos, seo) + `public/modules/core/` (leftover index.html), med
   0-reference-verifikation + auth-runtime-test.
6. Tilføj `tests/madkontrollen-module-boundary.test.mjs` (`assert.deepEqual(moduleDirectories, ["egenkontrol"])`).

## Build-spejle
`public/` er source of truth. `functions/public/*` + `android/.../assets/public/*` er build-/bundle-spejle
(regenereres ved næste godkendte sync/deploy) — redigeres IKKE manuelt. `functions/modules/` er urørt.
