/**
 * Verify remaining non-active guide types exist in templates
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
const { getGuideByKey } = require('../../functions/guideLibrary');

const REMAINING_GUIDE_TYPES = [
    'hot_preparation_core_temperature',
    'cold_preparation_hygiene',
    'hot_holding',
    'dishwasher_control',
    'oven_control'
];

async function verifyRemainingGuides() {
    console.log('\n=== VERIFYING REMAINING NON-ACTIVE GUIDE TYPES ===\n');
    
    const templatesSnapshot = await db.collection('task_templates').get();
    
    const results = {};
    
    REMAINING_GUIDE_TYPES.forEach(guideKey => {
        results[guideKey] = [];
    });
    
    templatesSnapshot.forEach(doc => {
        const template = doc.data();
        const guideKey = template.guideKey;
        
        if (REMAINING_GUIDE_TYPES.includes(guideKey)) {
            results[guideKey].push({
                templateId: doc.id,
                title: template.name || template.title || 'N/A',
                guideKey: template.guideKey,
                controlType: template.controlType,
                isActive: template.isActive,
                locationId: template.locationId || 'N/A'
            });
        }
    });
    
    console.log('=== TEMPLATES BY GUIDE TYPE ===\n');
    
    REMAINING_GUIDE_TYPES.forEach(guideKey => {
        const templates = results[guideKey];
        const guide = getGuideByKey(guideKey);
        const guideTitle = guide ? guide.title : 'GUIDE NOT FOUND';
        
        console.log(`\n📋 ${guideKey}: ${templates.length} templates`);
        console.log(`   Expected Guide: "${guideTitle}"`);
        
        if (templates.length > 0) {
            console.log(`   Templates:`);
            templates.forEach(t => {
                console.log(`     - ${t.templateId}`);
                console.log(`       Title: ${t.title}`);
                console.log(`       GuideKey: ${t.guideKey}`);
                console.log(`       ControlType: ${t.controlType}`);
                console.log(`       IsActive: ${t.isActive}`);
                console.log(`       LocationId: ${t.locationId}`);
                
                // Verify guide renders correctly
                if (t.guideKey === t.controlType) {
                    console.log(`       ✅ Deterministic mapping (guideKey = controlType)`);
                } else {
                    console.log(`       ❌ MISMATCH: guideKey ≠ controlType`);
                }
                
                const templateGuide = getGuideByKey(t.guideKey);
                if (templateGuide) {
                    console.log(`       ✅ Renders: "${templateGuide.title}"`);
                } else {
                    console.log(`       ❌ Guide not found for key: ${t.guideKey}`);
                }
                console.log('');
            });
        } else {
            console.log(`   ⚠️  NO TEMPLATES FOUND`);
        }
    });
    
    console.log('\n=== SUMMARY ===\n');
    
    let allCorrect = true;
    
    REMAINING_GUIDE_TYPES.forEach(guideKey => {
        const templates = results[guideKey];
        const guide = getGuideByKey(guideKey);
        
        if (!guide) {
            console.log(`❌ ${guideKey}: Guide definition missing`);
            allCorrect = false;
        } else if (templates.length === 0) {
            console.log(`⚠️  ${guideKey}: No templates use this guide`);
        } else {
            const allMatch = templates.every(t => t.guideKey === t.controlType);
            if (allMatch) {
                console.log(`✅ ${guideKey}: ${templates.length} templates, all correct`);
            } else {
                console.log(`❌ ${guideKey}: ${templates.length} templates, some have mismatches`);
                allCorrect = false;
            }
        }
    });
    
    if (allCorrect) {
        console.log('\n✅ ALL REMAINING GUIDE TYPES ARE CORRECTLY CONFIGURED\n');
    } else {
        console.log('\n❌ SOME GUIDE TYPES HAVE ISSUES\n');
    }
    
    process.exit(0);
}

verifyRemainingGuides().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
