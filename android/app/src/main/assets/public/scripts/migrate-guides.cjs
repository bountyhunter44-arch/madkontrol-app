const admin = require("firebase-admin");
const path = require("path");

const keyPath = path.join(__dirname, "../../serviceAccountKey.json");

if (!admin.apps.length) {
  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/**
 * Map category/aggregatedCategory to guideKey
 */
function mapCategoryToGuideKey(category) {
  const mapping = {
    "temperature_cooling": "fridge_temperature",
    "temperature_freezing": "freezer_temperature",
    "temperature_heating": "hot_holding",
    "hot_holding": "hot_holding",
    "reheating_process": "reheating",
    "receiving_control": "receiving_goods",
    "allergen_control": "allergen_control",
    "area_cleaning": "cleaning_control",
    "equipment_cleaning": "equipment_cleaning",
    "drain_maintenance": "drain_maintenance",
    "staff_hygiene": "personal_hygiene_check",
    "closing_routine": "closing_routine",
    "ice_equipment_critical": "ice_equipment",
    "fryer_critical": "fryer_control",
    "cooling_process": "cooling_process",
    "verification": "cleaning_control",
    "building_condition": "cleaning_control",
    "pest_control": "cleaning_control",
    "general_checklist": "cleaning_control",
    // Backward compatibility
    "opbevaring": "fridge_temperature",
    "modtagelse": "receiving_goods",
    "allergener": "allergen_control",
    "rengøring": "cleaning_control"
  };

  return mapping[category] || "cleaning_control";
}

/**
 * Map category to taskType
 */
function mapCategoryToTaskType(category) {
  const mapping = {
    "temperature_cooling": "fridge_temperature",
    "temperature_freezing": "freezer_temperature",
    "temperature_heating": "hot_holding",
    "hot_holding": "hot_holding",
    "reheating_process": "reheating",
    "receiving_control": "receiving_goods",
    "allergen_control": "allergen_control",
    "area_cleaning": "cleaning_control",
    "equipment_cleaning": "equipment_cleaning",
    "drain_maintenance": "drain_maintenance",
    "staff_hygiene": "personal_hygiene",
    "closing_routine": "closing_routine",
    "ice_equipment_critical": "ice_equipment",
    "fryer_critical": "fryer_control",
    "cooling_process": "cooling_process",
    "verification": "verification",
    "building_condition": "building_inspection",
    "pest_control": "pest_inspection",
    "general_checklist": "general_check"
  };

  return mapping[category] || "general_check";
}

/**
 * Migrate task_templates
 */
async function migrateTaskTemplates() {
  console.log("\n🔄 Migrating task_templates...\n");

  const snapshot = await db.collection("task_templates").get();

  console.log(`Found ${snapshot.size} task_templates`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      // Skip if already has guideKey
      if (data.guideKey && data.taskType) {
        skipped++;
        continue;
      }

      // Determine category to use
      const category = data.aggregatedCategory || data.category;

      if (!category) {
        console.warn(`⚠️  Template ${doc.id} has no category, skipping`);
        skipped++;
        continue;
      }

      // Map to guideKey and taskType
      const guideKey = mapCategoryToGuideKey(category);
      const taskType = mapCategoryToTaskType(category);

      // Update document
      batch.update(doc.ref, {
        taskType: taskType,
        guideKey: guideKey,
        guideVersion: "1.0",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      updated++;
      batchCount++;

      console.log(`✅ ${doc.id}: ${category} → ${guideKey}`);

      // Commit batch every 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`   Committed batch of ${batchCount} updates`);
        batchCount = 0;
      }

    } catch (error) {
      console.error(`❌ Error migrating template ${doc.id}:`, error.message);
      errors++;
    }
  }

  // Commit remaining batch
  if (batchCount > 0) {
    await batch.commit();
    console.log(`   Committed final batch of ${batchCount} updates`);
  }

  console.log(`\n📊 task_templates migration complete:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

/**
 * Migrate task_instances
 */
async function migrateTaskInstances() {
  console.log("\n🔄 Migrating task_instances...\n");

  const snapshot = await db.collection("task_instances")
    .where("dateKey", ">=", "2026-03-01") // Only recent instances
    .get();

  console.log(`Found ${snapshot.size} recent task_instances`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      // Skip if already has guideKey
      if (data.guideKey && data.taskType) {
        skipped++;
        continue;
      }

      // Determine category to use
      const category = data.aggregatedCategory || data.category;

      if (!category) {
        console.warn(`⚠️  Instance ${doc.id} has no category, skipping`);
        skipped++;
        continue;
      }

      // Map to guideKey and taskType
      const guideKey = mapCategoryToGuideKey(category);
      const taskType = mapCategoryToTaskType(category);

      // Update document
      batch.update(doc.ref, {
        taskType: taskType,
        guideKey: guideKey,
        guideVersion: "1.0",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      updated++;
      batchCount++;

      if (updated % 100 === 0) {
        console.log(`   Processed ${updated} instances...`);
      }

      // Commit batch every 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`   Committed batch of ${batchCount} updates`);
        batchCount = 0;
      }

    } catch (error) {
      console.error(`❌ Error migrating instance ${doc.id}:`, error.message);
      errors++;
    }
  }

  // Commit remaining batch
  if (batchCount > 0) {
    await batch.commit();
    console.log(`   Committed final batch of ${batchCount} updates`);
  }

  console.log(`\n📊 task_instances migration complete:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

/**
 * Verify migration
 */
async function verifyMigration() {
  console.log("\n🔍 Verifying migration...\n");

  // Check templates
  const templatesSnapshot = await db.collection("task_templates")
    .where("isActive", "==", true)
    .get();

  let templatesWithGuideKey = 0;
  let templatesWithoutGuideKey = 0;

  templatesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.guideKey) {
      templatesWithGuideKey++;
    } else {
      templatesWithoutGuideKey++;
      console.warn(`⚠️  Template ${doc.id} still missing guideKey`);
    }
  });

  console.log(`\n📊 Active task_templates:`);
  console.log(`   With guideKey: ${templatesWithGuideKey}`);
  console.log(`   Without guideKey: ${templatesWithoutGuideKey}`);

  // Check recent instances
  const instancesSnapshot = await db.collection("task_instances")
    .where("dateKey", ">=", "2026-03-01")
    .limit(100)
    .get();

  let instancesWithGuideKey = 0;
  let instancesWithoutGuideKey = 0;

  instancesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.guideKey) {
      instancesWithGuideKey++;
    } else {
      instancesWithoutGuideKey++;
    }
  });

  console.log(`\n📊 Recent task_instances (sample of ${instancesSnapshot.size}):`);
  console.log(`   With guideKey: ${instancesWithGuideKey}`);
  console.log(`   Without guideKey: ${instancesWithoutGuideKey}`);
}

/**
 * Main execution
 */
async function run() {
  console.log("🚀 Starting guide migration...\n");

  try {
    // Migrate templates first
    await migrateTaskTemplates();

    // Migrate instances
    await migrateTaskInstances();

    // Verify results
    await verifyMigration();

    console.log("\n✅ Migration complete!\n");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});
