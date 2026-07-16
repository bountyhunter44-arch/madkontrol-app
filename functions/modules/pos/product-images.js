"use strict";

const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const CLOUDINARY_CLOUD_NAME = defineSecret("CLOUDINARY_CLOUD_NAME");
const CLOUDINARY_API_KEY = defineSecret("CLOUDINARY_API_KEY");
const CLOUDINARY_API_SECRET = defineSecret("CLOUDINARY_API_SECRET");
const IMAGE_CONFIG_ERROR = "Billedgenerering er ikke konfigureret endnu.";

function sanitizeString(value, maxLen = 500) {
  return String(value || "").trim().slice(0, maxLen);
}

function toAsciiSlug(value, maxLen = 120) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen) || "asset";
}

function getRuntimeEnv(name) {
  return String(process.env[name] || "").trim();
}

function getCloudinaryConfig() {
  return {
    cloudName: getRuntimeEnv("CLOUDINARY_CLOUD_NAME"),
    apiKey: getRuntimeEnv("CLOUDINARY_API_KEY"),
    apiSecret: getRuntimeEnv("CLOUDINARY_API_SECRET")
  };
}

function cloudinaryThumbnailUrl({ cloudName, publicId, secureUrl }) {
  if (cloudName && publicId) {
    return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,c_fill,g_auto,w_400,h_400/${publicId}`;
  }
  if (secureUrl && secureUrl.includes("/image/upload/")) {
    return secureUrl.replace("/image/upload/", "/image/upload/f_auto,q_auto,c_fill,g_auto,w_400,h_400/");
  }
  return secureUrl || "";
}

async function assertPosLocationAccess(requestData = {}, requestAuth = {}) {
  const uid = sanitizeString(requestAuth?.uid || "", 160);
  const companyId = sanitizeString(requestData.companyId || "", 120);
  const locationId = sanitizeString(requestData.locationId || "", 120);

  if (!uid) {
    throw new HttpsError("unauthenticated", "Log ind for at generere produktbilleder.");
  }
  if (!companyId || !locationId) {
    throw new HttpsError("invalid-argument", "Virksomhedsoplysninger mangler. Gå til onboarding for bedre billeder.");
  }

  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const role = sanitizeString(user.role || "", 80);
  const userCompanyId = sanitizeString(user.companyId || user.organizationId || "", 120);
  const locationIds = Array.isArray(user.locationIds) ? user.locationIds.map(String) : [];
  const primaryLocationId = sanitizeString(user.primaryLocationId || user.locationId || "", 120);
  const email = String(requestAuth?.token?.email || "").toLowerCase();
  const isSuperAdmin = role === "super-admin" && ["mn@aroid.dk", "michael@madkontrollen.dk"].includes(email);
  const hasCompany = userCompanyId === companyId;
  const hasLocation = ["owner", "hq_admin", "admin", "location_manager"].includes(role) ||
    locationIds.includes(locationId) ||
    primaryLocationId === locationId;

  if (!isSuperAdmin && (!hasCompany || !hasLocation)) {
    throw new HttpsError("permission-denied", "Du har ikke adgang til produktbilleder for denne lokation.");
  }

  return { uid, companyId, locationId };
}

async function readDoc(ref) {
  const snap = await ref.get();
  return snap.exists ? snap.data() || {} : {};
}

async function getCompanyProfile({ companyId, locationId }) {
  const [company, location] = await Promise.all([
    readDoc(db.collection("companies").doc(companyId)),
    readDoc(db.collection("companies").doc(companyId).collection("locations").doc(locationId))
  ]);
  return {
    companyName: sanitizeString(location.companyName || company.companyName || company.name || location.name || "", 180),
    cvr: sanitizeString(location.cvr || company.cvr || company.cvrNumber || "", 40).replace(/\D/g, "").slice(0, 8),
    address: sanitizeString(location.address || company.address || "", 240),
    postalCode: sanitizeString(location.postalCode || location.zip || company.postalCode || company.zip || "", 40),
    city: sanitizeString(location.city || company.city || "", 120),
    industryCode: sanitizeString(location.industryCode || company.industryCode || "", 80),
    industryText: sanitizeString(location.industryText || location.industry || company.industryText || company.industry || "", 180),
    phone: sanitizeString(location.phone || company.phone || "", 80),
    email: sanitizeString(location.email || company.email || "", 180),
    activeModules: Array.isArray(company.activeModules) ? company.activeModules : [],
    googlePlace: location.googlePlace || company.googlePlace || null,
    googlePlaceId: sanitizeString(location.googlePlaceId || company.googlePlaceId || "", 180)
  };
}

function normalizeGooglePlace(place = null) {
  if (!place || typeof place !== "object") return null;
  return {
    placeName: sanitizeString(place.name || place.displayName || place.placeName || "", 180),
    placeTypes: Array.isArray(place.types) ? place.types.slice(0, 8).map((item) => sanitizeString(item, 80)) : [],
    city: sanitizeString(place.city || "", 120),
    rating: Number(place.rating || 0) || null,
    businessCategory: sanitizeString(place.businessCategory || place.primaryType || "", 120),
    editorialSummary: sanitizeString(place.editorialSummary || place.summary || "", 300)
  };
}

function buildPosProductImagePrompt({ productName, category, companyProfile = {}, googlePlace = null, brandStyle = {} }) {
  const cleanProductName = sanitizeString(productName || "Produkt", 160);
  const cleanCategory = sanitizeString(category || "Andet", 80);
  const companyName = sanitizeString(companyProfile.companyName || "", 180);
  const city = sanitizeString(companyProfile.city || googlePlace?.city || "", 120);
  const industry = sanitizeString(companyProfile.industryText || googlePlace?.businessCategory || "dansk foodservice", 180);
  const placeTypes = Array.isArray(googlePlace?.placeTypes) ? googlePlace.placeTypes.join(", ") : "";
  const tone = sanitizeString(brandStyle.tone || "moderne, appetitligt, lyst, realistisk, skandinavisk", 220);
  const foodLine = ["Mad", "Drikke", "Tilbehør", "Dessert"].includes(cleanCategory)
    ? "Fokus på retten eller drikken som rent, professionelt produktfoto til et POS-produktkort."
    : "Lav et neutralt professionelt produktfoto, rent og tydeligt som thumbnail.";

  return [
    `Professionelt produktbillede til dansk café, restaurant eller foodtruck.`,
    companyName ? `Virksomhed: ${companyName}.` : "",
    city ? `Lokalområde: ${city}.` : "",
    industry ? `Branche/kontekst: ${industry}.` : "",
    placeTypes ? `Google Places typer: ${placeTypes}.` : "",
    `Produkt: ${cleanProductName}.`,
    `Kategori: ${cleanCategory}.`,
    `Stil: ${tone}, rent bord, naturligt lys, appetitlig komposition.`,
    foodLine,
    "Ingen tekst i billedet. Ingen logoer. Ingen vandmærker. Ingen varemærker fra andre virksomheder. Ingen mennesker som hovedmotiv."
  ].filter(Boolean).join(" ");
}

async function uploadImageToCloudinary({ file, companyId, locationId, productId }) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpsError("failed-precondition", IMAGE_CONFIG_ERROR);
  }

  const crypto = require("crypto");
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `madkontrol/${toAsciiSlug(companyId, 60)}/${toAsciiSlug(locationId, 60)}/pos_products`;
  const publicId = `${toAsciiSlug(productId, 100)}-${Date.now()}`;
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(paramsToSign + apiSecret).digest("hex");
  const uploadParams = new URLSearchParams();
  uploadParams.append("file", file);
  uploadParams.append("folder", folder);
  uploadParams.append("public_id", publicId);
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
    throw new Error(`Cloudinary upload: ${uploadResp.status} - ${errText.slice(0, 200)}`);
  }

  const uploaded = await uploadResp.json();
  return {
    cloudName,
    publicId: uploaded.public_id || publicId,
    secureUrl: uploaded.secure_url || "",
    width: Number(uploaded.width || 0) || null,
    height: Number(uploaded.height || 0) || null,
    format: sanitizeString(uploaded.format || "", 40)
  };
}

const generatePosProductImage = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 180,
    secrets: [OPENAI_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]
  },
  async (request) => {
    const data = request.data || {};
    const access = await assertPosLocationAccess(data, request.auth);
    const productId = sanitizeString(data.productId || "", 120);
    const productName = sanitizeString(data.productName || data.name || "", 180);
    const category = sanitizeString(data.category || "Andet", 80) || "Andet";

    if (!productId || !productName) {
      throw new HttpsError("invalid-argument", "Produktnavn og produkt-id er påkrævet.");
    }

    const apiKey = getRuntimeEnv("OPENAI_API_KEY");
    if (!apiKey) {
      throw new HttpsError("failed-precondition", IMAGE_CONFIG_ERROR);
    }

    const companyProfile = await getCompanyProfile(access);
    const googlePlace = normalizeGooglePlace(companyProfile.googlePlace);
    const prompt = buildPosProductImagePrompt({
      productName,
      category,
      companyProfile,
      googlePlace,
      brandStyle: { tone: "moderne, appetitligt, lyst, realistisk, skandinavisk, grøn Madkontrollen-brandtone" }
    });

    const imageResp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
        output_format: "jpeg",
        output_compression: 85
      })
    });

    if (!imageResp.ok) {
      const errText = await imageResp.text().catch(() => "");
      throw new HttpsError("internal", `Billedgenerering fejlede: ${imageResp.status}. ${errText.slice(0, 160)}`);
    }

    const imageData = await imageResp.json();
    const first = imageData?.data?.[0] || {};
    const generatedFile = first.b64_json
      ? `data:image/jpeg;base64,${first.b64_json}`
      : sanitizeString(first.url || "", 2000);

    if (!generatedFile) {
      throw new HttpsError("internal", "Billedgenerering returnerede ikke et billede.");
    }

    const uploaded = await uploadImageToCloudinary({
      file: generatedFile,
      companyId: access.companyId,
      locationId: access.locationId,
      productId
    });

    const image = {
      provider: "cloudinary",
      cloudinaryPublicId: uploaded.publicId,
      secureUrl: uploaded.secureUrl,
      thumbnailUrl: cloudinaryThumbnailUrl({
        cloudName: uploaded.cloudName,
        publicId: uploaded.publicId,
        secureUrl: uploaded.secureUrl
      }),
      width: uploaded.width,
      height: uploaded.height,
      format: uploaded.format,
      alt: productName,
      source: "generated",
      prompt,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db
      .collection("companies").doc(access.companyId)
      .collection("locations").doc(access.locationId)
      .collection("pos_products").doc(productId)
      .set({
        image,
        imageUrl: image.secureUrl,
        imageAlt: image.alt,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

    return { ok: true, image, prompt, googlePlaceUsed: Boolean(googlePlace) };
  }
);

module.exports = {
  generatePosProductImage,
  buildPosProductImagePrompt
};
