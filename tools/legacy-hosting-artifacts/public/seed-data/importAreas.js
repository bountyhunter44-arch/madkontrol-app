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
    console.log("Seeder areas...");

    const areas = [
        {
            id: "area_receiving_1",
            name: "Modtageareal",
            areaType: "receiving_area",
            category: "receiving"
        },
        {
            id: "area_cooler_1",
            name: "Walk-in køl",
            areaType: "walk_in_cooler",
            category: "storage"
        },
        {
            id: "area_freezer_1",
            name: "Walk-in frost",
            areaType: "walk_in_freezer",
            category: "storage"
        },
        {
            id: "area_vegetable_1",
            name: "Grøntsagsrum",
            areaType: "vegetable_room",
            category: "prep"
        },
        {
            id: "area_cold_prod_1",
            name: "Kold produktion",
            areaType: "cold_production",
            category: "production"
        },
        {
            id: "area_hot_prod_1",
            name: "Varm produktion",
            areaType: "hot_production",
            category: "production"
        },
        {
            id: "area_dishwash_1",
            name: "Opvask",
            areaType: "dishwashing",
            category: "cleaning"
        },
        {
            id: "area_dry_1",
            name: "Tørvarelager",
            areaType: "dry_storage",
            category: "storage"
        },
        {
            id: "area_waste_1",
            name: "Affaldsområde",
            areaType: "waste_area",
            category: "waste"
        },
        {
            id: "area_toilet_1",
            name: "Toilet",
            areaType: "toilet",
            category: "hygiene"
        },
        {
            id: "area_handwash_1",
            name: "Håndvask",
            areaType: "handwash_station",
            category: "hygiene"
        }
    ];

    for (const area of areas) {
        const { id, ...data } = area;

        await db.collection("areas")
            .doc(id)
            .set({
                companyId: "company_demo_1",
                unitId: "unit_demo_1",
                locationId: "location_demo_1",
                ...data,
                status: "active",
                createdAt: new Date(),
                updatedAt: new Date()
            });

        console.log(`Oprettet area: ${id}`);
    }

    console.log("Areas seed færdig ✅");
}

run().catch((error) => {
    console.error("Fejl i importAreas:", error);
});