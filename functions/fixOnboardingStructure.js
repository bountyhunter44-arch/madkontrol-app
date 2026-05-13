const admin = require("firebase-admin");
const functions = require("firebase-functions");

// Safe initialization
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Ensures company and location documents exist for onboarding_aroi-d
 */
async function ensureOnboardingStructure() {
  const companyId = "onboarding_aroi-d";
  const locationId = "onboarding_aroi-d__main";

  console.log("=== ENSURING ONBOARDING STRUCTURE ===");
  console.log("companyId:", companyId);
  console.log("locationId:", locationId);

  const companyRef = db.collection("companies").doc(companyId);
  const locationRef = companyRef.collection("locations").doc(locationId);

  // Check and create company doc
  const companySnap = await companyRef.get();
  if (!companySnap.exists) {
    console.log("Company doc missing, creating...");
    await companyRef.set({
      companyId,
      organizationId: companyId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true
    }, { merge: true });
    console.log("✓ Company doc created");
  } else {
    console.log("✓ Company doc already exists");
  }

  // Check and create location doc
  const locationSnap = await locationRef.get();
  if (!locationSnap.exists) {
    console.log("Location doc missing, creating...");
    await locationRef.set({
      companyId,
      organizationId: companyId,
      locationId,
      name: "Main location",
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log("✓ Location doc created");
  } else {
    console.log("✓ Location doc already exists");
  }

  console.log("=== STRUCTURE ENSURED ===");

  return {
    ok: true,
    companyId,
    locationId,
    companyExists: companySnap.exists,
    locationExists: locationSnap.exists
  };
}

// Export as Cloud Function
const fixOnboardingStructure = functions.https.onRequest(async (req, res) => {
  try {
    const result = await ensureOnboardingStructure();
    res.json(result);
  } catch (err) {
    console.error("FIX ERROR:", {
      message: err.message,
      stack: err.stack
    });
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

module.exports = {
  ensureOnboardingStructure,
  fixOnboardingStructure
};
