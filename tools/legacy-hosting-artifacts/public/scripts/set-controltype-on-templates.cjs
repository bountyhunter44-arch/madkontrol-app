/**
 * Migration: Set controlType on all existing templates
 * controlType = guideKey (deterministic 1:1 mapping)
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

async function setControlTypeOnTemplates() {
    console.log('\n=== SETTING CONTROLTYPE ON ALL TEMPLATES ===\n');
    
    const snapshot = await db.collection('task_templates').get();
    
    const batch = db.batch();
    let updated = 0;
    const changes = [];
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const guideKey = data.guideKey;
        
        // Skip if already has controlType
        if (data.controlType) {
            return;
        }
        
        if (!guideKey) {
            console.warn(`⚠️  Template ${doc.id} has no guideKey - skipping`);
            return;
        }
        
        // Deterministic mapping: controlType = guideKey
        const controlType = guideKey;
        
        batch.update(doc.ref, {
            controlType: controlType,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        changes.push({
            id: doc.id,
            name: data.name || data.title || 'N/A',
            guideKey: guideKey,
            controlType: controlType
        });
        
        updated++;
    });
    
    if (updated > 0) {
        await batch.commit();
        
        console.log(`✅ Set controlType on ${updated} templates:\n`);
        
        // Group by controlType for summary
        const byControlType = {};
        changes.forEach(change => {
            if (!byControlType[change.controlType]) {
                byControlType[change.controlType] = [];
            }
            byControlType[change.controlType].push(change.name);
        });
        
        Object.entries(byControlType).forEach(([controlType, names]) => {
            console.log(`\n📋 controlType: ${controlType}`);
            console.log(`   Count: ${names.length}`);
            console.log(`   Examples: ${names.slice(0, 3).join(', ')}`);
        });
    } else {
        console.log('⚠️  No templates needed controlType update\n');
    }
    
    console.log('\n=== SUMMARY ===\n');
    console.log(`Templates updated: ${updated}`);
    console.log('\nDeterministic mapping established:');
    console.log('  controlType = guideKey (1:1 mapping)');
    
    if (updated > 0) {
        console.log('\n=== NEXT STEPS ===\n');
        console.log('1. Update template builder to require controlType');
        console.log('2. Update generator to set controlType explicitly');
        console.log('3. Delete task_instances:');
        console.log('   node public/scripts/delete-task-instances.cjs\n');
        console.log('4. Task instances will regenerate with controlType\n');
    }
    
    process.exit(0);
}

setControlTypeOnTemplates().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
