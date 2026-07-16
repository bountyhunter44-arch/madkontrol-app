# Egenkontrol — Registry

## Active runtime (frontend)
- `public/modules/egenkontrol/rutiner.html` — daily routines / registration
- `public/modules/egenkontrol/rapporter.html` — report center (filter, pagination, PDF per category)
- `public/modules/egenkontrol/afvigelser.html` — deviations (supports `?adminCompanyId/adminLocationId/deviationId`)
- `public/modules/egenkontrol/luk-dag.html` — close day / generate report

## Active engine (backend)
- `functions/equipmentRoutineGuard.js` — **SINGLE SOURCE OF TRUTH** for the equipment rule.
  Exports `hasConcreteEquipmentRef`, `isEquipmentBoundRoutine`,
  `shouldSkipEquipmentBoundRoutineWithoutEquipment`. Keyword-based, self-contained (no circular dep),
  deliberately NO bare "køl"/"koel". `varmholdelse`/`hot_holding` are in the PROCESS exclude-list
  (the equipment variant is `varmeskab_*`).
- `functions/canonicalTaskEngine.js` — `generateCanonicalTaskTemplates`, `startDayForLocationCanonical`,
  `ensureSingleTaskInstance`, `EQUIPMENT_ROUTINE_TYPES`. Its `requiresConcreteEquipmentForRoutine` =
  `isEquipmentRoutineType(routineType)` (precise authority) **OR** the shared `isEquipmentBoundRoutine`
  backstop; `hasConcreteEquipmentRef` delegates to the shared module. Applied in the template loop +
  `ensureSingleTaskInstance`.
- `functions/js/setupToCanonicalRoutines.js` — `normalizeQuickOnboardingSetup`,
  `resolveCanonicalRoutineKeysFromSetup`, `buildEquipmentFromSetup`.

### Generator map (where task_templates / task_instances are written)
- `canonicalTaskEngine.js` — ACTIVE per-unit engine. **Guarded** (shared module). ✅
- `index.js ensureEgenkontrolTaskTemplates` (~4596) — per-unit loop, `continue` if no `unitId`, always
  attaches concrete `equipmentMeta`. **Structurally safe — no guard needed.** ✅
- `egenkontrolGenerator.js createTaskInstancesForDate` (~485) — legacy daily-instance generator
  (canonical replaced it). **Guarded as a safety net**: skips instance + logs
  `[egenkontrol generator skipped equipment-bound routine without equipment]` (`skipped_missing_equipment`).
- `admin/generateEgenkontrolFromRiskAnalysis.js` (~734) — risk→routine **category-AGGREGATED** templates
  (payload = name/category/controlType, NO per-unit fields). Different model; NOT guarded (a "Køl/frost"
  aggregate is legitimate, not a missing-equipment error). ⚠️ revisit only if it starts emitting per-unit rows.
- `provisioning.js` (~1216) — writes to a NESTED `companies/{}/locations/{}/task_templates` subcollection
  (different/legacy model, no equipment fields). Out of the top-level canonical scope.
- Dead/legacy (0 requirers): `egenkontrolPrograms.js`, `egenkontrolProgramTemplates.js`,
  `riskToRoutineTransformer.js`, `startDayForLocation.js`, `startDayForLocationCanonical.js` (file),
  `demoCanonicalTemplates.js`.

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
- **BROAD trio (in BOTH rapporter.html and rutiner.html)** — mirrors `functions/equipmentRoutineGuard.js`:
  `hasConcreteEquipmentRef()`, `isEquipmentBoundRoutine()`, `shouldHideEquipmentBoundRoutineWithoutEquipment()`.
  Hides ALL equipment-bound routines without a concrete unit (varmeskab/pålægsmaskine/komfur/ovn/friture/
  køledisk/kølerum/frostrum/opvaskemaskine/isterningemaskine/softice/røgeovn/rasteskab + køl/frys).
  `excludedProcess` keeps nedkøling/opvarmning/3-timers/modtagekontrol/adskillelse/personlig hygiejne/
  **varmholdelse** visible. NO bare "køl"/"koel". Treats `—`/`-`/`ukendt`/`udstyr ikke angivet`/`default`
  as NOT concrete.
  - rapporter.html: applied in `getFilteredEntries()`, `getAuthorityEntries()`, `populateEquipmentFilter()`
    (PDF/print inherits via the filtered DOM).
  - rutiner.html: applied on the master `allTasks` set in `loadTasks` (single chokepoint → render,
    pagination and counts all derive from it). Debug: `[rapport skjuler equipment-bound rutine uden udstyr]`.
- Narrow legacy trio still present (subset of the broad one): `hasConcreteColdEquipmentRef()`,
  `isColdTemperatureEntry()`, `shouldHideGenericColdTemperatureEntry()` — køl/frys-specific; kept as
  belt-and-suspenders alongside the broad filter + platform-admin "Kør equipment repair" warning.

## Tools
- `tools/audit-equipment-bound-routines-without-equipment.cjs` — READ-ONLY audit, **ALL** equipment-bound
  types (køleskab/fryser/køledisk/kølerum/frostrum/varmeskab/pålægsmaskine/komfur/ovn/friture/
  opvaskemaskine/isterningemaskine/softice/røgeovn/rasteskab). Uses the shared `equipmentRoutineGuard`.
  Scans task_templates/task_instances/task_entries; reports per-collection counts, already-archived vs
  needs-cleanup, by-routineType breakdown, samples (incl. equipmentId/unitId/equipmentName/unitName +
  suggestedAction), and a **false-positive control** (0 process routines must be flagged). `task_entries`
  are review-only (historical, never archived). `--json` for machine output.
- `tools/audit-missing-equipment-temperature-routines.cjs` — older køl/frys-only audit (superseded by the
  broadened script above; kept for back-compat).
- `tools/repair-missing-equipment-temperature-routines.cjs` — dry-run default; `--apply` soft-archive only.
  Now uses the shared `shouldSkipEquipmentBoundRoutineWithoutEquipment` (all equipment types), still
  task_templates/task_instances only (never task_entries), never hard-delete.

### Aroi-D audit baseline (2026-06-19, READ-ONLY)
20 equipment-bound-without-equipment docs: 16 task_templates + 2 task_instances **already soft-archived**;
the only 2 non-archived are **task_entries** (historical, review-only). False-positive control: 152
equipment-bound-WITH-equipment + 106 process/other correctly NOT flagged; 0 process routines flagged.

## Deviations — active vs resolved (rapporter.html)
- Helpers: `normalizeDeviationStatus()`, `isResolvedDeviation()`, `isOpenDeviation()`, `hasDeviationAction()`.
  Resolved = status løst/loest/resolved/closed/lukket/annulleret/annuleret/cancelled/canceled/done/completed
  OR any of resolvedAt/closedAt/cancelledAt/annulledAt/completedAt/handledAt.
- `renderAuthorityReport()` deviation block splits `deviationItems` → `openDeviationItems` (active list) and
  `resolvedDeviationItems` (rendered under a **"Lukkede og annullerede afvigelser"** sub-heading). Nothing
  deleted — history preserved.
- Pills: **Afvigelser** = total · **Med handling** = `hasDeviationAction` count · **Åbne** =
  `openDeviationItems.length`. Counts passed as `String(n)` so 0 renders as **"0"** (buildPill collapses
  falsy `0` to "—"). PDF/print follows because it prints the same authority DOM.

## KPI cards (rapporter.html `updateSummary`)
- KPI cards summarise the **selected PERIOD** (default `90days`), counting **all VALID `task_entries`** —
  independent of the list's narrowing filters (search/status/category/equipment). Matches the card
  sub-label "Alle handlinger i den valgte periode". The list below still uses the full `getFilteredEntries()`.
- **Registreringer** = `validEntriesInPeriod` (period + not `shouldHideGenericColdTemperatureEntry` +
  not `shouldHideEquipmentBoundRoutineWithoutEquipment`). Excludes invalid equipment-bound rows; never
  counts alerts/deviations (those live in `allAlerts`). **Fuldført/Afvigelser/Mangler rengøring** derive
  from the same period-valid set; **Åbne alerts** = `allAlerts` in period.
- Dev/admin debug: `console.info("[rapport KPI debug]", {...})` gated by `isKpiDebugEnabled()`
  (`?debug=1`/`?kpiDebug=1` or owner/admin/super-admin profile role).
- Note: the headline "417 vs 700+" was NOT a bug — 417 = valid entries in the last 90 days; 700+ was
  all-time ("Hele perioden") and/or included now-hidden invalid equipment-bound rows. The fix decouples
  the KPI from the narrowing filters so the period number is stable/transparent.

## Report center (rapporter.html)
- Date-type filter (registration/performed/created), status filter, **report-category filter**
  (`#reportCategoryFilter`), equipment filter, pagination (25/50/100), filter-summary, print-per-category
  (`printCurrentReportSelection()` + `@media print`). Authority blocks tagged `data-report-category`.
- `getAuthorityEntries()` uses the SAME report-category + equipment filter as the entries list.
