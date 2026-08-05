export const PLATFORM_APP_REGISTRY = [
  {
    appKey: "madkontrollen-core",
    name: "Madkontrollen Core",
    description: "Auth, company/location context, egenkontrol shell and shared platform services.",
    group: "core",
    entryUrl: "/dashboard.html",
    standalone: true,
    canActAsShell: true,
    status: "active",
    requiredEntitlement: "core",
    requiredRoles: ["owner", "hq_admin", "admin", "manager", "employee"],
    providesContracts: ["platform.context", "platform.entitlements", "platform.launcher"],
    consumesContracts: [],
    provides: ["company_profile", "company_context", "active_modules"],
    consumes: [],
    optionalIntegrations: ["egenkontrol"],
    relatedApps: [],
    ownsCollections: ["users", "organizations", "companies", "locations"],
    ownsFunctions: [],
    demoContentAllowed: true
  },
  {
    appKey: "egenkontrol",
    name: "Egenkontrol",
    description: "Rutiner, risikoanalyse, rapporter og fødevarekontrol pr. virksomhed og lokation.",
    group: "operations",
    entryUrl: "/modules/egenkontrol/rutiner.html",
    standalone: true,
    canActAsShell: false,
    status: "active",
    requiredEntitlement: "egenkontrol",
    requiredRoles: ["owner", "hq_admin", "admin", "manager", "employee"],
    providesContracts: ["egenkontrol.program"],
    consumesContracts: ["platform.context"],
    provides: ["routines", "risk_analysis", "control_reports"],
    consumes: ["company_profile"],
    optionalIntegrations: [],
    relatedApps: [],
    ownsCollections: ["companies/{companyId}/locations/{locationId}/risk_analysis", "task_instances"],
    ownsFunctions: ["generateRisksForLocation", "generateTemplatesForLocation"],
    demoContentAllowed: true
  },
];

export function getAppRegistry() {
  return PLATFORM_APP_REGISTRY.map((app) => ({ ...app }));
}

export function getAppByKey(appKey) {
  const key = String(appKey || "").trim().toLowerCase();
  return PLATFORM_APP_REGISTRY.find((app) => {
    const appKeys = [
      app.appKey,
      app.requiredEntitlement,
      ...(Array.isArray(app.aliases) ? app.aliases : [])
    ].map((value) => String(value || "").trim().toLowerCase());
    return appKeys.includes(key);
  }) || null;
}

export function getAppsByGroup(group) {
  const cleanGroup = String(group || "").trim();
  return getAppRegistry().filter((app) => app.group === cleanGroup);
}
