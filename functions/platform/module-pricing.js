"use strict";

const VAT_RATE = 0.25;

const PLATFORM_MODULE_PRICING = {
  egenkontrol: {
    key: "egenkontrol",
    name: "Egenkontrol",
    monthlyPriceIncVat: 186.25,
    yearlyPriceIncVat: 2011.50,
    monthlyStripePriceId: "price_1TRoYFRCwSF2n9HHMa6Y2yeR",
    yearlyStripePriceId: "price_1TRoYFRCwSF2n9HHmjSZ9Ami",
    taxBehavior: "inclusive",
    required: false
  },
  pos: {
    key: "pos",
    name: "POS",
    monthlyPriceExVat: 49,
    stripePriceId: "price_1TekYYRCwSF2n9HHHmIfKeqe",
    taxBehavior: "exclusive",
    required: false
  },
  lagerkontrol: {
    key: "lagerkontrol",
    name: "Lagerkontrol",
    monthlyPriceExVat: 49,
    stripePriceId: "price_1TekbuRCwSF2n9HHs11QdxDa",
    taxBehavior: "exclusive",
    required: false
  },
  menu: {
    key: "menu",
    name: "Opskrifter/Menu",
    monthlyPriceExVat: 29,
    stripePriceId: "price_1TekcqRCwSF2n9HHfVDuwBNK",
    taxBehavior: "exclusive",
    required: false
  },
  seo: {
    key: "seo",
    name: "SEO",
    monthlyPriceExVat: 49,
    stripePriceId: "price_1TekddRCwSF2n9HHkbkLUIr5",
    taxBehavior: "exclusive",
    required: false
  },
  koerselskontrol: {
    key: "koerselskontrol",
    name: "Kørekontrol",
    monthlyPriceExVat: 49,
    stripePriceId: "price_1TekeqRCwSF2n9HHULfVO7Ra",
    taxBehavior: "exclusive",
    required: false
  },
  bogforing: {
    key: "bogforing",
    name: "Bogføring",
    monthlyPriceExVat: 49,
    stripePriceId: "price_1TekfYRCwSF2n9HHjPZjXgMG",
    taxBehavior: "exclusive",
    required: false
  }
};

function normalizeSelectedModules(selectedModules = []) {
  const validKeys = new Set(Object.keys(PLATFORM_MODULE_PRICING));
  return [...new Set((Array.isArray(selectedModules) ? selectedModules : [])
    .map(normalizeModuleKey)
    .filter((key) => validKeys.has(key)))];
}

function normalizeModuleKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  const compact = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]/g, "");
  const aliases = {
    koersel: "koerselskontrol",
    koerekontrol: "koerselskontrol",
    "kørekontrol": "koerselskontrol",
    "kørselskontrol": "koerselskontrol",
    "kørekontrol": "koerselskontrol",
    "kørselskontrol": "koerselskontrol",
    "kørsel": "koerselskontrol",
    "kørsel kontrol": "koerselskontrol",
    "kørsels kontrol": "koerselskontrol",
    driving: "koerselskontrol",
    drivingcontrol: "koerselskontrol",
    koerebog: "koerselskontrol",
    accounting: "bogforing",
    bogfoering: "bogforing",
    "bogføring": "bogforing"
  };
  const compactAliases = {
    korsel: "koerselskontrol",
    koersel: "koerselskontrol",
    korselkontrol: "koerselskontrol",
    koerselkontrol: "koerselskontrol",
    korekontrol: "koerselskontrol",
    koerekontrol: "koerselskontrol",
    korselskontrol: "koerselskontrol",
    koerselskontrol: "koerselskontrol",
    drivingcontrol: "koerselskontrol",
    koerebog: "koerselskontrol",
    korebog: "koerselskontrol",
    bogforing: "bogforing",
    bogfoering: "bogforing"
  };
  return aliases[raw] || compactAliases[compact] || raw;
}

function getStripePriceId(moduleKey, billingInterval = "monthly") {
  const module = PLATFORM_MODULE_PRICING[moduleKey];
  if (!module) return "";
  if (module.taxBehavior === "inclusive" && billingInterval === "yearly") {
    return module.yearlyStripePriceId || "";
  }
  if (module.taxBehavior === "inclusive") {
    return module.monthlyStripePriceId || "";
  }
  return module.stripePriceId || "";
}

function buildStripeLineItems(selectedModules = [], billingInterval = "monthly") {
  return normalizeSelectedModules(selectedModules).map((moduleKey) => {
    const module = PLATFORM_MODULE_PRICING[moduleKey];
    const price = getStripePriceId(moduleKey, billingInterval);
    if (!price || !price.startsWith("price_")) {
      throw new Error(`Stripe price mangler for modulet ${module?.name || moduleKey}`);
    }
    return {
      moduleKey,
      name: module.name,
      taxBehavior: module.taxBehavior,
      price,
      quantity: 1
    };
  });
}

function calculatePlatformPricingSnapshot(selectedModules = [], billingInterval = "monthly") {
  const interval = billingInterval === "yearly" ? "yearly" : "monthly";
  const selected = normalizeSelectedModules(selectedModules);
  const lines = selected.map((key) => {
    const module = PLATFORM_MODULE_PRICING[key];
    const isInclusive = module.taxBehavior === "inclusive";
    const amountExVat = isInclusive ? 0 : Number(module.monthlyPriceExVat || 0);
    const amountIncVat = isInclusive
      ? Number(interval === "yearly" ? module.yearlyPriceIncVat : module.monthlyPriceIncVat || 0)
      : amountExVat * (1 + VAT_RATE);
    return {
      key,
      name: module.name,
      taxBehavior: module.taxBehavior,
      amountExVat,
      vatAmount: isInclusive ? 0 : amountExVat * VAT_RATE,
      amountIncVat
    };
  });

  const exclusiveItems = lines.filter((item) => item.taxBehavior === "exclusive");
  const inclusiveItems = lines.filter((item) => item.taxBehavior === "inclusive");
  const subtotalExVat = roundMoney(exclusiveItems.reduce((sum, item) => sum + item.amountExVat, 0));
  const vatAmount = roundMoney(exclusiveItems.reduce((sum, item) => sum + item.vatAmount, 0));
  const totalIncVat = roundMoney(subtotalExVat + vatAmount);
  const inclusiveTotalIncVat = roundMoney(inclusiveItems.reduce((sum, item) => sum + item.amountIncVat, 0));

  return {
    selectedModules: selected,
    billingInterval: interval,
    exclusiveItems,
    inclusiveItems,
    subtotalExVat,
    vatAmount,
    totalIncVat,
    inclusiveTotalIncVat,
    totalToPayIncVat: roundMoney(totalIncVat + inclusiveTotalIncVat),
    currency: "DKK"
  };
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

module.exports = {
  VAT_RATE,
  PLATFORM_MODULE_PRICING,
  normalizeSelectedModules,
  getStripePriceId,
  buildStripeLineItems,
  calculatePlatformPricingSnapshot
};
