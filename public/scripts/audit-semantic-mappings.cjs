/**
 * Audit all task_templates for semantically wrong guideKey/controlType mappings
 * Based on deterministic semantic rules from title
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
    
    return null; // No semantic match
}

async function auditSemanticMappings() {
    console.log('\n=== SEMANTIC MAPPING AUDIT ===\n');
    
    const snapshot = await db.collection('task_templates').get();
    
    const wrongMappings = [];
    const correctMappings = [];
    const noSemanticMatch = [];
    
    snapshot.forEach(doc => {
        const template = doc.data();
        const title = template.name || template.title || '';
        const currentGuideKey = template.guideKey;
        const currentControlType = template.controlType;
        const expectedGuideKey = getExpectedGuideKey(title);
        
        // Check if controlType matches guideKey
        const controlTypeMatches = currentGuideKey === currentControlType;
        
        if (!expectedGuideKey) {
            noSemanticMatch.push({
                id: doc.id,
                title: title,
                currentGuideKey: currentGuideKey,
                currentControlType: currentControlType,
                controlTypeMatches: controlTypeMatches
            });
        } else if (currentGuideKey !== expectedGuideKey) {
            wrongMappings.push({
                id: doc.id,
                title: title,
                currentGuideKey: currentGuideKey,
                currentControlType: currentControlType,
                expectedGuideKey: expectedGuideKey,
                controlTypeMatches: controlTypeMatches
            });
        } else {
            correctMappings.push({
                id: doc.id,
                title: title,
                currentGuideKey: currentGuideKey,
                currentControlType: currentControlType,
                controlTypeMatches: controlTypeMatches
            });
        }
    });
    
    console.log(`Total templates: ${snapshot.size}\n`);
    console.log(`✅ Correct mappings: ${correctMappings.length}`);
    console.log(`❌ Wrong mappings: ${wrongMappings.length}`);
    console.log(`⚠️  No semantic match: ${noSemanticMatch.length}\n`);
    
    if (wrongMappings.length > 0) {
        console.log('=== WRONG MAPPINGS ===\n');
        wrongMappings.forEach((item, i) => {
            console.log(`${i + 1}. ${item.title}`);
            console.log(`   TemplateId: ${item.id}`);
            console.log(`   Current GuideKey: ${item.currentGuideKey}`);
            console.log(`   Current ControlType: ${item.currentControlType}`);
            console.log(`   Expected GuideKey: ${item.expectedGuideKey}`);
            console.log(`   ControlType matches GuideKey: ${item.controlTypeMatches ? 'YES' : 'NO'}`);
            console.log('');
        });
    }
    
    if (noSemanticMatch.length > 0) {
        console.log('\n=== NO SEMANTIC MATCH (review manually) ===\n');
        noSemanticMatch.forEach((item, i) => {
            console.log(`${i + 1}. ${item.title}`);
            console.log(`   TemplateId: ${item.id}`);
            console.log(`   Current GuideKey: ${item.currentGuideKey}`);
            console.log(`   Current ControlType: ${item.currentControlType}`);
            console.log(`   ControlType matches GuideKey: ${item.controlTypeMatches ? 'YES' : 'NO'}`);
            console.log('');
        });
    }
    
    // Check for controlType mismatches in correct mappings
    const controlTypeMismatches = correctMappings.filter(m => !m.controlTypeMatches);
    if (controlTypeMismatches.length > 0) {
        console.log('\n=== CONTROLTYPE MISMATCHES (correct guideKey but controlType ≠ guideKey) ===\n');
        controlTypeMismatches.forEach((item, i) => {
            console.log(`${i + 1}. ${item.title}`);
            console.log(`   TemplateId: ${item.id}`);
            console.log(`   GuideKey: ${item.currentGuideKey}`);
            console.log(`   ControlType: ${item.currentControlType} (should be ${item.currentGuideKey})`);
            console.log('');
        });
    }
    
    console.log('\n=== SUMMARY ===\n');
    console.log(`Templates to fix: ${wrongMappings.length + controlTypeMismatches.length}`);
    
    if (wrongMappings.length > 0 || controlTypeMismatches.length > 0) {
        console.log('\nNext step: Run fix-semantic-mappings.cjs to apply corrections\n');
    } else {
        console.log('\n✅ All templates have correct semantic mappings\n');
    }
    
    process.exit(0);
}

auditSemanticMappings().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
