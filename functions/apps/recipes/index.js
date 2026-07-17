"use strict";

const { getAppAccess } = require("../../platform/entitlements");
const { normalizeContext } = require("../../platform/context");
const { RecipesContracts } = require("./contracts");
const { handleRecipesContract } = require("./api");

function getRecipesAppDescriptor(context = {}) {
  return {
    appKey: "recipes",
    access: getAppAccess("recipes", normalizeContext(context)),
    contracts: RecipesContracts
  };
}

module.exports = {
  getRecipesAppDescriptor,
  handleRecipesContract
};
