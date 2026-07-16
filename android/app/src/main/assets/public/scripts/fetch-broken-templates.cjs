/**
 * Fetch full data for broken templates to determine correct guideKey
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

const BROKEN_IDS = [
    '3E3NVOytWM6y1Dqx1MlP',
    '57B6nucsiiptDRnSys77',
    '9fjYT3jli9k2lZxxDjLb',
    'CQDcqhaGjk1XwbJpeXxH',
    'Nut2R3kParyAydxgSoiN',
    'kWMGLFao7wfz1IqlfATN',
    'lXaD7JTzFEbApKp9yrIf',
    'template_cleaning_foodtruck_1',
    'template_freezer_foodtruck_1',
    'template_fridge_foodtruck_1',
    'template_opening_foodtruck_1',
    'yO5vsAINOZ2d45MjHdVE'
];

async function fetchBrokenTemplates() {
    console.log('\n=== BROKEN TEMPLATES FULL DATA ===\n');
    
    for (const id of BROKEN_IDS) {
        const doc = await db.collection('task_templates').doc(id).get();
        
        if (!doc.exists) {
            console.log(`❌ ${id}: NOT FOUND\n`);
            continue;
        }
        
        const data = doc.data();
        
        console.log(`📋 ${id}`);
        console.log(`   Name: ${data.name || data.title || 'N/A'}`);
        console.log(`   Description: ${data.description || 'N/A'}`);
        console.log(`   Category: ${data.category || 'N/A'}`);
        console.log(`   AggregatedCategory: ${data.aggregatedCategory || 'N/A'}`);
        console.log(`   ControlType: ${data.controlType || 'N/A'}`);
        console.log(`   TaskType: ${data.taskType || 'N/A'}`);
        console.log(`   Current GuideKey: ${data.guideKey || 'NULL'}`);
        console.log(`   TemplateType: ${data.templateType || 'N/A'}`);
        console.log(`   Frequency: ${data.frequency || 'N/A'}`);
        
        // Suggest correct guideKey based on name/description
        let suggested = null;
        const text = `${data.name || ''} ${data.description || ''} ${data.title || ''}`.toLowerCase();
        
        if (text.includes('køleskab') || text.includes('køl') || text.includes('svaleskab')) {
            suggested = 'fridge_temperature';
        } else if (text.includes('walk-in køler') || text.includes('walk-in cooler')) {
            suggested = 'fridge_temperature'; // or create walkin_cooler_temperature if needed
        } else if (text.includes('fryser') || text.includes('frost')) {
            suggested = 'freezer_temperature';
        } else if (text.includes('rengøring') || text.includes('cleaning')) {
            suggested = 'cleaning_control';
        } else if (text.includes('opening') || text.includes('åbning')) {
            suggested = 'closing_routine'; // or opening_routine if exists
        }
        
        console.log(`   ✅ SUGGESTED: ${suggested || 'UNKNOWN'}\n`);
    }
    
    process.exit(0);
}

fetchBrokenTemplates().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
