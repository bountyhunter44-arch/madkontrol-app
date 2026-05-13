# FILE: public/scripts/inspect-modtagekontrol.cjs

```javascript
/**
 * Inspect Modtagekontrol template and task_instance
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
const { getGuideByKey } = require('../../functions/guideLibrary');

async function inspectModtagekontrol() {
    console.log('\n=== INSPECTING MODTAGEKONTROL ===\n');
    
    // Get template
    const templateDoc = await db.collection('task_templates').doc('tpl_receiving_control').get();
    
    if (!templateDoc.exists) {
        console.log('❌ Template tpl_receiving_control NOT FOUND\n');
        process.exit(1);
    }
    
    const template = templateDoc.data();
    
    console.log('📋 TEMPLATE: tpl_receiving_control\n');
    console.log(`   TemplateId: ${templateDoc.id}`);
    console.log(`   Title: ${template.name || template.title || 'N/A'}`);
    console.log(`   GuideKey: ${template.guideKey || 'NULL'}`);
    console.log(`   ControlType: ${template.controlType || 'NULL'}`);
    console.log(`   IsActive: ${template.isActive}`);
    console.log(`   LocationId: ${template.locationId || 'N/A'}`);
    
    // Get guide
    if (template.guideKey) {
        const guide = getGuideByKey(template.guideKey);
        if (guide) {
            console.log(`   Rendered Guide: "${guide.title}"`);
        } else {
            console.log(`   ❌ Guide NOT FOUND for key: ${template.guideKey}`);
        }
    }
    
    // Get task_instance
    const instancesSnapshot = await db.collection('task_instances')
        .where('templateId', '==', 'tpl_receiving_control')
        .limit(1)
        .get();
    
    if (!instancesSnapshot.empty) {
        console.log('\n📅 TASK_INSTANCE:\n');
        instancesSnapshot.forEach(doc => {
            const instance = doc.data();
            console.log(`   TaskInstanceId: ${doc.id}`);
            console.log(`   Title: ${instance.title || 'N/A'}`);
            console.log(`   GuideKey: ${instance.guideKey || 'NULL'}`);
            console.log(`   ControlType: ${instance.controlType || 'NULL'}`);
            console.log(`   Status: ${instance.status || 'N/A'}`);
            
            if (instance.guideKey) {
                const guide = getGuideByKey(instance.guideKey);
                if (guide) {
                    console.log(`   Rendered Guide: "${guide.title}"`);
                } else {
                    console.log(`   ❌ Guide NOT FOUND for key: ${instance.guideKey}`);
                }
            }
        });
    } else {
        console.log('\n⚠️  No task_instance found for this template\n');
    }
    
    console.log('\n=== SEMANTIC ANALYSIS ===\n');
    
    if (template.guideKey === 'cleaning_control') {
        console.log('❌ WRONG MAPPING DETECTED');
        console.log('   "Modtagekontrol" (receiving control) should NOT use cleaning_control');
        console.log('   Correct mapping: receiving_goods\n');
        console.log('   Action required: Update template guideKey and controlType to receiving_goods');
    } else if (template.guideKey === 'receiving_goods') {
        console.log('✅ CORRECT MAPPING');
        console.log('   "Modtagekontrol" correctly uses receiving_goods\n');
    } else {
        console.log(`⚠️  UNEXPECTED MAPPING: ${template.guideKey}`);
    }
    
    process.exit(0);
}

inspectModtagekontrol().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

```
