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

    console.log("Seeder activity profiles...");

    const profiles = [
        {
            id: "activity_profile_1",
            companyId: "company_demo_1",
            unitId: "unit_demo_1",
            locationId: "location_demo_1",

            industryType: "restaurant",

            usesRawFish: false,
            usesFreshFish: true,
            usesRawMeat: true,
            usesMincedMeat: true,
            usesPoultry: true,

            doesCooling: true,
            doesReheating: true,
            doesHotHolding: true,
            doesFreezeFishForParasites: false,

            hasWalkInCooler: true,
            hasWalkInFreezer: true,
            hasVegetablePrep: true,
            hasOpenProduction: true,

            mobileUnit: false,
            servesHighRiskGroups: false,

            internalRiskScore: 78,
            internalRiskLevel: "high",
            recommendedRoutineFrequency: "daily_enhanced",

            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    for (const profile of profiles) {

        const { id, ...data } = profile;

        await db.collection("activity_profiles")
            .doc(id)
            .set(data);

        console.log(`Oprettet activity profile: ${id}`);
    }

    console.log("Activity profiles seed færdig ✅");

}

run().catch((error) => {
    console.error("Fejl i importActivityProfiles:", error);
});