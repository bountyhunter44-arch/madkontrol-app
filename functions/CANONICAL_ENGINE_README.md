# Canonical Routine Engine

## Overview

Core engine for canonical routine management in Madkontrollen Pro.

**Key principle:** Only ONE active task instance per `companyId + locationId + dateKey + routineType + unitId`

## Architecture

### Files

1. **`canonicalRoutines.js`** - Canonical model and helpers
   - `CANONICAL_ROUTINE_TYPES` - 17 routine definitions
   - Helper functions for normalization and key building

2. **`canonicalTaskEngine.js`** - Core engine
   - `generateCanonicalTaskTemplates()` - Creates/updates templates
   - `ensureSingleTaskInstance()` - Hard dedupe for instances
   - `startDayForLocationCanonical()` - Generates daily instances

3. **`index.js`** - Integration
   - Imports and uses canonical engine
   - `adminBackfillCanonicalTasks` - Migration function
   - `finalizeOnboardingCheckoutProvisioning` - Uses canonical templates

## Canonical Routine Types

### CCP (Critical Control Points) - Daily

- `varemodtagelse` - Goods receiving
- `opvarmning` - Heating
- `nedkoeling` - Cooling
- `varmholdelse` - Hot holding
- `koeleskab_temperatur` - Fridge temperature
- `fryser_temperatur` - Freezer temperature
- `walkin_koeler_temperatur` - Walk-in cooler temperature
- `walkin_fryser_temperatur` - Walk-in freezer temperature
- `tre_timers_regel` - 3-hour rule

### GAG (Good Working Practices)

- `koeleskab_rengoering` - Fridge cleaning (weekly)
- `fryser_rengoering` - Freezer cleaning (monthly)
- `walkin_koeler_rengoering` - Walk-in cooler cleaning (weekly)
- `walkin_fryser_rengoering` - Walk-in freezer cleaning (monthly)
- `opvaskemaskine_skyllevand` - Dishwasher rinse water (daily)
- `adskillelse` - Separation (weekly)
- `rengoering` - General cleaning (daily)
- `koekken_rengoering` - Kitchen cleaning (daily)

## Key Concepts

### Unique Key

```
companyId + locationId + dateKey + routineType + unitId
```

### Temperature vs Cleaning

**NEVER mixed!** Same physical unit can have multiple routines:

```javascript
// Fridge 1
{
  routineType: "koeleskab_temperatur",
  unitId: "fridge_1"
}

{
  routineType: "koeleskab_rengoering",
  unitId: "fridge_1"
}
```

These are TWO different routines for the same fridge.

### Default Unit

Non-equipment routines use `unitId: "default"`:

- `varemodtagelse`
- `opvarmning`
- `nedkoeling`
- `varmholdelse`
- `tre_timers_regel`
- `adskillelse`
- `rengoering`
- `koekken_rengoering`

## Usage

### Generate Templates

```javascript
const stats = await generateCanonicalTaskTemplates({
  db,
  companyId: "company_123",
  locationId: "location_456"
});

// Returns: { created: 17, updated: 0, archived: 0, skipped: 0 }
```

### Generate Daily Instances

```javascript
const stats = await startDayForLocationCanonical({
  db,
  companyId: "company_123",
  locationId: "location_456",
  dateKey: "2026-04-27",
  createdBy: "user_789"
});

// Returns: { ok: true, instancesCreated: 25, instancesUpdated: 0, instancesArchived: 0 }
```

### Ensure Single Instance

```javascript
const result = await ensureSingleTaskInstance({
  db,
  companyId: "company_123",
  locationId: "location_456",
  dateKey: "2026-04-27",
  routineType: "koeleskab_temperatur",
  unitId: "fridge_1",
  unitName: "Køleskab 1",
  templateId: "company_123__location_456__canonical__koeleskab_temperatur",
  createdBy: "user_789"
});

// Returns: { instanceId: "...", created: true, updated: false, archived: 0 }
```

## Deduplication

### Hard Dedupe

`ensureSingleTaskInstance` ensures:

1. Check if instance with exact ID exists
2. If archived, reactivate it
3. If active, skip
4. Find any duplicates with same canonical key
5. Archive all duplicates
6. Create new instance

### Archive Fields

```javascript
{
  archived: true,
  archivedReason: "duplicate_canonical_key",
  archivedAt: new Date(),
  isActive: false,
  active: false,
  skippedDuplicate: true,
  duplicateOf: "canonical_instance_id"
}
```

## Risk Data

Each routine has risk analysis data:

```javascript
{
  hazard: "Description of food safety hazard",
  criticalLimit: "Critical limit for this control point",
  deviationTrigger: "What triggers a deviation",
  defaultCorrectiveAction: "Standard corrective action",
  prefilledDeviationText: "Pre-filled text for deviation form"
}
```

## Migration

Use `adminBackfillCanonicalTasks` to migrate existing locations:

```javascript
// Call from frontend
const result = await adminBackfillCanonicalTasks({
  companyId: "company_123",
  locationId: "location_456"
});

// Returns:
{
  ok: true,
  templates: { created: 17, updated: 0, archived: 5 },
  instances: { instancesCreated: 25, instancesUpdated: 0, instancesArchived: 3 }
}
```

## Testing

### Demo Environment

`createDemoEnvironment` will use canonical templates automatically.

### Live Environment

1. Deploy functions: `firebase deploy --only functions`
2. Call `adminBackfillCanonicalTasks` for each location
3. Verify in Firestore:
   - `task_templates` collection
   - `task_instances` collection
4. Check for duplicates (should be archived)

## Next Steps

1. ✅ Core engine (DONE)
2. Frontend canonical model
3. Update `rutiner.html` to use canonical fields
4. Update `rapporter.html` to show risk data
5. Deviation UI with pre-filled text
6. Full migration function

## Notes

- Templates are unit-agnostic (one per routineType)
- Instances are unit-specific (one per routineType + unitId)
- `startDayForLocation` will be updated to use `startDayForLocationCanonical`
- Old `CANONICAL_EGENKONTROL_TASKS` can be removed after migration
