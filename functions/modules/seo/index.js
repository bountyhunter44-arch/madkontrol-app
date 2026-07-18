// seo — udtrukket fra functions/index.js.
// Følger DI-factory-mønsteret fra functions/egenkontrol/.
// Kode flyttet ORDRET; eneste ændring er `exports.` -> `api.`.

const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt, toDocSafeId, toAsciiSlug, toLegacyId, getDateKey, addDays, daysBetween, normalizeDateKey, removeUndefinedFields, getWeekdayFromDateKey, sanitizeRelativePath, parsePageCount } = require("../../lib/util");

module.exports = ({
  FieldValue,
  OPENAI_API_KEY,
  assertSeoGeneratorAccess,
  db
}) => {
  const api = {};

function buildSeoAiPrompt({ businessName, address, city, cuisineType, offerings, description, keyword, websiteContent }) {
  const parts = [
    "Generer SEO-forslag til en dansk restaurant.",
    businessName ? `Navn: ${businessName}` : "",
    city ? `By: ${city}` : "",
    address ? `Adresse: ${address}` : "",
    cuisineType ? `Type: ${cuisineType}` : "",
    offerings ? `Udbud: ${offerings}` : "",
    description ? `Beskrivelse: ${description}` : "",
    keyword ? `NuvÃ¦rende sÃ¸geord: ${keyword}` : "",
    websiteContent ? `Website-indhold: ${websiteContent}` : ""
  ].filter(Boolean).join("\n");

  return `${parts}

Returner JSON med fÃ¸lgende struktur:
{
  "primaryKeyword": "primÃ¦rt lokalt sÃ¸geord (fx 'thai restaurant hvidovre')",
  "secondaryKeywords": ["sekundÃ¦rt sÃ¸geord 1", "sekundÃ¦rt sÃ¸geord 2", "sekundÃ¦rt sÃ¸geord 3"],
  "shortDescription": "kort beskrivelse 1-2 sÃ¦tninger pÃ¥ dansk",
  "seoTitle": "SEO title tag inkl. restaurantnavn og by",
  "metaDescription": "meta description 150-160 tegn pÃ¥ dansk",
  "extractedWebsiteSummary": "kort opsummering af hvad du fandt pÃ¥ hjemmesiden (eller tom hvis ingen website)"
}

Fokuser pÃ¥ lokal SEO. Brug faktiske oplysninger. Skriv pÃ¥ dansk. Hvis website-indhold er tilgÃ¦ngeligt, brug det til at gÃ¸re forslagene mere prÃ¦cise.`;
}

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

api.saveSeoGeneratorConfig = functions.https.onCall(async (data, context) => {
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

api.seoSiteRenderer = functions.https.onRequest(async (req, res) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");

  const host = (req.headers.host || "").toLowerCase().split(":")[0];
  const match = host.match(/^([a-z0-9-]+)\.madkontrollen\.dk$/);
  if (!match) {
    res.status(400).send("Ugyldigt domÃ¦ne.");
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
        <a href="/index.html" class="hero-btn hero-btn--primary">GÃ¥ til forsiden</a>
        <a href="/index.html#menu" class="hero-btn hero-btn--secondary">Se menu</a>
        ${phone ? `<a href="tel:${phone}" class="hero-btn hero-btn--ghost">Ring nu</a>` : ""}
        ${externalWebsite ? `<a href="${externalWebsite}" class="hero-btn hero-btn--ghost" target="_blank" rel="noopener">BesÃ¸g vores hjemmeside</a>` : ""}
      </div>
    </div>
  </div>
  <div class="content">${sectionsHtml}</div>
  <footer class="footer">
    <div class="footer-info">
      <p><strong>${companyName}</strong></p>
      <p>${address}</p>
      <p>Telefon: ${phone}</p>
      <p style="margin-top:20px;"><a href="/index.html" style="color:#fff;text-decoration:underline;">â† Tilbage til forsiden</a></p>
      ${externalWebsite ? `<p><a href="${externalWebsite}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline;">BesÃ¸g vores hjemmeside â†’</a></p>` : ""}
    </div>
  </footer>
</div>
</body>
</html>`;

  res.set("Cache-Control", "public, max-age=300, s-maxage=600");
  res.status(200).type("text/html").send(html);
});

api.generateSeoAiSuggestions = onCall(
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
      throw new HttpsError("invalid-argument", "Mindst restaurantnavn eller kÃ¸kkentype skal angives.");
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
        "OpenAI API-nÃ¸gle mangler. SÃ¦t OPENAI_API_KEY som function secret."
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
                  "Du er en dansk SEO-ekspert specialiseret i lokal restaurant-SEO. Du returnerer ALTID valid JSON uden ekstra tekst. Hvis du er i tvivl, returnÃ©r {}."
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

    // ðŸ”¥ STABIL PARSING (det her var dit problem)
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

    // ðŸ”¥ FALLBACK (sikrer aldrig "no result")
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

api.checkSubdomainAvailability = functions.https.onCall(async (data, context) => {
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

  return api;
};
