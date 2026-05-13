# STARTDAY DEMO FIX

## Problem
Ny demo logger:
```
task_instances count 0
After archive filter: 0
After hard dedupe: 0
```

**Root Cause:** `startDayForLocation` oprettede ikke task_instances fordi der ikke fandtes task_templates.

## Løsning

### 1. Auto-Create Demo Templates
Hvis `startDayForLocation` kaldes for en demo company uden templates:

```javascript
// Check if no templates exist
if (allTemplateDocs.length === 0) {
  // Check if this is a demo company
  const companySnap = await db.collection("companies").doc(companyId).get();
  const isDemo = companyData.isDemo === true || companyData.demoMode === true;
  
  if (isDemo) {
    console.log("[startDayForLocation] Demo company detected - creating canonical templates");
    
    // Create demo equipment
    await seedDemoEquipment({ companyId, locationId, userId: auth.uid });
    
    // Create canonical demo templates
    await seedCanonicalDemoTemplates({ companyId, locationId, userId: auth.uid });
    
    // Reload templates
    allTemplateDocs = await loadActiveTaskTemplates({ companyId, locationId });
    
    console.log("[startDayForLocation] Created canonical demo templates:", allTemplateDocs.length);
  }
}
```

### 2. Comprehensive Logging
Added detailed logging for debugging:

```javascript
console.log("[startDayForLocation] RESULT:", {
  companyId,
  locationId,
  dateKey: todayKey,
  templatesCount: allTemplateDocs.length,
  created: createdCount,
  updated: updatedCount,
  skipped: skippedCount,
  ensured: ensuredCount,
  newSchedule: newScheduleCount,
  legacy: legacyScheduleCount,
  disabledUnits: disabledUnitCount
});
```

### 3. Warning for Zero Instances
Added warning if templates exist but no instances created:

```javascript
if (allTemplateDocs.length > 0 && ensuredCount === 0) {
  console.error("[startDayForLocation] WARNING: Had templates but created 0 instances!", {
    templatesCount: allTemplateDocs.length,
    ensuredCount
  });
}
```

### 4. Enhanced Return Value
```javascript
return {
  ok: true,
  alreadyStarted,
  created: createdCount,
  updated: updatedCount,
  skipped: skippedCount,
  ensured: ensuredCount,           // NEW
  templatesCount: allTemplateDocs.length,  // NEW
  message: "..."
};
```

## Flow Diagram

### Before Fix:
```
startDayForLocation()
  ↓
loadActiveTaskTemplates() → 0 templates
  ↓
Skip instance creation (no templates)
  ↓
Return { ok: true, created: 0 }
  ↓
rutiner.html loads 0 instances ❌
```

### After Fix:
```
startDayForLocation()
  ↓
loadActiveTaskTemplates() → 0 templates
  ↓
Check if demo company → YES
  ↓
seedDemoEquipment() → 4 units created
  ↓
seedCanonicalDemoTemplates() → 12 templates created
  ↓
Reload templates → 12 templates
  ↓
Create instances for today → 12 instances
  ↓
Return { ok: true, created: 12, templatesCount: 12 }
  ↓
rutiner.html loads 12 instances ✅
```

## Expected Console Logs

### New Demo (No Templates):
```
[startDayForLocation] no active task_templates found { companyId: "...", locationId: "..." }
[startDayForLocation] Demo company detected - creating canonical templates
[seedDemoEquipment] Creating demo equipment
[seedDemoEquipment] Created 4 equipment units
[seedCanonicalDemoTemplates] Creating canonical demo templates
[seedCanonicalDemoTemplates] Created 12 canonical templates
[startDayForLocation] Created canonical demo templates: 12
[LOG B - startDayForLocation] Templates total: 12
[startDay] create instance { instanceId: "..." }
... (12 times)
[startDayForLocation] Schedule system usage: newSchedule=12, legacy=0, disabledUnits=0
[startDayForLocation] RESULT: {
  companyId: "...",
  locationId: "...",
  dateKey: "2026-04-28",
  templatesCount: 12,
  created: 12,
  updated: 0,
  skipped: 0,
  ensured: 12,
  newSchedule: 12,
  legacy: 0,
  disabledUnits: 0
}
```

### Existing Demo (Has Templates):
```
[LOG B - startDayForLocation] Templates total: 12
[startDay] create instance { instanceId: "..." }
... (12 times)
[startDayForLocation] RESULT: {
  templatesCount: 12,
  created: 12,
  ensured: 12
}
```

### Warning Case (Templates but No Instances):
```
[startDayForLocation] WARNING: Had templates but created 0 instances! {
  templatesCount: 12,
  ensuredCount: 0
}
```

## Files Changed

### Modified:
- `functions/index.js`:
  - `startDayForLocation`: Auto-create demo templates if none exist
  - Added comprehensive logging
  - Added warning for zero instances
  - Enhanced return value with `ensured` and `templatesCount`

### Unchanged:
- `functions/demoCanonicalTemplates.js` - Already has `seedDemoEquipment` and `seedCanonicalDemoTemplates`
- `functions/canonicalRoutines.js` - Already has canonical model
- `public/modules/egenkontrol/rutiner.html` - Already has dedupe logic

## Verification

### 1. Create New Demo
```bash
# Call createDemoEnvironment
# Expected: Creates company, location, templates, equipment
# Does NOT create instances (startDay does that)
```

### 2. Call startDayForLocation
```bash
# For new demo (no instances yet)
# Expected console logs:
[startDayForLocation] Demo company detected - creating canonical templates
[startDayForLocation] Created canonical demo templates: 12
[startDayForLocation] RESULT: { created: 12, ensured: 12, templatesCount: 12 }
```

### 3. Check Firestore
```javascript
// task_templates collection
// Should have 12 templates

// task_instances collection
// Should have 12 instances for today
// All should have:
{
  companyId: "...",
  locationId: "...",
  dateKey: "2026-04-28",
  routineType: "varemodtagelse" | "opvarmning" | ...,
  canonicalTaskKey: "varemodtagelse__default" | ...,
  status: "pending",
  isDemo: true
}
```

### 4. Check rutiner.html
```
# Should load 12 instances
# Console logs:
[rutiner load] task_instances count 12
[rutiner dedupe] After archive filter: 12 tasks
[rutiner dedupe] After hard dedupe: 12 tasks (0 duplicates removed)
```

## Edge Cases Handled

### 1. Demo Without Templates
✅ Auto-creates canonical templates + equipment
✅ Creates instances for today
✅ Returns `created: 12`

### 2. Demo With Templates
✅ Uses existing templates
✅ Creates instances for today
✅ Returns `created: 12` or `skipped: 12` if already exist

### 3. Non-Demo Without Templates
✅ Logs warning
✅ Does NOT auto-create templates
✅ Returns `created: 0`

### 4. Templates Exist But No Instances Created
✅ Logs warning with details
✅ Helps debug why instances weren't created

## Accept Criteria

✅ **Ny demo får mindst 12 canonical task_instances samme dag**
✅ **rutiner.html loader ikke 0 efter startDay**
✅ **Comprehensive logging viser templates/created/ensured counts**
✅ **Auto-create kun for demo companies**
✅ **Warning hvis templates men 0 instances**
✅ **Return value inkluderer ensured + templatesCount**

## Migration

For existing demos without templates:
```javascript
// Just call startDayForLocation
// It will auto-create templates if needed
```

For existing demos with old templates:
```javascript
// Call archiveLegacyDemoData first
await archiveLegacyDemoData({ companyId, locationId });

// Then call startDayForLocation
// It will create canonical templates
```

## Summary

**PROBLEM:** Demo startDay oprettede 0 instances fordi ingen templates
**SOLUTION:** Auto-create canonical demo templates hvis demo + ingen templates
**RESULT:** Nye demos får automatisk 12 canonical instances ved første startDay
