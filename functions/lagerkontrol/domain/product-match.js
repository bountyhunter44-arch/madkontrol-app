const { normalizeUnit } = require("./quantity");

function normalizeProductName(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function findOrCreateInventoryItem({ firestore, companyId, locationId, payload, normalized, now, uid }) {
  const collectionRef = firestore.companyCollection(companyId, "lager_inventory_items");
  const normalizedName = normalizeProductName(payload.extracted.productName);
  const existing = await firestore.findInventoryItemByName({ companyId, locationId, normalizedName });

  if (existing) return existing;

  const itemDoc = {
    companyId,
    locationId,
    productName: payload.extracted.productName,
    normalizedName,
    category: payload.extracted.category || "kolonial",
    supplier: payload.extracted.supplier || "",
    unitType: normalized.unitType,
    baseUnit: normalized.baseUnit,
    normalizedUnit: normalized.normalizedUnit,
    packageUnit: normalized.packageUnit,
    packageSize: normalized.packageSize,
    packageSizeUnit: normalized.packageSizeUnit,
    unitsPerPackage: normalized.unitsPerPackage,
    quantity: 0,
    normalizedQuantity: 0,
    pricePerNormalizedUnit: normalized.normalizedQuantity > 0
      ? Number(payload.extracted.price || 0) / normalized.normalizedQuantity
      : 0,
    status: "suggested_approved",
    source: payload.source,
    createdBy: uid,
    updatedBy: uid,
    createdAt: now,
    updatedAt: now
  };

  const ref = await collectionRef.add(itemDoc);
  return { id: ref.id, ...itemDoc };
}

module.exports = {
  findOrCreateInventoryItem,
  normalizeProductName,
  normalizeUnit
};
