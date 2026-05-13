# FILE: public/scripts/trigger-via-admin.cjs

```javascript
/**
 * Trigger task_instance regeneration directly via Admin SDK
 * Call the deployed Cloud Function using Firebase Admin
 */

const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'madkontrollen'
    });
}

const db = admin.firestore();

async function triggerRegeneration() {
    console.log('\n=== TRIGGERING TASK_INSTANCE REGENERATION VIA ADMIN SDK ===\n');
    
    try {
        // Get all active templates
        const templatesSnapshot = await db.collection('task_templates')
            .where('isActive', '==', true)
            .get();
        
        if (templatesSnapshot.empty) {
            console.log('⚠️  No active templates found\n');
            process.exit(0);
        }
        
        console.log(`Found ${templatesSnapshot.size} active templates\n`);
        
        // Get all locations
        const locationsSnapshot = await db.collection('locations').get();
        
        if (locationsSnapshot.empty) {
            console.log('⚠️  No locations found\n');
            process.exit(0);
        }
        
        console.log(`Found ${locationsSnapshot.size} locations\n`);
        
        // For each location, generate task instances
        let totalGenerated = 0;
        
        for (const locationDoc of locationsSnapshot.docs) {
            const locationId = locationDoc.id;
            
            // Get templates for this location
            const locationTemplates = [];
            templatesSnapshot.forEach(templateDoc => {
                const template = templateDoc.data();
                if (template.locationId === locationId) {
                    locationTemplates.push({
                        ...template,
                        templateId: templateDoc.id
                    });
                }
            });
            
            if (locationTemplates.length === 0) continue;
            
            console.log(`Location ${locationId}: ${locationTemplates.length} templates`);
            
            // Generate instances for today
            const today = new Date();
            const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            
            const batch = db.batch();
            let batchCount = 0;
            
            for (const template of locationTemplates) {
                // Check frequency
                const frequency = template.frequency;
                let shouldGenerate = false;
                
                if (frequency === 'daily' || frequency === 'twice_daily') {
                    shouldGenerate = true;
                } else if (frequency === 'weekly') {
                    shouldGenerate = today.getDay() === 1; // Monday
                } else if (frequency === 'monthly') {
                    shouldGenerate = today.getDate() === 1;
                }
                
                if (!shouldGenerate) continue;
                
                const taskInstanceId = `task_${template.templateId}__${dateKey}`;
                
                const instance = {
                    taskInstanceId,
                    templateId: template.templateId,
                    locationId: locationId,
                    controlKey: template.controlKey || null,
                    guideKey: template.guideKey || null,
                    controlType: template.controlType || null,
                    title: template.name || template.title || 'Task',
                    dateKey,
                    frequency: template.frequency,
                    taskType: template.taskType || null,
                    status: 'pending',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                };
                
                const ref = db.collection('task_instances').doc(taskInstanceId);
                batch.set(ref, instance);
                batchCount++;
                totalGenerated++;
            }
            
            if (batchCount > 0) {
                await batch.commit();
                console.log(`  Generated ${batchCount} instances`);
            }
        }
        
        console.log(`\n✅ Total generated: ${totalGenerated} task_instances\n`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

triggerRegeneration();

```
