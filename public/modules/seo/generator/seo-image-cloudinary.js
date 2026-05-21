import app from "/core/firebase-config.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const REGION = "us-central1";
const CLOUDINARY_SIGNATURE_CALLABLE = "getCloudinarySignature";
const HERO_TRANSFORM = "f_auto,q_auto,c_fill,w_1600,h_900,g_auto";
const OG_TRANSFORM = "f_auto,q_auto,c_fill,w_1200,h_630,g_auto";

function cleanText(value, maxLength = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function isDataImageUrl(value) {
  return /^data:image\//i.test(String(value || "").trim());
}

function isCloudinaryUrl(value) {
  const url = String(value || "");
  return url.includes("res.cloudinary.com") && url.includes("/image/upload/");
}

function buildCloudinaryTransformUrl(rawUrl, transform) {
  const url = String(rawUrl || "").trim();
  if (!isCloudinaryUrl(url)) return url;
  const [prefix, rest] = url.split("/image/upload/");
  const cleanRest = String(rest || "")
    .replace(/^(?:f_auto|q_auto|c_fill|c_fit|c_scale|w_\d+|h_\d+|g_auto|g_[^,/]+|ar_[^,/]+|dpr_[^,/]+),*/g, "")
    .replace(/^\/+/, "");
  return `${prefix}/image/upload/${transform}/${cleanRest}`;
}

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!match) throw new Error("Ugyldig data:image preview.");
  const mimeType = match[1] || "image/png";
  const encoded = match[3] || "";
  const binary = match[2] ? atob(encoded) : decodeURIComponent(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export function normalizeSeoCloudinaryImage(uploadData = {}, metadata = {}) {
  const secureUrl = cleanText(uploadData.secure_url || uploadData.secureUrl || uploadData.url || metadata.secureUrl || metadata.url, 2000);
  const originalUrl = cleanText(metadata.originalUrl || uploadData.originalUrl || secureUrl, 2000);
  const publicId = cleanText(uploadData.public_id || uploadData.publicId || metadata.publicId || metadata.cloudinaryPublicId, 260);
  const optimizedUrl = buildCloudinaryTransformUrl(secureUrl || originalUrl, HERO_TRANSFORM);
  const ogImageUrl = buildCloudinaryTransformUrl(secureUrl || originalUrl, OG_TRANSFORM);

  return {
    url: optimizedUrl || secureUrl || originalUrl,
    secureUrl: secureUrl || originalUrl,
    originalUrl: originalUrl || secureUrl,
    optimizedUrl: optimizedUrl || secureUrl || originalUrl,
    ogImageUrl: ogImageUrl || optimizedUrl || secureUrl || originalUrl,
    publicId,
    width: Number(uploadData.width || metadata.width || 0) || 0,
    height: Number(uploadData.height || metadata.height || 0) || 0,
    format: cleanText(uploadData.format || metadata.format, 40),
    bytes: Number(uploadData.bytes || metadata.bytes || 0) || 0,
    alt: cleanText(metadata.alt || uploadData.alt, 180),
    title: cleanText(metadata.title || uploadData.title || metadata.alt, 180),
    role: cleanText(metadata.role || uploadData.role || "image", 60),
    source: "cloudinary"
  };
}

export function imageContainsDataUrl(value, path = "image") {
  if (!value) return null;
  if (typeof value === "string") return isDataImageUrl(value) ? path : null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = imageContainsDataUrl(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const found = imageContainsDataUrl(nested, `${path}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

export function isUploadedCloudinaryImage(image) {
  if (!image || typeof image !== "object") return false;
  return image.source === "cloudinary" && isCloudinaryUrl(image.secureUrl || image.originalUrl || image.url || image.optimizedUrl);
}

export async function uploadSeoImageToCloudinary(fileOrBlob, {
  companyId,
  locationId,
  domain,
  role,
  alt,
  title
} = {}) {
  console.debug("[seo-image:upload-start]", {
    role: role || "image",
    companyId: Boolean(companyId),
    locationId: Boolean(locationId),
    domain: domain || "",
    type: fileOrBlob?.type || "",
    size: fileOrBlob?.size || 0
  });

  const uploadBlob = typeof fileOrBlob === "string" && isDataImageUrl(fileOrBlob)
    ? dataUrlToBlob(fileOrBlob)
    : fileOrBlob;

  if (!uploadBlob || typeof uploadBlob !== "object") {
    throw new Error("Vælg et billede før upload.");
  }
  if (!String(uploadBlob.type || "").startsWith("image/")) {
    throw new Error("Filen skal være et billede.");
  }

  const functionsClient = getFunctions(app, REGION);
  const getSignature = httpsCallable(functionsClient, CLOUDINARY_SIGNATURE_CALLABLE);
  const cleanRole = cleanText(role || "seo-image", 60);
  const signatureResponse = await getSignature({
    companyId,
    locationId,
    moduleType: "seo",
    itemId: [domain, cleanRole].filter(Boolean).join("__") || cleanRole
  });
  const signatureData = signatureResponse.data || {};

  if (!signatureData.cloudName || !signatureData.signature || !signatureData.apiKey) {
    throw new Error("Cloudinary-signatur kunne ikke oprettes.");
  }

  const formData = new FormData();
  formData.append("file", uploadBlob);
  formData.append("api_key", signatureData.apiKey);
  formData.append("timestamp", String(signatureData.timestamp));
  formData.append("signature", signatureData.signature);
  formData.append("folder", signatureData.folder);
  formData.append("public_id", signatureData.publicId);
  if (signatureData.tags) formData.append("tags", signatureData.tags);
  if (signatureData.context) formData.append("context", signatureData.context);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signatureData.cloudName)}/image/upload`, {
    method: "POST",
    body: formData
  });
  const uploadData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = uploadData?.error?.message || `Cloudinary upload fejlede (${response.status}).`;
    console.error("[seo-image:upload-error]", { role: cleanRole, message });
    throw new Error(message);
  }

  const normalized = normalizeSeoCloudinaryImage(uploadData, {
    alt,
    title,
    role: cleanRole,
    originalUrl: uploadData.secure_url
  });

  console.debug("[seo-image:upload-success]", {
    role: cleanRole,
    publicId: normalized.publicId,
    width: normalized.width,
    height: normalized.height,
    bytes: normalized.bytes
  });
  console.debug("[seo-image:normalized]", normalized);
  return normalized;
}

if (typeof window !== "undefined") {
  window.uploadSeoImageToCloudinary = uploadSeoImageToCloudinary;
}
