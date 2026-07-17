"use strict";

const RECIPE_FIELDS = Object.freeze([
  "companyId",
  "locationId",
  "name",
  "description",
  "menuItemId",
  "portions",
  "instructions",
  "allergens",
  "active",
  "createdAt",
  "updatedAt"
]);

const RECIPE_INGREDIENT_FIELDS = Object.freeze([
  "recipeId",
  "name",
  "quantity",
  "unit",
  "costPrice",
  "allergenTags"
]);

function getRecipeContractMetadata() {
  return {
    collections: ["recipes", "recipe_ingredients"],
    recipeFields: RECIPE_FIELDS,
    recipeIngredientFields: RECIPE_INGREDIENT_FIELDS
  };
}

module.exports = {
  RECIPE_FIELDS,
  RECIPE_INGREDIENT_FIELDS,
  getRecipeContractMetadata
};
