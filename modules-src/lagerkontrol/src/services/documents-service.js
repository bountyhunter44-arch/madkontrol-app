import { getSupplierDocumentsList } from "../adapters/firestore-adapter.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstValue(raw = {}, keys = []) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") return raw[key];
  }
  return null;
}

export function normalizeSupplierDocument(raw = {}) {
  return {
    id: raw.id || raw.documentId || raw.docId || "",
    name: firstValue(raw, ["name", "originalFileName", "fileName", "title", "productName"]) || "Bilag",
    supplier: firstValue(raw, ["supplier", "supplierName"]) || "Ukendt leverandør",
    documentType: firstValue(raw, ["documentType", "type"]) || "unknown",
    documentDate: firstValue(raw, ["documentDate", "invoiceDate", "date", "receivedDate"]),
    totalAmount: firstValue(raw, ["totalAmount", "amount", "price", "total"]),
    vatAmount: firstValue(raw, ["vatAmount", "momsAmount", "vat"]),
    bookingStatus: firstValue(raw, ["bookingStatus", "accountingStatus"]) || "unknown",
    source: firstValue(raw, ["source", "appUploadPurpose", "documentationSource"]) || "",
    createdAt: firstValue(raw, ["createdAt", "uploadedAt", "updatedAt"]),
    ocrStatus: firstValue(raw, ["ocrStatus", "status"]) || "",
    fileUrl: firstValue(raw, ["fileUrl", "photoUrl", "documentUrl"]) || ""
  };
}

export function normalizeSupplierDocuments(rawDocuments = []) {
  return asArray(rawDocuments).map(normalizeSupplierDocument);
}

export function createEmptySupplierDocuments(reason = "Ingen bilag fundet i staging read-only.") {
  return {
    ok: true,
    source: "empty",
    documents: [],
    warnings: reason ? [reason] : []
  };
}

export async function loadSupplierDocuments(context, options = {}) {
  if (options.mockDocuments) {
    return {
      ok: true,
      source: "mock",
      documents: normalizeSupplierDocuments(options.mockDocuments),
      warnings: []
    };
  }

  if (!context?.companyId) {
    return createEmptySupplierDocuments("Bilag read-only mangler companyId og viser tom staging-status.");
  }

  try {
    const result = await getSupplierDocumentsList(context, options);
    return {
      ok: result.ok !== false,
      source: result.source || "empty",
      documents: normalizeSupplierDocuments(result.documents),
      warnings: asArray(result.warnings)
    };
  } catch (error) {
    return createEmptySupplierDocuments(`Bilag read-only kunne ikke hente data: ${error?.message || error}`);
  }
}
