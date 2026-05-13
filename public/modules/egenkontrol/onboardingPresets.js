// SLET FRA HER
export const BUSINESS_TYPES = [
  { value: "pizzeria", label: "Pizzeria" },
  { value: "asian_restaurant", label: "Asiatisk restaurant" },
  { value: "danish_restaurant", label: "Dansk restaurant" },
  { value: "cafe", label: "Café" },
  { value: "grillbar", label: "Grillbar" },
  { value: "bakery", label: "Bageri" },
  { value: "fish_shop", label: "Fiskebutik" },
  { value: "takeaway", label: "Takeaway" },
  { value: "canteen", label: "Kantine" },
  { value: "institution", label: "Institution" },
  { value: "school", label: "Skole" },
  { value: "kiosk", label: "Kiosk" },
  { value: "catering", label: "Catering" }
];

export const ALLERGEN_OPTIONS = [
  "Gluten",
  "Mælk",
  "Æg",
  "Nødder",
  "Peanuts",
  "Soja",
  "Selleri",
  "Sennep",
  "Sesam",
  "Fisk",
  "Krebsdyr",
  "Bløddyr",
  "Lupin",
  "Svovldioxid / sulfitter"
];

export const PRODUCT_PRESETS = {
  pizzeria: [
    "Pizzadej",
    "Ost",
    "Tomatsauce",
    "Skinke",
    "Pepperoni",
    "Kebab",
    "Kylling",
    "Salat",
    "Dressinger",
    "Frostvarer"
  ],
  asian_restaurant: [
    "Ris",
    "Nudler",
    "Kylling",
    "Oksekød",
    "Grøntsager",
    "Saucer",
    "Skaldyr",
    "Tofu",
    "Frostvarer",
    "Krydderier"
  ],
  danish_restaurant: [
    "Kød",
    "Fisk",
    "Grøntsager",
    "Kartofler",
    "Mejeriprodukter",
    "Pålæg",
    "Sovse",
    "Dessertvarer"
  ],
  cafe: [
    "Brød",
    "Pålæg",
    "Mejeriprodukter",
    "Kager",
    "Frugt",
    "Grøntsager",
    "Dressinger",
    "Drikkevarer"
  ],
  grillbar: [
    "Pølser",
    "Bøffer",
    "Kylling",
    "Pommes frites",
    "Dressinger",
    "Brød",
    "Salat",
    "Frostvarer"
  ],
  bakery: [
    "Mel",
    "Gær",
    "Smør",
    "Æg",
    "Creme",
    "Chokolade",
    "Fyld",
    "Frostvarer"
  ],
  fish_shop: [
    "Frisk fisk",
    "Røget fisk",
    "Skaldyr",
    "Is",
    "Pålægssalater",
    "Dressinger"
  ],
  takeaway: [
    "Kød",
    "Kylling",
    "Ris",
    "Nudler",
    "Grøntsager",
    "Saucer",
    "Emballage",
    "Frostvarer"
  ],
  canteen: [
    "Kød",
    "Fisk",
    "Grøntsager",
    "Mejeriprodukter",
    "Brød",
    "Pålæg",
    "Frostvarer"
  ],
  institution: [
    "Kød",
    "Grøntsager",
    "Frugt",
    "Brød",
    "Mejeriprodukter",
    "Frostvarer"
  ],
  school: [
    "Brød",
    "Pålæg",
    "Frugt",
    "Grøntsager",
    "Mejeriprodukter",
    "Frostvarer"
  ],
  kiosk: [
    "Pølser",
    "Brød",
    "Dressinger",
    "Snacks",
    "Drikkevarer",
    "Frostvarer"
  ],
  catering: [
    "Kød",
    "Fisk",
    "Grøntsager",
    "Saucer",
    "Ris",
    "Kartofler",
    "Dessertvarer",
    "Emballage"
  ]
};

export const DEFAULT_LIMITS = {
  fridgeMaxTemp: 5,
  freezerMaxTemp: -18,
  hotHoldingMinTemp: 65,
  reheatingMinTemp: 75,
  coolingMaxTemp: 5
};

export const EQUIPMENT_OPTIONS = [
  { key: "hasWalkInFridge", label: "Walk-in køler" },
  { key: "hasWalkInFreezer", label: "Walk-in fryser" },
  { key: "hasDishwasher", label: "Opvaskemaskine" },
  { key: "hasIceMachine", label: "Isterningemaskine" },
  { key: "hasSoftIceMachine", label: "Softicemaskine" },
  { key: "hasHotHolding", label: "Varmholdelse" },
  { key: "hasCoolingProcess", label: "Nedkøling" },
  { key: "hasReheating", label: "Genopvarmning" },
  { key: "hasReceivingArea", label: "Varemodtagelse" },
  { key: "hasCuttingArea", label: "Opskæringsområde" },
  { key: "hasAllergenSeparation", label: "Adskillelse / allergenhåndtering" },
  { key: "hasDryStorage", label: "Tørvarelager" },
  { key: "hasFishHandling", label: "Fiskehåndtering" },
  { key: "hasBakeryArea", label: "Bageriområde" }
];
// TIL HER