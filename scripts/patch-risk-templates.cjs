const admin = require('../node_modules/firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  // Find all risk_analysis templates missing companyId
  const snap = await db.collection('task_templates')
    .where('templateSource', '==', 'risk_analysis')
    .get();

  console.log(`Found ${snap.size} risk_analysis templates`);

  const batch = db.batch();
  let patched = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.companyId) {
      console.log(`  SKIP ${doc.id} — already has companyId: ${data.companyId}`);
      continue;
    }

    // Derive companyId from locationId: "onboarding_aroi-d__main" -> "onboarding_aroi-d"
    // locationId format is: {companyId}__{locationSuffix}
    const locationId = data.locationId || '';
    const doubleUnderIdx = locationId.indexOf('__');
    const companyId = doubleUnderIdx > -1 ? locationId.slice(0, doubleUnderIdx) : null;

    if (!companyId) {
      console.warn(`  SKIP ${doc.id} — cannot derive companyId from locationId: ${locationId}`);
      continue;
    }

    console.log(`  PATCH ${doc.id} → companyId: ${companyId}`);
    batch.update(doc.ref, { companyId });
    patched++;
  }

  if (patched > 0) {
    await batch.commit();
    console.log(`\n✅ Patched ${patched} templates`);
  } else {
    console.log('\nNothing to patch.');
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
