# FILE: public/scripts/check-task-templates.cjs

```javascript
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const keyPath = path.join(__dirname, "../../serviceAccountKey.json");

console.log("Script __dirname:", __dirname);
console.log("Resolved keyPath:", keyPath);
console.log("Key exists:", fs.existsSync(keyPath));

if (!fs.existsSync(keyPath)) {
  throw new Error(`serviceAccountKey.json blev ikke fundet: ${keyPath}`);
}

const serviceAccount = require(keyPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function run() {
  const locationId = "onboarding_aroi-d__main";

  console.log(`🔍 Checking task_templates for locationId: ${locationId}\n`);

  const snapshot = await db
    .collection("task_templates")
    .where("isActive", "==", true)
    .where("locationId", "==", locationId)
    .get();

  console.log(`📊 Found ${snapshot.size} active templates\n`);

  let missingCompanyId = 0;
  let missingLocationId = 0;

  const rows = snapshot.docs.map((doc) => {
    const data = doc.data();

    if (!data.companyId) missingCompanyId++;
    if (!data.locationId) missingLocationId++;

    return {
      id: doc.id,
      title: data.title || data.name || "NO TITLE",
      frequency: data.frequency || "daily",
      companyId: data.companyId || "❌ MISSING",
      locationId: data.locationId || "❌ MISSING",
    };
  });

  console.table(rows);

  // Count unsupported frequencies
  const supportedFrequencies = ["daily", "weekdays", "weekends", "weekly", "monthly"];
  const unsupported = rows.filter(r => !supportedFrequencies.includes(r.frequency));
  
  console.log(`\n⚠️ Missing companyId: ${missingCompanyId}`);
  console.log(`⚠️ Missing locationId: ${missingLocationId}`);
  console.log(`⚠️ Unsupported frequencies: ${unsupported.length}`);
  if (unsupported.length > 0) {
    console.log(`\nTemplates with unsupported frequencies:`);
    unsupported.forEach(t => console.log(`  - ${t.id}: ${t.frequency}`));
  }
}

run().catch((err) => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});
```
