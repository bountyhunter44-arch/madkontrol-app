const admin = require('../node_modules/firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const COMPANY_ID = 'onboarding_aroi-d';
const LOCATION_ID = 'onboarding_aroi-d__main';

async function main() {
  // Check companies doc
  const compSnap = await db.collection('companies').doc(COMPANY_ID).get();
  if (compSnap.exists) {
    console.log('\n=== COMPANY ===');
    const c = compSnap.data();
    console.log(JSON.stringify({ name: c.name, equipmentCounts: c.equipmentCounts, equipment: c.equipment }, null, 2));
  }

  // Check locations doc
  const locSnap = await db.collection('locations').doc(LOCATION_ID).get();
  if (locSnap.exists) {
    console.log('\n=== LOCATION ===');
    const l = locSnap.data();
    console.log(JSON.stringify(l, null, 2));
  }

  // Check onboarding_sessions
  const ob1 = await db.collection('onboarding_sessions').where('companyId', '==', COMPANY_ID).get();
  if (!ob1.empty) {
    console.log(`\n=== ONBOARDING SESSIONS (${ob1.size}) ===`);
    ob1.docs.forEach(d => console.log(JSON.stringify(d.data(), null, 2)));
  }

  // Check locations subcollections
  const locSubSnap = await db.collection('locations').doc(LOCATION_ID).collection('onboarding').get();
  if (!locSubSnap.empty) {
    console.log('\n=== LOCATION/onboarding subcollection ===');
    locSubSnap.docs.forEach(d => console.log(d.id, JSON.stringify(d.data(), null, 2)));
  }
}

main().catch(console.error).finally(() => process.exit(0));
