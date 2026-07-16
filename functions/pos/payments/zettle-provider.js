"use strict";

const crypto = require("crypto");

const SECRET_NAMES = [
  "ZETTLE_CLIENT_ID",
  "ZETTLE_CLIENT_SECRET",
  "ZETTLE_API_KEY",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET"
];

function readSecretPresence() {
  return Object.fromEntries(
    SECRET_NAMES.map((name) => [name, Boolean(String(process.env[name] || "").trim())])
  );
}

function hasZettleCredentials(secretPresence = readSecretPresence()) {
  return Boolean(
    (secretPresence.ZETTLE_CLIENT_ID && secretPresence.ZETTLE_CLIENT_SECRET) ||
    secretPresence.ZETTLE_API_KEY ||
    (secretPresence.PAYPAL_CLIENT_ID && secretPresence.PAYPAL_CLIENT_SECRET)
  );
}

function makeProviderReference({ companyId, locationId, saleId }) {
  const hash = crypto
    .createHash("sha256")
    .update(`${companyId}:${locationId}:${saleId}:${Date.now()}`)
    .digest("hex")
    .slice(0, 24);
  return `zettle_${hash}`;
}

async function createPayment({ companyId, locationId, saleId, amount, currency, reference }) {
  const secretPresence = readSecretPresence();
  const configured = hasZettleCredentials(secretPresence);
  const providerReference = makeProviderReference({ companyId, locationId, saleId });

  console.info("[pos payments] Zettle payment requested", {
    provider: "zettle",
    companyId,
    locationId,
    saleId,
    amount,
    currency,
    reference,
    configured,
    secretNamesPresent: Object.entries(secretPresence)
      .filter(([, present]) => present)
      .map(([name]) => name)
  });

  if (!configured) {
    return {
      provider: "zettle",
      status: "unavailable",
      paymentStatus: "unavailable",
      externalPaymentId: "",
      paymentSessionId: providerReference,
      providerReference,
      message: "Zettle/PayPal credentials mangler i Functions secrets eller servermiljø.",
      technicalStatus: "credentials_missing"
    };
  }

  return {
    provider: "zettle",
    status: "pending",
    paymentStatus: "pending",
    externalPaymentId: "",
    paymentSessionId: providerReference,
    providerReference,
    message: "Afventer betaling på terminal.",
    technicalStatus: "reader_endpoint_not_configured",
    // TODO: Tilføj Zettle/PayPal Reader Connect endpoint, OAuth scopes og reader payment request payload her.
    // TODO: Gem providerens rigtige payment/session id som externalPaymentId/paymentSessionId, når API'et er aktiveret.
  };
}

async function getPaymentStatus({ paymentId }) {
  return {
    provider: "zettle",
    paymentId,
    status: "pending",
    paymentStatus: "pending",
    message: "Betalingsstatus kan først hentes, når Zettle/PayPal Reader endpoint er konfigureret."
  };
}

async function cancelPayment({ paymentId }) {
  return {
    provider: "zettle",
    paymentId,
    status: "cancelled",
    paymentStatus: "cancelled",
    message: "Lokal payment request er annulleret. Provider-cancel kræver Zettle/PayPal endpoint."
  };
}

async function refundPayment({ paymentId, amount }) {
  return {
    provider: "zettle",
    paymentId,
    amount,
    status: "unavailable",
    paymentStatus: "unavailable",
    message: "Refundering kræver Zettle/PayPal refund endpoint."
  };
}

module.exports = {
  createPayment,
  getPaymentStatus,
  cancelPayment,
  refundPayment,
  readSecretPresence
};
