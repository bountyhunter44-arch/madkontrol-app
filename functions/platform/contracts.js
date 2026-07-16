"use strict";

const CONTRACTS = Object.freeze({
  menu: {
    name: "MenuContract",
    methods: ["getMenuItems", "getMenuCategories", "getMenuItem", "onMenuChanged"]
  },
  recipes: {
    name: "RecipeContract",
    methods: ["getRecipes", "getRecipe", "getRecipeForMenuItem", "onRecipeChanged"]
  },
  calculation: {
    name: "CalculationContract",
    methods: ["calculateFoodCost", "calculateRecipeCost", "getMarginReport"]
  },
  seo: {
    name: "SeoContract",
    methods: ["getSeoContentSource", "getLandingPageInputs", "publishSeoSite"]
  },
  ordering: {
    name: "OrderingContract",
    methods: ["createCart", "addItem", "createOrderDraft"]
  },
  invoices: {
    name: "InvoiceContract",
    methods: ["createOfferFromEvent", "createInvoiceFromOrder"]
  },
  delefragt: {
    name: "DeliveryContract",
    methods: ["createDeliveryForOrder", "getDeliveryStatus"]
  }
});

function getContract(contractKey) {
  return CONTRACTS[contractKey] || null;
}

function getContracts() {
  return Object.values(CONTRACTS);
}

module.exports = {
  CONTRACTS,
  getContract,
  getContracts
};
