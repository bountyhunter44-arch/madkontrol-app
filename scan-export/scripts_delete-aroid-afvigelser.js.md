# FILE: scripts/delete-aroid-afvigelser.js

```javascript
const path = require("path");
const admin = require("firebase-admin");

const serviceAccount = require(path.join(__dirname, "..", "serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const COMPANY_ID = process.argv[2] || "company_1";

async function collectDocs(collectionName) {
  const byCompany = await db.collection(collectionName).where("companyId", "==", COMPANY_ID).get();
  const byOrganization = await db.collection(collectionName).where("organizationId", "==", COMPANY_ID).get();

  const docMap = new Map();
  byCompany.docs.forEach((doc) => docMap.set(doc.id, doc.ref));
  byOrganization.docs.forEach((doc) => docMap.set(doc.id, doc.ref));

  return Array.from(docMap.values());
}

async function deleteRefs(refs) {
  let deleted = 0;

  for (let i = 0; i < refs.length; i += 450) {
    const chunk = refs.slice(i, i + 450);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

async function main() {
  const targets = ["alerts", "deviations"];
  const results = [];

  for (const collectionName of targets) {
    const refs = await collectDocs(collectionName);
    const deleted = refs.length ? await deleteRefs(refs) : 0;
    results.push({ collectionName, found: refs.length, deleted });
  }

  console.log(`Company scope: ${COMPANY_ID}`);
  results.forEach((r) => {
    console.log(`${r.collectionName}: found=${r.found}, deleted=${r.deleted}`);
  });

  await admin.app().delete();
}

main().catch(async (error) => {
  console.error("Delete failed:", error);
  try {
    await admin.app().delete();
  } catch {
    // ignore cleanup errors
  }
  process.exit(1);
});

```
