const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db   = admin.firestore();
const auth = admin.auth();

const TARGET_EMAIL = "supawan@aroid.dk";

(async () => {
  try {
    const userRecord = await auth.getUserByEmail(TARGET_EMAIL);
    const uid = userRecord.uid;
    console.log("Found uid:", uid);

    const snap = await db.collection("users").doc(uid).get();
    if (snap.exists) {
      console.log("Eksisterende user doc:", JSON.stringify(snap.data(), null, 2));
    } else {
      console.log("Ingen user doc endnu — opretter.");
    }

    const companyId  = "onboarding_aroi-d";
    const locationId = "onboarding_aroi-d__main";

    await db.collection("users").doc(uid).set({
      email:             TARGET_EMAIL,
      companyId,
      organizationId:    companyId,
      locationIds:       [locationId],
      primaryLocationId: locationId,
      role:              "owner",
      isActive:          true,
    }, { merge: true });

    console.log(`✅ ${TARGET_EMAIL} opdateret: role=owner, companyId=${companyId}, locationId=${locationId}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Fejl:", err.message);
    process.exit(1);
  }
})();
