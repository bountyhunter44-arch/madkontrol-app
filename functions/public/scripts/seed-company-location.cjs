const admin = require("firebase-admin");
const path = require("path");

// === INIT FIREBASE ADMIN ===
const serviceAccount = require(path.resolve(__dirname, "../../serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// === KORREKTE VÆRDIER ===
const companyId = "onboarding_cafe-victoria-v-ali-fallah";
const locationId = "onboarding_cafe-victoria-v-ali-fallah_main";
// ==========================

async function seedCompanyAndLocation() {
  console.log("🌱 Starter seed...");

  const companyRef = db.collection("companies").doc(companyId);
  const locationRef = companyRef.collection("locations").doc(locationId);

  const companySnap = await companyRef.get();
  const locationSnap = await locationRef.get();

  // === COMPANY ===
  if (!companySnap.exists) {
    console.log("➕ Opretter company...");

    await companyRef.set({
      companyId,
      name: "Cafe Victoria v/ Ali Fallah",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Company oprettet");
  } else {
    console.log("ℹ️ Company findes allerede");
  }

  // === LOCATION ===
  if (!locationSnap.exists) {
    console.log("➕ Opretter location...");

    await locationRef.set({
      locationId,
      companyId,
      name: "Hovedlocation",
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Location oprettet");
  } else {
    console.log("ℹ️ Location findes allerede");
  }

  console.log("🎉 Seed færdig");
}

// === RUN ===
seedCompanyAndLocation()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ FEJL:", err);
    process.exit(1);
  });