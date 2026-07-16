import { getInventoryItemsList } from "../adapters/firestore-adapter.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstValue(raw = {}, keys = []) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") return raw[key];
  }
  return null;
}

export function normalizeInventoryItem(raw = {}) {
  return {
    id: raw.id || raw.itemId || raw.docId || "",
    name: firstValue(raw, ["name", "productName", "itemName", "title"]) || "Ukendt vare",
    category: firstValue(raw, ["category", "haccpCategory", "accountingCategory"]) || "Ikke angivet",
    unit: firstValue(raw, ["unit", "normalizedUnit", "baseUnit", "packageUnit"]) || "",
    quantity: firstValue(raw, ["quantity", "currentQuantity", "normalizedQuantity", "stockQty"]),
    minQuantity: firstValue(raw, ["minQuantity", "parLevel", "minimumQuantity", "reorderPoint"]),
    costPrice: firstValue(raw, ["costPrice", "purchasePrice", "pricePerNormalizedUnit"]),
    salesPrice: firstValue(raw, ["salesPrice", "recommendedSalesPrice", "menuSalesPrice"]),
    active: raw.active !== false && raw.isActive !== false,
    updatedAt: firstValue(raw, ["updatedAt", "createdAt", "lastSeenAt"])
  };
}

export function normalizeInventoryItems(rawItems = []) {
  return asArray(rawItems)
    .map(normalizeInventoryItem)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "da"));
}

export function createEmptyInventoryItems(reason = "Ingen varer fundet i staging read-only.") {
  return {
    ok: true,
    source: "empty",
    items: [],
    warnings: reason ? [reason] : []
  };
}

export async function loadInventoryItems(context, options = {}) {
  if (options.mockItems) {
    return {
      ok: true,
      source: "mock",
      items: normalizeInventoryItems(options.mockItems),
      warnings: []
    };
  }

  if (!context?.companyId) {
    return createEmptyInventoryItems("Vareliste read-only mangler companyId og viser tom staging-status.");
  }

  try {
    const result = await getInventoryItemsList(context, options);
    return {
      ok: result.ok !== false,
      source: result.source || "empty",
      items: normalizeInventoryItems(result.items),
      warnings: asArray(result.warnings)
    };
  } catch (error) {
    return createEmptyInventoryItems(`Vareliste read-only kunne ikke hente data: ${error?.message || error}`);
  }
}
