"use strict";

const { getAppAccess } = require("../../platform/entitlements");
const { normalizeContext } = require("../../platform/context");
const { CalculationContracts } = require("./contracts");
const { handleCalculationContract } = require("./api");

function getCalculationAppDescriptor(context = {}) {
  return {
    appKey: "calculation",
    access: getAppAccess("calculation", normalizeContext(context)),
    contracts: CalculationContracts
  };
}

module.exports = {
  getCalculationAppDescriptor,
  handleCalculationContract
};
