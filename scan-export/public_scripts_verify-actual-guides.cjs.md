# FILE: public/scripts/verify-actual-guides.cjs

```javascript
/**
 * Verify ACTUAL guide mappings for real task_instances
 * Print what guides are ACTUALLY rendered
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

// Import guide library to simulate frontend resolution
const { getGuideByKey } = require('../../functions/guideLibrary');

const TARGET_TASKS = [
    'Kernetemperaturkontrol ved tilberedning',
    'Krydskontaminering ved kold tilberedning',
    'Temperaturkontrol ved varmholdelse',
    'Temperaturkontrol af køleskab',
    'Temperaturkontrol af fryser',
    'Kontrollér opvaskemaskine vaske-/slutskylletemperatur',
    'Test ovntemperatur med kalibreret termometer'
];

async function verifyActualGuides() {
    console.log('\n=== ACTUAL GUIDE VERIFICATION ===\n');
    
    // Get all task_instances
    const instancesSnapshot = await db.collection('task_instances').get();
    
    if (instancesSnapshot.empty) {
        console.log('❌ NO TASK_INSTANCES FOUND\n');
        process.exit(1);
    }
    
    console.log(`Total task_instances: ${instancesSnapshot.size}\n`);
    
    // Get all templates to match titles
    const templatesSnapshot = await db.collection('task_templates').get();
    const templatesById = {};
    templatesSnapshot.forEach(doc => {
        templatesById[doc.id] = doc.data();
    });
    
    console.log('=== ACTUAL TASK_INSTANCE SAMPLES ===\n');
    
    const results = [];
    
    instancesSnapshot.forEach(doc => {
        const instance = doc.data();
        const template = templatesById[instance.templateId];
        const templateTitle = template ? (template.name || template.title) : 'N/A';
        
        results.push({
            taskInstanceId: doc.id,
            title: instance.title || 'N/A',
            templateTitle: templateTitle,
            templateId: instance.templateId,
            guideKey: instance.guideKey || 'NULL',
            controlType: instance.controlType || 'NULL',
            status: instance.status || 'N/A'
        });
    });
    
    // Print all instances
    results.forEach(result => {
        console.log(`📋 ${result.templateTitle || result.title}`);
        console.log(`   TaskInstanceId: ${result.taskInstanceId}`);
        console.log(`   Title: ${result.title}`);
        console.log(`   TemplateId: ${result.templateId}`);
        console.log(`   GuideKey: ${result.guideKey}`);
        console.log(`   ControlType: ${result.controlType}`);
        console.log(`   Status: ${result.status}`);
        
        // Simulate guide resolution
        if (result.guideKey && result.guideKey !== 'NULL') {
            const guide = getGuideByKey(result.guideKey);
            if (guide) {
                console.log(`   ✅ ACTUAL GUIDE: "${guide.title}"`);
            } else {
                console.log(`   ❌ GUIDE NOT FOUND FOR KEY: ${result.guideKey}`);
            }
        } else {
            console.log(`   ❌ NO GUIDEKEY`);
        }
        console.log('');
    });
    
    console.log('\n=== TARGET TASK VERIFICATION ===\n');
    
    TARGET_TASKS.forEach(targetTask => {
        const found = results.find(r => 
            (r.templateTitle && r.templateTitle.includes(targetTask)) ||
            (r.title && r.title.includes(targetTask))
        );
        
        if (found) {
            const guide = found.guideKey !== 'NULL' ? getGuideByKey(found.guideKey) : null;
            const guideTitle = guide ? guide.title : 'NO GUIDE';
            const pass = guide && found.guideKey !== 'cleaning_control';
            
            console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: "${targetTask}"`);
            console.log(`   GuideKey: ${found.guideKey}`);
            console.log(`   Actual Guide: "${guideTitle}"`);
        } else {
            console.log(`⚠️  NOT FOUND: "${targetTask}"`);
            console.log(`   Template does not exist or is not assigned to active location`);
        }
        console.log('');
    });
    
    process.exit(0);
}

verifyActualGuides().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

```
