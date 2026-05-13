const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/æ/g, "ae")
        .replace(/ø/g, "oe")
        .replace(/å/g, "aa")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function titleFromRisk(risk) {
    switch (risk.processKey) {
        case "store_chilled_goods":
            return "Temperaturkontrol";
        case "store_frozen_goods":
            return "Frysertemperatur";
        case "hot_hold_food":
            return "Varmholdelse";
        case "reheat_food":
            return "Genopvarmning";
        case "cool_food":
            return "Nedkøling";
        case "receive_chilled_goods":
        case "receive_frozen_goods":
            return "Modtagekontrol";
        default:
            return risk.title || "Egenkontrol";
    }
}

function descriptionFromRisk(risk) {
    if (risk.controlType === "temperature_check") {
        return "Kontroller at temperaturen er inden for grænseværdien.";
    }

    return risk.description || "Udfør kontrol efter gældende procedure.";
}

function taskTypeFromRisk(risk) {
    if (risk.processKey === "cool_food") return "process_temperature_check";
    if (risk.controlType === "temperature_check") return "temperature_check";
    return "checklist";
}

function alertTypeFromRisk(risk) {
    switch (risk.processKey) {
        case "store_frozen_goods":
            return "freezer_temperature_out_of_range";
        case "store_chilled_goods":
            return "fridge_temperature_out_of_range";
        case "hot_hold_food":
            return "hot_holding_out_of_range";
        case "reheat_food":
            return "reheating_not_completed_correctly";
        case "cool_food":
            return "cooling_not_completed_correctly";
        default:
            return "task_failed";
    }
}

function alertSeverityFromRisk(risk) {
    if (risk.isCCP) return "high";
    return "medium";
}

function requiresMeasurement(risk) {
    return risk.controlType === "temperature_check";
}

function measurementUnit(risk) {
    return risk.limitUnit || "";
}

function frequencyFromRisk(risk) {
    return "daily";
}

function buildTaskDoc({ riskDoc, equipment = null }) {
    const risk = riskDoc.data();
    const riskId = riskDoc.id;

    const equipmentId = equipment?.id || "";
    const equipmentType = equipment?.type || "";
    const equipmentName = equipment?.name || "";

    const baseTaskId =
        equipment
            ? `task_${equipmentId}_${slugify(taskTypeFromRisk(risk))}_${frequencyFromRisk(risk)}`
            : `task_${slugify(risk.processKey || riskId)}_${frequencyFromRisk(risk)}`;

    return {
        taskId: baseTaskId,
        payload: {
            companyId: risk.companyId || "",
            locationId: risk.locationId || "",
            title: titleFromRisk(risk),
            description: descriptionFromRisk(risk),
            type: taskTypeFromRisk(risk),
            category: "egenkontrol",
            equipmentId,
            equipmentType,
            equipmentName,
            frequency: frequencyFromRisk(risk),
            requiresMeasurement: requiresMeasurement(risk),
            measurementUnit: measurementUnit(risk),
            minValue: risk.limitMin ?? null,
            maxValue: risk.limitMax ?? null,
            linkedRiskIds: [riskId],
            createsAlertOnFailure: true,
            alertTypeOnFailure: alertTypeFromRisk(risk),
            alertSeverityOnFailure: alertSeverityFromRisk(risk),
            isActive: risk.isActive !== false,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        }
    };
}

async function getEquipmentForLocation(locationId) {
    const snapshot = await db
        .collection("equipment")
        .where("locationId", "==", locationId)
        .where("isActive", "==", true)
        .get();

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
    }));
}

async function generateTasksFromRisks({ locationId = null } = {}) {
    let riskQuery = db.collection("risks").where("isActive", "==", true);

    if (locationId) {
        riskQuery = riskQuery.where("locationId", "==", locationId);
    }

    const riskSnap = await riskQuery.get();

    if (riskSnap.empty) {
        return {
            ok: true,
            message: "Ingen aktive risks fundet.",
            created: 0,
            updated: 0,
            skipped: 0
        };
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const riskDoc of riskSnap.docs) {
        const risk = riskDoc.data();

        if (!risk.locationId) {
            console.log(`Springer ${riskDoc.id} over: mangler locationId`);
            continue;
        }

        const linkedEquipmentTypes = Array.isArray(risk.linkedEquipmentTypes)
            ? risk.linkedEquipmentTypes
            : [];

        let taskDefinitions = [];

        if (linkedEquipmentTypes.length > 0) {
            const equipmentList = await getEquipmentForLocation(risk.locationId);
            const matched = equipmentList.filter((eq) =>
                linkedEquipmentTypes.includes(eq.type)
            );

            if (matched.length > 0) {
                taskDefinitions = matched.map((equipment) =>
                    buildTaskDoc({ riskDoc, equipment })
                );
            } else {
                taskDefinitions = [buildTaskDoc({ riskDoc })];
            }
        } else {
            taskDefinitions = [buildTaskDoc({ riskDoc })];
        }

        for (const task of taskDefinitions) {
            const ref = db.collection("tasks").doc(task.taskId);
            const existing = await ref.get();

            if (!existing.exists) {
                await ref.set(task.payload);
                created++;
                continue;
            }

            const current = existing.data() || {};

            const comparableCurrent = JSON.stringify({
                companyId: current.companyId || "",
                locationId: current.locationId || "",
                title: current.title || "",
                description: current.description || "",
                type: current.type || "",
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
                createsAlertOnFailure: !!current.createsAlertOnFailure,
                alertTypeOnFailure: current.alertTypeOnFailure || "",
                alertSeverityOnFailure: current.alertSeverityOnFailure || "",
                isActive: current.isActive !== false
            });

            const comparableNext = JSON.stringify({
                companyId: task.payload.companyId || "",
                locationId: task.payload.locationId || "",
                title: task.payload.title || "",
                description: task.payload.description || "",
                type: task.payload.type || "",
                category: task.payload.category || "",
                equipmentId: task.payload.equipmentId || "",
                equipmentType: task.payload.equipmentType || "",
                equipmentName: task.payload.equipmentName || "",
                frequency: task.payload.frequency || "",
                requiresMeasurement: !!task.payload.requiresMeasurement,
                measurementUnit: task.payload.measurementUnit || "",
                minValue: task.payload.minValue ?? null,
                maxValue: task.payload.maxValue ?? null,
                linkedRiskIds: task.payload.linkedRiskIds || [],
                createsAlertOnFailure: !!task.payload.createsAlertOnFailure,
                alertTypeOnFailure: task.payload.alertTypeOnFailure || "",
                alertSeverityOnFailure: task.payload.alertSeverityOnFailure || "",
                isActive: task.payload.isActive !== false
            });

            if (comparableCurrent === comparableNext) {
                skipped++;
                continue;
            }

            await ref.set(
                {
                    ...task.payload,
                    createdAt: current.createdAt || FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                },
                { merge: true }
            );
            updated++;
        }
    }

    return {
        ok: true,
        message: "Tasks genereret fra risks.",
        created,
        updated,
        skipped,
        totalRisks: riskSnap.size
    };
}

async function run() {
    try {
        const locationId = process.argv[2] || null;
        const result = await generateTasksFromRisks({ locationId });
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
    generateTasksFromRisks
};