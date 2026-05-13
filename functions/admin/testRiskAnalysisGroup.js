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

    const snap = await db.collectionGroup("risk_analyses").get();

    console.log("Antal risk_analyses fundet:", snap.size);

    snap.forEach((doc) => {
        console.log("PATH:", doc.ref.path);
        console.log(JSON.stringify(doc.data(), null, 2));
        console.log("");
    });

}

run().catch(console.error);