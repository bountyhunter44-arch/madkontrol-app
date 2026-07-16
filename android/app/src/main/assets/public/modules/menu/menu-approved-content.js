const APPROVED_TEXT_FIELDS = [
  "title",
  "name",
  "recipeName",
  "description",
  "menuDescription",
  "seoTitle",
  "seoDescription",
  "ebookIntro"
];

const APPROVED_MEDIA_FIELDS = [
  "imageUrl",
  "imagePrompt",
  "mediaAssetId",
  "cloudinaryPublicId",
  "cloudinaryAssetId"
];

const APPROVED_ALLERGEN_FIELDS = [
  "verifiedAllergens",
  "suggestedAllergens",
  "allergens",
  "allergenVerified",
  "allergenVerifiedAt",
  "allergenVerifiedByUid",
  "allergenVerifiedByName",
  "allergenVerifiedByEmail"
];

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ");
}

function unique(values) {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))];
}

function toArray(value) {
  if (Array.isArray(value)) return unique(value);
  return unique(String(value || "").split(","));
}

function cloneArray(value) {
  return Array.isArray(value) ? value.map((item) => {
    if (!item || typeof item !== "object") return item;
    return { ...item };
  }) : [];
}

function ingredientSignature(value) {
  if (!Array.isArray(value)) return normalizeText(value);
  return normalizeText(value.map((item) => {
    if (typeof item === "string") return item;
    return `${item?.name || item?.ingredient || ""} ${item?.amount || item?.quantity || ""}`;
  }).join(" "));
}

function instructionSignature(value) {
  if (!Array.isArray(value)) return normalizeText(value);
  return normalizeText(value.map((item) => String(item || "")).join(" "));
}

export function getApprovedContentSignature(source = {}) {
  return JSON.stringify({
    title: normalizeText(source.recipeName || source.title || source.name),
    description: normalizeText(source.description || source.menuDescription),
    ingredients: ingredientSignature(source.ingredients),
    instructions: instructionSignature(source.instructions || source.steps)
  });
}

export function shouldResetApprovedAllergens(current = {}, nextSource = {}) {
  if (current.allergenVerified !== true) return false;
  const currentSignature = current.approvedContentSignature || current.allergenContentSignature || getApprovedContentSignature(current);
  return String(currentSignature || "") !== getApprovedContentSignature(nextSource);
}

export function createApprovedAllergenCarryoverFields(source = {}) {
  const verifiedAllergens = toArray(source.verifiedAllergens || source.allergens);
  const suggestedAllergens = source.allergenVerified === true
    ? toArray(source.suggestedAllergens || verifiedAllergens)
    : toArray(source.suggestedAllergens);

  return {
    allergens: source.allergenVerified === true ? verifiedAllergens : toArray(source.allergens || suggestedAllergens),
    verifiedAllergens: source.allergenVerified === true ? verifiedAllergens : toArray(source.verifiedAllergens),
    suggestedAllergens,
    allergenVerified: source.allergenVerified === true,
    allergenVerifiedAt: source.allergenVerifiedAt || "",
    allergenVerifiedByUid: source.allergenVerifiedByUid || "",
    allergenVerifiedByName: source.allergenVerifiedByName || "",
    allergenVerifiedByEmail: source.allergenVerifiedByEmail || "",
    approvedContentSignature: source.allergenVerified === true ? getApprovedContentSignature(source) : ""
  };
}

export function copyApprovedContentFields(source = {}, overrides = {}) {
  const merged = { ...source, ...overrides };
  const output = {};

  APPROVED_TEXT_FIELDS.forEach((field) => {
    if (merged[field] !== undefined) output[field] = cleanText(merged[field]);
  });
  APPROVED_MEDIA_FIELDS.forEach((field) => {
    if (merged[field] !== undefined) output[field] = cleanText(merged[field]);
  });
  APPROVED_ALLERGEN_FIELDS.forEach((field) => {
    if (["allergens", "verifiedAllergens", "suggestedAllergens"].includes(field)) {
      output[field] = toArray(merged[field]);
      return;
    }
    if (field === "allergenVerified") {
      output[field] = merged[field] === true;
      return;
    }
    if (merged[field] !== undefined) output[field] = cleanText(merged[field]);
  });

  output.ingredients = cloneArray(merged.ingredients);
  output.instructions = cloneArray(merged.instructions || merged.steps);
  output.steps = cloneArray(merged.steps || merged.instructions);
  output.approvedContentSignature = merged.allergenVerified === true
    ? getApprovedContentSignature(merged)
    : cleanText(merged.approvedContentSignature);
  return output;
}

export function buildApprovedRecipePayload({
  source = {},
  content = {},
  approvedImage = null,
  references = [],
  linkedRecipeIds = [],
  ebookSubRecipeSections = []
} = {}) {
  const imageFields = approvedImage?.imageUrl
    ? {
        imageUrl: approvedImage.imageUrl || "",
        imagePrompt: approvedImage.imagePrompt || "",
        mediaAssetId: approvedImage.mediaAssetId || "",
        cloudinaryPublicId: approvedImage.cloudinaryPublicId || "",
        cloudinaryAssetId: approvedImage.cloudinaryAssetId || ""
      }
    : {};
  const approved = copyApprovedContentFields(source, { ...content, ...imageFields });
  const allergenFields = createApprovedAllergenCarryoverFields({ ...source, ...content });

  return {
    ...approved,
    ...allergenFields,
    menu: {
      category: content.category || source.category || "",
      menuDescription: approved.menuDescription || approved.description || "",
      seoTitle: approved.seoTitle || approved.title || approved.recipeName || approved.name || "",
      seoDescription: approved.seoDescription || approved.description || "",
      ebookIntro: approved.ebookIntro || ""
    },
    recipeReferences: Array.isArray(references) ? references : [],
    subRecipeIds: linkedRecipeIds,
    linkedRecipeIds,
    childRecipeIds: linkedRecipeIds,
    ebookSubRecipeSections: Array.isArray(ebookSubRecipeSections) ? ebookSubRecipeSections : [],
    approvedContentSource: "manual_approval"
  };
}
