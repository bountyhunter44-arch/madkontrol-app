import app from "/core/firebase-config.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { uploadSeoImageToCloudinary } from "/modules/seo/generator/seo-image-cloudinary.js";

const REGION = "us-central1";
const GENERATE_IMAGE_CALLABLE = "generateMenuImageFromDescription";

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanText(value, maxLength = 700) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function buildMenuImagePromptInput(source = {}) {
  return {
    companyId: cleanText(source.companyId, 120),
    organizationId: cleanText(source.organizationId || source.companyId, 120),
    locationId: cleanText(source.locationId, 120),
    title: cleanText(source.title || source.name || source.recipeName, 140),
    description: cleanText(source.description || source.menuDescription, 700),
    category: cleanText(source.category, 80),
    cuisine: cleanText(source.cuisine || source.cuisineType, 80),
    ingredients: toArray(source.ingredients).slice(0, 16),
    language: cleanText(source.language || "da", 12)
  };
}

export async function generateMenuImageDraft(source = {}) {
  const functionsClient = getFunctions(app, REGION);
  const callable = httpsCallable(functionsClient, GENERATE_IMAGE_CALLABLE);
  const response = await callable(buildMenuImagePromptInput(source));
  const data = response.data || {};

  if (!data.ok || !data.imageDataUrl) {
    throw new Error("AI-provider returnerede ikke et billede.");
  }

  return {
    imageDataUrl: data.imageDataUrl,
    imagePrompt: data.imagePrompt || "",
    imageProvider: data.imageProvider || { name: "openai" },
    generatedAt: data.generatedAt || new Date().toISOString(),
    approved: false,
    mediaAssetId: ""
  };
}

export async function uploadApprovedMenuImageToCloudinary({ draft, companyId, locationId, itemId }) {
  if (!draft?.imageDataUrl) {
    throw new Error("Der er intet AI-billede at godkende.");
  }

  const uploaded = await uploadSeoImageToCloudinary(draft.imageDataUrl, {
    companyId,
    locationId,
    domain: "menu",
    role: itemId || "ai-menu-image",
    alt: draft.imagePrompt || "Menu-billede",
    title: draft.imagePrompt || "Menu-billede"
  });

  return {
    imageUrl: uploaded.secureUrl || uploaded.url,
    imagePrompt: draft.imagePrompt || "",
    imageProvider: draft.imageProvider || { name: "openai" },
    generatedAt: draft.generatedAt || new Date().toISOString(),
    mediaAssetId: uploaded.publicId || "",
    cloudinaryPublicId: uploaded.publicId || "",
    cloudinaryAssetId: uploaded.publicId || "",
    width: uploaded.width || null,
    height: uploaded.height || null,
    format: uploaded.format || "",
    image: uploaded,
    approved: true
  };
}
