/**
 * Cooling History Model
 * Structured learning data for cooling control
 */

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

/**
 * Enum values for learning model
 */
const COOLING_ENUMS = {
  productCategory: [
    "hot_dish",
    "sauce",
    "soup",
    "stew",
    "meat",
    "poultry",
    "fish",
    "vegetables",
    "rice_pasta",
    "other"
  ],
  
  batchSize: [
    "lt_1kg",
    "kg_1_3",
    "kg_3_5",
    "kg_5_10",
    "gt_10kg"
  ],
  
  containerType: [
    "shallow_pan",
    "deep_pot",
    "gastronorm_half",
    "gastronorm_full",
    "plastic_container",
    "metal_container",
    "individual_portions",
    "other"
  ],
  
  coolingMethod: [
    "small_containers",
    "ice_bath",
    "blast_chiller",
    "cold_running_water",
    "fridge",
    "walk_in_cooler",
    "stirring",
    "ice_wand",
    "combination",
    "other"
  ],
  
  result: [
    "passed",
    "failed_time",
    "failed_temp",
    "failed_both",
    "invalid_data"
  ]
};

/**
 * Create cooling history record from task entry
 * @param {Object} taskEntry - Completed task entry
 * @param {Object} evaluation - Evaluation result
 * @returns {Object} Cooling history record
 */
function createCoolingHistoryRecord(taskEntry, evaluation) {
  const coolingData = taskEntry.coolingData || {};
  
  // Determine result enum
  let result = "passed";
  if (!evaluation.passed) {
    if (evaluation.failureReason?.includes("temperatur") && evaluation.failureReason?.includes("tid")) {
      result = "failed_both";
    } else if (evaluation.failureReason?.includes("tid") || evaluation.failureReason?.includes("minutter")) {
      result = "failed_time";
    } else if (evaluation.failureReason?.includes("temperatur")) {
      result = "failed_temp";
    } else {
      result = "invalid_data";
    }
  }
  
  const historyId = `cooling_history_${taskEntry.entryId}_${Date.now()}`;
  
  return {
    historyId,
    sourceTaskEntryId: taskEntry.entryId,
    taskInstanceId: taskEntry.taskInstanceId,
    templateId: taskEntry.templateId || null,
    companyId: taskEntry.companyId,
    locationId: taskEntry.locationId,
    
    // Product data
    productName: coolingData.productName || "",
    productCategory: coolingData.productCategory || "other",
    batchSize: coolingData.batchSize || null,
    containerType: coolingData.containerType || null,
    coolingMethod: coolingData.coolingMethod || "other",
    
    // Measurements
    startTemperature: coolingData.startTemp,
    endTemperature: coolingData.endTemp,
    startedAt: coolingData.startTime,
    endedAt: coolingData.endTime,
    durationMinutes: evaluation.durationMinutes,
    
    // Evaluation
    result,
    passed: evaluation.passed,
    failureReason: evaluation.failureReason || null,
    
    // Thresholds snapshot
    thresholds: evaluation.thresholdSnapshot || {},
    
    // Metadata
    dateKey: taskEntry.dateKey || new Date(coolingData.startTime).toISOString().split('T')[0],
    employeeId: taskEntry.employeeId,
    employeeName: taskEntry.employeeName,
    createdAt: new Date().toISOString(),
    
    // For future ML
    tags: generateLearningTags(coolingData, evaluation)
  };
}

/**
 * Generate learning tags for ML/analytics
 * @param {Object} coolingData - Cooling data
 * @param {Object} evaluation - Evaluation result
 * @returns {Array} Tags
 */
function generateLearningTags(coolingData, evaluation) {
  const tags = [];
  
  // Size-method combinations
  if (coolingData.batchSize && coolingData.coolingMethod) {
    tags.push(`${coolingData.batchSize}_${coolingData.coolingMethod}`);
  }
  
  // Product-method combinations
  if (coolingData.productCategory && coolingData.coolingMethod) {
    tags.push(`${coolingData.productCategory}_${coolingData.coolingMethod}`);
  }
  
  // Performance tags
  if (evaluation.passed) {
    tags.push("success");
    if (evaluation.durationMinutes < 120) {
      tags.push("fast_cooling");
    }
  } else {
    tags.push("failure");
    if (evaluation.durationMinutes > 180) {
      tags.push("slow_cooling");
    }
  }
  
  // Container efficiency
  if (coolingData.containerType) {
    tags.push(`container_${coolingData.containerType}`);
  }
  
  return tags;
}

/**
 * Save cooling history record to Firestore
 * @param {Object} historyRecord - History record
 */
async function saveCoolingHistory(historyRecord) {
  const db = getFirestore();
  await db.collection("cooling_history").doc(historyRecord.historyId).set(historyRecord);
}

/**
 * Get cooling recommendations based on history
 * @param {Object} params - Query parameters
 * @returns {Object} Recommendations
 */
async function getCoolingRecommendations(params) {
  const db = getFirestore();
  const { companyId, locationId, productCategory, batchSize } = params;
  
  // Query successful cooling history
  let query = db.collection("cooling_history")
    .where("companyId", "==", companyId)
    .where("passed", "==", true);
  
  if (locationId) {
    query = query.where("locationId", "==", locationId);
  }
  
  if (productCategory) {
    query = query.where("productCategory", "==", productCategory);
  }
  
  if (batchSize) {
    query = query.where("batchSize", "==", batchSize);
  }
  
  const snapshot = await query.limit(50).get();
  
  if (snapshot.empty) {
    return {
      hasData: false,
      recommendedMethod: null,
      avgDuration: null,
      successRate: null
    };
  }
  
  const records = snapshot.docs.map(doc => doc.data());
  
  // Calculate method frequency
  const methodCounts = {};
  let totalDuration = 0;
  
  records.forEach(record => {
    methodCounts[record.coolingMethod] = (methodCounts[record.coolingMethod] || 0) + 1;
    totalDuration += record.durationMinutes;
  });
  
  // Find most common successful method
  const recommendedMethod = Object.entries(methodCounts)
    .sort((a, b) => b[1] - a[1])[0][0];
  
  const avgDuration = Math.round(totalDuration / records.length);
  
  return {
    hasData: true,
    recommendedMethod,
    avgDuration,
    successRate: 100, // All queried records are successful
    sampleSize: records.length
  };
}

module.exports = {
  COOLING_ENUMS,
  createCoolingHistoryRecord,
  saveCoolingHistory,
  getCoolingRecommendations,
  generateLearningTags
};
