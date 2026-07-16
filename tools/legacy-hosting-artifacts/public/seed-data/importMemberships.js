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
    console.log("Seeder memberships...");

    const memberships = [
        {
            id: "membership_michael_1",
            companyId: "company_demo_1",
            employeeId: "employee_michael",
            unitId: "unit_demo_1",
            locationId: "location_demo_1",
            role: "owner",
            isPrimary: true,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "membership_sara_1",
            companyId: "company_demo_1",
            employeeId: "employee_sara",
            unitId: "unit_demo_1",
            locationId: "location_demo_1",
            role: "manager",
            isPrimary: true,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "membership_jonas_1",
            companyId: "company_demo_1",
            employeeId: "employee_jonas",
            unitId: "unit_demo_1",
            locationId: "location_demo_1",
            role: "employee",
            isPrimary: true,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    for (const membership of memberships) {
        const { id, ...data } = membership;

        await db.collection("memberships")
            .doc(id)
            .set(data);

        console.log(`Oprettet membership: ${id}`);
    }

    console.log("Memberships seed færdig ✅");
}

run().catch((error) => {
    console.error("Fejl i importMemberships:", error);
});