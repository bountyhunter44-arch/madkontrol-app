# Refaktorering af functions/index.js → transport-only

**Mål:** `index.js` bliver `require` + `exports.x = x`, ingen domænelogik. Håndhævet af
`index.transport.test.js` (kopieret fra `madkontrollen-accounting`). Mønster: lagerkontrols
hexagonale — hver funktion i egen fil, delte helpers i `lib/`, tynd composition root.

**Base:** `functions/index.js` (merged: backup 26/6 + 32 filer + module-access). 11.166 l, 64 inline
exports + 2 bulk (`./modules/pos`, `./water-module`). 118 helpers (63 delte, 50 private, resten).
Fundament: `db`, `FieldValue`, `OPENAI_API_KEY`, `FUNCTIONS_CONFIG` + 16 top-level const/let.

**Baseline:** `audit/functions-index-exports-baseline.json` (82 navne). Efter HVERT trin:
`node tools/audit/export-surface.cjs functions/index.js audit/...baseline.json` skal give 82/82,
og `check-unresolved.cjs` skal give 0 på rørte filer.

**Mangler stadig (12 exports, kun i deploy-træ 2026-06-08):** api, createModuleCheckoutSession,
createPlatformCheckoutSession, finalizeModuleCheckoutSession, generateRestaurantHeroImage,
getOfficialRecallFeed, getOnboardingDraft, lookupCompanyModuleOwnership, saveSeoSiteDraft,
searchGooglePlaceBusinessImages, searchGooglePlacesForSeo, uploadBusinessHeroImageToCloudinary.
De wires ind i deres nye domænefil undervejs, ikke klistres i index.js.
Backup mangler dem; deploy mangler til gengæld pause-funktionerne (allerede i base).

---

## Rækkefølge (hvert trin: flyt → node --check → check-unresolved → export-surface → commit-gate)

### Trin 1 — lib/ (fundamentet). INGEN export flyttes endnu.
De 63 delte helpers → `functions/lib/*.js`, grupperet:
- `lib/sanitize.js` — sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt, toDocSafeId, toAsciiSlug, getDateKey
- `lib/access.js` — getUserAccessProfile, getUserLocationIds, assertAdminAccess, assertSuperAdminAccess, assertStartDayAccess
- `lib/equipment.js` — sanitizeEquipmentType, ensureEquipmentTemperatureControl, parseFrequencyConfig, sync{Water,ProcessDrift,EquipmentMaintenance}Templates
- `lib/onboarding-sanitize.js` — sanitizeOnboardingProfile, sanitizeRiskModelInput
- `lib/ownerScope.js` — findes allerede; buildOwnerScopeUpdatePatch flyttes hertil
index.js require'r fra lib/ i stedet for at definere. Exports uændrede. **Verificér 82/82.**

### Trin 2-9 — ét domæne ad gangen. Hvert: exports + private helpers → `functions/<domæne>/index.js`,
requirer fra `../lib/`. index.js: `Object.assign(exports, require("./<domæne>")(deps))` ELLER
(foretrukket, lagerkontrol-stil) domænefilen henter selv fra lib/ og index.js re-eksporterer.

Domæner (exports-tal ca.):
2. **media** (6) — cloudinary/billeder. Allerede pilot-verificeret. + de 4 deployede image-exports.
3. **seo** (5) + saveSeoSiteDraft, searchGooglePlaces* — publicerer til VPS nginx.
4. **onboarding** (10) + getOnboardingDraft — createQuickOnboarding, complete, finalize, provision.
5. **ewcp-checkout** (checkout ×3 + lookupCompanyModuleOwnership) — Stripe mod madkontrollen indtil
   ewcp får egen betaling. Hører logisk til ewcp; bliver her til det projekt bygges.
6. **demo** (5) — seed/reset/enable/disable/createDemoEnvironment.
7. **company-admin** (getDashboardSnapshot, listLocationUsers, createLocationUser, archive/restoreCompany, startNewPeriod).
8. **egenkontrol-engine** (23) — startDayForLocation, saveRoutineTask, syncRiskTaskTemplates, cleanup,
   pause-funktionerne, regenerate. STØRST + kritisk sti. + getOfficialRecallFeed. Tag SIDST.
9. **stripe** (stripeWebhook, createStripeCheckoutSession) — betaling. + api (onRequest-router).

### Trin 10 — index.js er nu transport. Kopiér `index.transport.test.js` fra
`../ewcp-bogfoering-recovered-clean/functions-candidate/`, tilpas regex (den tillader kun
`const {x}=require('./y')` + `exports.x=y` + `Object.assign(exports,require('./y')(deps))`).
Kør den. Grøn = færdig.

---

## Vigtige regler undervejs (fra tools/madkontrollen.md)
- **A-rettelsen samtidig:** i egenkontrol-trinnet, ret `normalizeRoutineEntryKey` → `normalizeRoutineType`
  + require `./js/canonicalRoutines`. Verificeret mod 32 rutinetyper.
- **Secrets:** `secrets: [OPENAI_API_KEY]` er OBJEKT-form — skal injiceres, ikke strengificeres.
  `defineSecret()`-kaldene BLIVER i index.js (Firebase param-registrering ved load).
- **interval_days-aliaset** i shouldRunToday er bærende (94% af rutiner) — flyt ordret.
- **Ingen deploy** før hele kæden er grøn OG functions:list-driften er afklaret (103 live vs 82 base;
  17 funktioner reddet fra source-zips, endnu ikke wired: lagerkontrol, apps, checkout).
- **Ingen commit uden brugerens GO.**

## Status
- [x] Merge: 32 filer + module-access + zettle-beslutning
- [ ] Trin 1: lib/
- [ ] Trin 2-9: domæner
- [ ] Trin 10: transport-test grøn
