const admin = require('../node_modules/firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const COMPANY_ID = 'onboarding_aroi-d';
const LOCATION_ID = 'onboarding_aroi-d__main';

async function main() {
  const snap = await db.collection('task_templates')
    .where('companyId', '==', COMPANY_ID)
    .where('locationId', '==', LOCATION_ID)
    .get();

  const templates = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Group by templateSource
  const groups = {};
  for (const t of templates) {
    const src = t.templateSource || 'unknown';
    if (!groups[src]) groups[src] = [];
    groups[src].push(t);
  }

  console.log(`\n=== TASK TEMPLATES for ${LOCATION_ID} ===`);
  console.log(`Total: ${templates.length}\n`);

  for (const [src, docs] of Object.entries(groups)) {
    console.log(`--- ${src} (${docs.length}) ---`);
    for (const t of docs) {
      const freq = t.frequency || '?';
      const intervalDays = t.interval_days !== undefined ? `  interval_days=${t.interval_days}` : '';
      const active = t.isActive === false ? ' [INACTIVE]' : '';
      console.log(`  ${(t.title || t.name || t.key || t.id).padEnd(45)} freq=${freq}${intervalDays}${active}`);
    }
    console.log();
  }

  // Also check risk_analysis templates (no companyId before patch, now confirm)
  const riskSnap = await db.collection('task_templates')
    .where('templateSource', '==', 'risk_analysis')
    .where('locationId', '==', LOCATION_ID)
    .get();
  if (riskSnap.size > 0) {
    console.log(`--- risk_analysis (${riskSnap.size}) ---`);
    riskSnap.docs.forEach(d => {
      const t = d.data();
      console.log(`  ${(t.title || t.name || d.id).padEnd(45)} companyId=${t.companyId || 'MISSING'} freq=${t.frequency || '?'}`);
    });
    console.log();
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
