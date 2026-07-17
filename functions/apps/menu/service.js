"use strict";

async function getMenuItems({ companyId, locationId }) {
  return {
    items: [],
    companyId: companyId || "",
    locationId: locationId || "",
    source: "menu-service-stub"
  };
}

async function getMenuCategories({ companyId, locationId }) {
  return {
    categories: [],
    companyId: companyId || "",
    locationId: locationId || "",
    source: "menu-service-stub"
  };
}

async function getMenuItem({ menuItemId }) {
  return {
    item: null,
    menuItemId: menuItemId || "",
    source: "menu-service-stub"
  };
}

module.exports = {
  getMenuItems,
  getMenuCategories,
  getMenuItem
};
