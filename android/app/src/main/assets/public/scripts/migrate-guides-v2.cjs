const admin = require("firebase-admin");
const path = require("path");
const { resolveGuideMapping, isSuspiciousMapping } = require("../../functions/guideResolver");

const keyPath = path.join(__dirname, "../../serviceAccountKey.json");

if (!admin.apps.length) {
  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/**
 * Dry-run: Analyze all templates and show proposed mappings
 */
async function dryRun() {
  console.log("\n🔍 DRY-RUN: Analyzing all templates...\n");
  console.log("=".repeat(120));

  const snapshot = await db.collection("task_templates").get();

  console.log(`Found ${snapshot.size} task_templates\n`);

  const results = [];
  let suspiciousCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const mapping = resolveGuideMapping(data);
    const suspicious = isSuspiciousMapping(data, mapping);

    const result = {
      id: doc.id,
      title: data.title || data.name || "N/A",
      category: data.category || "",
      aggregatedCategory: data.aggregatedCategory || "",
      controlType: data.controlType || "",
      processKey: data.processKey || "",
      equipmentType: data.equipmentType || "",
      currentGuideKey: data.guideKey || "NONE",
      currentTaskType: data.taskType || "NONE",
      proposedGuideKey: mapping.guideKey,
      proposedTaskType: mapping.taskType,
      reason: mapping.reason,
      suspicious: suspicious.suspicious,
      suspiciousReason: suspicious.reason || ""
    };

    results.push(result);

    if (suspicious.suspicious) {
      suspiciousCount++;
    }
  }

  // Sort: suspicious first, then by title
  results.sort((a, b) => {
    if (a.suspicious && !b.suspicious) return -1;
    if (!a.suspicious && b.suspicious) return 1;
    return a.title.localeCompare(b.title);
  });

  // Display results
  console.log("\n📊 PROPOSED MAPPINGS:\n");

  results.forEach((r, index) => {
    const marker = r.suspicious ? "🚨" : "✅";
    const changeMarker = r.currentGuideKey !== "NONE" && r.currentGuideKey !== r.proposedGuideKey ? "🔄" : "";
    
    console.log(`${marker} ${changeMarker} ${index + 1}. ${r.id}`);
    console.log(`   Title: ${r.title}`);
    console.log(`   Category: ${r.category} | AggCat: ${r.aggregatedCategory} | ControlType: ${r.controlType}`);
    console.log(`   Current: guideKey=${r.currentGuideKey}, taskType=${r.currentTaskType}`);
    console.log(`   Proposed: guideKey=${r.proposedGuideKey}, taskType=${r.proposedTaskType}`);
    console.log(`   Reason: ${r.reason}`);
    
    if (r.suspicious) {
      console.log(`   ⚠️  SUSPICIOUS: ${r.suspiciousReason}`);
    }
    
    console.log();
  });

  console.log("=".repeat(120));
  console.log("\n📊 SUMMARY:\n");
  console.log(`   Total templates: ${results.length}`);
  console.log(`   Suspicious mappings: ${suspiciousCount}`);
  console.log(`   Safe mappings: ${results.length - suspiciousCount}`);

  if (suspiciousCount > 0) {
    console.log("\n🚨 SUSPICIOUS MAPPINGS DETECTED:\n");
    
    const suspicious = results.filter(r => r.suspicious);
    suspicious.forEach(r => {
      console.log(`   - ${r.id}`);
      console.log(`     ${r.title}`);
      console.log(`     ${r.suspiciousReason}`);
      console.log(`     Proposed: ${r.proposedGuideKey}`);
      console.log();
    });

    console.log("⛔ MIGRATION BLOCKED: Fix mapping rules before proceeding.\n");
    return { success: false, suspiciousCount, results };
  }

  console.log("\n✅ All mappings look correct. Safe to proceed with migration.\n");
  return { success: true, suspiciousCount: 0, results };
}

/**
 * Execute migration
 */
async function executeMigration() {
  console.log("\n🚀 EXECUTING MIGRATION...\n");

  const snapshot = await db.collection("task_templates").get();

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      // Resolve mapping
      const mapping = resolveGuideMapping(data);

      // Check if update needed
      if (data.guideKey === mapping.guideKey && data.taskType === mapping.taskType) {
        skipped++;
        continue;
      }

      // Update document
      batch.update(doc.ref, {
        taskType: mapping.taskType,
        guideKey: mapping.guideKey,
        guideVersion: "1.0",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      updated++;
      batchCount++;

      console.log(`✅ ${doc.id}: ${mapping.guideKey} (${mapping.reason})`);

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

  return { updated, skipped, errors };
}

/**
 * Migrate task_instances
 */
async function migrateTaskInstances() {
  console.log("\n🔄 Migrating task_instances...\n");

  const snapshot = await db.collection("task_instances")
    .where("dateKey", ">=", "2026-03-01")
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

      // Resolve mapping
      const mapping = resolveGuideMapping(data);

      // Check if update needed
      if (data.guideKey === mapping.guideKey && data.taskType === mapping.taskType) {
        skipped++;
        continue;
      }

      // Update document
      batch.update(doc.ref, {
        taskType: mapping.taskType,
        guideKey: mapping.guideKey,
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

  return { updated, skipped, errors };
}

/**
 * Main execution
 */
async function run() {
  const args = process.argv.slice(2);
  const dryRunOnly = args.includes("--dry-run");
  const force = args.includes("--force");

  console.log("🚀 Guide Migration v2 - Deterministic Resolver\n");

  try {
    // Always run dry-run first
    const dryRunResult = await dryRun();

    if (dryRunOnly) {
      console.log("ℹ️  Dry-run complete. Use --force to execute migration.\n");
      return;
    }

    if (!dryRunResult.success && !force) {
      console.log("⛔ Migration aborted due to suspicious mappings.");
      console.log("   Review the mappings above and fix guideResolver.js");
      console.log("   Or use --force to proceed anyway (not recommended)\n");
      process.exit(1);
    }

    if (force && dryRunResult.suspiciousCount > 0) {
      console.log(`⚠️  WARNING: Proceeding with ${dryRunResult.suspiciousCount} suspicious mappings (--force)\n`);
    }

    // Execute migration
    await executeMigration();
    await migrateTaskInstances();

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
