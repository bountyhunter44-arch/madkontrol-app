# FILE: functions/admin/completeTaskEntry.js

```javascript
const admin = require("firebase-admin");
const path = require("path");

if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

function normalizeNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const normalized = String(value).replace(",", ".").trim();
    const num = Number(normalized);

    return Number.isNaN(num) ? null : num;
}

function safeString(value) {
    return String(value || "").trim();
}

function toBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return ["true", "1", "yes", "ja"].includes(normalized);
    }
    return false;
}

function isMeasurementTask(taskInstance) {
    if (toBoolean(taskInstance.requiresMeasurement)) {
        return true;
    }

    const taskType = safeString(taskInstance.taskType).toLowerCase();
    const hasMeasurementUnit = safeString(taskInstance.measurementUnit) !== "";
    const hasMin = normalizeNumber(taskInstance.minValue) !== null;
    const hasMax = normalizeNumber(taskInstance.maxValue) !== null;

    return hasMeasurementUnit || hasMin || hasMax || taskType === "measurement";
}

function formatMeasurementValue(value, unit = "") {
    const normalized = normalizeNumber(value);
    if (normalized === null) {
        return "";
    }

    return `${normalized}${unit || ""}`;
}

function buildEvaluationMessage(taskInstance, evaluation, measurementValue) {
    const title = taskInstance.title || taskInstance.taskTitle || "Opgave";
    const equipmentName = taskInstance.equipmentName || "";
    const equipmentSuffix = equipmentName ? ` (${equipmentName})` : "";
    const unit = taskInstance.measurementUnit || "";

    const measured = normalizeNumber(measurementValue);
    const minValue = normalizeNumber(taskInstance.minValue);
    const maxValue = normalizeNumber(taskInstance.maxValue);

    const measuredText = measured !== null ? `${measured}${unit}` : "ingen gyldig måling";
    const minText = minValue !== null ? `${minValue}${unit}` : null;
    const maxText = maxValue !== null ? `${maxValue}${unit}` : null;

    switch (evaluation.reason) {
        case "below_min":
            return `${title}${equipmentSuffix} er registreret som afvigelse, fordi målingen (${measuredText}) er under minimumgrænsen${minText ? ` på ${minText}` : ""}.`;

        case "above_max":
            return `${title}${equipmentSuffix} er registreret som afvigelse, fordi målingen (${measuredText}) er over maksimumgrænsen${maxText ? ` på ${maxText}` : ""}.`;

        case "missing_measurement":
            return `${title}${equipmentSuffix} er registreret som afvigelse, fordi der mangler en gyldig måling.`;

        case "manual_deviation":
            return `${title}${equipmentSuffix} er manuelt markeret som afvigelse${measured !== null ? ` med målingen ${measuredText}` : ""}.`;

        case "within_limits":
            if (minText !== null && maxText !== null) {
                return `${title}${equipmentSuffix} er OK. Målingen (${measuredText}) ligger inden for grænserne ${minText} til ${maxText}.`;
            }
            if (minText !== null) {
                return `${title}${equipmentSuffix} er OK. Målingen (${measuredText}) ligger over minimumgrænsen ${minText}.`;
            }
            if (maxText !== null) {
                return `${title}${equipmentSuffix} er OK. Målingen (${measuredText}) ligger under maksimumgrænsen ${maxText}.`;
            }
            return `${title}${equipmentSuffix} er OK. Målingen er registreret som ${measuredText}.`;

        case "manual_complete":
            return `${title}${equipmentSuffix} er markeret som gennemført.`;

        default:
            return `${title}${equipmentSuffix} har en afvigelse${measured !== null ? ` med målingen ${measuredText}` : ""}.`;
    }
}

function evaluateMeasurement(taskInstance, measurementValue) {
    const minValue = normalizeNumber(taskInstance.minValue);
    const maxValue = normalizeNumber(taskInstance.maxValue);
    const measured = normalizeNumber(measurementValue);

    if (measured === null) {
        return {
            status: "failed",
            valueLabel: "Ugyldig måling",
            isDeviation: true,
            reason: "missing_measurement"
        };
    }

    if (minValue !== null && measured < minValue) {
        return {
            status: "failed",
            valueLabel: "Afvigelse",
            isDeviation: true,
            reason: "below_min"
        };
    }

    if (maxValue !== null && measured > maxValue) {
        return {
            status: "failed",
            valueLabel: "Afvigelse",
            isDeviation: true,
            reason: "above_max"
        };
    }

    return {
        status: "completed",
        valueLabel: "OK",
        isDeviation: false,
        reason: "within_limits"
    };
}

function buildAlertMessage(taskInstance, evaluation, measurementValue) {
    return buildEvaluationMessage(taskInstance, evaluation, measurementValue);
}

function buildAlertPayload({
    taskInstance,
    taskEntryId,
    measurementValue,
    note,
    evaluation,
    evaluationMessage
}) {
    if (!evaluation.isDeviation) {
        return null;
    }

    return {
        taskId: taskInstance.taskId || "",
        taskInstanceId: taskInstance.id || "",
        entryId: taskEntryId,
        companyId: taskInstance.companyId || "",
        unitId: taskInstance.unitId || "",
        locationId: taskInstance.locationId || "",
        message: buildAlertMessage(taskInstance, evaluation, measurementValue),
        description: evaluationMessage,
        severity: taskInstance.alertSeverityOnFailure || "high",
        alertType: taskInstance.alertTypeOnFailure || "task_failed",
        resolved: false,
        status: "open",
        isDeviation: true,
        evaluationReason: evaluation.reason || "deviation",
        measurementValue: normalizeNumber(measurementValue),
        measurementUnit: taskInstance.measurementUnit || "",
        minValue: normalizeNumber(taskInstance.minValue),
        maxValue: normalizeNumber(taskInstance.maxValue),
        note: safeString(note),
        linkedRiskIds: Array.isArray(taskInstance.linkedRiskIds) ? taskInstance.linkedRiskIds : [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };
}

function buildDeviationPayload({
    taskInstance,
    taskEntryId,
    measurementValue,
    note,
    evaluation,
    evaluationMessage
}) {
    if (!evaluation.isDeviation) {
        return null;
    }

    return {
        taskId: taskInstance.taskId || "",
        taskInstanceId: taskInstance.id || "",
        entryId: taskEntryId,
        companyId: taskInstance.companyId || "",
        unitId: taskInstance.unitId || "",
        locationId: taskInstance.locationId || "",
        title: taskInstance.title || "Afvigelse",
        description: evaluationMessage,
        equipmentId: taskInstance.equipmentId || "",
        equipmentName: taskInstance.equipmentName || "",
        taskType: taskInstance.taskType || "",
        status: "open",
        reason: evaluation.reason || "deviation",
        isDeviation: true,
        measurementValue: normalizeNumber(measurementValue),
        measurementUnit: taskInstance.measurementUnit || "",
        minValue: normalizeNumber(taskInstance.minValue),
        maxValue: normalizeNumber(taskInstance.maxValue),
        note: safeString(note),
        linkedRiskIds: Array.isArray(taskInstance.linkedRiskIds) ? taskInstance.linkedRiskIds : [],
        correctiveAction: "",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };
}

async function completeTaskEntry({
    taskInstanceId,
    actionType = "complete",
    measurementValue = null,
    note = "",
    completedBy = "system",
    completedByName = "System"
}) {
    if (!taskInstanceId) {
        throw new Error("taskInstanceId er påkrævet");
    }

    const taskInstanceRef = db.collection("task_instances").doc(taskInstanceId);
    const taskInstanceSnap = await taskInstanceRef.get();

    if (!taskInstanceSnap.exists) {
        throw new Error(`task_instance findes ikke: ${taskInstanceId}`);
    }

    const taskInstance = {
        id: taskInstanceSnap.id,
        ...taskInstanceSnap.data()
    };

    const normalizedActionType = safeString(actionType || "complete") || "complete";
    const normalizedNote = safeString(note);
    const normalizedCompletedBy = safeString(completedBy) || "system";
    const normalizedCompletedByName = safeString(completedByName) || "System";
    const normalizedMeasurementValue = normalizeNumber(measurementValue);

    let status = "completed";
    let valueLabel = "OK";
    let entryType = isMeasurementTask(taskInstance) ? "measurement" : "check";
    let evaluation = {
        status: "completed",
        valueLabel: "OK",
        isDeviation: false,
        reason: "manual_complete"
    };

    if (normalizedActionType === "not_in_use") {
        status = "not_in_use";
        valueLabel = "Ikke i brug";
        evaluation = {
            status: "not_in_use",
            valueLabel: "Ikke i brug",
            isDeviation: false,
            reason: "not_in_use"
        };
    } else if (normalizedActionType === "manual_deviation") {
        status = "failed";
        valueLabel = "Afvigelse";
        evaluation = {
            status: "failed",
            valueLabel: "Afvigelse",
            isDeviation: true,
            reason: "manual_deviation"
        };
    } else if (normalizedActionType === "complete" && isMeasurementTask(taskInstance)) {
        evaluation = evaluateMeasurement(taskInstance, measurementValue);
        status = evaluation.status;
        valueLabel = evaluation.valueLabel;
    } else if (normalizedActionType === "complete") {
        status = "completed";
        valueLabel = "OK";
        evaluation = {
            status: "completed",
            valueLabel: "OK",
            isDeviation: false,
            reason: "manual_complete"
        };
    } else {
        throw new Error(`Ukendt actionType: ${normalizedActionType}`);
    }

    const evaluationMessage = buildEvaluationMessage(taskInstance, evaluation, measurementValue);

    const entryRef = db.collection("task_entries").doc();
    const alertRef = evaluation.isDeviation ? db.collection("alerts").doc() : null;
    const deviationRef = evaluation.isDeviation ? db.collection("deviations").doc() : null;

    const entryPayload = {
        taskInstanceId: taskInstance.id,
        taskId: taskInstance.taskId || "",
        companyId: taskInstance.companyId || "",
        unitId: taskInstance.unitId || "",
        locationId: taskInstance.locationId || "",
        taskTitle: taskInstance.title || taskInstance.taskTitle || "",
        taskType: taskInstance.taskType || "",
        equipmentId: taskInstance.equipmentId || "",
        equipmentName: taskInstance.equipmentName || "",
        entryType,
        requiresMeasurement: isMeasurementTask(taskInstance),
        measurementValue: normalizedMeasurementValue,
        measurementUnit: taskInstance.measurementUnit || "",
        minValue: normalizeNumber(taskInstance.minValue),
        maxValue: normalizeNumber(taskInstance.maxValue),
        valueLabel,
        status,
        isDeviation: evaluation.isDeviation,
        evaluationReason: evaluation.reason || "",
        evaluationMessage,
        note: normalizedNote,
        dateKey: taskInstance.dateKey || "",
        completedBy: normalizedCompletedBy,
        completedByName: normalizedCompletedByName,
        actionType: normalizedActionType,
        createdAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };

    const batch = db.batch();
    batch.set(entryRef, entryPayload);

    const alertPayload = buildAlertPayload({
        taskInstance,
        taskEntryId: entryRef.id,
        measurementValue,
        note: normalizedNote,
        evaluation,
        evaluationMessage
    });

    if (alertRef && alertPayload) {
        batch.set(alertRef, alertPayload);
    }

    const deviationPayload = buildDeviationPayload({
        taskInstance,
        taskEntryId: entryRef.id,
        measurementValue,
        note: normalizedNote,
        evaluation,
        evaluationMessage
    });

    if (deviationRef && deviationPayload) {
        batch.set(deviationRef, deviationPayload);
    }

    batch.set(
        taskInstanceRef,
        {
            status,
            valueLabel,
            lastEntryId: entryRef.id,
            lastMeasurementValue: normalizedMeasurementValue,
            lastEvaluationReason: evaluation.reason || "",
            lastEvaluationMessage: evaluationMessage,
            isDeviation: evaluation.isDeviation,
            completedAt: FieldValue.serverTimestamp(),
            completedBy: normalizedCompletedBy,
            completedByName: normalizedCompletedByName,
            updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
    );

    await batch.commit();

    return {
        ok: true,
        message: "Task entry oprettet og task_instance opdateret.",
        taskInstanceId: taskInstance.id,
        taskEntryId: entryRef.id,
        status,
        valueLabel,
        isDeviation: evaluation.isDeviation,
        evaluationReason: evaluation.reason || null,
        evaluationMessage,
        alertCreated: !!alertRef,
        alertId: alertRef ? alertRef.id : null,
        deviationCreated: !!deviationRef,
        deviationId: deviationRef ? deviationRef.id : null
    };
}

async function run() {
    try {
        const taskInstanceId = process.argv[2];
        const actionType = process.argv[3] || "complete";
        const measurementValueArg = process.argv[4] ?? null;
        const note = process.argv[5] || "";
        const completedBy = process.argv[6] || "user_michael";
        const completedByName = process.argv[7] || "Michael Nielsen";

        const result = await completeTaskEntry({
            taskInstanceId,
            actionType,
            measurementValue: measurementValueArg,
            note,
            completedBy,
            completedByName
        });

        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error("Complete task fejl:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    run();
}

module.exports = {
    completeTaskEntry
};
```
