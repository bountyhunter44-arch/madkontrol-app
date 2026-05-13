# Canonical Engine Test Guide

## Test 1: Generate Templates

### Via Firebase Console

1. Go to Firebase Console → Functions
2. Find `adminBackfillCanonicalTasks`
3. Call with:
```json
{
  "companyId": "YOUR_COMPANY_ID",
  "locationId": "YOUR_LOCATION_ID"
}
```

### Expected Result

```json
{
  "ok": true,
  "companyId": "YOUR_COMPANY_ID",
  "locationId": "YOUR_LOCATION_ID",
  "dateKey": "2026-04-27",
  "templates": {
    "created": 17,
    "updated": 0,
    "archived": 0
  },
  "instances": {
    "ok": true,
    "instancesCreated": 25,
    "instancesUpdated": 0,
    "instancesArchived": 0
  }
}
```

### Verify in Firestore

**task_templates collection:**
- Should have 17 documents with `routineType` field
- Each should have `canonicalTaskKey`, `longDescription`, `risk` object
- No duplicates per routineType

**task_instances collection:**
- Should have instances for today
- Each should have `routineType`, `unitId`, `canonicalTaskKey`
- Display titles like "Køleskab temperaturmåling · Køleskab 1"

## Test 2: Dedupe Test

### Setup

1. Manually create a duplicate instance in Firestore
2. Run `adminBackfillCanonicalTasks` again

### Expected Result

- Duplicate should be archived
- `archived: true`
- `archivedReason: "duplicate_canonical_key"`
- `duplicateOf: "canonical_instance_id"`
- Only ONE active instance remains

## Test 3: Equipment Mapping

### Verify

Check that equipment-based routines map correctly:

**Fridges:**
```
koeleskab_temperatur → fridge units
koeleskab_rengoering → fridge units
```

**Freezers:**
```
fryser_temperatur → freezer units
fryser_rengoering → freezer units
```

**Walk-in coolers:**
```
walkin_koeler_temperatur → walk-in cooler units
walkin_koeler_rengoering → walk-in cooler units
```

**Non-equipment:**
```
varemodtagelse → unitId: "default"
opvarmning → unitId: "default"
nedkoeling → unitId: "default"
```

### Check Instance IDs

Should follow pattern:
```
{companyId}__{locationId}__{dateKey}__{routineType}__{unitId}
```

Example:
```
company_123__location_456__2026-04-27__koeleskab_temperatur__fridge_1
company_123__location_456__2026-04-27__koeleskab_rengoering__fridge_1
company_123__location_456__2026-04-27__varemodtagelse__default
```

## Test 4: Temperature vs Cleaning Separation

### Verify

For each fridge/freezer, there should be TWO separate instances:

1. Temperature routine (CCP, daily)
2. Cleaning routine (GAG, weekly/monthly)

**Example for Fridge 1:**
```javascript
// Instance 1: Temperature
{
  routineType: "koeleskab_temperatur",
  unitId: "fridge_1",
  canonicalTaskKey: "koeleskab_temperatur__fridge_1",
  group: "CCP",
  frequencyDays: 1
}

// Instance 2: Cleaning
{
  routineType: "koeleskab_rengoering",
  unitId: "fridge_1",
  canonicalTaskKey: "koeleskab_rengoering__fridge_1",
  group: "GAG",
  frequencyDays: 7
}
```

**NEVER mixed!**

## Test 5: Risk Data

### Verify

Each instance should have `risk` object:

```javascript
{
  hazard: "Vækst af bakterier ved for høj køletemperatur.",
  criticalLimit: "Normalt højst 5 °C for kølekrævende fødevarer.",
  deviationTrigger: "Køleskabstemperatur over fastsat grænse.",
  defaultCorrectiveAction: "Temperaturen kontrolleres igen...",
  prefilledDeviationText: "Køleskabstemperaturen var over grænsen..."
}
```

## Test 6: Idempotency

### Run Multiple Times

```bash
# Call adminBackfillCanonicalTasks 3 times in a row
```

### Expected Result

- First call: Creates templates and instances
- Second call: Updates existing (no new creates)
- Third call: Updates existing (no new creates)
- **NO DUPLICATES** at any point

## Test 7: Demo Environment

### Create Demo

Call `createDemoEnvironment` (if integrated)

### Expected Result

- Demo company created
- 17 canonical templates created
- Instances created for demo equipment
- No duplicates

## Debugging

### Check Logs

```bash
firebase functions:log --only adminBackfillCanonicalTasks
```

Look for:
- `[generateCanonicalTaskTemplates] START`
- `[generateCanonicalTaskTemplates] Created: routineType (Title)`
- `[startDayForLocationCanonical] Found X active equipment units`
- `[ensureSingleTaskInstance] Created: instanceId`
- `[ensureSingleTaskInstance] Archived duplicate: dupId`

### Common Issues

**No instances created:**
- Check if equipment collection has active units
- Verify equipment types match canonical mappings

**Duplicates not archived:**
- Check if `canonicalTaskKey` field exists on old instances
- Verify dedupe logic in `ensureSingleTaskInstance`

**Wrong display titles:**
- Check `unitName` field on equipment
- Verify `buildDisplayTitle` logic

## Success Criteria

✅ 17 templates created per location
✅ Instances created for all equipment + default routines
✅ No duplicates (old ones archived)
✅ Temperature and cleaning separated
✅ Risk data present on all instances
✅ Idempotent (can run multiple times)
✅ Display titles formatted correctly

## Next Steps After Testing

1. Update `rutiner.html` to use canonical fields
2. Update `rapporter.html` to show risk data
3. Implement deviation UI with pre-filled text
4. Migrate all existing locations
5. Remove old `CANONICAL_EGENKONTROL_TASKS`
