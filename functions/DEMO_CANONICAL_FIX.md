# DEMO CANONICAL FIX

## Problem
Demo oprettede forkerte og dublerede rutiner:
- Varemodtagelse x2
- Nedkøling x2
- Varmholdelse x2
- Opvarmning + "Opvarmning / varmebehandling"
- Opvaskemaskine + "Opvaskemaskine skyllevandskontrol"
- "Køleopbevaring" + "Køleskabstemperatur"
- "Frostopbevaring" + "Frysertemperatur"
- "Vandkontrol"
- "Opdatering af APV"

## Løsning

### 1. Canonical Demo Templates
**File:** `functions/demoCanonicalTemplates.js`

Definerer 13 canonical demo rutiner:

**CCP (Daglige):**
- Varemodtagelse
- Opvarmning
- Nedkøling
- Varmholdelse
- 3-timers regel
- Køleskab temperaturmåling (demo_fridge_1)
- Fryser temperaturmåling (demo_freezer_1)

**GAG (Daglige):**
- Rengøring
- Opvaskemaskine skyllevandstemperatur (demo_dishwasher_1)

**GAG (Ugentlige):**
- Køleskab rengøring (demo_fridge_1)
- Adskillelse

**GAG (Månedlige):**
- Fryser rengøring (demo_freezer_1)

### 2. Demo Equipment Units
```javascript
DEMO_EQUIPMENT_UNITS = [
  { id: "demo_fridge_1", name: "Køleskab 1", type: "fridge" },
  { id: "demo_freezer_1", name: "Fryser 1", type: "freezer" },
  { id: "demo_dishwasher_1", name: "Opvaskemaskine 1", type: "dishwasher" },
  { id: "demo_fryer_1", name: "Friture 1", type: "fryer" }
]
```

### 3. Legacy Archive Logic
Arkiverer automatisk:
- "Opvarmning / varmebehandling"
- "Køleopbevaring"
- "Frostopbevaring"
- "Vandkontrol"
- "Opdatering af APV"
- "Opvaskemaskine skyllevandskontrol"
- "Køleskabstemperatur"
- "Frysertemperatur"
- Alle templates med `minimal_` i key

Sætter:
```javascript
{
  archived: true,
  archivedReason: "legacy_demo_routine_replaced_by_canonical",
  active: false,
  isActive: false,
  skippedDuplicate: true
}
```

### 4. Updated createDemoEnvironment Flow

**Old:**
```javascript
await seedDemoTaskTemplates({ companyId, locationId });
await seedDemoTaskInstances({ companyId, locationId });
// + hardcoded coreTemplates array
```

**New:**
```javascript
await seedDemoEquipment({ companyId, locationId, userId });
await seedCanonicalDemoTemplates({ companyId, locationId, userId });
await archiveLegacyDemoData({ companyId, locationId });
```

### 5. Canonical Template Structure
```javascript
{
  routineType: "varemodtagelse",
  unitId: "default",
  canonicalTaskKey: "varemodtagelse__default",
  
  title: "Varemodtagelse",
  displayTitle: "Varemodtagelse",
  
  group: "CCP",
  category: "CCP",
  isCCP: true,
  
  frequencyDays: 1,
  
  templateSource: "canonical_demo",
  isDemo: true,
  isActive: true
}
```

### 6. Equipment-Based Templates
```javascript
{
  routineType: "koeleskab_temperatur",
  unitId: "demo_fridge_1",
  unitName: "Køleskab 1",
  canonicalTaskKey: "koeleskab_temperatur__demo_fridge_1",
  
  title: "Køleskab temperaturmåling",
  displayTitle: "Køleskab temperaturmåling · Køleskab 1",
  
  group: "CCP",
  frequencyDays: 1
}
```

## Unique Keys

### Template Key
```
companyId + locationId + routineType + unitId
```

### Instance Key
```
companyId + locationId + dateKey + routineType + unitId
```

## Expected Demo Rutiner (Efter Fix)

### Daglige CCP:
1. Varemodtagelse
2. Opvarmning
3. Nedkøling
4. Varmholdelse
5. 3-timers regel
6. Køleskab temperaturmåling · Køleskab 1
7. Fryser temperaturmåling · Fryser 1

### Daglige GAG:
8. Rengøring
9. Opvaskemaskine skyllevandstemperatur · Opvaskemaskine 1

### Ugentlige GAG:
10. Køleskab rengøring · Køleskab 1
11. Adskillelse

### Månedlige GAG:
12. Fryser rengøring · Fryser 1

**Total: 12 rutiner (ingen dubletter)**

## Verification

### 1. Create New Demo
```bash
# Call createDemoEnvironment
# Expected: 12 canonical templates created
# Expected: 4 equipment units created
# Expected: 0 legacy templates
```

### 2. Check Firestore
```javascript
// task_templates collection
// Should have exactly 12 templates for demo company
// All should have:
// - routineType field
// - canonicalTaskKey field
// - templateSource: "canonical_demo"
// - NO "Opvarmning / varmebehandling"
// - NO "Køleopbevaring"
// - NO "Frostopbevaring"
```

### 3. Check rutiner.html
```
# Should show exactly 12 routines
# Should show canonical titles
# Should show NO duplicates
# Should show NO legacy names
```

### 4. Archive Check
```javascript
// Any existing legacy templates should have:
// - archived: true
// - archivedReason: "legacy_demo_routine_replaced_by_canonical"
// - skippedDuplicate: true
```

## Files Changed

### New Files:
- `functions/demoCanonicalTemplates.js` - Canonical demo template definitions

### Modified Files:
- `functions/index.js`:
  - Import demoCanonicalTemplates
  - Replace seedDemoTaskTemplates/seedDemoTaskInstances with canonical versions
  - Remove hardcoded coreTemplates array
  - Add seedDemoEquipment()
  - Add seedCanonicalDemoTemplates()
  - Add archiveLegacyDemoData()

### Unchanged:
- `public/modules/egenkontrol/rutiner.html` - Already filters archived tasks
- `public/core/canonicalRoutines.js` - Already has normalizeRoutineType()

## Migration for Existing Demos

For existing demo environments, call:
```javascript
// Archive legacy data
await archiveLegacyDemoData({ companyId, locationId });

// Create equipment
await seedDemoEquipment({ companyId, locationId, userId });

// Create canonical templates
await seedCanonicalDemoTemplates({ companyId, locationId, userId });
```

## Accept Criteria

✅ **Kun 12 rutiner** (ingen dubletter)
✅ **Kun canonical navne** (ingen "Opvarmning / varmebehandling")
✅ **Kun canonical titles** (ingen "Køleopbevaring")
✅ **Equipment-based rutiner** viser enhedsnavn (· Køleskab 1)
✅ **Legacy rutiner arkiveret** (archived: true)
✅ **rutiner.html filtrerer arkiverede** (vises ikke i UI)
✅ **Nye demos opretter kun canonical** (ingen legacy)

## Console Logs

```
[seedDemoEquipment] Creating demo equipment
[seedDemoEquipment] Created 4 equipment units

[seedCanonicalDemoTemplates] Creating canonical demo templates
[seedCanonicalDemoTemplates] Created 12 canonical templates

[archiveLegacyDemoData] Archiving legacy demo data
[archiveLegacyDemoData] Archived 8 templates and 15 instances
```
