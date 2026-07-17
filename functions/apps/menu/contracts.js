"use strict";

const { CONTRACTS } = require("../../platform/contracts");

const MenuContracts = Object.freeze({
  provides: [CONTRACTS.menu],
  consumes: [
    CONTRACTS.recipes,
    CONTRACTS.calculation,
    CONTRACTS.seo,
    CONTRACTS.ordering
  ]
});

module.exports = {
  MenuContracts
};
