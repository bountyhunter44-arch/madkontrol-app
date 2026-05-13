const { buildTemplatesFromProfile } = require("./egenkontrol/builders/templateBuilder");
const { generateTaskInstances } = require("./egenkontrol/generators/taskGenerator");
const { adaptLegacyOnboardingToProfile } = require("./egenkontrol/adapters/onboardingAdapter");

console.log("=".repeat(80));
console.log("NEW MOTOR TEST - REALISTIC MOCK DATA (NO DATABASE)");
console.log("=".repeat(80));

const mockRiskAnalyses = [
    {
        locationId: "location_test_fish_shop",
        businessType: "fiskebutik",
        process: "Opskæring af fisk",
        hazard: "Krydskontaminering mellem råt og spiseklart",
        controlType: "workflow_hygiene",
        equipment: ["walk-in køler", "ismaskine", "køleskab", "displaykøler"],
        areas: ["opskæringsområde", "fiskedisk", "kølerum"],
        activities: ["fiskhåndtering"],
        isActive: true
    },
    {
        locationId: "location_test_fish_shop",
        businessType: "fiskebutik",
        process: "Opbevaring",
        hazard: "Temperaturkontrol",
        controlType: "temperature",
        equipment: ["walk-in køler", "køleskab", "displaykøler"],
        areas: ["kølerum"],
        isActive: true
    },
    {
        locationId: "location_test_fish_shop",
        businessType: "fiskebutik",
        process: "Rengøring",
        hazard: "Rengøring mellem arbejdsgange",
        controlType: "cleaning",
        equipment: ["ismaskine"],
        areas: ["opskæringsområde", "rengøringsområde"],
        activities: ["rengøring mellem arbejdsgange"],
        isActive: true
    }
];

console.log(`\nMock risk_analyses: ${mockRiskAnalyses.length}`);

const legacyProfile = {
    businessType: mockRiskAnalyses[0]?.businessType || null,
    equipment: [...new Set(mockRiskAnalyses.flatMap(r => r.equipment || []))],
    areas: [...new Set(mockRiskAnalyses.flatMap(r => r.areas || []))],
    activities: [...new Set(mockRiskAnalyses.flatMap(r => r.activities || []))],
    risks: [...new Set(mockRiskAnalyses.flatMap(r => r.hazard ? [r.hazard] : []))]
};

console.log("\nLegacy profile extracted from mock data:");
console.log(JSON.stringify(legacyProfile, null, 2));

const profile = adaptLegacyOnboardingToProfile(legacyProfile);
console.log("\n✅ Adapted profile:");
console.log(JSON.stringify(profile, null, 2));

const { templates } = buildTemplatesFromProfile(profile);
console.log(`\n✅ Templates generated: ${templates.length}\n`);

templates.forEach((template, index) => {
    console.log(`${index + 1}. ${template.templateId}`);
    console.log(`   controlKey: ${template.controlKey}`);
    console.log(`   guideKey: ${template.guideKey}`);
    console.log(`   scope: ${template.scope} | target: ${template.targetLabel}`);
    console.log(`   taskType: ${template.taskType}`);
    console.log(`   frequency: ${template.frequency}`);
    if (template.evidence) {
        console.log(`   evidence.photoRequired: ${template.evidence.photoRequired}`);
    }
    if (template.measurementConfig) {
        console.log(`   measurementConfig.defaultValue: ${template.measurementConfig.defaultValue}${template.measurementConfig.unit}`);
    }
    console.log();
});

const taskInstances = generateTaskInstances(templates, new Date());
console.log(`✅ TaskInstances generated: ${taskInstances.length}\n`);

console.log("=".repeat(80));
console.log("5 CONCRETE TASKINSTANCE EXAMPLES");
console.log("=".repeat(80));

taskInstances.slice(0, 5).forEach((task, index) => {
    console.log(`\n${index + 1}. ${task.title}`);
    console.log(`   taskInstanceId: ${task.taskInstanceId}`);
    console.log(`   controlKey: ${task.controlKey}`);
    console.log(`   guideKey: ${task.guideKey}`);
    console.log(`   taskType: ${task.taskType}`);
    console.log(`   scope: ${task.scope} | target: ${task.targetKey}`);
    console.log(`   frequency: ${task.frequency}`);
    console.log(`   status: ${task.status}`);
    
    if (task.evidence) {
        console.log(`   evidence:`);
        console.log(`     photoAllowed: ${task.evidence.photoAllowed}`);
        console.log(`     photoRequired: ${task.evidence.photoRequired}`);
        console.log(`     captureLabel: "${task.evidence.captureLabel}"`);
        console.log(`     minPhotos: ${task.evidence.minPhotos}`);
        console.log(`     maxPhotos: ${task.evidence.maxPhotos}`);
    } else {
        console.log(`   evidence: null`);
    }
    
    if (task.measurementConfig) {
        console.log(`   measurementConfig:`);
        console.log(`     unit: ${task.measurementConfig.unit}`);
        console.log(`     defaultValue: ${task.measurementConfig.defaultValue}`);
        console.log(`     step: ${task.measurementConfig.step}`);
        console.log(`     suggestedRange: ${JSON.stringify(task.measurementConfig.suggestedRange)}`);
        console.log(`     criticalLimits: ${JSON.stringify(task.measurementConfig.criticalLimits)}`);
        console.log(`     prefillOnCreate: ${task.measurementConfig.prefillOnCreate}`);
    } else {
        console.log(`   measurementConfig: null`);
    }
    
    console.log(`   defaultMeasurementValue: ${task.defaultMeasurementValue}`);
});

console.log("\n" + "=".repeat(80));
console.log("VERIFICATION CHECKS");
console.log("=".repeat(80));

let allHaveGuideKey = true;
let allHaveControlKey = true;
let allHaveTaskType = true;
let checklistsHaveEvidence = true;
let measurementsHaveConfig = true;
let measurementsHaveDefault = true;

for (const task of taskInstances) {
    if (!task.guideKey) {
        console.log(`❌ Missing guideKey: ${task.taskInstanceId}`);
        allHaveGuideKey = false;
    }
    if (!task.controlKey) {
        console.log(`❌ Missing controlKey: ${task.taskInstanceId}`);
        allHaveControlKey = false;
    }
    if (!task.taskType) {
        console.log(`❌ Missing taskType: ${task.taskInstanceId}`);
        allHaveTaskType = false;
    }
    if (task.taskType === "checklist" && !task.evidence) {
        console.log(`⚠️  Checklist missing evidence: ${task.taskInstanceId}`);
        checklistsHaveEvidence = false;
    }
    if (task.taskType === "measurement" && !task.measurementConfig) {
        console.log(`❌ Measurement missing measurementConfig: ${task.taskInstanceId}`);
        measurementsHaveConfig = false;
    }
    if (task.taskType === "measurement" && task.defaultMeasurementValue === null) {
        console.log(`⚠️  Measurement missing defaultMeasurementValue: ${task.taskInstanceId}`);
        measurementsHaveDefault = false;
    }
}

console.log(`\n✅ All tasks have guideKey: ${allHaveGuideKey ? 'PASS' : 'FAIL'}`);
console.log(`✅ All tasks have controlKey: ${allHaveControlKey ? 'PASS' : 'FAIL'}`);
console.log(`✅ All tasks have taskType: ${allHaveTaskType ? 'PASS' : 'FAIL'}`);
console.log(`✅ All checklist tasks have evidence: ${checklistsHaveEvidence ? 'PASS' : 'FAIL'}`);
console.log(`✅ All measurement tasks have measurementConfig: ${measurementsHaveConfig ? 'PASS' : 'FAIL'}`);
console.log(`✅ All measurement tasks have defaultMeasurementValue: ${measurementsHaveDefault ? 'PASS' : 'FAIL'}`);

console.log("\n" + "=".repeat(80));
console.log("FINAL RESULT");
console.log("=".repeat(80));

const allPassed = allHaveGuideKey && allHaveControlKey && allHaveTaskType && 
                  checklistsHaveEvidence && measurementsHaveConfig && measurementsHaveDefault;

console.log(`\nProfile: ${JSON.stringify(profile)}`);
console.log(`Templates count: ${templates.length}`);
console.log(`TaskInstances count: ${taskInstances.length}`);
console.log(`\nVERDICT: ${allPassed ? 'PASS - GODKENDT TIL FASE 3' : 'FAIL - IKKE GODKENDT'}`);
console.log(`NO DATABASE WRITES PERFORMED`);
console.log("=".repeat(80));
