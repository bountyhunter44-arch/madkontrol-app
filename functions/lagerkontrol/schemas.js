function sanitizeString(value, maxLen = 500) {
  return String(value ?? "").trim().slice(0, maxLen);
}

function requireString(value, fieldName) {
  const clean = sanitizeString(value, 180);
  if (!clean) {
    const error = new Error(`${fieldName} mangler.`);
    error.code = "invalid-argument";
    throw error;
  }
  return clean;
}

function normalizeReceiveGoodsPayload(data = {}) {
  const extracted = data.extracted || {};
  return {
    companyId: requireString(data.companyId, "companyId"),
    locationId: requireString(data.locationId, "locationId"),
    source: sanitizeString(data.source || "unknown", 120),
    taskEntryId: sanitizeString(data.taskEntryId || "", 180),
    photoUrl: sanitizeString(data.photoUrl || data.evidence?.photoUrl || "", 1200),
    documentUrl: sanitizeString(data.documentUrl || data.evidence?.documentUrl || "", 1200),
    ocrText: sanitizeString(data.ocrText || data.evidence?.ocrText || "", 5000),
    extracted: {
      productName: requireString(extracted.productName || extracted.name, "extracted.productName"),
      quantity: extracted.quantity,
      packageUnit: sanitizeString(extracted.packageUnit || extracted.unit || "stk", 80),
      unitsPerPackage: extracted.unitsPerPackage || extracted.itemsPerPackage,
      packageSize: extracted.packageSize,
      packageSizeUnit: sanitizeString(extracted.packageSizeUnit || "", 40),
      remainingCl: extracted.remainingCl || extracted.currentCl,
      bottleSizeCl: extracted.bottleSizeCl,
      supplier: sanitizeString(extracted.supplier || "", 180),
      price: extracted.price,
      batchNumber: sanitizeString(extracted.batchNumber || extracted.batch || "", 120),
      expiryDate: sanitizeString(extracted.expiryDate || "", 80),
      category: sanitizeString(extracted.category || "kolonial", 80)
    },
    haccp: {
      temperature: data.haccp?.temperature ?? null,
      status: sanitizeString(data.haccp?.status || "", 80),
      checkedBy: sanitizeString(data.haccp?.checkedBy || "", 180),
      checkedAt: sanitizeString(data.haccp?.checkedAt || "", 120)
    }
  };
}

module.exports = {
  normalizeReceiveGoodsPayload,
  sanitizeString
};
