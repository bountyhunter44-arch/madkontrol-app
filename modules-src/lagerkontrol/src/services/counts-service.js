import { getInventoryCountsList } from "../adapters/firestore-adapter.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstValue(raw = {}, keys = []) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") return raw[key];
  }
  return null;
}

function normalizeCountLine(raw = {}) {
  return {
    id: raw.id || raw.lineId || raw.itemId || "",
    itemName: firstValue(raw, ["itemName", "productName", "name", "title"]) || "Ukendt vare",
    itemNumber: firstValue(raw, ["itemNumber", "sku", "varenummer", "productNumber"]) || "",
    ean: firstValue(raw, ["ean", "barcode", "gtin"]) || "",
    expectedQuantity: firstValue(raw, ["expectedQuantity", "expectedStock", "systemQuantity", "currentQuantity", "bookQuantity"]),
    countedQuantity: firstValue(raw, ["countedQuantity", "countedStock", "actualQuantity", "quantity"]),
    difference: firstValue(raw, ["difference", "quantityDifference", "variance"]),
    unit: firstValue(raw, ["unit", "normalizedUnit", "packageUnit"]) || "",
    batch: firstValue(raw, ["batch", "batchNumber", "lot", "lotNumber"]) || "",
    expiryDate: firstValue(raw, ["expiryDate", "expirationDate", "bestBeforeDate", "useByDate"]),
    note: firstValue(raw, ["note", "comment", "remark"]) || ""
  };
}

export function normalizeInventoryCount(raw = {}) {
  return {
    id: raw.id || raw.countId || raw.docId || "",
    reference: firstValue(raw, ["reference", "countNumber", "countId", "documentNumber", "number"]) || "Optælling",
    date: firstValue(raw, ["date", "countedAt", "countDate", "completedAt", "createdAt"]),
    status: firstValue(raw, ["status", "countStatus"]) || "unknown",
    locationName: firstValue(raw, ["locationName", "storageArea", "warehouseArea", "area", "zone"]) || "",
    lineCount: firstValue(raw, ["lineCount", "itemsCount"]) ?? asArray(raw.lines).length,
    countedItems: firstValue(raw, ["countedItems", "countedItemsCount", "countedLineCount"]),
    discrepancies: firstValue(raw, ["discrepancies", "differenceCount", "varianceCount"]),
    totalDifference: firstValue(raw, ["totalDifference", "quantityDifference", "totalVariance"]),
    createdBy: firstValue(raw, ["createdByName", "createdBy", "countedByName", "countedBy", "userName", "userEmail"]) || "",
    createdAt: firstValue(raw, ["createdAt", "countedAt", "updatedAt"]),
    lines: asArray(raw.lines).map(normalizeCountLine)
  };
}

export function normalizeInventoryCounts(rawCounts = []) {
  return asArray(rawCounts).map(normalizeInventoryCount);
}

export function createEmptyInventoryCounts(reason = "Ingen optællinger fundet i staging read-only.") {
  return {
    ok: true,
    source: "empty",
    counts: [],
    warnings: reason ? [reason] : []
  };
}

export async function loadInventoryCounts(context, options = {}) {
  if (options.mockCounts) {
    return {
      ok: true,
      source: "mock",
      counts: normalizeInventoryCounts(options.mockCounts),
      warnings: []
    };
  }

  if (!context?.companyId) {
    return createEmptyInventoryCounts("Optælling read-only mangler companyId og viser tom staging-status.");
  }

  try {
    const result = await getInventoryCountsList(context, options);
    return {
      ok: result.ok !== false,
      source: result.source || "empty",
      counts: normalizeInventoryCounts(result.counts),
      warnings: asArray(result.warnings)
    };
  } catch (error) {
    return createEmptyInventoryCounts(`Optælling read-only kunne ikke hente data: ${error?.message || error}`);
  }
}
