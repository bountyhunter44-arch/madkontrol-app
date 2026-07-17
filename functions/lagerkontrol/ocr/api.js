const { HttpsError } = require("firebase-functions/v2/https");
const { createLagerFirestoreAdapter } = require("../adapters/firestore");
const { assertLagerAccess } = require("../api");
const { normalizeProcessSupplierDocumentPayload } = require("./schemas");
const { extractSupplierDocumentFields } = require("./domain/extract-document");
const { mapExtractedFieldsToReceiptDraft } = require("./domain/map-extracted-fields");

function createLagerOcrApi({ repo, openAiApiKeySecret }) {
  async function lagerProcessSupplierDocumentHandler(request) {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at behandle leverandoerdokumenter.");
    }

    let payload;
    try {
      payload = normalizeProcessSupplierDocumentPayload(request.data || {});
    } catch (error) {
      throw new HttpsError(error.code || "invalid-argument", error.message || "Ugyldig OCR-payload.");
    }
    const accessAdapter = createLagerFirestoreAdapter({
      db: repo.db,
      FieldValue: repo.FieldValue
    });
    await assertLagerAccess({ firestore: accessAdapter, uid: request.auth.uid, payload });

    const supplierDocument = await repo.getSupplierDocument(payload);
    if (!supplierDocument) {
      throw new HttpsError("not-found", "supplier_document blev ikke fundet.");
    }

    if (isAlreadyProcessed(supplierDocument)) {
      const existingReceipt = await repo.findGoodsReceiptForSupplierDocument({
        ...payload,
        supplierDocument
      });
      return {
        ok: true,
        supplierDocumentId: payload.supplierDocumentId,
        goodsReceiptId: existingReceipt?.id || supplierDocument.goodsReceiptId || "",
        status: supplierDocument.status || "needs_review",
        extracted: supplierDocument.extractedFields || supplierDocument.ocrExtracted || {},
        idempotent: true
      };
    }

    await repo.updateSupplierDocument(payload, {
      status: "processing",
      processingStartedAt: repo.serverTimestamp(),
      processingStartedBy: request.auth.uid,
      processingError: ""
    });

    try {
      const extracted = await extractSupplierDocumentFields({
        supplierDocument,
        openAiApiKey: getOpenAiApiKey(openAiApiKeySecret)
      });
      const status = extracted.requiresReview ? "needs_review" : "extracted";
      const receiptDraft = mapExtractedFieldsToReceiptDraft({
        payload,
        supplierDocument,
        extracted,
        uid: request.auth.uid,
        now: repo.serverTimestamp()
      });
      const goodsReceiptRef = await repo.upsertGoodsReceiptForSupplierDocument({
        payload,
        supplierDocument,
        receiptDraft
      });

      await repo.updateSupplierDocument(payload, {
        status,
        extractedFields: extracted,
        goodsReceiptId: goodsReceiptRef.id,
        processedAt: repo.serverTimestamp(),
        processedBy: request.auth.uid,
        processingError: ""
      });

      return {
        ok: true,
        supplierDocumentId: payload.supplierDocumentId,
        goodsReceiptId: goodsReceiptRef.id,
        status,
        extracted
      };
    } catch (error) {
      await repo.updateSupplierDocument(payload, {
        status: "failed",
        processingError: String(error?.message || error).slice(0, 1000),
        processedAt: repo.serverTimestamp(),
        processedBy: request.auth.uid
      });
      console.error("[lager ocr] supplier document processing failed", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Kunne ikke behandle leverandoerdokumentet.");
    }
  }

  return {
    lagerProcessSupplierDocumentHandler
  };
}

function isAlreadyProcessed(supplierDocument = {}) {
  return ["extracted", "needs_review", "approved"].includes(String(supplierDocument.status || "").trim());
}

function getOpenAiApiKey(secret) {
  return secret?.value?.() || process.env.OPENAI_API_KEY || "";
}

module.exports = {
  createLagerOcrApi
};
