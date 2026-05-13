/**
 * Trigger task_instance regeneration NOW via Firebase Admin SDK
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

// Import the task generator
const { generateTaskInstances } = require('../../functions/egenkontrol/generators/taskGenerator');

async function triggerRegeneration() {
    console.log('\n=== TRIGGERING TASK_INSTANCE REGENERATION ===\n');
    
    // Get all active templates
    const templatesSnapshot = await db.collection('task_templates')
        .where('isActive', '==', true)
        .get();
    
    if (templatesSnapshot.empty) {
        console.log('⚠️  No active templates found\n');
        process.exit(0);
    }
    
    const templates = [];
    templatesSnapshot.forEach(doc => {
        templates.push({
            ...doc.data(),
            templateId: doc.id
        });
    });
    
    console.log(`Found ${templates.length} active templates\n`);
    
    // Generate task instances for today
    const today = new Date();
    const instances = generateTaskInstances(templates, today);
    
    console.log(`Generated ${instances.length} task instances\n`);
    
    // Write to Firestore
    const batch = db.batch();
    let written = 0;
    
    instances.forEach(instance => {
        const ref = db.collection('task_instances').doc(instance.taskInstanceId);
        batch.set(ref, instance);
        written++;
    });
    
    await batch.commit();
    
    console.log(`✅ Written ${written} task instances to Firestore\n`);
    
    // Sample by guideKey
    const byGuideKey = {};
    instances.forEach(instance => {
        const key = instance.guideKey || 'NULL';
        if (!byGuideKey[key]) {
            byGuideKey[key] = [];
        }
        byGuideKey[key].push(instance);
    });
    
    console.log('\n=== INSTANCES BY GUIDEKEY ===\n');
    Object.entries(byGuideKey).forEach(([guideKey, items]) => {
        console.log(`${guideKey}: ${items.length} instances`);
    });
    
    console.log('\n✅ REGENERATION COMPLETE\n');
    
    process.exit(0);
}

triggerRegeneration().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
