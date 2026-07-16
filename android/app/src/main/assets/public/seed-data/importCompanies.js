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

  console.log("Seeder companies...");

  const companies = [
    {
      id: "company_demo_1",
      name: "Madkontrollen Demo ApS",
      cvr: "12345678",
      email: "kontakt@madkontrollen.dk",
      phone: "12345678",
      industryType: "restaurant",
      status: "active",
      ownerUserId: "user_michael",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const company of companies) {

    const { id, ...data } = company;

    await db.collection("companies")
      .doc(id)
      .set(data);

    console.log(`Oprettet company: ${id}`);
  }

  console.log("Companies seed færdig ✅");
}

run().catch((error) => {
  console.error("Fejl i importCompanies:", error);
});