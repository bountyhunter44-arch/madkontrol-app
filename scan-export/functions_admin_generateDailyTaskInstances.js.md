# FILE: functions/admin/generateDailyTaskInstances.js

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

function getDateKey(inputDate = null) {
    if (inputDate) {
        return inputDate;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getWeekdayFromDateKey(dateKey) {
    const date = new Date(`${dateKey}T12:00:00`);
    return date.getDay(); // 0=søndag, 1=mandag, ... 6=lørdag
}

function getIsoWeekNumber(dateKey) {
    const date = new Date(`${dateKey}T12:00:00`);
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const firstDayNr = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
    const weekNumber = 1 + Math.round((target - firstThursday) / 604800000);
    return weekNumber;
}

function shouldCreateForFrequency(frequency, dateKey) {
    const normalized = String(frequency || "daily").toLowerCase().trim();

    if (!normalized || normalized === "daily") {
        return true;
    }

    if (normalized === "weekly") {
        // Kør ugentlige opgaver om mandagen
        return getWeekdayFromDateKey(dateKey) === 1;
    }

    if (normalized === "monthly") {
        return dateKey.endsWith("-01");
    }

    if (normalized === "weekdays") {
        const weekday = getWeekdayFromDateKey(dateKey);
        return weekday >= 1 && weekday <= 5;
    }

    if (normalized === "weekends") {
        const weekday = getWeekdayFromDateKey(dateKey);
        return weekday === 0 || weekday === 6;
    }

    if (normalized === "twice_daily") {
        return true;
    }

    // Alt andet opfører sig som daily i v1
    return true;
}

function buildInstanceId(taskId, dateKey) {
    return `${taskId}__${dateKey}`;
}

function normalizeDateKey(value) {
    if (!value) return null;
    const str = String(value).trim();
    const match = str.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : null;
}

function resolveOperatingMode(data, dateKey) {
    if (!data || data.isActive === false) return "open";

    const untilDateKey =
        normalizeDateKey(data.untilDateKey) ||
        normalizeDateKey(data.until) ||
        normalizeDateKey(data.endDate);

    const stillValid = !untilDateKey || dateKey <= untilDateKey;
    if (!stillValid) return "open";

    if (data.closed === true) return "closed";
    if (data.vacation === true) return "vacation";
    return "open";
}

async function getOperatingModeForTask(companyId, locationId, dateKey) {
    if (!locationId) return "open";

    const tryQueries = [
        db.collection("operating_overrides")
            .where("companyId", "==", companyId || "")
            .where("locationId", "==", locationId)
            .limit(1),
        db.collection("operating_overrides")
            .where("locationId", "==", locationId)
            .limit(1)
    ];

    for (const q of tryQueries) {
        const snap = await q.get();
        if (snap.empty) continue;

        const mode = resolveOperatingMode(snap.docs[0].data() || {}, dateKey);
        if (mode !== "open") return mode;
    }

    return "open";
}

function normalizeTaskPayload(taskDoc, dateKey) {
    const task = taskDoc.data();
    const taskId = taskDoc.id;

    return {
        taskId,
        companyId: task.companyId || "",
        unitId: task.unitId || "",
        locationId: task.locationId || "",
        dateKey,
        title: task.title || "Opgave",
        description: task.description || "",
        taskType: task.type || "",
        category: task.category || "egenkontrol",
        equipmentId: task.equipmentId || "",
        equipmentType: task.equipmentType || "",
        equipmentName: task.equipmentName || "",
        frequency: task.frequency || "daily",
        requiresMeasurement: !!task.requiresMeasurement,
        measurementUnit: task.measurementUnit || "",
        minValue: task.minValue ?? null,
        maxValue: task.maxValue ?? null,
        linkedRiskIds: Array.isArray(task.linkedRiskIds) ? task.linkedRiskIds : [],
        assignedTo: task.assignedTo || "Michael Nielsen",
        assignedToId: task.assignedToId || "",
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };
}

async function getExistingInstance(instanceId) {
    const ref = db.collection("task_instances").doc(instanceId);
    const snap = await ref.get();
    return { ref, snap };
}

async function generateDailyTaskInstances({ locationId = null, dateKey = null } = {}) {
    const resolvedDateKey = getDateKey(dateKey);

    let query = db.collection("tasks").where("isActive", "==", true);

    if (locationId) {
        query = query.where("locationId", "==", locationId);
    }

    const taskSnap = await query.get();

    if (taskSnap.empty) {
        return {
            ok: true,
            message: "Ingen aktive tasks fundet.",
            dateKey: resolvedDateKey,
            created: 0,
            updated: 0,
            skipped: 0,
            totalTasks: 0
        };
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const modeCache = new Map();

    for (const taskDoc of taskSnap.docs) {
        const task = taskDoc.data();

        const modeKey = `${task.companyId || ""}__${task.locationId || ""}__${resolvedDateKey}`;
        let operatingMode = modeCache.get(modeKey);

        if (!operatingMode) {
            operatingMode = await getOperatingModeForTask(task.companyId || "", task.locationId || "", resolvedDateKey);
            modeCache.set(modeKey, operatingMode);
        }

        if (operatingMode === "closed" || operatingMode === "vacation") {
            skipped++;
            continue;
        }

        if (!shouldCreateForFrequency(task.frequency, resolvedDateKey)) {
            skipped++;
            continue;
        }

        const instanceId = buildInstanceId(taskDoc.id, resolvedDateKey);
        const { ref, snap } = await getExistingInstance(instanceId);
        const nextPayload = normalizeTaskPayload(taskDoc, resolvedDateKey);

        if (!snap.exists) {
            await ref.set(nextPayload);
            created++;
            continue;
        }

        const current = snap.data() || {};

        // Hvis opgaven allerede er udført, må vi ikke nulstille status eller completion-felter
        const isCompleted =
            current.status &&
            ["completed", "failed", "not_in_use"].includes(current.status);

        const comparableCurrent = JSON.stringify({
            taskId: current.taskId || "",
            companyId: current.companyId || "",
            unitId: current.unitId || "",
            locationId: current.locationId || "",
            dateKey: current.dateKey || "",
            title: current.title || "",
            description: current.description || "",
            taskType: current.taskType || "",
            category: current.category || "",
            equipmentId: current.equipmentId || "",
            equipmentType: current.equipmentType || "",
            equipmentName: current.equipmentName || "",
            frequency: current.frequency || "",
            requiresMeasurement: !!current.requiresMeasurement,
            measurementUnit: current.measurementUnit || "",
            minValue: current.minValue ?? null,
            maxValue: current.maxValue ?? null,
            linkedRiskIds: current.linkedRiskIds || [],
            assignedTo: current.assignedTo || "",
            assignedToId: current.assignedToId || "",
            status: current.status || "pending"
        });

        const comparableNext = JSON.stringify({
            taskId: nextPayload.taskId || "",
            companyId: nextPayload.companyId || "",
            unitId: nextPayload.unitId || "",
            locationId: nextPayload.locationId || "",
            dateKey: nextPayload.dateKey || "",
            title: nextPayload.title || "",
            description: nextPayload.description || "",
            taskType: nextPayload.taskType || "",
            category: nextPayload.category || "",
            equipmentId: nextPayload.equipmentId || "",
            equipmentType: nextPayload.equipmentType || "",
            equipmentName: nextPayload.equipmentName || "",
            frequency: nextPayload.frequency || "",
            requiresMeasurement: !!nextPayload.requiresMeasurement,
            measurementUnit: nextPayload.measurementUnit || "",
            minValue: nextPayload.minValue ?? null,
            maxValue: nextPayload.maxValue ?? null,
            linkedRiskIds: nextPayload.linkedRiskIds || [],
            assignedTo: nextPayload.assignedTo || "",
            assignedToId: nextPayload.assignedToId || "",
            status: isCompleted ? current.status : "pending"
        });

        if (comparableCurrent === comparableNext) {
            skipped++;
            continue;
        }

        const updatePayload = {
            ...nextPayload,
            createdAt: current.createdAt || FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };

        if (isCompleted) {
            updatePayload.status = current.status;
            updatePayload.completedAt = current.completedAt || null;
            updatePayload.completedBy = current.completedBy || "";
            updatePayload.completedByName = current.completedByName || "";
        }

        await ref.set(updatePayload, { merge: true });
        updated++;
    }

    return {
        ok: true,
        message: "Daglige task_instances genereret.",
        dateKey: resolvedDateKey,
        created,
        updated,
        skipped,
        totalTasks: taskSnap.size,
        isoWeek: getIsoWeekNumber(resolvedDateKey)
    };
}

async function run() {
    try {
        const locationId = process.argv[2] || null;
        const dateKey = process.argv[3] || null;

        const result = await generateDailyTaskInstances({
            locationId,
            dateKey
        });

        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error("Generator fejl:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    run();
}

module.exports = {
    generateDailyTaskInstances
};
```
