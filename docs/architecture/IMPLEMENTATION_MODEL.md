# MADKONTROL - COMPLETE IMPLEMENTATION MODEL

## 1. DATA MODEL CHANGES

### 1.1 Task Templates (task_templates collection)

Templates are now categorized by `templateType`:

```javascript
{
  id: "template_id",
  templateType: "operational" | "verification" | "process",
  aggregatedCategory: "temperature_cooling" | "fryer_critical" | "cooling_process" | etc.,
  frequency: "daily" | "twice_daily" | "weekly" | "monthly" | "per_batch" | "continuous",
  
  // Standard fields
  name: "Temperaturkontrol af køl",
  description: "...",
  controlType: "temperature" | "checklist" | "cooling_process" | "reheating_process",
  
  // Limits
  limitMin: null,
  limitMax: 5,
  unit: "°C",
  
  // Process-specific (for cooling/reheating/hot_holding)
  startTempMin: 56,  // For cooling_process
  maxDurationHours: 4,  // For cooling_process
  
  // Metadata
  isCritical: false,
  isAggregated: true,
  isActive: true
}
```

### 1.2 Process Instances (process_instances collection)

NEW collection for active process routines:

```javascript
{
  id: "cooling_20260324_001",
  processType: "cooling" | "reheating" | "hot_holding",
  templateId: "template_cooling_process",
  
  // Location and user
  companyId: "company_001",
  locationId: "location_001",
  dateKey: "2026-03-24",
  
  // Status
  status: "in_progress" | "completed" | "failed" | "deviation",
  
  // Product info
  productName: "Kyllingebryst (stegt)",
  batchSize: "2.5 kg",
  container: "Gastronorm 1/1",
  
  // Process data
  startedAt: "2026-03-24T12:00:00Z",
  startedBy: "user_123",
  startTemperature: 78,
  
  // Measurements (array)
  measurements: [
    {
      timestamp: "2026-03-24T12:00:00Z",
      temperature: 78,
      note: "Start nedkøling",
      measuredBy: "user_123"
    },
    {
      timestamp: "2026-03-24T13:00:00Z",
      temperature: 42,
      note: "Efter 1 time",
      measuredBy: "user_123"
    }
  ],
  
  // Completion
  completedAt: null,
  completedBy: null,
  endTemperature: null,
  
  // Validation
  validation: {
    startTempValid: true,
    targetTempReached: false,
    withinTimeLimit: true,
    overallStatus: "in_progress"
  },
  
  // Recovery (for failed cooling)
  autoDeviationCreated: false,
  deviationId: null,
  recoveryAction: null,  // "reheating" | "disposal" | null
  reheatingProcessId: null,  // Link to reheating process
  
  // Links
  triggeredByCoolingFailure: false,
  originalCoolingProcessId: null,
  newCoolingProcessId: null
}
```

### 1.3 Task Instances (task_instances collection)

UNCHANGED - daily task instances continue as before:

```javascript
{
  id: "task_20260324_temp_cooling_walkin",
  dateKey: "2026-03-24",
  templateId: "template_temp_cooling",
  
  // Equipment/area reference (for equipment/area-based templates)
  equipmentId: "eq_walkin_001",
  equipmentName: "Walk-in køleskab",
  
  // Status
  status: "pending" | "in_progress" | "completed",
  measurement: 5,
  completedAt: "2026-03-24T08:15:00Z",
  completedBy: "user_123"
}
```

---

## 2. PROCESS INSTANCE CREATION

### 2.1 Start Cooling Process

**Trigger:** User clicks "Start nedkøling" button

**Function:** `startCoolingProcess()`

```javascript
async function startCoolingProcess({ locationId, productName, batchSize, container, startTemperature }) {
  // Validate start temperature
  if (startTemperature < 56) {
    throw new Error("Starttemperatur skal være mindst 56°C");
  }
  
  // Create process instance
  const processRef = db.collection("process_instances").doc();
  await processRef.set({
    processType: "cooling",
    templateId: "template_cooling_process",
    companyId: getCurrentCompanyId(),
    locationId,
    dateKey: getTodayKey(),
    
    status: "in_progress",
    
    productName,
    batchSize,
    container,
    
    startedAt: FieldValue.serverTimestamp(),
    startedBy: getCurrentUserId(),
    startTemperature,
    
    measurements: [{
      timestamp: new Date().toISOString(),
      temperature: startTemperature,
      note: "Start nedkøling",
      measuredBy: getCurrentUserId()
    }],
    
    completedAt: null,
    completedBy: null,
    endTemperature: null,
    
    validation: {
      startTempValid: true,
      targetTempReached: false,
      withinTimeLimit: true,
      overallStatus: "in_progress"
    },
    
    autoDeviationCreated: false,
    deviationId: null,
    recoveryAction: null,
    reheatingProcessId: null,
    
    triggeredByCoolingFailure: false,
    originalCoolingProcessId: null,
    newCoolingProcessId: null
  });
  
  return { processId: processRef.id };
}
```

### 2.2 Add Measurement to Cooling Process

**Function:** `addCoolingMeasurement()`

```javascript
async function addCoolingMeasurement({ processId, temperature, note }) {
  const processRef = db.collection("process_instances").doc(processId);
  const processDoc = await processRef.get();
  
  if (!processDoc.exists) {
    throw new Error("Process not found");
  }
  
  const processData = processDoc.data();
  
  // Add measurement
  await processRef.update({
    measurements: FieldValue.arrayUnion({
      timestamp: new Date().toISOString(),
      temperature,
      note: note || "",
      measuredBy: getCurrentUserId()
    })
  });
  
  return { success: true };
}
```

### 2.3 Complete Cooling Process

**Function:** `completeCoolingProcess()`

```javascript
async function completeCoolingProcess({ processId, endTemperature, note }) {
  const processRef = db.collection("process_instances").doc(processId);
  const processDoc = await processRef.get();
  
  if (!processDoc.exists) {
    throw new Error("Process not found");
  }
  
  const processData = processDoc.data();
  const startTime = new Date(processData.startedAt);
  const endTime = new Date();
  const durationHours = (endTime - startTime) / (1000 * 60 * 60);
  
  // Validate
  const targetTempReached = endTemperature <= 10;
  const withinTimeLimit = durationHours <= 4;
  const overallStatus = (targetTempReached && withinTimeLimit) ? "ok" : "deviation";
  
  // Add final measurement
  const finalMeasurement = {
    timestamp: endTime.toISOString(),
    temperature: endTemperature,
    note: note || "Sluttemperatur",
    measuredBy: getCurrentUserId()
  };
  
  // Update process
  await processRef.update({
    status: overallStatus === "ok" ? "completed" : "failed",
    completedAt: FieldValue.serverTimestamp(),
    completedBy: getCurrentUserId(),
    endTemperature,
    durationHours,
    measurements: FieldValue.arrayUnion(finalMeasurement),
    validation: {
      startTempValid: true,
      targetTempReached,
      withinTimeLimit,
      overallStatus
    }
  });
  
  // Auto-create deviation if failed
  if (overallStatus === "deviation") {
    const deviationRef = await createCoolingDeviation({
      processId,
      processData: { ...processData, endTemperature, durationHours },
      targetTempReached,
      withinTimeLimit
    });
    
    await processRef.update({
      autoDeviationCreated: true,
      deviationId: deviationRef.id
    });
  }
  
  return { 
    success: true, 
    status: overallStatus,
    requiresRecovery: overallStatus === "deviation"
  };
}
```

### 2.4 Start Reheating Process (Recovery)

**Trigger:** User selects "Genopvarm til 75°C" after cooling failure

**Function:** `startReheatingProcess()`

```javascript
async function startReheatingProcess({ locationId, failedCoolingProcessId }) {
  // Get failed cooling process
  const coolingDoc = await db.collection("process_instances").doc(failedCoolingProcessId).get();
  const coolingData = coolingDoc.data();
  
  // Create reheating process
  const processRef = db.collection("process_instances").doc();
  await processRef.set({
    processType: "reheating",
    templateId: "template_reheating_process",
    companyId: getCurrentCompanyId(),
    locationId,
    dateKey: getTodayKey(),
    
    status: "in_progress",
    
    productName: coolingData.productName,
    batchSize: coolingData.batchSize,
    
    startedAt: FieldValue.serverTimestamp(),
    startedBy: getCurrentUserId(),
    startTemperature: coolingData.endTemperature,
    
    measurements: [{
      timestamp: new Date().toISOString(),
      temperature: coolingData.endTemperature,
      note: "Start genopvarmning",
      measuredBy: getCurrentUserId()
    }],
    
    completedAt: null,
    completedBy: null,
    endTemperature: null,
    
    validation: {
      minTempReached: false,
      coreTempMeasured: false,
      overallStatus: "in_progress"
    },
    
    triggeredByCoolingFailure: true,
    originalCoolingProcessId: failedCoolingProcessId,
    newCoolingProcessId: null
  });
  
  // Link reheating to failed cooling
  await db.collection("process_instances").doc(failedCoolingProcessId).update({
    recoveryAction: "reheating",
    reheatingProcessId: processRef.id
  });
  
  return { processId: processRef.id };
}
```

### 2.5 Complete Reheating Process

**Function:** `completeReheatingProcess()`

```javascript
async function completeReheatingProcess({ processId, endTemperature, note }) {
  const processRef = db.collection("process_instances").doc(processId);
  const processDoc = await processRef.get();
  const processData = processDoc.data();
  
  // Validate
  const minTempReached = endTemperature >= 75;
  const overallStatus = minTempReached ? "ok" : "deviation";
  
  // Add final measurement
  const finalMeasurement = {
    timestamp: new Date().toISOString(),
    temperature: endTemperature,
    location: "centrum",
    note: note || "Målt i centrum af fødevaren",
    measuredBy: getCurrentUserId()
  };
  
  // Update process
  await processRef.update({
    status: overallStatus === "ok" ? "completed" : "failed",
    completedAt: FieldValue.serverTimestamp(),
    completedBy: getCurrentUserId(),
    endTemperature,
    measurements: FieldValue.arrayUnion(finalMeasurement),
    validation: {
      minTempReached,
      coreTempMeasured: true,
      overallStatus
    }
  });
  
  // Auto-create deviation if failed
  if (overallStatus === "deviation") {
    await createReheatingDeviation({ processId, processData, endTemperature });
  }
  
  return { 
    success: true, 
    status: overallStatus,
    canStartNewCooling: overallStatus === "ok"
  };
}
```

---

## 3. DASHBOARD UI INTEGRATION

### 3.1 Load Routines for Dashboard

**Function:** `loadDashboardRoutines()`

```javascript
async function loadDashboardRoutines({ locationId, dateKey }) {
  // 1. Load fixed daily task instances (operational templates)
  const dailyTasksSnap = await db.collection("task_instances")
    .where("locationId", "==", locationId)
    .where("dateKey", "==", dateKey)
    .where("templateType", "==", "operational")
    .get();
  
  const dailyTasks = dailyTasksSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    routineType: "daily"
  }));
  
  // 2. Load active process instances
  const activeProcessesSnap = await db.collection("process_instances")
    .where("locationId", "==", locationId)
    .where("status", "in", ["in_progress", "failed"])
    .get();
  
  const activeProcesses = activeProcessesSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    routineType: "process"
  }));
  
  // 3. Load periodic routines (verification templates) - only if due
  const periodicTasksSnap = await db.collection("task_instances")
    .where("locationId", "==", locationId)
    .where("dateKey", "==", dateKey)
    .where("templateType", "==", "verification")
    .get();
  
  const periodicTasks = periodicTasksSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    routineType: "periodic"
  }));
  
  return {
    dailyRoutines: dailyTasks,
    activeProcesses: activeProcesses,
    periodicRoutines: periodicTasks
  };
}
```

### 3.2 Dashboard HTML Structure

```html
<!-- dashboard.html -->
<div id="mkp-dashboard">
  
  <!-- Fixed Daily Routines (always visible) -->
  <section id="daily-routines">
    <h2>Daglige rutiner</h2>
    <div id="daily-routines-list">
      <!-- Populated with operational task instances -->
    </div>
  </section>
  
  <!-- Active Process Routines (only when active) -->
  <section id="active-processes" style="display: none;">
    <h2>Aktive processer</h2>
    <div id="active-processes-list">
      <!-- Populated with in-progress process instances -->
    </div>
  </section>
  
  <!-- Start Process Buttons -->
  <section id="process-actions">
    <button id="btn-start-cooling">🧊 Start nedkøling</button>
    <button id="btn-start-reheating" style="display: none;">🔥 Start genopvarmning</button>
  </section>
  
  <!-- Periodic Routines (collapsed by default) -->
  <section id="periodic-routines">
    <h2>
      <button id="toggle-periodic">▶ Vis periodiske rutiner</button>
    </h2>
    <div id="periodic-routines-list" style="display: none;">
      <!-- Populated with verification task instances -->
    </div>
  </section>
  
</div>
```

### 3.3 Dashboard Rendering Logic

```javascript
// dashboard.js

async function renderDashboard() {
  const locationId = getSelectedLocationId();
  const dateKey = getTodayKey();
  
  const { dailyRoutines, activeProcesses, periodicRoutines } = 
    await loadDashboardRoutines({ locationId, dateKey });
  
  // Render daily routines (always visible)
  renderDailyRoutines(dailyRoutines);
  
  // Render active processes (only if any exist)
  if (activeProcesses.length > 0) {
    document.getElementById("active-processes").style.display = "block";
    renderActiveProcesses(activeProcesses);
  } else {
    document.getElementById("active-processes").style.display = "none";
  }
  
  // Render periodic routines (collapsed)
  renderPeriodicRoutines(periodicRoutines);
}

function renderDailyRoutines(routines) {
  const container = document.getElementById("daily-routines-list");
  container.innerHTML = "";
  
  // Group by template
  const grouped = groupByTemplate(routines);
  
  for (const [templateId, tasks] of Object.entries(grouped)) {
    const card = createRoutineCard(tasks[0].templateName, tasks);
    container.appendChild(card);
  }
}

function renderActiveProcesses(processes) {
  const container = document.getElementById("active-processes-list");
  container.innerHTML = "";
  
  for (const process of processes) {
    const card = createProcessCard(process);
    container.appendChild(card);
  }
}

function createProcessCard(process) {
  const card = document.createElement("div");
  card.className = "process-card";
  
  if (process.processType === "cooling") {
    card.innerHTML = `
      <div class="process-header">
        <h3>🧊 Nedkøling i gang</h3>
        <span class="process-status">${process.status}</span>
      </div>
      <div class="process-body">
        <p><strong>${process.productName}</strong> - ${process.batchSize}</p>
        <p>Startet: ${formatTime(process.startedAt)} (${process.startTemperature}°C)</p>
        <p>Forløbet tid: ${calculateDuration(process.startedAt)}</p>
        <p>Resterende tid: ${calculateRemaining(process.startedAt, 4)}</p>
        
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${calculateProgress(process)}%"></div>
        </div>
        
        <div class="process-actions">
          <button onclick="addMeasurement('${process.id}')">Tilføj måling</button>
          <button onclick="completeCooling('${process.id}')">Afslut nedkøling</button>
        </div>
      </div>
    `;
  } else if (process.processType === "reheating") {
    card.innerHTML = `
      <div class="process-header">
        <h3>🔥 Genopvarmning i gang</h3>
        <span class="process-status critical">${process.status}</span>
      </div>
      <div class="process-body">
        <p><strong>${process.productName}</strong> - ${process.batchSize}</p>
        <p>Startet: ${formatTime(process.startedAt)} (${process.startTemperature}°C)</p>
        <p>Mål: Min. 75°C i centrum</p>
        
        <div class="process-actions">
          <button onclick="completeReheating('${process.id}')">Afslut genopvarmning</button>
        </div>
      </div>
    `;
  }
  
  return card;
}
```

---

## 4. RECOVERY FLOW

### 4.1 Cooling Fails → Recovery Options

```javascript
async function completeCooling(processId) {
  const endTemp = parseFloat(document.getElementById("cooling-end-temp").value);
  const note = document.getElementById("cooling-note").value;
  
  const result = await completeCoolingProcess({ processId, endTemperature: endTemp, note });
  
  if (result.requiresRecovery) {
    // Show recovery options modal
    showRecoveryOptions(processId);
  } else {
    // Success - refresh dashboard
    renderDashboard();
  }
}

function showRecoveryOptions(failedCoolingProcessId) {
  const modal = document.createElement("div");
  modal.className = "recovery-modal";
  modal.innerHTML = `
    <div class="modal-content">
      <h2>⚠️ Nedkøling fejlet</h2>
      <p>Vælg handling:</p>
      
      <button onclick="selectRecovery('${failedCoolingProcessId}', 'reheating')">
        🔥 Genopvarm til 75°C
      </button>
      
      <button onclick="selectRecovery('${failedCoolingProcessId}', 'disposal')">
        🗑️ Kassér varen
      </button>
    </div>
  `;
  
  document.body.appendChild(modal);
}

async function selectRecovery(failedCoolingProcessId, action) {
  if (action === "reheating") {
    const locationId = getSelectedLocationId();
    const result = await startReheatingProcess({ locationId, failedCoolingProcessId });
    
    // Close modal and refresh dashboard
    closeRecoveryModal();
    renderDashboard();
    
  } else if (action === "disposal") {
    // Mark as disposed
    await db.collection("process_instances").doc(failedCoolingProcessId).update({
      recoveryAction: "disposal",
      disposalReason: prompt("Årsag til kassation:"),
      disposedAt: FieldValue.serverTimestamp(),
      disposedBy: getCurrentUserId()
    });
    
    closeRecoveryModal();
    renderDashboard();
  }
}
```

### 4.2 Reheating Success → Start New Cooling

```javascript
async function completeReheating(processId) {
  const endTemp = parseFloat(document.getElementById("reheating-end-temp").value);
  const note = document.getElementById("reheating-note").value;
  
  const result = await completeReheatingProcess({ processId, endTemperature: endTemp, note });
  
  if (result.canStartNewCooling) {
    // Show option to start new cooling
    showNewCoolingOption(processId);
  } else {
    // Failed - show error
    alert("Genopvarmning fejlet. Temperatur ikke nået 75°C.");
    renderDashboard();
  }
}

function showNewCoolingOption(reheatingProcessId) {
  const modal = document.createElement("div");
  modal.className = "new-cooling-modal";
  modal.innerHTML = `
    <div class="modal-content">
      <h2>✅ Genopvarmning gennemført</h2>
      <p>Varen er nu genopvarmet til 75°C.</p>
      <p>Start ny nedkøling?</p>
      
      <button onclick="startNewCoolingFromReheating('${reheatingProcessId}')">
        🧊 Start ny nedkøling
      </button>
      
      <button onclick="closeModal()">
        Afslut uden nedkøling
      </button>
    </div>
  `;
  
  document.body.appendChild(modal);
}

async function startNewCoolingFromReheating(reheatingProcessId) {
  // Get reheating process data
  const reheatingDoc = await db.collection("process_instances").doc(reheatingProcessId).get();
  const reheatingData = reheatingDoc.data();
  
  // Start new cooling with reheated product
  const result = await startCoolingProcess({
    locationId: reheatingData.locationId,
    productName: reheatingData.productName,
    batchSize: reheatingData.batchSize,
    container: reheatingData.container || "Gastronorm 1/1",
    startTemperature: reheatingData.endTemperature
  });
  
  // Link new cooling to reheating
  await db.collection("process_instances").doc(reheatingProcessId).update({
    newCoolingProcessId: result.processId
  });
  
  closeModal();
  renderDashboard();
}
```

---

## 5. SUMMARY

### Data Model:
- ✅ `task_templates` with `templateType`: operational, verification, process
- ✅ `process_instances` collection for cooling/reheating/hot_holding
- ✅ `task_instances` unchanged (daily tasks)

### Process Creation:
- ✅ `startCoolingProcess()` - creates process instance
- ✅ `addCoolingMeasurement()` - adds intermediate measurements
- ✅ `completeCoolingProcess()` - validates and creates deviation if needed
- ✅ `startReheatingProcess()` - recovery from failed cooling
- ✅ `completeReheatingProcess()` - validates reheating

### Dashboard UI:
- ✅ Fixed daily routines (always visible)
- ✅ Active processes (only when in_progress/failed)
- ✅ Periodic routines (collapsed by default)
- ✅ Process cards show live progress
- ✅ Recovery flow: cooling fail → reheating → new cooling

### Recovery Flow:
- ✅ Cooling fails → auto-deviation → recovery options
- ✅ User selects reheating → starts reheating process
- ✅ Reheating success → option to start new cooling
- ✅ New cooling linked to reheating process

### Key Differences from Fixed Routines:
- ❌ Process routines NOT created at start day
- ✅ Process instances created on-demand by user
- ✅ Process instances shown only when active
- ✅ Process instances removed from UI when completed
- ✅ Clear separation: daily (fixed) vs process (dynamic) vs periodic (collapsed)
