# Madkontrollen — Teknisk projektstatus

**Dato:** 2026-06-16
**Firebase-projekt:** `madkontrollen`
**Repo:** `D:\madkontrol-app`
**Clean-room deploy-kilde:** `D:\mk-deploy-clean`
**Udført af session:** Aroi-D restore + scope-oprydning + rapport/rutine-frontend-fixes

---

## 0. Identiteter / scopes

### Rigtige kunder (kun 2)
| Kunde | email | uid | companyId | locationId |
|---|---|---|---|---|
| Aroi-D (Supawan) | supawan@aroid.dk | `HNcGHMrzsUPqbyBcmodsxBuWuJc2` | `onboarding_aroi-d_42405000` | `onboarding_aroi-d_42405000__main` |
| Cafe Victoria (Ali Fallah) | af@madkontrollen.dk | `UhE1RUdljBNUQmhmktXiULjWyKr1` | `company_1778059074471_sh45d3wbu` | `location_1778059074471_9i7w1ko3s` |

### Aroi-D legacy scope (historisk kilde — bevares midlertidigt)
- companyId: `company_1778453641187_xxaoilz18`
- locationId: `location_1778453641187_fbljxh1ym`
- Indeholder: 647 task_entries (2026-05-10 → 2026-06-12), 28 flade task_templates, 23 equipment, 17 daily_runs, 1 deviation, 1 alert, 4 media_assets.

### Øvrigt
- 89 companies total (87 demo/test/prospect/fejlscope), 108 Auth-brugere (65 `demo_*`), 633 prospects.
- super-admin emails i rules: `mn@aroid.dk`, `michael@madkontrollen.dk`.

---

## 1. Backend-kodeændringer (functions/)

### functions/index.js — `shouldRunToday` interval_days alias
**Status: ÆNDRET + DEPLOYET.**
Root cause: writers (canonicalTaskEngine.js, demoCanonicalTemplates.js, modules/egenkontrol/routines.js) skriver `scheduleConfig.recurrenceMode = "interval_days"` (nogle `"days"`), men `shouldRunToday` (index.js:2668) havde kun en `every_n_days`-gren → alle interval-rutiner faldt igennem til `return false` → `startDayForLocation` genererede **0 task_instances** (bekræftet live: daily_runs 06-10/06-11 taskCount=0).

Patch (linje ~2673):
```js
let recurrenceMode = scheduleConfig.documentedIntervalMode || scheduleConfig.recurrenceMode || "daily";
if (recurrenceMode === "interval_days" || recurrenceMode === "days") {
  recurrenceMode = "every_n_days";
}
```
- Kun funktionen `shouldRunToday` rørt. Alle 82 exports uændrede (verificeret mod baseline).
- Smoke-test: 15/15 branches OK. Simulation: 0 due → 12 due (Aroi-D legacy scope, 2026-06-15).
- Patch-artefakt: `audit/shouldRunToday-alias.patch` (reverse-check OK).

---

## 2. Deploys

| Deploy | Target | Status | Noter |
|---|---|---|---|
| Schedule-fix | `functions:startDayForLocation` (project madkontrollen) | ✅ **DEPLOYET** (af bruger) | Kun den ene funktion; ingen generateDailyTaskInstances; ingen Cloud Scheduler |
| Hosting (5 frontend-fixes) | `hosting:madkontrollen` | ⏳ **IKKE DEPLOYET** | Clean-room klar i `D:\mk-deploy-clean`; CLI-auth fejler i agent-miljø → **bruger skal køre** `firebase login --reauth` + deploy |
| Firestore rules | — | ❌ **IKKE DEPLOYET** | `firestore.rules` er +235/-14 linjer modificeret lokalt vs HEAD; deployed version muligvis ældre (se Kendte fejl #1) |
| Functions (full) | — | ❌ Ikke kørt | Kun targeted startDayForLocation |

**Agent kan ikke deploye:** `firebase` CLI returnerer `Authentication Error: Your credentials are no longer valid` ved hver netværks-kommando. Lokale kommandoer (`firebase target`) virker. Alle deploys køres af brugeren efter `firebase login --reauth`.

---

## 3. Scripts oprettet (functions/scripts/)

| Script | Formål | Status |
|---|---|---|
| `restoreAroidMasterdataLegacyToCanonical.js` | Flad kopi af legacy task_templates → canonical | 🗑️ **KASSERET/SUPERSEDED** — lavede generiske templates uden equipment-binding; brød runtime. Bør slettes. |
| `runCanonicalEngineRestore.js` | Kalder den rigtige `generateCanonicalTaskTemplates` (samme som quick onboarding) → per-enheds templates | ✅ **APPLIED** |
| `reactivateCanonicalGenericTemplates.js` | Re-aktiverer 12 non-equipment CCP-templates som blev fejlarkiveret af TRIN 0 | ✅ **APPLIED** |
| `cleanupCanonicalDuplicates.js` | Retter stale `templateId` (legacy-scope) på 12 templates + soft-arkiverer 2 stray equipment-instanser | ✅ **APPLIED** |
| `patchTemperatureMeasurementFields.js` | (Skulle tilføje requiresMeasurement/measurementUnit) | ❌ **UBRUGT** — viste sig unødvendig (temp-feltet vises allerede); bør slettes |
| `migrateAroidTaskEntriesLegacyToCanonical.js` | Migrér 647 legacy task_entries → canonical | ✅ APPLIED → ❌ **REVERTET** (se #5) |
| `reverseMigrateAroidTaskEntries.js` | Revert: sletter de 647 migrerede canonical-kopier (triple-guard) | ✅ **APPLIED** |
| `fixAfCrossTenantScope.js` | Retter af@'s users-doc fra Aroi-D → Cafe Victoria + email + membership | ✅ **APPLIED** |

### audit/ artefakter
- `audit/functions-index-exports-baseline.json` — 82 export-navne (regressions-anker)
- `audit/shouldRunToday-alias.patch` — isoleret patch for schedule-fixet

---

## 4. Migrations (data)

### 4.1 Masterdata-restore (equipment + task_templates) — APPLIED
**Script:** `runCanonicalEngineRestore.js --apply` (restoreBatchId `canonical_aroi_d_2026_06_15_001`)
- TRIN 0: soft-arkiverede 28 flade legacy-templates (fra det kasserede script).
- TRIN 1: skrev 23 equipment til canonical (deterministiske IDs `…__equip__<sourceId>`, `id == docId`, ownerKind real_owner).
- TRIN 2: kaldte `generateCanonicalTaskTemplates(routineKeys=null, ownerScopeMetadata=real_owner)` → engine-stats `created:41, updated:12, archived:0`.
- Resultat: per-enheds templates ("Køleskab temp. · Køleskab 1-4", "Fryser temp. · Fryser 1-3", "Varmeskab temperatur · 1-4" osv.) + generiske CCP'er.

### 4.2 Reaktivering af 12 CCP-templates — APPLIED
**Script:** `reactivateCanonicalGenericTemplates.js --apply`
- Engine genbrugte de 12 arkiverede flade non-equipment docs via `update()` men un-arkiverede dem ikke → de 12 CCP'er (varemodtagelse, opvarmning, nedkøling, varmholdelse, adskillelse, allergener, opbevaring, sporbarhed, tilbagetrækning, årlig revision, køkken rengøring, 3-timers regel) stod arkiverede.
- Fix: re-aktiverede de 12 (active/isActive=true, archived=false, status=active). De 16 equipment-flade forblev arkiverede (korrekt — erstattet af per-enhed).
- Resultat: 53 aktive templates (38 per-enhed + 15 generiske), 16 arkiverede.

### 4.3 Cleanup af templateId-dubletter — APPLIED
**Script:** `cleanupCanonicalDuplicates.js --apply`
- Root cause: `routineCardsResolver.parseScopedRoutineParts` læser `templateId`; de 12 re-aktiverede flade templates havde stale `templateId = company_1778…__location_1778…__canonical__<key>` → falsk equipment-nøgle → dedup-mismatch med risk_analysis-kort → dubletter.
- Fix: omskrev `templateId/taskId/taskInstanceId/sourceTaskInstanceId` med legacy-tokens → target doc-id (12 templates).
- Soft-arkiverede 2 stray equipment-generiske task_instances (Fryser temperatur, Køleskab temperatur, dateKey 2026-06-15). Beholdt 2 legitime non-equipment instances (Nedkøling, 3-timers regel).

### 4.4 af@ cross-tenant scope-repair — APPLIED
**Script:** `fixAfCrossTenantScope.js --apply`
- Root cause: `users/UhE1RU…` (af@'s auth-uid) havde **Supawans email** (`supawan@aroid.dk`) + Aroi-D scope (identity-bleed). `auth.js` indlæser scope fra users/{uid} → af@ landede i Aroi-D.
- Fix (kun `users/UhE1RU…` + Cafe Victoria membership):
  - email: `supawan@aroid.dk` → `af@madkontrollen.dk`
  - companyId/organizationId → `company_1778059074471_sh45d3wbu`
  - locationId/primaryLocationId → `location_1778059074471_9i7w1ko3s`
  - locationIds → `["location_1778059074471_9i7w1ko3s"]`
  - audit: previousEmail/CompanyId/LocationId/LocationIds, scopeRepairedBy
  - oprettede `companies/company_1778059074471_sh45d3wbu/members/UhE1RU…` (owner, real_owner)
- Verificeret: supawan@aroid.dk findes nu kun på 1 uid (Supawan); af@ på 1 uid. Supawans egen doc urørt. af@ er IKKE member af Aroi-D.

### 4.5 task_entries-migration (647) — APPLIED → REVERTET (se #5)

---

## 5. Reverts

### 5.1 task_entries-migration revertet
**Migration (4.5):** `migrateAroidTaskEntriesLegacyToCanonical.js --apply` (restoreBatchId `restore_aroi_d_entries_2026_06_15_001`)
- Kopierede 647 legacy task_entries → canonical (scope/equipmentId/reference-id omskrevet, ownerKind real_owner, restoredFrom*-felter). Fresh=647, conflict=0.

**Regression:** rutiner.html læser `task_entries` som rutine-kort-historik → de 647 injicerede ~32 ekstra historik-kort → 85 kort i stedet for ~53. Bruger meldte "tribletter i rutinerne".

**Revert:** `reverseMigrateAroidTaskEntries.js --apply`
- Slettede de 647 canonical-kopier (triple-guard: locationId=canonical + restoreBatchId=batch + restoredBy=migrate + restoredFromDocId).
- Verificeret: canonical task_entries tilbage til original (9, nu ~60 pga. bruger-aktivitet); migrations-rester=0; legacy 647 urørt.

**Erstatningsløsning:** dual-scope read i rapporter.html (se #6.3) — viser historik i rapporten **uden** at kopiere ind i canonical.

---

## 6. Frontend-ændringer (public/modules/egenkontrol/) — ALLE LOKALE, AFVENTER HOSTING-DEPLOY

> Live hosting-target = `public/` (ikke `functions/public/` som er mirror). Aktiv rutineside = `rutiner.html` (ikke rutiner-v2.html / start-dag.html).

### 6.1 rutiner.html — post-resolver generic-temp dedup
- Problem: generiske "Fryser temperatur"/"Køleskab temperatur"-kort (fra risk_analysis controlPoints) duplikerede per-enheds equipment-kort. `DEDUP_GENERIC_EQUIPMENT` kørte kun pre-resolver på task_instances → risk-kort slap forbi.
- Fix: efter `allTasks` er bygget (post-resolver), drop generiske temp-kort når per-enheds equipment-temp-kort findes.

### 6.2 rapporter.html — authority loader "spasmager"-tekster
- 10 roterende loadertekster (`#authority-report-loading-text`), skifter hver 4000ms, kun ved `mode=authority`. `start/stopAuthorityReportLoadingTexts()`, clearInterval i finally + ved genstart.

### 6.3 rapporter.html — dual-scope historik
- `resolveLinkedLegacyScope()`: udleder legacy-scope fra canonical equipment/templates `restoredFromCompanyId/LocationId` (read-only).
- `loadScopedCollection`: tilføjer linked-legacy som scope-variant og **fletter alle scopes** (dedup på doc-id) i stedet for kun første.
- Effekt: Aroi-D-rapport viser canonical + legacy (656+ entries: 9-60 canonical + 647 legacy) uden at røre canonical task_entries.
- Verificeret: merge = 656 (resp. 707), dual-scope intakt.

### 6.4 rapporter.html — console-spam cleanup + summary
- `[title resolver]` (pr. kort) og `[report date fallback]` (pr. entry) gated bag `DEBUG_REPORTS` (= `?debug=1`, slukket default).
- Tilføjet 1 samlet `[authority report summary]` linje i `renderEntries` med `{canonicalEntries, legacyEntries, mergedEntries, renderedEntries}`.

### 6.5 rapporter.html — dato-type + fra/til filter (myndighedsrapport)
- Root cause: `getAuthorityEntries/Alerts/LogbookEntries` + deviations-filter brugte **hardcoded `"90days"`** → ignorerede brugerens periodevalg → gamle datoer (fx 28.05) vistes under "I dag".
- Ændringer:
  - UI: `#dateTypeFilter` (Udført/Oprettet) + `#fromDateFilter` + `#toDateFilter`.
  - `getEntryFilterDate(entry, dateType)`: performed → completedAt/performedAt/documentedAt; created → createdAt/createdAtClient/dateKey.
  - `entryMatchesPeriod(entry, period, dateType, fromDate, toDate)` — fra/til prioriteres over periode-preset.
  - `alertMatchesPeriod(alert, period, fromDate, toDate)` — fra/til support.
  - Fjernet alle 4 hardcodede authority-`"90days"` → bruger `periodFilter.value`/`dateTypeFilter.value`/fra/til.
  - `getFilteredEntries`/`getFilteredAlerts`, `bindEvents`, `resetFilters` opdateret.
  - Print/PDF bruger `reportPrintRoot.innerHTML` (renderet filtreret DOM) — ingen særlogik.
  - Dual-scope (#6.3) URØRT; filtrering sker EFTER merge (`allEntries`).
- Acceptance simuleret OK: A) I dag+Udført, B) I dag+Oprettet, C) 28.05→28.05 = 47, D) Hele perioden = 707, E) søgning+periode, F) status+dato, G) dual-scope 647 bevaret.

### Clean-room status (`D:\mk-deploy-clean`)
- Re-synket med alle 5 fixes; rutiner.html md5 `c5d0790…`, rapporter.html md5 `34a4c89…` (= repo).
- `public/`, `firebase.json`, `.firebaserc`, `firestore.rules`, `audit/baseline` kopieret; node_modules ekskluderet/`npm ci` kørt for functions-verifikation.

---

## 7. Datatilstand (Aroi-D canonical) — sidst verificeret

| Collection | Antal | Noter |
|---|---|---|
| task_templates (aktive) | 53 | 38 per-enhed + 15 generiske; 16 arkiverede (equipment-flade) |
| equipment (aktive) | 23 | ownerKind real_owner, id==docId |
| task_instances | ~52-60 | dateKey 2026-06-15, ægte bruger-registreringer (vokser live) |
| task_entries | ~9-60 | dateKey 2026-06-15, ægte bruger-registreringer; 0 migrations-rester |
| risk_analysis/current | 7 controlPoints | varemodtagelse, opvarmning, nedkoeling, varmholdelse, tre_timers_regel, koeleskab_temperatur, fryser_temperatur |

Legacy Aroi-D: 647 task_entries (2026-05-10→06-12) intakt, urørt.

---

## 8. Kendte fejl / åbne issues

### #1 — Recall/tilbagekaldelse permission-fejl (AUDITERET, IKKE RETTET)
- Symptom: `[recall feed] action failed FirebaseError: Missing or insufficient permissions` (rutiner.html:11222) ved Gennemgået / Ikke relevant / Relevant.
- Root cause: `logRecallFeedAction` (rutiner.html:10820) `setDoc(doc(db,"task_instances", task.id), {...}, {merge:true})` — der findes **0 tilbagetraekning task_instances** → virtuel CREATE; payloaden **mangler companyId/locationId**. Deployed rules (muligvis strammere end local/HEAD) afviser create uden companyId. (Local/HEAD task_instances-rules tillader, men `firestore.rules` er +235 linjer modificeret lokalt og deployed version er sandsynligvis ældre.)
- Bekræftet: Supawan = owner, alle docs (users/live_user_profiles/members) findes, `isEmployee()`=true under local rules.
- **Fix (frontend-only, anbefalet):** tilføj `companyId: SETTINGS.companyId, organizationId: SETTINGS.companyId, locationId: SETTINGS.locationId` til task_instances setDoc-payloaden i `logRecallFeedAction`. Retter både permission og data-scope (ellers oprettes scope-løs instance).

### #2 — Rapport viser "Aroi-D"/"—" som udfører på historiske entries (IKKE RETTET)
- De 647 legacy + tidlige canonical entries har `completedByName = "Aroi-D"` (firmanavn) fordi profilens displayName tidligere var "Aroi-D" (nu rettet til "Supawan").
- `prettyPersonName` filtrerer firma-lignende navne → "—", og `firstPresent` når aldrig emailen.
- Fix (frontend, ikke lavet): lad navne-resolveren falde igennem til email når `prettyPersonName` returnerer "" (firma) → "Supawan". + `getEntryCreatedByName` fallback til completer.

### #3 — firestore.rules: local ≠ deployed
- `firestore.rules` +235/-14 vs HEAD (nye subcollection-regler: routine_overrides, pos_products, pos_audit_log). task_instances/task_entries-blokke UÆNDREDE vs HEAD, men deployed version ukendt (CLI-auth fejler). Kan være årsag til #1.

### #4 — Auth displayName = firmanavn
- supawan@aroid.dk Auth-displayName = "Aroi-D" (users-doc rettet til "Supawan", men Auth-record ikke). af@ Auth-displayName = "Cafe Victoria". Påvirker "Bruger:"-header (resolveTopbarUserName falder til Auth-displayName). Ikke scope-kritisk.

### #5 — Dirty working tree
- 407 dirty paths total (~231 under public/, 8 deploybare functions/*.js). HEAD's `functions/index.js` er forældet (13.166 linjer, mangler POS-modul + ownerScope) → må IKKE bruges som deploy-base. Working tree er den auditerede/live-matchende kode. Kræver kirurgisk git-oprydning.

---

## 9. Næste opgaver

| # | Opgave | Type | Blokeret af |
|---|---|---|---|
| 1 | **Hosting-deploy** af 5 frontend-fixes fra `D:\mk-deploy-clean` (`firebase login --reauth` + `firebase deploy --only hosting:madkontrollen`) | Deploy | Bruger-auth |
| 2 | **Recall permission-fix** (frontend: tilføj companyId/organizationId/locationId til task_instances setDoc i `logRecallFeedAction`) | Frontend | GO |
| 3 | **Rapport-navne render-fix** (fald-igennem firma-navn → email → personnavn) | Frontend | GO |
| 4 | Verificér deployed firestore.rules vs local; evt. snæver rules-deploy | Rules | Bruger-auth |
| 5 | **Bredere purge** (demo/test/prospect/Cafe Victoria): migrér→backup→soft-arkivér→deaktivér users→hard delete (separat trin) | Data | Backup + GO pr. trin |
| 6 | **TRIN 2: arkivér/slet Cafe Victoria** (af@) som ikke-bevaret kunde — først når Aroi-D er isoleret + verificeret | Data | Efter purge-audit |
| 7 | **Kirurgisk git-oprydning** af dirty working tree (commit intended, kassér junk, slet `restoreAroidMasterdataLegacyToCanonical.js` + `patchTemperatureMeasurementFields.js`) | Git | Efter deploys verificeret |
| 8 | Migrér evt. legacy `deviations` (1) / `daily_runs` (17) / `media_assets` (4) til canonical hvis ønsket (ELLER hold på dual-scope read) | Data | Beslutning |
| 9 | Afklar `registrationDue`-gate (entries med registrationFrequency=daily men frequency=interval — droppes pt. af `if(!due)` i startDayForLocation) | Backend | Beslutning |

### Verificeret undervejs (ingen handling nødvendig)
- `generateDailyTaskInstances` (scheduled) er **IKKE live** (functions:list + Cloud Scheduler bekræftet tomme); orphaned i `functions/egenkontrolGenerator.js` + `functions/admin/generateDailyTaskInstances.js` — bevares, ikke genoplivet.
- Daglig task_instance-generering sker via `startDayForLocation` (bruger-trigget) — IKKE via cron.

---

## 10. Hårde grænser overholdt i hele forløbet
- Ingen hard delete (undtagen revert af egne 647 kopier — originaler intakte).
- Ingen ændring af Stripe/subscriptions/checkout_sessions.
- Ingen Auth-delete.
- Ingen ændring af Supawan/Aroi-D-data udover de dokumenterede restores/cleanups.
- Alle data-writes kørt via dry-run → GO → --apply.
- Ingen functions full-deploy; kun targeted `startDayForLocation`.
