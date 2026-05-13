# PHASE 2 SCAN REPORT

**Date:** 2026-05-11  
**Time:** 18:17-18:30  
**Status:** Initial Scan Complete (public/core/)

---

## 📊 SUMMARY

### Helpers Found: 11
### Engines Found: 1
### High-Risk Areas: 3
### Critical Dependencies: 5

---

## 🔍 HELPERS REGISTERED

### Data Resolvers (6 helpers)
1. **resolvePrettyCompanyInfo** (prettyName.js:166)
   - Risk: HIGH
   - Purpose: Resolve company/location from multiple Firestore sources
   - Critical: MUST prioritize live_user_profiles.profile.* fields
   
2. **resolveCompanyIdFromUserData** (prettyName.js:97)
   - Risk: MEDIUM
   - Purpose: Extract companyId using resolveOrgContext
   
3. **resolveLocationIdFromUserData** (prettyName.js:101)
   - Risk: MEDIUM
   - Purpose: Extract locationId using resolveOrgContext
   
4. **resolveOrgContext** (auth.js:375)
   - Risk: HIGH
   - Purpose: Central org context resolution
   - Critical: All other functions MUST use this
   
5. **resolveTaskTitle** (taskTitleResolver.js:84)
   - Risk: MEDIUM
   - Purpose: Resolve task title with canonical mapping
   
6. **resolveTaskTitleWithContext** (taskTitleResolver.js:148)
   - Risk: LOW
   - Purpose: Add equipment/area context to title

### Display Resolvers (3 helpers)
7. **resolveTaskGroup** (taskTitleResolver.js:172)
   - Risk: LOW
   - Purpose: Map group codes to display names (CCP, GAG)
   
8. **resolveTaskFrequency** (taskTitleResolver.js:198)
   - Risk: LOW
   - Purpose: Convert frequency days to Danish text
   
9. **resolveTaskIcon** (taskTitleResolver.js:238)
   - Risk: LOW
   - Purpose: Get emoji icon for task type

### Auth/UI Helpers (2 helpers)
10. **setupAuthGate** (auth.js:666)
    - Risk: HIGH
    - Purpose: Main auth initialization
    - Critical: Handles onboarding gate redirect
    
11. **showProfileErrorState** (auth.js:885)
    - Risk: LOW
    - Purpose: Display profile error UI

---

## 🏗️ ENGINES REGISTERED

### 1. Canonical Routines Engine
- **File:** public/core/canonicalRoutines.js
- **Lines:** 1-715
- **Risk:** CRITICAL
- **Purpose:** Defines 22 canonical routine types with HACCP compliance
- **Collections:** task_templates, task_instances, deviations
- **Critical Rules:**
  - DO NOT change routine types without backend sync
  - DO NOT modify risk definitions without compliance review
  - MUST maintain sync with functions/canonicalRoutines.js
  - 22 routine types: varemodtagelse, opvarmning, nedkoeling, varmholdelse, etc.
  - Unique key: companyId + locationId + routineType + unitId + dateKey

---

## ⚠️ HIGH-RISK AREAS

### 1. prettyName Resolver Chain
- **Files:** public/core/prettyName.js
- **Risk:** HIGH
- **Why:** Complex fallback chain, used everywhere
- **Critical Rule:** MUST prioritize live_user_profiles.profile.* fields
- **Dependencies:** 
  - resolveOrgContext
  - Firebase Firestore (live_user_profiles, companies, locations)
- **Used By:** Dashboard, rutiner, rapporter, all profile pages
- **DO NOT:** Change priority order without understanding full impact

### 2. resolveOrgContext
- **File:** public/core/auth.js:375
- **Risk:** HIGH
- **Why:** Central function for all org context resolution
- **Critical Rule:** All other functions MUST use this (no inline fallback logic)
- **Returns:** companyId, organizationId, locationId, primaryLocationId, locationIds
- **Used By:** prettyName, auth flows, session management, all data queries
- **DO NOT:** Create duplicate org resolution logic elsewhere

### 3. Canonical Routines Engine
- **File:** public/core/canonicalRoutines.js
- **Risk:** CRITICAL
- **Why:** HACCP compliance, 22 routine types, backend sync required
- **Critical Rules:**
  - Backend sync mandatory (functions/canonicalRoutines.js)
  - Risk definitions require compliance review
  - Temperature vs cleaning are separate (never mixed)
  - koeleskab_temperatur (CCP, daily) vs koeleskab_rengoering (GAG, weekly)
- **DO NOT:** Modify without backend sync and compliance review

---

## 🔗 CRITICAL DEPENDENCIES

### 1. resolveOrgContext → prettyName
- **Type:** Data flow
- **Critical:** YES
- **Why:** prettyName uses resolveOrgContext for companyId/locationId
- **Impact:** Breaking resolveOrgContext breaks all company/location display

### 2. canonicalRoutines → task_templates/instances
- **Type:** Data model
- **Critical:** YES
- **Why:** Defines structure for all routine data
- **Impact:** Changes require Firestore migration

### 3. setupAuthGate → onboarding flow
- **Type:** Business logic
- **Critical:** YES
- **Why:** Controls onboarding gate redirect
- **Impact:** Breaking this blocks new user onboarding

### 4. taskTitleResolver → rutiner.html
- **Type:** Display logic
- **Critical:** MEDIUM
- **Why:** All task titles depend on this
- **Impact:** Breaking this shows raw keys instead of pretty titles

### 5. Firebase Auth → all protected pages
- **Type:** Infrastructure
- **Critical:** YES
- **Why:** All pages use setupAuthGate
- **Impact:** Breaking auth blocks entire app

---

## 📁 FILES SCANNED

### ✅ Complete
- public/core/prettyName.js (410 lines)
- public/core/taskTitleResolver.js (324 lines)
- public/core/canonicalRoutines.js (715 lines)
- public/core/auth.js (908 lines) - partial
- public/core/firebase-config.js (24 lines)

### 🔄 Partial
- public/core/auth.js - internal helpers not yet registered

### ⏳ Pending
- public/core/layout.js (22,522 bytes)
- public/core/cooling-overlay.js (41,903 bytes)
- public/core/hot-holding-overlay.js (21,656 bytes)
- public/core/canonicalTasks.js (8,065 bytes)
- public/core/impersonation.js (3,360 bytes)
- public/core/i18n.js (3,194 bytes)
- public/core/session.js (4,163 bytes)
- public/core/processInstances.js (2,642 bytes)
- public/core/environment.js (3,987 bytes)
- public/modules/egenkontrol/
- functions/

---

## 🎯 PATTERNS IDENTIFIED

### Resolver Pattern
- Multiple fallback sources
- Priority order matters
- Central functions (resolveOrgContext) prevent duplication

### Canonical Mapping
- Raw keys → Pretty titles
- Normalization functions
- Consistent display across app

### Risk Management
- Each routine has: hazard, criticalLimit, deviationTrigger, defaultCorrectiveAction
- Prefilled deviation text for compliance
- CCP vs GAG classification

### Display Helpers
- Separate concerns: title, context, group, frequency, icon
- Reusable across modules
- Consistent UI

---

## 🚨 DUPLICATE RISK AREAS

### None Found Yet
- Will continue scanning for duplicates
- Focus areas:
  - Inline org context resolution (should use resolveOrgContext)
  - Inline title resolution (should use taskTitleResolver)
  - Duplicate Firebase queries

---

## 📝 NEXT ACTIONS

1. ✅ Register initial 11 helpers
2. ✅ Register canonical routines engine
3. ✅ Document high-risk areas
4. 🔄 Continue scanning public/core/ (9 files remaining)
5. ⏳ Scan public/modules/egenkontrol/
6. ⏳ Scan functions/
7. ⏳ Build dependency map
8. ⏳ Identify duplicates
9. ⏳ Plan surgical cleanups

---

## 🎓 KEY LEARNINGS

### Critical Rules
1. **prettyName priority:** live_user_profiles.profile.* FIRST
2. **Org context:** Use resolveOrgContext, never inline
3. **Canonical routines:** Backend sync mandatory
4. **22 routine types:** Do not add/remove without review
5. **Unique keys:** companyId + locationId + routineType + unitId + dateKey

### Architecture Insights
- Resolver pattern prevents duplication
- Canonical model ensures consistency
- Risk management built into data model
- Display logic separated from data logic

---

**Scan Status:** 20% complete  
**Next:** Continue scanning public/core/ files  
**ETA:** 2-3 hours for full codebase scan
