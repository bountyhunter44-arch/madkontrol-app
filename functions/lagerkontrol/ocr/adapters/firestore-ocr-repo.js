function createFirestoreOcrRepo({ db, FieldValue }) {
  function companyCollection(companyId, collectionName) {
    return db.collection("companies").doc(companyId).collection(collectionName);
  }

  async function getSupplierDocument({ companyId, supplierDocumentId }) {
    const snap = await companyCollection(companyId, "supplier_documents").doc(supplierDocumentId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async function updateSupplierDocument({ companyId, supplierDocumentId }, patch) {
    await companyCollection(companyId, "supplier_documents").doc(supplierDocumentId).set(patch, { merge: true });
  }

  async function findGoodsReceiptForSupplierDocument({ companyId, locationId, supplierDocumentId, supplierDocument = {} }) {
    const receipts = companyCollection(companyId, "goods_receipts");
    const byId = await receipts
      .where("locationId", "==", locationId)
      .where("supplierDocumentId", "==", supplierDocumentId)
      .limit(1)
      .get();
    if (!byId.empty) return { id: byId.docs[0].id, ...byId.docs[0].data() };

    const url = supplierDocument.fileUrl || supplierDocument.photoUrl || supplierDocument.documentUrl || "";
    if (!url) return null;
    const byUrl = await receipts
      .where("locationId", "==", locationId)
      .where("supplierDocumentUrl", "==", url)
      .limit(1)
      .get();
    if (!byUrl.empty) return { id: byUrl.docs[0].id, ...byUrl.docs[0].data() };
    return null;
  }

  async function upsertGoodsReceiptForSupplierDocument({ payload, supplierDocument, receiptDraft }) {
    const existing = await findGoodsReceiptForSupplierDocument({
      ...payload,
      supplierDocument
    });
    if (existing?.id) {
      const ref = companyCollection(payload.companyId, "goods_receipts").doc(existing.id);
      await ref.set(receiptDraft, { merge: true });
      return { id: existing.id };
    }
    const ref = await companyCollection(payload.companyId, "goods_receipts").add(receiptDraft);
    return { id: ref.id };
  }

  function serverTimestamp() {
    return FieldValue.serverTimestamp();
  }

  return {
    db,
    FieldValue,
    companyCollection,
    findGoodsReceiptForSupplierDocument,
    getSupplierDocument,
    serverTimestamp,
    updateSupplierDocument,
    upsertGoodsReceiptForSupplierDocument
  };
}

module.exports = {
  createFirestoreOcrRepo
};
