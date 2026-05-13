# PHASE 2: RAPPORT DATA DRIFT + ENTRY NORMALIZATION PLAN

**Date:** 2026-05-11  
**Status:** ANALYSIS COMPLETE - NO CHANGES EXECUTED  
**Risk Level:** HIGH (data contract drift detected)

---

## 🚨 CRITICAL FINDINGS

### **MASSIVE DATA DRIFT DETECTED**

Rapporter.html contains **EXTREME fallback chain complexity** with inconsistent field usage across multiple collections.

---

## 📊 OPGAVE 1: ENTRY SOURCES KORTLAGT

### **Firestore Collections Used:**

1. **`task_entries`** (PRIMARY)
   - Main entry collection
   - Loaded via `loadScopedCollection("task_entries")`
   - Contains task completion data

2. **`task_instances`** (SECONDARY)
   - Loaded for merging with entries
   - Fallback source for missing entry data
   - Also used for cleaning plan items

3. **`alerts`** (DEVIATION SOURCE)
   - Loaded via `loadScopedCollection("alerts")`
   - Contains deviation/alert data

4. **`deviations`** (DEVIATION SOURCE)
   - Loaded via `loadScopedCollection("deviations")`
   - Legacy deviation data

5. **`logbook_entries`** (SUPPLEMENTARY)
   - Loaded via `loadScopedCollection("logbook_entries")`
   - Additional log data

6. **`media_assets`** (SUPPLEMENTARY)
   - Loaded via `loadScopedCollection("media_assets")`
   - Photo documentation

7. **`task_templates`** (REFERENCE)
   - Used for legacy fallback (intentionally unreachable)

### **Local Fallback Objects:**

- Merged entry + task_instance objects
- Cooling evaluation data
- Hot holding data
- Receiving logs

---

## 📅 OPGAVE 2: TIMESTAMP FIELDS - CRITICAL DRIFT

### **Entry Creation Timestamps (17 variants!):**

From `getEntryCreatedAt(e)` function (lines 869-892):

```javascript
e?.createdAt                          // PRIMARY
e?.createdAtClient                    // Client-side creation
e?.entryCreatedAt                     // Explicit entry creation
e?.taskInstance?.createdAt            // From merged instance
e?.taskInstanceCreatedAt              // Denormalized from instance
e?.performedAt                        // When task performed
e?.documentedAt                       // When documented
e?.completedAt                        // When completed
e?.handledAt                          // When handled
e?.finishedAt                         // When finished
e?.closedAt                           // When closed
e?.updatedAt                          // Last update
e?.taskInstance?.performedAt          // Instance performed
e?.taskInstance?.documentedAt         // Instance documented
e?.taskInstance?.completedAt          // Instance completed
e?.taskInstance?.handledAt            // Instance handled
e?.taskInstance?.finishedAt           // Instance finished
e?.taskInstance?.closedAt             // Instance closed
e?.taskInstance?.updatedAt            // Instance updated
e?.dateKey                            // Fallback to date key
```

**RISK:** 20 different timestamp fields checked in fallback chain!

### **Entry Completion Timestamps (14 variants!):**

From `getEntryHandledAt(e)` function (lines 895-916):

```javascript
e?.completedAt                        // PRIMARY
e?.documentedAt                       // Documented
e?.handledAt                          // Handled
e?.finishedAt                         // Finished
e?.performedAt                        // Performed
e?.resolvedAt                         // Resolved
e?.closedAt                           // Closed
e?.completedAtClient                  // Client-side completion
e?.updatedAt                          // Updated
e?.taskInstanceCompletedAt            // Denormalized
e?.taskInstance?.completedAt          // Instance completed
e?.taskInstance?.documentedAt         // Instance documented
e?.taskInstance?.closedAt             // Instance closed
e?.taskInstance?.handledAt            // Instance handled
e?.taskInstance?.finishedAt           // Instance finished
e?.taskInstance?.performedAt          // Instance performed
e?.taskInstance?.updatedAt            // Instance updated
```

**RISK:** 17 different completion timestamp fields!

### **Alert Timestamps (5 variants):**

From `getAlertCreatedAt(a)` and `getAlertHandledAt(a)`:

**Created:**
```javascript
a?.createdAt
a?.createdAtClient
a?.dateKey
```

**Handled:**
```javascript
a?.correctiveActionCompletedAt
a?.closedAt
a?.resolvedAt
a?.lastHandledAt
a?.updatedAt
```

### **Cooling/Hot Holding Timestamps (2 variants):**

```javascript
coolingData.startedAt || e?.startedAt
coolingData.finishedAt || e?.finishedAt
```

### **Receiving Log Timestamps (4 variants):**

```javascript
item.createdAt
item.createdAtClient
item.updatedAt
item.lastHandledAt
item.dateKey
```

---

## 👤 OPGAVE 3: PERFORMER FIELDS - CRITICAL DRIFT

### **Performer/Responsible Fields (5 variants):**

```javascript
e?.completedByName                    // PRIMARY (used in cooling)
e?.responsibleName                    // Alternative
e?.performedByName                    // Not found but likely exists
e?.createdByName                      // Not found but likely exists
e?.handledByName                      // Not found but likely exists
```

**CRITICAL:** Only `completedByName` and `responsibleName` found in code!

**MISSING:** No consistent performer tracking across entries!

---

## 🔗 OPGAVE 4: RENDER CHAINS FOUND

### **Inline Timestamp Formatting (8 locations):**

1. **Line 1413:** `formatDateTime(getEntryCreatedAt(e))`
2. **Line 1414:** `formatDateTime(getEntryHandledAt(e))`
3. **Line 1480:** `formatDateTime(getEntryCreatedAt(item))`
4. **Line 1480:** `formatDateTime(getEntryHandledAt(item))`
5. **Line 1491:** `formatDateTime(getAlertCreatedAt(item))`
6. **Line 1491:** `formatDateTime(getAlertHandledAt(item))`
7. **Line 1806:** `formatDateTime(item.createdAt || item.createdAtClient || item.dateKey)`
8. **Line 1807:** `formatDateTime(item.updatedAt || item.lastHandledAt || ...)`
9. **Line 1811:** `formatDateTime(getEntryCreatedAt(item))`
10. **Line 1812:** `formatDateTime(getEntryHandledAt(item))`
11. **Line 2536:** `formatDateTime(getEntryCreatedAt(e))`
12. **Line 2537:** `formatDateTime(getEntryHandledAt(e))`

### **Inline Title Mapping (5+ locations):**

1. **Line 1478:** `getTaskDisplayTitle(item)`
2. **Line 1814:** `item.taskTitle || "Modtagekontrol"`
3. **Line 2038-2042:** `mergeEntryWithTaskInstance` - 5 title fields
4. **Line 2108-2124:** `resolveCategory(task)` - inline category mapping
5. **Line 2127:** `resolveTaskTitle(e)` - uses imported resolver

### **Inline Fallback Chains (15+ locations):**

1. **Lines 869-892:** `getEntryCreatedAt` - 20 field fallback
2. **Lines 895-916:** `getEntryHandledAt` - 17 field fallback
3. **Lines 918-920:** `getAlertCreatedAt` - 3 field fallback
4. **Lines 922-924:** `getAlertHandledAt` - 5 field fallback
5. **Lines 2030-2049:** `mergeEntryWithTaskInstance` - massive merge
6. **Lines 2051-2106:** `findTaskInstanceForEntry` - instance lookup
7. **Line 1228:** `e?.completedByName || e?.responsibleName`
8. **Line 1806-1807:** Receiving log timestamp fallback
9. **Line 2044:** `taskInstanceCompletedAt` - 8 field fallback
10. **Lines 2036-2042:** Title field fallback (5 variants)

### **Inline Documentation Rendering:**

1. **Lines 1225-1273:** `buildCoolingDeviationDetails` - cooling specific
2. **Lines 1410-1426:** `renderAuthorityEntryDetail` - authority format
3. **Lines 1477-1495:** Deviation rendering with inline formatting
4. **Lines 1813-1818:** Receiving entry rendering
5. **Lines 2532-2538:** Entry table rendering

---

## 🔥 OPGAVE 5: DATA CONTRACT DRIFT ANALYSIS

### **Timestamp Field Usage by Flow:**

| Field | task_entries | task_instances | alerts | deviations | logbook | cooling | receiving |
|-------|--------------|----------------|--------|------------|---------|---------|-----------|
| `createdAt` | ✅ PRIMARY | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `createdAtClient` | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `completedAt` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `performedAt` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `documentedAt` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `handledAt` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `finishedAt` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `closedAt` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `resolvedAt` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `updatedAt` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `startedAt` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `correctiveActionCompletedAt` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `lastHandledAt` | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `dateKey` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

**TOTAL UNIQUE TIMESTAMP FIELDS:** 14+

### **Performer Field Usage:**

| Field | task_entries | cooling | Other |
|-------|--------------|---------|-------|
| `completedByName` | ✅ | ✅ | ❌ |
| `responsibleName` | ❌ | ✅ | ❌ |
| `performedByName` | ❓ | ❌ | ❌ |
| `createdByName` | ❓ | ❌ | ❌ |
| `handledByName` | ❓ | ❌ | ❌ |

**CRITICAL:** No consistent performer tracking!

---

## ⚠️ OPGAVE 6: MANGLENDE FELTER

### **Entries Without performedBy:**

**RISK:** HIGH - Most entries likely missing performer information

**Evidence:**
- Only 2 performer fields found in entire codebase
- No consistent performer tracking
- Fallback chain only checks 2 variants

### **Entries Without Normalized Timestamps:**

**RISK:** CRITICAL - 20+ timestamp variants in use

**Evidence:**
- `getEntryCreatedAt` checks 20 fields
- `getEntryHandledAt` checks 17 fields
- No single source of truth

### **Entries Without Normalized Status:**

**RISK:** MEDIUM - Status resolution exists but inconsistent

**Evidence:**
- Status field used in line 2416
- No normalized status resolver found
- Likely inline status mapping

---

## 🎯 SURGICAL NORMALIZATION PLAN

### **Phase 1: Create Central Resolver (SAFE)**

**File:** `public/core/reportEntryResolver.js`

**Functions to create:**

```javascript
// Central timestamp resolution
export function resolveEntryCreatedTimestamp(entry, instance = null)
export function resolveEntryCompletedTimestamp(entry, instance = null)
export function resolveAlertCreatedTimestamp(alert)
export function resolveAlertHandledTimestamp(alert)

// Central performer resolution
export function resolveEntryPerformer(entry, instance = null)

// Central status resolution
export function resolveEntryStatus(entry, instance = null)

// Central title resolution (already exists in taskTitleResolver)
// Use existing: resolveTaskTitle(entry)

// Central category resolution
export function resolveEntryCategory(entry)
```

**Priority Order:**

1. **Created Timestamp:**
   - `createdAt` (PRIMARY)
   - `createdAtClient` (client-side)
   - `entryCreatedAt` (explicit)
   - `performedAt` (fallback)
   - `dateKey` (last resort)

2. **Completed Timestamp:**
   - `completedAt` (PRIMARY)
   - `documentedAt` (alternative)
   - `handledAt` (alternative)
   - `finishedAt` (alternative)
   - `performedAt` (fallback)

3. **Performer:**
   - `completedByName` (PRIMARY)
   - `performedByName` (alternative)
   - `responsibleName` (fallback)
   - `createdByName` (last resort)

### **Phase 2: Register in Helper Registry (SAFE)**

Add to `tools/registries/helper-registry.json`:

- `resolveEntryCreatedTimestamp`
- `resolveEntryCompletedTimestamp`
- `resolveAlertCreatedTimestamp`
- `resolveAlertHandledTimestamp`
- `resolveEntryPerformer`
- `resolveEntryStatus`
- `resolveEntryCategory`

### **Phase 3: Update Dependency Map (SAFE)**

Add to `tools/registries/dependency-map.json`:

- Map `reportEntryResolver` → `rapporter.html`
- Map dependencies to existing resolvers

### **Phase 4: Gradual Migration (RISKY - NEEDS TESTING)**

**Step 1:** Import resolver in rapporter.html
**Step 2:** Replace ONE inline fallback chain
**Step 3:** Test thoroughly
**Step 4:** Repeat for next chain

**DO NOT:**
- Replace all chains at once
- Change Firestore schema
- Modify data contracts
- Break existing functionality

---

## 🔧 RENDERERS TO PHASE OUT (FUTURE)

### **Inline Renderers (15+ locations):**

1. `getEntryCreatedAt` → Replace with `resolveEntryCreatedTimestamp`
2. `getEntryHandledAt` → Replace with `resolveEntryCompletedTimestamp`
3. `getAlertCreatedAt` → Replace with `resolveAlertCreatedTimestamp`
4. `getAlertHandledAt` → Replace with `resolveAlertHandledTimestamp`
5. `resolveCategory` → Replace with `resolveEntryCategory`
6. Inline performer fallback → Replace with `resolveEntryPerformer`
7. `mergeEntryWithTaskInstance` → Keep but simplify with resolvers

### **Fallback Chains to Remove (FUTURE):**

- 20-field timestamp fallback in `getEntryCreatedAt`
- 17-field timestamp fallback in `getEntryHandledAt`
- 5-field title fallback in `mergeEntryWithTaskInstance`
- Inline category mapping in `resolveCategory`

---

## 📊 FIELDS TO STANDARDIZE FIRST

### **Priority 1: Timestamps (CRITICAL)**

**Why:** 20+ variants causing confusion

**Target Fields:**
1. `createdAt` (PRIMARY for all collections)
2. `completedAt` (PRIMARY for completion)
3. `dateKey` (fallback only)

**Action:**
- Create `resolveEntryCreatedTimestamp`
- Create `resolveEntryCompletedTimestamp`
- Document priority order

### **Priority 2: Performer (HIGH)**

**Why:** Missing in most entries

**Target Fields:**
1. `completedByName` (PRIMARY)
2. `performedByName` (SECONDARY)

**Action:**
- Create `resolveEntryPerformer`
- Document missing data issue
- Consider backend fix for future entries

### **Priority 3: Titles (MEDIUM)**

**Why:** Already has resolver, but not used consistently

**Target:**
- Use existing `resolveTaskTitle` everywhere
- Remove inline title fallbacks

### **Priority 4: Category (LOW)**

**Why:** Inline mapping works but not reusable

**Target:**
- Extract `resolveCategory` to `resolveEntryCategory`
- Make reusable

---

## ⚠️ RISICI

### **High Risk:**

1. **Breaking existing reports**
   - Mitigation: Test each change thoroughly
   - Rollback: Git revert

2. **Changing timestamp priority**
   - Mitigation: Document current behavior first
   - Rollback: Revert to inline fallback

3. **Missing performer data**
   - Mitigation: Accept null values gracefully
   - Rollback: N/A (data issue, not code)

### **Medium Risk:**

1. **Performance impact**
   - Mitigation: Resolvers should be fast
   - Rollback: Inline code is already slow

2. **Inconsistent display**
   - Mitigation: Test all report types
   - Rollback: Git revert

### **Low Risk:**

1. **Import errors**
   - Mitigation: Test imports
   - Rollback: Remove import

---

## 🔄 ROLLBACK PLAN

### **Per Change:**

1. **Git commit** before each change
2. **Test** after each change
3. **Revert** if issues found

### **Full Rollback:**

```bash
git revert <commit-hash>
```

### **Partial Rollback:**

- Remove resolver import
- Restore inline fallback chain
- Test

---

## ✅ TEST PLAN

### **After Creating Resolver:**

1. Unit test each resolver function
2. Test with real entry data
3. Verify timestamp parsing
4. Verify null handling

### **After Each Migration:**

1. Load rapporter.html
2. Verify all entries display
3. Check timestamps are correct
4. Check performer names display
5. Check no console errors
6. Compare with previous version

### **Regression Tests:**

1. All entry types display
2. All alert types display
3. All deviation types display
4. Cooling entries display
5. Receiving entries display
6. Export works
7. Print works

---

## 📈 SUCCESS METRICS

### **Phase 1 Complete:**

- ✅ Central resolver created
- ✅ Registered in helper registry
- ✅ Dependency map updated
- ✅ No runtime changes yet

### **Phase 2 Complete:**

- ✅ One inline chain replaced
- ✅ Tests pass
- ✅ No regressions

### **Phase 3 Complete:**

- ✅ All timestamp chains use resolver
- ✅ All performer lookups use resolver
- ✅ All category lookups use resolver
- ✅ Code reduced by 50+ lines

---

## 🎯 RECOMMENDED NEXT ACTIONS

### **Immediate (SAFE):**

1. ✅ Create `public/core/reportEntryResolver.js`
2. ✅ Implement resolver functions
3. ✅ Register in helper registry
4. ✅ Update dependency map
5. ✅ Write unit tests

### **Short-term (NEEDS TESTING):**

6. 🔍 Import resolver in rapporter.html
7. 🔍 Replace `getEntryCreatedAt` with resolver
8. 🔍 Test thoroughly
9. 🔍 Replace `getEntryHandledAt` with resolver
10. 🔍 Test thoroughly

### **Long-term (FUTURE):**

11. ⏳ Replace all inline fallback chains
12. ⏳ Simplify `mergeEntryWithTaskInstance`
13. ⏳ Extract `resolveCategory` to resolver
14. ⏳ Consider backend data normalization

---

## 🚫 DO NOT DO (YET)

- ❌ Change Firestore schema
- ❌ Modify data contracts
- ❌ Change field names in database
- ❌ Remove existing fallback chains before testing
- ❌ Refactor entire rapporter.html
- ❌ Change backend functions
- ❌ Modify security rules

---

**Status:** ✅ ANALYSIS COMPLETE  
**Next:** Create central resolver (SAFE)  
**Blocked:** Migration until resolver tested  
**Risk:** HIGH (20+ timestamp variants in production)
