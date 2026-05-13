const admin = require('../node_modules/firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  // Check risk_analyses fields
  const snap = await db.collection('risk_analyses').where('locationId','==','onboarding_aroi-d__main').limit(2).get();
  console.log('=== risk_analyses fields ===');
  snap.docs.forEach(d => {
    const data = d.data();
    const idFields = Object.keys(data).filter(k => k.toLowerCase().includes('id') || k.toLowerCase().includes('company') || k.toLowerCase().includes('org'));
    console.log('id:', d.id);
    console.log('id-like fields:', idFields.map(k => `${k}=${data[k]}`).join(', '));
  });

  // Check task_templates (risk_analysis source) fields
  const tSnap = await db.collection('task_templates').where('templateSource','==','risk_analysis').where('locationId','==','onboarding_aroi-d__main').limit(2).get();
  console.log('\n=== task_templates (risk_analysis) ===');
  tSnap.docs.forEach(d => {
    const data = d.data();
    const idFields = Object.keys(data).filter(k => k.toLowerCase().includes('id') || k.toLowerCase().includes('company') || k.toLowerCase().includes('org'));
    console.log('id:', d.id);
    console.log('id-like fields:', idFields.map(k => `${k}=${data[k]}`).join(', '));
  });

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
