# FILE: public/scripts/audit-guide-mapping.cjs

```javascript
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
 * Audit all templates and instances
 */
async function auditGuideMapping() {
  console.log("\n" + "=".repeat(120));
  console.log("🔍 GUIDE MAPPING AUDIT REPORT");
  console.log("=".repeat(120) + "\n");

  // Audit templates
  console.log("📋 AUDITING TASK_TEMPLATES...\n");
  
  const templatesSnapshot = await db.collection("task_templates")
    .where("isActive", "==", true)
    .get();

  console.log(`Found ${templatesSnapshot.size} active templates\n`);

  const templateResults = [];
  let templateSuspiciousCount = 0;

  for (const doc of templatesSnapshot.docs) {
    const data = doc.data();
    const proposed = resolveGuideMapping(data);
    const suspicious = isSuspiciousMapping(data, proposed);

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
      proposedGuideKey: proposed.guideKey,
      proposedTaskType: proposed.taskType,
      reason: proposed.reason,
      suspicious: suspicious.suspicious,
      suspiciousReason: suspicious.reason || "",
      needsUpdate: data.guideKey !== proposed.guideKey || data.taskType !== proposed.taskType
    };

    templateResults.push(result);

    if (suspicious.suspicious) {
      templateSuspiciousCount++;
    }
  }

  // Sort: suspicious first, then by title
  templateResults.sort((a, b) => {
    if (a.suspicious && !b.suspicious) return -1;
    if (!a.suspicious && b.suspicious) return 1;
    return a.title.localeCompare(b.title);
  });

  // Display suspicious mappings first
  if (templateSuspiciousCount > 0) {
    console.log("🚨 SUSPICIOUS TEMPLATE MAPPINGS:\n");
    
    templateResults.filter(r => r.suspicious).forEach((r, index) => {
      console.log(`${index + 1}. ${r.id}`);
      console.log(`   Title: ${r.title}`);
      console.log(`   Category: ${r.category} | AggCat: ${r.aggregatedCategory} | ControlType: ${r.controlType}`);
      console.log(`   Current: guideKey=${r.currentGuideKey}, taskType=${r.currentTaskType}`);
      console.log(`   Proposed: guideKey=${r.proposedGuideKey}, taskType=${r.proposedTaskType}`);
      console.log(`   Reason: ${r.reason}`);
      console.log(`   ⚠️  SUSPICIOUS: ${r.suspiciousReason}`);
      console.log();
    });
  }

  // Display top 30 templates (mix of suspicious and normal)
  console.log("\n" + "=".repeat(120));
  console.log("\n📊 TOP 30 TEMPLATE MAPPINGS (Suspicious + Sample):\n");
  
  templateResults.slice(0, 30).forEach((r, index) => {
    const marker = r.suspicious ? "🚨" : "✅";
    const changeMarker = r.needsUpdate ? "🔄" : "  ";
    
    console.log(`${marker} ${changeMarker} ${index + 1}. ${r.title.substring(0, 60)}`);
    console.log(`   ID: ${r.id}`);
    console.log(`   Category: ${r.category || 'N/A'} | AggCat: ${r.aggregatedCategory || 'N/A'} | ControlType: ${r.controlType || 'N/A'}`);
    console.log(`   Current: ${r.currentGuideKey} / ${r.currentTaskType}`);
    console.log(`   Proposed: ${r.proposedGuideKey} / ${r.proposedTaskType}`);
    console.log(`   Reason: ${r.reason}`);
    if (r.suspicious) {
      console.log(`   ⚠️  ${r.suspiciousReason}`);
    }
    console.log();
  });

  // Audit recent instances
  console.log("\n" + "=".repeat(120));
  console.log("\n📋 AUDITING RECENT TASK_INSTANCES...\n");
  
  const instancesSnapshot = await db.collection("task_instances")
    .where("dateKey", "==", "2026-03-25")
    .get();

  console.log(`Found ${instancesSnapshot.size} instances for 2026-03-25\n`);

  const instanceResults = [];
  let instanceSuspiciousCount = 0;

  for (const doc of instancesSnapshot.docs) {
    const data = doc.data();
    const proposed = resolveGuideMapping(data);
    const suspicious = isSuspiciousMapping(data, proposed);

    const result = {
      id: doc.id,
      title: data.title || "N/A",
      category: data.category || "",
      aggregatedCategory: data.aggregatedCategory || "",
      controlType: data.controlType || "",
      currentGuideKey: data.guideKey || "NONE",
      currentTaskType: data.taskType || "NONE",
      proposedGuideKey: proposed.guideKey,
      proposedTaskType: proposed.taskType,
      reason: proposed.reason,
      suspicious: suspicious.suspicious,
      suspiciousReason: suspicious.reason || "",
      needsUpdate: data.guideKey !== proposed.guideKey || data.taskType !== proposed.taskType
    };

    instanceResults.push(result);

    if (suspicious.suspicious) {
      instanceSuspiciousCount++;
    }
  }

  // Display suspicious instances
  if (instanceSuspiciousCount > 0) {
    console.log("🚨 SUSPICIOUS INSTANCE MAPPINGS:\n");
    
    instanceResults.filter(r => r.suspicious).forEach((r, index) => {
      console.log(`${index + 1}. ${r.id}`);
      console.log(`   Title: ${r.title}`);
      console.log(`   Current: ${r.currentGuideKey} / ${r.currentTaskType}`);
      console.log(`   Proposed: ${r.proposedGuideKey} / ${r.proposedTaskType}`);
      console.log(`   ⚠️  ${r.suspiciousReason}`);
      console.log();
    });
  }

  // Summary statistics
  console.log("\n" + "=".repeat(120));
  console.log("\n📊 SUMMARY STATISTICS:\n");

  console.log("TEMPLATES:");
  console.log(`   Total active: ${templatesSnapshot.size}`);
  console.log(`   Suspicious mappings: ${templateSuspiciousCount}`);
  console.log(`   Need update: ${templateResults.filter(r => r.needsUpdate).length}`);
  console.log(`   Already correct: ${templateResults.filter(r => !r.needsUpdate).length}`);

  console.log("\nINSTANCES (2026-03-25):");
  console.log(`   Total: ${instancesSnapshot.size}`);
  console.log(`   Suspicious mappings: ${instanceSuspiciousCount}`);
  console.log(`   Need update: ${instanceResults.filter(r => r.needsUpdate).length}`);
  console.log(`   Already correct: ${instanceResults.filter(r => !r.needsUpdate).length}`);

  // Guide distribution
  console.log("\n" + "=".repeat(120));
  console.log("\n📊 PROPOSED GUIDE DISTRIBUTION:\n");

  const guideDistribution = {};
  templateResults.forEach(r => {
    guideDistribution[r.proposedGuideKey] = (guideDistribution[r.proposedGuideKey] || 0) + 1;
  });

  Object.entries(guideDistribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([guideKey, count]) => {
      console.log(`   ${guideKey}: ${count} templates`);
    });

  // Suspicious by guide key
  if (templateSuspiciousCount > 0) {
    console.log("\n" + "=".repeat(120));
    console.log("\n🚨 SUSPICIOUS MAPPINGS BY GUIDE KEY:\n");

    const suspiciousByGuide = {};
    templateResults.filter(r => r.suspicious).forEach(r => {
      if (!suspiciousByGuide[r.proposedGuideKey]) {
        suspiciousByGuide[r.proposedGuideKey] = [];
      }
      suspiciousByGuide[r.proposedGuideKey].push(r);
    });

    Object.entries(suspiciousByGuide).forEach(([guideKey, items]) => {
      console.log(`   ${guideKey}: ${items.length} suspicious`);
      items.slice(0, 3).forEach(r => {
        console.log(`      - ${r.title.substring(0, 60)}`);
        console.log(`        ${r.suspiciousReason}`);
      });
      if (items.length > 3) {
        console.log(`      ... and ${items.length - 3} more`);
      }
      console.log();
    });
  }

  // Final verdict
  console.log("\n" + "=".repeat(120));
  console.log("\n🎯 FINAL VERDICT:\n");

  if (templateSuspiciousCount === 0 && instanceSuspiciousCount === 0) {
    console.log("✅ PASSED: No suspicious mappings detected.");
    console.log("   Safe to proceed with repair/migration.\n");
    return { passed: true, templateSuspiciousCount: 0, instanceSuspiciousCount: 0 };
  } else {
    console.log("⛔ FAILED: Suspicious mappings detected.");
    console.log(`   Templates: ${templateSuspiciousCount} suspicious`);
    console.log(`   Instances: ${instanceSuspiciousCount} suspicious`);
    console.log("\n   ACTION REQUIRED:");
    console.log("   1. Review suspicious mappings above");
    console.log("   2. Fix guideResolver.js if needed");
    console.log("   3. Re-run audit until suspicious count = 0");
    console.log("   4. Only then proceed with repair\n");
    return { passed: false, templateSuspiciousCount, instanceSuspiciousCount };
  }
}

async function run() {
  try {
    await auditGuideMapping();
  } catch (error) {
    console.error("\n❌ Audit failed:", error);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});

```
