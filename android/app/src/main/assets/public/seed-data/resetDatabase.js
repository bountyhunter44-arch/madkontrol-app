const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// CRITICAL SECURITY CHECK: Prevent running in production
const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || serviceAccount.project_id;
const productionProjects = ['madkontrollen', 'madkontrollen-prod', 'madkontrollen-production'];

if (productionProjects.includes(projectId)) {
    console.error('');
    console.error('🚫🚫🚫 CRITICAL ERROR 🚫🚫🚫');
    console.error('');
    console.error('This script is attempting to run in PRODUCTION!');
    console.error(`Project ID: ${projectId}`);
    console.error('');
    console.error('Database reset is NEVER allowed in production.');
    console.error('This operation has been BLOCKED.');
    console.error('');
    process.exit(1);
}

console.log('⚠️  DEVELOPMENT MODE DETECTED');
console.log(`   Project: ${projectId}`);
console.log('   Reset operations are allowed in development only');
console.log('');

const COLLECTIONS_TO_CLEAR = [
    "company_requirements",
    "risk_analysis_items",
    "control_points",
    "task_instances",
    "task_entries",
    "alerts",
    "areas",
    "memberships",
    "activity_profiles",
    "users",
    "locations",
    "units",
    "companies",
    "requirement_templates",
    "risk_templates",
    "control_point_templates",
    "tasks"
];

async function deleteCollection(collectionName, batchSize = 100) {
    let totalDeleted = 0;

    while (true) {
        const snapshot = await db
            .collection(collectionName)
            .limit(batchSize)
            .get();

        if (snapshot.empty) {
            break;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        totalDeleted += snapshot.size;
        console.log(`Slettet ${snapshot.size} dokumenter fra ${collectionName}`);
    }

    if (totalDeleted > 0) {
        console.log(`Total slettet fra ${collectionName}: ${totalDeleted}`);
    } else {
        console.log(`Ingen dokumenter i ${collectionName}`);
    }

    return totalDeleted;
}

async function run() {
    try {
        console.log("Starter reset af database...");
        let grandTotal = 0;

        for (const collectionName of COLLECTIONS_TO_CLEAR) {
            const deleted = await deleteCollection(collectionName);
            grandTotal += deleted;
        }

        console.log(`\nDatabase reset færdig ✅`);
        console.log(`Samlet slettet: ${grandTotal} dokumenter`);
        process.exit(0);
    } catch (error) {
        console.error("Fejl i resetDatabase:", error);
        process.exitCode = 1;
    }
}

run();