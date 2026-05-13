# FILE: public/scripts/fetch-task-instances-sample.cjs

```javascript
/**
 * Fetch sample task_instances to verify guideKey and controlType fields
 */

const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fetchTaskInstancesSample() {
    console.log('\n=== TASK_INSTANCES SAMPLE VERIFICATION ===\n');
    
    const snapshot = await db.collection('task_instances')
        .orderBy('dateKey', 'desc')
        .limit(10)
        .get();
    
    if (snapshot.empty) {
        console.log('⚠️  No task_instances found. Regeneration may be needed.\n');
        console.log('To trigger regeneration, call Firebase function:');
        console.log('  generateTaskInstancesNow\n');
        process.exit(0);
    }
    
    console.log(`Found ${snapshot.size} task_instances\n`);
    
    const samples = [];
    
    snapshot.forEach(doc => {
        const data = doc.data();
        samples.push({
            id: doc.id,
            title: data.title || 'N/A',
            guideKey: data.guideKey || null,
            controlType: data.controlType || null,
            templateId: data.templateId || null,
            dateKey: data.dateKey || null
        });
    });
    
    console.log('=== SAMPLE DOCUMENTS ===\n');
    
    samples.forEach((sample, i) => {
        console.log(`${i + 1}. ${sample.title}`);
        console.log(`   ID: ${sample.id}`);
        console.log(`   GuideKey: ${sample.guideKey || 'NULL ❌'}`);
        console.log(`   ControlType: ${sample.controlType || 'NULL ❌'}`);
        console.log(`   TemplateId: ${sample.templateId}`);
        console.log(`   DateKey: ${sample.dateKey}\n`);
    });
    
    // Check for missing fields
    const missingGuideKey = samples.filter(s => !s.guideKey);
    const missingControlType = samples.filter(s => !s.controlType);
    
    console.log('=== FIELD VALIDATION ===\n');
    console.log(`✅ Has guideKey: ${samples.length - missingGuideKey.length}/${samples.length}`);
    console.log(`✅ Has controlType: ${samples.length - missingControlType.length}/${samples.length}`);
    
    if (missingGuideKey.length > 0) {
        console.log(`\n❌ Missing guideKey: ${missingGuideKey.length}`);
        missingGuideKey.forEach(s => console.log(`   - ${s.title}`));
    }
    
    if (missingControlType.length > 0) {
        console.log(`\n❌ Missing controlType: ${missingControlType.length}`);
        missingControlType.forEach(s => console.log(`   - ${s.title}`));
    }
    
    if (missingGuideKey.length === 0 && missingControlType.length === 0) {
        console.log('\n✅ ALL TASK_INSTANCES HAVE REQUIRED FIELDS\n');
    }
    
    process.exit(0);
}

fetchTaskInstancesSample().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

```
