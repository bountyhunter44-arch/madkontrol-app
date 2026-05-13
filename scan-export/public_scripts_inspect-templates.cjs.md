# FILE: public/scripts/inspect-templates.cjs

```javascript
/**
 * Inspect task_templates to identify which ones have missing/invalid guideKey
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

const VALID_GUIDE_KEYS = [
    'fridge_temperature',
    'freezer_temperature',
    'hot_holding',
    'reheating',
    'receiving_goods',
    'allergen_control',
    'cleaning_control',
    'date_check',
    'personal_hygiene_check',
    'closing_routine',
    'drain_maintenance',
    'equipment_cleaning',
    'ice_equipment',
    'fryer_control',
    'cooling_process',
    'oven_control',
    'dishwasher_control'
];

async function inspectTemplates() {
    console.log('\n=== TASK_TEMPLATES INSPECTION ===\n');
    
    const snapshot = await db.collection('task_templates')
        .get();
    
    console.log(`Total templates: ${snapshot.size}\n`);
    
    const broken = [];
    const valid = [];
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const guideKey = data.guideKey;
        
        if (!guideKey) {
            broken.push({
                id: doc.id,
                name: data.name || data.title || 'N/A',
                category: data.category || data.aggregatedCategory || 'N/A',
                guideKey: null,
                issue: 'MISSING'
            });
        } else if (!VALID_GUIDE_KEYS.includes(guideKey)) {
            broken.push({
                id: doc.id,
                name: data.name || data.title || 'N/A',
                category: data.category || data.aggregatedCategory || 'N/A',
                guideKey: guideKey,
                issue: 'INVALID'
            });
        } else {
            valid.push({
                id: doc.id,
                name: data.name || data.title || 'N/A',
                guideKey: guideKey
            });
        }
    });
    
    console.log(`✅ Valid templates: ${valid.length}`);
    console.log(`❌ Broken templates: ${broken.length}\n`);
    
    if (broken.length > 0) {
        console.log('=== BROKEN TEMPLATES ===\n');
        broken.forEach((t, i) => {
            console.log(`${i + 1}. ${t.issue}: ${t.name}`);
            console.log(`   ID: ${t.id}`);
            console.log(`   Category: ${t.category}`);
            console.log(`   GuideKey: ${t.guideKey || 'NULL'}\n`);
        });
        
        console.log('\n=== SUGGESTED FIXES ===\n');
        broken.forEach(t => {
            const category = t.category.toLowerCase();
            let suggestedGuideKey = null;
            
            // Suggest based on category
            if (category.includes('nedkøl') || category.includes('cooling')) {
                suggestedGuideKey = 'cooling_process';
            } else if (category.includes('køl') || category.includes('fridge')) {
                suggestedGuideKey = 'fridge_temperature';
            } else if (category.includes('frost') || category.includes('freez')) {
                suggestedGuideKey = 'freezer_temperature';
            } else if (category.includes('varm') || category.includes('hot')) {
                suggestedGuideKey = 'hot_holding';
            } else if (category.includes('opvarm') || category.includes('reheat')) {
                suggestedGuideKey = 'reheating';
            } else if (category.includes('modtag') || category.includes('receiv')) {
                suggestedGuideKey = 'receiving_goods';
            } else if (category.includes('allergen')) {
                suggestedGuideKey = 'allergen_control';
            } else if (category.includes('rengør') || category.includes('clean')) {
                suggestedGuideKey = 'cleaning_control';
            } else if (category.includes('afløb') || category.includes('drain')) {
                suggestedGuideKey = 'drain_maintenance';
            }
            
            console.log(`${t.id}:`);
            console.log(`  Category: "${t.category}"`);
            console.log(`  Suggested: "${suggestedGuideKey || 'UNKNOWN - MANUAL FIX NEEDED'}"\n`);
        });
    }
    
    console.log('\n=== VALID TEMPLATES (sample) ===\n');
    valid.slice(0, 5).forEach(t => {
        console.log(`✅ ${t.name} → ${t.guideKey}`);
    });
    
    process.exit(0);
}

inspectTemplates().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});

```
