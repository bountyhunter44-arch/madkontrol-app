"use strict";

const zettleProvider = require("./zettle-provider");
const manualProvider = require("./manual-provider");

function getPaymentProvider(provider) {
  const key = String(provider || "").trim().toLowerCase();
  if (key === "zettle" || key === "paypal") return zettleProvider;
  if (key === "manual") return manualProvider;
  throw new Error(`Ukendt betalingsudbyder: ${provider}`);
}

module.exports = {
  getPaymentProvider,
  zettleProvider,
  manualProvider
};
