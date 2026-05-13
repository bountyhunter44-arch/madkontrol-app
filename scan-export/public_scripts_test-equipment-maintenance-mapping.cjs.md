# FILE: public/scripts/test-equipment-maintenance-mapping.cjs

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

async function testEquipmentMaintenanceMapping() {
  console.log("\n=== TESTING EQUIPMENT MAINTENANCE MAPPING ===\n");

  // Test templates that should be equipment_maintenance
  const equipmentTemplates = [
    "template_hazard_cold_kitchen_handling",
    "template_hazard_warm_kitchen_equipment"
  ];

  for (const templateId of equipmentTemplates) {
    const docRef = db.collection("task_templates").doc(templateId);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      console.log(`❌ Template ${templateId} not found\n`);
      continue;
    }

    const template = docSnapshot.data();
    
    console.log(`📋 Template: ${template.title || "N/A"}`);
    console.log(`   TemplateId: ${templateId}`);
    console.log(`   Current GuideKey: ${template.guideKey || "N/A"}`);
    console.log(`   Current ControlType: ${template.controlType || "N/A"}`);
    console.log(`   AggregatedCategory: ${template.aggregatedCategory || "N/A"}`);
    console.log(`   Source: ${template.sourceProcesses || "N/A"}`);
    
    if (template.guideKey === "equipment_maintenance") {
      console.log(`   ✅ CORRECT: Already mapped to equipment_maintenance\n`);
    } else {
      console.log(`   ⚠️  NEEDS UPDATE: Currently ${template.guideKey}, should be equipment_maintenance\n`);
    }
  }

  // Check if equipment_maintenance guide exists in GUIDE_LIBRARY
  console.log("\n=== CHECKING GUIDE LIBRARY ===\n");
  
  const { GUIDE_LIBRARY } = require("../../functions/guideLibrary");
  
  if (GUIDE_LIBRARY.equipment_maintenance) {
    console.log("✅ equipment_maintenance guide exists in GUIDE_LIBRARY");
    console.log(`   Title: ${GUIDE_LIBRARY.equipment_maintenance.title}`);
    console.log(`   Purpose: ${GUIDE_LIBRARY.equipment_maintenance.purpose}\n`);
  } else {
    console.log("❌ equipment_maintenance guide NOT found in GUIDE_LIBRARY\n");
  }

  // Check mapCategoryToGuideKey
  const { mapCategoryToGuideKey } = require("../../functions/guideLibrary");
  const mappedGuideKey = mapCategoryToGuideKey("equipment_maintenance");
  
  console.log("=== CHECKING MAPPING FUNCTION ===\n");
  console.log(`mapCategoryToGuideKey("equipment_maintenance") = ${mappedGuideKey}`);
  
  if (mappedGuideKey === "equipment_maintenance") {
    console.log("✅ Mapping function works correctly\n");
  } else {
    console.log("❌ Mapping function returns wrong value\n");
  }

  process.exit(0);
}

testEquipmentMaintenanceMapping().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});

```
