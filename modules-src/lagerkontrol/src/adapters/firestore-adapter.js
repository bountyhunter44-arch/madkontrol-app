export const LAGER_COLLECTIONS = Object.freeze({
  catalog: "global_inventory_catalog",
  supplierProfiles: "supplier_profiles",
  supplierCatalogItems: "supplier_catalog_items",
  supplierCatalogImports: "supplier_catalog_imports",
  items: "inventory_items",
  batches: "inventory_batches",
  counts: "inventory_counts",
  movements: "inventory_movements",
  spillage: "inventory_spillage",
  documents: "supplier_documents",
  receipts: "goods_receipts",
  reports: "inventory_reports",
  settings: "inventory_settings",
  costProfiles: "menu_cost_profiles",
  indexes: "pricing_indexes"
});

function requireCompanyContext(context, action) {
  if (!context || !context.companyId) {
    throw new Error(`${action} kræver companyId i Lagerkontrol staging read-only.`);
  }
}

function requireLocationContext(context, action) {
  requireCompanyContext(context, action);
  if (!context.locationId) {
    throw new Error(`${action} kræver locationId i Lagerkontrol staging read-only.`);
  }
}

function getReadClient(context = {}) {
  if (context.firestoreReader && typeof context.firestoreReader.list === "function") {
    return context.firestoreReader;
  }
  if (typeof globalThis === "undefined") return null;
  const client = globalThis.MadkontrollenLagerReadOnlyFirestore;
  return client && typeof client.list === "function" ? client : null;
}

async function readCollection(context, path, options = {}) {
  const client = getReadClient(context);
  if (!client) {
    return {
      ok: false,
      status: "not_connected",
      readOnly: true,
      path,
      rows: [],
      message: "Firestore read-only adapter er ikke forbundet i staging."
    };
  }
  const rows = await client.list(path, { ...options, readOnly: true });
  return {
    ok: true,
    status: "ok",
    readOnly: true,
    path,
    rows: Array.isArray(rows) ? rows : []
  };
}

// Path: companies/{companyId}/inventory_items
export async function getInventoryItems(context) {
  requireCompanyContext(context, "getInventoryItems");
  return readCollection(context, `companies/${context.companyId}/${LAGER_COLLECTIONS.items}`);
}

// Path: companies/{companyId}/inventory_batches
export async function getInventoryBatches(context) {
  requireCompanyContext(context, "getInventoryBatches");
  return readCollection(context, `companies/${context.companyId}/${LAGER_COLLECTIONS.batches}`);
}

// Path: companies/{companyId}/inventory_counts
export async function getInventoryCounts(context) {
  requireCompanyContext(context, "getInventoryCounts");
  return readCollection(context, `companies/${context.companyId}/${LAGER_COLLECTIONS.counts}`);
}

// Path: companies/{companyId}/inventory_movements
export async function getInventoryMovements(context) {
  requireCompanyContext(context, "getInventoryMovements");
  return readCollection(context, `companies/${context.companyId}/${LAGER_COLLECTIONS.movements}`);
}

// Path: companies/{companyId}/supplier_documents
export async function getSupplierDocuments(context) {
  requireCompanyContext(context, "getSupplierDocuments");
  return readCollection(context, `companies/${context.companyId}/${LAGER_COLLECTIONS.documents}`);
}

// Path: companies/{companyId}/goods_receipts
export async function getGoodsReceipts(context) {
  requireLocationContext(context, "getGoodsReceipts");
  return readCollection(context, `companies/${context.companyId}/${LAGER_COLLECTIONS.receipts}`, {
    locationId: context.locationId
  });
}

// Path: companies/{companyId}/inventory_settings
export async function getInventorySettings(context) {
  requireLocationContext(context, "getInventorySettings");
  return readCollection(context, `companies/${context.companyId}/${LAGER_COLLECTIONS.settings}`, {
    locationId: context.locationId
  });
}

// Path: global_inventory_catalog
export async function getGlobalInventoryCatalog(context = {}) {
  return readCollection(context, LAGER_COLLECTIONS.catalog);
}

function rowsFromReadResult(result) {
  const value = result?.status === "fulfilled" ? result.value : result;
  return value?.ok && Array.isArray(value.rows) ? value.rows : [];
}

function warningFromReadResult(label, result) {
  if (result?.status === "rejected") {
    return `${label}: ${result.reason?.message || result.reason || "read-only læsning fejlede"}`;
  }
  const value = result?.status === "fulfilled" ? result.value : result;
  if (value?.ok) return "";
  return `${label}: ${value?.message || "read-only data ikke tilgængelig"}`;
}

function timestampValue(row = {}) {
  const value = row.completedAt || row.receivedAt || row.countedAt || row.createdAt || row.updatedAt || row.date || 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

function recentRows(rows = [], limit = 5) {
  return [...rows]
    .sort((a, b) => timestampValue(b) - timestampValue(a))
    .slice(0, limit);
}

function isActiveBatch(row = {}) {
  if (row.active === false || row.isActive === false) return false;
  if (["closed", "archived", "depleted"].includes(String(row.status || "").toLowerCase())) return false;
  const remaining = Number(row.remainingNormalizedQuantity ?? row.remainingQuantity ?? row.quantity ?? 0);
  return Number.isNaN(remaining) || remaining > 0;
}

export async function getDashboardSummary(context) {
  if (!context?.companyId) {
    return {
      ok: false,
      source: "empty",
      itemsCount: 0,
      activeBatchesCount: 0,
      recentCounts: [],
      recentMovements: [],
      recentSupplierDocuments: [],
      recentGoodsReceipts: [],
      warnings: ["Dashboard read-only kræver companyId."]
    };
  }

  const reads = {
    items: getInventoryItems(context),
    batches: getInventoryBatches(context),
    counts: getInventoryCounts(context),
    movements: getInventoryMovements(context),
    supplierDocuments: getSupplierDocuments(context),
    goodsReceipts: context.locationId
      ? getGoodsReceipts(context)
      : Promise.resolve({
        ok: false,
        status: "missing_location",
        rows: [],
        message: "Varemodtagelser kræver locationId i read-only staging."
      })
  };

  const results = await Promise.allSettled(Object.values(reads));
  const keys = Object.keys(reads);
  const byKey = Object.fromEntries(keys.map((key, index) => [key, results[index]]));
  const warnings = keys
    .map((key) => warningFromReadResult(key, byKey[key]))
    .filter(Boolean);

  const items = rowsFromReadResult(byKey.items);
  const batches = rowsFromReadResult(byKey.batches);
  const counts = rowsFromReadResult(byKey.counts);
  const movements = rowsFromReadResult(byKey.movements);
  const supplierDocuments = rowsFromReadResult(byKey.supplierDocuments);
  const goodsReceipts = rowsFromReadResult(byKey.goodsReceipts);
  const anyConnected = keys.some((key) => {
    const value = byKey[key]?.status === "fulfilled" ? byKey[key].value : null;
    return value?.ok;
  });

  return {
    ok: true,
    source: anyConnected ? "readonly-firestore" : "empty",
    itemsCount: items.length,
    activeBatchesCount: batches.filter(isActiveBatch).length,
    recentCounts: recentRows(counts),
    recentMovements: recentRows(movements),
    recentSupplierDocuments: recentRows(supplierDocuments),
    recentGoodsReceipts: recentRows(goodsReceipts),
    warnings
  };
}

function firstValue(row = {}, keys = []) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return null;
}

function normalizeInventoryItemRow(row = {}, fallbackId = "") {
  const unit = firstValue(row, ["unit", "normalizedUnit", "baseUnit", "packageUnit"]) || "";
  return {
    id: row.id || row.itemId || row.docId || fallbackId,
    name: firstValue(row, ["name", "productName", "itemName", "title"]) || "Ukendt vare",
    category: firstValue(row, ["category", "haccpCategory", "accountingCategory"]) || "",
    unit,
    quantity: firstValue(row, ["currentQuantity", "normalizedQuantity", "stockQty", "quantity"]),
    minQuantity: firstValue(row, ["parLevel", "minQuantity", "minimumQuantity", "reorderPoint"]),
    costPrice: firstValue(row, ["purchasePrice", "costPrice", "pricePerNormalizedUnit"]),
    salesPrice: firstValue(row, ["salesPrice", "recommendedSalesPrice", "menuSalesPrice"]),
    active: row.active !== false && row.isActive !== false,
    updatedAt: firstValue(row, ["updatedAt", "createdAt", "lastSeenAt"])
  };
}

// Path: companies/{companyId}/inventory_items
export async function getInventoryItemsList(context, options = {}) {
  if (!context?.companyId) {
    return {
      ok: false,
      source: "empty",
      items: [],
      warnings: ["Vareliste read-only kræver companyId."]
    };
  }

  try {
    const result = await getInventoryItems(context);
    if (!result.ok) {
      return {
        ok: true,
        source: "empty",
        items: [],
        warnings: [result.message || "Vareliste read-only data er ikke tilgængelig."]
      };
    }

    const items = result.rows
      .map((row, index) => normalizeInventoryItemRow(row, String(index + 1)))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "da"));

    return {
      ok: true,
      source: "readonly-firestore",
      items: options.limit ? items.slice(0, Number(options.limit)) : items,
      warnings: []
    };
  } catch (error) {
    return {
      ok: true,
      source: "empty",
      items: [],
      warnings: [`Vareliste read-only kunne ikke hentes: ${error?.message || error}`]
    };
  }
}

function normalizeSupplierDocumentRow(row = {}, fallbackId = "") {
  const extracted = row.ocrExtracted && typeof row.ocrExtracted === "object" ? row.ocrExtracted : {};
  return {
    id: row.id || row.documentId || row.docId || fallbackId,
    name: firstValue(row, ["originalFileName", "fileName", "title", "productName"]) || "Bilag",
    supplier: firstValue(row, ["supplier", "supplierName"]) || extracted.supplier || "",
    documentType: firstValue(row, ["documentType", "type"]) || "unknown",
    documentDate: firstValue(row, ["documentDate", "invoiceDate", "date", "receivedDate"]) || extracted.date || null,
    totalAmount: firstValue(row, ["totalAmount", "amount", "price", "total"]) ?? extracted.totalAmount ?? extracted.price ?? null,
    vatAmount: firstValue(row, ["vatAmount", "momsAmount", "vat"]) ?? extracted.vatAmount ?? null,
    bookingStatus: firstValue(row, ["bookingStatus", "accountingStatus"]) || "unknown",
    source: firstValue(row, ["source", "appUploadPurpose", "documentationSource"]) || "",
    createdAt: firstValue(row, ["createdAt", "uploadedAt", "updatedAt"]),
    ocrStatus: firstValue(row, ["ocrStatus", "status"]) || "",
    fileUrl: firstValue(row, ["fileUrl", "photoUrl", "documentUrl"]) || ""
  };
}

// Path: companies/{companyId}/supplier_documents
export async function getSupplierDocumentsList(context, options = {}) {
  if (!context?.companyId) {
    return {
      ok: false,
      source: "empty",
      documents: [],
      warnings: ["Bilag read-only kræver companyId."]
    };
  }

  try {
    const result = await getSupplierDocuments(context);
    if (!result.ok) {
      return {
        ok: true,
        source: "empty",
        documents: [],
        warnings: [result.message || "Bilag read-only data er ikke tilgængelig."]
      };
    }

    const documents = result.rows
      .map((row, index) => normalizeSupplierDocumentRow(row, String(index + 1)))
      .sort((a, b) => timestampValue(b) - timestampValue(a));

    return {
      ok: true,
      source: "readonly-firestore",
      documents: options.limit ? documents.slice(0, Number(options.limit)) : documents,
      warnings: []
    };
  } catch (error) {
    return {
      ok: true,
      source: "empty",
      documents: [],
      warnings: [`Bilag read-only kunne ikke hentes: ${error?.message || error}`]
    };
  }
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function numericValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function normalizeReceiptLineRow(row = {}, fallbackId = "") {
  return {
    id: row.id || row.lineId || row.itemId || fallbackId,
    itemName: firstValue(row, ["itemName", "productName", "name", "title"]) || "Ukendt vare",
    itemNumber: firstValue(row, ["itemNumber", "sku", "varenummer", "productNumber"]) || "",
    ean: firstValue(row, ["ean", "barcode", "gtin"]) || "",
    quantity: firstValue(row, ["quantity", "receivedQuantity", "qty", "amount"]),
    unit: firstValue(row, ["unit", "normalizedUnit", "packageUnit"]) || "",
    costPrice: firstValue(row, ["costPrice", "purchasePrice", "unitCost", "price"]),
    batch: firstValue(row, ["batch", "batchNumber", "lot", "lotNumber"]) || "",
    expiryDate: firstValue(row, ["expiryDate", "expirationDate", "bestBeforeDate", "useByDate"])
  };
}

function normalizeGoodsReceiptRow(row = {}, fallbackId = "") {
  const rawLines = asList(firstValue(row, ["lines", "receiptLines", "items", "products"]));
  const lines = rawLines.map((line, index) => normalizeReceiptLineRow(line, `${fallbackId}-${index + 1}`));
  const summedQuantity = lines.reduce((sum, line) => {
    const quantity = numericValue(line.quantity);
    return quantity === null ? sum : sum + quantity;
  }, 0);
  const hasLineQuantity = lines.some((line) => numericValue(line.quantity) !== null);

  return {
    id: row.id || row.receiptId || row.docId || fallbackId,
    reference: firstValue(row, ["receiptNumber", "reference", "receiptId", "documentNumber", "number"]) || row.id || fallbackId,
    supplier: firstValue(row, ["supplier", "supplierName", "vendorName"]) || "",
    date: firstValue(row, ["receivedDate", "receiptDate", "documentDate", "date", "createdAt"]),
    status: firstValue(row, ["status", "receiptStatus"]) || "unknown",
    lineCount: firstValue(row, ["lineCount", "itemsCount"]) ?? lines.length,
    totalQuantity: firstValue(row, ["totalQuantity", "receivedQuantity", "quantity"]) ?? (hasLineQuantity ? summedQuantity : null),
    totalAmount: firstValue(row, ["totalAmount", "amount", "price", "total"]),
    source: firstValue(row, ["source", "appUploadPurpose", "documentationSource"]) || "",
    supplierDocumentId: firstValue(row, ["supplierDocumentId", "documentId", "supplierDocumentReference"]) || "",
    createdAt: firstValue(row, ["createdAt", "receivedAt", "updatedAt"]),
    lines
  };
}

// Path: companies/{companyId}/goods_receipts
export async function getGoodsReceiptsList(context, options = {}) {
  if (!context?.companyId) {
    return {
      ok: false,
      source: "empty",
      receipts: [],
      warnings: ["Varemodtagelse read-only kræver companyId."]
    };
  }

  if (!context?.locationId) {
    return {
      ok: true,
      source: "empty",
      receipts: [],
      warnings: ["Varemodtagelser kræver locationId i read-only staging."]
    };
  }

  try {
    const result = await getGoodsReceipts(context);
    if (!result.ok) {
      return {
        ok: true,
        source: "empty",
        receipts: [],
        warnings: [result.message || "Varemodtagelse read-only data er ikke tilgængelig."]
      };
    }

    const receipts = result.rows
      .map((row, index) => normalizeGoodsReceiptRow(row, String(index + 1)))
      .sort((a, b) => timestampValue(b) - timestampValue(a));

    return {
      ok: true,
      source: "readonly-firestore",
      receipts: options.limit ? receipts.slice(0, Number(options.limit)) : receipts,
      warnings: []
    };
  } catch (error) {
    return {
      ok: true,
      source: "empty",
      receipts: [],
      warnings: [`Varemodtagelse read-only kunne ikke hentes: ${error?.message || error}`]
    };
  }
}

function normalizeCountLineRow(row = {}, fallbackId = "") {
  const expectedQuantity = firstValue(row, ["expectedQuantity", "expectedStock", "systemQuantity", "currentQuantity", "bookQuantity"]);
  const countedQuantity = firstValue(row, ["countedQuantity", "countedStock", "actualQuantity", "quantity"]);
  const difference = firstValue(row, ["difference", "quantityDifference", "variance"]);
  const expectedNumber = numericValue(expectedQuantity);
  const countedNumber = numericValue(countedQuantity);
  const calculatedDifference = expectedNumber !== null && countedNumber !== null
    ? countedNumber - expectedNumber
    : null;

  return {
    id: row.id || row.lineId || row.itemId || fallbackId,
    itemName: firstValue(row, ["itemName", "productName", "name", "title"]) || "Ukendt vare",
    itemNumber: firstValue(row, ["itemNumber", "sku", "varenummer", "productNumber"]) || "",
    ean: firstValue(row, ["ean", "barcode", "gtin"]) || "",
    expectedQuantity,
    countedQuantity,
    difference: difference ?? calculatedDifference,
    unit: firstValue(row, ["unit", "normalizedUnit", "packageUnit"]) || "",
    batch: firstValue(row, ["batch", "batchNumber", "lot", "lotNumber"]) || "",
    expiryDate: firstValue(row, ["expiryDate", "expirationDate", "bestBeforeDate", "useByDate"]),
    note: firstValue(row, ["note", "comment", "remark"]) || ""
  };
}

function normalizeInventoryCountRow(row = {}, fallbackId = "") {
  const rawLines = asList(firstValue(row, ["lines", "countLines", "items", "countItems", "products"]));
  const lines = rawLines.map((line, index) => normalizeCountLineRow(line, `${fallbackId}-${index + 1}`));
  const countedItemsFromLines = lines.filter((line) => line.countedQuantity !== undefined && line.countedQuantity !== null && line.countedQuantity !== "").length;
  const discrepanciesFromLines = lines.filter((line) => {
    const value = numericValue(line.difference);
    return value !== null && value !== 0;
  }).length;
  const totalDifferenceFromLines = lines.reduce((sum, line) => {
    const value = numericValue(line.difference);
    return value === null ? sum : sum + value;
  }, 0);

  return {
    id: row.id || row.countId || row.docId || fallbackId,
    reference: firstValue(row, ["countNumber", "reference", "countId", "documentNumber", "number"]) || row.id || fallbackId,
    date: firstValue(row, ["countedAt", "countDate", "date", "completedAt", "createdAt"]),
    status: firstValue(row, ["status", "countStatus"]) || "unknown",
    locationName: firstValue(row, ["locationName", "storageArea", "warehouseArea", "area", "zone"]) || "",
    lineCount: firstValue(row, ["lineCount", "itemsCount"]) ?? lines.length,
    countedItems: firstValue(row, ["countedItems", "countedItemsCount", "countedLineCount"]) ?? countedItemsFromLines,
    discrepancies: firstValue(row, ["discrepancies", "differenceCount", "varianceCount"]) ?? discrepanciesFromLines,
    totalDifference: firstValue(row, ["totalDifference", "quantityDifference", "totalVariance"]) ?? (lines.length ? totalDifferenceFromLines : null),
    createdBy: firstValue(row, ["createdByName", "createdBy", "countedByName", "countedBy", "userName", "userEmail"]) || "",
    createdAt: firstValue(row, ["createdAt", "countedAt", "updatedAt"]),
    lines
  };
}

// Path: companies/{companyId}/inventory_counts
export async function getInventoryCountsList(context, options = {}) {
  if (!context?.companyId) {
    return {
      ok: false,
      source: "empty",
      counts: [],
      warnings: ["Optælling read-only kræver companyId."]
    };
  }

  try {
    const result = await getInventoryCounts(context);
    if (!result.ok) {
      return {
        ok: true,
        source: "empty",
        counts: [],
        warnings: [result.message || "Optælling read-only data er ikke tilgængelig."]
      };
    }

    const counts = result.rows
      .map((row, index) => normalizeInventoryCountRow(row, String(index + 1)))
      .sort((a, b) => timestampValue(b) - timestampValue(a));

    return {
      ok: true,
      source: "readonly-firestore",
      counts: options.limit ? counts.slice(0, Number(options.limit)) : counts,
      warnings: []
    };
  } catch (error) {
    return {
      ok: true,
      source: "empty",
      counts: [],
      warnings: [`Optælling read-only kunne ikke hentes: ${error?.message || error}`]
    };
  }
}
