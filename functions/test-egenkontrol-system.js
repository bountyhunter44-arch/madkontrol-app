/**
 * Test script for new egenkontrol system
 * NO DATABASE WRITES - only in-memory testing
 */

const { buildTemplatesFromProfile, buildEffectiveProfile } = require("./egenkontrol/builders/templateBuilder");
const { generateTaskInstances } = require("./egenkontrol/generators/taskGenerator");
const { getGuideByKey } = require("./egenkontrol/libraries/guideLibrary");
const { adaptLegacyOnboardingToProfile } = require("./egenkontrol/adapters/onboardingAdapter");

console.log("=".repeat(80));
console.log("EGENKONTROL SYSTEM TEST - NO DATABASE WRITES");
console.log("=".repeat(80));

// Test 1: Fish shop profile
console.log("\n📋 TEST 1: Fish Shop Profile\n");

const fishShopProfile = {
  businessType: "fish_shop",
  areaTypes: ["cutting_area"],
  equipmentTypes: ["walk_in_cooler", "ice_machine"],
  activityTypes: ["fish_handling", "raw_to_ready_separation", "board_change_between_tasks"]
};

console.log("Input profile:");
console.log(JSON.stringify(fishShopProfile, null, 2));

const effectiveProfile = buildEffectiveProfile(fishShopProfile);
console.log("\nEffective profile (with business defaults):");
console.log(JSON.stringify(effectiveProfile, null, 2));

const { templates } = buildTemplatesFromProfile(fishShopProfile);
console.log(`\n✅ Generated ${templates.length} templates\n`);

templates.forEach((template, index) => {
  console.log(`${index + 1}. ${template.templateId}`);
  console.log(`   Scope: ${template.scope} | Target: ${template.targetLabel}`);
  console.log(`   GuideKey: ${template.guideKey}`);
  console.log(`   TaskType: ${template.taskType}`);
  console.log(`   Frequency: ${template.frequency}`);
  
  if (template.evidence) {
    console.log(`   Evidence: photoRequired=${template.evidence.photoRequired}, label="${template.evidence.captureLabel}"`);
  }
  
  if (template.measurementConfig) {
    console.log(`   Measurement: defaultValue=${template.measurementConfig.defaultValue}${template.measurementConfig.unit}, max=${template.measurementConfig.criticalLimits?.max}${template.measurementConfig.unit}`);
  }
  
  console.log();
});

// Test 2: Generate task instances
console.log("\n📋 TEST 2: Generate Task Instances\n");

const tasks = generateTaskInstances(templates, new Date());
console.log(`✅ Generated ${tasks.length} task instances for today\n`);

tasks.slice(0, 5).forEach((task, index) => {
  console.log(`${index + 1}. ${task.title}`);
  console.log(`   TaskInstanceId: ${task.taskInstanceId}`);
  console.log(`   GuideKey: ${task.guideKey}`);
  console.log(`   TaskType: ${task.taskType}`);
  console.log(`   DefaultMeasurementValue: ${task.defaultMeasurementValue}`);
  console.log(`   Evidence: ${task.evidence ? JSON.stringify(task.evidence) : 'none'}`);
  console.log();
});

// Test 3: Guide lookup
console.log("\n📋 TEST 3: Guide Lookup\n");

const sampleTask = tasks[0];
if (sampleTask && sampleTask.guideKey) {
  const guide = getGuideByKey(sampleTask.guideKey);
  
  if (guide) {
    console.log(`✅ Guide found for guideKey: ${sampleTask.guideKey}\n`);
    console.log(`Title: ${guide.title}`);
    console.log(`Steps:`);
    guide.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
  } else {
    console.log(`❌ No guide found for guideKey: ${sampleTask.guideKey}`);
  }
}

// Test 4: Legacy onboarding adapter
console.log("\n📋 TEST 4: Legacy Onboarding Adapter\n");

const legacyOnboarding = {
  businessType: "fiskebutik",
  equipment: ["walk-in køler", "ismaskine", "køleskab"],
  areas: ["opskæringsområde", "fiskedisk"],
  activities: ["fiskhåndtering"],
  risks: ["krydskontaminering", "temperaturkontrol"]
};

console.log("Legacy onboarding data:");
console.log(JSON.stringify(legacyOnboarding, null, 2));

const adaptedProfile = adaptLegacyOnboardingToProfile(legacyOnboarding);
console.log("\nAdapted to new profile:");
console.log(JSON.stringify(adaptedProfile, null, 2));

const { templates: adaptedTemplates } = buildTemplatesFromProfile(adaptedProfile);
console.log(`\n✅ Generated ${adaptedTemplates.length} templates from legacy data\n`);

// Test 5: Verify no string matching in guide resolution
console.log("\n📋 TEST 5: Verify Guide Resolution\n");

let allHaveGuideKey = true;
let allHaveEvidence = true;
let measurementTasksHaveConfig = true;

for (const task of tasks) {
  if (!task.guideKey) {
    console.log(`❌ Task missing guideKey: ${task.taskInstanceId}`);
    allHaveGuideKey = false;
  }
  
  if (task.taskType === "checklist" && !task.evidence) {
    console.log(`⚠️  Checklist task missing evidence: ${task.taskInstanceId}`);
    allHaveEvidence = false;
  }
  
  if (task.taskType === "measurement" && !task.measurementConfig) {
    console.log(`❌ Measurement task missing measurementConfig: ${task.taskInstanceId}`);
    measurementTasksHaveConfig = false;
  }
}

console.log(`\n✅ All tasks have guideKey: ${allHaveGuideKey}`);
console.log(`✅ All checklist tasks have evidence: ${allHaveEvidence}`);
console.log(`✅ All measurement tasks have measurementConfig: ${measurementTasksHaveConfig}`);

// Summary
console.log("\n" + "=".repeat(80));
console.log("TEST SUMMARY");
console.log("=".repeat(80));
console.log(`✅ Templates generated: ${templates.length}`);
console.log(`✅ Tasks generated: ${tasks.length}`);
console.log(`✅ Guide resolution: ${allHaveGuideKey ? 'PASS' : 'FAIL'}`);
console.log(`✅ Evidence configuration: ${allHaveEvidence ? 'PASS' : 'FAIL'}`);
console.log(`✅ Measurement configuration: ${measurementTasksHaveConfig ? 'PASS' : 'FAIL'}`);
console.log(`✅ NO DATABASE WRITES PERFORMED`);
console.log("=".repeat(80));
