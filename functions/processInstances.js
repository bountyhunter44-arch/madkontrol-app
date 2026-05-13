const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;

/**
 * Start a cooling process
 */
async function startCoolingProcess({ 
  companyId, 
  locationId, 
  userId, 
  productName, 
  batchSize, 
  container, 
  startTemperature 
}) {
  const db = admin.firestore();
  
  // Validate start temperature
  if (startTemperature < 56) {
    throw new Error("Starttemperatur skal være mindst 56°C");
  }
  
  const dateKey = new Date().toISOString().split('T')[0];
  const processRef = db.collection("process_instances").doc();
  
  const processData = {
    processType: "cooling",
    templateId: "template_cooling_process",
    companyId,
    locationId,
    dateKey,
    
    status: "in_progress",
    
    productName,
    batchSize: batchSize || "",
    container: container || "",
    
    startedAt: FieldValue.serverTimestamp(),
    startedBy: userId,
    startTemperature,
    
    measurements: [{
      timestamp: new Date().toISOString(),
      temperature: startTemperature,
      note: "Start nedkøling",
      measuredBy: userId
    }],
    
    completedAt: null,
    completedBy: null,
    endTemperature: null,
    durationHours: null,
    
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
    newCoolingProcessId: null,
    
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  
  await processRef.set(processData);
  
  return { 
    processId: processRef.id,
    processData 
  };
}

/**
 * Add measurement to cooling process
 */
async function addCoolingMeasurement({ processId, temperature, note, userId }) {
  const db = admin.firestore();
  const processRef = db.collection("process_instances").doc(processId);
  const processDoc = await processRef.get();
  
  if (!processDoc.exists) {
    throw new Error("Process not found");
  }
  
  const processData = processDoc.data();
  
  if (processData.status !== "in_progress") {
    throw new Error("Process is not in progress");
  }
  
  const measurement = {
    timestamp: new Date().toISOString(),
    temperature,
    note: note || "",
    measuredBy: userId
  };
  
  await processRef.update({
    measurements: FieldValue.arrayUnion(measurement),
    updatedAt: FieldValue.serverTimestamp()
  });
  
  return { success: true, measurement };
}

/**
 * Complete cooling process
 */
async function completeCoolingProcess({ processId, endTemperature, note, userId }) {
  const db = admin.firestore();
  const processRef = db.collection("process_instances").doc(processId);
  const processDoc = await processRef.get();
  
  if (!processDoc.exists) {
    throw new Error("Process not found");
  }
  
  const processData = processDoc.data();
  
  if (processData.status !== "in_progress") {
    throw new Error("Process is not in progress");
  }
  
  // Calculate duration
  const startTime = processData.startedAt?.toDate() || new Date(processData.measurements[0].timestamp);
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
    measuredBy: userId
  };
  
  // Update process
  const updateData = {
    status: overallStatus === "ok" ? "completed" : "failed",
    completedAt: FieldValue.serverTimestamp(),
    completedBy: userId,
    endTemperature,
    durationHours,
    measurements: FieldValue.arrayUnion(finalMeasurement),
    validation: {
      startTempValid: true,
      targetTempReached,
      withinTimeLimit,
      overallStatus
    },
    updatedAt: FieldValue.serverTimestamp()
  };
  
  await processRef.update(updateData);
  
  // Auto-create deviation if failed
  let deviationId = null;
  if (overallStatus === "deviation") {
    deviationId = await createCoolingDeviation({
      processId,
      processData: { ...processData, endTemperature, durationHours },
      targetTempReached,
      withinTimeLimit,
      userId
    });
    
    await processRef.update({
      autoDeviationCreated: true,
      deviationId
    });
  }
  
  return { 
    success: true, 
    status: overallStatus,
    requiresRecovery: overallStatus === "deviation",
    deviationId
  };
}

/**
 * Create deviation for failed cooling
 */
async function createCoolingDeviation({ processId, processData, targetTempReached, withinTimeLimit, userId }) {
  const db = admin.firestore();
  const deviationRef = db.collection("deviations").doc();
  
  let deviationType = "";
  let message = "";
  
  if (!withinTimeLimit && !targetTempReached) {
    deviationType = "cooling_timeout_and_temp";
    message = `Nedkøling fejlet: Temperatur ${processData.endTemperature}°C ikke nået 10°C inden for 4 timer (${processData.durationHours.toFixed(1)}t)`;
  } else if (!withinTimeLimit) {
    deviationType = "cooling_timeout";
    message = `Nedkøling fejlet: Tidsgrænse overskredet (${processData.durationHours.toFixed(1)}t > 4t)`;
  } else {
    deviationType = "cooling_temp_missed";
    message = `Nedkøling fejlet: Måltemperatur ikke nået (${processData.endTemperature}°C > 10°C)`;
  }
  
  const deviationData = {
    type: deviationType,
    severity: "critical",
    
    companyId: processData.companyId,
    locationId: processData.locationId,
    dateKey: processData.dateKey,
    
    processInstanceId: processId,
    processType: "cooling",
    
    productName: processData.productName,
    batchSize: processData.batchSize,
    
    message,
    description: message,
    
    details: {
      startTime: processData.measurements[0].timestamp,
      endTime: processData.measurements[processData.measurements.length - 1].timestamp,
      duration: `${processData.durationHours.toFixed(1)} timer`,
      maxDuration: "4 timer",
      startTemp: processData.startTemperature,
      endTemp: processData.endTemperature,
      targetTemp: 10,
      tempDifference: processData.endTemperature - 10
    },
    
    correctiveAction: "Ved overskridelse: 1) Genopvarm straks til 75°C og start ny nedkøling, eller 2) Kassér varen.",
    
    status: "open",
    requiresImmediateAction: true,
    
    createdAt: FieldValue.serverTimestamp(),
    createdBy: userId,
    resolvedAt: null,
    resolvedBy: null
  };
  
  await deviationRef.set(deviationData);
  
  return deviationRef.id;
}

/**
 * Start reheating process (recovery from failed cooling)
 */
async function startReheatingProcess({ 
  companyId, 
  locationId, 
  userId, 
  failedCoolingProcessId 
}) {
  const db = admin.firestore();
  
  // Get failed cooling process
  const coolingDoc = await db.collection("process_instances").doc(failedCoolingProcessId).get();
  
  if (!coolingDoc.exists) {
    throw new Error("Failed cooling process not found");
  }
  
  const coolingData = coolingDoc.data();
  
  if (coolingData.status !== "failed") {
    throw new Error("Cooling process is not in failed state");
  }
  
  const dateKey = new Date().toISOString().split('T')[0];
  const processRef = db.collection("process_instances").doc();
  
  const processData = {
    processType: "reheating",
    templateId: "template_reheating_process",
    companyId,
    locationId,
    dateKey,
    
    status: "in_progress",
    
    productName: coolingData.productName,
    batchSize: coolingData.batchSize,
    
    startedAt: FieldValue.serverTimestamp(),
    startedBy: userId,
    startTemperature: coolingData.endTemperature,
    
    measurements: [{
      timestamp: new Date().toISOString(),
      temperature: coolingData.endTemperature,
      note: "Start genopvarmning",
      measuredBy: userId
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
    newCoolingProcessId: null,
    
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  
  await processRef.set(processData);
  
  // Link reheating to failed cooling
  await db.collection("process_instances").doc(failedCoolingProcessId).update({
    recoveryAction: "reheating",
    reheatingProcessId: processRef.id,
    updatedAt: FieldValue.serverTimestamp()
  });
  
  return { 
    processId: processRef.id,
    processData 
  };
}

/**
 * Complete reheating process
 */
async function completeReheatingProcess({ processId, endTemperature, note, userId }) {
  const db = admin.firestore();
  const processRef = db.collection("process_instances").doc(processId);
  const processDoc = await processRef.get();
  
  if (!processDoc.exists) {
    throw new Error("Process not found");
  }
  
  const processData = processDoc.data();
  
  if (processData.status !== "in_progress") {
    throw new Error("Process is not in progress");
  }
  
  // Validate
  const minTempReached = endTemperature >= 75;
  const overallStatus = minTempReached ? "ok" : "deviation";
  
  // Add final measurement
  const finalMeasurement = {
    timestamp: new Date().toISOString(),
    temperature: endTemperature,
    location: "centrum",
    note: note || "Målt i centrum af fødevaren",
    measuredBy: userId
  };
  
  // Update process
  const updateData = {
    status: overallStatus === "ok" ? "completed" : "failed",
    completedAt: FieldValue.serverTimestamp(),
    completedBy: userId,
    endTemperature,
    measurements: FieldValue.arrayUnion(finalMeasurement),
    validation: {
      minTempReached,
      coreTempMeasured: true,
      overallStatus
    },
    updatedAt: FieldValue.serverTimestamp()
  };
  
  await processRef.update(updateData);
  
  // Auto-create deviation if failed
  let deviationId = null;
  if (overallStatus === "deviation") {
    deviationId = await createReheatingDeviation({
      processId,
      processData: { ...processData, endTemperature },
      userId
    });
    
    await processRef.update({
      autoDeviationCreated: true,
      deviationId
    });
  }
  
  return { 
    success: true, 
    status: overallStatus,
    canStartNewCooling: overallStatus === "ok",
    deviationId
  };
}

/**
 * Create deviation for failed reheating
 */
async function createReheatingDeviation({ processId, processData, userId }) {
  const db = admin.firestore();
  const deviationRef = db.collection("deviations").doc();
  
  const deviationData = {
    type: "reheating_temp_missed",
    severity: "critical",
    
    companyId: processData.companyId,
    locationId: processData.locationId,
    dateKey: processData.dateKey,
    
    processInstanceId: processId,
    processType: "reheating",
    
    productName: processData.productName,
    batchSize: processData.batchSize,
    
    message: `Genopvarmning fejlet: Temperatur ${processData.endTemperature}°C ikke nået 75°C`,
    description: `Genopvarmning fejlet: Temperatur ${processData.endTemperature}°C ikke nået 75°C`,
    
    details: {
      endTemp: processData.endTemperature,
      targetTemp: 75,
      tempDifference: 75 - processData.endTemperature
    },
    
    correctiveAction: "Ved temperatur under 75°C: fortsæt opvarmning til 75°C nås, eller kassér varen.",
    
    status: "open",
    requiresImmediateAction: true,
    
    createdAt: FieldValue.serverTimestamp(),
    createdBy: userId,
    resolvedAt: null,
    resolvedBy: null
  };
  
  await deviationRef.set(deviationData);
  
  return deviationRef.id;
}

/**
 * Mark cooling process as disposed (alternative to reheating)
 */
async function disposeCoolingProcess({ processId, disposalReason, userId }) {
  const db = admin.firestore();
  const processRef = db.collection("process_instances").doc(processId);
  
  await processRef.update({
    recoveryAction: "disposal",
    disposalReason: disposalReason || "Kasseret efter fejlet nedkøling",
    disposedAt: FieldValue.serverTimestamp(),
    disposedBy: userId,
    updatedAt: FieldValue.serverTimestamp()
  });
  
  return { success: true };
}

/**
 * Start new cooling from successful reheating
 */
async function startNewCoolingFromReheating({ reheatingProcessId, userId }) {
  const db = admin.firestore();
  
  // Get reheating process
  const reheatingDoc = await db.collection("process_instances").doc(reheatingProcessId).get();
  
  if (!reheatingDoc.exists) {
    throw new Error("Reheating process not found");
  }
  
  const reheatingData = reheatingDoc.data();
  
  if (reheatingData.status !== "completed") {
    throw new Error("Reheating process is not completed");
  }
  
  // Start new cooling with reheated product
  const result = await startCoolingProcess({
    companyId: reheatingData.companyId,
    locationId: reheatingData.locationId,
    userId,
    productName: reheatingData.productName,
    batchSize: reheatingData.batchSize,
    container: reheatingData.container || "Gastronorm 1/1",
    startTemperature: reheatingData.endTemperature
  });
  
  // Link new cooling to reheating
  await db.collection("process_instances").doc(reheatingProcessId).update({
    newCoolingProcessId: result.processId,
    updatedAt: FieldValue.serverTimestamp()
  });
  
  return result;
}

/**
 * Load active process instances for location
 */
async function loadActiveProcessInstances({ locationId }) {
  const db = admin.firestore();
  
  const snapshot = await db.collection("process_instances")
    .where("locationId", "==", locationId)
    .where("status", "in", ["in_progress", "failed"])
    .orderBy("startedAt", "desc")
    .get();
  
  const processes = [];
  snapshot.forEach(doc => {
    processes.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return processes;
}

module.exports = {
  startCoolingProcess,
  addCoolingMeasurement,
  completeCoolingProcess,
  startReheatingProcess,
  completeReheatingProcess,
  disposeCoolingProcess,
  startNewCoolingFromReheating,
  loadActiveProcessInstances
};
