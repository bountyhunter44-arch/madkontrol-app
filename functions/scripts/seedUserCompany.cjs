// SLET FRA HER

const admin = require("firebase-admin");
const serviceAccount = require("../../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔥 SÆT DIN UID HER
const USER_ID = "GgIT0dJu3mP5BVSKjwuygdrf1Oy1";

// 🔥 OPRET NY COMPANY + LOCATION
async function seedUser() {
  try {
    console.log("Starter seed...");

    // 1. Opret company
    const companyRef = db.collection("companies").doc();
    const companyId = companyRef.id;

    await companyRef.set({
      id: companyId,
      name: "Demo Restaurant",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. Opret location
    const locationRef = db.collection("locations").doc();
    const locationId = locationRef.id;

    await locationRef.set({
      id: locationId,
      companyId: companyId,
      name: "Hovedlokation",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 3. Opdater user
    await db.collection("users").doc(USER_ID).set({
      companyId: companyId,
      locationId: locationId,
      locationIds: [locationId],
      organizationId: companyId,
      primaryLocationId: locationId,
      onboardingCompleted: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log("✅ FÆRDIG!");
    console.log("companyId:", companyId);
    console.log("locationId:", locationId);

  } catch (err) {
    console.error("FEJL:", err);
  }
}

seedUser();

// TIL HER