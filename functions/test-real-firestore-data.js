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

async function testWithRealFirestoreData() {
    console.log("=".repeat(80));
    console.log("REAL FIRESTORE DATA TEST - NO DATABASE WRITES");
    console.log("=".repeat(80));

    const locationId = "location_1";
    console.log(`\nTesting with locationId: ${locationId}`);

    const locSnap = await db.collection("locations").doc(locationId).get();
    if (!locSnap.exists) {
        console.log(`❌ Location ${locationId} not found`);
        process.exit(1);
    }

    const locationData = locSnap.data();
    console.log(`Location found: ${locationData.name || locationId}`);

    const riskSnap = await db.collection("risk_analyses")
        .where("locationId", "==", locationId)
        .get();

    console.log(`\nRisk analyses found: ${riskSnap.size}`);

    if (riskSnap.empty) {
        console.log("\n⚠️  No risk_analyses found for this location.");
        console.log("Creating synthetic profile based on location data...\n");

        const syntheticProfile = {
            businessType: locationData.businessType || "restaurant",
            equipment: ["køleskab", "fryser", "walk-in køler"],
            areas: ["køkken", "modtagelse", "kølerum"],
            activities: ["varm produktion", "kold produktion"],
            risks: ["temperaturkontrol", "krydskontaminering"]
        };

        console.log("Synthetic legacy profile:");
        console.log(JSON.stringify(syntheticProfile, null, 2));

        const profile = adaptLegacyOnboardingToProfile(syntheticProfile);
        console.log("\n✅ Adapted profile:");
        console.log(JSON.stringify(profile, null, 2));

        const { templates } = buildTemplatesFromProfile(profile);
        console.log(`\n✅ Templates generated: ${templates.length}`);

        const taskInstances = generateTaskInstances(templates, new Date());
        console.log(`✅ TaskInstances generated: ${taskInstances.length}\n`);

        console.log("=".repeat(80));
        console.log("5 CONCRETE TASKINSTANCE EXAMPLES");
        console.log("=".repeat(80));

        taskInstances.slice(0, 5).forEach((task, index) => {
            console.log(`\n${index + 1}. ${task.title}`);
            console.log(`   controlKey: ${task.controlKey}`);
            console.log(`   guideKey: ${task.guideKey}`);
            console.log(`   taskType: ${task.taskType}`);
            console.log(`   evidence: ${task.evidence ? JSON.stringify(task.evidence) : 'null'}`);
            console.log(`   measurementConfig: ${task.measurementConfig ? JSON.stringify(task.measurementConfig) : 'null'}`);
            console.log(`   defaultMeasurementValue: ${task.defaultMeasurementValue}`);
        });

        console.log("\n" + "=".repeat(80));
        console.log("VERIFICATION");
        console.log("=".repeat(80));

        const allHaveGuideKey = taskInstances.every(t => t.guideKey);
        const allHaveControlKey = taskInstances.every(t => t.controlKey);
        const checklistsHaveEvidence = taskInstances.filter(t => t.taskType === "checklist").every(t => t.evidence);
        const measurementsHaveConfig = taskInstances.filter(t => t.taskType === "measurement").every(t => t.measurementConfig);

        console.log(`\n✅ All tasks have guideKey: ${allHaveGuideKey ? 'PASS' : 'FAIL'}`);
        console.log(`✅ All tasks have controlKey: ${allHaveControlKey ? 'PASS' : 'FAIL'}`);
        console.log(`✅ All checklist tasks have evidence: ${checklistsHaveEvidence ? 'PASS' : 'FAIL'}`);
        console.log(`✅ All measurement tasks have measurementConfig: ${measurementsHaveConfig ? 'PASS' : 'FAIL'}`);

        const allPassed = allHaveGuideKey && allHaveControlKey && checklistsHaveEvidence && measurementsHaveConfig;

        console.log("\n" + "=".repeat(80));
        console.log("FINAL RESULT");
        console.log("=".repeat(80));
        console.log(`\nProfile: ${JSON.stringify(profile)}`);
        console.log(`Templates count: ${templates.length}`);
        console.log(`TaskInstances count: ${taskInstances.length}`);
        console.log(`\nVERDICT: ${allPassed ? 'PASS - GODKENDT TIL FASE 3' : 'FAIL'}`);
        console.log(`NO DATABASE WRITES PERFORMED`);
        console.log("=".repeat(80));

        process.exit(0);
    }

    const activeDocs = riskSnap.docs.filter(doc => {
        const data = doc.data() || {};
        return data.isActive !== false;
    });

    console.log(`Active risk analyses: ${activeDocs.length}\n`);

    const allRisks = activeDocs.map(doc => doc.data());
    const legacyProfile = {
        businessType: allRisks[0]?.businessType || locationData.businessType || null,
        equipment: [...new Set(allRisks.flatMap(r => r.equipment || []))],
        areas: [...new Set(allRisks.flatMap(r => r.areas || []))],
        activities: [...new Set(allRisks.flatMap(r => r.activities || []))],
        risks: [...new Set(allRisks.flatMap(r => r.hazard ? [r.hazard] : []))]
    };

    console.log("Legacy profile extracted from Firestore:");
    console.log(JSON.stringify(legacyProfile, null, 2));

    const profile = adaptLegacyOnboardingToProfile(legacyProfile);
    console.log("\n✅ Adapted profile:");
    console.log(JSON.stringify(profile, null, 2));

    const { templates } = buildTemplatesFromProfile(profile);
    console.log(`\n✅ Templates generated: ${templates.length}`);

    const taskInstances = generateTaskInstances(templates, new Date());
    console.log(`✅ TaskInstances generated: ${taskInstances.length}\n`);

    console.log("=".repeat(80));
    console.log("5 CONCRETE TASKINSTANCE EXAMPLES");
    console.log("=".repeat(80));

    taskInstances.slice(0, 5).forEach((task, index) => {
        console.log(`\n${index + 1}. ${task.title}`);
        console.log(`   controlKey: ${task.controlKey}`);
        console.log(`   guideKey: ${task.guideKey}`);
        console.log(`   taskType: ${task.taskType}`);
        console.log(`   evidence: ${task.evidence ? JSON.stringify(task.evidence) : 'null'}`);
        console.log(`   measurementConfig: ${task.measurementConfig ? JSON.stringify(task.measurementConfig) : 'null'}`);
        console.log(`   defaultMeasurementValue: ${task.defaultMeasurementValue}`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("VERIFICATION");
    console.log("=".repeat(80));

    const allHaveGuideKey = taskInstances.every(t => t.guideKey);
    const allHaveControlKey = taskInstances.every(t => t.controlKey);
    const checklistsHaveEvidence = taskInstances.filter(t => t.taskType === "checklist").every(t => t.evidence);
    const measurementsHaveConfig = taskInstances.filter(t => t.taskType === "measurement").every(t => t.measurementConfig);

    console.log(`\n✅ All tasks have guideKey: ${allHaveGuideKey ? 'PASS' : 'FAIL'}`);
    console.log(`✅ All tasks have controlKey: ${allHaveControlKey ? 'PASS' : 'FAIL'}`);
    console.log(`✅ All checklist tasks have evidence: ${checklistsHaveEvidence ? 'PASS' : 'FAIL'}`);
    console.log(`✅ All measurement tasks have measurementConfig: ${measurementsHaveConfig ? 'PASS' : 'FAIL'}`);

    const allPassed = allHaveGuideKey && allHaveControlKey && checklistsHaveEvidence && measurementsHaveConfig;

    console.log("\n" + "=".repeat(80));
    console.log("FINAL RESULT");
    console.log("=".repeat(80));
    console.log(`\nProfile: ${JSON.stringify(profile)}`);
    console.log(`Templates count: ${templates.length}`);
    console.log(`TaskInstances count: ${taskInstances.length}`);
    console.log(`\nVERDICT: ${allPassed ? 'PASS - GODKENDT TIL FASE 3' : 'FAIL'}`);
    console.log(`NO DATABASE WRITES PERFORMED`);
    console.log("=".repeat(80));

    process.exit(0);
}

testWithRealFirestoreData().catch(err => {
    console.error("❌ ERROR:", err);
    process.exit(1);
});
