const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { evaluateCoolingControl, formatEvaluationSummary } = require("../egenkontrol/evaluators/coolingEvaluator");
const { createCoolingHistoryRecord, saveCoolingHistory } = require("../egenkontrol/models/coolingHistoryModel");

/**
 * Complete task entry with cooling control evaluation
 * @param {Object} params - Task entry parameters
 * @returns {Object} Saved entry with evaluation
 */
async function completeTaskEntryWithCooling(params) {
    const db = getFirestore();
    const {
        taskInstanceId,
        companyId,
        locationId,
        employeeId,
        employeeName,
        startTemp,
        endTemp,
        startTime,
        endTime,
        productName,
        productCategory,
        batchSize,
        containerType,
        coolingMethod,
        note,
        photoUrls = [],
        cloudinaryAssets = [],
        dateKey
    } = params;

    // Get task instance to retrieve config
    const taskDoc = await db.collection("task_instances").doc(taskInstanceId).get();
    if (!taskDoc.exists) {
        throw new Error(`Task instance ${taskInstanceId} not found`);
    }

    const task = taskDoc.data();
    const config = task.measurementConfig?.thresholds || {};

    // Evaluate cooling
    const evaluation = evaluateCoolingControl({
        startTemp,
        endTemp,
        startTime,
        endTime,
        productCategory,
        batchSize,
        containerType,
        coolingMethod
    }, config);

    const entryId = `entry_${taskInstanceId}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const entry = {
        entryId,
        taskInstanceId,
        companyId,
        locationId,
        employeeId,
        employeeName,
        entryType: "cooling_control",
        coolingData: {
            startTemp,
            endTemp,
            startTime,
            endTime,
            productName,
            productCategory,
            batchSize,
            containerType,
            coolingMethod
        },
        evaluation: {
            status: evaluation.status,
            passed: evaluation.passed,
            failureReason: evaluation.failureReason,
            durationMinutes: evaluation.durationMinutes,
            tempDrop: evaluation.tempDrop,
            thresholds: evaluation.thresholdSnapshot,
            evaluatedAt: evaluation.evaluatedAt,
            summary: formatEvaluationSummary(evaluation)
        },
        note: note || "",
        photoUrls,
        cloudinaryAssets,
        templateId: task.templateId || null,
        dateKey: dateKey || new Date(startTime).toISOString().split('T')[0],
        createdAt: timestamp,
        updatedAt: timestamp
    };

    // Save entry
    await db.collection("task_entries").doc(entryId).set(entry);

    // Update task instance status
    const newTaskStatus = evaluation.passed ? "completed" : "failed";
    await db.collection("task_instances").doc(taskInstanceId).update({
        status: newTaskStatus,
        completedAt: timestamp,
        completedBy: employeeId,
        completedByName: employeeName,
        lastEntryId: entryId,
        updatedAt: timestamp
    });

    // Create deviation if failed
    if (!evaluation.passed) {
        const deviationId = `deviation_${taskInstanceId}_${Date.now()}`;
        const deviation = {
            deviationId,
            taskInstanceId,
            entryId,
            companyId,
            locationId,
            type: "cooling_failure",
            severity: "high",
            title: `Nedkøling fejlet: ${productName || "Ukendt produkt"}`,
            description: evaluation.failureReason,
            details: {
                productName,
                startTemp,
                endTemp,
                durationMinutes: evaluation.durationMinutes,
                maxAllowedMinutes: config.maxDurationMinutes || 180
            },
            recommendedAction: evaluation.recommendedAction,
            status: "open",
            createdBy: employeeId,
            createdByName: employeeName,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        await db.collection("deviations").doc(deviationId).set(deviation);

        // Create alert
        const alertId = `alert_${deviationId}`;
        await db.collection("alerts").doc(alertId).set({
            alertId,
            deviationId,
            taskInstanceId,
            companyId,
            locationId,
            type: "cooling_failure",
            severity: "high",
            message: `Nedkøling af ${productName || "produkt"} overskred 3-timers reglen`,
            status: "unread",
            createdAt: timestamp
        });

        entry.deviationId = deviationId;
        entry.alertId = alertId;
    }

    // Save to cooling_history for learning
    try {
        const historyRecord = createCoolingHistoryRecord(entry, evaluation);
        await saveCoolingHistory(historyRecord);
        console.log(`[Cooling History] Saved: ${historyRecord.historyId}`);
    } catch (historyError) {
        console.error("[Cooling History] Failed to save:", historyError);
        // Don't fail the entire operation if history save fails
    }

    return entry;
}

module.exports = {
    completeTaskEntryWithCooling
};
