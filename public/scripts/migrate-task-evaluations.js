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

function safeString(value) {
    return String(value || "").trim();
}

function normalizeNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const normalized = String(value).replace(",", ".").trim();
    const num = Number(normalized);

    return Number.isNaN(num) ? null : num;
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

function buildEvaluationMessage({
    title,
    equipmentName,
    reason,
    measurementValue,
    measurementUnit,
    minValue,
    maxValue,
    status
}) {
    const safeTitle = safeString(title) || "Opgave";
    const safeEquipment = safeString(equipmentName);
    const equipmentSuffix = safeEquipment ? ` (${safeEquipment})` : "";

    const normalizedMeasurement = normalizeNumber(measurementValue);
    const normalizedMin = normalizeNumber(minValue);
    const normalizedMax = normalizeNumber(maxValue);
    const unit = safeString(measurementUnit);

    const measuredText = normalizedMeasurement !== null
        ? `${normalizedMeasurement}${unit}`
        : "ingen gyldig måling";

    const minText = normalizedMin !== null ? `${normalizedMin}${unit}` : null;
    const maxText = normalizedMax !== null ? `${normalizedMax}${unit}` : null;

    switch (reason) {
        case "below_min":
            return `${safeTitle}${equipmentSuffix} er registreret som afvigelse, fordi målingen (${measuredText}) er under minimumgrænsen${minText ? ` på ${minText}` : ""}.`;

        case "above_max":
            return `${safeTitle}${equipmentSuffix} er registreret som afvigelse, fordi målingen (${measuredText}) er over maksimumgrænsen${maxText ? ` på ${maxText}` : ""}.`;

        case "missing_measurement":
            return `${safeTitle}${equipmentSuffix} er registreret som afvigelse, fordi der mangler en gyldig måling.`;

        case "manual_deviation":
            return `${safeTitle}${equipmentSuffix} er manuelt markeret som afvigelse${normalizedMeasurement !== null ? ` med målingen ${measuredText}` : ""}.`;

        case "within_limits":
            if (minText !== null && maxText !== null) {
                return `${safeTitle}${equipmentSuffix} er OK. Målingen (${measuredText}) ligger inden for grænserne ${minText} til ${maxText}.`;
            }
            if (minText !== null) {
                return `${safeTitle}${equipmentSuffix} er OK. Målingen (${measuredText}) ligger over minimumgrænsen ${minText}.`;
            }
            if (maxText !== null) {
                return `${safeTitle}${equipmentSuffix} er OK. Målingen (${measuredText}) ligger under maksimumgrænsen ${maxText}.`;
            }
            return `${safeTitle}${equipmentSuffix} er OK.`;

        case "manual_complete":
            return `${safeTitle}${equipmentSuffix} er markeret som gennemført.`;

        case "not_in_use":
            return `${safeTitle}${equipmentSuffix} er markeret som ikke i brug.`;

        default:
            if (status === "failed") {
                return `${safeTitle}${equipmentSuffix} er registreret som afvigelse.`;
            }
            if (status === "not_in_use") {
                return `${safeTitle}${equipmentSuffix} er markeret som ikke i brug.`;
            }
            return `${safeTitle}${equipmentSuffix} er registreret som OK.`;
    }
}

function inferReason({
    status,
    actionType,
    measurementValue,
    minValue,
    maxValue,
    existingReason
}) {
    const explicitReason = safeString(existingReason);
    if (explicitReason) {
        return explicitReason;
    }

    const normalizedStatus = safeString(status).toLowerCase();
    const normalizedActionType = safeString(actionType).toLowerCase();
    const measured = normalizeNumber(measurementValue);
    const min = normalizeNumber(minValue);
    const max = normalizeNumber(maxValue);

    if (normalizedActionType === "manual_deviation") {
        return "manual_deviation";
    }

    if (normalizedActionType === "not_in_use" || normalizedStatus === "not_in_use") {
        return "not_in_use";
    }

    if (normalizedStatus === "failed") {
        if (measured === null) {
            return "missing_measurement";
        }
        if (min !== null && measured < min) {
            return "below_min";
        }
        if (max !== null && measured > max) {
            return "above_max";
        }
        return "deviation";
    }

    if (normalizedStatus === "completed") {
        if (measured !== null && ((min !== null) || (max !== null))) {
            return "within_limits";
        }
        return "manual_complete";
    }

    return "unknown";
}

async function getTaskInstanceMap() {
    const snap = await db.collection("task_instances").get();
    const map = new Map();

    snap.forEach((doc) => {
        map.set(doc.id, {
            id: doc.id,
            ...doc.data()
        });
    });

    return map;
}

async function migrateTaskEntries(taskInstanceMap) {
    console.log("Migrerer task_entries...");
    const snap = await db.collection("task_entries").get();

    let updated = 0;
    let skipped = 0;
    let batch = db.batch();
    let ops = 0;

    for (const doc of snap.docs) {
        const data = doc.data();
        const taskInstance = taskInstanceMap.get(data.taskInstanceId) || null;

        const title = data.taskTitle || taskInstance?.title || taskInstance?.taskTitle || "Opgave";
        const equipmentName = data.equipmentName || taskInstance?.equipmentName || "";
        const measurementUnit = data.measurementUnit || taskInstance?.measurementUnit || "";
        const measurementValue = normalizeNumber(data.measurementValue);
        const minValue = data.minValue ?? taskInstance?.minValue ?? null;
        const maxValue = data.maxValue ?? taskInstance?.maxValue ?? null;

        const reason = inferReason({
            status: data.status,
            actionType: data.actionType,
            measurementValue,
            minValue,
            maxValue,
            existingReason: data.evaluationReason
        });

        const isDeviation = toBoolean(data.isDeviation) || reason === "below_min" || reason === "above_max" || reason === "missing_measurement" || reason === "manual_deviation" || safeString(data.status).toLowerCase() === "failed";

        const evaluationMessage = data.evaluationMessage || buildEvaluationMessage({
            title,
            equipmentName,
            reason,
            measurementValue,
            measurementUnit,
            minValue,
            maxValue,
            status: data.status
        });

        const patch = {};
        let changed = false;

        if (data.measurementValue !== measurementValue) {
            patch.measurementValue = measurementValue;
            changed = true;
        }

        if (data.minValue === undefined) {
            patch.minValue = normalizeNumber(minValue);
            changed = true;
        }

        if (data.maxValue === undefined) {
            patch.maxValue = normalizeNumber(maxValue);
            changed = true;
        }

        if (data.isDeviation === undefined) {
            patch.isDeviation = isDeviation;
            changed = true;
        }

        if (!safeString(data.evaluationReason)) {
            patch.evaluationReason = reason;
            changed = true;
        }

        if (!safeString(data.evaluationMessage)) {
            patch.evaluationMessage = evaluationMessage;
            changed = true;
        }

        if (data.requiresMeasurement === undefined && taskInstance) {
            const inferredRequiresMeasurement =
                toBoolean(taskInstance.requiresMeasurement) ||
                normalizeNumber(taskInstance.minValue) !== null ||
                normalizeNumber(taskInstance.maxValue) !== null ||
                safeString(taskInstance.measurementUnit) !== "" ||
                safeString(taskInstance.taskType).toLowerCase() === "measurement";

            patch.requiresMeasurement = inferredRequiresMeasurement;
            changed = true;
        }

        if (!changed) {
            skipped += 1;
            continue;
        }

        patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        batch.set(doc.ref, patch, { merge: true });
        updated += 1;
        ops += 1;

        if (ops === 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    }

    if (ops > 0) {
        await batch.commit();
    }

    console.log(`task_entries færdig. Updated: ${updated}, skipped: ${skipped}`);
}

async function migrateAlerts(taskInstanceMap) {
    console.log("Migrerer alerts...");
    const snap = await db.collection("alerts").get();

    let updated = 0;
    let skipped = 0;
    let batch = db.batch();
    let ops = 0;

    for (const doc of snap.docs) {
        const data = doc.data();
        const taskInstance = taskInstanceMap.get(data.taskInstanceId) || null;

        const title =
            taskInstance?.title ||
            taskInstance?.taskTitle ||
            data.title ||
            "Opgave";

        const equipmentName =
            taskInstance?.equipmentName ||
            data.equipmentName ||
            "";

        const measurementUnit =
            data.measurementUnit ||
            taskInstance?.measurementUnit ||
            "";

        const measurementValue = normalizeNumber(data.measurementValue);
        const minValue = data.minValue ?? taskInstance?.minValue ?? null;
        const maxValue = data.maxValue ?? taskInstance?.maxValue ?? null;

        const reason = inferReason({
            status: data.status === "open" ? "failed" : data.status,
            actionType: data.actionType,
            measurementValue,
            minValue,
            maxValue,
            existingReason: data.evaluationReason || data.reason
        });

        const evaluationMessage =
            data.description ||
            buildEvaluationMessage({
                title,
                equipmentName,
                reason,
                measurementValue,
                measurementUnit,
                minValue,
                maxValue,
                status: "failed"
            });

        const patch = {};
        let changed = false;

        if (data.measurementValue !== measurementValue) {
            patch.measurementValue = measurementValue;
            changed = true;
        }

        if (data.minValue === undefined) {
            patch.minValue = normalizeNumber(minValue);
            changed = true;
        }

        if (data.maxValue === undefined) {
            patch.maxValue = normalizeNumber(maxValue);
            changed = true;
        }

        if (data.isDeviation === undefined) {
            patch.isDeviation = true;
            changed = true;
        }

        if (!safeString(data.evaluationReason)) {
            patch.evaluationReason = reason;
            changed = true;
        }

        if (!safeString(data.description)) {
            patch.description = evaluationMessage;
            changed = true;
        }

        if (!changed) {
            skipped += 1;
            continue;
        }

        patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        batch.set(doc.ref, patch, { merge: true });
        updated += 1;
        ops += 1;

        if (ops === 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    }

    if (ops > 0) {
        await batch.commit();
    }

    console.log(`alerts færdig. Updated: ${updated}, skipped: ${skipped}`);
}

async function migrateDeviations(taskInstanceMap) {
    console.log("Migrerer deviations...");
    const snap = await db.collection("deviations").get();

    let updated = 0;
    let skipped = 0;
    let batch = db.batch();
    let ops = 0;

    for (const doc of snap.docs) {
        const data = doc.data();
        const taskInstance = taskInstanceMap.get(data.taskInstanceId) || null;

        const title =
            data.title ||
            taskInstance?.title ||
            taskInstance?.taskTitle ||
            "Afvigelse";

        const equipmentName =
            data.equipmentName ||
            taskInstance?.equipmentName ||
            "";

        const measurementUnit =
            data.measurementUnit ||
            taskInstance?.measurementUnit ||
            "";

        const measurementValue = normalizeNumber(data.measurementValue);
        const minValue = data.minValue ?? taskInstance?.minValue ?? null;
        const maxValue = data.maxValue ?? taskInstance?.maxValue ?? null;

        const reason = inferReason({
            status: data.status === "open" ? "failed" : data.status,
            actionType: data.actionType,
            measurementValue,
            minValue,
            maxValue,
            existingReason: data.reason
        });

        const description =
            data.description ||
            buildEvaluationMessage({
                title,
                equipmentName,
                reason,
                measurementValue,
                measurementUnit,
                minValue,
                maxValue,
                status: "failed"
            });

        const patch = {};
        let changed = false;

        if (data.measurementValue !== measurementValue) {
            patch.measurementValue = measurementValue;
            changed = true;
        }

        if (data.minValue === undefined) {
            patch.minValue = normalizeNumber(minValue);
            changed = true;
        }

        if (data.maxValue === undefined) {
            patch.maxValue = normalizeNumber(maxValue);
            changed = true;
        }

        if (data.isDeviation === undefined) {
            patch.isDeviation = true;
            changed = true;
        }

        if (!safeString(data.reason)) {
            patch.reason = reason;
            changed = true;
        }

        if (!safeString(data.description)) {
            patch.description = description;
            changed = true;
        }

        if (!changed) {
            skipped += 1;
            continue;
        }

        patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        batch.set(doc.ref, patch, { merge: true });
        updated += 1;
        ops += 1;

        if (ops === 400) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    }

    if (ops > 0) {
        await batch.commit();
    }

    console.log(`deviations færdig. Updated: ${updated}, skipped: ${skipped}`);
}

async function run() {
    try {
        console.log("Henter task_instances...");
        const taskInstanceMap = await getTaskInstanceMap();

        await migrateTaskEntries(taskInstanceMap);
        await migrateAlerts(taskInstanceMap);
        await migrateDeviations(taskInstanceMap);

        console.log("Migration gennemført.");
        process.exit(0);
    } catch (error) {
        console.error("Migration fejl:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    run();
}