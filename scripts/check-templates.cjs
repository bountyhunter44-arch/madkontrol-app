const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function checkTemplates() {
    const locationId = "onboarding_aroi-d__main";
    
    console.log(`\n🔍 Checking task_templates for locationId: ${locationId}\n`);
    
    const snapshot = await db.collection("task_templates")
        .where("locationId", "==", locationId)
        .where("isActive", "==", true)
        .get();
    
    console.log(`Found ${snapshot.size} active task_templates\n`);
    
    if (snapshot.size > 0) {
        console.log("Sample templates:");
        snapshot.docs.slice(0, 5).forEach(doc => {
            const data = doc.data();
            console.log(`- ${doc.id}`);
            console.log(`  Title: ${data.title || data.name}`);
            console.log(`  Category: ${data.category}`);
            console.log(`  Frequency: ${data.frequency}\n`);
        });
    }
    
    return snapshot.size;
}

checkTemplates()
    .then(count => {
        console.log(`✅ Total templates: ${count}`);
        process.exit(0);
    })
    .catch(err => {
        console.error("❌ Error:", err);
        process.exit(1);
    });
