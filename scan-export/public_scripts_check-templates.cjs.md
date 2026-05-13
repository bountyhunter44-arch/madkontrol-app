# FILE: public/scripts/check-templates.cjs

```javascript
const admin = require("firebase-admin");
const serviceAccount = require("../../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkTemplates() {
  const LOCATION_ID = "onboarding_aroi-d";
  
  console.log(`\n🔍 TJEKKER TASK_TEMPLATES`);
  console.log(`📍 Location: ${LOCATION_ID}\n`);

  const snapshot = await db
    .collection("task_templates")
    .where("locationId", "==", LOCATION_ID)
    .get();

  console.log(`📊 Total templates fundet: ${snapshot.size}\n`);

  if (snapshot.empty) {
    console.log("❌ INGEN TEMPLATES FUNDET!");
    console.log("Kør: node public/scripts/regenerate-templates.cjs");
    return;
  }

  // Gruppér efter type
  const byType = new Map();
  const byFrequency = new Map();
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    const type = data.templateType || "operational";
    const freq = data.frequency || "daily";
    
    if (!byType.has(type)) byType.set(type, []);
    if (!byFrequency.has(freq)) byFrequency.set(freq, []);
    
    byType.get(type).push(data);
    byFrequency.get(freq).push(data);
  });

  console.log("📋 TEMPLATES EFTER TYPE:");
  for (const [type, templates] of byType.entries()) {
    console.log(`\n  ${type.toUpperCase()} (${templates.length}):`);
    templates.forEach(t => {
      console.log(`    - ${t.name || "N/A"} (${t.frequency || "N/A"})`);
    });
  }

  console.log("\n\n📅 TEMPLATES EFTER FREKVENS:");
  for (const [freq, templates] of byFrequency.entries()) {
    console.log(`\n  ${freq.toUpperCase()} (${templates.length}):`);
    templates.forEach(t => {
      console.log(`    - ${t.name || "N/A"} (${t.templateType || "operational"})`);
    });
  }

  // Tjek aktive
  const active = snapshot.docs.filter(doc => {
    const data = doc.data();
    return data.isActive !== false;
  });

  console.log(`\n\n✅ Aktive templates: ${active.length}/${snapshot.size}`);
  
  // Tjek operational (bruges i Start dag)
  const operational = snapshot.docs.filter(doc => {
    const data = doc.data();
    return (data.templateType || "operational") === "operational" && data.isActive !== false;
  });

  console.log(`📌 Operational templates (bruges i Start dag): ${operational.length}`);
  
  if (operational.length === 0) {
    console.log("\n⚠️  ADVARSEL: Ingen operational templates!");
    console.log("Start dag vil oprette 0 opgaver.");
  } else {
    console.log("\n✅ Start dag vil oprette ca. " + operational.length + " opgaver");
  }
}

checkTemplates().catch((error) => {
  console.error("\n❌ FEJL:", error);
  process.exit(1);
});

```
