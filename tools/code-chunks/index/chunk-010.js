      uploadParams.append("file", imageUrl);
      uploadParams.append("folder", folder);
      uploadParams.append("timestamp", String(timestamp));
      uploadParams.append("api_key", apiKey);
      uploadParams.append("signature", signature);

      const uploadResp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: uploadParams.toString()
      });

      if (!uploadResp.ok) {
        const errText = await uploadResp.text().catch(() => "");
        throw new Error(`Cloudinary upload: ${uploadResp.status} — ${errText.slice(0, 200)}`);
      }

      const uploadResult = await uploadResp.json();
      publicId = uploadResult.public_id || "";
      originalCloudinaryUrl = uploadResult.secure_url || imageUrl;
      enhanced = true;
    } catch (uploadErr) {
      console.error("[enhanceAndUploadRestaurantImage] Upload fejlede, bruger original:", uploadErr.message);
    }

    const transforms = SEO_HERO_TRANSFORMS[style] || SEO_HERO_TRANSFORMS.warm;
    const enhancedUrl = (enhanced && publicId)
      ? `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`
      : imageUrl;

    const docId = `${companyId}__${locationId}__hero_${Date.now()}`;
    await db.collection("seo_hero_images").doc(docId).set({
      companyId, locationId,
      url: originalCloudinaryUrl,
      thumbUrl, enhancedUrl: enhanced ? enhancedUrl : "",
      category, style, source, sourceUrl, photographer, photographerUrl, alt,
      publicId, cloudName, enhanced,
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      isActive: true
    });

    // Push hero image to any already-published websites for this location
    try {
      const sitesSnap = await db.collection("websites")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .where("status", "==", "published")
        .limit(5)
        .get();
      if (!sitesSnap.empty) {
        const siteBatch = db.batch();
        sitesSnap.docs.forEach(d => {
          siteBatch.set(d.ref, {
            heroImageUrl: enhanced ? enhancedUrl : imageUrl,
            heroThumbUrl: thumbUrl,
            heroImageStyle: style,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        });
        await siteBatch.commit();
      }
    } catch (siteErr) {
      console.warn("[enhanceAndUpload] Kunne ikke opdatere websites:", siteErr.message);
    }

    return { ok: true, docId, url: originalCloudinaryUrl, enhancedUrl, enhanced };
  }
);

exports.generateSeoAiSuggestions = onCall(
  { secrets: [OPENAI_API_KEY], region: "us-central1" },
  async (request) => {
    const data = request.data;

    const businessName = sanitizeString(data?.businessName || "", 200);
    const address = sanitizeString(data?.address || "", 300);
    const city = sanitizeString(data?.city || "", 100);
    const cuisineType = sanitizeString(data?.cuisineType || "", 100);
    const offerings = sanitizeString(data?.offerings || "", 300);
    const description = sanitizeString(data?.description || "", 1000);
    const keyword = sanitizeString(data?.keyword || "", 200);
    let websiteUrl = sanitizeString(data?.websiteUrl || "", 500);

    if (!businessName && !cuisineType) {
      throw new HttpsError("invalid-argument", "Mindst restaurantnavn eller køkkentype skal angives.");
    }

    if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
      websiteUrl = "";
    }

    let websiteContent = "";
    let websiteFetchOk = false;
    let usedWebsite = false;

    if (websiteUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(websiteUrl, {
          method: "GET",
          headers: { "User-Agent": "MadkontrolBot/1.0" },
          signal: controller.signal,
          redirect: "follow"
        });

        clearTimeout(timeout);

        if (response.ok) {
          const html = await response.text();
          websiteContent = extractSeoRelevantText(html);
          websiteFetchOk = true;
          usedWebsite = !!websiteContent;
        }
      } catch (err) {
        console.warn("Website fetch fejlede:", websiteUrl, err.message);
      }
    }

    const openAiApiKey =
      OPENAI_API_KEY.value() || process.env.OPENAI_API_KEY || "";

    if (!openAiApiKey) {
      throw new HttpsError(
        "failed-precondition",
        "OpenAI API-nøgle mangler. Sæt OPENAI_API_KEY som function secret."
      );
    }

    const prompt = buildSeoAiPrompt({
      businessName,
      address,
      city,
      cuisineType,
      offerings,
      description,
      keyword,
      websiteContent
    });

    let responseData;

    try {
      const resp = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiApiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  "Du er en dansk SEO-ekspert specialiseret i lokal restaurant-SEO. Du returnerer ALTID valid JSON uden ekstra tekst. Hvis du er i tvivl, returnér {}."
              },
              { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 800,
            response_format: { type: "json_object" }
          })
        }
      );

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`OpenAI API fejl: ${resp.status} ${errText}`);
      }

      responseData = await resp.json();
    } catch (err) {
      console.error("OpenAI API kald fejlede:", err);
      throw new HttpsError(
        "internal",
        `AI-generering fejlede: ${err.message}`
      );
    }

    // 🔥 STABIL PARSING (det her var dit problem)
    const aiContent =
      responseData?.choices?.[0]?.message?.content || "";

    let suggestions = null;

    try {
      if (typeof aiContent === "string" && aiContent.trim()) {
        suggestions = JSON.parse(aiContent);
      }
    } catch (err) {
      console.warn("Kunne ikke parse AI JSON:", aiContent);
    }

    // 🔥 FALLBACK (sikrer aldrig "no result")
    if (!suggestions || typeof suggestions !== "object") {
      suggestions = {
        primaryKeyword:
          keyword || `${cuisineType} ${city}`.trim(),
        shortDescription:
          description ||
          `${businessName || cuisineType} i ${city}`.trim()
      };
    }

    return {
      ...suggestions,
      meta: {
        usedWebsite,
        websiteFetchOk
      }
    };
  }
);

function extractSeoRelevantText(html) {
  if (!html || typeof html !== "string") return "";

  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";

  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : "";

  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, "").trim() : "";

  text = text.slice(0, 2000);

  return [
    title ? `Title: ${title}` : "",
    metaDesc ? `Meta: ${metaDesc}` : "",
    h1 ? `H1: ${h1}` : "",
    text ? `Content: ${text}` : ""
  ].filter(Boolean).join(" | ").slice(0, 3000);
}

function buildSeoAiPrompt({ businessName, address, city, cuisineType, offerings, description, keyword, websiteContent }) {
  const parts = [
    "Generer SEO-forslag til en dansk restaurant.",
    businessName ? `Navn: ${businessName}` : "",
    city ? `By: ${city}` : "",
    address ? `Adresse: ${address}` : "",
    cuisineType ? `Type: ${cuisineType}` : "",
    offerings ? `Udbud: ${offerings}` : "",
    description ? `Beskrivelse: ${description}` : "",
    keyword ? `Nuværende søgeord: ${keyword}` : "",
    websiteContent ? `Website-indhold: ${websiteContent}` : ""
  ].filter(Boolean).join("\n");

  return `${parts}

Returner JSON med følgende struktur:
{
  "primaryKeyword": "primært lokalt søgeord (fx 'thai restaurant hvidovre')",
  "secondaryKeywords": ["sekundært søgeord 1", "sekundært søgeord 2", "sekundært søgeord 3"],
  "shortDescription": "kort beskrivelse 1-2 sætninger på dansk",
  "seoTitle": "SEO title tag inkl. restaurantnavn og by",
  "metaDescription": "meta description 150-160 tegn på dansk",
  "extractedWebsiteSummary": "kort opsummering af hvad du fandt på hjemmesiden (eller tom hvis ingen website)"
}

Fokuser på lokal SEO. Brug faktiske oplysninger. Skriv på dansk. Hvis website-indhold er tilgængeligt, brug det til at gøre forslagene mere præcise.`;
}

exports.startCoolingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { companyId, locationId, productName, batchSize, container, startTemperature } = data;

  if (!companyId || !locationId || !productName || startTemperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.startCoolingProcess({
      companyId,
      locationId,
      userId: context.auth.uid,
      productName,
      batchSize,
      container,
      startTemperature
    });
  } catch (error) {
    console.error("Start cooling process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.addCoolingMeasurement = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, temperature, note } = data;

  if (!processId || temperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.addCoolingMeasurement({
      processId,
      temperature,
      note,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Add cooling measurement fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.completeCoolingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, endTemperature, note } = data;

  if (!processId || endTemperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.completeCoolingProcess({
      processId,
      endTemperature,
      note,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Complete cooling process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.startReheatingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { companyId, locationId, failedCoolingProcessId } = data;

  if (!companyId || !locationId || !failedCoolingProcessId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.startReheatingProcess({
      companyId,
      locationId,
      userId: context.auth.uid,
      failedCoolingProcessId
    });
  } catch (error) {
    console.error("Start reheating process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.completeReheatingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, endTemperature, note } = data;

  if (!processId || endTemperature === undefined) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.completeReheatingProcess({
      processId,
      endTemperature,
      note,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Complete reheating process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.disposeCoolingProcess = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { processId, disposalReason } = data;

  if (!processId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.disposeCoolingProcess({
      processId,
      disposalReason,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Dispose cooling process fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.startNewCoolingFromReheating = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { reheatingProcessId } = data;

  if (!reheatingProcessId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.startNewCoolingFromReheating({
      reheatingProcessId,
      userId: context.auth.uid
    });
  } catch (error) {
    console.error("Start new cooling from reheating fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.loadActiveProcessInstances = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { locationId } = data;

  if (!locationId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    return await processInstances.loadActiveProcessInstances({ locationId });
  } catch (error) {
    console.error("Load active process instances fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// Demo Mode - DEVELOPER ONLY (not for production customers)
exports.enableDemoMode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  // CRITICAL: Demo mode is DEVELOPER ONLY
  guardDangerousOperation(context, "enableDemoMode");

  try {
    const userDoc = await db.collection("users").doc(context.auth.uid).get();
    const userData = userDoc.data();

    const result = await demoMode.enableDemoMode({
      userId: context.auth.uid,
      userData
    });

    return result;
  } catch (error) {
    console.error("Enable demo mode fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.disableDemoMode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  try {
    const userDoc = await db.collection("users").doc(context.auth.uid).get();
    const userData = userDoc.data();

    const result = await demoMode.disableDemoMode({
      userId: context.auth.uid,
      userData
    });

    return result;
  } catch (error) {
    console.error("Disable demo mode fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// Soft Archive - Safe alternative to hard delete
exports.startNewPeriod = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  const { companyId, locationId, periodName } = data;

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  // CRITICAL: Verify user owns this company/location
  const userDoc = await db.collection("users").doc(context.auth.uid).get();
  const userData = userDoc.data();

  if (!userData) {
    throw new functions.https.HttpsError("not-found", "Brugerprofil ikke fundet");
  }

  // Check company ownership
  const userCompanyId = userData.companyId || userData.organizationId;
  if (userCompanyId !== companyId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Du kan kun starte ny periode for din egen virksomhed"
    );
  }

  // Check role - only owner or location_admin
  const userRole = String(userData.role || "").toLowerCase();
  if (userRole !== "owner" && userRole !== "location_admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Kun owner eller location_admin kan starte ny periode"
    );
  }

  // Check location access
  const userLocationIds = userData.locationIds || [];
  if (!userLocationIds.includes(locationId)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Du har ikke adgang til denne lokation"
    );
  }

  try {
    const result = await softArchive.startNewPeriod({
      companyId,
      locationId,
      periodName,
      startedBy: context.auth.uid
    });

    return result;
  } catch (error) {
    console.error("Start new period fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.archiveCompany = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  // CRITICAL: This is a dangerous operation - guard it
  guardDangerousOperation(context, "archiveCompany");

  const { companyId, reason } = data;

  if (!companyId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    const result = await softArchive.archiveCompany({
      companyId,
      reason,
      archivedBy: context.auth.uid
    });

    return result;
  } catch (error) {
    console.error("Archive company fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.restoreCompany = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal være logget ind");
  }

  // CRITICAL: This is a dangerous operation - guard it
  guardDangerousOperation(context, "restoreCompany");

  const { companyId } = data;

  if (!companyId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende påkrævede felter");
  }

  try {
    const result = await softArchive.restoreCompany({
      companyId,
      restoredBy: context.auth.uid
    });

    return result;
  } catch (error) {
    console.error("Restore company fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
exports.closeDailyRun = closeDailyRun;

exports.cleanupTaskTemplates = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  try {
    const templatesRef = db.collection("task_templates");
    const snapshot = await templatesRef
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .get();

    if (snapshot.empty) {
      return { deleted: 0, message: "Ingen templates fundet." };
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return {
      deleted: snapshot.size,
      message: `Slettet ${snapshot.size} task templates.`
    };
  } catch (error) {
    console.error("cleanupTaskTemplates fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

exports.lookupCvr = functions.https.onCall(async (data, context) => {
  const cvr = String(data?.cvr || "").replace(/\D/g, "");

  if (!/^\d{8}$/.test(cvr)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "CVR skal være 8 cifre."
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

// Manual risk analysis generator for existing onboardings
exports.manualGenerateRiskAnalysis = functions.https.onCall(async (data, context) => {
  console.log("🔥 manualGenerateRiskAnalysis START");

  try {
    const payload =
      data?.companyId || data?.locationId
        ? data
        : data?.data?.companyId || data?.data?.locationId
          ? data.data
          : {};

    const companyId = sanitizeString(payload?.companyId || "", 120);
    const locationId = sanitizeString(payload?.locationId || "", 120);

    console.log("companyId:", companyId, "locationId:", locationId);

    if (!companyId || !locationId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "companyId og locationId er påkrævet."
      );
    }

    // Load profile from haccp_snapshots (query by field, not doc ID)
    const snapshotQuery = await db.collection("haccp_snapshots")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .limit(1)
      .get();

    if (snapshotQuery.empty) {
      throw new functions.https.HttpsError(
        "not-found",
        `Ingen HACCP snapshot fundet for ${companyId} / ${locationId}`
      );
    }

    const snapshot = snapshotQuery.docs[0].data();
    const profile = snapshot?.profile || snapshot || {};

    console.log("📦 Loading buildStructuredHaccpData...");
    const { buildStructuredHaccpData } = require("./provisioning");

    if (!buildStructuredHaccpData) {
      throw new Error("buildStructuredHaccpData not found in provisioning module");
    }

    const controlPoints = buildStructuredHaccpData(profile);
    console.log(`📊 Generated ${controlPoints.length} control points`);

    await db
      .collection("companies")
      .doc(companyId)
      .collection("locations")
      .doc(locationId)
      .collection("risk_analysis")
      .doc("current")
      .set({
        status: "generated",
        onboardingSnapshot: profile,
        controlPoints: controlPoints,
        totalControlPoints: controlPoints.length,
        generatedBy: "manualGenerateRiskAnalysis",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

    console.log(`✅ Risk analysis saved: ${controlPoints.length} control points`);

    return {
      ok: true,
      companyId,
      locationId,
      totalControlPoints: controlPoints.length
    };
  } catch (error) {
    console.error("❌ manualGenerateRiskAnalysis FAILED:", error?.message);
    console.error("❌ stack:", error?.stack || null);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      "internal",
      error?.message || "manualGenerateRiskAnalysis crashed"
    );
  }
});

// ─── WATER MODULE ──────────────────────────────────────────────────────────
// FJERNET: water-module er slettet, vandkontrol deaktiveret

// ─── AUDIT TOOLS ───────────────────────────────────────────────────────────
// FJERNET: auditCompanyLocation.js eksisterer ikke
// const { auditCompanyLocationIntegrity } = require("./auditCompanyLocation");
// exports.auditCompanyLocationIntegrity = auditCompanyLocationIntegrity;

// ─── ONBOARDING FIX ────────────────────────────────────────────────────────