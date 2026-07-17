"use strict";

const { getRecipeContractMetadata } = require("./service");

async function handleRecipesContract(method) {
  if (method === "metadata") {
    return getRecipeContractMetadata();
  }
  throw new Error(`Unsupported RecipeContract method: ${method}`);
}

module.exports = {
  handleRecipesContract
};
