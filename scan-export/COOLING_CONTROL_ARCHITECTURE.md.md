# FILE: COOLING_CONTROL_ARCHITECTURE.md

```markdown
# Cooling Control System - Architecture Documentation

## A. ARKITEKTURPLAN

### Systemets Lag

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DOMAIN LAYER (Forretningslogik)                         │
│    - coolingEvaluator.js: Evalueringsmotor                 │
│    - Deterministisk tids-/temperaturvurdering               │
│    - Udvidelig til andre kontroltyper                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. DATA LAYER (Datamodel)                                  │
│    - controlLibrary: cooling_control definition            │
│    - guideLibrary: guide_cooling_control                   │
│    - activityTypes: cooling_process                        │
│    - Templates med measurementConfig.thresholds            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. GENERATION LAYER (Template/Instance)                    │
│    - templateBuilder: Genererer cooling templates          │
│    - taskGenerator: Understøtter as_needed frequency       │
│    - Propagerer guideKey og controlType korrekt            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. UI LAYER (Brugerinteraktion)                           │
│    - rutiner.html: Cooling-specifik inputflow              │
│    - State management for delvist udfyldte data            │
│    - Real-time validering og statusvisning                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. PERSISTENCE LAYER (Gemning)                             │
│    - completeTaskEntryWithCooling: Entry handler           │
│    - Automatisk evaluering ved save                        │
│    - Automatisk deviation/alert ved fejl                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. REPORTING LAYER (Rapporter)                             │
│    - Cooling entries med evaluationsresultater             │
│    - Afvigelser med årsag og korrigerende handling         │
└─────────────────────────────────────────────────────────────┘
```

### Nøgleprincipper

1. **Ingen Hardcoding**: Cooling er en kontroltype som alle andre
2. **Udvidelig**: Evalueringsmotoren kan genbruges til andre time-temp kontroller
3. **Deterministisk**: Ingen AI eller fuzzy logic i evalueringen
4. **Komplet Flow**: Fra onboarding til rapport uden brud

---

## B. FILER DER ÆNDRES/OPRETTES

### NYE FILER

1. **`functions/egenkontrol/evaluators/coolingEvaluator.js`**
   - Evalueringsmotor for cooling control
   - Validering, beregning, vurdering
   - Udvidelig til andre kontroltyper

2. **`functions/admin/completeTaskEntryWithCooling.js`**
   - Handler for cooling task entries
   - Integration med evaluator
   - Automatisk deviation/alert ved fejl

3. **`COOLING_CONTROL_ARCHITECTURE.md`** (denne fil)
   - Arkitekturdokumentation
   - Testcases
   - Migrationsguide

### ÆNDREDE FILER

4. **`functions/egenkontrol/libraries/controlLibrary.js`**
   - Tilføjet `cooling_control` definition
   - Ny taskType: `time_temperature_control`
   - Measurementconfig med thresholds

5. **`functions/egenkontrol/libraries/guideLibrary.js`**
   - Tilføjet `guide_cooling_control`
   - Komplet guide med 3-timers regel
   - Kritiske punkter og fejlhåndtering

6. **`functions/egenkontrol/registries/activityTypes.js`**
   - Tilføjet `cooling_process` activity
   - ControlTags: cooling_control, time_temperature_control

7. **`functions/egenkontrol/generators/taskGenerator.js`**
   - Support for `as_needed` frequency
   - Cooling tasks oprettes manuelt, ikke automatisk

### FILER DER SKAL ÆNDRES (NÆSTE FASE)

8. **`public/modules/egenkontrol/rutiner.html`**
   - Cooling-specifik UI
   - State management for in-progress cooling
   - Real-time evaluering

9. **`functions/admin/generateDailyTaskInstances.js`**
   - Integration med cooling templates
   - Korrekt propagering af controlType

10. **Rapporter (TBD)**
    - Cooling entries i rapporter
    - Evaluationsresultater
    - Afvigelser

---

## C. DATAMODEL

### Template (task_templates)

```javascript
{
  templateId: "template_cooling_control__activity__cooling_process",
  controlKey: "cooling_control",
  guideKey: "guide_cooling_control",
  controlType: "guide_cooling_control",
  scope: "activity",
  targetKey: "cooling_process",
  targetLabel: "Nedkøling af varme fødevarer",
  frequency: "as_needed",
  taskType: "time_temperature_control",
  
  measurementConfig: {
    unit: "C",
    inputMode: "number",
    requiresStartTemp: true,
    requiresEndTemp: true,
    requiresStartTime: true,
    requiresEndTime: true,
    step: 0.5,
    evaluationMode: "cooling_time_temperature",
    thresholds: {
      minStartTemp: 65,
      maxEndTemp: 10,
      maxDurationMinutes: 180
    }
  },
  
  evidence: {
    photoAllowed: true,
    photoRequired: false,
    minPhotos: 0,
    maxPhotos: 3,
    photoTypes: ["start_temp", "end_temp", "product"]
  }
}
```

### Task Instance (task_instances)

```javascript
{
  taskInstanceId: "task_cooling_control__activity__cooling_process__2026-03-26",
  templateId: "template_cooling_control__activity__cooling_process",
  controlKey: "cooling_control",
  guideKey: "guide_cooling_control",
  controlType: "guide_cooling_control",
  scope: "activity",
  targetKey: "cooling_process",
  title: "Nedkøling af varme fødevarer · cooling_control",
  dateKey: "2026-03-26",
  frequency: "as_needed",
  taskType: "time_temperature_control",
  measurementConfig: { /* same as template */ },
  status: "pending", // or "in_progress", "completed", "failed"
  
  // State for in-progress cooling
  coolingState: {
    startTemp: 72,
    startTime: "2026-03-26T10:30:00Z",
    productName: "Lasagne",
    status: "cooling" // waiting for end measurement
  }
}
```

### Task Entry (task_entries)

```javascript
{
  entryId: "entry_task_cooling_control__activity__cooling_process__2026-03-26_1711445400000",
  taskInstanceId: "task_cooling_control__activity__cooling_process__2026-03-26",
  companyId: "company_123",
  locationId: "location_456",
  employeeId: "emp_789",
  employeeName: "John Doe",
  entryType: "cooling_control",
  
  coolingData: {
    startTemp: 72,
    endTemp: 8,
    startTime: "2026-03-26T10:30:00Z",
    endTime: "2026-03-26T12:45:00Z",
    productName: "Lasagne",
    productCategory: "hot_dish",
    batchSize: "5kg",
    coolingMethod: "small_containers"
  },
  
  evaluation: {
    status: "completed",
    passed: true,
    failureReason: null,
    durationMinutes: 135,
    tempDrop: 64,
    thresholds: {
      minStartTemp: 65,
      maxEndTemp: 10,
      maxDurationMinutes: 180
    },
    evaluatedAt: "2026-03-26T12:45:00Z",
    summary: "✅ Godkendt: 72°C → 8°C på 135 min (64°C fald)"
  },
  
  note: "",
  photoUrls: [],
  cloudinaryAssets: [],
  createdAt: "2026-03-26T12:45:00Z",
  updatedAt: "2026-03-26T12:45:00Z"
}
```

### Deviation (ved fejl)

```javascript
{
  deviationId: "deviation_task_cooling_control__activity__cooling_process__2026-03-26_1711445400000",
  taskInstanceId: "task_cooling_control__activity__cooling_process__2026-03-26",
  entryId: "entry_...",
  companyId: "company_123",
  locationId: "location_456",
  type: "cooling_failure",
  severity: "high",
  title: "Nedkøling fejlet: Lasagne",
  description: "Nedkøling tog 195 minutter (max 180 min)",
  details: {
    productName: "Lasagne",
    startTemp: 72,
    endTemp: 11,
    durationMinutes: 195,
    maxAllowedMinutes: 180
  },
  recommendedAction: "evaluate_food_safety",
  status: "open",
  createdBy: "emp_789",
  createdByName: "John Doe",
  createdAt: "2026-03-26T13:05:00Z",
  updatedAt: "2026-03-26T13:05:00Z"
}
```

---

## D. ENDE-TIL-ENDE FLOW

### 1. ONBOARDING
```
User vælger: activityTypes = ["cooling_process"]
↓
buildTemplatesFromProfile() genererer cooling_control template
↓
Template gemmes i task_templates collection
```

### 2. MANUEL TASK OPRETTELSE
```
Medarbejder starter nedkøling i UI
↓
System opretter task_instance med status="in_progress"
↓
coolingState gemmes: { startTemp, startTime, productName }
```

### 3. REGISTRERING
```
Medarbejder måler sluttemperatur og -tid
↓
UI validerer data lokalt
↓
completeTaskEntryWithCooling() kaldes
```

### 4. EVALUERING
```
evaluateCoolingControl() kører:
  - Validerer data
  - Beregner varighed
  - Vurderer mod thresholds
  - Returnerer resultat
```

### 5. PERSISTENCE
```
Entry gemmes med evaluation
↓
Task instance opdateres: status = "completed" eller "failed"
↓
Hvis fejl: Deviation + Alert oprettes automatisk
```

### 6. RAPPORTERING
```
Cooling entries vises i rapporter
↓
Evaluationsresultater fremhæves
↓
Afvigelser linkes til entries
```

---

## E. TESTCASES

### Test 1: Godkendt Nedkøling
```javascript
Input:
  startTemp: 70
  endTemp: 8
  startTime: "2026-03-26T10:00:00Z"
  endTime: "2026-03-26T12:30:00Z"

Forventet:
  passed: true
  durationMinutes: 150
  status: "completed"
  summary: "✅ Godkendt: 70°C → 8°C på 150 min (62°C fald)"
```

### Test 2: For Lang Tid
```javascript
Input:
  startTemp: 68
  endTemp: 9
  startTime: "2026-03-26T10:00:00Z"
  endTime: "2026-03-26T13:15:00Z"

Forventet:
  passed: false
  durationMinutes: 195
  failureReason: "Nedkøling tog 195 minutter (max 180 min)"
  status: "failed"
  recommendedAction: "evaluate_food_safety"
  deviation: created
  alert: created
```

### Test 3: Sluttemperatur For Høj
```javascript
Input:
  startTemp: 70
  endTemp: 12
  startTime: "2026-03-26T10:00:00Z"
  endTime: "2026-03-26T12:00:00Z"

Forventet:
  passed: false
  failureReason: "Sluttemperatur 12°C er over kravet (max 10°C)"
  recommendedAction: "continue_cooling"
```

### Test 4: Starttemperatur For Lav
```javascript
Input:
  startTemp: 60
  endTemp: 8
  startTime: "2026-03-26T10:00:00Z"
  endTime: "2026-03-26T12:00:00Z"

Forventet:
  passed: false
  failureReason: "Starttemperatur 60°C er under kravet (min 65°C)"
  recommendedAction: "reject_batch"
```

### Test 5: Manglende Data
```javascript
Input:
  startTemp: 70
  endTemp: null
  startTime: "2026-03-26T10:00:00Z"
  endTime: "2026-03-26T12:00:00Z"

Forventet:
  status: "invalid"
  passed: false
  failureReason: "Sluttemperatur mangler"
  recommendedAction: "complete_missing_data"
```

---

## F. MIGRATION SCRIPTS

### Script 1: Seed Cooling Control til Eksisterende Virksomheder

```javascript
// scripts/add-cooling-control-to-existing.js
const admin = require("firebase-admin");
const { buildTemplatesFromProfile } = require("../functions/egenkontrol/builders/templateBuilder");

async function addCoolingControlToExisting() {
  const db = admin.firestore();
  
  // Find all companies with hot_production
  const companiesSnapshot = await db.collection("companies")
    .where("activityTypes", "array-contains", "hot_production")
    .get();
  
  for (const companyDoc of companiesSnapshot.docs) {
    const company = companyDoc.data();
    
    // Add cooling_process to activityTypes
    const updatedActivities = [...(company.activityTypes || []), "cooling_process"];
    
    await db.collection("companies").doc(companyDoc.id).update({
      activityTypes: updatedActivities
    });
    
    // Regenerate templates
    const templates = buildTemplatesFromProfile({
      businessType: company.businessType,
      areaTypes: company.areaTypes || [],
      equipmentTypes: company.equipmentTypes || [],
      activityTypes: updatedActivities
    });
    
    // Save cooling template
    const coolingTemplate = templates.find(t => t.controlKey === "cooling_control");
    if (coolingTemplate) {
      await db.collection("task_templates").doc(coolingTemplate.templateId).set(coolingTemplate);
      console.log(`✅ Added cooling control to ${companyDoc.id}`);
    }
  }
}
```

### Script 2: Validate Cooling Templates

```javascript
// scripts/validate-cooling-templates.js
async function validateCoolingTemplates() {
  const db = admin.firestore();
  const templatesSnapshot = await db.collection("task_templates")
    .where("controlKey", "==", "cooling_control")
    .get();
  
  const issues = [];
  
  for (const doc of templatesSnapshot.docs) {
    const template = doc.data();
    
    if (template.guideKey !== "guide_cooling_control") {
      issues.push(`${doc.id}: Wrong guideKey (${template.guideKey})`);
    }
    
    if (template.controlType !== "guide_cooling_control") {
      issues.push(`${doc.id}: Wrong controlType (${template.controlType})`);
    }
    
    if (!template.measurementConfig?.thresholds) {
      issues.push(`${doc.id}: Missing thresholds`);
    }
  }
  
  if (issues.length > 0) {
    console.error("❌ Validation issues:", issues);
  } else {
    console.log("✅ All cooling templates valid");
  }
}
```

---

## G. NÆSTE SKRIDT

### Fase 1: UI Implementation (PENDING)
- [ ] Cooling UI i rutiner.html
- [ ] State management for in-progress cooling
- [ ] Real-time validering
- [ ] Guide visning

### Fase 2: Integration (PENDING)
- [ ] Hook completeTaskEntryWithCooling ind i save flow
- [ ] Manual task creation UI
- [ ] Status badges for cooling tasks

### Fase 3: Reporting (PENDING)
- [ ] Cooling entries i rapporter
- [ ] Evaluation summaries
- [ ] Deviation linking

### Fase 4: Testing (PENDING)
- [ ] Unit tests for evaluator
- [ ] Integration tests for full flow
- [ ] Manual QA på staging

---

## H. UDVIDELSESMULIGHEDER

Systemet er designet til at understøtte andre time-temperature kontroller:

1. **Hot Holding (3-timers regel under 65°C)**
   - Samme evaluator med andre thresholds
   - evaluationMode: "hot_holding_time_limit"

2. **Reheating (Genopvarmning)**
   - evaluationMode: "reheating_temperature"
   - Krav: Fra køl til min 75°C

3. **Thawing (Optøning)**
   - evaluationMode: "thawing_time_temperature"
   - Krav: Max 4°C, max 24 timer

Alle bruger samme arkitektur og evalueringsmotor.

```
