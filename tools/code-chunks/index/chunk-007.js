    db.collection("users").where("organizationId", "==", companyId).limit(100).get()
  ]);

  const usersById = new Map();
  snapshots.forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      if (!usersById.has(docSnap.id)) {
        usersById.set(docSnap.id, docSnap.data() || {});
      }
    });
  });

  const users = [...usersById.entries()]
    .filter(([, userData]) => {
      const locationIds = getUserLocationIds(userData);
      if (!locationIds.length) return true;
      return locationIds.includes(locationId);
    })
    .map(([userId, userData]) => buildScopedUserResponse(userId, userData))
    .sort((left, right) => {
      const leftName = String(left.displayName || left.email || left.userId || "").toLowerCase();
      const rightName = String(right.displayName || right.email || right.userId || "").toLowerCase();
      return leftName.localeCompare(rightName, "da");
    });

  return { ok: true, users };
});

exports.resetTaskInstances = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind.");
  }

  // CRITICAL: Block reset task instances in production
  guardDangerousOperation(request, "resetTaskInstances");

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
  }

  await assertAdminAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  const [deletedTaskInstances, deletedDailyRuns] = await Promise.all([
    deleteScopedCollectionDocs({ collectionName: "task_instances", companyId, locationId }),
    deleteScopedCollectionDocs({ collectionName: "daily_runs", companyId, locationId })
  ]);

  return {
    ok: true,
    deleted: {
      task_instances: deletedTaskInstances,
      daily_runs: deletedDailyRuns
    },
    message: `Slettet ${deletedTaskInstances} task instances og ${deletedDailyRuns} daily runs`
  };
});

exports.listLocationUsers = onCall(
  { region: "us-central1" },
  async (request) => {
    console.log("listLocationUsers v2 debug", {
      hasAuth: !!request.auth,
      uid: request.auth?.uid || null,
      email: request.auth?.token?.email || null,
      data: request.data || null
    });

    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Du skal vaere logget ind.");
    }

    const companyId = sanitizeString(request.data?.companyId || "", 120);
    const locationId = sanitizeString(request.data?.locationId || "", 120);

    if (!companyId || !locationId) {
      throw new HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
    }

    await assertAdminAccess({
      uid: request.auth.uid,
      email: request.auth.token?.email || "",
      companyId,
      locationId
    });

    try {
      const usersSnapshot = await db.collection("users")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .get();

      const users = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        users.push({
          userId: doc.id,
          displayName: userData.displayName || "",
          email: userData.email || "",
          role: userData.role || "medarbejder",
          employmentRole: userData.employmentRole || userData.role || "medarbejder",
          status: userData.status || "active",
          createdAt: userData.createdAt || null
        });
      });

      return { users };
    } catch (error) {
      console.error("Fejl ved hentning af lokationsbrugere:", error);
      throw new HttpsError("internal", "Kunne ikke hente brugere.");
    }
  }
);

exports.createLocationUser = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Du skal vaere logget ind.");
    }

    const companyId = sanitizeString(request.data?.companyId || "", 120);
    const locationId = sanitizeString(request.data?.locationId || "", 120);
    const displayName = sanitizeString(request.data?.displayName || "", 100);
    const email = sanitizeString(request.data?.email || "", 100);
    const password = sanitizeString(request.data?.password || "", 100);
    const role = sanitizeString(request.data?.role || "employee", 50);
    const employmentRole = sanitizeString(request.data?.employmentRole || "medarbejder", 50);

    if (!companyId || !locationId || !displayName || !email || !password) {
      throw new HttpsError("invalid-argument", "companyId, locationId, displayName, email og password er paakraevet.");
    }

    if (password.length < 6) {
      throw new HttpsError("invalid-argument", "Password skal vaere mindst 6 tegn.");
    }

    await assertAdminAccess({
      uid: request.auth.uid,
      email: request.auth.token?.email || "",
      companyId,
      locationId
    });

    try {
      const existingUser = await db.collection("users")
        .where("email", "==", email)
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .limit(1)
        .get();

      if (!existingUser.empty) {
        throw new HttpsError("already-exists", "Bruger med denne email eksisterer allerede.");
      }

      // Create Firebase Auth user
      const authUser = await admin.auth().createUser({
        email,
        password,
        displayName,
        emailVerified: false
      });

      // Create Firestore user document
      const userRef = db.collection("users").doc(authUser.uid);
      await userRef.set({
        displayName,
        email,
        companyId,
        locationId,
        role,
        employmentRole,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: request.auth.uid
      });

      return {
        success: true,
        userId: authUser.uid,
        message: "Bruger oprettet med login-adgang."
      };
    } catch (error) {
      console.error("Fejl ved oprettelse af lokationsbruger:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Kunne ikke oprette bruger.");
    }
  }
);

exports.createStripeCheckoutSession = functions.https.onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"] },
  async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at oprette checkout.");
  }

  const stripe = getStripeClient();

  const addonKeys = sanitizeAddonKeys(data?.addonKeys);
  const origin = normalizeCheckoutOrigin(data?.origin);
  const companyId = String(data?.companyId || "").trim();
  const locationId = String(data?.locationId || "").trim();
  const generatorConfigId = sanitizeString(data?.generatorConfigId || "", 180);
  const successPath = sanitizeRelativePath(data?.successPath, "/modules/business/vision.html?checkout=success&session_id={CHECKOUT_SESSION_ID}");
  const cancelPath = sanitizeRelativePath(data?.cancelPath, "/modules/business/vision.html?checkout=cancel");

  const config = FUNCTIONS_CONFIG.value() || {};
  const stripePriceCore = sanitizeString(config?.stripe?.price_core || process.env.STRIPE_PRICE_CORE || "", 180);

  const coreLineItem = stripePriceCore
    ? { quantity: 1, price: stripePriceCore }
    : {
      quantity: 1,
      price_data: {
        currency: "dkk",
        unit_amount: 199900,
        recurring: { interval: "month" },
        product_data: {
          name: "Madkontrollen Core"
        }
      }
    };

  const lineItems = [
    coreLineItem,
    ...addonKeys.map((key) => {
      const addon = ADDON_CATALOG[key];
      const dynamicPriceKey = `price_${key.replace(/-/g, "_")}`;
      const configuredPriceId = sanitizeString(
        process.env[`STRIPE_${dynamicPriceKey.toUpperCase()}`] || "",
        180
      );

      if (configuredPriceId) {
        return {
          quantity: 1,
          price: configuredPriceId
        };
      }

      return {
        quantity: 1,
        price_data: {
          currency: "dkk",
          unit_amount: addon.amount,
          recurring: { interval: "month" },
          product_data: {
            name: addon.name
          }
        }
      };
    })
  ];

  const successUrl = `${origin}${successPath}`;
  const cancelUrl = `${origin}${cancelPath}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      source: "vision_page",
      uid: context.auth.uid,
      companyId,
      locationId,
      addons: addonKeys.join(","),
      generatorConfigId
    }
  });

  await db.collection("checkout_sessions").add({
    provider: "stripe",
    mode: "subscription",
    status: "created",
    source: "vision_page",
    uid: context.auth.uid,
    companyId,
    locationId,
    addonKeys,
    generatorConfigId,
    stripeSessionId: session.id,
    stripeUrl: session.url || "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    ok: true,
    sessionId: session.id,
    url: session.url
  };
});

// ─── BILLING PLANS REGISTER ──────────────────────────────────────────────────

const BILLING_PLANS = {
  monthly: {
    code: "monthly",
    label: "Månedsabonnement",
    interval: "month",
    intervalCount: 1,
    exVatOre: 14900,
    vatRate: 0.25
  },
  yearly: {
    code: "yearly",
    label: "Årsabonnement",
    interval: "year",
    intervalCount: 1,
    exVatOre: 160920,
    vatRate: 0.25
  }
};

function getBillingPlan(planCode) {
  const plan = BILLING_PLANS[planCode];
  if (!plan) {
    throw new functions.https.HttpsError("invalid-argument", "Ugyldig billingPlan");
  }
  return plan;
}

// ─── CANONICAL COMPANY ID (STABLE SLUG-BASED) ───────────────────────────────
// VIGTIGT: companyId må IKKE bruge Date.now() (ikke stabil ved re-runs)
// VIGTIGT: companyId må IKKE kun bruge slug (collision mellem virksomheder med samme navn)
// LØSNING: slug + CVR (hvis findes) eller slug + hash (fallback for uniqueness)

function buildCanonicalCompanyId(input) {
  const crypto = require("crypto");
  
  const slug = (input.companyName || "company")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const cleanCvr = String(input.cvr || "").replace(/\D/g, "");

  // Path 1: CVR findes → slug + CVR (garanteret unik)
  if (/^\d{8}$/.test(cleanCvr)) {
    return `onboarding_${slug}_${cleanCvr}`;
  }

  // Path 2: Ingen CVR → slug + stabil hash baseret på fallback-seed
  // Hash sikrer uniqueness selv ved samme company name
  const fallbackSeed = `${input.companyName || ""}_${input.address || ""}_${input.zip || ""}_${input.city || ""}`
    .toLowerCase()
    .replace(/\s+/g, "");
  
  const hash = crypto
    .createHash("sha256")
    .update(fallbackSeed)
    .digest("hex")
    .slice(0, 8);

  return `onboarding_${slug}_${hash}`;
}

// ─── COMPANY KEY (DEDUPLICATION) ─────────────────────────────────────────────

function buildCompanyKey({ cvr, companyName, address, zip, city }) {
  const cleanCvr = String(cvr || "").replace(/\D/g, "");

  if (/^\d{8}$/.test(cleanCvr)) {
    return {
      companyKey: `cvr_${cleanCvr}`,
      keyType: "cvr"
    };
  }

  const slug = `${companyName}_${address}_${zip}_${city}` 
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 120);

  return {
    companyKey: `fallback_${slug}`,
    keyType: "fallback"
  };
}

// ─── CREATE OR GET COMPANY (TRANSACTION) ─────────────────────────────────────

async function getOrCreateCompany(tx, input) {
  const { companyKey, keyType } = buildCompanyKey(input);

  const registryRef = db.collection("company_registry").doc(companyKey);
  const registrySnap = await tx.get(registryRef);

  // Registry hit: company already exists, return canonical companyId
  if (registrySnap.exists) {
    return {
      companyId: registrySnap.data().companyId,
      companyKey,
      keyType,
      alreadyExists: true
    };
  }

  // Generate canonical companyId (CVR-based or hash-based for uniqueness)
  let companyId = buildCanonicalCompanyId(input);
  let companyRef = db.collection("companies").doc(companyId);
  let companySnap = await tx.get(companyRef);

  // Collision check: if companies/{companyId} already exists, append suffix
  if (companySnap.exists) {
    const crypto = require("crypto");
    const collisionSuffix = crypto
      .createHash("sha256")
      .update(companyKey)
      .digest("hex")
      .slice(0, 6);
    
    companyId = `${companyId}_${collisionSuffix}`;
    companyRef = db.collection("companies").doc(companyId);
  }

  tx.set(companyRef, {
    companyId,
    companyKey,
    keyType,
    name: input.companyName || "",
    cvr: input.cvr || null,
    address: input.address || null,
    zip: input.zip || null,
    city: input.city || null,
    status: "pending_payment",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  tx.set(registryRef, {
    companyId,
    companyKey,
    keyType,
    createdAt: FieldValue.serverTimestamp()
  });

  return {
    companyId,
    companyKey,
    keyType,
    alreadyExists: false
  };
}

// ─── ONBOARDING CHECKOUT SESSION ────────────────────────────────────────────

exports.createOnboardingCheckoutSession = functions.https.onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"] },
  async (request, context) => {
  const data = request.data || request;

  console.log("=== BACKEND DEBUG START ===");
  console.log("Received data type:", typeof data);
  console.log("Received data keys:", data ? Object.keys(data) : "null");
  console.log("data.profile exists?", data?.profile ? "YES" : "NO");
  console.log("data.profile.companyName:", data?.profile?.companyName);
  console.log("data.profile.accountEmail:", data?.profile?.accountEmail);
  console.log("data.profile.accountPassword length:", data?.profile?.accountPassword?.length || 0);
  console.log("=== BACKEND DEBUG END ===");

  const stripe = getStripeClient();
  const authUid = sanitizeString(context.auth?.uid || "", 160);
  const authEmail = sanitizeString(context.auth?.token?.email || "", 160);
  const profile = sanitizeOnboardingProfile(data?.profile || {});
  const requestedCompanyId = sanitizeString(data?.companyId || "", 120);
  const requestedLocationId = sanitizeString(data?.locationId || "", 120);

  // STEP 1: Read and validate billingPlan from frontend (NEVER accept price from frontend)
  const billingPlanCode = sanitizeString(data?.billingPlan || "monthly", 40).toLowerCase();
  const plan = getBillingPlan(billingPlanCode);

  console.log("[BILLING] Selected plan:", plan.code, "Price:", plan.exVatOre, "øre");

  // Validate companyName BEFORE generating IDs
  if (!profile.companyName) {
    console.error("BACKEND ERROR: companyName missing. Received profile:", JSON.stringify(data?.profile || {}));
    console.error("BACKEND ERROR: Sanitized profile.companyName:", profile.companyName);
    throw new functions.https.HttpsError(
      "invalid-argument", 
      `Virksomhedsnavn mangler. Modtaget: '${data?.profile?.companyName}', Saniteret: '${profile.companyName}'`
    );
  }

  console.log("=== COMPANY/LOCATION ID GENERATION ===");
  console.log("Sanitized profile.companyName:", profile.companyName);
  console.log("requestedCompanyId:", requestedCompanyId);
  console.log("requestedLocationId:", requestedLocationId);

  // STEP 2: Get or create company via transaction (deduplication)
  // Accept null/empty companyId for new onboarding - generate from companyName
  let companyId = requestedCompanyId;
  let companyKey = null;
  let keyType = null;
  let companyAlreadyExists = false;

  if (!companyId) {
    const companyResult = await db.runTransaction(async (tx) => {
      return await getOrCreateCompany(tx, {
        cvr: profile.cvr,
        companyName: profile.companyName,
        address: profile.address,
        zip: profile.zip,
        city: profile.city
      });
    });

    companyId = companyResult.companyId;
    companyKey = companyResult.companyKey;
    keyType = companyResult.keyType;
    companyAlreadyExists = companyResult.alreadyExists;

    console.log("[COMPANY] Created/found:", companyId, "Key:", companyKey, "Type:", keyType, "Exists:", companyAlreadyExists);
  }

  // Generate locationId from companyId if not provided
  const locationId = requestedLocationId || toDocSafeId(`${companyId}__main`).slice(0, 120);

  console.log("Generated companyId:", companyId);
  console.log("Generated locationId:", locationId);
  console.log("=== END ID GENERATION ===");

  const origin = normalizeCheckoutOrigin(data?.origin);
  const successPath = sanitizeRelativePath(
    data?.successPath,
    "/tak?checkout=success&session_id={CHECKOUT_SESSION_ID}"
  );
  const cancelPath = sanitizeRelativePath(
    data?.cancelPath,
    "/modules/egenkontrol/onboarding.html?checkout=cancel"
  );

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  if (authUid && requestedCompanyId && requestedLocationId) {
    await assertSeoGeneratorAccess({
      uid: authUid,
      email: authEmail,
      companyId,
      locationId
    });
  }

  const riskModel = sanitizeRiskModelInput(data?.riskModel || {});
  const cloudinaryAssets = extractCloudinaryAssets(
    data?.cloudinaryAssets,
    data?.profile?.cloudinaryAssets,
    data?.profile?.attachments,
    data?.profile?.images
  );
  const onboardingEmail = sanitizeString(data?.profile?.accountEmail || data?.email || "", 160);
  const provisioningToken = toDocSafeId(`${Date.now()}_${Math.random().toString(36).slice(2)}_${companyId}_${locationId}`).slice(0, 180);

  if (!profile.companyName) {
    console.error("BACKEND ERROR: companyName missing. Received profile:", JSON.stringify(data?.profile || {}));
    console.error("BACKEND ERROR: Sanitized profile.companyName:", profile.companyName);
    throw new functions.https.HttpsError(
      "invalid-argument", 
      `Virksomhedsnavn mangler. Modtaget: '${data?.profile?.companyName}', Saniteret: '${profile.companyName}'`
    );
  }

  const userData = authUid
    ? (await getUserAccessProfile({ uid: authUid, email: authEmail }) || {})
    : {};
  const customerName = deriveCustomerName({
    profile,
    userData,
    email: authEmail || onboardingEmail
  });
  const summary = buildOnboardingSummary({
    profile,
    riskModel,
    customerName
  });

  const draftRef = await db.collection("onboarding_checkout_drafts").add({
    uid: authUid || "",
    userEmail: authEmail || onboardingEmail,
    onboardingEmail,
    provisioningToken,
    companyId,
    organizationId: companyId,
    locationId,
    profile,
    riskModel,
    summary,
    cloudinaryAssets,
    source: "onboarding_checkout",
    status: "awaiting_payment",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  // STEP 3: Build Stripe line items from billing plan (server-side pricing only)
  const lineItems = [{
    quantity: 1,
    price_data: {
      currency: "dkk",
      unit_amount: plan.exVatOre,
      recurring: {
        interval: plan.interval,
        interval_count: plan.intervalCount
      },
      product_data: {
        name: plan.label
      },
      tax_behavior: "exclusive"
    }
  }];

  console.log("[BILLING] Line items created:", JSON.stringify(lineItems, null, 2));

  const successUrl = `${origin}${successPath}${successPath.includes("?") ? "&" : "?"}draftId=${encodeURIComponent(draftRef.id)}`;
  const successUrlWithToken = `${successUrl}&provisioning_token=${encodeURIComponent(provisioningToken)}`;
  const cancelUrl = `${origin}${cancelPath}${cancelPath.includes("?") ? "&" : "?"}draftId=${encodeURIComponent(draftRef.id)}&provisioning_token=${encodeURIComponent(provisioningToken)}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems,
    customer_email: onboardingEmail || authEmail || undefined,
    success_url: successUrlWithToken,
    cancel_url: cancelUrl,
    metadata: {
      source: "onboarding_checkout",
      uid: authUid || "guest",
      companyId,
      locationId,
      draftId: draftRef.id,
      provisioningToken,
      onboardingEmail,
      billingPlan: plan.code,
      companyKey: companyKey || "",
      keyType: keyType || ""
    }
  });

  await draftRef.set({
    stripeSessionId: session.id,
    stripeUrl: session.url || "",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await db.collection("checkout_sessions").add({
    provider: "stripe",
    mode: "subscription",
    status: "created",
    source: "onboarding_checkout",
    uid: authUid || "",
    companyId,
    locationId,
    addonKeys: [],
    onboardingDraftId: draftRef.id,
    stripeSessionId: session.id,
    stripeUrl: session.url || "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    ok: true,
    draftId: draftRef.id,
    sessionId: session.id,
    url: session.url,
    summary
  };
});

exports.checkSubdomainAvailability = functions.https.onCall(async (data, context) => {
  try {
    const payload =
      data?.data && typeof data.data === "object"
        ? data.data
        : data;

    console.log("RAW DATA - companyId:", payload?.companyId, "locationId:", payload?.locationId, "subdomain:", payload?.subdomain);
    console.log("PARSED PAYLOAD - keys:", Object.keys(payload || {}));

    const companyId = String(payload?.companyId || "").trim();
    const locationId = String(payload?.locationId || "").trim();
    const subdomain = String(payload?.subdomain || "").trim().toLowerCase();

    console.log("companyId:", companyId);
    console.log("locationId:", locationId);
    console.log("subdomain:", subdomain);

    if (!companyId || !locationId) {
      return {
        ok: false,
        error: "companyId og locationId mangler"
      };
    }

    if (!subdomain) {
      return {
        ok: false,
        error: "subdomain mangler"
      };
    }

    if (subdomain.length < 3) {
      return {
        ok: true,
        subdomain,
        available: false,
        reason: "for_short"
      };
    }

    const snap = await db
      .collection("websites")
      .where("subdomain", "==", subdomain)
      .limit(1)
      .get();

    if (snap.empty) {
      return {
        ok: true,
        subdomain,
        available: true
      };
    }

    const existing = snap.docs[0].data() || {};
    const existingCompanyId = String(existing.organizationId || existing.companyId || "").trim();
    const existingLocationId = String(existing.locationId || "").trim();
    const sameLocation = existingCompanyId === companyId && existingLocationId === locationId;

    return {
      ok: true,
      subdomain,
      available: sameLocation,
      reason: sameLocation ? "owned_by_current_location" : "taken"
    };
  } catch (err) {
    console.error("SUBDOMAIN ERROR:", String(err?.message || "Unknown error"));
    
    return {
      ok: false,
      error: String(err?.message || "Internal error")
    };
  }
});

exports.saveSeoGeneratorConfig = functions.https.onCall(async (data, context) => {
  try {
    const payload =
      data?.data && typeof data.data === "object"
        ? data.data
        : data;

    console.log("RAW DATA - companyId:", payload?.companyId, "locationId:", payload?.locationId);
    console.log("PARSED PAYLOAD - keys:", Object.keys(payload || {}));
    
    const companyId = sanitizeString(payload?.companyId || "", 120);
    const locationId = sanitizeString(payload?.locationId || "", 120);

    console.log("companyId:", companyId);
    console.log("locationId:", locationId);
    const config = payload?.config || {};
    const isOnboarding = companyId.toLowerCase().startsWith("onboarding_");

    if (!companyId || !locationId) {
      throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
    }

    if (!isOnboarding && !context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Log ind for at gemme generator-data.");
    }

    if (!isOnboarding) {
      await assertSeoGeneratorAccess({
        uid: context.auth.uid,
        email: context.auth.token?.email || "",
        companyId,
        locationId
      });
    }
