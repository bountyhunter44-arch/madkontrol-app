# FILE: public/scripts/verify-task-instances.cjs

```javascript
const admin = require("firebase-admin");
const serviceAccount = require("../../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function verifyTaskInstances() {
  const LOCATION_ID = "onboarding_aroi-d";
  const today = new Date();
  const dateKey = today.toISOString().split("T")[0];
  
  console.log(`\n🔍 VERIFICERER TASK_INSTANCES`);
  console.log(`📍 Location: ${LOCATION_ID}`);
  console.log(`📅 DateKey: ${dateKey}\n`);

  const snapshot = await db
    .collection("task_instances")
    .where("locationId", "==", LOCATION_ID)
    .where("dateKey", "==", dateKey)
    .get();

  console.log(`📊 Total task_instances for i dag: ${snapshot.size}\n`);

  if (snapshot.empty) {
    console.log("❌ INGEN TASK_INSTANCES FUNDET FOR I DAG!");
    console.log("\nMulige årsager:");
    console.log("  1. Start dag er ikke kørt endnu");
    console.log("  2. Ingen operational templates findes");
    console.log("  3. Templates har forkert locationId");
    console.log("\nNæste skridt:");
    console.log("  1. Tjek templates: node public/scripts/check-templates.cjs");
    console.log("  2. Kør Start dag via UI eller cloud function");
    return;
  }

  // Gruppér efter status
  const byStatus = new Map();
  const byType = new Map();
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    const status = data.status || "pending";
    const type = data.type || "checklist";
    
    if (!byStatus.has(status)) byStatus.set(status, []);
    if (!byType.has(type)) byType.set(type, []);
    
    byStatus.get(status).push(data);
    byType.get(type).push(data);
  });

  console.log("📋 TASK_INSTANCES EFTER STATUS:");
  for (const [status, instances] of byStatus.entries()) {
    console.log(`\n  ${status.toUpperCase()} (${instances.length}):`);
    instances.slice(0, 5).forEach(t => {
      console.log(`    - ${t.title || t.name || "N/A"}`);
    });
    if (instances.length > 5) {
      console.log(`    ... og ${instances.length - 5} flere`);
    }
  }

  console.log("\n\n📊 TASK_INSTANCES EFTER TYPE:");
  for (const [type, instances] of byType.entries()) {
    console.log(`\n  ${type.toUpperCase()} (${instances.length}):`);
    instances.slice(0, 3).forEach(t => {
      console.log(`    - ${t.title || t.name || "N/A"}`);
    });
    if (instances.length > 3) {
      console.log(`    ... og ${instances.length - 3} flere`);
    }
  }

  // Tjek om alle er pending (forventet efter Start dag)
  const pending = snapshot.docs.filter(doc => {
    const data = doc.data();
    return data.status === "pending";
  });

  console.log(`\n\n✅ Status fordeling:`);
  console.log(`  - Pending: ${pending.length}/${snapshot.size}`);
  console.log(`  - Andre: ${snapshot.size - pending.length}/${snapshot.size}`);

  if (pending.length === snapshot.size) {
    console.log("\n✅ PERFEKT: Alle opgaver er pending (som forventet efter Start dag)");
  } else {
    console.log("\n⚠️  Nogle opgaver har anden status end pending");
  }

  // Vis eksempel på første opgave
  if (snapshot.size > 0) {
    const first = snapshot.docs[0].data();
    console.log("\n\n📄 EKSEMPEL PÅ OPGAVE:");
    console.log(JSON.stringify({
      title: first.title || first.name,
      status: first.status,
      type: first.type,
      frequency: first.frequency,
      dateKey: first.dateKey,
      locationId: first.locationId
    }, null, 2));
  }
}

verifyTaskInstances().catch((error) => {
  console.error("\n❌ FEJL:", error);
  process.exit(1);
});

```
