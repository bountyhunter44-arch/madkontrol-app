# FILE: functions/admin/generateCleaningTasks.js

```javascript
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

const CLEANING_RULES = [
    {
        key: "tools_after_production",
        title: "Rengøring af værktøj",
        description: "Rengør knive, redskaber, skærebrætter og øvrigt værktøj efter produktion.",
        category: "cleaning",
        zone: "tools",
        trigger: "after_production",
        priority: "critical_now",
        canDefer: false,
        requiresMeasurement: false,
        equipmentTypes: []
    },
    {
        key: "surfaces_after_production",
        title: "Rengøring af overflader",
        description: "Rengør og desinficér arbejdsflader og produktionsborde efter produktion.",
        category: "cleaning",
        zone: "surfaces",
        trigger: "after_production",
        priority: "critical_now",
        canDefer: false,
        requiresMeasurement: false,
        equipmentTypes: []
    },
    {
        key: "sweeping_after_production",
        title: "Fejning af gulv",
        description: "Fej gulvet efter produktion for at fjerne madrester og snavs.",
        category: "cleaning",
        zone: "sweeping",
        trigger: "after_production",
        priority: "critical_now",
        canDefer: false,
        requiresMeasurement: false,
        equipmentTypes: []
    },
    {
        key: "floors_closing",
        title: "Vask af gulv",
        description: "Vask gulve grundigt ved luk. Kan udsættes fra mellemrengøring til luk.",
        category: "cleaning",
        zone: "floors",
        trigger: "closing",
        priority: "closing_only",
        canDefer: true,
        requiresMeasurement: false,
        equipmentTypes: []
    },
    {
        key: "walls_weekly",
        title: "Rengøring af vægge",
        description: "Rengør vægge og stænkområder efter behov og mindst ugentligt.",
        category: "cleaning",
        zone: "walls",
        trigger: "weekly",
        priority: "weekly_only",
        canDefer: false,
        requiresMeasurement: false,
        equipmentTypes: []
    },
    {
        key: "drains_weekly",
        title: "Rengøring af afløb",
        description: "Rengør gulvafløb og riste grundigt.",
        category: "cleaning",
        zone: "drains",
        trigger: "weekly",
        priority: "weekly_only",
        canDefer: false,
        requiresMeasurement: false,
        equipmentTypes: []
    },
    {
        key: "allergen_cleaning",
        title: "Allergen-rengøring",
        description: "Rengør værktøj, overflader og relevante kontaktpunkter før næste produktion uden allergenet.",
        category: "cleaning",
        zone: "allergen",
        trigger: "after_allergen",
        priority: "critical_now",
        canDefer: false,
        requiresMeasurement: false,
        equipmentTypes: []
    },
    {
        key: "event_cleaning",
        title: "Ekstra rengøring efter event",
        description: "Rengør overflader, gulve, serveringsområder og affaldspunkter efter arrangement.",
        category: "cleaning",
        zone: "event_area",
        trigger: "after_event",
        priority: "critical_now",
        canDefer: false,
        requiresMeasurement: false,
        equipmentTypes: []
    }
];

const EQUIPMENT_CLEANING_RULES = {
    fridge: {
        titlePrefix: "Rengøring af",
        trigger: "weekly",
        priority: "weekly_only",
        canDefer: false,
        description: "Rengør udstyr efter gældende procedure.",
        zone: "equipment"
    },
    freezer: {
        titlePrefix: "Rengøring af",
        trigger: "weekly",
        priority: "weekly_only",
        canDefer: false,
        description: "Rengør udstyr efter gældende procedure.",
        zone: "equipment"
    },
    dishwasher: {
        titlePrefix: "Rengøring af",
        trigger: "weekly",
        priority: "weekly_only",
        canDefer: false,
        description: "Rengør udstyr efter gældende procedure.",
        zone: "equipment"
    },
    warming_cabinet: {
        titlePrefix: "Rengøring af",
        trigger: "weekly",
        priority: "weekly_only",
        canDefer: false,
        description: "Rengør udstyr efter gældende procedure.",
        zone: "equipment"
    },
    blast_chiller: {
        titlePrefix: "Rengøring af",
        trigger: "weekly",
        priority: "weekly_only",
        canDefer: false,
        description: "Rengør udstyr efter gældende procedure.",
        zone: "equipment"
    },
    display_fridge: {
        titlePrefix: "Rengøring af",
        trigger: "weekly",
        priority: "weekly_only",
        canDefer: false,
        description: "Rengør udstyr efter gældende procedure.",
        zone: "equipment"
    }
};

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

function dedupeByKey(items) {
    const map = new Map();
    for (const item of items) {
        map.set(item.key, item);
    }
    return Array.from(map.values());
}

async function getOnboardingByLocation(locationId) {
    const snap = await db
        .collection("onboarding_answers")
        .where("locationId", "==", locationId)
        .limit(1)
        .get();

    if (snap.empty) return null;
    return {
        id: snap.docs[0].id,
        ...snap.docs[0].data()
    };
}

async function getEquipmentByLocation(locationId) {
    try {
        const snap = await db
            .collection("equipment")
            .where("locationId", "==", locationId)
            .where("isActive", "==", true)
            .get();

        return snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        return [];
    }
}

function buildEquipmentFromOnboarding(onboarding) {
    const counts = onboarding?.equipmentCounts || {};
    const result = [];

    for (const [type, count] of Object.entries(counts)) {
        const safeCount = Number(count) || 0;
        for (let i = 1; i <= safeCount; i++) {
            result.push({
                id: `eq_${type}_${i}`,
                type,
                name: prettyEquipmentName(type, i),
                isSynthetic: true
            });
        }
    }

    return result;
}

function prettyEquipmentName(type, index) {
    const names = {
        fridge: "Køleskab",
        freezer: "Fryser",
        dishwasher: "Opvaskemaskine",
        warming_cabinet: "Varmeskab",
        blast_chiller: "Blast chiller",
        display_fridge: "Displaykøl"
    };

    return `${names[type] || type} ${index}`;
}

function shouldAddAllergenCleaning(onboarding) {
    const specialConditions = Array.isArray(onboarding?.specialConditions)
        ? onboarding.specialConditions
        : [];
    return specialConditions.includes("handles_allergens");
}

function shouldAddEventCleaning(onboarding) {
    const businessTypes = Array.isArray(onboarding?.businessTypes)
        ? onboarding.businessTypes
        : [];
    const serviceTypes = Array.isArray(onboarding?.serviceTypes)
        ? onboarding.serviceTypes
        : [];

    return (
        businessTypes.includes("restaurant") ||
        businessTypes.includes("catering") ||
        serviceTypes.includes("direct_serving")
    );
}

function shouldAddRule(rule, onboarding) {
    if (rule.trigger === "after_allergen" && !shouldAddAllergenCleaning(onboarding)) {
        return false;
    }

    if (rule.trigger === "after_event" && !shouldAddEventCleaning(onboarding)) {
        return false;
    }

    return true;
}

function buildBaseCleaningTasks(onboarding) {
    const tasks = [];

    for (const rule of CLEANING_RULES) {
        if (!shouldAddRule(rule, onboarding)) continue;

        tasks.push({
            taskId: `task_cleaning_${rule.key}`,
            payload: {
                companyId: onboarding.companyId || "",
                locationId: onboarding.locationId || "",
                title: rule.title,
                description: rule.description,
                type: "cleaning_check",
                category: rule.category,
                zone: rule.zone,
                trigger: rule.trigger,
                priority: rule.priority,
                canDefer: !!rule.canDefer,
                requiresMeasurement: !!rule.requiresMeasurement,
                measurementUnit: "",
                minValue: null,
                maxValue: null,
                linkedRiskIds: [],
                createsAlertOnFailure: true,
                alertTypeOnFailure: "cleaning_required",
                alertSeverityOnFailure: rule.priority === "critical_now" ? "high" : "medium",
                isActive: true,
                generatedBy: "generateCleaningTasks",
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            }
        });
    }

    return tasks;
}

function buildEquipmentCleaningTasks(onboarding, equipmentList) {
    const tasks = [];

    for (const equipment of equipmentList) {
        const config = EQUIPMENT_CLEANING_RULES[equipment.type];
        if (!config) continue;

        tasks.push({
            taskId: `task_${equipment.id}_cleaning_${config.trigger}`,
            payload: {
                companyId: onboarding.companyId || "",
                locationId: onboarding.locationId || "",
                title: `${config.titlePrefix} ${equipment.name}`,
                description: config.description,
                type: "cleaning_check",
                category: "cleaning",
                zone: config.zone,
                trigger: config.trigger,
                priority: config.priority,
                canDefer: !!config.canDefer,
                requiresMeasurement: false,
                measurementUnit: "",
                minValue: null,
                maxValue: null,
                equipmentId: equipment.id || "",
                equipmentType: equipment.type || "",
                equipmentName: equipment.name || "",
                linkedRiskIds: [],
                createsAlertOnFailure: true,
                alertTypeOnFailure: "cleaning_required",
                alertSeverityOnFailure: "medium",
                isActive: true,
                generatedBy: "generateCleaningTasks",
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            }
        });
    }

    return tasks;
}

function comparableTask(data) {
    return JSON.stringify({
        companyId: data.companyId || "",
        locationId: data.locationId || "",
        title: data.title || "",
        description: data.description || "",
        type: data.type || "",
        category: data.category || "",
        zone: data.zone || "",
        trigger: data.trigger || "",
        priority: data.priority || "",
        canDefer: !!data.canDefer,
        requiresMeasurement: !!data.requiresMeasurement,
        measurementUnit: data.measurementUnit || "",
        minValue: data.minValue ?? null,
        maxValue: data.maxValue ?? null,
        equipmentId: data.equipmentId || "",
        equipmentType: data.equipmentType || "",
        equipmentName: data.equipmentName || "",
        linkedRiskIds: Array.isArray(data.linkedRiskIds) ? data.linkedRiskIds : [],
        createsAlertOnFailure: !!data.createsAlertOnFailure,
        alertTypeOnFailure: data.alertTypeOnFailure || "",
        alertSeverityOnFailure: data.alertSeverityOnFailure || "",
        isActive: data.isActive !== false,
        generatedBy: data.generatedBy || ""
    });
}

async function upsertTask(taskId, payload) {
    const ref = db.collection("tasks").doc(taskId);
    const snap = await ref.get();

    if (!snap.exists) {
        await ref.set(payload);
        return "created";
    }

    const current = snap.data() || {};

    if (comparableTask(current) === comparableTask(payload)) {
        return "skipped";
    }

    await ref.set(
        {
            ...payload,
            createdAt: current.createdAt || FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
    );

    return "updated";
}

async function generateCleaningTasks({ locationId }) {
    if (!locationId) {
        throw new Error("locationId er påkrævet");
    }

    const onboarding = await getOnboardingByLocation(locationId);

    if (!onboarding) {
        throw new Error(`Ingen onboarding_answers fundet for locationId=${locationId}`);
    }

    let equipmentList = await getEquipmentByLocation(locationId);

    if (!equipmentList.length) {
        equipmentList = buildEquipmentFromOnboarding(onboarding);
    }

    const allTasks = dedupeByKey([
        ...buildBaseCleaningTasks(onboarding),
        ...buildEquipmentCleaningTasks(onboarding, equipmentList)
    ].map((task) => ({
        key: task.taskId,
        ...task
    })));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const task of allTasks) {
        const result = await upsertTask(task.taskId, task.payload);

        if (result === "created") created++;
        if (result === "updated") updated++;
        if (result === "skipped") skipped++;
    }

    return {
        ok: true,
        message: "Rengøringstasks genereret.",
        locationId,
        created,
        updated,
        skipped,
        totalTasks: allTasks.length
    };
}

async function run() {
    try {
        const locationId = process.argv[2];

        if (!locationId) {
            throw new Error("Brug: node functions/admin/generateCleaningTasks.js <locationId>");
        }

        const result = await generateCleaningTasks({ locationId });
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
    generateCleaningTasks
};
```
