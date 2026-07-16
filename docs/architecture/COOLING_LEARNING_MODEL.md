# Cooling Control Learning Model - Implementation Guide

## OVERSIGT

Cooling control learning model udvider det eksisterende cooling control system med struktureret historik til læring og anbefalinger.

---

## A. FILER DER ER OPRETTET/ÆNDRET

### NYE FILER

#### 1. `functions/egenkontrol/models/coolingHistoryModel.js`
**Formål:** Learning model med enum values og history management

**Funktioner:**
- `COOLING_ENUMS` - Faste værdier til læring
- `createCoolingHistoryRecord(taskEntry, evaluation)` - Opret history record
- `saveCoolingHistory(historyRecord)` - Gem til Firestore
- `getCoolingRecommendations(params)` - Hent anbefalinger baseret på historik
- `generateLearningTags(coolingData, evaluation)` - ML tags

**Enum Values:**
```javascript
productCategory: [
  "hot_dish", "sauce", "soup", "stew", "meat", 
  "poultry", "fish", "vegetables", "rice_pasta", "other"
]

batchSize: [
  "lt_1kg", "kg_1_3", "kg_3_5", "kg_5_10", "gt_10kg"
]

containerType: [
  "shallow_pan", "deep_pot", "gastronorm_half", "gastronorm_full",
  "plastic_container", "metal_container", "individual_portions", "other"
]

coolingMethod: [
  "small_containers", "ice_bath", "blast_chiller", "cold_running_water",
  "fridge", "walk_in_cooler", "stirring", "ice_wand", "combination", "other"
]

result: [
  "passed", "failed_time", "failed_temp", "failed_both", "invalid_data"
]
```

---

#### 2. `scripts/migrate-cooling-history.js`
**Formål:** Migrer eksisterende cooling entries til cooling_history

**Kør:**
```bash
node scripts/migrate-cooling-history.js
```

---

### ÆNDREDE FILER

#### 3. `functions/admin/completeTaskEntryWithCooling.js`
**Ændringer:**
- Import af `coolingHistoryModel`
- Tilføjet `containerType` parameter
- Tilføjet `dateKey` parameter
- Automatisk save til `cooling_history` efter entry completion
- Error handling for history save (non-blocking)

**Ny logik:**
```javascript
// Save to cooling_history for learning
try {
    const historyRecord = createCoolingHistoryRecord(entry, evaluation);
    await saveCoolingHistory(historyRecord);
    console.log(`[Cooling History] Saved: ${historyRecord.historyId}`);
} catch (historyError) {
    console.error("[Cooling History] Failed to save:", historyError);
    // Don't fail the entire operation if history save fails
}
```

---

#### 4. `public/modules/egenkontrol/rutiner-cooling-ui.js`
**Ændringer:**
- Udvidet `productCategory` dropdown (10 options)
- Tilføjet `containerType` felt
- Udvidet `coolingMethod` dropdown (10 options)
- Opdateret `batchSize` værdier til learning enums
- Alle felter nu required for læring
- Validering af alle påkrævede felter

---

## B. DATAMODEL

### cooling_history Collection

```javascript
{
  historyId: "cooling_history_entry_123_1711445400000",
  sourceTaskEntryId: "entry_123",
  taskInstanceId: "task_456",
  templateId: "template_cooling_control__activity__cooling_process",
  companyId: "company_123",
  locationId: "location_456",
  
  // Product data (enum values)
  productName: "Lasagne",
  productCategory: "hot_dish",
  batchSize: "kg_3_5",
  containerType: "gastronorm_half",
  coolingMethod: "small_containers",
  
  // Measurements
  startTemperature: 72,
  endTemperature: 8,
  startedAt: "2026-03-26T10:00:00Z",
  endedAt: "2026-03-26T12:15:00Z",
  durationMinutes: 135,
  
  // Evaluation
  result: "passed",
  passed: true,
  failureReason: null,
  
  // Thresholds snapshot
  thresholds: {
    minStartTemp: 65,
    maxEndTemp: 10,
    maxDurationMinutes: 180
  },
  
  // Metadata
  dateKey: "2026-03-26",
  employeeId: "emp_789",
  employeeName: "John Doe",
  createdAt: "2026-03-26T12:15:00Z",
  
  // ML tags
  tags: [
    "kg_3_5_small_containers",
    "hot_dish_small_containers",
    "success",
    "fast_cooling",
    "container_gastronorm_half"
  ]
}
```

---

## C. KODEÆNDRINGER - KONKRETE SEKTIONER

### UI Integration (rutiner.html)

**Ingen ændringer nødvendige** - UI module er allerede standalone.

Eksisterende integration:
```javascript
: task.controlType === "guide_cooling_control"
? `
    <div id="cooling-ui-${escapeHtml(task.id)}"></div>
    <script>
        import('./rutiner-cooling-ui.js').then(module => {
            const container = document.getElementById('cooling-ui-${escapeHtml(task.id)}');
            container.innerHTML = module.renderCoolingControlUI(${JSON.stringify(task)});
        });
    </script>
`
```

---

### Backend Cloud Function Export

**Fil:** `functions/index.js`

**Tilføj:**
```javascript
const { getCoolingRecommendations } = require("./egenkontrol/models/coolingHistoryModel");

exports.getCoolingRecommendations = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  return await getCoolingRecommendations(data);
});
```

---

## D. TESTCASES

### Test 1: History Record Creation
```javascript
const entry = {
  entryId: "entry_test_1",
  taskInstanceId: "task_test_1",
  companyId: "test_company",
  locationId: "test_location",
  coolingData: {
    productName: "Test Lasagne",
    productCategory: "hot_dish",
    batchSize: "kg_3_5",
    containerType: "gastronorm_half",
    coolingMethod: "small_containers",
    startTemp: 70,
    endTemp: 8,
    startTime: "2026-03-26T10:00:00Z",
    endTime: "2026-03-26T12:15:00Z"
  },
  employeeId: "emp_test",
  employeeName: "Test User"
};

const evaluation = {
  passed: true,
  durationMinutes: 135,
  thresholdSnapshot: {
    minStartTemp: 65,
    maxEndTemp: 10,
    maxDurationMinutes: 180
  }
};

const historyRecord = createCoolingHistoryRecord(entry, evaluation);

assert(historyRecord.result === "passed");
assert(historyRecord.productCategory === "hot_dish");
assert(historyRecord.tags.includes("success"));
assert(historyRecord.tags.includes("kg_3_5_small_containers"));
```

### Test 2: Failed Cooling - Time
```javascript
const evaluation = {
  passed: false,
  failureReason: "Nedkøling tog 195 minutter (max 180 min)",
  durationMinutes: 195
};

const historyRecord = createCoolingHistoryRecord(entry, evaluation);

assert(historyRecord.result === "failed_time");
assert(historyRecord.passed === false);
assert(historyRecord.tags.includes("failure"));
assert(historyRecord.tags.includes("slow_cooling"));
```

### Test 3: Recommendations Query
```javascript
const recommendations = await getCoolingRecommendations({
  companyId: "test_company",
  locationId: "test_location",
  productCategory: "hot_dish",
  batchSize: "kg_3_5"
});

assert(recommendations.hasData === true);
assert(recommendations.recommendedMethod === "small_containers");
assert(recommendations.avgDuration < 180);
assert(recommendations.successRate === 100);
```

### Test 4: Learning Tags Generation
```javascript
const coolingData = {
  productCategory: "soup",
  batchSize: "kg_5_10",
  containerType: "deep_pot",
  coolingMethod: "ice_bath"
};

const evaluation = {
  passed: true,
  durationMinutes: 110
};

const tags = generateLearningTags(coolingData, evaluation);

assert(tags.includes("kg_5_10_ice_bath"));
assert(tags.includes("soup_ice_bath"));
assert(tags.includes("success"));
assert(tags.includes("fast_cooling"));
assert(tags.includes("container_deep_pot"));
```

### Test 5: Enum Validation
```javascript
// Verify all UI values match enum values
const uiProductCategories = [
  "hot_dish", "sauce", "soup", "stew", "meat", 
  "poultry", "fish", "vegetables", "rice_pasta", "other"
];

const enumProductCategories = COOLING_ENUMS.productCategory;

assert(JSON.stringify(uiProductCategories.sort()) === 
       JSON.stringify(enumProductCategories.sort()));
```

---

## E. ENDE-TIL-ENDE FLOW

```
1. MEDARBEJDER STARTER NEDKØLING
   ↓
   Udfylder: productName, productCategory, batchSize, 
             containerType, coolingMethod, startTemp
   ↓
   handleStartCooling() gemmer coolingState i task_instance

2. NEDKØLING I GANG
   ↓
   UI viser progress bar og elapsed time
   ↓
   Medarbejder venter til produkt når 10°C

3. MEDARBEJDER AFSLUTTER NEDKØLING
   ↓
   Måler endTemp
   ↓
   handleCompleteCooling() kalder cloud function

4. BACKEND EVALUERING
   ↓
   completeTaskEntryWithCooling():
     - Evaluerer cooling
     - Gemmer task_entry
     - Opdaterer task_instance
     - Opretter deviation hvis fejl
     ↓
   createCoolingHistoryRecord():
     - Mapper data til history format
     - Bestemmer result enum
     - Genererer learning tags
     ↓
   saveCoolingHistory():
     - Gemmer til cooling_history collection

5. LÆRING AKTIVERET
   ↓
   Næste gang samme productCategory + batchSize:
     - getCoolingRecommendations() kan foreslå bedste metode
     - Vise gennemsnitlig varighed
     - Vise success rate

6. FREMTIDIG ML
   ↓
   Tags bruges til:
     - Pattern recognition
     - Anomaly detection
     - Predictive recommendations
     - Performance benchmarking
```

---

## F. MIGRATION

### Kør Migration Script

```bash
# Migrer eksisterende cooling entries til history
node scripts/migrate-cooling-history.js
```

**Output:**
```
🔍 Finding existing cooling entries...
📊 Found 47 cooling entries
✅ Migrated entry_123
✅ Migrated entry_124
⏭️  Skipping entry_125 (already migrated)
...

📈 Migration Summary:
   Migrated: 45
   Skipped: 2
   Errors: 0
   Total: 47

✅ Migration complete
```

---

## G. ANBEFALINGER - FREMTIDIG BRUG

### I UI (Fremtidig Feature)

```javascript
// Når medarbejder starter nedkøling
const recommendations = await getCoolingRecommendations({
  companyId: SETTINGS.companyId,
  locationId: SETTINGS.locationId,
  productCategory: selectedCategory,
  batchSize: selectedBatchSize
});

if (recommendations.hasData) {
  showRecommendation(`
    💡 Anbefaling baseret på ${recommendations.sampleSize} tidligere nedkølinger:
    
    Bedste metode: ${recommendations.recommendedMethod}
    Gennemsnitlig tid: ${recommendations.avgDuration} minutter
    Success rate: ${recommendations.successRate}%
  `);
}
```

---

## H. FIRESTORE INDEXES

### Påkrævede Indexes

```javascript
// cooling_history collection
{
  collectionGroup: "cooling_history",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "companyId", order: "ASCENDING" },
    { fieldPath: "passed", order: "ASCENDING" },
    { fieldPath: "productCategory", order: "ASCENDING" }
  ]
}

{
  collectionGroup: "cooling_history",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "companyId", order: "ASCENDING" },
    { fieldPath: "locationId", order: "ASCENDING" },
    { fieldPath: "passed", order: "ASCENDING" }
  ]
}

{
  collectionGroup: "cooling_history",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "companyId", order: "ASCENDING" },
    { fieldPath: "dateKey", order: "DESCENDING" }
  ]
}
```

**Opret via Firebase Console eller:**
```bash
firebase deploy --only firestore:indexes
```

---

## I. ANALYTICS QUERIES

### Query 1: Success Rate by Method
```javascript
const db = getFirestore();
const snapshot = await db.collection("cooling_history")
  .where("companyId", "==", companyId)
  .where("coolingMethod", "==", "blast_chiller")
  .get();

const total = snapshot.size;
const passed = snapshot.docs.filter(doc => doc.data().passed).length;
const successRate = (passed / total) * 100;
```

### Query 2: Average Duration by Product Category
```javascript
const snapshot = await db.collection("cooling_history")
  .where("companyId", "==", companyId)
  .where("productCategory", "==", "soup")
  .where("passed", "==", true)
  .get();

const durations = snapshot.docs.map(doc => doc.data().durationMinutes);
const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
```

### Query 3: Failure Analysis
```javascript
const snapshot = await db.collection("cooling_history")
  .where("companyId", "==", companyId)
  .where("passed", "==", false)
  .orderBy("createdAt", "desc")
  .limit(50)
  .get();

const failureReasons = {};
snapshot.docs.forEach(doc => {
  const result = doc.data().result;
  failureReasons[result] = (failureReasons[result] || 0) + 1;
});
```

---

## LEVERANCE KOMPLET

✅ **Datamodel** - cooling_history collection med enum values  
✅ **Learning Model** - coolingHistoryModel.js med recommendations  
✅ **Automatisk Save** - History gemmes ved hver cooling completion  
✅ **UI Enums** - Faste værdier i alle dropdowns  
✅ **Migration Script** - Migrer eksisterende data  
✅ **Testcases** - 5 tests defineret  
✅ **Ende-til-ende Flow** - Dokumenteret  
✅ **Fremtidig ML** - Tags og struktur klar til machine learning
