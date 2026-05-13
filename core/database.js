/**
 * Madkontrollen - Unified Database Schema & Helpers
 * Ensures consistent naming and structure across all Firestore collections
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Unified Document Schema
 * ALL Firestore documents MUST include these fields
 */
export const createBaseDocument = (userId, companyId, locationId, additionalData = {}) => {
  return {
    // Identity (REQUIRED)
    userId,
    companyId,
    locationId,
    
    // Timestamps (REQUIRED)
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    performedAt: serverTimestamp(),
    
    // Metadata
    performedBy: userId,
    
    // Status
    status: "active",
    
    // Additional data
    ...additionalData
  };
};

/**
 * Update existing document with unified timestamp
 */
export const createUpdateDocument = (additionalData = {}) => {
  return {
    updatedAt: serverTimestamp(),
    ...additionalData
  };
};

/**
 * Collection Names (Centralized)
 */
export const COLLECTIONS = {
  // Core
  USERS: "users",
  COMPANIES: "companies",
  LOCATIONS: "locations",
  
  // Egenkontrol (Core Module)
  TASK_INSTANCES: "task_instances",
  DAILY_RUNS: "daily_runs",
  DEVIATIONS: "deviations",
  REPORTS: "reports",
  MEDIA_ASSETS: "media_assets",
  
  // Lager (Commercial Module)
  INVENTORY_ITEMS: "inventory_items",
  INVENTORY_TRANSACTIONS: "inventory_transactions",
  INVENTORY_ALERTS: "inventory_alerts",
  
  // System
  SYSTEM_STATE: "system_state",
  WORKFLOW_STATE: "workflow_state"
};

/**
 * Status Values (Standardized)
 */
export const STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
  PENDING: "pending",
  OPEN: "open",
  CLOSED: "closed"
};

/**
 * Workflow Phases
 */
export const WORKFLOW_PHASES = {
  MODTAGELSE: "modtagelse",      // Reception
  PRODUKTION: "produktion",      // Production
  SERVICE: "service",            // Service
  LUK_RAPPORT: "luk_rapport"     // Close & Report
};

/**
 * Helper: Create Inventory Item
 */
export const createInventoryItem = (userId, companyId, locationId, itemData) => {
  return createBaseDocument(userId, companyId, locationId, {
    itemId: itemData.itemId,
    barcode: itemData.barcode,
    productName: itemData.productName,
    productCategory: itemData.productCategory,
    supplier: itemData.supplier || "",
    currentQuantity: itemData.currentQuantity,
    unit: itemData.unit,
    batches: itemData.batches || [],
    lastScannedAt: serverTimestamp()
  });
};

/**
 * Helper: Create Inventory Transaction
 */
export const createInventoryTransaction = (userId, companyId, locationId, transactionData) => {
  return createBaseDocument(userId, companyId, locationId, {
    transactionId: transactionData.transactionId,
    type: transactionData.type, // "scan_in", "scan_out", "mark_opened"
    itemId: transactionData.itemId,
    barcode: transactionData.barcode,
    productName: transactionData.productName,
    quantity: transactionData.quantity,
    unit: transactionData.unit,
    batchId: transactionData.batchId || null,
    expiryDate: transactionData.expiryDate || null,
    deliveryTemperature: transactionData.deliveryTemperature || null,
    deliveryTemperatureOk: transactionData.deliveryTemperatureOk || null,
    fifoWarningTriggered: transactionData.fifoWarningTriggered || false,
    olderBatchAvailable: transactionData.olderBatchAvailable || null,
    linkedToReport: transactionData.linkedToReport || null,
    temperatureCheckRecorded: transactionData.temperatureCheckRecorded || false,
    performedByName: transactionData.performedByName || ""
  });
};

/**
 * Helper: Create Deviation
 */
export const createDeviation = (userId, companyId, locationId, deviationData) => {
  return createBaseDocument(userId, companyId, locationId, {
    deviationId: deviationData.deviationId,
    type: deviationData.type,
    severity: deviationData.severity || "medium",
    description: deviationData.description,
    correctiveAction: deviationData.correctiveAction || "",
    imageUrls: deviationData.imageUrls || [],
    aiAnalysis: deviationData.aiAnalysis || null,
    requiresAction: true,
    approvedForReport: false,
    status: STATUS.OPEN
  });
};

/**
 * Helper: Create Task Instance
 */
export const createTaskInstance = (userId, companyId, locationId, taskData) => {
  return createBaseDocument(userId, companyId, locationId, {
    instanceId: taskData.instanceId,
    taskId: taskData.taskId,
    taskName: taskData.taskName,
    taskType: taskData.taskType,
    dailyRunId: taskData.dailyRunId,
    result: taskData.result || null,
    comment: taskData.comment || "",
    imageUrls: taskData.imageUrls || [],
    aiSuggestion: taskData.aiSuggestion || null,
    status: taskData.status || STATUS.PENDING
  });
};

/**
 * Helper: Get User Context
 * Returns userId, companyId, locationId from user document
 */
export const getUserContext = async (db, userId) => {
  const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
  
  if (!userDoc.exists()) {
    throw new Error("User not found");
  }
  
  const userData = userDoc.data();
  
  return {
    userId,
    companyId: userData.companyId,
    locationId: userData.locationId,
    displayName: userData.displayName || userData.email,
    email: userData.email
  };
};

/**
 * Helper: Query with User Context
 * Automatically filters by companyId and locationId
 */
export const queryWithContext = (db, collectionName, userContext, additionalConstraints = []) => {
  const constraints = [
    where("companyId", "==", userContext.companyId),
    where("locationId", "==", userContext.locationId),
    ...additionalConstraints
  ];
  
  return query(collection(db, collectionName), ...constraints);
};

/**
 * Helper: Set Dashboard Lock
 */
export const setDashboardLock = async (db, locked, reason, metadata = {}) => {
  await setDoc(doc(db, COLLECTIONS.SYSTEM_STATE, "dashboard_lock"), {
    locked,
    reason,
    message: metadata.message || "",
    actionUrl: metadata.actionUrl || "",
    actionLabel: metadata.actionLabel || "",
    updatedAt: serverTimestamp()
  });
};

/**
 * Helper: Get Dashboard Lock Status
 */
export const getDashboardLock = async (db) => {
  const lockDoc = await getDoc(doc(db, COLLECTIONS.SYSTEM_STATE, "dashboard_lock"));
  
  if (!lockDoc.exists()) {
    return { locked: false };
  }
  
  return lockDoc.data();
};

/**
 * Helper: Set Workflow Phase
 */
export const setWorkflowPhase = async (db, userContext, phase, progress = {}) => {
  const stateId = `${userContext.companyId}_${userContext.locationId}`;
  
  await setDoc(doc(db, COLLECTIONS.WORKFLOW_STATE, stateId), {
    ...userContext,
    currentPhase: phase,
    progress,
    updatedAt: serverTimestamp()
  });
};

/**
 * Helper: Get Workflow Phase
 */
export const getWorkflowPhase = async (db, userContext) => {
  const stateId = `${userContext.companyId}_${userContext.locationId}`;
  const stateDoc = await getDoc(doc(db, COLLECTIONS.WORKFLOW_STATE, stateId));
  
  if (!stateDoc.exists()) {
    return {
      currentPhase: WORKFLOW_PHASES.MODTAGELSE,
      progress: {}
    };
  }
  
  return stateDoc.data();
};

/**
 * Data Migration Helper
 * Migrates old documents to new unified schema
 */
export const migrateDocument = async (db, collectionName, docId, userId, companyId, locationId) => {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    console.warn(`Document ${docId} not found in ${collectionName}`);
    return false;
  }
  
  const oldData = docSnap.data();
  
  // Add missing unified fields
  const updates = {};
  
  if (!oldData.userId) updates.userId = userId;
  if (!oldData.companyId) updates.companyId = companyId;
  if (!oldData.locationId) updates.locationId = locationId;
  if (!oldData.performedBy) updates.performedBy = userId;
  if (!oldData.updatedAt) updates.updatedAt = serverTimestamp();
  
  // Normalize timestamp fields
  if (oldData.created_at && !oldData.createdAt) {
    updates.createdAt = oldData.created_at;
  }
  if (oldData.updated_at && !oldData.updatedAt) {
    updates.updatedAt = oldData.updated_at;
  }
  if (oldData.performed_at && !oldData.performedAt) {
    updates.performedAt = oldData.performed_at;
  }
  
  if (Object.keys(updates).length > 0) {
    await updateDoc(docRef, updates);
    console.log(`✅ Migrated ${collectionName}/${docId}`);
    return true;
  }
  
  return false;
};

/**
 * Cleanup Helper
 * Removes test data and duplicates
 */
export const cleanupTestData = async (db, collectionName) => {
  const testPatterns = ["test_", "temp_", "old_", "demo_"];
  
  const snapshot = await getDocs(collection(db, collectionName));
  let deletedCount = 0;
  
  for (const docSnap of snapshot.docs) {
    const docId = docSnap.id;
    
    // Check if ID matches test pattern
    const isTestData = testPatterns.some(pattern => docId.startsWith(pattern));
    
    if (isTestData) {
      await deleteDoc(doc(db, collectionName, docId));
      console.log(`🗑️ Deleted test data: ${collectionName}/${docId}`);
      deletedCount++;
    }
  }
  
  console.log(`✅ Cleaned up ${deletedCount} test documents from ${collectionName}`);
  return deletedCount;
};

export default {
  createBaseDocument,
  createUpdateDocument,
  createInventoryItem,
  createInventoryTransaction,
  createDeviation,
  createTaskInstance,
  getUserContext,
  queryWithContext,
  setDashboardLock,
  getDashboardLock,
  setWorkflowPhase,
  getWorkflowPhase,
  migrateDocument,
  cleanupTestData,
  COLLECTIONS,
  STATUS,
  WORKFLOW_PHASES
};
