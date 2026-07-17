function mapExtractedFieldsToReceiptDraft({ payload, supplierDocument, extracted, uid, now }) {
  return {
    companyId: payload.companyId,
    locationId: payload.locationId,
    supplierDocumentId: payload.supplierDocumentId,
    supplierDocumentUrl: supplierDocument.fileUrl || supplierDocument.photoUrl || supplierDocument.documentUrl || "",
    productPhotoUrl: supplierDocument.photoUrl || "",
    documentUrl: supplierDocument.fileUrl || supplierDocument.documentUrl || "",
    status: "needs_review",
    source: "lagerkontrol.ocr",
    supplier: extracted.supplier || supplierDocument.supplier || "",
    invoiceNumber: extracted.invoiceNumber || "",
    deliveryNoteNumber: extracted.deliveryNoteNumber || "",
    productName: extracted.productName || supplierDocument.productName || "",
    quantity: extracted.quantity,
    packageUnit: extracted.packageUnit || "",
    packageSize: extracted.packageSize,
    packageSizeUnit: extracted.packageSizeUnit || "",
    price: extracted.price,
    vatRate: extracted.vatRate,
    batchNumber: extracted.batchNumber || "",
    expiryDate: extracted.expiryDate || "",
    barcode: extracted.barcode || "",
    sku: extracted.sku || "",
    extractedFields: extracted,
    aiSuggested: true,
    requiresReview: true,
    updatedBy: uid,
    updatedAt: now,
    createdBy: supplierDocument.createdBy || uid,
    createdAt: supplierDocument.createdAt || now
  };
}

module.exports = {
  mapExtractedFieldsToReceiptDraft
};
