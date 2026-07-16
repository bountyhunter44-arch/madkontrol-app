/**
 * Fetch REAL task_instances after regeneration
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

const TARGET_GUIDE_KEYS = [
    'hot_preparation_core_temperature',
    'cold_preparation_hygiene',
    'hot_holding',
    'fridge_temperature',
    'freezer_temperature',
    'dishwasher_control',
    'oven_control'
];

async function fetchRealTaskInstances() {
    console.log('\n=== FETCHING REAL TASK_INSTANCES ===\n');
    
    const snapshot = await db.collection('task_instances').get();
    
    if (snapshot.empty) {
        console.log('❌ NO TASK_INSTANCES FOUND\n');
        console.log('Task instances need to be regenerated.\n');
        process.exit(1);
    }
    
    console.log(`Total task_instances: ${snapshot.size}\n`);
    
    const byGuideKey = {};
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const guideKey = data.guideKey || 'NULL';
        
        if (!byGuideKey[guideKey]) {
            byGuideKey[guideKey] = [];
        }
        
        byGuideKey[guideKey].push({
            taskInstanceId: doc.id,
            title: data.title || 'N/A',
            templateId: data.templateId || 'N/A',
            guideKey: data.guideKey || 'NULL',
            controlType: data.controlType || 'NULL',
            status: data.status || 'N/A'
        });
    });
    
    console.log('=== REAL TASK_INSTANCE SAMPLES ===\n');
    
    TARGET_GUIDE_KEYS.forEach(targetKey => {
        const instances = byGuideKey[targetKey] || [];
        
        console.log(`\n📋 ${targetKey}: ${instances.length} instances`);
        
        if (instances.length > 0) {
            const sample = instances[0];
            console.log(`   TaskInstanceId: ${sample.taskInstanceId}`);
            console.log(`   Title: ${sample.title}`);
            console.log(`   TemplateId: ${sample.templateId}`);
            console.log(`   GuideKey: ${sample.guideKey}`);
            console.log(`   ControlType: ${sample.controlType}`);
            console.log(`   Status: ${sample.status}`);
        } else {
            console.log(`   ⚠️  NO INSTANCES FOUND`);
        }
    });
    
    console.log('\n\n=== ALL GUIDEKEYS IN SYSTEM ===\n');
    Object.keys(byGuideKey).sort().forEach(key => {
        console.log(`${key}: ${byGuideKey[key].length} instances`);
    });
    
    console.log('\n');
    
    process.exit(0);
}

fetchRealTaskInstances().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
