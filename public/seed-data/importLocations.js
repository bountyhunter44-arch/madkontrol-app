const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const locations = [
  {
    id: "location_demo_1",
    companyId: "company_demo_1",
    unitId: "unit_demo_1",
    name: "Restaurant Hvidovre",
    locationType: "restaurant",
    address: "Eksempelvej 10",
    postalCode: "2650",
    city: "Hvidovre",
    country: "Danmark",
    phone: "12345678",
    email: "restaurant@madkontrollen.dk",
    isActive: true
  },
  {
    id: "location_foodtruck_1",
    companyId: "company_demo_1",
    unitId: "unit_demo_1",
    name: "Foodtruck",
    locationType: "foodtruck",
    address: "Mobil enhed",
    postalCode: "2650",
    city: "Hvidovre",
    country: "Danmark",
    phone: "12345679",
    email: "truck@madkontrollen.dk",
    isActive: true
  },
  {
    id: "location_production_1",
    companyId: "company_demo_1",
    unitId: "unit_demo_1",
    name: "Produktionskøkken",
    locationType: "production",
    address: "Industrivej 5",
    postalCode: "2650",
    city: "Hvidovre",
    country: "Danmark",
    phone: "12345680",
    email: "produktion@madkontrollen.dk",
    isActive: true
  }
];

async function run() {
  try {
    console.log("Importerer locations...");

    for (const location of locations) {
      const { id, ...data } = location;

      await db.collection("locations").doc(id).set(
        {
          ...data,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      console.log(`Oprettet/opdateret location: ${id}`);
    }

    console.log("Locations færdig!");
  } catch (error) {
    console.error("Fejl ved import af locations:", error);
    process.exitCode = 1;
  }
}

run();