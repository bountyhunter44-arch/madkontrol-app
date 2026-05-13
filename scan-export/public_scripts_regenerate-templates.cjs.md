# FILE: public/scripts/regenerate-templates.cjs

```javascript
const admin = require("firebase-admin");
const serviceAccount = require("../../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Import the generation logic
const { generateEgenkontrolFromRiskAnalysis } = require("../../functions/admin/generateEgenkontrolFromRiskAnalysis.js");

async function regenerateTemplates() {
  const LOCATION_ID = "onboarding_aroi-d";
  
  console.log(`\n🔄 REGENERERER TASK_TEMPLATES FRA RISK_ANALYSES`);
  console.log(`📍 Location: ${LOCATION_ID}\n`);

  // Først: Tjek om der findes risk_analyses
  const riskSnap = await db
    .collection("risk_analyses")
    .where("locationId", "==", LOCATION_ID)
    .get();

  console.log(`📊 Fandt ${riskSnap.size} risk_analyses dokumenter`);

  if (riskSnap.empty) {
    console.log("\n❌ INGEN RISK_ANALYSES FUNDET!");
    console.log("Du skal først oprette risk_analyses dokumenter for denne location.");
    console.log("Alternativt: Brug en anden location_id der har risk_analyses.");
    return;
  }

  // Vis hvad vi fandt
  console.log("\n📋 Risk analyses fundet:");
  riskSnap.forEach((doc) => {
    const data = doc.data();
    console.log(`  - ${doc.id}: ${data.process || "N/A"} → ${data.hazard || "N/A"} (${data.controlType || "N/A"})`);
  });

  // Kør generering
  console.log("\n🚀 Kører template-generering...\n");
  
  const result = await generateEgenkontrolFromRiskAnalysis({ locationId: LOCATION_ID });

  console.log("\n✅ RESULTAT:");
  console.log(`  - Oprettet: ${result.created} templates`);
  console.log(`  - Opdateret: ${result.updated} templates`);
  console.log(`  - Sprunget over: ${result.skipped} templates`);
  console.log(`  - Total templates: ${result.totalTemplates}`);
  console.log(`  - Risk analyses fundet: ${result.totalFound}`);
  console.log(`  - Aktive risk analyses: ${result.totalActive}`);

  // Verificer hvad der blev oprettet
  console.log("\n🔍 VERIFICERER OPRETTEDE TEMPLATES:");
  const templateSnap = await db
    .collection("task_templates")
    .where("locationId", "==", LOCATION_ID)
    .get();

  console.log(`\n📊 Total task_templates i database: ${templateSnap.size}`);
  
  if (templateSnap.size > 0) {
    console.log("\n📋 Templates oprettet:");
    templateSnap.forEach((doc) => {
      const data = doc.data();
      console.log(`  - ${data.name || "N/A"} (${data.frequency || "N/A"}, ${data.templateType || "operational"})`);
    });
  }

  console.log("\n✅ FÆRDIG - Templates er klar til Start dag");
}

regenerateTemplates().catch((error) => {
  console.error("\n❌ FEJL:", error);
  process.exit(1);
});

```
