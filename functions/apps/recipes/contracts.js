"use strict";

const { CONTRACTS } = require("../../platform/contracts");

const RecipesContracts = Object.freeze({
  provides: [CONTRACTS.recipes],
  consumes: [
    CONTRACTS.menu,
    CONTRACTS.calculation,
    CONTRACTS.seo
  ]
});

module.exports = {
  RecipesContracts
};
