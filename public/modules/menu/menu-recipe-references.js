export const BASE_RECIPE_CATEGORIES = [
  "Brød",
  "Flutes",
  "Franskbrød",
  "Rugbrød",
  "Surdej",
  "Pizzadej",
  "Burgerboller",
  "Dressinger",
  "Saucer",
  "Cremes",
  "Grundtilberedninger"
];

export const RECIPE_REFERENCE_RULES = [
  {
    referenceKey: "bread",
    referenceLabel: "brød",
    category: "Brød",
    terms: ["brød", "hjemmelavet brød"],
    suggestedOptions: ["franskbrød", "flutes", "rugbrød", "surdejsbrød", "glutenfri brød"]
  },
  {
    referenceKey: "flute",
    referenceLabel: "flute",
    category: "Flutes",
    terms: ["flute", "flutes"],
    suggestedOptions: ["flutes", "franskbrød", "surdejsflutes"]
  },
  {
    referenceKey: "bun",
    referenceLabel: "bolle",
    category: "Burgerboller",
    terms: ["bolle", "boller", "burgerbolle", "burgerboller"],
    suggestedOptions: ["burgerboller", "briocheboller", "glutenfri boller"]
  },
  {
    referenceKey: "rye_bread",
    referenceLabel: "rugbrød",
    category: "Rugbrød",
    terms: ["rugbrød"],
    suggestedOptions: ["rugbrød", "kernerugbrød"]
  },
  {
    referenceKey: "sourdough",
    referenceLabel: "surdejsbrød",
    category: "Surdej",
    terms: ["surdejsbrød", "surdej"],
    suggestedOptions: ["surdejsbrød", "surdejsbase"]
  },
  {
    referenceKey: "pizza_dough",
    referenceLabel: "pizzadej",
    category: "Pizzadej",
    terms: ["pizzadej", "pizza dej"],
    suggestedOptions: ["pizzadej", "surdejspizzadej"]
  },
  {
    referenceKey: "pasta",
    referenceLabel: "pasta",
    category: "Grundtilberedninger",
    terms: ["pasta"],
    suggestedOptions: ["frisk pasta", "pastadej", "glutenfri pasta"]
  },
  {
    referenceKey: "dressing",
    referenceLabel: "dressing",
    category: "Dressinger",
    terms: ["dressing", "dressinger"],
    suggestedOptions: ["urtedressing", "vinaigrette", "cremet dressing"]
  },
  {
    referenceKey: "sauce",
    referenceLabel: "sauce",
    category: "Saucer",
    terms: ["sauce", "saucer"],
    suggestedOptions: ["grundsauce", "hvid sauce", "brun sauce"]
  },
  {
    referenceKey: "pesto",
    referenceLabel: "pesto",
    category: "Saucer",
    terms: ["pesto"],
    suggestedOptions: ["basilikumpesto", "rød pesto", "nøddefri pesto"]
  },
  {
    referenceKey: "mayonnaise",
    referenceLabel: "mayonnaise",
    category: "Dressinger",
    terms: ["mayonnaise", "mayo"],
    suggestedOptions: ["mayonnaise", "æggefri mayonnaise"]
  },
  {
    referenceKey: "fond",
    referenceLabel: "fond",
    category: "Grundtilberedninger",
    terms: ["fond"],
    suggestedOptions: ["grøntsagsfond", "kyllingefond", "fiskefond"]
  },
  {
    referenceKey: "creme",
    referenceLabel: "creme",
    category: "Cremes",
    terms: ["creme", "urtecreme"],
    suggestedOptions: ["urtecreme", "ostecreme", "mælkefri creme"]
  },
  {
    referenceKey: "aioli",
    referenceLabel: "aioli",
    category: "Dressinger",
    terms: ["aioli"],
    suggestedOptions: ["aioli", "æggefri aioli"]
  }
];

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function toArray(value) {
  if (Array.isArray(value)) return unique(value);
  return unique(String(value || "").split(","));
}

function ingredientText(value) {
  if (!Array.isArray(value)) return String(value || "");
  return value.map((item) => {
    if (typeof item === "string") return item;
    return `${item?.name || item?.ingredient || ""} ${item?.amount || item?.quantity || ""}`;
  }).join(" ");
}

function instructionText(value) {
  if (!Array.isArray(value)) return String(value || "");
  return value.map((item) => String(item || "")).join(" ");
}

function includesTerm(text, term) {
  const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-zæøå0-9])${escaped}([^a-zæøå0-9]|$)`, "i").test(text);
}

function recipeName(recipe = {}) {
  return String(recipe.recipeName || recipe.name || recipe.title || "").trim();
}

function recipeText(recipe = {}) {
  return normalizeText([
    recipeName(recipe),
    recipe.category,
    recipe.referenceLabel,
    recipe.description,
    recipe.menuDescription,
    ingredientText(recipe.ingredients)
  ].filter(Boolean).join(" "));
}

function candidateText(source = {}) {
  return normalizeText([
    source.name,
    source.title,
    source.recipeName,
    source.category,
    source.description,
    source.menuDescription,
    source.cuisine,
    source.cuisineType,
    ingredientText(source.ingredients),
    instructionText(source.instructions || source.steps)
  ].filter(Boolean).join(" "));
}

function normalizeReference(raw = {}) {
  const rule = RECIPE_REFERENCE_RULES.find((item) => item.referenceKey === raw.referenceKey);
  const referenceKey = String(raw.referenceKey || rule?.referenceKey || "").trim();
  const referenceLabel = String(raw.referenceLabel || rule?.referenceLabel || referenceKey || "").trim();
  if (!referenceKey || !referenceLabel) return null;

  return {
    referenceKey,
    referenceLabel,
    referenceRole: String(raw.referenceRole || "base_recipe"),
    category: String(raw.category || rule?.category || "Grundtilberedninger"),
    matchedTerm: String(raw.matchedTerm || ""),
    suggestedOptions: unique(raw.suggestedOptions || rule?.suggestedOptions || [referenceLabel]),
    linkedRecipeId: String(raw.linkedRecipeId || raw.recipeId || ""),
    linkedRecipeName: String(raw.linkedRecipeName || raw.recipeName || ""),
    matches: Array.isArray(raw.matches)
      ? raw.matches.map((match) => ({
          id: String(match?.id || ""),
          name: String(match?.name || match?.recipeName || match?.title || ""),
          category: String(match?.category || "")
        })).filter((match) => match.id)
      : [],
    status: String(raw.status || (raw.linkedRecipeId || raw.recipeId ? "linked" : "missing")),
    action: String(raw.action || (raw.linkedRecipeId || raw.recipeId ? "link_existing_recipe" : "generate_base_recipe")),
    includeInEbook: raw.includeInEbook !== false,
    includeInPrint: raw.includeInPrint !== false
  };
}

export function normalizeRecipeReferences(value) {
  if (!Array.isArray(value)) return [];
  const byKey = new Map();
  value.map(normalizeReference).filter(Boolean).forEach((reference) => {
    byKey.set(reference.referenceKey, { ...byKey.get(reference.referenceKey), ...reference });
  });
  return [...byKey.values()];
}

export function inferRecipeReferenceCandidates(source = {}) {
  const text = candidateText(source);
  if (!text) return [];

  return RECIPE_REFERENCE_RULES
    .map((rule) => {
      const matchedTerm = rule.terms.find((term) => includesTerm(text, normalizeText(term)));
      if (!matchedTerm) return null;
      return normalizeReference({
        ...rule,
        matchedTerm,
        status: "missing",
        action: "generate_base_recipe"
      });
    })
    .filter(Boolean);
}

export function findMatchingRecipes(candidate = {}, recipes = []) {
  const labels = unique([
    candidate.referenceLabel,
    candidate.category,
    ...(candidate.suggestedOptions || [])
  ]).map(normalizeText);

  return recipes
    .filter((recipe) => {
      if (!recipe?.id) return false;
      const type = String(recipe.recipeType || "").trim();
      const searchable = recipeText(recipe);
      const isRecipe = recipe.stateType === "recipe" || recipe.kind === "menu_recipe";
      const typeMatches = !type || ["base_recipe", "sub_recipe", "main_recipe"].includes(type);
      return isRecipe && typeMatches && labels.some((label) => label && includesTerm(searchable, label));
    })
    .slice(0, 5);
}

export function buildRecipeReferences({ source = {}, recipes = [], existingReferences = [] } = {}) {
  const byKey = new Map();
  normalizeRecipeReferences(existingReferences).forEach((reference) => byKey.set(reference.referenceKey, reference));
  inferRecipeReferenceCandidates(source).forEach((candidate) => {
    byKey.set(candidate.referenceKey, { ...candidate, ...byKey.get(candidate.referenceKey) });
  });

  return [...byKey.values()].map((reference) => {
    const matches = findMatchingRecipes(reference, recipes);
    const linked = reference.linkedRecipeId
      ? recipes.find((recipe) => recipe.id === reference.linkedRecipeId) || null
      : matches[0] || null;

    if (!linked) {
      return {
        ...reference,
        matches: matches.map((recipe) => ({ id: recipe.id, name: recipeName(recipe), category: recipe.category || "" })),
        status: "missing",
        action: "generate_base_recipe"
      };
    }

    return {
      ...reference,
      linkedRecipeId: linked.id,
      linkedRecipeName: recipeName(linked),
      matches: matches.map((recipe) => ({ id: recipe.id, name: recipeName(recipe), category: recipe.category || "" })),
      status: "linked",
      action: "link_existing_recipe"
    };
  });
}

export function getLinkedRecipeIds(references = []) {
  return unique(normalizeRecipeReferences(references).map((reference) => reference.linkedRecipeId));
}

export function mergeReferenceAllergens(baseAllergens = [], references = [], recipes = []) {
  const linkedIds = new Set(getLinkedRecipeIds(references));
  const inherited = recipes
    .filter((recipe) => linkedIds.has(recipe.id))
    .flatMap((recipe) => [
      ...(Array.isArray(recipe.allergens) ? recipe.allergens : []),
      ...(Array.isArray(recipe.verifiedAllergens) ? recipe.verifiedAllergens : []),
      ...(Array.isArray(recipe.suggestedAllergens) ? recipe.suggestedAllergens : [])
    ]);
  return unique([...toArray(baseAllergens), ...inherited].map(normalizeText));
}

export function buildEbookSubRecipeSections(references = [], recipes = []) {
  const linkedIds = new Set(getLinkedRecipeIds(references));
  return recipes
    .filter((recipe) => linkedIds.has(recipe.id))
    .map((recipe) => {
      const reference = references.find((item) => item.linkedRecipeId === recipe.id) || {};
      const label = reference.referenceLabel || recipeName(recipe) || "grundopskriften";
      return {
        recipeId: recipe.id,
        referenceLabel: label,
        title: `Sådan laver du ${label}`,
        ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
        instructions: Array.isArray(recipe.instructions) ? recipe.instructions : Array.isArray(recipe.steps) ? recipe.steps : [],
        allergens: toArray(recipe.verifiedAllergens || recipe.allergens || recipe.suggestedAllergens),
        includeInEbook: reference.includeInEbook !== false,
        includeInPrint: reference.includeInPrint !== false
      };
    });
}
