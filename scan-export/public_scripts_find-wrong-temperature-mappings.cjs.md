# FILE: public/scripts/find-wrong-temperature-mappings.cjs

```javascript
/**
 * Find all temperature-related templates with wrong cleaning_control guideKey
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

async function findWrongTemperatureMappings() {
    console.log('\n=== FINDING WRONG TEMPERATURE MAPPINGS ===\n');
    
    const snapshot = await db.collection('task_templates').get();
    
    const wrongMappings = [];
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const title = (data.name || data.title || '').toLowerCase();
        const guideKey = data.guideKey;
        const controlType = data.controlType;
        
        // Check if temperature-related but has cleaning_control
        const isTemperatureRelated = 
            title.includes('temperatur') ||
            title.includes('kernetemperatur') ||
            title.includes('tilberedning') ||
            title.includes('opvarmning') ||
            title.includes('varmholdelse') ||
            title.includes('genopvarmning');
        
        const hasWrongGuide = 
            guideKey === 'cleaning_control' || 
            controlType === 'cleaning_control';
        
        if (isTemperatureRelated && hasWrongGuide) {
            wrongMappings.push({
                id: doc.id,
                title: data.name || data.title || 'N/A',
                guideKey: guideKey,
                controlType: controlType,
                description: data.description || 'N/A'
            });
        }
    });
    
    if (wrongMappings.length === 0) {
        console.log('✅ No wrong temperature mappings found\n');
        process.exit(0);
    }
    
    console.log(`❌ Found ${wrongMappings.length} wrong temperature mappings:\n`);
    
    wrongMappings.forEach((mapping, i) => {
        console.log(`${i + 1}. ${mapping.title}`);
        console.log(`   TemplateId: ${mapping.id}`);
        console.log(`   GuideKey: ${mapping.guideKey}`);
        console.log(`   ControlType: ${mapping.controlType}`);
        console.log(`   Description: ${mapping.description}\n`);
    });
    
    console.log('\n=== SUGGESTED FIXES ===\n');
    
    wrongMappings.forEach(mapping => {
        const title = mapping.title.toLowerCase();
        let suggestedGuideKey = null;
        
        if (title.includes('kernetemperatur') || title.includes('tilberedning')) {
            suggestedGuideKey = 'reheating';
        } else if (title.includes('varmholdelse')) {
            suggestedGuideKey = 'hot_holding';
        } else if (title.includes('opvarmning') || title.includes('genopvarmning')) {
            suggestedGuideKey = 'reheating';
        } else if (title.includes('køleskab') || title.includes('køl')) {
            suggestedGuideKey = 'fridge_temperature';
        } else if (title.includes('fryser') || title.includes('frost')) {
            suggestedGuideKey = 'freezer_temperature';
        } else if (title.includes('temperatur')) {
            // Generic temperature - need more context
            suggestedGuideKey = 'NEEDS_MANUAL_REVIEW';
        }
        
        console.log(`${mapping.id}:`);
        console.log(`  Title: "${mapping.title}"`);
        console.log(`  Current: ${mapping.guideKey}`);
        console.log(`  Suggested: ${suggestedGuideKey}\n`);
    });
    
    process.exit(0);
}

findWrongTemperatureMappings().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

```
