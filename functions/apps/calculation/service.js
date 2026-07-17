"use strict";

const CALCULATION_FIELDS = Object.freeze([
  "companyId",
  "locationId",
  "recipeId",
  "recipeName",
  "menuItemId",
  "totalCost",
  "costPerPortion",
  "targetMarginPercent",
  "suggestedPrice",
  "createdAt",
  "updatedAt"
]);

function calculateRecipeCost({ recipe = {}, ingredients = [], targetMarginPercent = 70 } = {}) {
  const safeMargin = Math.min(95, Math.max(0, Number(targetMarginPercent || 0)));
  const totalCost = roundMoney(ingredients.reduce((sum, item) => {
    return sum + (Number(item.costPrice || 0) * Number(item.quantity || 0));
  }, 0));
  const portions = Math.max(1, Number(recipe.portions || 1));
  const costPerPortion = roundMoney(totalCost / portions);
  const suggestedPrice = safeMargin >= 95
    ? 0
    : roundMoney(costPerPortion / (1 - safeMargin / 100));

  return {
    recipeId: recipe.id || "",
    recipeName: recipe.name || "",
    menuItemId: recipe.menuItemId || "",
    totalCost,
    costPerPortion,
    targetMarginPercent: safeMargin,
    suggestedPrice
  };
}

function getCalculationContractMetadata() {
  return {
    collections: ["calculation_reports", "calculation_snapshots"],
    calculationFields: CALCULATION_FIELDS
  };
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

module.exports = {
  CALCULATION_FIELDS,
  calculateRecipeCost,
  getCalculationContractMetadata
};
