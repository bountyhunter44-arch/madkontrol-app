/**
 * Refine guideKeys for existing templates based on name/description
 * Split generic fridge_temperature into specific equipment types
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

async function refineGuideKeys() {
    console.log('\n=== REFINING GUIDEKEYS FOR PRECISION ===\n');
    
    const snapshot = await db.collection('task_templates').get();
    
    const batch = db.batch();
    let refined = 0;
    const changes = [];
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const currentGuideKey = data.guideKey;
        
        // Only refine if currently using generic fridge_temperature
        if (currentGuideKey !== 'fridge_temperature') {
            return;
        }
        
        const name = (data.name || data.title || '').toLowerCase();
        const description = (data.description || '').toLowerCase();
        const text = `${name} ${description}`;
        
        let newGuideKey = null;
        let reason = '';
        
        // Check for walk-in cooler
        if (text.includes('walk-in') || text.includes('walkin') || text.includes('walk in')) {
            newGuideKey = 'walkin_cooler_temperature';
            reason = 'Contains "walk-in"';
        }
        // Check for cold storage placement
        else if (text.includes('placering') || text.includes('placement') || 
                 text.includes('opbevaring') && !text.includes('temperatur')) {
            newGuideKey = 'cold_storage_placement';
            reason = 'Contains "placering/placement"';
        }
        // Keep as fridge_temperature for standard fridges
        else {
            // No change needed
            return;
        }
        
        if (newGuideKey && newGuideKey !== currentGuideKey) {
            batch.update(doc.ref, {
                guideKey: newGuideKey,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            changes.push({
                id: doc.id,
                name: data.name || data.title || 'N/A',
                oldGuideKey: currentGuideKey,
                newGuideKey: newGuideKey,
                reason: reason
            });
            
            refined++;
        }
    });
    
    if (refined > 0) {
        await batch.commit();
        
        console.log(`✅ Refined ${refined} templates:\n`);
        changes.forEach(change => {
            console.log(`📋 ${change.name}`);
            console.log(`   ID: ${change.id}`);
            console.log(`   Old: ${change.oldGuideKey}`);
            console.log(`   New: ${change.newGuideKey}`);
            console.log(`   Reason: ${change.reason}\n`);
        });
    } else {
        console.log('⚠️  No templates needed refinement\n');
    }
    
    console.log('\n=== SUMMARY ===\n');
    console.log(`Templates refined: ${refined}`);
    
    if (refined > 0) {
        console.log('\n=== NEXT STEPS ===\n');
        console.log('1. Delete task_instances:');
        console.log('   node public/scripts/delete-task-instances.cjs\n');
        console.log('2. Task instances will regenerate with refined guideKeys\n');
        console.log('3. Verify in browser:\n');
        console.log('   - Walk-in tasks show walk-in guide');
        console.log('   - Placement tasks show placement guide');
        console.log('   - Standard fridge tasks show fridge guide\n');
    }
    
    process.exit(0);
}

refineGuideKeys().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
