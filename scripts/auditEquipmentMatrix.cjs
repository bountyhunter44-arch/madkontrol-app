const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  const snap = await db.collection("task_templates").get();

  const matrix = {};

  snap.forEach(doc => {
    const d = doc.data();

    const eq = d.equipmentType || "GENERIC";
    const type = d.controlType || "UNKNOWN";

    if (!matrix[eq]) {
      matrix[eq] = {
        temperature: false,
        cleaning: false,
        maintenance: false
      };
    }

    if (type.includes("temperature")) matrix[eq].temperature = true;
    if (type.includes("cleaning")) matrix[eq].cleaning = true;
    if (type.includes("maintenance")) matrix[eq].maintenance = true;
  });

  console.log("\n=== EQUIPMENT MATRIX ===\n");

  Object.entries(matrix).forEach(([eq, v]) => {
    console.log(
      eq.padEnd(20),
      "temp:", v.temperature ? "✅" : "❌",
      "clean:", v.cleaning ? "✅" : "❌",
      "maint:", v.maintenance ? "✅" : "❌"
    );
  });

  console.log("\nDone.");
}

run();