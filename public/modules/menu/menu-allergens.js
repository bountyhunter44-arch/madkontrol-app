import { resolveCurrentActor } from "/core/auditFields.js";

export const MENU_ALLERGENS = [
  "gluten",
  "krebsdyr",
  "æg",
  "fisk",
  "jordnødder",
  "soja",
  "mælk",
  "nødder",
  "selleri",
  "sennep",
  "sesamfrø",
  "svovldioxid og sulfitter",
  "lupin",
  "bløddyr"
];

const ALLERGEN_RULES = [
  { allergen: "gluten", terms: ["brød", "pasta", "mel", "dej", "hvede", "rug", "byg", "spelt", "couscous", "rasp"] },
  { allergen: "mælk", terms: ["mælk", "fløde", "ost", "smør", "yoghurt", "creme fraiche", "parmesan", "mozzarella"] },
  { allergen: "æg", terms: ["æg", "æggestand", "mayonnaise", "aioli"] },
  { allergen: "fisk", terms: ["laks", "torsk", "fisk", "tun", "sild", "ørred", "rødspætte"] },
  { allergen: "krebsdyr", terms: ["reje", "rejer", "hummer", "krabbe", "krebs", "jomfruhummer"] },
  { allergen: "bløddyr", terms: ["musling", "muslinger", "østers", "blæksprutte", "kammusling"] },
  { allergen: "jordnødder", terms: ["jordnød", "jordnødder", "peanut", "peanuts"] },
  { allergen: "nødder", terms: ["mandel", "mandler", "hasselnød", "valnød", "cashew", "pistacie", "pecan", "macadamia"] },
  { allergen: "soja", terms: ["soja", "soy", "soyasauce", "tofu", "edamame", "miso"] },
  { allergen: "selleri", terms: ["selleri", "knoldselleri", "bladselleri"] },
  { allergen: "sennep", terms: ["sennep", "dijon"] },
  { allergen: "sesamfrø", terms: ["sesam", "sesamfrø", "tahini"] },
  { allergen: "svovldioxid og sulfitter", terms: ["sulfit", "sulfitter", "svovldioxid", "vin", "tørret frugt"] },
  { allergen: "lupin", terms: ["lupin", "lupinmel"] }
];

const NEGATION_RULES = [
  { allergen: "gluten", terms: ["glutenfri", "uden gluten"] },
  { allergen: "mælk", terms: ["mælkefri", "uden mælk", "uden mejeri"] },
  { allergen: "æg", terms: ["æggefri", "uden æg"] },
  { allergen: "fisk", terms: ["uden fisk"] },
  { allergen: "nødder", terms: ["nøddefri", "uden nødder"] },
  { allergen: "jordnødder", terms: ["uden jordnødder", "peanutfri"] },
  { allergen: "soja", terms: ["sojafri", "uden soja"] }
];

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeAllergen(value) {
  return normalizeText(value);
}

export function toAllergenArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => normalizeAllergen(item)).filter(Boolean))];
  }
  return [...new Set(String(value || "")
    .split(",")
    .map((item) => normalizeAllergen(item))
    .filter(Boolean))];
}

function ingredientText(value) {
  if (!Array.isArray(value)) return String(value || "");
  return value.map((item) => {
    if (typeof item === "string") return item;
    return `${item?.name || item?.ingredient || ""} ${item?.amount || item?.quantity || ""}`;
  }).join(" ");
}

function includesTerm(text, term) {
  const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-zæøå0-9])${escaped}([^a-zæøå0-9]|$)`, "i").test(text);
}

function isNegated(text, allergen) {
  if (text.includes("allergenvenlig")) return true;
  const rule = NEGATION_RULES.find((item) => item.allergen === allergen);
  return Boolean(rule?.terms.some((term) => includesTerm(text, term)));
}

export function inferMenuAllergens(source = {}) {
  const text = normalizeText([
    source.name,
    source.title,
    source.recipeName,
    source.category,
    source.description,
    source.menuDescription,
    source.cuisine,
    source.cuisineType,
    ingredientText(source.ingredients)
  ].filter(Boolean).join(" "));
  const manuallyEntered = toAllergenArray(source.allergens || source.verifiedAllergens);
  const suggested = new Set(manuallyEntered.filter((item) => MENU_ALLERGENS.includes(item)));
  const possible = new Set();
  const notes = [];

  for (const rule of ALLERGEN_RULES) {
    const matchedTerms = rule.terms.filter((term) => includesTerm(text, term));
    if (!matchedTerms.length) continue;
    if (isNegated(text, rule.allergen)) {
      possible.add(rule.allergen);
      notes.push(`${rule.allergen}: fundet "${matchedTerms[0]}", men teksten angiver en allergenfri undtagelse.`);
      continue;
    }
    suggested.add(rule.allergen);
    notes.push(`${rule.allergen}: foreslået pga. ${matchedTerms.slice(0, 3).join(", ")}.`);
  }

  const suggestedAllergens = [...suggested];
  const possibleAllergens = [...possible].filter((item) => MENU_ALLERGENS.includes(item) && !suggestedAllergens.includes(item));
  const allergenConfidence = suggestedAllergens.length ? 0.72 : possibleAllergens.length ? 0.45 : 0.25;

  return {
    suggestedAllergens,
    possibleAllergens,
    allergenNotes: notes,
    allergenConfidence,
    allergenVerified: false
  };
}

export function getAllergenSourceSignature(source = {}) {
  return JSON.stringify({
    name: String(source.name || source.recipeName || source.title || "").trim(),
    description: String(source.description || source.menuDescription || "").trim(),
    ingredients: normalizeText(ingredientText(source.ingredients)),
    allergens: toAllergenArray(source.allergens || source.suggestedAllergens || source.verifiedAllergens).sort()
  });
}

export function createAllergenVerificationFields({ user, profile, allergens, source }) {
  const actor = resolveCurrentActor(user, profile);
  const nowIso = new Date().toISOString();
  const verifiedAllergens = toAllergenArray(allergens);
  return {
    allergens: verifiedAllergens,
    verifiedAllergens,
    suggestedAllergens: verifiedAllergens,
    possibleAllergens: [],
    allergenVerified: true,
    allergenVerifiedAt: nowIso,
    allergenVerifiedByUid: actor.uid || "",
    allergenVerifiedByName: actor.name || "",
    allergenVerifiedByEmail: actor.email || "",
    allergenSourceSignature: getAllergenSourceSignature({ ...source, allergens: verifiedAllergens })
  };
}

export function shouldResetAllergenVerification(current = {}, nextSource = {}) {
  if (current.allergenVerified !== true) return false;
  return String(current.allergenSourceSignature || "") !== getAllergenSourceSignature(nextSource);
}
