# Onboarding — Registry

## Active onboarding = Quick Onboarding
- **Frontend:** `public/quick-onboarding.html`
- **Shared frontend component:** `public/modules/egenkontrol/egenkontrol-onboarding.js` +
  `public/modules/egenkontrol/egenkontrol-onboarding.css`
- **Backend (callable/provisioning):**
  - `createOnboardingCheckoutSession` (functions/modules/provisioning/index.js)
  - `finalizeOnboardingCheckoutProvisioning` (functions/index.js)
- **Module provisioners (backend):** `functions/modules/onboarding/moduleProvisioners.js`
  (`MODULE_PROVISIONERS`, `runModuleProvisioners`, `provisionEgenkontrolModule`)
- **Price presentation:** 149 kr./md. ekskl. moms, or 1.609,20 kr./year ekskl. moms
  with 10 % annual discount. Stripe remains the source of the charged amount.

## Deprecated — DO NOT use as active source
- `public/onboarding.html`
- `public/modules/egenkontrol/onboarding.html` (legacy egenkontrol onboarding)
- Any `*-v2`/experimental onboarding pages (e.g. removed `rutiner-v2.html`).
> Deprecated onboarding must not be treated as the active flow. Active = Quick Onboarding only.

## Egenkontrol onboarding MUST
1. **Create equipment records FIRST** (`buildEquipmentFromSetup` → deterministic unit ids,
   e.g. `Køleskab 1`, `Køleskab 2`, `Fryser 1`).
2. **Generate routines/templates per concrete equipment unit** (via `generateCanonicalTaskTemplates`,
   filtered by `routineKeys`). Never generic cold/freezer without a unit.
3. **Avoid duplicates** — merge writes on deterministic doc ids (idempotent re-runs).
4. **Use deterministic seedKey/docId** (`buildCanonicalTemplateId`, `${companyId}__${locationId}__…`).

## Active flow shape
1. Virksomhed → 2. Enheder og aktiviteter → 3. Risikoprofil → 4. Gennemse og betal
→ Stripe Checkout → `tak.html` → finalisering og dashboard.
- Quick Onboarding provisions Madkontrollen Egenkontrol only; it has no module selector.
- Checkout payload keeps `selectedModules: ["egenkontrol"]` for backend compatibility.

## No-go
- No generic cold/freezer routines without equipment (see `egenkontrol.registry.md`).
- No duplicate seed/import.
- Do not couple all modules to the egenkontrol flow; use `MODULE_PROVISIONERS` map (no scattered ifs).
