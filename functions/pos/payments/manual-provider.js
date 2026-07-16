"use strict";

async function createPayment({ companyId, locationId, saleId, amount, currency, reference, uid }) {
  return {
    provider: "manual",
    status: "paid",
    paymentStatus: "paid",
    externalPaymentId: reference || "",
    paymentSessionId: "",
    manualPayment: true,
    companyId,
    locationId,
    saleId,
    amount,
    currency,
    approvedBy: uid || ""
  };
}

async function getPaymentStatus({ paymentId }) {
  return {
    provider: "manual",
    paymentId,
    status: "paid",
    paymentStatus: "paid",
    manualPayment: true
  };
}

async function cancelPayment({ paymentId }) {
  return {
    provider: "manual",
    paymentId,
    status: "cancelled",
    paymentStatus: "cancelled",
    manualPayment: true
  };
}

async function refundPayment({ paymentId, amount }) {
  return {
    provider: "manual",
    paymentId,
    amount,
    status: "refunded",
    paymentStatus: "refunded",
    manualPayment: true
  };
}

module.exports = {
  createPayment,
  getPaymentStatus,
  cancelPayment,
  refundPayment
};
