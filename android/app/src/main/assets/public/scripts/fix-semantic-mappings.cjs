/**
 * Fix semantically wrong guideKey/controlType mappings
 * Apply deterministic semantic rules based on title
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

// Deterministic semantic mapping rules based on title
function getExpectedGuideKey(title) {
    const lower = title.toLowerCase();
    
    // Order matters - most specific first
    if (lower.includes('walk-in') && (lower.includes('køl') || lower.includes('køler'))) {
        return 'walkin_cooler_temperature';
    }
    if (lower.includes('modtage') || lower.includes('varemodtag') || lower.includes('levering')) {
        return 'receiving_goods';
    }
    if (lower.includes('kernetemperatur') || (lower.includes('tilberedning') && lower.includes('temperatur'))) {
        return 'hot_preparation_core_temperature';
    }
    if (lower.includes('kold tilberedning') || lower.includes('krydskontaminering')) {
        return 'cold_preparation_hygiene';
    }
    if (lower.includes('varmhold')) {
        return 'hot_holding';
    }
    if (lower.includes('opvaskemaskine') || lower.includes('slutskyl') || lower.includes('opvask')) {
        return 'dishwasher_control';
    }
    if (lower.includes('ovn')) {
        return 'oven_control';
    }
    if (lower.includes('fryser') || lower.includes('frost')) {
        return 'freezer_temperature';
    }
    if (lower.includes('placering') || lower.includes('opbevaring')) {
        return 'cold_storage_placement';
    }
    if (lower.includes('køleskab') || lower.includes('køl')) {
        return 'fridge_temperature';
    }
    if (lower.includes('rengøring') || lower.includes('renhold')) {
        return 'cleaning_control';
    }
    
    return null;
}

async function fixSemanticMappings() {
    console.log('\n=== FIXING SEMANTIC MAPPINGS ===\n');
    
    const snapshot = await db.collection('task_templates').get();
    
    const batch = db.batch();
    const fixes = [];
    
    snapshot.forEach(doc => {
        const template = doc.data();
        const title = template.name || template.title || '';
        const currentGuideKey = template.guideKey;
        const currentControlType = template.controlType;
        const expectedGuideKey = getExpectedGuideKey(title);
        
        let needsFix = false;
        let reason = '';
        
        // Check if guideKey is semantically wrong
        if (expectedGuideKey && currentGuideKey !== expectedGuideKey) {
            needsFix = true;
            reason = 'Wrong semantic mapping';
        }
        // Check if controlType doesn't match guideKey
        else if (currentGuideKey !== currentControlType) {
            needsFix = true;
            reason = 'controlType ≠ guideKey';
        }
        
        if (needsFix) {
            const newGuideKey = expectedGuideKey || currentGuideKey;
            const newControlType = newGuideKey;
            
            batch.update(doc.ref, {
                guideKey: newGuideKey,
                controlType: newControlType,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            fixes.push({
                id: doc.id,
                title: title,
                oldGuideKey: currentGuideKey,
                newGuideKey: newGuideKey,
                oldControlType: currentControlType,
                newControlType: newControlType,
                reason: reason
            });
        }
    });
    
    if (fixes.length > 0) {
        await batch.commit();
        
        console.log(`✅ Fixed ${fixes.length} templates:\n`);
        
        fixes.forEach((fix, i) => {
            console.log(`${i + 1}. ${fix.title}`);
            console.log(`   TemplateId: ${fix.id}`);
            console.log(`   Reason: ${fix.reason}`);
            console.log(`   GuideKey: ${fix.oldGuideKey} → ${fix.newGuideKey}`);
            console.log(`   ControlType: ${fix.oldControlType} → ${fix.newControlType}`);
            console.log('');
        });
        
        console.log('\n=== NEXT STEPS ===\n');
        console.log('1. Delete task_instances:');
        console.log('   node public/scripts/delete-task-instances.cjs\n');
        console.log('2. Regenerate task_instances:');
        console.log('   node public/scripts/trigger-via-admin.cjs\n');
        console.log('3. Verify UI rendering:');
        console.log('   node public/scripts/verify-actual-guides.cjs\n');
    } else {
        console.log('✅ No fixes needed - all mappings are correct\n');
    }
    
    process.exit(0);
}

fixSemanticMappings().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
