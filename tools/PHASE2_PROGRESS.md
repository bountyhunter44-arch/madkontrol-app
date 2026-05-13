# PHASE 2: MADKONTROLLEN ABSORPTION + SURGICAL CLEANUP

**Started:** 2026-05-11 18:17  
**Status:** IN PROGRESS

---

## 🎯 OBJECTIVE

Learn Madkontrollen codebase systematically and perform safe, surgical cleanup.

**NOT:** Large refactors, flow changes, or creative rewrites  
**YES:** Registry population, documentation, safe duplicate removal

---

## 📊 PROGRESS

### Helpers Registered: 21/~50
- ✅ resolvePrettyCompanyInfo (HIGH RISK)
- ✅ resolveCompanyIdFromUserData
- ✅ resolveLocationIdFromUserData
- ✅ resolveOrgContext (HIGH RISK)
- ✅ setupAuthGate (HIGH RISK)
- ✅ showProfileErrorState
- ✅ resolveTaskTitle
- ✅ resolveTaskTitleWithContext
- ✅ resolveTaskGroup
- ✅ resolveTaskFrequency
- ✅ resolveTaskIcon
- ✅ normalizeTaskKey
- ✅ getCanonicalTask
- ✅ getCanonicalTasksByGroup
- ✅ startCoolingRun (HIGH RISK)
- ✅ getActiveCoolingRuns
- ✅ initCoolingOverlay
- ✅ startHotHoldingRun (HIGH RISK)
- ✅ getActiveHotHoldingRuns
- ✅ initHotHoldingOverlay
- ✅ loadLayout (HIGH RISK)

### Engines Registered: 2/~5
- ✅ Canonical Routines Engine (CRITICAL)
- ✅ Canonical Egenkontrol Tasks (HIGH)

### Workflows Registered: 0/~3

### Dependencies Mapped: 100% (core dependencies)
- ✅ resolveOrgContext → 7 usages
- ✅ resolvePrettyCompanyInfo → 5 usages
- ✅ resolveTaskTitle → 3 usages
- ✅ setupAuthGate → 4 usages
- ✅ loadLayout → all pages
- ✅ CANONICAL_ROUTINES → Firestore collections
- ✅ CANONICAL_EGENKONTROL_TASKS → task system

### Surgical Cleanups Performed: 0
### Surgical Candidates Identified: 4

### Report Drift Analysis: ✅ COMPLETE
- 🔴 20+ timestamp field variants found
- 🔴 17+ completion timestamp variants
- 🔴 5+ performer field variants (mostly missing)
- 🔴 15+ inline render chains
- 🔴 7 Firestore collections with drift
- ✅ Normalization plan created

---

## 🔍 SCAN STATUS

### ✅ Scanned
- `public/core/prettyName.js` - 3 helpers found
- `public/core/taskTitleResolver.js` - 5 helpers found
- `public/core/canonicalRoutines.js` - 1 engine found

### 🔄 In Progress
- `public/core/` - Scanning remaining files

### ⏳ Pending
- `public/modules/egenkontrol/`
- `functions/`
- `public/core/auth.js`
- `public/core/layout.js`
- `public/core/cooling-overlay.js`
- `public/core/hot-holding-overlay.js`
- Firebase helpers
- Validators
- Render helpers

---

## ⚠️ HIGH-RISK AREAS IDENTIFIED

1. **prettyName resolver** (public/core/prettyName.js)
   - Risk: HIGH
   - Why: Complex fallback chain, used everywhere
   - Critical: MUST prioritize live_user_profiles.profile.* fields
   - Status: Registered, DO NOT MODIFY

2. **Canonical Routines Engine** (public/core/canonicalRoutines.js)
   - Risk: CRITICAL
   - Why: Defines 22 routine types, HACCP compliance
   - Critical: MUST sync with backend, DO NOT change without review
   - Status: Registered, DO NOT MODIFY

---

## 🔧 SURGICAL CLEANUPS

### Completed: 0

### Planned: TBD (after full scan)

---

## 📝 NEXT STEPS

1. ✅ Register initial helpers (8 done)
2. ✅ Register canonical routines engine
3. ✅ Log Phase 2 start decision
4. 🔄 Continue scanning public/core/
5. ⏳ Scan public/modules/egenkontrol/
6. ⏳ Scan functions/
7. ⏳ Map dependencies
8. ⏳ Identify duplicates
9. ⏳ Plan surgical cleanups
10. ⏳ Execute cleanups (one at a time)

---

## 🎓 LEARNINGS

### Critical Rules Discovered
- prettyName MUST prioritize live_user_profiles.profile.* (from memory)
- Canonical routines MUST sync with backend
- 22 routine types defined (varemodtagelse, opvarmning, etc.)
- Unique key: companyId + locationId + routineType + unitId + dateKey
- Temperature vs cleaning are separate routines (never mixed)

### Patterns Identified
- Resolver pattern: Multiple fallback sources
- Canonical mapping: Raw keys → Pretty titles
- Risk management: Each routine has hazard, criticalLimit, deviationTrigger
- Display helpers: Separate concerns (title, context, group, frequency, icon)

---

## ⏱️ TIME TRACKING

- Phase 2 Start: 18:17
- Initial scan: 18:17-18:30 (estimated)
- Registry population: 18:17-ongoing

---

**Status:** Scanning in progress  
**Next:** Continue scanning public/core/ files
