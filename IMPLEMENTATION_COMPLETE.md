# IMPLEMENTERING KOMPLET - PROCESS INSTANCES

## FILER ÆNDRET OG OPRETTET

### 1. **functions/processInstances.js** (NY FIL)
**Beskrivelse:** Core backend logic for process instance management

**Funktioner implementeret:**
- ✅ `startCoolingProcess()` - Opretter nedkølingsproces i Firestore
- ✅ `addCoolingMeasurement()` - Tilføjer måling til aktiv proces
- ✅ `completeCoolingProcess()` - Afslutter nedkøling med validation
- ✅ `createCoolingDeviation()` - Auto-opretter afvigelse ved fejl
- ✅ `startReheatingProcess()` - Starter genopvarmning (recovery)
- ✅ `completeReheatingProcess()` - Afslutter genopvarmning
- ✅ `createReheatingDeviation()` - Auto-opretter afvigelse ved fejl
- ✅ `disposeCoolingProcess()` - Markerer proces som kasseret
- ✅ `startNewCoolingFromReheating()` - Starter ny nedkøling efter genopvarmning
- ✅ `loadActiveProcessInstances()` - Henter aktive processer for location

**Firestore collections brugt:**
- `process_instances` - Gemmer alle procesinstanser
- `deviations` - Auto-oprettede afvigelser

---

### 2. **functions/index.js** (ÆNDRET)
**Beskrivelse:** Tilføjet cloud function exports

**Ændringer:**
- ✅ Linje 8: Importeret `processInstances` module
- ✅ Linje 4577-4762: Tilføjet 8 cloud functions:
  - `exports.startCoolingProcess`
  - `exports.addCoolingMeasurement`
  - `exports.completeCoolingProcess`
  - `exports.startReheatingProcess`
  - `exports.completeReheatingProcess`
  - `exports.disposeCoolingProcess`
  - `exports.startNewCoolingFromReheating`
  - `exports.loadActiveProcessInstances`

**Alle funktioner:**
- ✅ Kræver authentication (`context.auth`)
- ✅ Validerer input parametre
- ✅ Kalder processInstances module
- ✅ Håndterer fejl korrekt

---

### 3. **functions/admin/generateEgenkontrolFromRiskAnalysis.js** (ÆNDRET)
**Beskrivelse:** Opdateret aggregation logic med alle nye kategorier

**Ændringer:**
- ✅ Linje 37-196: `inferAggregatedCategory()` opdateret med 15 kategorier:
  - `temperature_cooling`, `temperature_freezing`, `temperature_heating`
  - `fryer_critical` (max 175°C)
  - `ice_equipment_critical`
  - `receiving_control`
  - `equipment_cleaning`, `area_cleaning`, `drain_maintenance`
  - `allergen_control`, `staff_hygiene`, `closing_routine`
  - `building_condition` (monthly), `pest_control` (weekly)
  - `verification`

- ✅ Linje 198-215: `inferTemplateType()` opdateret:
  - Returns `"verification"` for building_condition, pest_control
  - Returns `"process"` for cooling_process, reheating_process, hot_holding
  - Returns `"operational"` for alle andre

- ✅ Linje 217-260: `inferAggregatedTemplateName()` - Alle 15 navne
- ✅ Linje 262-305: `inferAggregatedDescription()` - Alle beskrivelser
- ✅ Linje 307-339: `inferAggregatedFrequency()` - Korrekte frekvenser
- ✅ Linje 341-359: `inferAggregatedControlType()` - Inkl. process types
- ✅ Linje 361-371: `inferAggregatedUnit()` - Temperatur units
- ✅ Linje 373-392: `inferAggregatedLimits()` - Alle grænser inkl. friture 175°C
- ✅ Linje 394-433: `inferAggregatedCorrectiveAction()` - Alle handlinger

---

### 4. **public/core/processInstances.js** (NY FIL)
**Beskrivelse:** Client-side JavaScript for process instance handling

**Funktioner implementeret:**
- ✅ `startCoolingProcess()` - Kalder cloud function
- ✅ `addCoolingMeasurement()` - Kalder cloud function
- ✅ `completeCoolingProcess()` - Kalder cloud function
- ✅ `startReheatingProcess()` - Kalder cloud function
- ✅ `completeReheatingProcess()` - Kalder cloud function
- ✅ `disposeCoolingProcess()` - Kalder cloud function
- ✅ `startNewCoolingFromReheating()` - Kalder cloud function
- ✅ `loadActiveProcessInstances()` - Kalder cloud function

**UI Helper funktioner:**
- ✅ `calculateDuration()` - Beregner forløbet tid
- ✅ `calculateRemaining()` - Beregner resterende tid
- ✅ `calculateProgress()` - Beregner progress %
- ✅ `formatTime()` - Formaterer timestamp
- ✅ `showRecoveryOptions()` - Viser recovery modal
- ✅ `showNewCoolingOption()` - Viser ny nedkøling modal

**Eksponeret via:** `window.MKP.ProcessInstances`

---

### 5. **functions/test/testProcessFlow.js** (NY FIL)
**Beskrivelse:** Komplet test af hele flowet

**Test sekvens:**
1. ✅ Start cooling (78°C)
2. ✅ Add measurement (42°C)
3. ✅ Complete cooling FAILED (15°C, > 10°C)
4. ✅ Auto-deviation created
5. ✅ Start reheating (recovery)
6. ✅ Complete reheating SUCCESS (78°C, >= 75°C)
7. ✅ Start new cooling from reheating
8. ✅ Complete new cooling SUCCESS (8°C, <= 10°C)
9. ✅ Load active processes (should be 0)

**Kør med:** `node functions/test/testProcessFlow.js`

---

### 6. **IMPLEMENTATION_MODEL.md** (NY FIL)
**Beskrivelse:** Komplet dokumentation af datamodel og flows

**Indhold:**
- Data model strukturer
- Process creation functions
- Dashboard UI integration
- Recovery flow implementation
- Kode eksempler

---

## FIRESTORE COLLECTIONS

### **process_instances** (NY COLLECTION)
```javascript
{
  id: "cooling_20260324_001",
  processType: "cooling" | "reheating" | "hot_holding",
  templateId: "template_cooling_process",
  
  companyId: "company_001",
  locationId: "location_001",
  dateKey: "2026-03-24",
  
  status: "in_progress" | "completed" | "failed",
  
  productName: "Kyllingebryst (stegt)",
  batchSize: "2.5 kg",
  container: "Gastronorm 1/1",
  
  startedAt: Timestamp,
  startedBy: "user_123",
  startTemperature: 78,
  
  measurements: [
    {
      timestamp: "2026-03-24T12:00:00Z",
      temperature: 78,
      note: "Start nedkøling",
      measuredBy: "user_123"
    }
  ],
  
  completedAt: Timestamp | null,
  completedBy: "user_123" | null,
  endTemperature: 8 | null,
  durationHours: 3.5 | null,
  
  validation: {
    startTempValid: true,
    targetTempReached: true,
    withinTimeLimit: true,
    overallStatus: "ok" | "deviation"
  },
  
  autoDeviationCreated: false,
  deviationId: "dev_001" | null,
  recoveryAction: "reheating" | "disposal" | null,
  reheatingProcessId: "reheating_001" | null,
  
  triggeredByCoolingFailure: false,
  originalCoolingProcessId: "cooling_001" | null,
  newCoolingProcessId: "cooling_002" | null,
  
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### **deviations** (EKSISTERENDE COLLECTION - NYE TYPER)
```javascript
{
  type: "cooling_timeout" | "cooling_temp_missed" | "cooling_timeout_and_temp" | "reheating_temp_missed",
  severity: "critical",
  
  processInstanceId: "cooling_001",
  processType: "cooling" | "reheating",
  
  productName: "Kyllingebryst",
  batchSize: "2.5 kg",
  
  message: "Nedkøling fejlet: ...",
  details: { ... },
  correctiveAction: "...",
  
  status: "open" | "resolved",
  requiresImmediateAction: true
}
```

---

## CLOUD FUNCTIONS API

### **startCoolingProcess**
```javascript
const result = await firebase.functions().httpsCallable('startCoolingProcess')({
  companyId: "company_001",
  locationId: "location_001",
  productName: "Kyllingebryst (stegt)",
  batchSize: "2.5 kg",
  container: "Gastronorm 1/1",
  startTemperature: 78
});

// Returns: { processId, processData }
```

### **addCoolingMeasurement**
```javascript
const result = await firebase.functions().httpsCallable('addCoolingMeasurement')({
  processId: "cooling_001",
  temperature: 42,
  note: "Efter 1 time"
});

// Returns: { success: true, measurement }
```

### **completeCoolingProcess**
```javascript
const result = await firebase.functions().httpsCallable('completeCoolingProcess')({
  processId: "cooling_001",
  endTemperature: 8,
  note: "Sluttemperatur nået"
});

// Returns: { success: true, status: "ok" | "deviation", requiresRecovery: boolean, deviationId }
```

### **startReheatingProcess**
```javascript
const result = await firebase.functions().httpsCallable('startReheatingProcess')({
  companyId: "company_001",
  locationId: "location_001",
  failedCoolingProcessId: "cooling_001"
});

// Returns: { processId, processData }
```

### **completeReheatingProcess**
```javascript
const result = await firebase.functions().httpsCallable('completeReheatingProcess')({
  processId: "reheating_001",
  endTemperature: 78,
  note: "Målt i centrum"
});

// Returns: { success: true, status: "ok" | "deviation", canStartNewCooling: boolean }
```

### **startNewCoolingFromReheating**
```javascript
const result = await firebase.functions().httpsCallable('startNewCoolingFromReheating')({
  reheatingProcessId: "reheating_001"
});

// Returns: { processId, processData }
```

### **loadActiveProcessInstances**
```javascript
const processes = await firebase.functions().httpsCallable('loadActiveProcessInstances')({
  locationId: "location_001"
});

// Returns: Array of active process instances
```

---

## CLIENT-SIDE USAGE

### **Start Cooling**
```javascript
try {
  const result = await MKP.ProcessInstances.startCoolingProcess({
    productName: "Kyllingebryst (stegt)",
    batchSize: "2.5 kg",
    container: "Gastronorm 1/1",
    startTemperature: 78
  });
  
  console.log('Process started:', result.processId);
} catch (error) {
  console.error('Error:', error);
}
```

### **Add Measurement**
```javascript
await MKP.ProcessInstances.addCoolingMeasurement({
  processId: "cooling_001",
  temperature: 42,
  note: "Efter 1 time"
});
```

### **Complete Cooling**
```javascript
const result = await MKP.ProcessInstances.completeCoolingProcess({
  processId: "cooling_001",
  endTemperature: 8,
  note: "Sluttemperatur nået"
});

if (result.requiresRecovery) {
  // Show recovery options
  MKP.ProcessInstances.showRecoveryOptions(processId, processData);
}
```

### **Load Active Processes**
```javascript
const processes = await MKP.ProcessInstances.loadActiveProcessInstances();

processes.forEach(process => {
  console.log(`${process.processType}: ${process.productName}`);
  console.log(`Status: ${process.status}`);
  console.log(`Duration: ${MKP.ProcessInstances.calculateDuration(process.startedAt)}`);
});
```

---

## NÆSTE SKRIDT (IKKE IMPLEMENTERET ENDNU)

### **Dashboard UI Integration**
Skal tilføjes til `public/dashboard.html` eller tilsvarende:

```html
<!-- Load process instances script -->
<script src="/core/processInstances.js"></script>

<!-- Active processes section -->
<section id="active-processes" style="display: none;">
  <h2>Aktive processer</h2>
  <div id="active-processes-list"></div>
</section>

<!-- Start process buttons -->
<button id="btn-start-cooling">🧊 Start nedkøling</button>
```

```javascript
// Load and render active processes
async function loadDashboard() {
  const processes = await MKP.ProcessInstances.loadActiveProcessInstances();
  
  if (processes.length > 0) {
    document.getElementById('active-processes').style.display = 'block';
    renderActiveProcesses(processes);
  } else {
    document.getElementById('active-processes').style.display = 'none';
  }
}

function renderActiveProcesses(processes) {
  const container = document.getElementById('active-processes-list');
  container.innerHTML = '';
  
  processes.forEach(process => {
    const card = createProcessCard(process);
    container.appendChild(card);
  });
}

function createProcessCard(process) {
  const card = document.createElement('div');
  card.className = 'process-card';
  
  if (process.processType === 'cooling') {
    card.innerHTML = `
      <h3>🧊 Nedkøling i gang</h3>
      <p><strong>${process.productName}</strong> - ${process.batchSize}</p>
      <p>Forløbet: ${MKP.ProcessInstances.calculateDuration(process.startedAt)}</p>
      <p>Resterende: ${MKP.ProcessInstances.calculateRemaining(process.startedAt, 4)}</p>
      <button onclick="addMeasurement('${process.id}')">Tilføj måling</button>
      <button onclick="completeCooling('${process.id}')">Afslut</button>
    `;
  }
  
  return card;
}
```

---

## TEST RESULTAT

Kør test med: `node functions/test/testProcessFlow.js`

**Forventet output:**
```
=== TEST: Complete Process Flow ===

1️⃣ Starting cooling process...
✅ Cooling process started: cooling_xxx
   Start temp: 78°C

2️⃣ Adding intermediate measurement...
✅ Measurement added: 42°C

3️⃣ Completing cooling process (SIMULATING FAILURE)...
❌ Cooling FAILED: deviation
   Requires recovery: true
   Deviation created: dev_xxx

4️⃣ Starting reheating process (RECOVERY)...
✅ Reheating process started: reheating_xxx
   Start temp: 15°C (from failed cooling)
   Triggered by cooling failure: true

5️⃣ Completing reheating process (SUCCESS)...
✅ Reheating SUCCESS: ok
   Can start new cooling: true

6️⃣ Starting new cooling from reheating...
✅ New cooling process started: cooling_xxx
   Start temp: 78°C (from reheating)

7️⃣ Completing new cooling process (SUCCESS)...
✅ New cooling SUCCESS: ok
   Requires recovery: false

8️⃣ Loading active process instances...
✅ Active processes: 0
   (Should be 0 since all processes are completed)

✅ TEST PASSED
```

---

## SAMMENFATNING

### **Implementeret:**
✅ Backend functions (processInstances.js)
✅ Cloud function exports (index.js)
✅ Aggregation logic opdateret (generateEgenkontrolFromRiskAnalysis.js)
✅ Client-side handler (processInstances.js)
✅ Test script (testProcessFlow.js)
✅ Komplet dokumentation

### **Mangler (UI integration):**
❌ Dashboard HTML opdatering
❌ Rutiner HTML opdatering
❌ CSS styling for process cards
❌ Modal styling

### **Klar til:**
✅ Deploy cloud functions
✅ Test i Firebase emulator
✅ Integration i eksisterende dashboard
