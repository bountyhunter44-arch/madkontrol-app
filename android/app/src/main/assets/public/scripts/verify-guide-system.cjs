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
 * Verify guide system implementation
 */
async function verifyGuideSystem() {
  console.log("\n🔍 VERIFYING GUIDE SYSTEM IMPLEMENTATION\n");
  console.log("=" .repeat(60));

  // 1. Check task_templates
  console.log("\n1️⃣  Checking task_templates...\n");

  const templatesSnapshot = await db.collection("task_templates")
    .where("isActive", "==", true)
    .get();

  console.log(`Found ${templatesSnapshot.size} active templates\n`);

  const templateStats = {
    total: templatesSnapshot.size,
    withGuideKey: 0,
    withTaskType: 0,
    withBoth: 0,
    withNeither: 0,
    guideKeys: new Set()
  };

  const missingGuideKey = [];
  const missingTaskType = [];

  templatesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const hasGuideKey = !!data.guideKey;
    const hasTaskType = !!data.taskType;

    if (hasGuideKey) templateStats.withGuideKey++;
    if (hasTaskType) templateStats.withTaskType++;
    if (hasGuideKey && hasTaskType) templateStats.withBoth++;
    if (!hasGuideKey && !hasTaskType) templateStats.withNeither++;

    if (hasGuideKey) templateStats.guideKeys.add(data.guideKey);

    if (!hasGuideKey) missingGuideKey.push({ id: doc.id, title: data.title });
    if (!hasTaskType) missingTaskType.push({ id: doc.id, title: data.title });
  });

  console.log("📊 Template Statistics:");
  console.log(`   Total active templates: ${templateStats.total}`);
  console.log(`   With guideKey: ${templateStats.withGuideKey} (${Math.round(templateStats.withGuideKey/templateStats.total*100)}%)`);
  console.log(`   With taskType: ${templateStats.withTaskType} (${Math.round(templateStats.withTaskType/templateStats.total*100)}%)`);
  console.log(`   With both: ${templateStats.withBoth} (${Math.round(templateStats.withBoth/templateStats.total*100)}%)`);
  console.log(`   With neither: ${templateStats.withNeither}`);
  console.log(`   Unique guideKeys: ${templateStats.guideKeys.size}`);

  if (templateStats.guideKeys.size > 0) {
    console.log(`\n   GuideKeys in use:`);
    Array.from(templateStats.guideKeys).sort().forEach(key => {
      console.log(`     - ${key}`);
    });
  }

  if (missingGuideKey.length > 0) {
    console.log(`\n⚠️  Templates missing guideKey (${missingGuideKey.length}):`);
    missingGuideKey.slice(0, 5).forEach(t => {
      console.log(`     - ${t.id}: ${t.title}`);
    });
    if (missingGuideKey.length > 5) {
      console.log(`     ... and ${missingGuideKey.length - 5} more`);
    }
  }

  // 2. Check recent task_instances
  console.log("\n" + "=".repeat(60));
  console.log("\n2️⃣  Checking recent task_instances...\n");

  const instancesSnapshot = await db.collection("task_instances")
    .where("dateKey", "==", "2026-03-25")
    .get();

  console.log(`Found ${instancesSnapshot.size} instances for 2026-03-25\n`);

  const instanceStats = {
    total: instancesSnapshot.size,
    withGuideKey: 0,
    withTaskType: 0,
    withBoth: 0,
    withNeither: 0,
    guideKeys: new Set()
  };

  instancesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const hasGuideKey = !!data.guideKey;
    const hasTaskType = !!data.taskType;

    if (hasGuideKey) instanceStats.withGuideKey++;
    if (hasTaskType) instanceStats.withTaskType++;
    if (hasGuideKey && hasTaskType) instanceStats.withBoth++;
    if (!hasGuideKey && !hasTaskType) instanceStats.withNeither++;

    if (hasGuideKey) instanceStats.guideKeys.add(data.guideKey);
  });

  console.log("📊 Instance Statistics:");
  console.log(`   Total instances: ${instanceStats.total}`);
  console.log(`   With guideKey: ${instanceStats.withGuideKey} (${Math.round(instanceStats.withGuideKey/instanceStats.total*100)}%)`);
  console.log(`   With taskType: ${instanceStats.withTaskType} (${Math.round(instanceStats.withTaskType/instanceStats.total*100)}%)`);
  console.log(`   With both: ${instanceStats.withBoth} (${Math.round(instanceStats.withBoth/instanceStats.total*100)}%)`);
  console.log(`   With neither: ${instanceStats.withNeither}`);
  console.log(`   Unique guideKeys: ${instanceStats.guideKeys.size}`);

  // 3. Sample data inspection
  console.log("\n" + "=".repeat(60));
  console.log("\n3️⃣  Sample data inspection...\n");

  const sampleDocs = instancesSnapshot.docs.slice(0, 3);
  sampleDocs.forEach(doc => {
    const data = doc.data();
    console.log(`📄 ${doc.id}:`);
    console.log(`   title: ${data.title}`);
    console.log(`   category: ${data.category}`);
    console.log(`   aggregatedCategory: ${data.aggregatedCategory}`);
    console.log(`   taskType: ${data.taskType || '❌ MISSING'}`);
    console.log(`   guideKey: ${data.guideKey || '❌ MISSING'}`);
    console.log(`   guideVersion: ${data.guideVersion || '❌ MISSING'}`);
    console.log();
  });

  // 4. Overall assessment
  console.log("=" .repeat(60));
  console.log("\n4️⃣  Overall Assessment\n");

  const templateSuccess = templateStats.withBoth === templateStats.total;
  const instanceSuccess = instanceStats.withBoth === instanceStats.total;

  if (templateSuccess && instanceSuccess) {
    console.log("✅ PERFECT: All templates and instances have guideKey + taskType");
  } else if (templateSuccess) {
    console.log("✅ Templates are 100% migrated");
    console.log(`⚠️  Instances need migration: ${instanceStats.withNeither} missing both fields`);
  } else if (instanceSuccess) {
    console.log("✅ Instances are 100% migrated");
    console.log(`⚠️  Templates need migration: ${templateStats.withNeither} missing both fields`);
  } else {
    console.log("⚠️  Migration needed:");
    console.log(`   Templates: ${templateStats.withNeither} missing both fields`);
    console.log(`   Instances: ${instanceStats.withNeither} missing both fields`);
  }

  // 5. Recommendations
  console.log("\n" + "=".repeat(60));
  console.log("\n5️⃣  Recommendations\n");

  if (!templateSuccess) {
    console.log("📋 Run migration for templates:");
    console.log("   node public/scripts/migrate-guides.cjs");
  }

  if (!instanceSuccess && instanceStats.total > 0) {
    console.log("📋 Regenerate task_instances:");
    console.log("   1. Delete existing: node public/scripts/delete-task-instances.cjs");
    console.log("   2. Regenerate via UI: await testGenerateTasks()");
  }

  if (templateSuccess && instanceSuccess) {
    console.log("✅ System is ready for deployment!");
    console.log("\nNext steps:");
    console.log("   1. Deploy functions: firebase deploy --only functions");
    console.log("   2. Deploy hosting: firebase deploy --only hosting");
    console.log("   3. Test in browser: Open rutiner.html and verify guides display correctly");
  }

  console.log("\n" + "=".repeat(60));
  console.log();
}

async function run() {
  try {
    await verifyGuideSystem();
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});
