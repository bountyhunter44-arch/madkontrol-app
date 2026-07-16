"use strict";

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { assertPosLocationAccess, sanitizeString } = require("./access");
const { zettleProvider, manualProvider } = require("../../pos/payments");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const ZETTLE_CLIENT_ID = defineSecret("ZETTLE_CLIENT_ID");
const ZETTLE_CLIENT_SECRET = defineSecret("ZETTLE_CLIENT_SECRET");

function saleRef(companyId, locationId, saleId) {
  return db
    .collection("companies").doc(companyId)
    .collection("locations").doc(locationId)
    .collection("pos_sales").doc(saleId);
}

function locationCollection(companyId, locationId, collectionName) {
  return db
    .collection("companies").doc(companyId)
    .collection("locations").doc(locationId)
    .collection(collectionName);
}

function cleanMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError("failed-precondition", "Salget har ikke et gyldigt beløb.");
  }
  return Math.round(amount * 100) / 100;
}

function assertSaleBelongsToScope(sale, access) {
  if (sale.companyId !== access.companyId || sale.locationId !== access.locationId) {
    throw new HttpsError("permission-denied", "Salget hører ikke til den valgte virksomhed/lokation.");
  }
}

function assertSaleCanStartPayment(sale) {
  const status = sanitizeString(sale.status || "", 80).toLowerCase();
  if (status === "paid") throw new HttpsError("failed-precondition", "Salget er allerede betalt.");
  if (["cancelled", "refunded"].includes(status)) {
    throw new HttpsError("failed-precondition", "Betaling kan ikke startes for et annulleret eller refunderet salg.");
  }
}

function paymentAuditPayload({ access, saleId, action, provider, paymentResult = {}, manualPayment = false }) {
  return {
    companyId: access.companyId,
    locationId: access.locationId,
    saleId,
    action,
    provider,
    paymentStatus: paymentResult.paymentStatus || paymentResult.status || "",
    paymentSessionId: paymentResult.paymentSessionId || "",
    externalPaymentId: paymentResult.externalPaymentId || "",
    providerReference: paymentResult.providerReference || "",
    manualPayment,
    uid: access.uid,
    source: "pos_payments_backend",
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString()
  };
}

const posCreateZettlePayment = onCall(
  {
    region: "us-central1",
    secrets: [ZETTLE_CLIENT_ID, ZETTLE_CLIENT_SECRET]
  },
  async (request) => {
    const data = request.data || {};
    const access = await assertPosLocationAccess({ data, auth: request.auth });
    const saleId = sanitizeString(data.saleId || "", 140);
    if (!saleId) throw new HttpsError("invalid-argument", "saleId er påkrævet.");

    const snap = await saleRef(access.companyId, access.locationId, saleId).get();
    if (!snap.exists) throw new HttpsError("not-found", "Salget blev ikke fundet.");

    const sale = { id: snap.id, ...(snap.data() || {}) };
    assertSaleBelongsToScope(sale, access);
    assertSaleCanStartPayment(sale);

    const amount = cleanMoney(sale.total ?? sale.totalInclVat ?? sale.vatSummary?.totalIncVat);
    const currency = sanitizeString(sale.currency || "DKK", 12) || "DKK";
    const reference = sanitizeString(sale.receiptLabel || sale.receiptNumber || sale.id, 160);

    const paymentResult = await zettleProvider.createPayment({
      companyId: access.companyId,
      locationId: access.locationId,
      saleId,
      amount,
      currency,
      reference
    });

    const status = paymentResult.paymentStatus === "unavailable" ? "pending_payment" : "pending_payment";
    const paymentStatus = paymentResult.paymentStatus || "pending";
    const nowIso = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      const ref = saleRef(access.companyId, access.locationId, saleId);
      const currentSnap = await transaction.get(ref);
      if (!currentSnap.exists) throw new HttpsError("not-found", "Salget blev ikke fundet.");
      const current = currentSnap.data() || {};
      assertSaleBelongsToScope(current, access);
      assertSaleCanStartPayment(current);

      const paymentDocRef = locationCollection(access.companyId, access.locationId, "pos_payments")
        .doc(paymentResult.paymentSessionId || saleId);
      const auditRef = locationCollection(access.companyId, access.locationId, "pos_audit_log").doc();
      const payment = {
        ...(current.payment || {}),
        method: "zettle_reader",
        provider: "zettle",
        providerMode: "reader_connect_api",
        providerPaymentId: paymentResult.externalPaymentId || "",
        paymentSessionId: paymentResult.paymentSessionId || "",
        externalTransactionId: paymentResult.providerReference || paymentResult.externalPaymentId || "",
        reconciliationStatus: paymentStatus === "pending" ? "pending" : "unavailable",
        cardDataHandledByProvider: true
      };

      transaction.set(ref, {
        status,
        paymentProvider: "zettle",
        paymentStatus,
        externalPaymentId: paymentResult.externalPaymentId || "",
        paymentSessionId: paymentResult.paymentSessionId || "",
        providerReference: paymentResult.providerReference || "",
        payment,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: nowIso
      }, { merge: true });

      transaction.set(paymentDocRef, {
        companyId: access.companyId,
        locationId: access.locationId,
        saleId,
        provider: "zettle",
        status,
        paymentStatus,
        amount,
        currency,
        externalPaymentId: paymentResult.externalPaymentId || "",
        paymentSessionId: paymentResult.paymentSessionId || "",
        providerReference: paymentResult.providerReference || "",
        technicalStatus: paymentResult.technicalStatus || "",
        createdBy: access.uid,
        createdAt: FieldValue.serverTimestamp(),
        createdAtIso: nowIso,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: nowIso
      }, { merge: true });

      transaction.set(auditRef, paymentAuditPayload({
        access,
        saleId,
        action: "zettle_payment_created",
        provider: "zettle",
        paymentResult
      }));
    });

    return {
      ok: paymentStatus === "pending",
      saleId,
      provider: "zettle",
      status,
      paymentStatus,
      externalPaymentId: paymentResult.externalPaymentId || "",
      paymentSessionId: paymentResult.paymentSessionId || "",
      providerReference: paymentResult.providerReference || "",
      message: paymentResult.message || "Afventer betaling på terminal."
    };
  }
);

const posMarkSalePaidManually = onCall(
  { region: "us-central1" },
  async (request) => {
    const data = request.data || {};
    const access = await assertPosLocationAccess({ data, auth: request.auth, adminOnly: true });
    const saleId = sanitizeString(data.saleId || "", 140);
    if (!saleId) throw new HttpsError("invalid-argument", "saleId er påkrævet.");

    let updatedSale = null;
    await db.runTransaction(async (transaction) => {
      const ref = saleRef(access.companyId, access.locationId, saleId);
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "Salget blev ikke fundet.");
      const sale = { id: snap.id, ...(snap.data() || {}) };
      assertSaleBelongsToScope(sale, access);
      const status = sanitizeString(sale.status || "", 80).toLowerCase();
      if (status === "paid") throw new HttpsError("failed-precondition", "Salget er allerede betalt.");
      if (["cancelled", "refunded"].includes(status)) {
        throw new HttpsError("failed-precondition", "Et annulleret eller refunderet salg kan ikke markeres betalt.");
      }

      const amount = cleanMoney(sale.total ?? sale.totalInclVat ?? sale.vatSummary?.totalIncVat);
      const currency = sanitizeString(sale.currency || "DKK", 12) || "DKK";
      const manualResult = await manualProvider.createPayment({
        companyId: access.companyId,
        locationId: access.locationId,
        saleId,
        amount,
        currency,
        reference: sanitizeString(data.reference || "", 180),
        uid: access.uid
      });
      const payment = {
        ...(sale.payment || {}),
        method: sale.payment?.method || "zettle_reader",
        provider: sale.paymentProvider || "zettle",
        providerMode: "manual_admin_fallback",
        externalTransactionId: sanitizeString(data.reference || sale.payment?.externalTransactionId || "", 180),
        providerPaymentId: sale.externalPaymentId || "",
        paymentSessionId: sale.paymentSessionId || "",
        reconciliationStatus: "manual_paid",
        note: sanitizeString(data.note || sale.payment?.note || "", 1000),
        cardDataHandledByProvider: true,
        manualPayment: true,
        manualPaymentBy: access.uid,
        manualPaymentAtIso: new Date().toISOString()
      };
      const patch = {
        status: "paid",
        paymentStatus: "paid",
        paymentProvider: sale.paymentProvider || payment.provider || "manual",
        manualPayment: true,
        manualPaymentBy: access.uid,
        manualPaymentAt: FieldValue.serverTimestamp(),
        manualPaymentAtIso: payment.manualPaymentAtIso,
        payment,
        inventoryPosted: false,
        dailySalesPosted: false,
        accountingPosted: false,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: payment.manualPaymentAtIso
      };
      transaction.set(ref, patch, { merge: true });

      const paymentDocRef = locationCollection(access.companyId, access.locationId, "pos_payments")
        .doc(sale.paymentSessionId || saleId);
      transaction.set(paymentDocRef, {
        companyId: access.companyId,
        locationId: access.locationId,
        saleId,
        provider: patch.paymentProvider,
        status: "paid",
        paymentStatus: "paid",
        amount,
        currency,
        manualPayment: true,
        manualPaymentBy: access.uid,
        manualPaymentAt: FieldValue.serverTimestamp(),
        manualPaymentAtIso: payment.manualPaymentAtIso,
        reference: payment.externalTransactionId,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: payment.manualPaymentAtIso
      }, { merge: true });

      const auditRef = locationCollection(access.companyId, access.locationId, "pos_audit_log").doc();
      transaction.set(auditRef, paymentAuditPayload({
        access,
        saleId,
        action: "manual_payment_marked_paid",
        provider: patch.paymentProvider,
        paymentResult: manualResult,
        manualPayment: true
      }));

      updatedSale = {
        ...sale,
        status: "paid",
        paymentStatus: "paid",
        paymentProvider: patch.paymentProvider,
        manualPayment: true,
        manualPaymentBy: access.uid,
        manualPaymentAtIso: payment.manualPaymentAtIso,
        payment,
        inventoryPosted: false,
        dailySalesPosted: false,
        accountingPosted: false,
        updatedAtIso: payment.manualPaymentAtIso
      };
    });

    return {
      ok: true,
      sale: updatedSale
    };
  }
);

module.exports = {
  posCreateZettlePayment,
  posMarkSalePaidManually
};
