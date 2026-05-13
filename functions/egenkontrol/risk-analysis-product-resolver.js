function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueList(values) {
  return [...new Set(normalizeArray(values).map((v) => normalizeText(v)).filter(Boolean))];
}

function getRestaurantType(profile = {}) {
  return normalizeText(
    profile.restaurantType ||
    profile.businessType ||
    profile.virksomhedstype ||
    profile.concept ||
    profile.cuisineType
  ).toLowerCase();
}

const PRODUCT_PRESETS = {
  asiatisk: [
    "Varme retter",
    "Gryderetter",
    "Forårsruller",
    "Nudler",
    "Risretter",
    "Supper",
    "Kolde retter",
    "Forretter",
    "Salater",
    "Grønt tilbehør",
    "Forudproduceret mad, rester"
  ],
  thai: [
    "Varme retter",
    "Gryderetter",
    "Nudler",
    "Risretter",
    "Supper",
    "Kolde retter",
    "Forretter",
    "Salater",
    "Grønt tilbehør",
    "Forudproduceret mad, rester"
  ],
  kina: [
    "Varme retter",
    "Gryderetter",
    "Forårsruller",
    "Nudler",
    "Risretter",
    "Supper",
    "Kolde retter",
    "Forretter",
    "Forudproduceret mad, rester"
  ],
  sushi: [
    "Sushi",
    "Kolde retter",
    "Forretter",
    "Salater",
    "Supper",
    "Risretter",
    "Forudproduceret mad, rester"
  ],
  pizza: [
    "Pizza",
    "Varme retter",
    "Forretter",
    "Salater",
    "Brødprodukter",
    "Forudproduceret mad, rester"
  ],
  burger: [
    "Burger",
    "Varme retter",
    "Forretter",
    "Salater",
    "Kartoffelprodukter",
    "Forudproduceret mad, rester"
  ],
  cafe: [
    "Kaffe",
    "Kolde retter",
    "Forretter",
    "Salater",
    "Brødprodukter",
    "Dessertprodukter",
    "Drikkevarer"
  ],
  café: [
    "Kaffe",
    "Kolde retter",
    "Forretter",
    "Salater",
    "Brødprodukter",
    "Dessertprodukter",
    "Drikkevarer"
  ],
  grill: [
    "Varme retter",
    "Kødretter",
    "Kartoffelprodukter",
    "Forretter",
    "Salater",
    "Forudproduceret mad, rester"
  ],
  dansk: [
    "Varme retter",
    "Kolde retter",
    "Forretter",
    "Salater",
    "Supper",
    "Smørrebrød",
    "Forudproduceret mad, rester"
  ],
  bager: [
    "Brødprodukter",
    "Bagværk",
    "Dessertprodukter"
  ],
  ishus: [
    "Is",
    "Softice",
    "Dessertprodukter",
    "Drikkevarer"
  ]
};

const INGREDIENT_PRESETS = {
  asiatisk: [
    "Pasteuriserede æg",
    "Rå fisk og skaldyr",
    "Varmebehandlet kød, fisk, pålæg o.lign.",
    "Frugt",
    "Grøntsager",
    "Kartofler",
    "Svampe",
    "Nødder og frø",
    "Ris, pasta og tørrede bønner",
    "Mel, korn og kornprodukter",
    "Pasteuriserede mælkeprodukter",
    "Vegetabilske fedtstoffer",
    "Frosne råvarer",
    "Rå æg",
    "Råt kød",
    "Frosne bær"
  ],
  thai: [
    "Rå fisk og skaldyr",
    "Varmebehandlet kød, fisk, pålæg o.lign.",
    "Frugt",
    "Grøntsager",
    "Svampe",
    "Nødder og frø",
    "Ris, pasta og tørrede bønner",
    "Vegetabilske fedtstoffer",
    "Frosne råvarer",
    "Råt kød"
  ],
  kina: [
    "Varmebehandlet kød, fisk, pålæg o.lign.",
    "Frugt",
    "Grøntsager",
    "Svampe",
    "Ris, pasta og tørrede bønner",
    "Vegetabilske fedtstoffer",
    "Frosne råvarer",
    "Råt kød"
  ],
  sushi: [
    "Rå fisk og skaldyr",
    "Frugt",
    "Grøntsager",
    "Ris, pasta og tørrede bønner",
    "Vegetabilske fedtstoffer",
    "Isterninger"
  ],
  pizza: [
    "Mel, korn og kornprodukter",
    "Brød og brødprodukter",
    "Pasteuriserede mælkeprodukter",
    "Grøntsager",
    "Vegetabilske fedtstoffer",
    "Varmebehandlet kød, fisk, pålæg o.lign."
  ],
  burger: [
    "Brød og brødprodukter",
    "Råt kød",
    "Varmebehandlet kød, fisk, pålæg o.lign.",
    "Grøntsager",
    "Pasteuriserede mælkeprodukter",
    "Vegetabilske fedtstoffer"
  ],
  cafe: [
    "Pasteuriserede mælkeprodukter",
    "Brød og brødprodukter",
    "Frugt",
    "Grøntsager",
    "Isterninger",
    "Vegetabilske fedtstoffer"
  ],
  café: [
    "Pasteuriserede mælkeprodukter",
    "Brød og brødprodukter",
    "Frugt",
    "Grøntsager",
    "Isterninger",
    "Vegetabilske fedtstoffer"
  ],
  grill: [
    "Råt kød",
    "Varmebehandlet kød, fisk, pålæg o.lign.",
    "Kartofler",
    "Vegetabilske fedtstoffer",
    "Brød og brødprodukter",
    "Grøntsager"
  ],
  dansk: [
    "Råt kød",
    "Varmebehandlet kød, fisk, pålæg o.lign.",
    "Kartofler",
    "Grøntsager",
    "Brød og brødprodukter",
    "Pasteuriserede mælkeprodukter"
  ],
  bager: [
    "Mel, korn og kornprodukter",
    "Brød og brødprodukter",
    "Pasteuriserede æg",
    "Pasteuriserede mælkeprodukter",
    "Vegetabilske fedtstoffer",
    "Nødder og frø"
  ],
  ishus: [
    "Pasteuriserede mælkeprodukter",
    "Isterninger",
    "Frugt",
    "Vegetabilske fedtstoffer"
  ]
};

function findPreset(map, restaurantType) {
  if (!restaurantType) return [];

  if (map[restaurantType]) return map[restaurantType];

  const entry = Object.keys(map).find((key) => restaurantType.includes(key));
  return entry ? map[entry] : [];
}

function getCustomProducts(profile = {}) {
  return uniqueList(
    profile.products ||
    profile.produkter ||
    profile.generatedProducts ||
    profile.menuCategories
  );
}

function getCustomIngredients(profile = {}) {
  return uniqueList(
    profile.ingredients ||
    profile.ingredienser ||
    profile.generatedIngredients
  );
}

function mergeProducts(baseProducts = [], profile = {}) {
  const restaurantType = getRestaurantType(profile);
  const presetProducts = findPreset(PRODUCT_PRESETS, restaurantType);
  const customProducts = getCustomProducts(profile);

  return uniqueList([
    ...baseProducts,
    ...presetProducts,
    ...customProducts
  ]);
}

function mergeIngredients(baseIngredients = [], profile = {}) {
  const restaurantType = getRestaurantType(profile);
  const presetIngredients = findPreset(INGREDIENT_PRESETS, restaurantType);
  const customIngredients = getCustomIngredients(profile);

  return uniqueList([
    ...baseIngredients,
    ...presetIngredients,
    ...customIngredients
  ]);
}

export function applyRestaurantProfileToRiskItems(items = [], profile = {}) {
  return normalizeArray(items).map((item) => ({
    ...item,
    produkter: mergeProducts(item.produkter, profile),
    ingredienser: mergeIngredients(item.ingredienser, profile)
  }));
}
