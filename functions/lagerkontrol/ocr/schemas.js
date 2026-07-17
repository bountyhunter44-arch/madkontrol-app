function cleanString(value, maxLen = 500) {
  return String(value ?? "").trim().slice(0, maxLen);
}

function requiredString(value, fieldName) {
  const clean = cleanString(value, 180);
  if (!clean) {
    const error = new Error(`${fieldName} mangler.`);
    error.code = "invalid-argument";
    throw error;
  }
  return clean;
}

function normalizeProcessSupplierDocumentPayload(data = {}) {
  return {
    companyId: requiredString(data.companyId, "companyId"),
    locationId: requiredString(data.locationId, "locationId"),
    supplierDocumentId: requiredString(data.supplierDocumentId, "supplierDocumentId")
  };
}

module.exports = {
  cleanString,
  normalizeProcessSupplierDocumentPayload
};
