# FILE: functions/admin/listCollections.js

```javascript
const admin = require("firebase-admin");
const path = require("path");

if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
}

const db = admin.firestore();

async function run() {
    const collections = await db.listCollections();

    console.log("Top-level collections:", collections.length);

    for (const collection of collections) {
        console.log(`\n=== ${collection.id} ===`);

        const snap = await collection.limit(5).get();
        console.log(`Antal eksempel-docs hentet: ${snap.size}`);

        snap.forEach((doc) => {
            console.log(`- DOC ID: ${doc.id}`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    }
}

run().catch((error) => {
    console.error("Fejl:", error);
    process.exit(1);
});
```
