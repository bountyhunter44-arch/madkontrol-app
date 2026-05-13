const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "madkontrollen"
    });
}

const db = admin.firestore();

async function deleteAndRegenerateTasks() {
    const locationId = "onboarding_aroi-d__main";
    const companyId = "onboarding_aroi-d";
    const dateKey = "2026-03-29";
    
    console.log(`\n🗑️  Deleting task_instances for ${dateKey} at ${locationId}\n`);
    
    // Delete existing task_instances
    const instancesSnapshot = await db.collection("task_instances")
        .where("locationId", "==", locationId)
        .where("dateKey", "==", dateKey)
        .get();
    
    console.log(`Found ${instancesSnapshot.size} task_instances to delete`);
    
    const batch = db.batch();
    instancesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    if (instancesSnapshot.size > 0) {
        await batch.commit();
        console.log(`✅ Deleted ${instancesSnapshot.size} task_instances\n`);
    }
    
    // Check for units
    console.log(`🔍 Checking for units at ${locationId}\n`);
    const unitsSnapshot = await db.collection("units")
        .where("locationId", "==", locationId)
        .where("isActive", "==", true)
        .get();
    
    console.log(`Found ${unitsSnapshot.size} active units`);
    if (unitsSnapshot.size > 0) {
        unitsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`  - ${data.name} (${data.type})`);
        });
    }
    console.log("");
    
    // Generate new task_instances using the generator logic
    console.log(`🚀 Generating new task_instances for ${dateKey}\n`);
    
    // Check templates
    const templatesSnapshot = await db.collection("task_templates")
        .where("locationId", "==", locationId)
        .where("isActive", "==", true)
        .get();
    
    console.log(`Found ${templatesSnapshot.size} active task_templates`);
    
    let created = 0;
    const newInstances = [];
    
    for (const templateDoc of templatesSnapshot.docs) {
        const template = { id: templateDoc.id, ...templateDoc.data() };
        const instanceId = `${template.id}__${dateKey}`;
        
        const instanceData = {
            taskTemplateId: template.id,
            taskId: template.id,
            sourceTemplateId: template.id,
            companyId: template.companyId || companyId,
            locationId: template.locationId || locationId,
            unitId: template.unitId || "",
            title: template.title || template.name || "",
            taskTitle: template.title || template.name || "",
            description: template.description || "",
            category: template.category || "",
            taskType: template.taskType || "",
            controlType: template.controlType || "",
            frequency: template.frequency || "daily",
            dateKey: dateKey,
            status: "pending",
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            generatedAt: admin.firestore.Timestamp.now()
        };
        
        await db.collection("task_instances").doc(instanceId).set(instanceData);
        created++;
        newInstances.push({
            id: instanceId,
            title: instanceData.title
        });
    }
    
    // Generate unit-based tasks
    if (unitsSnapshot.size > 0) {
        console.log(`\n🔧 Generating unit-based tasks\n`);
        
        const units = unitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        for (const unit of units) {
            const tasks = [];
            
            if (unit.type === "fridge") {
                tasks.push(
                    { key: "fridge_temperature", title: `Temperaturkontrol - ${unit.name}`, category: "temperature" },
                    { key: "fridge_cleaning", title: `Rengøring - ${unit.name}`, category: "cleaning" },
                    { key: "fridge_maintenance", title: `Vedligeholdelse - ${unit.name}`, category: "maintenance" }
                );
            }
            
            if (unit.type === "freezer") {
                tasks.push(
                    { key: "freezer_temperature", title: `Temperaturkontrol - ${unit.name}`, category: "temperature" },
                    { key: "freezer_cleaning", title: `Rengøring - ${unit.name}`, category: "cleaning" },
                    { key: "freezer_maintenance", title: `Vedligeholdelse - ${unit.name}`, category: "maintenance" }
                );
            }
            
            for (const task of tasks) {
                const instanceId = `${task.key}_${unit.id}__${dateKey}`;
                
                const instanceData = {
                    taskTemplateId: `${task.key}_${unit.id}`,
                    taskId: `${task.key}_${unit.id}`,
                    sourceTemplateId: `unit_${task.key}`,
                    companyId: companyId,
                    locationId: locationId,
                    unitId: unit.id,
                    unitName: unit.name,
                    title: task.title,
                    taskTitle: task.title,
                    description: "",
                    category: task.category,
                    taskType: task.category === "temperature" ? "measurement" : "checklist",
                    controlType: task.category === "temperature" ? "measurement" : "checklist",
                    frequency: "daily",
                    dateKey: dateKey,
                    status: "pending",
                    createdAt: admin.firestore.Timestamp.now(),
                    updatedAt: admin.firestore.Timestamp.now(),
                    generatedAt: admin.firestore.Timestamp.now()
                };
                
                await db.collection("task_instances").doc(instanceId).set(instanceData);
                created++;
                newInstances.push({
                    id: instanceId,
                    title: instanceData.title
                });
            }
        }
    }
    
    console.log(`\n✅ Generated ${created} new task_instances\n`);
    
    // Show sample titles
    console.log("📋 Sample titles (first 5):");
    newInstances.slice(0, 5).forEach(inst => {
        console.log(`  - ${inst.title}`);
    });
    
    return {
        deleted: instancesSnapshot.size,
        created: created,
        samples: newInstances.slice(0, 5)
    };
}

deleteAndRegenerateTasks()
    .then(result => {
        console.log(`\n✅ Complete!`);
        console.log(`   Deleted: ${result.deleted}`);
        console.log(`   Created: ${result.created}`);
        process.exit(0);
    })
    .catch(err => {
        console.error("❌ Error:", err);
        process.exit(1);
    });
