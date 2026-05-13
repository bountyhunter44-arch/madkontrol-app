# FILE: public/scripts/fix-temperature-guidekeys.cjs

```javascript
/**
 * Fix wrong temperature-related guideKey mappings
 * ONLY fix concrete wrong mappings - no broad changes
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

// Exact mappings based on found issues
const EXACT_FIXES = {
    // Core temperature / preparation
    'template_hazard_hot_preparation': { guideKey: 'reheating', reason: 'Kernetemperaturkontrol ved tilberedning' },
    'template_hazard_cold_preparation': { guideKey: 'reheating', reason: 'Krydskontaminering ved kold tilberedning' },
    
    // Hot holding
    'template_hazard_hot_holding': { guideKey: 'hot_holding', reason: 'Temperaturkontrol ved varmholdelse' },
    
    // Fridge temperature
    'fridge-temp-daily': { guideKey: 'fridge_temperature', reason: 'Temperaturkontrol af køleskab' },
    'tpl_temperature_fridge': { guideKey: 'fridge_temperature', reason: 'Temperaturkontrol køleskab' },
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_1__kontroller-k-leskabstemperatur': { guideKey: 'fridge_temperature', reason: 'Kontrollér køleskabstemperatur' },
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_20__daglig-temperaturkontrol-af-k-leskabe': { guideKey: 'fridge_temperature', reason: 'Daglig temperaturkontrol af køleskabe' },
    'hazard-fejl-i-k-leopbevaring-utilstr-kkelig-temperatur-daily': { guideKey: 'fridge_temperature', reason: 'Kontrol: Fejl i køleopbevaring' },
    'template_agg_transport_chilled': { guideKey: 'fridge_temperature', reason: 'Temperaturkontrol ved køletransport' },
    
    // Freezer temperature
    'freezer-temp-daily': { guideKey: 'freezer_temperature', reason: 'Temperaturkontrol af fryser' },
    'tpl_freezer_temperature': { guideKey: 'freezer_temperature', reason: 'Temperaturkontrol fryser' },
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_2__kontroller-frysertemperatur': { guideKey: 'freezer_temperature', reason: 'Kontrollér frysertemperatur' },
    'onboarding_aroi-d-hotel-rnh-j__onboarding_aroi-d-hotel-rnh-j__main__auto_task_21__daglig-temperaturkontrol-af-frysere': { guideKey: 'freezer_temperature', reason: 'Daglig temperaturkontrol af frysere' }
};

async function fixTemperatureGuideKeys() {
    console.log('\n=== FIXING TEMPERATURE GUIDEKEYS ===\n');
    
    const batch = db.batch();
    let fixed = 0;
    const updates = [];
    
    for (const [templateId, fix] of Object.entries(EXACT_FIXES)) {
        const ref = db.collection('task_templates').doc(templateId);
        const doc = await ref.get();
        
        if (!doc.exists) {
            console.log(`⚠️  ${templateId}: NOT FOUND - skipping`);
            continue;
        }
        
        const currentData = doc.data();
        const newGuideKey = fix.guideKey;
        const newControlType = fix.guideKey; // Deterministic 1:1 mapping
        
        batch.update(ref, {
            guideKey: newGuideKey,
            controlType: newControlType,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        updates.push({
            id: templateId,
            title: currentData.name || currentData.title || 'N/A',
            oldGuideKey: currentData.guideKey,
            oldControlType: currentData.controlType,
            newGuideKey: newGuideKey,
            newControlType: newControlType,
            reason: fix.reason
        });
        
        fixed++;
    }
    
    if (fixed > 0) {
        await batch.commit();
        
        console.log(`✅ Fixed ${fixed} templates:\n`);
        
        updates.forEach(update => {
            console.log(`📋 ${update.title}`);
            console.log(`   ID: ${update.id}`);
            console.log(`   Reason: ${update.reason}`);
            console.log(`   Old GuideKey: ${update.oldGuideKey}`);
            console.log(`   New GuideKey: ${update.newGuideKey}`);
            console.log(`   Old ControlType: ${update.oldControlType}`);
            console.log(`   New ControlType: ${update.newControlType}\n`);
        });
    } else {
        console.log('⚠️  No templates to fix\n');
    }
    
    console.log('\n=== SUMMARY ===\n');
    console.log(`Templates fixed: ${fixed}`);
    
    if (fixed > 0) {
        console.log('\n=== NEXT STEPS ===\n');
        console.log('1. Delete task_instances:');
        console.log('   node public/scripts/delete-task-instances.cjs\n');
        console.log('2. Task instances will regenerate with correct guideKeys\n');
        console.log('3. Verify in browser:');
        console.log('   - "Kernetemperaturkontrol ved tilberedning" shows "Genopvarmning" guide');
        console.log('   - NOT "Rengøringskontrol"\n');
    }
    
    process.exit(0);
}

fixTemperatureGuideKeys().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

```
