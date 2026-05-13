# FILE: public/scripts/fix-equipment-maintenance-templates.cjs

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

async function fixEquipmentMaintenanceTemplates() {
  console.log("\n=== FIXING EQUIPMENT MAINTENANCE TEMPLATES ===\n");

  const equipmentTemplateIds = [
    "template_hazard_cold_kitchen_handling",
    "template_hazard_warm_kitchen_equipment"
  ];

  let templatesUpdated = 0;
  let taskInstancesUpdated = 0;

  for (const templateId of equipmentTemplateIds) {
    console.log(`\n--- Processing template: ${templateId} ---\n`);

    const templateRef = db.collection("task_templates").doc(templateId);
    const templateSnapshot = await templateRef.get();

    if (!templateSnapshot.exists) {
      console.log(`❌ Template ${templateId} not found\n`);
      continue;
    }

    const template = templateSnapshot.data();

    console.log(`Current state:`);
    console.log(`  Title: ${template.title || "N/A"}`);
    console.log(`  GuideKey: ${template.guideKey || "N/A"}`);
    console.log(`  ControlType: ${template.controlType || "N/A"}`);

    // Update template
    if (template.guideKey !== "equipment_maintenance" || template.controlType !== "equipment_maintenance") {
      await templateRef.update({
        guideKey: "equipment_maintenance",
        controlType: "equipment_maintenance",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`\n✅ UPDATED TEMPLATE`);
      console.log(`  New GuideKey: equipment_maintenance`);
      console.log(`  New ControlType: equipment_maintenance`);
      templatesUpdated++;
    } else {
      console.log(`\n✅ Template already correct`);
    }

    // Find and update all task_instances for this template
    console.log(`\nSearching for task_instances with templateId: ${templateId}...`);

    const taskInstancesSnapshot = await db
      .collection("task_instances")
      .where("templateId", "==", templateId)
      .get();

    console.log(`Found ${taskInstancesSnapshot.size} task_instances\n`);

    for (const taskInstanceDoc of taskInstancesSnapshot.docs) {
      const taskInstance = taskInstanceDoc.data();
      const taskInstanceId = taskInstanceDoc.id;

      if (taskInstance.guideKey !== "equipment_maintenance" || taskInstance.controlType !== "equipment_maintenance") {
        await taskInstanceDoc.ref.update({
          guideKey: "equipment_maintenance",
          controlType: "equipment_maintenance",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`  ✅ Updated task_instance: ${taskInstanceId}`);
        console.log(`     Title: ${taskInstance.title || "N/A"}`);
        console.log(`     DateKey: ${taskInstance.dateKey || "N/A"}`);
        console.log(`     Old GuideKey: ${taskInstance.guideKey || "N/A"} → New: equipment_maintenance`);
        console.log(`     Old ControlType: ${taskInstance.controlType || "N/A"} → New: equipment_maintenance\n`);
        taskInstancesUpdated++;
      }
    }
  }

  console.log("\n=== SUMMARY ===\n");
  console.log(`Templates updated: ${templatesUpdated}`);
  console.log(`Task instances updated: ${taskInstancesUpdated}`);
  console.log("");

  process.exit(0);
}

fixEquipmentMaintenanceTemplates().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});

```
