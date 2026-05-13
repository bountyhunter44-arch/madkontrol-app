    const configDocId = sanitizeString(payload?.configId || "", 180) || toDocSafeId(`${companyId}__${locationId}__${Date.now()}`);
    const subdomain = toAsciiSlug(config?.subdomain || config?.businessName || "restaurant", 120) || "restaurant";

    const dbPayload = {
      companyId,
      organizationId: companyId,
      locationId,
      businessName: sanitizeString(config?.businessName || "", 140),
      subdomain,
      city: sanitizeString(config?.city || "", 80),
      cuisineType: sanitizeString(config?.cuisineType || "", 80),
      offerings: sanitizeString(config?.offerings || "", 240),
      keyword: sanitizeString(config?.keyword || "", 140),
      phone: sanitizeString(config?.phone || "", 80),
      address: sanitizeString(config?.address || "", 220),
      description: sanitizeString(config?.description || "", 1200),
      selectedTemplate: sanitizeString(config?.selectedTemplate || "classic", 80),
      pageCount: parsePageCount(config?.pageCount, 50),
      logoPosition: sanitizeString(config?.logoPosition || "card", 40),
      logoDataUrl: sanitizeString(config?.logoDataUrl || "", 500000),
      seoNarrative: sanitizeString(config?.seoNarrative || "", 2000),
      heroImageUrl: sanitizeString(config?.heroImageUrl || "", 2000),
      ctaText: sanitizeString(config?.ctaText || "", 120),
      ctaUrl: sanitizeString(config?.ctaUrl || "", 500),
      landingPages: Array.isArray(config?.landingPages) ? config.landingPages.slice(0, 200).map(p => ({
        canonicalPath: sanitizeString(p?.canonicalPath || "", 220),
        keyword:       sanitizeString(p?.keyword || "", 140),
        title:         sanitizeString(p?.title || "", 220),
        h1:            sanitizeString(p?.h1 || "", 220),
        h2:            sanitizeString(p?.h2 || "", 220),
        h3:            sanitizeString(p?.h3 || "", 220),
        metaDescription: sanitizeString(p?.metaDescription || "", 320)
      })) : [],
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: context.auth?.uid || null,
      updatedByEmail: sanitizeString(context.auth?.token?.email || "", 160)
    };

    await db.collection("seo_generator_configs").doc(configDocId).set({
      ...dbPayload,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: context.auth?.uid || null
    }, { merge: true });

    return {
      ok: true,
      configId: configDocId,
      subdomain
    };
  } catch (err) {
    console.error("SAVE CONFIG ERROR:", String(err?.message || "Unknown error"));
    
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    
    throw new functions.https.HttpsError("internal", String(err?.message || "Internal error"));
  }
});

exports.finalizeSeoCheckoutProvisioning = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at aktivere SEO-modulet.");
  }

  const stripe = getStripeClient();
  const sessionId = sanitizeString(data?.sessionId || "", 220);
  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const configId = sanitizeString(data?.configId || "", 180);

  if (!sessionId || !companyId || !locationId || !configId) {
    throw new functions.https.HttpsError("invalid-argument", "sessionId, companyId, locationId og configId er paakraevet.");
  }

  await assertAdminAccess({
    uid: context.auth.uid,
    email: context.auth.token?.email || "",
    companyId,
    locationId
  });

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  const status = sanitizeString(checkoutSession?.status || "", 40).toLowerCase();
  const paymentStatus = sanitizeString(checkoutSession?.payment_status || "", 40).toLowerCase();
  const addonKeys = sanitizeAddonKeys(
    String(checkoutSession?.metadata?.addons || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  if (!addonKeys.includes("seo")) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-session indeholder ikke SEO-modulet.");
  }

  const isPaid = status === "complete" && (paymentStatus === "paid" || paymentStatus === "no_payment_required");
  if (!isPaid) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout er ikke gennemfoert endnu.");
  }

  const configSnap = await db.collection("seo_generator_configs").doc(configId).get();
  if (!configSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Generator-konfiguration blev ikke fundet.");
  }

  const config = configSnap.data() || {};
  if (
    sanitizeString(config.companyId || config.organizationId, 120) !== companyId ||
    sanitizeString(config.locationId || "", 120) !== locationId
  ) {
    throw new functions.https.HttpsError("permission-denied", "Konfigurationen tilhoerer ikke valgt company/location.");
  }

  const result = await upsertWebsiteAndSeoPages({
    companyId,
    locationId,
    config,
    activatedByUid: context.auth.uid
  });

  const matchingCheckoutSessions = await db
    .collection("checkout_sessions")
    .where("stripeSessionId", "==", sessionId)
    .limit(5)
    .get();

  if (!matchingCheckoutSessions.empty) {
    const batch = db.batch();
    matchingCheckoutSessions.docs.forEach((docSnap) => {
      batch.set(docSnap.ref, {
        status: "completed",
        addonKeys,
        generatorConfigId: configId,
        seoProvisioned: true,
        seoWebsiteId: result.websiteId,
        seoGeneratedPages: result.generatedPages,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }

  await db.collection("seo_generator_configs").doc(configId).set({
    seoModuleActive: true,
    seoWebsiteId: result.websiteId,
    seoGeneratedPages: result.generatedPages,
    seoProvisionedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    ok: true,
    websiteId: result.websiteId,
    generatedPages: result.generatedPages,
    subdomain: result.subdomain
  };
});

exports.adminActivateSeoSite = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at aktivere SEO-site.");
  }
  const companyId  = sanitizeString(data?.companyId  || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }
  await assertAdminAccess({ uid: context.auth.uid, email: context.auth.token?.email || "", companyId, locationId });

  // Use provided inline config or load saved config from Firestore
  let config = data?.config || null;
  if (!config) {
    const configId = sanitizeString(data?.configId || "", 180);
    if (!configId) throw new functions.https.HttpsError("invalid-argument", "config eller configId er påkrævet.");
    const snap = await db.collection("seo_generator_configs").doc(configId).get();
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "Generator-konfiguration ikke fundet.");
    config = snap.data();
  }

  const result = await upsertWebsiteAndSeoPages({ companyId, locationId, config, activatedByUid: context.auth.uid });

  // Mark SEO addon as active on the company location
  await db.collection("company_locations").doc(`${companyId}__${locationId}`).set({
    addons: { seo: true },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});

  return { ok: true, websiteId: result.websiteId, generatedPages: result.generatedPages, subdomain: result.subdomain };
});

// ── SEO SITE RENDERER ────────────────────────────────────────────────────────
// HTTP function — serves *.madkontrollen.dk subdomains as real HTML pages
// Map *.madkontrollen.dk → this function via Google Cloud Run custom domains
exports.seoSiteRenderer = functions.https.onRequest(async (req, res) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");

  const host = (req.headers.host || "").toLowerCase().split(":")[0];
  const match = host.match(/^([a-z0-9-]+)\.madkontrollen\.dk$/);
  if (!match) {
    res.status(400).send("Ugyldigt domæne.");
    return;
  }
  const subdomain = sanitizeString(match[1], 120);

  let websiteDoc = null;
  let websiteDocId = null;
  try {
    const snap = await db.collection("websites")
      .where("subdomain", "==", subdomain)
      .where("status", "==", "published")
      .limit(1)
      .get();
    if (!snap.empty) {
      websiteDoc = snap.docs[0].data();
      websiteDocId = snap.docs[0].id;
    }
  } catch (e) {
    console.error("seoSiteRenderer: website lookup error", e);
  }

  if (!websiteDoc) {
    res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Siden findes ikke</title></head><body style="font-family:sans-serif;padding:40px;text-align:center"><h1>404</h1><p>Siden <strong>${subdomain}.madkontrollen.dk</strong> findes ikke.</p></body></html>`);
    return;
  }

  const websiteId = websiteDocId;
  let seoPages = [];
  try {
    const pagesSnap = await db.collection("seo_pages")
      .where("websiteId", "==", websiteId)
      .where("status", "==", "published")
      .orderBy("ordering", "asc")
      .limit(60)
      .get();
    seoPages = pagesSnap.docs.map(d => d.data());
  } catch (e) {
    console.warn("seoSiteRenderer: pages lookup error", e);
  }

  const slugPath = (req.path || "/").replace(/^\//,"").replace(/\/$/,"") || "";
  const page = seoPages.find(p => p.slug === slugPath) || null;

  const esc = (v) => String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  
  const title = esc(page?.title || websiteDoc.heroTitle || subdomain);
  const metaDesc = esc(page?.metaDescription || websiteDoc.heroText || "");
  const h1 = esc(page?.h1 || websiteDoc.heroTitle || subdomain);
  const intro = esc(page?.bodyText || page?.metaDescription || websiteDoc.heroText || "");
  const heroImg = esc(websiteDoc.heroImageUrl || "");
  const phone = esc(websiteDoc.phone || "");
  const address = esc(websiteDoc.address || "");
  const companyName = esc(websiteDoc.heroTitle || subdomain);
  const externalWebsite = esc(websiteDoc.ctaUrl || "");
  const slug = esc(page?.slug || "");
  
  const logoInitials = companyName.split(" ").slice(0,2).map(w=>w.charAt(0).toUpperCase()).join("") || "MK";
  
  const themePrimary = esc(websiteDoc.themePrimary || "#1f7a3d");
  const themeSecondary = esc(websiteDoc.themeSecondary || "#f8f4ea");
  const themeAccent = esc(websiteDoc.themeAccent || "#b91c1c");
  const themeText = esc(websiteDoc.themeText || "#1f2937");
  
  const sectionsHtml = page?.h2 ? `<div class="section"><h2>${esc(page.h2)}</h2><p>${intro}</p></div>` : "";

  const html = `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${metaDesc}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://madkontrollen.dk/landing-pages/${slug}/">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f5f5f5; color: #1f2937; line-height: 1.6; }
.landing-page { --theme-primary: ${themePrimary}; --theme-secondary: ${themeSecondary}; --theme-accent: ${themeAccent}; --theme-text: ${themeText}; --theme-hero-overlay: rgba(0, 0, 0, 0.42); --markise-stripe-width: 80px; --markise-height: 70px; --markise-wave-height: 40px; }
.markise-bar { width: 100%; height: var(--markise-height); position: relative; z-index: 20; background-image: repeating-linear-gradient(90deg, var(--theme-primary) 0, var(--theme-primary) calc(var(--markise-stripe-width) / 2), var(--theme-secondary) calc(var(--markise-stripe-width) / 2), var(--theme-secondary) var(--markise-stripe-width)); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); }
.markise-bar::after { content: ""; position: absolute; left: 0; bottom: calc(var(--markise-wave-height) * -0.5); width: 100%; height: var(--markise-wave-height); background-image: radial-gradient(circle at 50% 0, var(--theme-primary) 50%, transparent 50%), radial-gradient(circle at 50% 0, var(--theme-secondary) 50%, transparent 50%); background-size: calc(var(--markise-stripe-width) / 2) var(--markise-wave-height); background-position: 0 0, calc(var(--markise-stripe-width) / 2) 0; background-repeat: repeat-x; }
.hero { position: relative; min-height: 620px; background-image: url('${heroImg}'); background-size: cover; background-position: center; overflow: hidden; }
.hero::before { content: ""; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0, 0, 0, 0.22), var(--theme-hero-overlay)); }
.hero-inner { position: relative; z-index: 2; max-width: 1200px; margin: 0 auto; padding: 120px 24px 90px; text-align: center; color: #ffffff; }
.hero-logo { width: 110px; height: 110px; margin: 0 auto 20px; border-radius: 999px; background: rgba(255, 255, 255, 0.94); border: 5px solid var(--theme-primary); display: grid; place-items: center; color: var(--theme-primary); font-weight: 800; font-size: 28px; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18); }
.hero-title { margin: 0; font-size: clamp(42px, 7vw, 84px); line-height: 0.95; font-weight: 900; letter-spacing: -0.03em; text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); }
.hero-subtitle { margin: 18px auto 0; max-width: 760px; font-size: clamp(20px, 2.2vw, 34px); line-height: 1.2; font-weight: 700; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25); }
.hero-actions { margin-top: 34px; display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.hero-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 180px; padding: 16px 26px; border-radius: 14px; text-decoration: none; font-weight: 800; font-size: 18px; transition: transform 0.18s ease, opacity 0.18s ease; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18); }
.hero-btn:hover { transform: translateY(-2px); opacity: 0.96; }
.hero-btn--primary { background: var(--theme-accent); color: #ffffff; }
.hero-btn--secondary { background: var(--theme-secondary); color: var(--theme-primary); }
.hero-btn--ghost { background: var(--theme-primary); color: #ffffff; }
.content { max-width: 1200px; margin: 0 auto; padding: 60px 24px; }
.section { margin-bottom: 48px; background: #ffffff; padding: 32px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); }
.section h2 { margin: 0 0 16px; font-size: 28px; font-weight: 800; color: var(--theme-primary); }
.section p { margin: 0; font-size: 18px; line-height: 1.7; color: #4b5563; }
.footer { background: var(--theme-primary); color: #ffffff; padding: 40px 24px; text-align: center; }
.footer-info { max-width: 800px; margin: 0 auto; font-size: 16px; }
.footer-info p { margin: 8px 0; }
@media (max-width: 768px) { .markise-bar { --markise-stripe-width: 60px; --markise-height: 55px; --markise-wave-height: 30px; } .hero { min-height: 520px; } .hero-inner { padding: 108px 18px 72px; } .hero-actions { gap: 10px; } .hero-btn { width: 100%; max-width: 320px; } .content { padding: 40px 18px; } .section { padding: 24px; } }
</style>
</head>
<body>
<div class="landing-page">
  <div class="markise-bar"></div>
  <div class="hero">
    <div class="hero-inner">
      <div class="hero-logo">${logoInitials}</div>
      <h1 class="hero-title">${h1}</h1>
      <p class="hero-subtitle">${intro}</p>
      <div class="hero-actions">
        <a href="/index.html" class="hero-btn hero-btn--primary">Gå til forsiden</a>
        <a href="/index.html#menu" class="hero-btn hero-btn--secondary">Se menu</a>
        ${phone ? `<a href="tel:${phone}" class="hero-btn hero-btn--ghost">Ring nu</a>` : ""}
        ${externalWebsite ? `<a href="${externalWebsite}" class="hero-btn hero-btn--ghost" target="_blank" rel="noopener">Besøg vores hjemmeside</a>` : ""}
      </div>
    </div>
  </div>
  <div class="content">${sectionsHtml}</div>
  <footer class="footer">
    <div class="footer-info">
      <p><strong>${companyName}</strong></p>
      <p>${address}</p>
      <p>Telefon: ${phone}</p>
      <p style="margin-top:20px;"><a href="/index.html" style="color:#fff;text-decoration:underline;">← Tilbage til forsiden</a></p>
      ${externalWebsite ? `<p><a href="${externalWebsite}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline;">Besøg vores hjemmeside →</a></p>` : ""}
    </div>
  </footer>
</div>
</body>
</html>`;

  res.set("Cache-Control", "public, max-age=300, s-maxage=600");
  res.status(200).type("text/html").send(html);
});

exports.createHaccpSnapshotFromOnboarding = functions.https.onCall(async (data, context) => {
  const userId = context.auth?.uid || "signup_anonymous";
  const companyId = sanitizeString(data?.companyId || "", 120) || "signup_unassigned";
  const locationId = sanitizeString(data?.locationId || "", 120) || "signup_unassigned";

  return {
    ok: true,
    ...(await createHaccpSnapshotDocument({
      profile: data?.profile || {},
      riskModel: data?.riskModel || {},
      companyId,
      locationId,
      userId
    }))
  };
});

/**
 * Helper: Ensure user document exists in Firestore users collection
 * Handles both authenticated and unauthenticated onboarding flows
 */
async function ensureOnboardingUserDocument({
  authUid,
  authEmail,
  profile,
  actorEmail,
  companyId,
  locationId,
  liveProfileId,
  snapshotId,
  cloudinaryAssets,
  billingPlan
}) {
  console.log('[ensureOnboardingUserDocument] START', { authUid, authEmail, actorEmail });
  
  let finalUserId = authUid;
  
  // If user is not logged in, create or find Firebase Auth user
  if (!authUid && profile.accountEmail && profile.accountPassword) {
    const email = sanitizeString(profile.accountEmail, 160).toLowerCase();
    const password = String(profile.accountPassword || "").trim();
    const displayName = sanitizeString(profile.ownerName || profile.companyName || "Ejer", 120);
    
    console.log(`[ensureOnboardingUserDocument] Creating/finding user - Email: ${email}, Password length: ${password.length}`);
    
    if (email && password.length >= 8) {
      try {
        let userRecord = null;
        try {
          userRecord = await admin.auth().getUserByEmail(email);
          console.log(`[ensureOnboardingUserDocument] Found existing Firebase Auth user: ${userRecord.uid}`);
        } catch (error) {
          if (error?.code === "auth/user-not-found") {
            userRecord = await admin.auth().createUser({
              email,
              password,
              displayName,
              emailVerified: false,
              disabled: false
            });
            console.log(`[ensureOnboardingUserDocument] Created new Firebase Auth user: ${userRecord.uid}`);
          } else {
            throw error;
          }
        }
        
        if (userRecord) {
          finalUserId = userRecord.uid;
        }
      } catch (error) {
        console.error('[ensureOnboardingUserDocument] Firebase Auth user creation failed:', error);
      }
    }
  }
  
  // Create or update Firestore users document
  if (finalUserId) {
    const userRef = db.collection("users").doc(finalUserId);
    const userSnap = await userRef.get();
    const existingUserData = userSnap.exists ? (userSnap.data() || {}) : {};
    const nextLocationIds = buildPreferredLocationIds(existingUserData, locationId);
    
    const userPayload = {
      uid: finalUserId,
      userId: finalUserId,
      email: actorEmail || authEmail || profile.accountEmail || "",
      displayName: sanitizeString(profile.ownerName || profile.companyName || existingUserData.displayName || "Ejer", 120),
      role: "owner",
      companyId,
      organizationId: companyId,
      locationId,
      primaryLocationId: locationId,
      locationIds: nextLocationIds,
      latestLiveProfileId: liveProfileId,
      latestHaccpSnapshotId: snapshotId,
      onboardingCompleted: true,
      onboardingStatus: "completed",
      onboardingCompletedAt: FieldValue.serverTimestamp(),
      subscriptionStatus: "active",
      plan: billingPlan,
      billingPlan: billingPlan,
      latestCloudinaryAssets: cloudinaryAssets,
      status: "active",
      updatedAt: FieldValue.serverTimestamp()
    };
    
    // Add createdAt only if new document
    if (!userSnap.exists) {
      userPayload.createdAt = FieldValue.serverTimestamp();
    }
    
    await userRef.set(userPayload, { merge: true });
    console.log(`[ensureOnboardingUserDocument] Firestore user document ensured: ${finalUserId}`);
  }
  
  console.log('[ensureOnboardingUserDocument] COMPLETE', { finalUserId });
  return finalUserId;
}

exports.finalizeOnboardingCheckoutProvisioning = functions.https.onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"] },
  async (request, context) => {
  // Firebase Functions v2 callable wraps payload in request.data
  const data = request.data || request;
  const stripe = getStripeClient();
  const authUid = sanitizeString(context.auth?.uid || "", 160);
  const authEmail = sanitizeString(context.auth?.token?.email || "", 160);
  const sessionId = sanitizeString(data?.sessionId || "", 220);
  const requestedDraftId = sanitizeString(data?.draftId || "", 180);
  const requestedProvisioningToken = sanitizeString(data?.provisioningToken || "", 220);

  if (!sessionId) {
    throw new functions.https.HttpsError("invalid-argument", "sessionId er påkrævet.");
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionStatus = sanitizeString(checkoutSession?.status || "", 40).toLowerCase();
  const paymentStatus = sanitizeString(checkoutSession?.payment_status || "", 40).toLowerCase();
  const metadataDraftId = sanitizeString(checkoutSession?.metadata?.draftId || "", 180);
  const draftId = requestedDraftId || metadataDraftId;
  const companyId = sanitizeString(checkoutSession?.metadata?.companyId || data?.companyId || "", 120);
  const locationId = sanitizeString(checkoutSession?.metadata?.locationId || data?.locationId || "", 120);
  const metadataProvisioningToken = sanitizeString(checkoutSession?.metadata?.provisioningToken || "", 220);
  const source = sanitizeString(checkoutSession?.metadata?.source || "", 80);
  const billingPlan = sanitizeString(
    checkoutSession?.metadata?.plan ||
    checkoutSession?.metadata?.billingPlan ||
    data?.billingPlan ||
    "monthly",
    40
  );
  
  console.log("[FINALIZE] Billing plan from metadata:", billingPlan);

  if (source !== "onboarding_checkout") {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-session tilhører ikke onboarding-flowet.");
  }

  if (!draftId || !companyId || !locationId) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-session mangler draft/company/location metadata.");
  }

  const isPaid = sessionStatus === "complete" && (paymentStatus === "paid" || paymentStatus === "no_payment_required");
  if (!isPaid) {
    throw new functions.https.HttpsError("failed-precondition", "Betalingen er ikke gennemført endnu.");
  }

  const draftRef = db.collection("onboarding_checkout_drafts").doc(draftId);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Onboarding-draft blev ikke fundet.");
  }

  const draft = draftSnap.data() || {};
  if (sanitizeString(draft.companyId || draft.organizationId, 120) !== companyId || sanitizeString(draft.locationId, 120) !== locationId) {
    throw new functions.https.HttpsError("permission-denied", "Draft tilhører ikke valgt company/location.");
  }

  const effectiveProvisioningToken = requestedProvisioningToken || metadataProvisioningToken;
  const draftProvisioningToken = sanitizeString(draft.provisioningToken || "", 220);
  const tokenMatches = Boolean(effectiveProvisioningToken && draftProvisioningToken && effectiveProvisioningToken === draftProvisioningToken);
  const sameAuthOwner = Boolean(authUid && sanitizeString(draft.uid || "", 160) === authUid);

  if (!tokenMatches && !sameAuthOwner) {
    throw new functions.https.HttpsError("permission-denied", "Ugyldig eller manglende provisioning-token.");
  }

  const actorUserId = authUid || sanitizeString(draft.uid || "", 160) || `checkout_guest_${draftId}`;
  const actorEmail = authEmail || sanitizeString(draft.userEmail || draft.onboardingEmail || "", 160);

  const existingSnapshotId = sanitizeString(draft.snapshotId, 180);
  const existingLiveProfileId = sanitizeString(draft.liveProfileId, 180);
  if (existingSnapshotId && existingLiveProfileId) {
    console.log(`⚠️ Onboarding already provisioned for ${companyId}__${locationId}, but checking risk analysis...`);
    
    // Check if risk analysis exists, if not generate it
    const profile = sanitizeOnboardingProfile(draft.profile || draft.company || {});
    const riskRef = db.collection("companies").doc(companyId).collection("locations").doc(locationId).collection("risk_analysis").doc("current");
    const riskSnap = await riskRef.get();
    
    if (!riskSnap.exists) {
      console.log('🔍 Risk analysis missing, generating now...');
      try {
        const { buildStructuredHaccpData } = require('./provisioning');
        const controlPoints = buildStructuredHaccpData(profile);
        
        await riskRef.set({
          status: "generated",
          onboardingSnapshot: profile,
          controlPoints: controlPoints,
          totalControlPoints: controlPoints.length,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log(`✅ Risk analysis generated: ${controlPoints.length} control points`);
      } catch (riskError) {
        console.error('❌ Risk analysis generation failed:', riskError);
      }
    } else {
      console.log('✅ Risk analysis already exists');
    }
    
    // CRITICAL: Ensure users document exists even in alreadyProvisioned flow
    console.log('[finalizeOnboardingCheckoutProvisioning] ensuring users doc in alreadyProvisioned path');
    const cloudinaryAssets = extractCloudinaryAssets(
      draft.cloudinaryAssets,
      draft.profile?.cloudinaryAssets,
      draft.profile?.attachments,
      draft.profile?.images
    );
    
    const finalUserId = await ensureOnboardingUserDocument({
      authUid,
      authEmail,
      profile,
      actorEmail,
      companyId,
      locationId,
      liveProfileId: existingLiveProfileId,
      snapshotId: existingSnapshotId,
      cloudinaryAssets,
      billingPlan
    });
    console.log('[finalizeOnboardingCheckoutProvisioning] users doc ensured:', finalUserId);
    
    return {
      ok: true,
      alreadyProvisioned: true,
      draftId,
      snapshotId: existingSnapshotId,
      liveProfileId: existingLiveProfileId,
      finalUserId,
      summary: draft.summary || {}
    };
  }

  const userData = authUid
    ? (await getUserAccessProfile({ uid: authUid, email: authEmail }) || {})
    : {};
  const profile = sanitizeOnboardingProfile(draft.profile || draft.company || {});
  const riskModel = sanitizeRiskModelInput(draft.riskModel || {});
  const customerName = deriveCustomerName({
    profile,
    userData,
    email: actorEmail
  });
  const summary = buildOnboardingSummary({
    profile,
    riskModel,
    customerName
  });
  const cloudinaryAssets = extractCloudinaryAssets(
    draft.cloudinaryAssets,
    draft.profile?.cloudinaryAssets,
    draft.profile?.attachments,
    draft.profile?.images
  );

  const liveProfileId = toDocSafeId(`${companyId}__${locationId}__live_profile`);
  const liveProfilePayload = buildLiveUserProfilePayload({
    profile,
    riskModel,
    companyId,
    locationId,
    userId: actorUserId,
    userEmail: actorEmail,
    summary,
    cloudinaryAssets,
    draftId,
    checkoutSessionId: sessionId
  });

  const { snapshotId } = await createHaccpSnapshotDocument({
    profile,
    riskModel,
    companyId,
    locationId,
    userId: actorUserId
  });

  // FJERNET: generateAndSaveEgenkontrolProgram (skriver til egenkontrol_programs, læses ikke af startDay)
  // FJERNET: buildStructuredHaccpData / companies/{id}/locations/... (isoleret, læses ingensteds)

  const onboardingAnswersId = await upsertOnboardingAnswersDocument({
    companyId,
    locationId,
    userId: actorUserId,
    liveProfilePayload
  });

  // ─── PIPELINE: onboarding_answers → risks → task_templates ───────────────
  // Steg 1: Skriv risks fra onboarding (processer → CCP/GAG regler)
  try {
    const { generateRisksFromOnboardingAnswers } = require("./admin/generateRisksFromOnboardingAnswers");
    const risksResult = await generateRisksFromOnboardingAnswers({ locationId });
    console.log("[provisioning] generateRisksFromOnboardingAnswers:", risksResult);
  } catch (risksErr) {
    console.error("[provisioning] generateRisksFromOnboardingAnswers failed:", risksErr.message);
  }

  // Steg 2: Byg task_templates fra risks (aggregeret per kontrolkategori)
  try {
    const { generateEgenkontrolFromRiskAnalysis } = require("./admin/generateEgenkontrolFromRiskAnalysis");
    const templatesResult = await generateEgenkontrolFromRiskAnalysis({ locationId, db });
    console.log("[provisioning] generateEgenkontrolFromRiskAnalysis:", templatesResult);
  } catch (templatesErr) {
    console.error("[provisioning] generateEgenkontrolFromRiskAnalysis failed:", templatesErr.message);
  }

  // Materialiser equipment counts til konkrete equipment docs
  try {
    await syncOnboardingEquipmentUnits({
      db,
      companyId,
      locationId,
      equipmentCounts: liveProfilePayload.onboardingAnswers?.equipmentCounts || {},
      profile
    });
  } catch (eqErr) {
    console.error("[finalizeOnboardingCheckoutProvisioning] syncOnboardingEquipmentUnits failed:", eqErr.message);
  }

  // Ensure location has temperatureControlSettings for new schedule system
  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    await ensureLocationTemperatureSettings(db, companyId, locationId, todayKey);
    console.log("[finalizeOnboardingCheckoutProvisioning] ensureLocationTemperatureSettings completed");
  } catch (tempErr) {
    console.error("[finalizeOnboardingCheckoutProvisioning] ensureLocationTemperatureSettings failed:", tempErr.message);
  }

  // Sync equipment-based cleaning task templates
  try {
    await syncEquipmentCleaningTemplates({ db, companyId, locationId });
  } catch (cleanErr) {
    console.error("[finalizeOnboardingCheckoutProvisioning] syncEquipmentCleaningTemplates failed:", cleanErr.message);
  }

  // Sync equipment-based maintenance task templates
  try {
    await syncEquipmentMaintenanceTemplates({ db, companyId, locationId });
  } catch (maintErr) {
    console.error("[finalizeOnboardingCheckoutProvisioning] syncEquipmentMaintenanceTemplates failed:", maintErr.message);
  }

  // Sync area-based cleaning task templates
  try {
    await syncAreaCleaningTemplates({ db, companyId, locationId });
  } catch (areaErr) {
    console.error("[finalizeOnboardingCheckoutProvisioning] syncAreaCleaningTemplates failed:", areaErr.message);
  }

  // Sync process-based drift task templates
  try {
    await syncProcessDriftTemplates({ db, companyId, locationId });
  } catch (driftErr) {
    console.error("[finalizeOnboardingCheckoutProvisioning] syncProcessDriftTemplates failed:", driftErr.message);
  }

  // FJERNET: syncWaterControlTemplates - vandkontrol deaktiveret

  await db.collection("live_user_profiles").doc(liveProfileId).set({
    ...liveProfilePayload,
    haccpSnapshotId: snapshotId,
    onboardingAnswersId,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  // FJERNET: ensureLiveTaskTemplatesForProvisioning — genererede scenario_based_haccp templates
  // som startDayForLocation eksplicit filtreréde væk. Erstattet af risks-pipeline ovenfor.

  // Ensure users document using helper (replaces old inline logic)
  console.log('[finalizeOnboardingCheckoutProvisioning] ensuring users doc');
  const finalUserId = await ensureOnboardingUserDocument({
    authUid,
    authEmail,
    profile,
    actorEmail,
    companyId,
    locationId,
    liveProfileId,
    snapshotId,
    cloudinaryAssets,
    billingPlan
  });
  console.log('[finalizeOnboardingCheckoutProvisioning] users doc ensured:', finalUserId);

  // STEP 5: Update company status to active with subscription info
  const companyRef = db.collection("companies").doc(companyId);
  await companyRef.set({
    status: "active",
    subscription: {
      plan: billingPlan,
      startedAt: FieldValue.serverTimestamp(),
      stripeSessionId: sessionId
    },
    activatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  
  console.log("[FINALIZE] Company status updated to active with subscription:", billingPlan);

  await draftRef.set({
    summary,
    cloudinaryAssets,
    liveProfileId,
    onboardingAnswersId,
    snapshotId,
    stripeSessionId: sessionId,
    billingPlan,
    status: "completed",
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const matchingCheckoutSessions = await db
    .collection("checkout_sessions")
    .where("stripeSessionId", "==", sessionId)
    .limit(5)
    .get();

  if (!matchingCheckoutSessions.empty) {
    const batch = db.batch();
    matchingCheckoutSessions.docs.forEach((docSnap) => {
      batch.set(docSnap.ref, {
        status: "completed",
        onboardingProvisioned: true,
        onboardingDraftId: draftId,
        liveProfileId,
        onboardingAnswersId,
        haccpSnapshotId: snapshotId,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }

  console.log('[finalizeOnboardingCheckoutProvisioning] completed');
  
  return {
    ok: true,
    draftId,