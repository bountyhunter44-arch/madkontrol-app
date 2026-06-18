# Onboarding — Registry

## Active onboarding = Quick Onboarding
- **Frontend:** `public/quick-onboarding.html`
- **Backend (callable/provisioning):**
  - `createQuickOnboardingAccount` (functions/index.js)
  - `completeQuickOnboarding` (functions/index.js)
  - `finalizeOnboardingCheckoutProvisioning` (functions/index.js)
- **Module registry (frontend):** `public/core/onboarding-module-registry.js`
- **Module provisioners (backend):** `functions/modules/onboarding/moduleProvisioners.js`
  (`MODULE_PROVISIONERS`, `runModuleProvisioners`, `provisionEgenkontrolModule`)

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

## Flow shape (target)
1. Basis virksomhed/CVR → 2. Modulvalg → 3. Dynamiske setup-steps for valgte moduler
→ 4. Opsummering → 5. Checkout/provisionering → 6. Tak/finalisering.
- Module selection drives which setup steps show; egenkontrol setup only shown if egenkontrol selected.
- Draft schema: `selectedModules: string[]`, `moduleSetup: { egenkontrol?: {...}, pos?: {...}, ... }`.

## No-go
- No generic cold/freezer routines without equipment (see `egenkontrol.registry.md`).
- No duplicate seed/import.
- Do not couple all modules to the egenkontrol flow; use `MODULE_PROVISIONERS` map (no scattered ifs).
