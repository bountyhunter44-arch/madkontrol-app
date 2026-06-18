# Egenkontrol — Registry

## Active runtime (frontend)
- `public/modules/egenkontrol/rutiner.html` — daily routines / registration
- `public/modules/egenkontrol/rapporter.html` — report center (filter, pagination, PDF per category)
- `public/modules/egenkontrol/afvigelser.html` — deviations (supports `?adminCompanyId/adminLocationId/deviationId`)
- `public/modules/egenkontrol/luk-dag.html` — close day / generate report

## Active engine (backend)
- `functions/canonicalTaskEngine.js` — `generateCanonicalTaskTemplates`, `startDayForLocationCanonical`,
  `ensureSingleTaskInstance`, `EQUIPMENT_ROUTINE_TYPES`, equipment-guard helpers.
- `functions/js/setupToCanonicalRoutines.js` — `normalizeQuickOnboardingSetup`,
  `resolveCanonicalRoutineKeysFromSetup`, `buildEquipmentFromSetup`.

## Rules (hard)
- **No fridge/freezer routines without a concrete `equipmentId`/`unitId`/`equipmentName`/`unitName`.**
  Enforced by `shouldSkipMissingEquipmentRoutine()` in `canonicalTaskEngine.js` (template loop +
  `ensureSingleTaskInstance`). Logs `[egenkontrol generator skipped missing equipment]`.
- **No generic "Fryser temperatur" / "Køleskab temperatur".** Reports must show concrete equipment:
  `Fryser temperatur · Fryser 1`, `Køleskab temp. · Køleskab 1`.
- Equipment is the **runtime source of truth**; templates/instances reference equipmentId/Type/Name.
- **"Udført af" / "Oprettet af" must never be "—".** Missing actor must render as **"Ikke registreret"**.
  (NOTE: current rapporter.html falls back to "—" in some name resolvers — TODO: change to
  "Ikke registreret"; tracked as a follow-up.)
- **Old bad rows may be hidden, never deleted.** Soft-archive only
  (`active:false,isActive:false,archived:true,status:"inactive",archivedReason:"missing_equipment_reference",archivedAt`).

## Frontend safety filters (legacy data)
- rapporter.html: `isGenericColdTemperatureEntryWithoutEquipment()` applied in `getFilteredEntries()`
  + `getAuthorityEntries()` (hides generic cold/freezer in list, temperature card and PDF).
- rutiner.html: unconditional hide of generic cold/freezer cards without equipment + platform-admin
  console warning "…Kør equipment repair."

## Tools
- `tools/audit-missing-equipment-temperature-routines.cjs` — READ-ONLY audit.
- `tools/repair-missing-equipment-temperature-routines.cjs` — dry-run default; `--apply` soft-archive only.

## Report center (rapporter.html)
- Date-type filter (registration/performed/created), status filter, **report-category filter**
  (`#reportCategoryFilter`), equipment filter, pagination (25/50/100), filter-summary, print-per-category
  (`printCurrentReportSelection()` + `@media print`). Authority blocks tagged `data-report-category`.
- `getAuthorityEntries()` uses the SAME report-category + equipment filter as the entries list.
