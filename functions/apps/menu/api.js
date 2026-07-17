"use strict";

const menuService = require("./service");

async function handleMenuContract(method, payload = {}) {
  if (method === "getMenuItems") {
    return menuService.getMenuItems(payload);
  }
  if (method === "getMenuCategories") {
    return menuService.getMenuCategories(payload);
  }
  if (method === "getMenuItem") {
    return menuService.getMenuItem(payload);
  }
  throw new Error(`Unsupported MenuContract method: ${method}`);
}

module.exports = {
  handleMenuContract
};
