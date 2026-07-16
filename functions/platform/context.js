"use strict";

function normalizeContext(input = {}) {
  const enabledApps = Array.isArray(input.enabledApps)
    ? input.enabledApps
    : typeof input.enabledApps === "string"
      ? input.enabledApps.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  const activeModules = Array.isArray(input.activeModules)
    ? input.activeModules
    : Array.isArray(input.selectedModules)
      ? input.selectedModules
      : typeof input.activeModules === "string"
        ? input.activeModules.split(",").map((item) => item.trim()).filter(Boolean)
        : [];

  const uniqueEnabledApps = Array.from(new Set(["core", ...enabledApps]));
  const uniqueActiveModules = Array.from(new Set([...uniqueEnabledApps, ...activeModules]));

  return {
    uid: input.uid || "",
    companyId: input.companyId || input.organizationId || "",
    locationId: input.locationId || input.primaryLocationId || "",
    companyName: input.companyName || input.businessName || input.name || "",
    cvr: input.cvr || input.cvrNumber || "",
    address: input.address || "",
    postalCode: input.postalCode || input.zip || "",
    city: input.city || "",
    phone: input.phone || "",
    email: input.email || input.accountEmail || "",
    industryCode: input.industryCode || "",
    industryText: input.industryText || input.industry || "",
    activeModules: uniqueActiveModules,
    source: input.source || (input.companyId || input.companyName || input.cvr ? "company" : "missing"),
    role: input.role || "viewer",
    enabledApps: uniqueEnabledApps,
    sourceApp: input.sourceApp || "",
    targetEntityType: input.targetEntityType || "",
    targetEntityId: input.targetEntityId || "",
    returnUrl: input.returnUrl || ""
  };
}

function contextFromProfile(profile = {}, overrides = {}) {
  const company = profile.company && typeof profile.company === "object" ? profile.company : {};
  const setup = profile.setup && typeof profile.setup === "object" ? profile.setup : {};
  return normalizeContext({
    uid: overrides.uid || profile.uid || "",
    companyId: overrides.companyId || profile.companyId || profile.organizationId || "",
    locationId: overrides.locationId || profile.locationId || profile.primaryLocationId || "",
    companyName: overrides.companyName || profile.companyName || profile.businessName || profile.name || company.name || "",
    cvr: overrides.cvr || profile.cvr || profile.cvrNumber || company.cvr || "",
    address: overrides.address || profile.address || company.address || "",
    postalCode: overrides.postalCode || profile.postalCode || profile.zip || company.postalCode || company.zip || "",
    city: overrides.city || profile.city || company.city || "",
    phone: overrides.phone || profile.phone || company.phone || "",
    email: overrides.email || profile.email || profile.accountEmail || company.email || "",
    industryCode: overrides.industryCode || profile.industryCode || setup.industryCode || "",
    industryText: overrides.industryText || profile.industryText || profile.industry || setup.industryText || setup.industry || "",
    activeModules: overrides.activeModules || profile.activeModules || profile.selectedModules || [],
    source: overrides.source || profile.source || "profile",
    role: overrides.role || profile.role || "viewer",
    enabledApps: overrides.enabledApps || profile.enabledApps || profile.modules || [],
    sourceApp: overrides.sourceApp || "",
    targetEntityType: overrides.targetEntityType || "",
    targetEntityId: overrides.targetEntityId || "",
    returnUrl: overrides.returnUrl || ""
  });
}

module.exports = {
  normalizeContext,
  contextFromProfile
};
