const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function run() {
    console.log("Seeder units...");

    const units = [
        {
            id: "unit_demo_1",
            companyId: "company_demo_1",
            name: "Restaurant Hvidovre",
            type: "restaurant",
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    for (const unit of units) {
        const { id, ...data } = unit;

        await db.collection("units")
            .doc(id)
            .set(data);

        console.log(`Oprettet unit: ${id}`);
    }

    console.log("Units seed færdig ✅");
}

run().catch((error) => {
    console.error("Fejl i importUnits:", error);
});