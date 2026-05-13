const admin = require("firebase-admin");
const path = require("path");
const { buildTemplatesFromProfile } = require("./egenkontrol/builders/templateBuilder");
const { generateTaskInstances } = require("./egenkontrol/generators/taskGenerator");
const { adaptLegacyOnboardingToProfile } = require("./egenkontrol/adapters/onboardingAdapter");

const serviceAccount = require(path.join(__dirname, "../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

async function getExistingDocumentsByKeys(collection, keys) {
    const found = new Map();
    if (!keys.length) return found;

    const chunks = [];
    for (let i = 0; i < keys.length; i += 10) {
        chunks.push(keys.slice(i, i + 10));
    }

    for (const chunk of chunks) {
        const snap = await db
            .collection(collection)
            .where("dedupeKey", "in", chunk)
            .get();

        snap.forEach((doc) => {
            found.set(doc.get("dedupeKey"), {
                id: doc.id,
                data: doc.data()
            });
        });
    }

    return found;
}

async function testV2WriteAndVerify() {
    console.log("=".repeat(80));
    console.log("V2 WRITE PATH TEST - CONTROLLED WRITE");
    console.log("=".repeat(80));

    const locationId = "location_1";
    
    const syntheticProfile = {
        businessType: "restaurant",
        equipment: ["køleskab", "fryser", "walk-in køler"],
        areas: ["køkken", "modtagelse"],
        activities: ["varm produktion"],
        risks: ["temperaturkontrol"]
    };

    const profile = adaptLegacyOnboardingToProfile(syntheticProfile);
    const { templates } = buildTemplatesFromProfile(profile);
    
    const templatePayloads = templates.map(template => ({
        dedupeKey: `${locationId}__v2__${template.templateId}`,
        payload: {
            locationId,
            templateId: template.templateId,
            controlKey: template.controlKey,
            guideKey: template.guideKey,
            guideVersion: "1.0",
            scope: template.scope,
            targetKey: template.targetKey,
            targetLabel: template.targetLabel,
            name: template.targetLabel,
            title: template.targetLabel,
            description: template.description || `${template.targetLabel} - ${template.controlKey}`,
            taskType: template.taskType,
            frequency: template.frequency,
            evidence: template.evidence ?? null,
            measurementConfig: template.measurementConfig ?? null,
            defaultMeasurementValue: template.measurementConfig?.defaultValue ?? null,
            limits: template.limits ?? null,
            limitMin: template.limits?.min ?? null,
            limitMax: template.limits?.max ?? null,
            unit: template.measurementConfig?.unit || "",
            checkpoints: template.checkpoints ?? null,
            checklist: template.checklist ?? null,
            templateType: "operational",
            isAggregated: false,
            isActive: true,
            motor: "v2_modular",
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp()
        }
    }));

    const taskInstances = generateTaskInstances(templates, new Date());
    
    const taskInstancePayloads = taskInstances.map(task => ({
        dedupeKey: `${locationId}__v2__${task.taskInstanceId}`,
        payload: {
            locationId,
            taskInstanceId: task.taskInstanceId,
            templateId: task.templateId,
            controlKey: task.controlKey,
            guideKey: task.guideKey,
            guideVersion: "1.0",
            scope: task.scope,
            targetKey: task.targetKey,
            targetLabel: task.targetLabel ?? null,
            title: task.title,
            description: task.description || "",
            taskType: task.taskType,
            frequency: task.frequency,
            dateKey: task.dateKey,
            status: task.status,
            evidence: task.evidence ?? null,
            measurementConfig: task.measurementConfig ?? null,
            defaultMeasurementValue: task.defaultMeasurementValue ?? null,
            measurementValue: null,
            limits: task.limits ?? null,
            checkpoints: task.checkpoints ?? null,
            checklist: task.checklist ?? null,
            comment: null,
            photoUrls: [],
            cloudinaryAssets: [],
            isActive: true,
            motor: "v2_modular",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        }
    }));

    const uniqueTemplates = new Map();
    for (const template of templatePayloads) {
        uniqueTemplates.set(template.dedupeKey, template);
    }

    const templateList = Array.from(uniqueTemplates.values());
    const keys = templateList.map(item => item.dedupeKey);
    const existing = await getExistingDocumentsByKeys("task_templates", keys);

    let templatesCreated = 0;
    let templatesUpdated = 0;
    let templatesSkipped = 0;

    const batch = db.batch();

    for (const item of templateList) {
        const current = existing.get(item.dedupeKey);

        if (!current) {
            const ref = db.collection("task_templates").doc();
            batch.set(ref, {
                ...item.payload,
                dedupeKey: item.dedupeKey
            });
            templatesCreated++;
            console.log(`  CREATE TEMPLATE: ${item.payload.templateId}`);
            continue;
        }

        const currentData = current.data || {};
        const nextData = {
            ...item.payload,
            dedupeKey: item.dedupeKey,
            createdAt: currentData.createdAt || FieldValue.serverTimestamp()
        };

        const needsUpdate = 
            JSON.stringify(currentData.guideKey) !== JSON.stringify(nextData.guideKey) ||
            JSON.stringify(currentData.evidence) !== JSON.stringify(nextData.evidence) ||
            JSON.stringify(currentData.measurementConfig) !== JSON.stringify(nextData.measurementConfig) ||
            JSON.stringify(currentData.taskType) !== JSON.stringify(nextData.taskType) ||
            JSON.stringify(currentData.controlKey) !== JSON.stringify(nextData.controlKey);

        if (!needsUpdate) {
            templatesSkipped++;
            continue;
        }

        batch.set(
            db.collection("task_templates").doc(current.id),
            nextData,
            { merge: true }
        );
        templatesUpdated++;
        console.log(`  UPDATE TEMPLATE: ${item.payload.templateId}`);
    }

    const uniqueTaskInstances = new Map();
    for (const task of taskInstancePayloads) {
        uniqueTaskInstances.set(task.dedupeKey, task);
    }

    const taskInstanceList = Array.from(uniqueTaskInstances.values());
    const taskKeys = taskInstanceList.map(item => item.dedupeKey);
    const existingTasks = await getExistingDocumentsByKeys("task_instances", taskKeys);

    let tasksCreated = 0;
    let tasksSkipped = 0;

    for (const item of taskInstanceList) {
        const current = existingTasks.get(item.dedupeKey);

        if (!current) {
            const ref = db.collection("task_instances").doc();
            batch.set(ref, {
                ...item.payload,
                dedupeKey: item.dedupeKey
            });
            tasksCreated++;
            console.log(`  CREATE TASK: ${item.payload.taskInstanceId}`);
        } else {
            tasksSkipped++;
        }
    }

    if (templatesCreated || templatesUpdated || tasksCreated) {
        await batch.commit();
        console.log(`\n✅ WRITES COMMITTED`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("1. WRITE COUNTS");
    console.log("=".repeat(80));
    console.log(`Templates: ${templatesCreated} created, ${templatesUpdated} updated, ${templatesSkipped} skipped`);
    console.log(`Task Instances: ${tasksCreated} created, ${tasksSkipped} skipped`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("\n" + "=".repeat(80));
    console.log("3. THREE CONCRETE DOCUMENTS FROM task_templates");
    console.log("=".repeat(80));

    const templateSnap = await db.collection("task_templates")
        .where("locationId", "==", locationId)
        .where("motor", "==", "v2_modular")
        .limit(3)
        .get();

    templateSnap.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n${index + 1}. ${data.templateId}`);
        console.log(`   controlKey: ${data.controlKey}`);
        console.log(`   guideKey: ${data.guideKey}`);
        console.log(`   taskType: ${data.taskType}`);
        console.log(`   evidence: ${data.evidence ? 'present' : 'null'}`);
        console.log(`   measurementConfig: ${data.measurementConfig ? 'present' : 'null'}`);
        console.log(`   defaultMeasurementValue: ${data.defaultMeasurementValue}`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("4. THREE CONCRETE DOCUMENTS FROM task_instances");
    console.log("=".repeat(80));

    const taskSnap = await db.collection("task_instances")
        .where("locationId", "==", locationId)
        .where("motor", "==", "v2_modular")
        .limit(3)
        .get();

    taskSnap.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n${index + 1}. ${data.taskInstanceId}`);
        console.log(`   controlKey: ${data.controlKey}`);
        console.log(`   guideKey: ${data.guideKey}`);
        console.log(`   taskType: ${data.taskType}`);
        console.log(`   evidence: ${data.evidence ? 'present' : 'null'}`);
        console.log(`   measurementConfig: ${data.measurementConfig ? 'present' : 'null'}`);
        console.log(`   defaultMeasurementValue: ${data.defaultMeasurementValue}`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("5. FIELD VERIFICATION");
    console.log("=".repeat(80));

    let allTemplatesPass = true;
    let allTasksPass = true;

    templateSnap.forEach(doc => {
        const data = doc.data();
        if (!data.guideKey || data.evidence === undefined || data.measurementConfig === undefined || data.defaultMeasurementValue === undefined) {
            allTemplatesPass = false;
        }
    });

    taskSnap.forEach(doc => {
        const data = doc.data();
        if (!data.guideKey || data.evidence === undefined || data.measurementConfig === undefined || data.defaultMeasurementValue === undefined) {
            allTasksPass = false;
        }
    });

    console.log(`\nTemplates: ${allTemplatesPass ? 'PASS' : 'FAIL'}`);
    console.log(`Task Instances: ${allTasksPass ? 'PASS' : 'FAIL'}`);

    console.log("\n" + "=".repeat(80));
    console.log("6. VERDICT");
    console.log("=".repeat(80));

    const verdict = allTemplatesPass && allTasksPass ? 'PASS' : 'FAIL';
    console.log(`\n${verdict}`);
    console.log("=".repeat(80));

    process.exit(0);
}

testV2WriteAndVerify().catch(err => {
    console.error("❌ ERROR:", err);
    process.exit(1);
});
