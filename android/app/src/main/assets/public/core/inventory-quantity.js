const WEIGHT_UNITS_TO_G = {
  mg: 0.001,
  milligram: 0.001,
  milligramme: 0.001,
  g: 1,
  gram: 1,
  kg: 1000,
  kilo: 1000,
  ton: 1000000,
  tons: 1000000
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

export const INVENTORY_CONVERSION_MATRIX = {
  weight: { baseUnit: "g", units: WEIGHT_UNITS_TO_G },
  volume: { baseUnit: "ml", units: VOLUME_UNITS_TO_ML },
  count: { baseUnit: "stk", units: Object.fromEntries([...COUNT_UNITS].map((unit) => [unit, 1])) }
};

export function normalizeInventoryQuantity(input = {}) {
  const quantity = cleanNumber(input.quantity, 0);
  const packageUnit = normalizeInventoryUnit(input.packageUnit || input.unit || input.originalUnit || "stk");
  const unitsPerPackage = Math.max(1, cleanNumber(input.unitsPerPackage || input.itemsPerPackage || input.packSizeCount, 1));
  const packageSize = cleanNumber(input.packageSize || input.unitSize || input.sizePerUnit, 0);
  const packageSizeUnit = normalizeInventoryUnit(input.packageSizeUnit || input.unitSizeUnit || input.sizeUnit || "");
  const directUnit = normalizeInventoryUnit(input.unit || input.originalUnit || input.normalizedUnit || "");
  const alcoholBottleSizeCl = cleanNumber(input.bottleSizeCl || input.flaskestørrelseCl || 0, 0);
  const alcoholRemainingCl = cleanNumber(input.currentCl || input.remainingCl || input.restindholdCl || 0, 0);

  let unitType = String(input.unitType || "").trim().toLowerCase();
  let baseUnit = String(input.baseUnit || "").trim().toLowerCase();
  let normalizedUnit = "";
  let normalizedQuantity = 0;
  let sourceUnit = "";

  if (packageSize > 0 && packageSizeUnit) {
    const sizeInfo = convertToBase(packageSize, packageSizeUnit);
    unitType = unitType || sizeInfo.unitType;
    baseUnit = baseUnit || sizeInfo.baseUnit;
    normalizedUnit = sizeInfo.baseUnit;
    normalizedQuantity = quantity * unitsPerPackage * sizeInfo.value;
    sourceUnit = packageSizeUnit;
  } else if (directUnit) {
    const directInfo = convertToBase(quantity, directUnit);
    unitType = unitType || directInfo.unitType;
    baseUnit = baseUnit || directInfo.baseUnit;
    normalizedUnit = directInfo.baseUnit;
    normalizedQuantity = directInfo.value;
    sourceUnit = directUnit;
  } else {
    unitType = unitType || "count";
    baseUnit = baseUnit || "stk";
    normalizedUnit = "stk";
    normalizedQuantity = quantity * unitsPerPackage;
    sourceUnit = packageUnit || "stk";
  }

  if (!unitType) unitType = inferUnitType(normalizedUnit || sourceUnit);
  if (!baseUnit) baseUnit = unitType === "weight" ? "g" : unitType === "volume" ? "ml" : "stk";
  if (!normalizedUnit) normalizedUnit = baseUnit;

  const totalCl = normalizedUnit === "ml" ? normalizedQuantity / 10 : 0;
  const calculatedBottles = alcoholBottleSizeCl > 0
    ? (alcoholRemainingCl > 0 ? alcoholRemainingCl : totalCl) / alcoholBottleSizeCl
    : 0;

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
    displayQuantity: formatInventoryQuantity(normalizedQuantity, normalizedUnit),
    displaySecondary: formatInventorySecondaryQuantity(normalizedQuantity, normalizedUnit),
    totalCl: roundQuantity(totalCl),
    bottleSizeCl: alcoholBottleSizeCl,
    remainingCl: alcoholRemainingCl,
    calculatedBottles: roundQuantity(calculatedBottles)
  };
}

export function normalizeInventoryUnit(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  return raw
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .replace(/\s+/g, "");
}

export function formatInventoryQuantity(value, unit) {
  return `${formatInventoryNumber(value)} ${unit || ""}`.trim();
}

export function formatInventorySecondaryQuantity(value, unit) {
  if (unit === "g" && Math.abs(value) >= 1000) return `${formatInventoryNumber(value / 1000)} kg`;
  if (unit === "ml" && Math.abs(value) >= 1000) return `${formatInventoryNumber(value / 10)} cl / ${formatInventoryNumber(value / 1000)} liter`;
  if (unit === "ml" && Math.abs(value) >= 10) return `${formatInventoryNumber(value / 10)} cl`;
  return "";
}

export function cleanNumber(value, fallback = 0) {
  const numeric = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function convertToBase(value, unit) {
  const normalized = normalizeInventoryUnit(unit);
  if (Object.prototype.hasOwnProperty.call(WEIGHT_UNITS_TO_G, normalized)) {
    return {
      unitType: "weight",
      baseUnit: "g",
      value: value * WEIGHT_UNITS_TO_G[normalized]
    };
  }
  if (Object.prototype.hasOwnProperty.call(VOLUME_UNITS_TO_ML, normalized)) {
    return {
      unitType: "volume",
      baseUnit: "ml",
      value: value * VOLUME_UNITS_TO_ML[normalized]
    };
  }
  return {
    unitType: "count",
    baseUnit: "stk",
    value
  };
}

function inferUnitType(unit) {
  const normalized = normalizeInventoryUnit(unit);
  if (Object.prototype.hasOwnProperty.call(WEIGHT_UNITS_TO_G, normalized)) return "weight";
  if (Object.prototype.hasOwnProperty.call(VOLUME_UNITS_TO_ML, normalized)) return "volume";
  return "count";
}

function roundQuantity(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.round(Number(value) * 1000000) / 1000000;
}

function formatInventoryNumber(value) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 3 }).format(cleanNumber(value));
}
