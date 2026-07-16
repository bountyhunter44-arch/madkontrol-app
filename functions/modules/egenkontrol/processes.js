"use strict";

const functions = require("firebase-functions");
const processInstances = require("../../processInstances");

const startCoolingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { companyId, locationId, productName, batchSize, container, startTemperature } = data;

  if (!companyId || !locationId || !productName || startTemperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.startCoolingProcess({
      companyId,
      locationId,
      userId: context.auth.uid,
      productName,
      batchSize,
      container,
      startTemperature
    });
  } catch (error) {
    console.error("Start cooling process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

const addCoolingMeasurement = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, temperature, note } = data;

  if (!processId || temperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.addCoolingMeasurement({
      processId,
      temperature,
      note,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Add cooling measurement fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

const completeCoolingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, endTemperature, note } = data;

  if (!processId || endTemperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.completeCoolingProcess({
      processId,
      endTemperature,
      note,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Complete cooling process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

const startReheatingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { companyId, locationId, failedCoolingProcessId } = data;

  if (!companyId || !locationId || !failedCoolingProcessId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.startReheatingProcess({
      companyId,
      locationId,
      userId: context.auth.uid,
      failedCoolingProcessId
    });
  } catch (error) {
    console.error("Start reheating process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

const completeReheatingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, endTemperature, note } = data;

  if (!processId || endTemperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.completeReheatingProcess({
      processId,
      endTemperature,
      note,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Complete reheating process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

const disposeCoolingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, disposalReason } = data;

  if (!processId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.disposeCoolingProcess({
      processId,
      disposalReason,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Dispose cooling process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

const startNewCoolingFromReheating = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { reheatingProcessId } = data;

  if (!reheatingProcessId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.startNewCoolingFromReheating({
      reheatingProcessId,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Start new cooling from reheating fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

const loadActiveProcessInstances = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { locationId } = data;

  if (!locationId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.loadActiveProcessInstances({ locationId });
  } catch (error) {
    console.error("Load active process instances fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

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
