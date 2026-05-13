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

async function testV2DryRun() {
    console.log("=".repeat(80));
    console.log("V2 WRITE PATH DRY-RUN TEST");
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

    console.log(`\n1. Template Payloads: ${templatePayloads.length}`);
    console.log(`2. TaskInstance Payloads: ${taskInstancePayloads.length}`);

    console.log("\n" + "=".repeat(80));
    console.log("3. THREE CONCRETE TEMPLATE PAYLOADS");
    console.log("=".repeat(80));

    templatePayloads.slice(0, 3).forEach((item, index) => {
        const p = item.payload;
        console.log(`\n${index + 1}. ${p.templateId}`);
        console.log(`   controlKey: ${p.controlKey}`);
        console.log(`   guideKey: ${p.guideKey}`);
        console.log(`   taskType: ${p.taskType}`);
        console.log(`   evidence: ${p.evidence ? JSON.stringify(p.evidence) : 'null'}`);
        console.log(`   measurementConfig: ${p.measurementConfig ? JSON.stringify(p.measurementConfig) : 'null'}`);
        console.log(`   defaultMeasurementValue: ${p.defaultMeasurementValue}`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("4. THREE CONCRETE TASKINSTANCE PAYLOADS");
    console.log("=".repeat(80));

    taskInstancePayloads.slice(0, 3).forEach((item, index) => {
        const p = item.payload;
        console.log(`\n${index + 1}. ${p.taskInstanceId}`);
        console.log(`   controlKey: ${p.controlKey}`);
        console.log(`   guideKey: ${p.guideKey}`);
        console.log(`   taskType: ${p.taskType}`);
        console.log(`   evidence: ${p.evidence ? JSON.stringify(p.evidence) : 'null'}`);
        console.log(`   measurementConfig: ${p.measurementConfig ? JSON.stringify(p.measurementConfig) : 'null'}`);
        console.log(`   defaultMeasurementValue: ${p.defaultMeasurementValue}`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("5. FIELD VERIFICATION");
    console.log("=".repeat(80));

    let allTemplatesHaveGuideKey = true;
    let allTemplatesHaveEvidence = true;
    let allTemplatesHaveMeasurementConfig = true;
    let allTemplatesHaveDefaultMeasurementValue = true;

    for (const item of templatePayloads) {
        const p = item.payload;
        if (!p.guideKey) allTemplatesHaveGuideKey = false;
        if (p.evidence === undefined) allTemplatesHaveEvidence = false;
        if (p.measurementConfig === undefined) allTemplatesHaveMeasurementConfig = false;
        if (p.defaultMeasurementValue === undefined) allTemplatesHaveDefaultMeasurementValue = false;
    }

    let allTasksHaveGuideKey = true;
    let allTasksHaveEvidence = true;
    let allTasksHaveMeasurementConfig = true;
    let allTasksHaveDefaultMeasurementValue = true;

    for (const item of taskInstancePayloads) {
        const p = item.payload;
        if (!p.guideKey) allTasksHaveGuideKey = false;
        if (p.evidence === undefined) allTasksHaveEvidence = false;
        if (p.measurementConfig === undefined) allTasksHaveMeasurementConfig = false;
        if (p.defaultMeasurementValue === undefined) allTasksHaveDefaultMeasurementValue = false;
    }

    console.log(`\nTemplates:`);
    console.log(`  ✅ All have guideKey: ${allTemplatesHaveGuideKey ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ All have evidence field: ${allTemplatesHaveEvidence ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ All have measurementConfig field: ${allTemplatesHaveMeasurementConfig ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ All have defaultMeasurementValue field: ${allTemplatesHaveDefaultMeasurementValue ? 'PASS' : 'FAIL'}`);

    console.log(`\nTaskInstances:`);
    console.log(`  ✅ All have guideKey: ${allTasksHaveGuideKey ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ All have evidence field: ${allTasksHaveEvidence ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ All have measurementConfig field: ${allTasksHaveMeasurementConfig ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ All have defaultMeasurementValue field: ${allTasksHaveDefaultMeasurementValue ? 'PASS' : 'FAIL'}`);

    console.log("\n" + "=".repeat(80));
    console.log("6. BATCH.COMMIT() VERIFICATION");
    console.log("=".repeat(80));
    console.log(`\n✅ NO batch.commit() executed in dry-run mode`);
    console.log(`✅ NO DATABASE WRITES PERFORMED`);

    console.log("\n" + "=".repeat(80));
    console.log("DRY-RUN COMPLETE");
    console.log("=".repeat(80));

    process.exit(0);
}

testV2DryRun().catch(err => {
    console.error("❌ ERROR:", err);
    process.exit(1);
});
