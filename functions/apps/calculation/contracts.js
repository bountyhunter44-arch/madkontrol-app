"use strict";

const { CONTRACTS } = require("../../platform/contracts");

const CalculationContracts = Object.freeze({
  provides: [CONTRACTS.calculation],
  consumes: [
    CONTRACTS.menu,
    CONTRACTS.recipes
  ]
});

module.exports = {
  CalculationContracts
};
