// SLET FRA HER

import { RISK_ANALYSIS_MASTER } from "./riskAnalysisMasterLibrary.js";
import { getRestaurantTypeProfile } from "./restaurantTypeProfiles.js";
import { getControlDefinition } from "./riskAnalysisControlMap.js";

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function bool(value) {
  return value === true;
}

function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeOnboarding(input = {}) {
  const restaurantType = input.restaurantType || input.businessType || "restaurant";

  const equipment = {
    fridges: arrayOrEmpty(input.equipment?.fridges),
    freezers: arrayOrEmpty(input.equipment?.freezers),
    iceMachines: arrayOrEmpty(input.equipment?.iceMachines),
    dishwashers: arrayOrEmpty(input.equipment?.dishwashers)
  };

  const processFlags = {
    receiving_goods: bool(input.processes?.receivingGoods),
    cooking: bool(input.processes?.cooking),
    heating: bool(input.processes?.heating),
    reheating: bool(input.processes?.reheating),
    cooling: bool(input.processes?.cooling),
    hot_holding: bool(input.processes?.hotHolding),
    sale_without_cooling: bool(input.processes?.saleWithoutCooling),
    separation: bool(input.processes?.separation),
    date_control: bool(input.processes?.dateControl),
    cleaning_control: bool(input.processes?.cleaningControl),
    cold_preparation: bool(input.processes?.coldPreparation)
  };

  return {
    companyId: input.companyId || "company_1",
    locationId: input.locationId || "location_1",
    companyName: input.companyName || "",
    address: input.address || "",
    restaurantType,
    equipment,
    processFlags
  };
}

function onboardingHasRequiredMatch(block, onboarding) {
  const rules = block.appliesWhen || {};
  const processRules = arrayOrEmpty(rules.processesAny);
  const businessTypeRules = arrayOrEmpty(rules.businessTypesAny);
  const equipmentRules = arrayOrEmpty(rules.equipmentAny);

  const processMatch =
    processRules.length === 0 ||
    processRules.some((key) => onboarding.processFlags[key] === true);

  const businessTypeMatch =
    businessTypeRules.length === 0 ||
    businessTypeRules.includes(onboarding.restaurantType);

  const equipmentMatch =
    equipmentRules.length === 0 ||
    equipmentRules.some((equipmentKey) => {
      const list = onboarding.equipment[equipmentKey];
      return Array.isArray(list) && list.length > 0;
    });

  return processMatch && businessTypeMatch && equipmentMatch;
}

function getDynamicControlLabels(controlKey, onboarding) {
  if (controlKey === "fridge_units") {
    const units = onboarding.equipment.fridges;
    if (!units.length) return [];
    return units.map((unit, index) => `${unit.name || `Køleskab ${index + 1}`} (+5)`);
  }

  if (controlKey === "freezer_units") {
    const units = onboarding.equipment.freezers;
    if (!units.length) return [];
    return units.map((unit, index) => `${unit.name || `Fryser ${index + 1}`} (-18)`);
  }

  const control = getControlDefinition(controlKey);
  return control ? [control.label] : [];
}

function getProgramSectionKeysForBlock(block) {
  return arrayOrEmpty(block.controlKeys)
    .map((controlKey) => getControlDefinition(controlKey))
    .filter(Boolean)
    .map((control) => control.programSectionKey)
    .filter(Boolean);
}

function getTaskTemplateKeysForBlock(block) {
  return arrayOrEmpty(block.controlKeys)
    .map((controlKey) => getControlDefinition(controlKey))
    .filter(Boolean)
    .map((control) => control.taskTemplateKey)
    .filter(Boolean);
}

function buildSectionFromBlock(block, onboarding) {
  const resolvedControls = arrayOrEmpty(block.controlKeys).flatMap((controlKey) =>
    getDynamicControlLabels(controlKey, onboarding)
  );

  return {
    key: block.key,
    pageGroup: block.pageGroup,
    classification: block.classification,
    // i18n keys for title and body — renderer uses t(titleKey, lang) || title
    titleKey: `risk.${block.key}.title`,
    bodyKey: `risk.${block.key}.body`,
    title: block.title,
    body: block.body,
    products: block.products || [],
    ingredients: block.ingredients || [],
    controls: resolvedControls,
    controlKeys: block.controlKeys || [],
    programSectionKeys: [...new Set(getProgramSectionKeysForBlock(block))],
    taskTemplateKeys: [...new Set(getTaskTemplateKeysForBlock(block))]
  };
}

function buildCoverPage(onboarding) {
  return {
    pageType: "cover",
    titleKey: "risk.page.cover.title",
    introKey: "risk.page.cover.intro",
    title: "Risikoanalyse",
    intro: "I skemaet nedenfor er beskrevet de forhold der kan udgøre en sundhedsrisiko, og hvilke forholdsregler virksomheden skal tage for at modgå de forskellige risici.",
    company: {
      companyName: onboarding.companyName,
      address: onboarding.address,
      restaurantType: onboarding.restaurantType,
      createdAt: new Date().toISOString()
    }
  };
}

function buildHazardPage(title, pageGroup, sections) {
  const pageGroupKeyMap = {
    microbiological: "risk.page.microbiological.title",
    chemical: "risk.page.chemical.title",
    physical: "risk.page.physical.title"
  };
  return {
    pageType: "hazard_group",
    pageGroup,
    titleKey: pageGroupKeyMap[pageGroup] || null,
    title,
    sections
  };
}

function buildSummaryPage(allSections) {
  return {
    pageType: "summary",
    titleKey: "risk.page.summary.title",
    title: "Oversigt over kontrolpunkter",
    items: allSections.map((section) => ({
      key: section.key,
      titleKey: section.titleKey,
      title: section.title,
      classification: section.classification,
      controls: section.controls
    }))
  };
}

export function buildRiskAnalysisFromOnboarding(rawOnboarding = {}) {
  const onboarding = normalizeOnboarding(rawOnboarding);
  const normalizedType = onboarding.restaurantType.toLowerCase();
  console.log(`[buildRiskAnalysisFromOnboarding] Original type: "${onboarding.restaurantType}", Normalized: "${normalizedType}"`);
  const profile = getRestaurantTypeProfile(normalizedType);
  console.log(`[buildRiskAnalysisFromOnboarding] Profile defaultRiskKeys count: ${profile.defaultRiskKeys.length}`);

  const baseBlocks = RISK_ANALYSIS_MASTER.filter((block) =>
    profile.defaultRiskKeys.includes(block.key)
  );
  console.log(`[buildRiskAnalysisFromOnboarding] Base blocks matched: ${baseBlocks.length}`);

  const selectedBlocks = baseBlocks.filter((block) => {
    const appliesWhen = block.appliesWhen || {};
    const hasNoConditions = !appliesWhen.processesAny && !appliesWhen.businessTypesAny && !appliesWhen.equipmentAny;
    const matches = hasNoConditions || onboardingHasRequiredMatch(block, onboarding);
    if (!matches && baseBlocks.length < 5) {
      console.log(`[buildRiskAnalysisFromOnboarding] Block "${block.key}" filtered out - appliesWhen:`, appliesWhen);
    }
    return matches;
  });
  console.log(`[buildRiskAnalysisFromOnboarding] Selected blocks after filtering: ${selectedBlocks.length}`);

  const sections = selectedBlocks.map((block) =>
    buildSectionFromBlock(block, onboarding)
  );
  console.log(`[buildRiskAnalysisFromOnboarding] Sections generated: ${sections.length}`);

  if (sections.length === 0) {
    console.log(`[buildRiskAnalysisFromOnboarding] WARNING: No sections generated. Selected blocks count: ${selectedBlocks.length}`);
  }

  const microbiologicalSections = sections.filter(
    (section) => section.pageGroup === "microbiological"
  );
  const chemicalSections = sections.filter(
    (section) => section.pageGroup === "chemical"
  );
  const physicalSections = sections.filter(
    (section) => section.pageGroup === "physical"
  );

  const pages = [
    buildCoverPage(onboarding),
    buildHazardPage("Mikrobiologiske sundhedsfarer", "microbiological", microbiologicalSections),
    buildHazardPage("Kemiske sundhedsfarer", "chemical", chemicalSections),
    buildHazardPage("Fysiske sundhedsfarer", "physical", physicalSections),
    buildSummaryPage(sections)
  ];

  return {
    id: `risk_analysis_${slugify(onboarding.locationId)}_${Date.now()}`,
    companyId: onboarding.companyId,
    locationId: onboarding.locationId,
    restaurantType: onboarding.restaurantType,
    source: "generated_from_onboarding",
    createdAt: new Date().toISOString(),
    pages,
    sections,
    meta: {
      totalSections: sections.length,
      microbiologicalCount: microbiologicalSections.length,
      chemicalCount: chemicalSections.length,
      physicalCount: physicalSections.length
    }
  };
}

// TIL HER