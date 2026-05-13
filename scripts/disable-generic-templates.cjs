const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const GENERIC_SUFFIXES = [
  "__hot_holding",
  "__cooling",
  "__reheating",
  "__receiving",
  "__storage",
  "__clean_surfaces",
  "__clean_equipment",
  "__clean_area__"
];

function isGenericTemplate(docId) {
  return GENERIC_SUFFIXES.some((suffix) => docId.includes(suffix));
}

async function disableGenericTemplates() {
  const snapshot = await db.collection("task_templates").get();

  const targets = snapshot.docs.filter((doc) => isGenericTemplate(doc.id));

  console.log(`Found ${targets.length} generic template(s) matching criteria.\n`);

  let deactivatedCount = 0;

  for (const doc of targets) {
    const data = doc.data();

    if (data.isActive === false) {
      console.log(`SKIP (already inactive): ${doc.id}`);
      continue;
    }

    await doc.ref.update({
      isActive: false,
      disabledAt: admin.firestore.FieldValue.serverTimestamp(),
      disabledReason: "Removed generic fallback templates"
    });

    console.log(`DEACTIVATED: ${doc.id}  (title: "${data.title || ""}")`);
    deactivatedCount++;
  }

  console.log(`\nDone. Deactivated ${deactivatedCount} template(s).`);
  process.exit(0);
}

disableGenericTemplates().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
