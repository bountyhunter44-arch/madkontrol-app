# FILE: functions/admin/softArchive.js

```javascript
/**
 * Soft Archive - Safe alternative to hard delete
 * Archives data instead of deleting it permanently
 */

const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;

/**
 * Archive company data (soft delete)
 */
async function archiveCompany({ companyId, reason, archivedBy }) {
  const db = admin.firestore();
  
  // Update company status to archived
  await db.collection("companies").doc(companyId).update({
    status: "archived",
    archivedAt: FieldValue.serverTimestamp(),
    archivedBy,
    archiveReason: reason || "Manual archive",
    updatedAt: FieldValue.serverTimestamp()
  });
  
  // Archive all locations
  const locations = await db.collection("locations")
    .where("companyId", "==", companyId)
    .get();
  
  const batch = db.batch();
  
  locations.docs.forEach(doc => {
    batch.update(doc.ref, {
      status: "archived",
      archivedAt: FieldValue.serverTimestamp(),
      archivedBy,
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  
  await batch.commit();
  
  return {
    success: true,
    archivedCompany: companyId,
    archivedLocations: locations.size
  };
}

/**
 * Restore archived company
 */
async function restoreCompany({ companyId, restoredBy }) {
  const db = admin.firestore();
  
  // Restore company
  await db.collection("companies").doc(companyId).update({
    status: "active",
    restoredAt: FieldValue.serverTimestamp(),
    restoredBy,
    archivedAt: admin.firestore.FieldValue.delete(),
    archivedBy: admin.firestore.FieldValue.delete(),
    archiveReason: admin.firestore.FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp()
  });
  
  // Restore all locations
  const locations = await db.collection("locations")
    .where("companyId", "==", companyId)
    .get();
  
  const batch = db.batch();
  
  locations.docs.forEach(doc => {
    batch.update(doc.ref, {
      status: "active",
      restoredAt: FieldValue.serverTimestamp(),
      restoredBy,
      archivedAt: admin.firestore.FieldValue.delete(),
      archivedBy: admin.firestore.FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  
  await batch.commit();
  
  return {
    success: true,
    restoredCompany: companyId,
    restoredLocations: locations.size
  };
}

/**
 * Start new period (archive old data, keep company active)
 */
async function startNewPeriod({ companyId, locationId, periodName, startedBy }) {
  const db = admin.firestore();
  
  const periodId = `period_${Date.now()}`;
  
  // Archive current period's task instances
  const tasks = await db.collection("task_instances")
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .get();
  
  const batch = db.batch();
  let archivedCount = 0;
  
  tasks.docs.forEach(doc => {
    batch.update(doc.ref, {
      archived: true,
      archivedPeriod: periodId,
      archivedAt: FieldValue.serverTimestamp(),
      archivedBy: startedBy
    });
    archivedCount++;
  });
  
  // Archive alerts
  const alerts = await db.collection("alerts")
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .where("status", "==", "open")
    .get();
  
  alerts.docs.forEach(doc => {
    batch.update(doc.ref, {
      archived: true,
      archivedPeriod: periodId,
      archivedAt: FieldValue.serverTimestamp(),
      archivedBy: startedBy
    });
    archivedCount++;
  });
  
  await batch.commit();
  
  // Create period record
  await db.collection("periods").doc(periodId).set({
    id: periodId,
    companyId,
    locationId,
    name: periodName || `Periode ${new Date().toLocaleDateString('da-DK')}`,
    startedAt: FieldValue.serverTimestamp(),
    startedBy,
    archivedTasksCount: tasks.size,
    archivedAlertsCount: alerts.size,
    totalArchivedCount: archivedCount
  });
  
  return {
    success: true,
    periodId,
    archivedCount,
    message: `Ny periode startet. ${archivedCount} dokumenter arkiveret.`
  };
}

/**
 * Get archived data for a period
 */
async function getArchivedPeriodData({ periodId, companyId, locationId }) {
  const db = admin.firestore();
  
  // Get period info
  const periodDoc = await db.collection("periods").doc(periodId).get();
  
  if (!periodDoc.exists) {
    throw new Error("Period not found");
  }
  
  // Get archived tasks
  const tasks = await db.collection("task_instances")
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .where("archivedPeriod", "==", periodId)
    .get();
  
  // Get archived alerts
  const alerts = await db.collection("alerts")
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .where("archivedPeriod", "==", periodId)
    .get();
  
  return {
    period: periodDoc.data(),
    tasks: tasks.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    alerts: alerts.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  };
}

module.exports = {
  archiveCompany,
  restoreCompany,
  startNewPeriod,
  getArchivedPeriodData
};

```
