# REPORT ENTRY NORMALIZATION

**File:** `public/core/reportEntryResolver.js`  
**Created:** 2026-05-11  
**Phase:** 2 - Foundation  
**Status:** IMPLEMENTED - NOT YET USED IN RUNTIME

---

## PURPOSE

Central resolver for normalizing report entries from multiple Firestore collections with inconsistent schemas.

**Problem Solved:**
- 20+ timestamp field variants
- 5+ performer field variants
- 15+ inline fallback chains
- 9+ duplicate render logic instances
- Inconsistent data contracts

---

## FUNCTIONS

### **normalizeFirestoreDate(value)**

Converts Firestore Timestamp, Date, ISO string, or null to JavaScript Date.

**Handles:**
- Firestore Timestamp with `toDate()`
- JavaScript Date objects
- ISO strings
- Timestamp numbers
- Null/undefined

**Returns:** `Date | null`

---

### **formatReportDate(value, fallback = "—")**

Formats date for Danish locale display.

**Format:** `dd.MM.yyyy HH:mm` (Danish short date + time)

**Returns:** `string`

---

### **resolveEntryCreatedTimestamp(entry, instance = null)**

Resolves entry creation timestamp with priority order.

**Priority:**
1. `entry.createdAt` (PRIMARY)
2. `entry.createdAtClient` (client-side)
3. `entry.entryCreatedAt` (explicit)
4. `entry.taskInstanceCreatedAt` (denormalized)
5. `entry.taskInstance.createdAt` (nested)
6. `instance.createdAt` (separate parameter)
7. `entry.performedAt` (fallback)
8. `entry.documentedAt` (fallback)
9. `entry.dateKey` (last resort - no time)

**Returns:**
```javascript
{
  timestamp: Date | null,
  source: string,
  warnings: string[]
}
```

**Warnings:**
- `used_client_timestamp`
- `used_nested_instance`
- `used_separate_instance`
- `fallback_performed_at`
- `fallback_documented_at`
- `fallback_datekey_used`
- `missing_created_at`

---

### **resolveEntryCompletedTimestamp(entry, instance = null)**

Resolves entry completion timestamp with priority order.

**Priority:**
1. `entry.completedAt` (PRIMARY)
2. `entry.completedAtClient` (client-side)
3. `entry.documentedAt` (alternative)
4. `entry.handledAt` (alternative)
5. `entry.finishedAt` (alternative)
6. `entry.closedAt` (alternative)
7. `entry.taskInstanceCompletedAt` (denormalized)
8. `entry.taskInstance.completedAt` (nested)
9. `instance.completedAt` (separate parameter)
10. `entry.performedAt` (fallback)
11. `entry.updatedAt` (last resort)

**Returns:**
```javascript
{
  timestamp: Date | null,
  source: string,
  warnings: string[]
}
```

**Warnings:**
- `used_client_timestamp`
- `used_documented_at`
- `used_handled_at`
- `used_finished_at`
- `used_closed_at`
- `used_nested_instance`
- `used_separate_instance`
- `fallback_performed_at`
- `fallback_updated_at`
- `missing_completed_at`

---

### **resolveAlertCreatedTimestamp(alert)**

Resolves alert creation timestamp.

**Priority:**
1. `alert.createdAt`
2. `alert.createdAtClient`
3. `alert.dateKey`

**Returns:** Same as entry timestamps

---

### **resolveAlertHandledTimestamp(alert)**

Resolves alert handled timestamp.

**Priority:**
1. `alert.correctiveActionCompletedAt`
2. `alert.closedAt`
3. `alert.resolvedAt`
4. `alert.lastHandledAt`
5. `alert.updatedAt`

**Returns:** Same as entry timestamps

---

### **resolveEntryPerformer(entry, instance = null)**

Resolves who completed the task.

**Priority:**
1. `entry.completedByName` (PRIMARY)
2. `entry.performedByName` (alternative)
3. `entry.responsibleName` (fallback)
4. `entry.createdByName` (fallback)
5. `entry.userName` (generic fallback)
6. `entry.userEmail` (last resort)
7. `entry.uid` (very last resort - truncated)
8. `"Ukendt"` (default)

**Returns:**
```javascript
{
  name: string,
  source: string,
  warnings: string[]
}
```

**Warnings:**
- `used_responsible_name`
- `used_created_by`
- `used_generic_username`
- `used_email_as_name`
- `used_uid_as_name`
- `missing_performer`

---

### **resolveEntryStatus(entry, instance = null)**

Resolves entry status.

**Priority:**
1. `entry.status`
2. `instance.status`
3. Inferred from completion timestamp
4. `"unknown"` (default)

**Returns:**
```javascript
{
  status: string,
  source: string,
  warnings: string[]
}
```

**Warnings:**
- `used_instance_status`
- `inferred_from_timestamp`
- `missing_status`

---

### **resolveEntryCategory(entry, instance = null)**

Resolves entry category.

**Priority:**
1. `entry.category` (explicit)
2. Inferred from `templateKey` / `canonicalTaskKey` / `routineType`
3. `entry.taskType` (fallback)
4. `"Egenkontrol"` (default)

**Category Mapping:**
- `rengoering` / `rengøring` → "Rengøring"
- `temperatur` → "Temperaturkontrol"
- `nedkoeling` / `nedkøling` → "Nedkøling"
- `opvarmning` → "Opvarmning"
- `varmholdelse` → "Varmholdelse"
- `varemodtagelse` → "Varemodtagelse"
- `tre_timers` → "3-timers regel"
- `adskillelse` → "Adskillelse"
- `allergener` → "Allergener"
- `opbevaring` → "Opbevaring"
- `personlig_hygiejne` → "Personlig hygiejne"
- `sporbarhed` → "Sporbarhed"

**Returns:**
```javascript
{
  category: string,
  source: string,
  warnings: string[]
}
```

**Warnings:**
- `inferred_from_key`
- `used_task_type`
- `missing_category`

---

### **normalizeReportEntry(entry, instance = null)**

**MAIN FUNCTION** - Normalizes complete report entry.

**Returns stable contract:**
```javascript
{
  title: string,                    // From resolveTaskTitle()
  createdAt: Date | null,           // Normalized timestamp
  completedAt: Date | null,         // Normalized timestamp
  createdAtFormatted: string,       // Danish formatted
  completedAtFormatted: string,     // Danish formatted
  performedByName: string,          // Who completed
  createdByName: string,            // Who created
  status: string,                   // Normalized status
  category: string,                 // Normalized category
  measurement: string,              // Value/temp/measurement
  documentation: string,            // Note/comment/description
  equipment: string,                // Equipment/unit/area name
  source: {                         // Source tracking
    created: string,
    completed: string,
    performer: string,
    status: string,
    category: string
  },
  warnings: string[]                // All warnings (deduplicated)
}
```

**Usage:**
```javascript
import { normalizeReportEntry } from './core/reportEntryResolver.js';

const normalized = normalizeReportEntry(entry, instance);

console.log(normalized.title);              // "Køleskab temp."
console.log(normalized.createdAtFormatted); // "11.05.2026 10:00"
console.log(normalized.performedByName);    // "John Doe"
console.log(normalized.warnings);           // ["used_client_timestamp"]
```

---

## WARNINGS REFERENCE

### **Timestamp Warnings:**
- `used_client_timestamp` - Used client-side timestamp instead of server
- `used_nested_instance` - Used nested taskInstance field
- `used_separate_instance` - Used separately passed instance parameter
- `fallback_performed_at` - Fell back to performedAt field
- `fallback_documented_at` - Fell back to documentedAt field
- `fallback_updated_at` - Fell back to updatedAt field
- `fallback_datekey_used` - Used dateKey string (no time available)
- `missing_created_at` - No creation timestamp found
- `missing_completed_at` - No completion timestamp found

### **Performer Warnings:**
- `used_responsible_name` - Used responsibleName instead of completedByName
- `used_created_by` - Used createdByName as fallback
- `used_generic_username` - Used generic userName field
- `used_email_as_name` - Used email address as name
- `used_uid_as_name` - Used user ID as name (truncated)
- `missing_performer` - No performer information found

### **Status Warnings:**
- `used_instance_status` - Used instance status instead of entry status
- `inferred_from_timestamp` - Inferred status from completion timestamp
- `missing_status` - No status information found

### **Category Warnings:**
- `inferred_from_key` - Inferred category from templateKey
- `used_task_type` - Used taskType field as fallback
- `missing_category` - No category information found

### **Entry Warnings:**
- `missing_entry` - Entry object was null/undefined

---

## INTEGRATION

### **Current Status:**

✅ **IMPLEMENTED** - Resolver created  
❌ **NOT USED** - Not yet integrated in rapporter.html  
❌ **NOT TESTED** - No runtime testing yet

### **Next Steps:**

1. **Validate implementation:**
   ```bash
   node --check public/core/reportEntryResolver.js
   ```

2. **Test with sample data:**
   - Use `tools/tests/reportEntryResolver.test-data.json`
   - Test all 15 test cases
   - Verify warnings are correct

3. **Integration (FUTURE):**
   - Import in `rapporter.html`
   - Replace ONE inline chain (e.g., `getEntryCreatedAt`)
   - Test thoroughly
   - Repeat for other chains

---

## MIGRATION PLAN

### **Phase 1: Foundation (COMPLETE)**

✅ Create `reportEntryResolver.js`  
✅ Implement all functions  
✅ Create test data  
✅ Register in helper registry  
✅ Update dependency map  
✅ Document usage

### **Phase 2: Gradual Migration (FUTURE)**

⏳ Import resolver in `rapporter.html`  
⏳ Replace `getEntryCreatedAt` with `resolveEntryCreatedTimestamp`  
⏳ Test thoroughly  
⏳ Replace `getEntryHandledAt` with `resolveEntryCompletedTimestamp`  
⏳ Test thoroughly  
⏳ Replace remaining inline chains  
⏳ Remove old functions

### **Phase 3: Cleanup (FUTURE)**

⏳ Simplify `mergeEntryWithTaskInstance`  
⏳ Remove duplicate logic  
⏳ Consider backend normalization

---

## RISK MITIGATION

### **Safe Defaults:**

- All functions return safe defaults
- Null entries handled gracefully
- Invalid dates return null
- Missing performers return "Ukendt"
- Missing categories return "Egenkontrol"

### **Warning System:**

- All fallbacks generate warnings
- Warnings are tracked and deduplicated
- Enables monitoring of data quality
- Helps identify missing data patterns

### **Source Tracking:**

- Every resolved field tracks its source
- Enables debugging
- Helps identify data drift
- Supports data quality audits

---

## GOVERNANCE

### **DO NOT:**

- ❌ Change priority order without documentation
- ❌ Remove warnings without understanding impact
- ❌ Skip source tracking
- ❌ Return undefined (always return safe defaults)
- ❌ Throw errors (handle gracefully)

### **ALWAYS:**

- ✅ Document priority order changes
- ✅ Add warnings for fallbacks
- ✅ Track source of resolved data
- ✅ Return safe defaults
- ✅ Handle null/undefined gracefully
- ✅ Test with real data

---

## TESTING

### **Test Data Location:**

`tools/tests/reportEntryResolver.test-data.json`

### **Test Cases:**

1. Normal completed entry
2. Entry with only dateKey
3. Entry with taskInstance nested fields
4. Alert entry
5. Entry with missing performer
6. Entry with mixed timestamp fields
7. Entry with separate instance parameter
8. Entry with only updatedAt
9. Entry with email as performer
10. Entry with uid as performer
11. Entry with Firestore Timestamp objects
12. Entry with no timestamps at all
13. Entry with ambiguous timestamps
14. Minimal entry with defaults
15. Entry with inferred status

### **Edge Cases:**

- Null entry
- Undefined entry
- Invalid date formats
- Empty strings
- Firestore Timestamp objects

---

## DEPENDENCIES

### **Imports:**

- `resolveTaskTitle` from `./taskTitleResolver.js`

### **Used By:**

- (FUTURE) `rapporter.html`
- (FUTURE) Other report rendering modules

### **Related:**

- `taskTitleResolver.js` - Title resolution
- `prettyName.js` - Company/location resolution
- `canonicalRoutines.js` - Routine type mapping

---

## PERFORMANCE

### **Optimization:**

- Early returns on first match
- No expensive operations
- Minimal object creation
- Efficient string operations

### **Caching:**

- Not implemented (not needed for current usage)
- Consider if used in loops

---

**Status:** ✅ FOUNDATION COMPLETE  
**Next:** Test with sample data  
**Migration:** Not started (waiting for approval)
