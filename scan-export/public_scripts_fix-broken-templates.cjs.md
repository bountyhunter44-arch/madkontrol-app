# FILE: public/scripts/fix-broken-templates.cjs

```javascript
/**
 * Fix broken task_templates with correct guideKey
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

// Manual mapping based on inspection results
const FIXES = {
    // Fridge/cooler templates
    '3E3NVOytWM6y1Dqx1MlP': { guideKey: 'fridge_temperature', name: 'Køleskab temperatur' },
    '57B6nucsiiptDRnSys77': { guideKey: 'fridge_temperature', name: 'Walk-in køler' },
    'CQDcqhaGjk1XwbJpeXxH': { guideKey: 'fridge_temperature', name: 'Walk-in køler' },
    'Nut2R3kParyAydxgSoiN': { guideKey: 'fridge_temperature', name: 'Svaleskab temperatur' },
    'kWMGLFao7wfz1IqlfATN': { guideKey: 'fridge_temperature', name: 'Køleskab' },
    'yO5vsAINOZ2d45MjHdVE': { guideKey: 'fridge_temperature', name: 'Køleskab' },
    
    // Freezer template
    '9fjYT3jli9k2lZxxDjLb': { guideKey: 'freezer_temperature', name: 'Fryser' },
    
    // Cleaning template
    'lXaD7JTzFEbApKp9yrIf': { guideKey: 'cleaning_control', name: 'Rengøring mellem arbejdsgange' },
    
    // Foodtruck templates - infer from ID
    'template_cleaning_foodtruck_1': { guideKey: 'cleaning_control', name: 'Foodtruck rengøring' },
    'template_freezer_foodtruck_1': { guideKey: 'freezer_temperature', name: 'Foodtruck fryser' },
    'template_fridge_foodtruck_1': { guideKey: 'fridge_temperature', name: 'Foodtruck køleskab' },
    'template_opening_foodtruck_1': { guideKey: 'closing_routine', name: 'Foodtruck åbningsrutine' }
};

async function fixBrokenTemplates() {
    console.log('\n=== FIXING BROKEN TEMPLATES ===\n');
    
    const batch = db.batch();
    let fixed = 0;
    
    for (const [id, fix] of Object.entries(FIXES)) {
        const ref = db.collection('task_templates').doc(id);
        const doc = await ref.get();
        
        if (!doc.exists) {
            console.log(`⚠️  ${id}: NOT FOUND - skipping`);
            continue;
        }
        
        const currentData = doc.data();
        
        batch.update(ref, {
            guideKey: fix.guideKey,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ ${id}`);
        console.log(`   Name: ${fix.name}`);
        console.log(`   Old GuideKey: ${currentData.guideKey || 'NULL'}`);
        console.log(`   New GuideKey: ${fix.guideKey}\n`);
        
        fixed++;
    }
    
    if (fixed > 0) {
        await batch.commit();
        console.log(`\n✅ Fixed ${fixed} templates\n`);
    } else {
        console.log('\n⚠️  No templates to fix\n');
    }
    
    console.log('=== NEXT STEPS ===\n');
    console.log('1. Delete task_instances:');
    console.log('   node public/scripts/delete-task-instances.cjs\n');
    console.log('2. Task instances will regenerate automatically from fixed templates\n');
    console.log('3. Verify in browser that guides render correctly\n');
    
    process.exit(0);
}

fixBrokenTemplates().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

```
