/**
 * onboarding-module-registry.js
 *
 * Single source of truth for onboarding modules: which modules exist, whether they need a
 * module-specific setup step, which frontend section renders that setup, default setup data,
 * required fields, and which BACKEND provisioner key handles the module.
 *
 * The wizard reads this registry to decide which setup steps to show for the selected modules,
 * and which entry URL to route to after signup. The backend keeps its own MODULE_PROVISIONERS
 * map (functions/modules/onboarding/moduleProvisioners.js) keyed by the same `provisioner` value.
 */

export const ONBOARDING_MODULES = [
  {
    moduleId: "egenkontrol",
    label: "Egenkontrol",
    description: "Daglige rutiner, risikoanalyse og myndighedsrapport.",
    setupStepId: "egenkontrol-setup",
    requiresSetup: true,
    setupSectionSelector: '[data-module-setup="egenkontrol"]',
    provisioner: "provisionEgenkontrolModule",
    requiredFields: [], // setup is recommended but not hard-required to create the account
    defaultSetup: {
      industry: "",
      questions: {},
      fridgeCount: 0, freezerCount: 0, walkinCoolerCount: 0, walkinFreezerCount: 0,
      refrigeratedDisplayCount: 0, dishwasherCount: 0, fryerCount: 0, ovenCount: 0,
      stoveCount: 0, blastChillerCount: 0, hotCabinetCount: 0, proofingCabinetCount: 0,
      smokeOvenCount: 0, slicerCount: 0, softiceMachineCount: 0
    },
    entryUrl: "/modules/egenkontrol/rutiner.html"
  },
  // Modules below are registry-ready but have NO onboarding setup/provisioner runtime yet.
  {
    moduleId: "pos", label: "POS",
    description: "Kasse, salg, dagsafslutning og betaling.",
    setupStepId: null, requiresSetup: false, setupSectionSelector: null,
    provisioner: "provisionPosModule", requiredFields: [], defaultSetup: {},
    entryUrl: "https://madkontrollen-pos.web.app/pos/index.html"
  },
  {
    moduleId: "lagerkontrol", label: "Lagerkontrol",
    description: "Varer, optælling, varemodtagelse og svind.",
    setupStepId: null, requiresSetup: false, setupSectionSelector: null,
    provisioner: "provisionLagerkontrolModule", requiredFields: [], defaultSetup: {},
    entryUrl: "/modules/lagerkontrol/index.html"
  },
  {
    moduleId: "koerselskontrol", label: "Kørselskontrol",
    description: "Ture, kørsel og dokumentation.",
    setupStepId: null, requiresSetup: false, setupSectionSelector: null,
    provisioner: "provisionKoerselskontrolModule", requiredFields: [], defaultSetup: {},
    entryUrl: "/modules/koerselskontrol/index.html"
  },
  {
    moduleId: "seo", label: "SEO Automatik",
    description: "Lokale landingssider, synlighed og søgemaskineoptimering.",
    setupStepId: null, requiresSetup: false, setupSectionSelector: null,
    provisioner: "provisionSeoModule", requiredFields: [], defaultSetup: {},
    entryUrl: "/modules/seo/generator.html"
  },
  // No provisioner yet — registry-only so routing/labels work, no runtime is built.
  {
    moduleId: "menu", label: "Menu / Opskrifter",
    description: "Menuer, opskrifter, allergener og indhold.",
    setupStepId: null, requiresSetup: false, setupSectionSelector: null,
    provisioner: null, requiredFields: [], defaultSetup: {},
    entryUrl: "/modules/menu/menu.html"
  },
  {
    moduleId: "kalkulation", label: "Kalkulation",
    description: "Opskrifter, dækningsbidrag og kostpriser.",
    setupStepId: null, requiresSetup: false, setupSectionSelector: null,
    provisioner: null, requiredFields: [], defaultSetup: {},
    entryUrl: "/modules/kalkulation/index.html"
  },
  {
    moduleId: "bogforing", label: "Bogføringsappen",
    description: "Bilag, moms, kassekladde og bogføringsforslag.",
    setupStepId: null, requiresSetup: false, setupSectionSelector: null,
    provisioner: null, requiredFields: [], defaultSetup: {},
    entryUrl: "/modules/accounting/index.html"
  }
];

export function getOnboardingModule(moduleId) {
  return ONBOARDING_MODULES.find((m) => m.moduleId === moduleId) || null;
}

/** Modules (from the selected set) that need a dedicated setup step shown in the wizard. */
export function modulesRequiringSetup(selectedIds = []) {
  const set = new Set(selectedIds);
  return ONBOARDING_MODULES.filter((m) => m.requiresSetup && set.has(m.moduleId));
}

/** Entry URL to route to after signup for a given module (falls back to dashboard). */
export function moduleEntryUrl(moduleId) {
  const m = getOnboardingModule(moduleId);
  return (m && m.entryUrl) || "/dashboard.html";
}

/** Build an empty moduleSetup object seeded with defaults for the setup-requiring modules. */
export function buildDefaultModuleSetup(selectedIds = []) {
  const out = {};
  modulesRequiringSetup(selectedIds).forEach((m) => { out[m.moduleId] = { ...m.defaultSetup }; });
  return out;
}
