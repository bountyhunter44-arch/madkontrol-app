# FILE: public/scripts/check-guidekey-integrity.cjs

```javascript
/**
 * Check guideKey integrity across task_templates and task_instances
 * Verify that all tasks have valid guideKey
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

const VALID_GUIDE_KEYS = [
    'fridge_temperature',
    'walkin_cooler_temperature',
    'cold_storage_placement',
    'freezer_temperature',
    'hot_holding',
    'reheating',
    'hot_preparation_core_temperature',
    'cold_preparation_hygiene',
    'receiving_goods',
    'allergen_control',
    'cleaning_control',
    'date_check',
    'personal_hygiene_check',
    'closing_routine',
    'drain_maintenance',
    'equipment_cleaning',
    'ice_equipment',
    'fryer_control',
    'cooling_process',
    'oven_control',
    'dishwasher_control'
];

async function checkGuideKeyIntegrity() {
    console.log('\n=== GUIDEKEY INTEGRITY CHECK ===\n');
    
    // Check task_templates
    console.log('📋 Checking task_templates...\n');
    const templatesSnap = await db.collection('task_templates')
        .limit(20)
        .get();
    
    let templatesMissing = 0;
    let templatesInvalid = 0;
    let templatesValid = 0;
    
    templatesSnap.forEach(doc => {
        const data = doc.data();
        const guideKey = data.guideKey;
        
        if (!guideKey) {
            templatesMissing++;
            console.log(`❌ Template missing guideKey: ${doc.id}`);
            console.log(`   Title: ${data.name || data.title || 'N/A'}`);
            console.log(`   Category: ${data.category || data.aggregatedCategory || 'N/A'}\n`);
        } else if (!VALID_GUIDE_KEYS.includes(guideKey)) {
            templatesInvalid++;
            console.log(`⚠️  Template has invalid guideKey: ${doc.id}`);
            console.log(`   GuideKey: ${guideKey}`);
            console.log(`   Title: ${data.name || data.title || 'N/A'}\n`);
        } else {
            templatesValid++;
        }
    });
    
    console.log(`\nTemplates Summary:`);
    console.log(`  ✅ Valid: ${templatesValid}`);
    console.log(`  ❌ Missing guideKey: ${templatesMissing}`);
    console.log(`  ⚠️  Invalid guideKey: ${templatesInvalid}`);
    
    // Check task_instances
    console.log('\n\n📅 Checking task_instances...\n');
    const instancesSnap = await db.collection('task_instances')
        .orderBy('dateKey', 'desc')
        .limit(20)
        .get();
    
    let instancesMissing = 0;
    let instancesInvalid = 0;
    let instancesValid = 0;
    
    instancesSnap.forEach(doc => {
        const data = doc.data();
        const guideKey = data.guideKey;
        
        if (!guideKey) {
            instancesMissing++;
            console.log(`❌ Instance missing guideKey: ${doc.id}`);
            console.log(`   Title: ${data.title || 'N/A'}`);
            console.log(`   Category: ${data.category || data.aggregatedCategory || 'N/A'}`);
            console.log(`   TemplateId: ${data.templateId || 'N/A'}\n`);
        } else if (!VALID_GUIDE_KEYS.includes(guideKey)) {
            instancesInvalid++;
            console.log(`⚠️  Instance has invalid guideKey: ${doc.id}`);
            console.log(`   GuideKey: ${guideKey}`);
            console.log(`   Title: ${data.title || 'N/A'}\n`);
        } else {
            instancesValid++;
        }
    });
    
    console.log(`\nInstances Summary:`);
    console.log(`  ✅ Valid: ${instancesValid}`);
    console.log(`  ❌ Missing guideKey: ${instancesMissing}`);
    console.log(`  ⚠️  Invalid guideKey: ${instancesInvalid}`);
    
    // Overall verdict
    console.log('\n\n=== VERDICT ===\n');
    
    const totalMissing = templatesMissing + instancesMissing;
    const totalInvalid = templatesInvalid + instancesInvalid;
    
    if (totalMissing > 0 || totalInvalid > 0) {
        console.log('❌ REGENERATION REQUIRED');
        console.log(`\nReasons:`);
        if (totalMissing > 0) {
            console.log(`  - ${totalMissing} tasks missing guideKey`);
        }
        if (totalInvalid > 0) {
            console.log(`  - ${totalInvalid} tasks have invalid guideKey`);
        }
        console.log('\nAction: Fix generator and regenerate templates/instances');
    } else {
        console.log('✅ ALL TASKS HAVE VALID GUIDEKEY');
        console.log('\nNo regeneration needed - system is guideKey-compliant');
    }
    
    process.exit(0);
}

checkGuideKeyIntegrity().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

```
