/**
 * Semantic remap of guideKeys - exact semantic meaning, no keyword matching
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

// Exact semantic mappings - one template ID to one guideKey
const SEMANTIC_MAPPINGS = {
    // Hot preparation - core temperature during cooking
    'template_hazard_hot_preparation': 'hot_preparation_core_temperature',
    
    // Cold preparation - hygiene and cross-contamination
    'template_hazard_cold_preparation': 'cold_preparation_hygiene',
    
    // Hot holding - keeping food warm
    'template_hazard_hot_holding': 'hot_holding',
    
    // Reheating - warming up previously cooked food (none in current list)
    
    // Fridge temperature
    'fridge-temp-daily': 'fridge_temperature',
    'tpl_temperature_fridge': 'fridge_temperature',
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_1__kontroller-k-leskabstemperatur': 'fridge_temperature',
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_20__daglig-temperaturkontrol-af-k-leskabe': 'fridge_temperature',
    'hazard-fejl-i-k-leopbevaring-utilstr-kkelig-temperatur-daily': 'fridge_temperature',
    'template_agg_transport_chilled': 'fridge_temperature',
    
    // Freezer temperature
    'freezer-temp-daily': 'freezer_temperature',
    'tpl_freezer_temperature': 'freezer_temperature',
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_2__kontroller-frysertemperatur': 'freezer_temperature',
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_21__daglig-temperaturkontrol-af-frysere': 'freezer_temperature',
    
    // Dishwasher control
    'template_hazard_dishwashing': 'dishwasher_control',
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_15__kontroller-opvaskemaskine-vaske--sluts': 'dishwasher_control',
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_30__temperaturkontrol-af-industriopvaskema': 'dishwasher_control',
    
    // Oven control
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_14__test-ovntemperatur-med-kalibreret-term': 'oven_control',
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_8__kontroller-ovntemperatur-og-opvarmingsp': 'oven_control'
};

async function semanticRemapGuideKeys() {
    console.log('\n=== SEMANTIC REMAP OF GUIDEKEYS ===\n');
    
    const batch = db.batch();
    let remapped = 0;
    const changes = [];
    
    for (const [templateId, newGuideKey] of Object.entries(SEMANTIC_MAPPINGS)) {
        const ref = db.collection('task_templates').doc(templateId);
        const doc = await ref.get();
        
        if (!doc.exists) {
            console.log(`⚠️  ${templateId}: NOT FOUND - skipping`);
            continue;
        }
        
        const currentData = doc.data();
        const oldGuideKey = currentData.guideKey;
        const oldControlType = currentData.controlType;
        
        // Deterministic 1:1 mapping
        const newControlType = newGuideKey;
        
        batch.update(ref, {
            guideKey: newGuideKey,
            controlType: newControlType,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        changes.push({
            id: templateId,
            title: currentData.name || currentData.title || 'N/A',
            oldGuideKey: oldGuideKey,
            newGuideKey: newGuideKey,
            oldControlType: oldControlType,
            newControlType: newControlType
        });
        
        remapped++;
    }
    
    if (remapped > 0) {
        await batch.commit();
        
        console.log(`✅ Remapped ${remapped} templates:\n`);
        
        // Group by new guideKey
        const byGuideKey = {};
        changes.forEach(change => {
            if (!byGuideKey[change.newGuideKey]) {
                byGuideKey[change.newGuideKey] = [];
            }
            byGuideKey[change.newGuideKey].push(change);
        });
        
        Object.entries(byGuideKey).forEach(([guideKey, items]) => {
            console.log(`\n📋 ${guideKey}:`);
            items.forEach(item => {
                console.log(`   ${item.title}`);
                console.log(`     ID: ${item.id}`);
                console.log(`     Old: ${item.oldGuideKey} → New: ${item.newGuideKey}\n`);
            });
        });
    } else {
        console.log('⚠️  No templates to remap\n');
    }
    
    console.log('\n=== SUMMARY ===\n');
    console.log(`Templates remapped: ${remapped}`);
    
    if (remapped > 0) {
        console.log('\n=== NEXT STEPS ===\n');
        console.log('1. Delete task_instances:');
        console.log('   node public/scripts/delete-task-instances.cjs\n');
        console.log('2. Deploy backend and frontend with new guides\n');
        console.log('3. Task instances will regenerate with correct semantic mappings\n');
    }
    
    process.exit(0);
}

semanticRemapGuideKeys().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
