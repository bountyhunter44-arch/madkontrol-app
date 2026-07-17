"use strict";

const { getAppAccess } = require("../../platform/entitlements");
const { contextFromProfile, normalizeContext } = require("../../platform/context");
const { MenuContracts } = require("./contracts");
const { handleMenuContract } = require("./api");

function getMenuAppDescriptor(context = {}) {
  return {
    appKey: "menu",
    access: getAppAccess("menu", normalizeContext(context)),
    contracts: MenuContracts
  };
}

module.exports = {
  contextFromProfile,
  getMenuAppDescriptor,
  handleMenuContract
};
