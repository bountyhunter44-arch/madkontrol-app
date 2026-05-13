/**
 * Audit script to find documents with missing companyId or locationId
 * Run this as a Cloud Function or standalone script
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function auditMissingCompanyAndLocation() {
  const collectionsToCheck = [
    "websites",
    "seo_generator_configs"
  ];

  let totalMissing = 0;
  const results = {};

  for (const colName of collectionsToCheck) {
    console.log(`\n=== Checking collection: ${colName} ===`);

    let missingCount = 0;
    let totalDocs = 0;
    let lastDoc = null;

    while (true) {
      let query = db.collection(colName).limit(200);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snap = await query.get();

      if (snap.empty) break;

      totalDocs += snap.size;

      snap.docs.forEach(doc => {
        const data = doc.data() || {};

        const companyId = String(data.companyId || data.organizationId || "").trim();
        const locationId = String(data.locationId || "").trim();

        if (!companyId || !locationId) {
          missingCount++;
          totalMissing++;

          console.warn("MISSING DATA:", {
            collection: colName,
            docId: doc.id,
            companyId: companyId || "(empty)",
            locationId: locationId || "(empty)",
            hasOrganizationId: !!data.organizationId,
            hasCompanyId: !!data.companyId,
            hasLocationId: !!data.locationId
          });
        }
      });

      lastDoc = snap.docs[snap.docs.length - 1];

      if (snap.size < 200) break;
    }

    console.log(`Total documents in ${colName}: ${totalDocs}`);

    results[colName] = {
      total: totalDocs,
      missing: missingCount,
      valid: totalDocs - missingCount
    };

    console.log(`${colName}: ${missingCount} documents with missing data`);
  }

  console.log("\n=== AUDIT SUMMARY ===");
  console.log(JSON.stringify(results, null, 2));
  console.log(`\nTotal documents with missing data: ${totalMissing}`);

  return {
    ok: true,
    totalMissing,
    results
  };
}

// Export as Cloud Function
const auditCompanyLocationIntegrity = functions.https.onRequest(async (req, res) => {
  try {
    const result = await auditMissingCompanyAndLocation();
    res.json(result);
  } catch (err) {
    console.error("AUDIT ERROR:", {
      message: err.message,
      stack: err.stack
    });
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// Export both functions
module.exports = {
  auditMissingCompanyAndLocation,
  auditCompanyLocationIntegrity
};
