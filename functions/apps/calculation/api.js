"use strict";

const {
  calculateRecipeCost,
  getCalculationContractMetadata
} = require("./service");

async function handleCalculationContract(method, payload = {}) {
  if (method === "metadata") {
    return getCalculationContractMetadata();
  }
  if (method === "calculateRecipeCost") {
    return calculateRecipeCost(payload);
  }
  throw new Error(`Unsupported CalculationContract method: ${method}`);
}

module.exports = {
  handleCalculationContract
};
