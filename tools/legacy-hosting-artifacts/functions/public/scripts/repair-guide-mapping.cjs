const admin = require("firebase-admin");
const path = require("path");
const { resolveGuideMapping } = require("../../functions/guideResolver");

const keyPath = path.join(__dirname, "../../serviceAccountKey.json");

if (!admin.apps.length) {
  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/**
 * Repair task_templates
 */
async function repairTemplates(dryRun = true) {
  console.log(`\n🔧 ${dryRun ? 'DRY-RUN:' : 'EXECUTING:'} Repairing task_templates...\n`);

  const snapshot = await db.collection("task_templates")
    .where("isActive", "==", true)
    .get();

  console.log(`Found ${snapshot.size} active templates\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const changes = [];
  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const proposed = resolveGuideMapping(data);

      // Check if update needed
      const needsUpdate = data.guideKey !== proposed.guideKey || data.taskType !== proposed.taskType;

      if (!needsUpdate) {
        skipped++;
        continue;
      }

      const change = {
        id: doc.id,
        title: data.title || data.name || "N/A",
        oldGuideKey: data.guideKey || "NONE",
        oldTaskType: data.taskType || "NONE",
        newGuideKey: proposed.guideKey,
        newTaskType: proposed.taskType,
        reason: proposed.reason
      };

      changes.push(change);

      console.log(`${dryRun ? '📝' : '✅'} ${doc.id}`);
      console.log(`   Title: ${change.title.substring(0, 70)}`);
      console.log(`   Old: ${change.oldGuideKey} / ${change.oldTaskType}`);
      console.log(`   New: ${change.newGuideKey} / ${change.newTaskType}`);
      console.log(`   Reason: ${change.reason}`);
      console.log();

      if (!dryRun) {
        // Apply update
        batch.update(doc.ref, {
          taskType: proposed.taskType,
          guideKey: proposed.guideKey,
          guideVersion: "1.0",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batchCount++;

        // Commit batch every 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   ✅ Committed batch of ${batchCount} updates\n`);
          batchCount = 0;
        }
      }

      updated++;

    } catch (error) {
      console.error(`❌ Error processing template ${doc.id}:`, error.message);
      errors++;
    }
  }

  // Commit remaining batch
  if (!dryRun && batchCount > 0) {
    await batch.commit();
    console.log(`   ✅ Committed final batch of ${batchCount} updates\n`);
  }

  console.log(`\n📊 task_templates ${dryRun ? 'would be' : ''} repaired:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);

  return { updated, skipped, errors, changes };
}

/**
 * Repair task_instances
 */
async function repairInstances(dryRun = true) {
  console.log(`\n🔧 ${dryRun ? 'DRY-RUN:' : 'EXECUTING:'} Repairing task_instances...\n`);

  const snapshot = await db.collection("task_instances")
    .where("dateKey", ">=", "2026-03-01")
    .get();

  console.log(`Found ${snapshot.size} recent task_instances\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const proposed = resolveGuideMapping(data);

      // Check if update needed
      const needsUpdate = data.guideKey !== proposed.guideKey || data.taskType !== proposed.taskType;

      if (!needsUpdate) {
        skipped++;
        continue;
      }

      if (!dryRun) {
        // Apply update
        batch.update(doc.ref, {
          taskType: proposed.taskType,
          guideKey: proposed.guideKey,
          guideVersion: "1.0",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batchCount++;

        // Commit batch every 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   ✅ Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }

      updated++;

      if (updated % 100 === 0) {
        console.log(`   ${dryRun ? '📝' : '✅'} Processed ${updated} instances...`);
      }

    } catch (error) {
      console.error(`❌ Error processing instance ${doc.id}:`, error.message);
      errors++;
    }
  }

  // Commit remaining batch
  if (!dryRun && batchCount > 0) {
    await batch.commit();
    console.log(`   ✅ Committed final batch of ${batchCount} updates`);
  }

  console.log(`\n📊 task_instances ${dryRun ? 'would be' : ''} repaired:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);

  return { updated, skipped, errors };
}

/**
 * Main execution
 */
async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = !apply;

  console.log("=" .repeat(120));
  console.log(`🔧 GUIDE MAPPING REPAIR ${dryRun ? '(DRY-RUN)' : '(APPLY MODE)'}`);
  console.log("=".repeat(120));

  try {
    // Repair templates
    const templateResult = await repairTemplates(dryRun);

    // Repair instances
    const instanceResult = await repairInstances(dryRun);

    // Summary
    console.log("\n" + "=".repeat(120));
    console.log("\n📊 FINAL SUMMARY:\n");
    console.log("TEMPLATES:");
    console.log(`   ${dryRun ? 'Would update' : 'Updated'}: ${templateResult.updated}`);
    console.log(`   Skipped (already correct): ${templateResult.skipped}`);
    console.log(`   Errors: ${templateResult.errors}`);

    console.log("\nINSTANCES:");
    console.log(`   ${dryRun ? 'Would update' : 'Updated'}: ${instanceResult.updated}`);
    console.log(`   Skipped (already correct): ${instanceResult.skipped}`);
    console.log(`   Errors: ${instanceResult.errors}`);

    if (dryRun) {
      console.log("\n" + "=".repeat(120));
      console.log("\nℹ️  This was a DRY-RUN. No changes were made to the database.");
      console.log("\nTo apply these changes, run:");
      console.log("   node public/scripts/repair-guide-mapping.cjs --apply\n");
    } else {
      console.log("\n" + "=".repeat(120));
      console.log("\n✅ REPAIR COMPLETE!\n");
      console.log("Next steps:");
      console.log("   1. Run verification: node public/scripts/verify-guide-system.cjs");
      console.log("   2. Test in browser: Open rutiner.html and verify guides");
      console.log("   3. Deploy if all looks good\n");
    }

  } catch (error) {
    console.error("\n❌ Repair failed:", error);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});
