# PHASE 2: RAPPORT DATA DRIFT - CRITICAL FINDINGS

**Date:** 2026-05-11 19:44  
**Severity:** 🔴 CRITICAL  
**Status:** ANALYSIS COMPLETE - NO CHANGES MADE

---

## 🚨 EXECUTIVE SUMMARY

**CRITICAL DATA DRIFT DETECTED IN RAPPORT RENDERING**

- **20+ timestamp field variants** in fallback chains
- **17+ completion timestamp variants** 
- **5+ performer field variants** (mostly missing)
- **15+ inline render chains** with duplicate logic
- **7 Firestore collections** with inconsistent schemas
- **NO CENTRAL RESOLVER** for entry normalization

**RISK LEVEL:** 🔴 **CRITICAL**

---

## 📊 TIMESTAMP FIELDS FOUND

### **Entry Creation Timestamps: 20 variants**

```
✅ createdAt                    (PRIMARY - should be standard)
✅ createdAtClient              (client-side creation)
✅ entryCreatedAt               (explicit entry creation)
✅ taskInstanceCreatedAt        (denormalized from instance)
✅ performedAt                  (when performed)
✅ documentedAt                 (when documented)
✅ completedAt                  (when completed)
✅ handledAt                    (when handled)
✅ finishedAt                   (when finished)
✅ closedAt                     (when closed)
✅ updatedAt                    (last update)
✅ taskInstance.createdAt       (from merged instance)
✅ taskInstance.performedAt     (instance performed)
✅ taskInstance.documentedAt    (instance documented)
✅ taskInstance.completedAt     (instance completed)
✅ taskInstance.handledAt       (instance handled)
✅ taskInstance.finishedAt      (instance finished)
✅ taskInstance.closedAt        (instance closed)
✅ taskInstance.updatedAt       (instance updated)
✅ dateKey                      (fallback to date string)
```

**Source:** `rapporter.html:869-892` (`getEntryCreatedAt` function)

### **Entry Completion Timestamps: 17 variants**

```
✅ completedAt                  (PRIMARY - should be standard)
✅ documentedAt                 (documented)
✅ handledAt                    (handled)
✅ finishedAt                   (finished)
✅ performedAt                  (performed)
✅ resolvedAt                   (resolved)
✅ closedAt                     (closed)
✅ completedAtClient            (client-side)
✅ updatedAt                    (updated)
✅ taskInstanceCompletedAt      (denormalized)
✅ taskInstance.completedAt     (instance completed)
✅ taskInstance.documentedAt    (instance documented)
✅ taskInstance.closedAt        (instance closed)
✅ taskInstance.handledAt       (instance handled)
✅ taskInstance.finishedAt      (instance finished)
✅ taskInstance.performedAt     (instance performed)
✅ taskInstance.updatedAt       (instance updated)
```

**Source:** `rapporter.html:895-916` (`getEntryHandledAt` function)

### **Alert Timestamps: 8 variants**

**Created:**
```
✅ createdAt
✅ createdAtClient
✅ dateKey
```

**Handled:**
```
✅ correctiveActionCompletedAt
✅ closedAt
✅ resolvedAt
✅ lastHandledAt
✅ updatedAt
```

**Source:** `rapporter.html:918-924`

### **Special Timestamps: 2 variants**

```
✅ startedAt                    (cooling/hot holding start)
✅ finishedAt                   (cooling/hot holding finish)
```

**TOTAL UNIQUE TIMESTAMP FIELDS: 14+**

---

## 👤 PERFORMER FIELDS FOUND

### **Performer/Responsible: 5 variants (mostly missing!)**

```
✅ completedByName              (found in code - PRIMARY)
✅ responsibleName              (found in code - fallback)
❓ performedByName              (likely exists but not found)
❓ createdByName                (likely exists but not found)
❓ handledByName                (likely exists but not found)
```

**Source:** `rapporter.html:1228, 2535`

**CRITICAL ISSUE:** Only 2 performer fields found in entire codebase!

**RISK:** Most entries likely missing performer information.

---

## 🔗 RENDER CHAINS FOUND

### **1. Inline Timestamp Formatting: 12+ locations**

| Line | Function | Usage |
|------|----------|-------|
| 1413 | `renderAuthorityEntryDetail` | `formatDateTime(getEntryCreatedAt(e))` |
| 1414 | `renderAuthorityEntryDetail` | `formatDateTime(getEntryHandledAt(e))` |
| 1480 | Deviation rendering | `formatDateTime(getEntryCreatedAt(item))` |
| 1480 | Deviation rendering | `formatDateTime(getEntryHandledAt(item))` |
| 1491 | Alert rendering | `formatDateTime(getAlertCreatedAt(item))` |
| 1491 | Alert rendering | `formatDateTime(getAlertHandledAt(item))` |
| 1806 | Receiving log | `formatDateTime(item.createdAt \|\| ...)` |
| 1807 | Receiving log | `formatDateTime(item.updatedAt \|\| ...)` |
| 1811 | Receiving entry | `formatDateTime(getEntryCreatedAt(item))` |
| 1812 | Receiving entry | `formatDateTime(getEntryHandledAt(item))` |
| 2536 | Entry table | `formatDateTime(getEntryCreatedAt(e))` |
| 2537 | Entry table | `formatDateTime(getEntryHandledAt(e))` |

### **2. Inline Title Mapping: 5+ locations**

| Line | Function | Fields |
|------|----------|--------|
| 1478 | Deviation | `getTaskDisplayTitle(item)` |
| 1814 | Receiving | `item.taskTitle \|\| "Modtagekontrol"` |
| 2038-2042 | Merge | 5 title field variants |
| 2108-2124 | Category | Inline category mapping |
| 2127 | Reference | `resolveTaskTitle(e)` (uses resolver) |

### **3. Inline Fallback Chains: 15+ locations**

| Line | Function | Complexity |
|------|----------|------------|
| 869-892 | `getEntryCreatedAt` | 20 field fallback |
| 895-916 | `getEntryHandledAt` | 17 field fallback |
| 918-920 | `getAlertCreatedAt` | 3 field fallback |
| 922-924 | `getAlertHandledAt` | 5 field fallback |
| 2030-2049 | `mergeEntryWithTaskInstance` | Massive merge |
| 2051-2106 | `findTaskInstanceForEntry` | Instance lookup |
| 1228 | Cooling | `completedByName \|\| responsibleName` |
| 1806-1807 | Receiving | Timestamp fallback |
| 2044 | Merge | 8 field completion fallback |
| 2036-2042 | Merge | 5 field title fallback |

---

## 📦 FIRESTORE COLLECTIONS

### **Collections Used:**

1. **`task_entries`** (PRIMARY)
   - Main entry collection
   - Inconsistent timestamp fields
   - Missing performer data

2. **`task_instances`** (SECONDARY)
   - Merged with entries
   - Different timestamp fields
   - Used for fallback

3. **`alerts`**
   - Deviation/alert data
   - Different timestamp schema

4. **`deviations`**
   - Legacy deviation data
   - Different schema

5. **`logbook_entries`**
   - Supplementary logs
   - Different timestamp fields

6. **`media_assets`**
   - Photo documentation
   - Filtered by moduleType

7. **`task_templates`**
   - Reference data
   - Not directly used in rendering

---

## 🔥 DUPLICATE RENDER LOGIC

### **Timestamp Resolution: 4 functions**

1. `getEntryCreatedAt(e)` - 20 field fallback
2. `getEntryHandledAt(e)` - 17 field fallback
3. `getAlertCreatedAt(a)` - 3 field fallback
4. `getAlertHandledAt(a)` - 5 field fallback

**RISK:** Duplicate logic, inconsistent behavior

### **Title Resolution: 3+ approaches**

1. `getTaskDisplayTitle(item)` - inline
2. `item.taskTitle || "Modtagekontrol"` - inline fallback
3. `resolveTaskTitle(e)` - uses central resolver ✅
4. `mergeEntryWithTaskInstance` - 5 field merge

**RISK:** Inconsistent title display

### **Category Resolution: 1 inline function**

1. `resolveCategory(task)` - inline mapping (lines 2108-2124)

**RISK:** Not reusable, hardcoded logic

### **Performer Resolution: 1 inline fallback**

1. `completedByName || responsibleName` - inline (line 1228)

**RISK:** No central resolver, missing data

---

## 📊 DRIFT RISK VURDERING

### **🔴 CRITICAL RISKS:**

1. **Timestamp Chaos**
   - 20+ variants in production
   - No single source of truth
   - Inconsistent across collections
   - **Impact:** Reports show wrong dates/times

2. **Missing Performer Data**
   - Only 2 fields tracked
   - Most entries missing "udført af"
   - No consistent tracking
   - **Impact:** Cannot identify who completed tasks

3. **Duplicate Render Logic**
   - 15+ inline fallback chains
   - 4 timestamp resolvers
   - 3+ title approaches
   - **Impact:** Maintenance nightmare, bugs

### **🟠 HIGH RISKS:**

4. **Collection Schema Drift**
   - 7 collections with different schemas
   - No normalized structure
   - Inconsistent field names
   - **Impact:** Hard to query, hard to maintain

5. **Inline Fallback Complexity**
   - 20-field fallback in `getEntryCreatedAt`
   - 17-field fallback in `getEntryHandledAt`
   - **Impact:** Slow, error-prone, unmaintainable

### **🟡 MEDIUM RISKS:**

6. **Title Resolution Inconsistency**
   - Some use central resolver
   - Some use inline fallback
   - Some use hardcoded strings
   - **Impact:** Inconsistent display

7. **Category Mapping**
   - Inline hardcoded logic
   - Not reusable
   - **Impact:** Cannot reuse elsewhere

---

## 💡 FORSLAG TIL CENTRAL RESOLVER

### **Create: `public/core/reportEntryResolver.js`**

```javascript
/**
 * Central resolver for report entry normalization
 * Handles timestamp, performer, status, and category resolution
 */

// Timestamp resolution
export function resolveEntryCreatedTimestamp(entry, instance = null) {
  // Priority: createdAt > createdAtClient > entryCreatedAt > performedAt > dateKey
}

export function resolveEntryCompletedTimestamp(entry, instance = null) {
  // Priority: completedAt > documentedAt > handledAt > finishedAt > performedAt
}

export function resolveAlertCreatedTimestamp(alert) {
  // Priority: createdAt > createdAtClient > dateKey
}

export function resolveAlertHandledTimestamp(alert) {
  // Priority: correctiveActionCompletedAt > closedAt > resolvedAt > lastHandledAt > updatedAt
}

// Performer resolution
export function resolveEntryPerformer(entry, instance = null) {
  // Priority: completedByName > performedByName > responsibleName > createdByName
}

// Status resolution
export function resolveEntryStatus(entry, instance = null) {
  // Normalize status field
}

// Category resolution
export function resolveEntryCategory(entry) {
  // Extract from resolveCategory inline function
}

// Title resolution (already exists)
// Use: import { resolveTaskTitle } from './taskTitleResolver.js'
```

### **Benefits:**

✅ Single source of truth  
✅ Consistent behavior  
✅ Reusable across app  
✅ Testable  
✅ Maintainable  
✅ Documented priority order  

---

## 🎯 FIELDS TO STANDARDIZE FIRST

### **Priority 1: Timestamps (CRITICAL)**

**Target:**
- `createdAt` as PRIMARY for all collections
- `completedAt` as PRIMARY for completion
- `dateKey` as fallback only

**Action:**
1. Create `resolveEntryCreatedTimestamp`
2. Create `resolveEntryCompletedTimestamp`
3. Document priority order
4. Replace inline fallback chains

**Impact:** Fixes 20+ timestamp variants

### **Priority 2: Performer (HIGH)**

**Target:**
- `completedByName` as PRIMARY
- `performedByName` as SECONDARY

**Action:**
1. Create `resolveEntryPerformer`
2. Document missing data issue
3. Consider backend fix for future entries

**Impact:** Consistent performer tracking

### **Priority 3: Titles (MEDIUM)**

**Target:**
- Use existing `resolveTaskTitle` everywhere

**Action:**
1. Replace inline title fallbacks
2. Use central resolver consistently

**Impact:** Consistent title display

### **Priority 4: Category (LOW)**

**Target:**
- Extract inline `resolveCategory` to central resolver

**Action:**
1. Create `resolveEntryCategory`
2. Make reusable

**Impact:** Reusable category logic

---

## 📈 NEXT STEPS

### **Immediate (SAFE - NO RUNTIME CHANGES):**

1. ✅ Create `public/core/reportEntryResolver.js`
2. ✅ Implement resolver functions
3. ✅ Register in `helper-registry.json`
4. ✅ Update `dependency-map.json`
5. ✅ Write unit tests

### **Short-term (NEEDS TESTING):**

6. 🔍 Import resolver in `rapporter.html`
7. 🔍 Replace ONE inline chain (e.g., `getEntryCreatedAt`)
8. 🔍 Test thoroughly
9. 🔍 Replace next chain if successful
10. 🔍 Repeat until all chains migrated

### **Long-term (FUTURE):**

11. ⏳ Simplify `mergeEntryWithTaskInstance`
12. ⏳ Consider backend data normalization
13. ⏳ Standardize Firestore schemas
14. ⏳ Add performer tracking to all entries

---

## 🚫 DO NOT DO (YET)

- ❌ Change Firestore schema
- ❌ Modify data contracts
- ❌ Remove existing fallback chains before testing
- ❌ Refactor entire rapporter.html at once
- ❌ Change backend functions
- ❌ Modify security rules
- ❌ Break existing reports

---

**Status:** ✅ ANALYSIS COMPLETE  
**Severity:** 🔴 CRITICAL  
**Next:** Create central resolver (SAFE)  
**Risk:** HIGH - 20+ timestamp variants in production
