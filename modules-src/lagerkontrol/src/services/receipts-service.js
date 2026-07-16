import { getGoodsReceiptsList } from "../adapters/firestore-adapter.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstValue(raw = {}, keys = []) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") return raw[key];
  }
  return null;
}

function normalizeReceiptLine(raw = {}) {
  return {
    id: raw.id || raw.lineId || raw.itemId || "",
    itemName: firstValue(raw, ["itemName", "productName", "name", "title"]) || "Ukendt vare",
    itemNumber: firstValue(raw, ["itemNumber", "sku", "varenummer", "productNumber"]) || "",
    ean: firstValue(raw, ["ean", "barcode", "gtin"]) || "",
    quantity: firstValue(raw, ["quantity", "receivedQuantity", "qty", "amount"]),
    unit: firstValue(raw, ["unit", "normalizedUnit", "packageUnit"]) || "",
    costPrice: firstValue(raw, ["costPrice", "purchasePrice", "unitCost", "price"]),
    batch: firstValue(raw, ["batch", "batchNumber", "lot", "lotNumber"]) || "",
    expiryDate: firstValue(raw, ["expiryDate", "expirationDate", "bestBeforeDate", "useByDate"])
  };
}

export function normalizeGoodsReceipt(raw = {}) {
  return {
    id: raw.id || raw.receiptId || raw.docId || "",
    reference: firstValue(raw, ["reference", "receiptNumber", "receiptId", "documentNumber", "number"]) || "Varemodtagelse",
    supplier: firstValue(raw, ["supplier", "supplierName", "vendorName"]) || "Ukendt leverandør",
    date: firstValue(raw, ["date", "receivedDate", "receiptDate", "documentDate", "createdAt"]),
    status: firstValue(raw, ["status", "receiptStatus"]) || "unknown",
    lineCount: firstValue(raw, ["lineCount", "itemsCount"]) ?? asArray(raw.lines).length,
    totalQuantity: firstValue(raw, ["totalQuantity", "receivedQuantity", "quantity"]),
    totalAmount: firstValue(raw, ["totalAmount", "amount", "price", "total"]),
    source: firstValue(raw, ["source", "appUploadPurpose", "documentationSource"]) || "",
    supplierDocumentId: firstValue(raw, ["supplierDocumentId", "documentId", "supplierDocumentReference"]) || "",
    createdAt: firstValue(raw, ["createdAt", "receivedAt", "updatedAt"]),
    lines: asArray(raw.lines).map(normalizeReceiptLine)
  };
}

export function normalizeGoodsReceipts(rawReceipts = []) {
  return asArray(rawReceipts).map(normalizeGoodsReceipt);
}

export function createEmptyGoodsReceipts(reason = "Ingen varemodtagelser fundet i staging read-only.") {
  return {
    ok: true,
    source: "empty",
    receipts: [],
    warnings: reason ? [reason] : []
  };
}

export async function loadGoodsReceipts(context, options = {}) {
  if (options.mockReceipts) {
    return {
      ok: true,
      source: "mock",
      receipts: normalizeGoodsReceipts(options.mockReceipts),
      warnings: []
    };
  }

  if (!context?.companyId) {
    return createEmptyGoodsReceipts("Varemodtagelse read-only mangler companyId og viser tom staging-status.");
  }

  if (!context?.locationId) {
    return createEmptyGoodsReceipts("Varemodtagelse read-only mangler locationId og viser tom staging-status.");
  }

  try {
    const result = await getGoodsReceiptsList(context, options);
    return {
      ok: result.ok !== false,
      source: result.source || "empty",
      receipts: normalizeGoodsReceipts(result.receipts),
      warnings: asArray(result.warnings)
    };
  } catch (error) {
    return createEmptyGoodsReceipts(`Varemodtagelse read-only kunne ikke hente data: ${error?.message || error}`);
  }
}
