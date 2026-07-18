// crm — udtrukket fra functions/index.js.
// Følger DI-factory-mønsteret fra functions/egenkontrol/.
// Kode flyttet ORDRET; eneste ændring er `exports.` -> `api.`.

const functions = require("firebase-functions");
const { sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt, toDocSafeId, toAsciiSlug, toLegacyId, getDateKey, addDays, daysBetween, normalizeDateKey, removeUndefinedFields, getWeekdayFromDateKey, sanitizeRelativePath, parsePageCount } = require("../../lib/util");

module.exports = ({
  FieldValue,
  db
}) => {
  const api = {};

async function fetchCvrData(cvr) {
  const https = require("https");

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "cvrapi.dk",
      path: `/api?search=${cvr}&country=dk`,
      method: "GET",
      headers: {
        "User-Agent": "MadkontrollenPro/1.0"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (error) {
            reject(new Error("Kunne ikke parse CVR API response"));
          }
        } else if (res.statusCode === 404) {
          reject(new Error("CVR ikke fundet"));
        } else if (res.statusCode === 429) {
          reject(new Error("Rate limit overskredet - vent venligst"));
        } else {
          reject(new Error(`CVR API fejl: ${res.statusCode}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`NetvÃ¦rksfejl: ${error.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("CVR API timeout"));
    });

    req.end();
  });
}

api.lookupCvr = functions.https.onCall(async (data, context) => {
  const cvr = String(data?.cvr || "").replace(/\D/g, "");

  if (!/^\d{8}$/.test(cvr)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "CVR skal vÃ¦re 8 cifre."
    );
  }

  try {
    const response = await fetch(`https://cvrapi.dk/api?search=${cvr}&country=dk`);
    const result = await response.json();

    if (!response.ok || !result || result.error) {
      throw new Error(result?.error || "CVR-opslag fejlede.");
    }

    return {
      name: result.name || "",
      address: result.address || "",
      zip: result.zipcode || "",
      city: result.city || "",
      leader: ""
    };
  } catch (error) {
    console.error("lookupCvr fejl:", error);
    throw new functions.https.HttpsError(
      "internal",
      error?.message || "Kunne ikke hente CVR-data."
    );
  }
});

api.enrichNextCvrBatch = functions.https.onCall(async (request, context) => {
  const data = request.data || request;
  const auth = context.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at berige CVR data");
  }

  const jobId = sanitizeString(data?.jobId || "", 120);
  const batchSize = Math.min(Math.max(parseInt(data?.batchSize) || 50, 1), 100);

  if (!jobId) {
    throw new functions.https.HttpsError("invalid-argument", "jobId er pÃ¥krÃ¦vet");
  }

  console.log("[enrichNextCvrBatch] Starting batch:", { jobId, batchSize, uid: auth.uid });

  try {
    // Verify user has access
    const userDoc = await db.collection("users").doc(auth.uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("permission-denied", "Bruger ikke fundet");
    }

    const userRole = userDoc.data().role;
    if (!["owner", "admin", "hq_admin", "super-admin"].includes(userRole)) {
      throw new functions.https.HttpsError("permission-denied", "Kun admin brugere kan berige CVR data");
    }

    // Get job
    const jobRef = db.collection("cvr_enrichment_jobs").doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Job ikke fundet");
    }

    const job = jobDoc.data();

    // Get next batch of pending items
    const itemsSnapshot = await db
      .collection("cvr_enrichment_jobs")
      .doc(jobId)
      .collection("items")
      .where("status", "==", "pending")
      .limit(batchSize)
      .get();

    if (itemsSnapshot.empty) {
      console.log("[enrichNextCvrBatch] No more pending items");
      
      await jobRef.update({
        status: "completed",
        updatedAt: FieldValue.serverTimestamp()
      });

      return {
        ok: true,
        completed: true,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        message: "Ingen flere CVR at behandle"
      };
    }

    let successCount = 0;
    let failedCount = 0;

    // Process each CVR
    for (const itemDoc of itemsSnapshot.docs) {
      const item = itemDoc.data();
      const cvr = item.cvr;

      console.log("[enrichNextCvrBatch] Processing CVR:", cvr);

      // Mark as processing
      await itemDoc.ref.update({
        status: "processing",
        attempts: (item.attempts || 0) + 1,
        updatedAt: FieldValue.serverTimestamp()
      });

      try {
        // Call CVR API
        const cvrData = await fetchCvrData(cvr);

        if (!cvrData) {
          throw new Error("Ingen data fra CVR API");
        }

        // Normalize data
        const normalizedData = {
          cvr: cvr,
          companyName: cvrData.name || "",
          name: cvrData.name || "",
          address: cvrData.address || "",
          zip: cvrData.zipcode || "",
          city: cvrData.city || "",
          phone: cvrData.phone || "",
          email: cvrData.email || "",
          website: cvrData.website || "",
          source: "cvr_api"
        };

        // Save to item
        await itemDoc.ref.update({
          status: "completed",
          data: normalizedData,
          enrichedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        // Save to prospects collection with merge
        const prospectRef = db.collection("prospects").doc(cvr);
        const prospectDoc = await prospectRef.get();
        const existingData = prospectDoc.exists ? prospectDoc.data() : {};

        // Build payload - don't overwrite existing manual data
        const prospectPayload = {
          cvr: cvr,
          updatedAt: FieldValue.serverTimestamp(),
          enrichedAt: FieldValue.serverTimestamp(),
          importSource: "cvr_enrichment_app"
        };

        // Only update if we have data and it's not already set
        if (normalizedData.companyName && !existingData.companyName) {
          prospectPayload.companyName = normalizedData.companyName;
          prospectPayload.name = normalizedData.companyName;
        }

        if (normalizedData.address && !existingData.address) {
          prospectPayload.address = normalizedData.address;
        }

        if (normalizedData.zip && !existingData.zip) {
          prospectPayload.zip = normalizedData.zip;
        }

        if (normalizedData.city && !existingData.city) {
          prospectPayload.city = normalizedData.city;
        }

        if (normalizedData.phone && !existingData.phone) {
          prospectPayload.phone = normalizedData.phone;
        }

        if (normalizedData.email && !existingData.email) {
          prospectPayload.email = normalizedData.email;
        }

        if (normalizedData.website && !existingData.website) {
          prospectPayload.website = normalizedData.website;
        }

        // Set default status if not exists
        if (!existingData.status) {
          prospectPayload.status = "prospect";
        }

        if (!existingData.source) {
          prospectPayload.source = "cvr_enrichment";
        }

        await prospectRef.set(prospectPayload, { merge: true });

        successCount++;
        console.log("[enrichNextCvrBatch] Success:", cvr);

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error("[enrichNextCvrBatch] Failed CVR:", cvr, error);

        await itemDoc.ref.update({
          status: "failed",
          lastError: error.message || "Ukendt fejl",
          updatedAt: FieldValue.serverTimestamp()
        });

        failedCount++;
      }
    }

    // Update job stats
    const updatedProcessedCount = (job.processedCount || 0) + successCount + failedCount;
    const updatedSuccessCount = (job.successCount || 0) + successCount;
    const updatedFailedCount = (job.failedCount || 0) + failedCount;

    await jobRef.update({
      processedCount: updatedProcessedCount,
      successCount: updatedSuccessCount,
      failedCount: updatedFailedCount,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Check if job is complete
    const remainingSnapshot = await db
      .collection("cvr_enrichment_jobs")
      .doc(jobId)
      .collection("items")
      .where("status", "==", "pending")
      .limit(1)
      .get();

    const isComplete = remainingSnapshot.empty;

    if (isComplete) {
      await jobRef.update({
        status: "completed",
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    console.log("[enrichNextCvrBatch] Batch complete:", {
      successCount,
      failedCount,
      isComplete
    });

    return {
      ok: true,
      completed: isComplete,
      processedCount: successCount + failedCount,
      successCount,
      failedCount,
      message: `Behandlet ${successCount + failedCount} CVR (${successCount} success, ${failedCount} fejl)`
    };

  } catch (error) {
    console.error("[enrichNextCvrBatch] ERROR:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

  return api;
};
