const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const users = [
  {
    id: "user_michael",
    companyId: "company_demo_1",
    unitId: "unit_demo_1",
    locationIds: ["location_demo_1"],
    primaryLocationId: "location_demo_1",
    name: "Michael Nielsen",
    email: "michael@madkontrollen.dk",
    phone: "12345678",
    role: "owner",
    permissions: ["all"],
    isActive: true,
    employmentType: "owner",
    hourlyRate: 0
  },
  {
    id: "user_sara",
    companyId: "company_demo_1",
    unitId: "unit_demo_1",
    locationIds: ["location_demo_1"],
    primaryLocationId: "location_demo_1",
    name: "Sara Hansen",
    email: "sara@madkontrollen.dk",
    phone: "22334455",
    role: "manager",
    permissions: ["tasks.read", "tasks.write", "alerts.read", "alerts.write"],
    isActive: true,
    employmentType: "fastløn",
    hourlyRate: 0
  },
  {
    id: "user_jonas",
    companyId: "company_demo_1",
    unitId: "unit_demo_1",
    locationIds: ["location_demo_1"],
    primaryLocationId: "location_demo_1",
    name: "Jonas Larsen",
    email: "jonas@madkontrollen.dk",
    phone: "33445566",
    role: "employee",
    permissions: ["tasks.read", "tasks.write", "alerts.read"],
    isActive: true,
    employmentType: "timeløn",
    hourlyRate: 135
  }
];

async function run() {
  try {
    console.log("Importerer users...");

    for (const user of users) {
      const { id, ...data } = user;

      await db.collection("users").doc(id).set(
        {
          ...data,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      console.log(`Oprettet/opdateret user: ${id}`);
    }

    console.log("Users færdig!");
  } catch (error) {
    console.error("Fejl ved import af users:", error);
    process.exitCode = 1;
  }
}

run();