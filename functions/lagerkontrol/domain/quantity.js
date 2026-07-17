const WEIGHT_UNITS_TO_G = {
  mg: 0.001,
  milligram: 0.001,
  milligramme: 0.001,
  g: 1,
  gram: 1,
  kg: 1000,
  kilo: 1000,
  ton: 1000000
};

const VOLUME_UNITS_TO_ML = {
  ml: 1,
  milliliter: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  liter: 1000,
  litre: 1000
};

const COUNT_UNITS = new Set([
  "stk",
  "styk",
  "stykker",
  "flaske",
  "flasker",
  "daase",
  "daaser",
  "dase",
  "daser",
  "dåse",
  "dåser",
  "pakke",
  "pakker",
  "pose",
  "poser",
  "kasse",
  "kasser",
  "bakke",
  "bakker",
  "boette",
  "boetter",
  "bøtte",
  "bøtter",
  "dunk",
  "dunke"
]);

function normalizeInventoryQuantity(input = {}) {
  const quantity = cleanNumber(input.quantity, 0);
  const packageUnit = normalizeUnit(input.packageUnit || input.unit || input.originalUnit || "stk");
  const unitsPerPackage = Math.max(1, cleanNumber(input.unitsPerPackage || input.itemsPerPackage || input.packSizeCount, 1));
  const packageSize = cleanNumber(input.packageSize || input.unitSize || input.sizePerUnit, 0);
  const packageSizeUnit = normalizeUnit(input.packageSizeUnit || input.unitSizeUnit || input.sizeUnit || "");
  const directUnit = normalizeUnit(input.unit || input.originalUnit || input.normalizedUnit || "");
  const remainingCl = cleanNumber(input.remainingCl || input.currentCl || input.restindholdCl || 0, 0);
  const bottleSizeCl = cleanNumber(input.bottleSizeCl || input.flaskestoerrelseCl || input.flaskestørrelseCl || 0, 0);

  let unitType = String(input.unitType || "").trim().toLowerCase();
  let baseUnit = String(input.baseUnit || "").trim().toLowerCase();
  let normalizedQuantity = 0;
  let normalizedUnit = "";

  if (packageSize > 0 && packageSizeUnit) {
    const convertedPackageSize = convertToBase(packageSize, packageSizeUnit);
    unitType = unitType || convertedPackageSize.unitType;
    baseUnit = baseUnit || convertedPackageSize.baseUnit;
    normalizedUnit = convertedPackageSize.baseUnit;
    normalizedQuantity = quantity * unitsPerPackage * convertedPackageSize.value;
  } else if (directUnit) {
    const direct = convertToBase(quantity, directUnit);
    unitType = unitType || direct.unitType;
    baseUnit = baseUnit || direct.baseUnit;
    normalizedUnit = direct.baseUnit;
    normalizedQuantity = direct.value;
  } else {
    unitType = unitType || "count";
    baseUnit = baseUnit || "stk";
    normalizedUnit = "stk";
    normalizedQuantity = quantity * unitsPerPackage;
  }

  if (remainingCl > 0) {
    const remaining = convertToBase(remainingCl, "cl");
    unitType = "volume";
    baseUnit = "ml";
    normalizedUnit = "ml";
    normalizedQuantity += remaining.value;
  }

  if (!unitType) unitType = inferUnitType(normalizedUnit);
  if (!baseUnit) baseUnit = unitType === "weight" ? "g" : unitType === "volume" ? "ml" : "stk";
  if (!normalizedUnit) normalizedUnit = baseUnit;

  const totalCl = normalizedUnit === "ml" ? normalizedQuantity / 10 : 0;
  const calculatedBottles = bottleSizeCl > 0 ? totalCl / bottleSizeCl : 0;

  return {
    unitType,
    baseUnit,
    packageUnit,
    packageSize,
    packageSizeUnit,
    unitsPerPackage,
    quantity,
    originalQuantity: quantity,
    originalUnit: packageUnit || directUnit || normalizedUnit,
    normalizedQuantity: roundQuantity(normalizedQuantity),
    normalizedUnit,
    totalCl: roundQuantity(totalCl),
    bottleSizeCl,
    remainingCl,
    calculatedBottles: roundQuantity(calculatedBottles),
    display: formatDisplay(normalizedQuantity, normalizedUnit)
  };
}

function normalizeUnit(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .replace(/\s+/g, "");
}

function convertToBase(value, unit) {
  const normalized = normalizeUnit(unit);
  if (Object.prototype.hasOwnProperty.call(WEIGHT_UNITS_TO_G, normalized)) {
    return { unitType: "weight", baseUnit: "g", value: value * WEIGHT_UNITS_TO_G[normalized] };
  }
  if (Object.prototype.hasOwnProperty.call(VOLUME_UNITS_TO_ML, normalized)) {
    return { unitType: "volume", baseUnit: "ml", value: value * VOLUME_UNITS_TO_ML[normalized] };
  }
  return { unitType: "count", baseUnit: "stk", value };
}

function inferUnitType(unit) {
  const normalized = normalizeUnit(unit);
  if (Object.prototype.hasOwnProperty.call(WEIGHT_UNITS_TO_G, normalized)) return "weight";
  if (Object.prototype.hasOwnProperty.call(VOLUME_UNITS_TO_ML, normalized)) return "volume";
  return "count";
}

function cleanNumber(value, fallback = 0) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function roundQuantity(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.round(Number(value) * 1000000) / 1000000;
}

function formatDisplay(value, unit) {
  const rounded = roundQuantity(value);
  if (unit === "g" && Math.abs(rounded) >= 1000) return `${formatNumber(rounded / 1000)} kg`;
  if (unit === "ml" && Math.abs(rounded) >= 1000) return `${formatNumber(rounded / 1000)} liter`;
  return `${formatNumber(rounded)} ${unit}`.trim();
}

function formatNumber(value) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 3 }).format(cleanNumber(value));
}

module.exports = {
  normalizeInventoryQuantity,
  normalizeUnit,
  cleanNumber
};
