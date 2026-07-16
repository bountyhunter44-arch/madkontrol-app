// SLET FRA HER

import { RISK_ANALYSIS_MASTER } from "./riskAnalysisMasterLibrary.js";
import { getRestaurantTypeProfile } from "./restaurantTypeProfiles.js";
import { getControlDefinition } from "./riskAnalysisControlMap.js";
import { getRoutineDefinition } from "../../core/canonicalRoutines.js";

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
    dishwashers: arrayOrEmpty(input.equipment?.dishwashers),
    units: arrayOrEmpty(input.equipment?.units)
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

function getReadableBusinessType(type = "") {
  const labels = {
    restaurant: "restaurant",
    cafe: "café",
    takeaway: "takeaway",
    pizzeria: "pizzeria",
    bakery: "bageri",
    catering: "catering",
    foodtruck: "foodtruck",
    bar: "bar"
  };
  const key = String(type || "").toLowerCase().trim();
  return labels[key] || key || "fødevarevirksomhed";
}

function getEquipmentSummary(onboarding) {
  const items = [];
  const equipment = onboarding.equipment || {};

  if (arrayOrEmpty(equipment.fridges).length) items.push("køleskabe");
  if (arrayOrEmpty(equipment.freezers).length) items.push("frysere");
  if (arrayOrEmpty(equipment.iceMachines).length) items.push("ismaskine/softicemaskine");
  if (arrayOrEmpty(equipment.dishwashers).length) items.push("opvaskemaskine");

  return items;
}

function getProcessSummary(onboarding) {
  const flags = onboarding.processFlags || {};
  const items = [];

  if (flags.receiving_goods) items.push("varemodtagelse");
  if (flags.cold_preparation) items.push("kold tilberedning/anretning");
  if (flags.cooking || flags.heating || flags.reheating) items.push("varmebehandling");
  if (flags.cooling) items.push("nedkøling");
  if (flags.hot_holding) items.push("varmholdelse");
  if (flags.sale_without_cooling) items.push("servering uden aktiv temperaturstyring");
  if (flags.separation) items.push("adskillelse og krydskontaminering");
  if (flags.allergens) items.push("allergenstyring");
  if (flags.traceability) items.push("sporbarhed");
  if (flags.withdrawal) items.push("tilbagetrækning");
  if (flags.cleaning_control) items.push("rengøring og hygiejne");
  if (flags.date_control) items.push("datokontrol og holdbarhed");

  return items;
}

function buildRiskAnalysisReportText(onboarding, sections) {
  const businessType = getReadableBusinessType(onboarding.restaurantType);
  const processes = getProcessSummary(onboarding);
  const equipment = getEquipmentSummary(onboarding);
  const ccpCount = sections.filter((section) => section.classification === "CCP").length;
  const gagCount = sections.filter((section) => section.classification === "GAG").length;

  const processText = processes.length
    ? processes.join(", ")
    : "de fødevareaktiviteter virksomheden har oplyst";

  const equipmentText = equipment.length
    ? ` Det registrerede udstyr (${equipment.join(", ")}) indgår i egenkontrollen med relevante temperatur-, rengørings- og vedligeholdelsesrutiner.`
    : "";

  return {
    title: "Grundlag for risikoanalyse og egenkontrol",
    body: `Virksomhedens risikoanalyse er udarbejdet ud fra de oplysninger, der er angivet i onboarding for en ${businessType}. Analysen omfatter de aktiviteter, varetyper, processer og det udstyr, som virksomheden har oplyst, herunder ${processText}.${equipmentText} Kontrolpunkter med direkte betydning for fødevaresikkerheden er udpeget som kritiske kontrolpunkter eller særligt vigtige kontrolområder. For hvert punkt er der fastsat kontrolmetode, acceptgrænse, dokumentationsfrekvens og korrigerende handling ved afvigelser. Formålet er at forebygge vækst af sygdomsfremkaldende bakterier, krydskontaminering, allergenfejl, fysisk eller kemisk forurening samt manglende sporbarhed. Afvigelser skal vurderes straks, korrigeres og dokumenteres, herunder om fødevarer kan anvendes forsvarligt eller skal kasseres.`,
    shortBody: `Risikoanalysen er baseret på virksomhedens onboarding-valg for ${businessType}, herunder aktiviteter, processer og registreret udstyr. Relevante kontrolpunkter oprettes for temperaturkontrol, varmebehandling, nedkøling, rengøring, adskillelse, allergener, sporbarhed og afvigelseshåndtering, hvor de er relevante for driften.`,
    businessType,
    processes,
    equipment,
    ccpCount,
    gagCount
  };
}

function formatControlPointFrequency(controlPoint = {}) {
  if (controlPoint.frequency) return controlPoint.frequency;
  const days = Number(controlPoint.frequencyDays || controlPoint.interval_days || 0);
  if (!days) return "Efter virksomhedens fastsatte frekvens";
  if (days === 1) return "Dagligt / ved relevant aktivitet";
  if (days === 7) return "Ugentligt";
  if (days === 14) return "Hver 14. dag";
  if (days === 30) return "Månedligt";
  if (days === 365) return "Årligt";
  return `Hver ${days}. dag`;
}

function getCanonicalReportDefinition(section = {}) {
  const candidateKeys = [
    ...arrayOrEmpty(section.taskTemplateKeys),
    ...arrayOrEmpty(section.controlKeys),
    section.key
  ];

  for (const key of candidateKeys) {
    const definition = getRoutineDefinition(key) || getRoutineDefinition(CANONICAL_REPORT_KEY_ALIASES[key]);
    if (definition) return definition;
  }

  return null;
}

function pickFirstText(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

const CANONICAL_REPORT_KEY_ALIASES = {
  goods_receiving: "varemodtagelse",
  fridge_units: "koeleskab_temperatur",
  fridge_temperature: "koeleskab_temperatur",
  freezer_units: "fryser_temperatur",
  freezer_temperature: "fryser_temperatur",
  heat_treatment: "opvarmning",
  reheating_food: "opvarmning",
  hot_holding: "varmholdelse",
  cooling_food: "nedkoeling",
  sale_3_hour_rule: "tre_timers_regel",
  separation: "adskillelse",
  cleaning_disinfection_control: "koekken_rengoering",
  cleaning_control: "koekken_rengoering",
  dishwasher_control: "opvaskemaskine_skyllevand",
  ice_machine_control: "softice_maskine_rengoering",
  allergen_control: "allergener",
  personal_hygiene_program: "personlig_hygiejne",
  traceability: "sporbarhed",
  recall: "tilbagetraekning"
};

function buildRiskAnalysisReportSection(controlPoint) {
  const type = controlPoint.type || controlPoint.classification || "CCP";
  const shortText = controlPoint.shortText || controlPoint.description || "Kontrolpunktet styres efter virksomhedens egenkontrolrutine.";
  return `${controlPoint.title} (${type}): ${shortText}`;

  return [
    `Kontrolpunkt: ${controlPoint.title} (${controlPoint.type || controlPoint.classification || "GAG"})`,
    "",
    "Beskrivelse:",
    controlPoint.description || "Ingen beskrivelse angivet.",
    "",
    "Hvad skal kontrolleres:",
    controlPoint.controlRequirement || "Følg virksomhedens procedure og dokumentér kontrollen.",
    "",
    "Sådan udføres kontrollen:",
    controlPoint.howToCheck || "Udfør kontrollen efter den tilknyttede rutine og registrér resultatet i egenkontrollen.",
    "",
    "Acceptkriterier:",
    controlPoint.criticalLimit || controlPoint.acceptCriteria || "Krav fastsættes i virksomhedens egenkontrolprogram.",
    "",
    "Frekvens:",
    controlPoint.frequency || "Efter virksomhedens fastsatte frekvens.",
    "",
    "Dokumentation:",
    controlPoint.documentation || "Registrér resultat, tidspunkt, medarbejder og eventuelle bemærkninger.",
    "",
    "Korrigerende handling:",
    controlPoint.correctiveAction || "Opret afvigelse, korrigér fejlen og dokumentér handlingen.",
    ""
  ].join("\n");
}

function buildRiskAnalysisReportFromControlPoints(controlPoints = []) {
  console.log("[riskAnalysisReport] controlPoints count", controlPoints.length);
  console.log("[riskAnalysisReport] first controlPoint", controlPoints[0] || null);

  if (!controlPoints.length) {
    const body = "Ingen aktiv risikoanalyse genereret. Der blev ikke fundet kontrolpunkter, som kan indgå i virksomhedens dokumentation.";
    return {
      title: "Ingen aktiv risikoanalyse genereret",
      body,
      shortBody: body,
      sections: [],
      controlPointsCount: 0,
      ccpCount: 0,
      gagCount: 0
    };
  }

  const sections = controlPoints.map(buildRiskAnalysisReportSection);
  const ccpCount = controlPoints.filter((point) => String(point.type || point.classification || "").toUpperCase() === "CCP").length;
  const gagCount = controlPoints.filter((point) => String(point.type || point.classification || "").toUpperCase() === "GAG").length;
  const intro = `Aktiv risikoanalyse baseret på ${controlPoints.length} konkrete kontrolpunkter fra virksomhedens egenkontrolrutiner.`;

  return {
    title: "Virksomhedens aktive risikoanalyse",
    body: [intro, "", ...sections].join("\n"),
    shortBody: `${intro} CCP: ${ccpCount}. GAG: ${gagCount}.`,
    sections,
    controlPointsCount: controlPoints.length,
    ccpCount,
    gagCount
  };
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
      titleKey: section.titleKey || null,
      title: section.title,
      classification: section.classification,
      controls: section.controls
    }))
  };
}

function buildControlPointsFromSections(sections) {
  return sections.map((section) => ({
    id: section.key,
    key: section.key,
    name: section.title,
    title: section.title,
    type: section.classification,
    classification: section.classification,
    category: section.pageGroup,
    hazard: section.body || "",
    description: section.body || "",
    controlRequirement: arrayOrEmpty(section.controls).join(", ") || "Følg virksomhedens procedure og dokumentér kontrollen.",
    control: arrayOrEmpty(section.controls).join(", ") || "Følg virksomhedens procedure og dokumentér kontrollen.",
    controlKeys: section.controlKeys || [],
    taskTemplateKeys: section.taskTemplateKeys || [],
    programSectionKeys: section.programSectionKeys || []
  }));
}

function buildRealControlPointsFromSections(sections) {
  return sections.map((section) => {
    const canonical = getCanonicalReportDefinition(section);
    const risk = canonical?.risk || {};
    const controlText = arrayOrEmpty(section.controls).join(", ");
    const description = pickFirstText(canonical?.longDescription, canonical?.description, section.body);

    return {
      id: section.key,
      key: section.key,
      name: section.title,
      title: section.title,
      type: section.classification,
      classification: section.classification,
      category: section.pageGroup,
      hazard: pickFirstText(risk.hazard, section.body),
      description,
      controlRequirement: pickFirstText(controlText, canonical?.controlRequirement, risk.deviationTrigger, "Følg virksomhedens procedure og dokumentér kontrollen."),
      control: pickFirstText(controlText, canonical?.controlRequirement, risk.deviationTrigger, "Følg virksomhedens procedure og dokumentér kontrollen."),
      howToCheck: pickFirstText(canonical?.howToCheck, "Udfør kontrollen efter den tilknyttede rutine og registrér resultatet i egenkontrollen."),
      criticalLimit: pickFirstText(canonical?.criticalLimit, canonical?.acceptCriteria, risk.criticalLimit),
      acceptCriteria: pickFirstText(canonical?.acceptCriteria, risk.criticalLimit),
      frequency: formatControlPointFrequency(canonical || {}),
      frequencyDays: canonical?.frequencyDays || null,
      documentation: "Registrér resultat, tidspunkt, medarbejder og eventuelle bemærkninger i egenkontrollen.",
      correctiveAction: pickFirstText(canonical?.correctiveAction, risk.defaultCorrectiveAction, "Opret afvigelse, korrigér fejlen og dokumentér handlingen."),
      canonicalRoutineType: canonical?.routineType || "",
      controlKeys: section.controlKeys || [],
      taskTemplateKeys: section.taskTemplateKeys || [],
      programSectionKeys: section.programSectionKeys || []
    };
  });
}

function normalizeControlPointDedupeValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ã¦|æ/g, "ae")
    .replace(/Ã¸|ø/g, "oe")
    .replace(/Ã¥|å/g, "aa")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function controlPointIncludes(controlPoint = {}, field, pattern) {
  const value = controlPoint[field];
  const values = Array.isArray(value) ? value : [value];
  return values.some((item) => normalizeControlPointDedupeValue(item).includes(pattern));
}

function isReceivingControlPoint(controlPoint = {}) {
  const title = normalizeControlPointDedupeValue(controlPoint.title || controlPoint.name);
  const controlRequirement = normalizeControlPointDedupeValue(
    controlPoint.controlRequirement ||
    controlPoint.control ||
    controlPoint.howToCheck
  );
  const searchableProgramKeys = [
    ...(controlPoint.programSectionKeys || []),
    controlPoint.programSectionKey,
    controlPoint.key,
    controlPoint.id
  ].map(normalizeControlPointDedupeValue);

  return title.includes("modtagelse") ||
    controlRequirement.includes("varemodtagelse") ||
    controlPointIncludes(controlPoint, "taskTemplateKeys", "varemodtagelse") ||
    searchableProgramKeys.some((key) =>
      key.includes("varemodtagelse") ||
      key.includes("modtagelse") ||
      (key.includes("emballage") && key.includes("modtag"))
    );
}

function getControlPointDedupeKey(controlPoint = {}) {
  if (isReceivingControlPoint(controlPoint)) {
    return "varemodtagelse";
  }

  return normalizeControlPointDedupeValue(
    controlPoint.canonicalRoutineType ||
    controlPoint.routineType ||
    controlPoint.taskTemplateKeys?.[0] ||
    controlPoint.key ||
    controlPoint.title ||
    controlPoint.name
  );
}

function isCcp(controlPoint = {}) {
  return String(controlPoint.type || controlPoint.classification || "").toUpperCase() === "CCP";
}

function receivingControlPointScore(controlPoint = {}) {
  const title = normalizeControlPointDedupeValue(controlPoint.title || controlPoint.name);
  const key = normalizeControlPointDedupeValue(controlPoint.key || controlPoint.id);
  const controlKeys = (controlPoint.controlKeys || []).map(normalizeControlPointDedupeValue);
  const programSectionKeys = (controlPoint.programSectionKeys || []).map(normalizeControlPointDedupeValue);
  const taskTemplateKeys = (controlPoint.taskTemplateKeys || []).map(normalizeControlPointDedupeValue);

  let score = 0;
  if (title.includes("modtagelse")) score += 100;
  if (key.includes("receiving") || key.includes("modtagelse")) score += 60;
  if (controlKeys.includes("goods_receiving")) score += 35;
  if (programSectionKeys.includes("varemodtagelse")) score += 35;
  if (taskTemplateKeys.includes("goods_receiving") || taskTemplateKeys.includes("varemodtagelse")) score += 25;
  if (isCcp(controlPoint)) score += 10;
  return score;
}

function mergeTextWithoutDuplicates(...values) {
  const parts = [];
  const seen = new Set();

  values.forEach((value) => {
    String(value || "")
      .split(/\n+|;\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const key = normalizeControlPointDedupeValue(part);
        if (!key || seen.has(key)) return;
        seen.add(key);
        parts.push(part);
      });
  });

  return parts.join("\n");
}

function mergeControlPoint(existing = {}, next = {}) {
  const isReceivingMerge = getControlPointDedupeKey(existing) === "varemodtagelse" ||
    getControlPointDedupeKey(next) === "varemodtagelse";
  const preferred = isReceivingMerge
    ? (receivingControlPointScore(next) > receivingControlPointScore(existing) ? next : existing)
    : (isCcp(next) && !isCcp(existing) ? next : existing);
  const secondary = preferred === existing ? next : existing;
  const type = isCcp(existing) || isCcp(next) ? "CCP" : (preferred.type || secondary.type || "");
  const mergeOrPrefer = (field) => isReceivingMerge
    ? (preferred[field] || mergeTextWithoutDuplicates(preferred[field], secondary[field]))
    : mergeTextWithoutDuplicates(preferred[field], secondary[field]);

  return {
    ...secondary,
    ...preferred,
    title: isReceivingMerge ? "Varemodtagelse" : (preferred.title || secondary.title || ""),
    name: isReceivingMerge ? "Varemodtagelse" : (preferred.name || secondary.name || preferred.title || secondary.title || ""),
    type,
    classification: type || preferred.classification || secondary.classification || "",
    description: mergeOrPrefer("description"),
    controlRequirement: mergeOrPrefer("controlRequirement"),
    control: isReceivingMerge
      ? (preferred.control || preferred.controlRequirement || mergeTextWithoutDuplicates(preferred.control, secondary.control, preferred.controlRequirement, secondary.controlRequirement))
      : mergeTextWithoutDuplicates(preferred.control, secondary.control, preferred.controlRequirement, secondary.controlRequirement),
    howToCheck: mergeOrPrefer("howToCheck"),
    criticalLimit: mergeOrPrefer("criticalLimit"),
    acceptCriteria: mergeOrPrefer("acceptCriteria"),
    frequency: preferred.frequency || secondary.frequency || "",
    frequencyDays: preferred.frequencyDays || secondary.frequencyDays || null,
    correctiveAction: mergeOrPrefer("correctiveAction"),
    canonicalRoutineType: isReceivingMerge ? "varemodtagelse" : (preferred.canonicalRoutineType || secondary.canonicalRoutineType || ""),
    controlKeys: Array.from(new Set([...(existing.controlKeys || []), ...(next.controlKeys || [])])),
    taskTemplateKeys: Array.from(new Set([...(existing.taskTemplateKeys || []), ...(next.taskTemplateKeys || [])])),
    programSectionKeys: Array.from(new Set([...(existing.programSectionKeys || []), ...(next.programSectionKeys || [])]))
  };
}

function dedupeControlPointsPreservingGuide(controlPoints = []) {
  const byKey = new Map();

  controlPoints.forEach((controlPoint) => {
    const key = getControlPointDedupeKey(controlPoint);
    if (!key) return;

    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeControlPoint(existing, controlPoint) : {
      ...controlPoint,
      ...(key === "varemodtagelse" ? {
        title: "Varemodtagelse",
        name: "Varemodtagelse",
        canonicalRoutineType: "varemodtagelse"
      } : {})
    });
  });

  return Array.from(byKey.values());
}

function getEquipmentSearchItems(onboarding = {}) {
  const equipment = onboarding.equipment || {};
  return [
    ...arrayOrEmpty(equipment.fridges),
    ...arrayOrEmpty(equipment.freezers),
    ...arrayOrEmpty(equipment.iceMachines),
    ...arrayOrEmpty(equipment.dishwashers),
    ...arrayOrEmpty(equipment.units)
  ];
}

function equipmentMatches(onboarding, needles = []) {
  const normalizedNeedles = needles.map(normalizeControlPointDedupeValue).filter(Boolean);
  if (!normalizedNeedles.length) return false;

  return getEquipmentSearchItems(onboarding).some((item) => {
    const text = normalizeControlPointDedupeValue([
      typeof item === "string" ? item : "",
      item?.name,
      item?.label,
      item?.title,
      item?.type,
      item?.equipmentType,
      item?.category
    ].filter(Boolean).join(" "));

    const simplifiedText = text.replace(/oe/g, "o").replace(/ae/g, "a").replace(/aa/g, "a");
    return normalizedNeedles.some((needle) => {
      const simplifiedNeedle = needle.replace(/oe/g, "o").replace(/ae/g, "a").replace(/aa/g, "a");
      return text.includes(needle) || simplifiedText.includes(simplifiedNeedle);
    });
  });
}

const CANONICAL_CCP_DEFINITIONS = [
  {
    routineKey: "varemodtagelse",
    templateKey: "varemodtagelse",
    title: "Varemodtagelse",
    sourceKeys: ["goods_receiving", "receiving", "modtagelse"],
    include: () => true,
    shortText: "Ved varemodtagelse kontrolleres temperatur, emballage, holdbarhed og mærkning, så varer kun modtages når fødevaresikkerheden kan dokumenteres.",
    controlRequirement: "Kontroller temperatur, emballage, holdbarhed og mærkning ved modtagelse.",
    criticalLimit: "Kølevarer højst 5 °C, frostvarer højst -18 °C, emballage hel, holdbarhed og mærkning i orden.",
    frequency: "Ved hver varemodtagelse",
    correctiveAction: "Varen vurderes straks og returneres eller kasseres, hvis fødevaresikkerheden ikke kan dokumenteres."
  },
  {
    routineKey: "opvarmning",
    templateKey: "opvarmning",
    title: "Opvarmning",
    sourceKeys: ["heat_treatment", "reheating_food", "heating"],
    include: () => true,
    shortText: "Ved opvarmning kontrolleres kernetemperaturen, så sygdomsfremkaldende bakterier nedbringes til et sikkert niveau.",
    controlRequirement: "Kontroller kernetemperatur ved opvarmning.",
    criticalLimit: "Minimum 75 °C i centrum eller tykkeste punkt, medmindre anden sikker tid/temperatur er dokumenteret.",
    frequency: "Ved hver relevant opvarmning",
    correctiveAction: "Fortsæt opvarmningen til kravet er opfyldt, mål igen og dokumentér resultatet."
  },
  {
    routineKey: "nedkoeling",
    templateKey: "nedkoeling",
    title: "Nedkøling",
    sourceKeys: ["cooling_food", "cooling_control"],
    include: () => true,
    shortText: "Ved nedkøling kontrolleres tid og temperatur, så varme fødevarer køles hurtigt ned og bakterievækst begrænses.",
    controlRequirement: "Kontroller tid og temperatur ved nedkøling.",
    criticalLimit: "Fra 65 °C til 10 °C inden for højst 4 timer.",
    frequency: "Ved hver nedkøling",
    correctiveAction: "Genopvarm til 75 °C og nedkøl igen, eller kassér fødevaren hvis sikkerheden ikke kan dokumenteres."
  },
  {
    routineKey: "varmholdelse",
    templateKey: "varmholdelse",
    title: "Varmholdelse",
    sourceKeys: ["hot_holding", "hot_holding_control"],
    include: () => true,
    shortText: "Ved varmholdelse kontrolleres temperaturen, så varme fødevarer holdes ved sikker temperatur indtil servering.",
    controlRequirement: "Kontroller temperatur ved varmholdelse.",
    criticalLimit: "Minimum 65 °C.",
    frequency: "Ved varmholdelse",
    correctiveAction: "Vurder fødevaren og kassér den, hvis fødevaresikkerheden ikke kan dokumenteres."
  },
  {
    routineKey: "tre_timers_regel",
    templateKey: "tre_timers_regel",
    title: "3-timers regel",
    sourceKeys: ["sale_3_hour_rule", "3_timers_regel"],
    include: () => true,
    shortText: "Ved brug af 3-timers reglen kontrolleres tiden uden for sikker køl eller varmholdelse, så fødevarer kasseres rettidigt.",
    controlRequirement: "Kontroller starttid, sluttid og samlet tid uden for sikker temperaturstyring.",
    criticalLimit: "Maksimalt 3 timer mellem 5 °C og 65 °C.",
    frequency: "Ved brug af 3-timers reglen",
    correctiveAction: "Kassér fødevaren efter 3 timer, medmindre fødevaresikkerheden kan dokumenteres."
  },
  {
    routineKey: "koeleskab_temperatur",
    templateKey: "koeleskab_temperatur",
    title: "Køleskab temperatur",
    sourceKeys: ["fridge_units", "fridge_temperature", "cold_storage_control"],
    include: () => true,
    shortText: "Køleskabstemperaturen kontrolleres for at sikre, at kølepligtige fødevarer opbevares ved sikker temperatur.",
    controlRequirement: "Kontroller temperatur i køleskabe.",
    criticalLimit: "Maks. 5 °C for kølevarer, medmindre produktet kræver en anden grænse.",
    frequency: "Dagligt",
    correctiveAction: "Flyt varer til fungerende køl, justér eller reparér udstyr, og vurder om varer skal kasseres."
  },
  {
    routineKey: "fryser_temperatur",
    templateKey: "fryser_temperatur",
    title: "Fryser temperatur",
    sourceKeys: ["freezer_units", "freezer_temperature", "freezer_storage_control"],
    include: () => true,
    shortText: "Frysetemperaturen kontrolleres for at sikre, at frostvarer forbliver forsvarligt frosne.",
    controlRequirement: "Kontroller temperatur i frysere.",
    criticalLimit: "Normalt -18 °C eller koldere.",
    frequency: "Dagligt",
    correctiveAction: "Kontroller fryserens funktion, flyt varer ved behov og vurder optøning eller kassation."
  },
  {
    routineKey: "koledisk_temperatur",
    templateKey: "koledisk_temperatur",
    title: "Køledisk temperatur",
    sourceKeys: ["koledisk", "koeledisk", "display_cooler_temperature"],
    include: (onboarding) => equipmentMatches(onboarding, ["køledisk", "koeledisk", "display cooler"]),
    shortText: "Kølediskens temperatur kontrolleres for at sikre, at udstillede kølevarer holdes ved korrekt temperatur.",
    controlRequirement: "Kontroller temperatur i køledisk.",
    criticalLimit: "Maks. 5 °C for kølevarer, medmindre produktet kræver en anden grænse.",
    frequency: "Dagligt",
    correctiveAction: "Juster køledisk, flyt varer til fungerende køl og vurder om varer skal kasseres."
  },
  {
    routineKey: "varmeskab_temperatur",
    templateKey: "varmeskab_temperatur",
    title: "Varmeskab temperatur",
    sourceKeys: ["varmeskab", "hot_cabinet_temperature"],
    include: (onboarding) => equipmentMatches(onboarding, ["varmeskab", "varmholdningsskab", "hot cabinet"]),
    shortText: "Varmeskabets temperatur kontrolleres for at sikre, at varme fødevarer holdes ved sikker temperatur.",
    controlRequirement: "Kontroller temperatur i varmeskab.",
    criticalLimit: "Minimum 65 °C.",
    frequency: "Ved brug",
    correctiveAction: "Genopvarm eller kassér fødevarer, hvis sikker temperatur ikke kan dokumenteres."
  },
  {
    routineKey: "blaesekoeler_temperatur",
    templateKey: "blaesekoeler_temperatur",
    title: "Blæsekøler temperatur",
    sourceKeys: ["blaesekoeler", "blast_chiller_temperature"],
    include: (onboarding) => equipmentMatches(onboarding, ["blæsekøler", "blaesekoeler", "blast chiller"]),
    shortText: "Blæsekølerens funktion kontrolleres for at sikre hurtig og dokumenteret nedkøling.",
    controlRequirement: "Kontroller temperatur og funktion ved brug af blæsekøler.",
    criticalLimit: "Nedkøling skal understøtte kravet om 65 °C til 10 °C inden for højst 4 timer.",
    frequency: "Ved brug",
    correctiveAction: "Fortsæt sikker nedkøling på anden måde eller kassér fødevaren, hvis kravet ikke kan overholdes."
  },
  {
    routineKey: "roegeovn_temperatur",
    templateKey: "roegeovn_temperatur",
    title: "Røgeovn temperatur",
    sourceKeys: ["roegeovn", "rogeovn", "smoker_temperature"],
    include: (onboarding) => equipmentMatches(onboarding, ["røgeovn", "rogeovn", "smoker"]),
    shortText: "Røgeovnens temperatur kontrolleres, så varmebehandling eller varm røgning gennemføres ved sikker temperatur.",
    controlRequirement: "Kontroller temperatur ved brug af røgeovn.",
    criticalLimit: "Følg virksomhedens dokumenterede tid/temperaturkrav for produktet.",
    frequency: "Ved brug",
    correctiveAction: "Fortsæt processen til kravet er opfyldt, eller kassér produktet hvis sikkerheden ikke kan dokumenteres."
  },
  {
    routineKey: "softice_temperatur_kontrol",
    templateKey: "softice_temperatur_kontrol",
    title: "Softice temperaturkontrol",
    sourceKeys: ["softice_temperature", "softice"],
    include: (onboarding) => equipmentMatches(onboarding, ["softice", "soft ice"]),
    shortText: "Softice- og mix-temperatur kontrolleres for at begrænse bakterievækst i kølekrævende blandinger.",
    controlRequirement: "Kontroller temperatur i softicemaskine og blanding efter virksomhedens plan.",
    criticalLimit: "Følg producentens krav og virksomhedens fastsatte temperaturgrænse for softice/mix.",
    frequency: "Efter plan og ved brug",
    correctiveAction: "Stop brug, vurder eller kassér berørt mix/softice, og ret fejlen før fortsat brug."
  }
];

function sourceControlPointMatchesDefinition(source = {}, definition = {}) {
  const searchable = [
    source.routineKey,
    source.routineType,
    source.templateKey,
    source.canonicalRoutineType,
    source.key,
    source.id,
    source.title,
    source.name,
    ...arrayOrEmpty(source.taskTemplateKeys),
    ...arrayOrEmpty(source.controlKeys),
    ...arrayOrEmpty(source.programSectionKeys)
  ].map(normalizeControlPointDedupeValue).join(" ");

  return [
    definition.routineKey,
    definition.templateKey,
    ...arrayOrEmpty(definition.sourceKeys)
  ]
    .map(normalizeControlPointDedupeValue)
    .filter(Boolean)
    .some((key) => searchable.includes(key));
}

function findGuideControlPoint(guideControlPoints, definition) {
  return arrayOrEmpty(guideControlPoints).find((point) =>
    sourceControlPointMatchesDefinition(point, definition)
  ) || {};
}

function buildCanonicalControlPoint(definition, guideControlPoints) {
  const routine = getRoutineDefinition(definition.routineKey) || {};
  const risk = routine.risk || {};
  const source = findGuideControlPoint(guideControlPoints, definition);
  const routineKey = definition.routineKey;
  const templateKey = definition.templateKey || routineKey;
  const shortText = definition.shortText;
  const controlRequirement = pickFirstText(
    definition.controlRequirement,
    source.controlRequirement,
    source.control,
    routine.controlRequirement,
    routine.purpose,
    shortText
  );
  const criticalLimit = pickFirstText(
    definition.criticalLimit,
    source.criticalLimit,
    source.acceptCriteria,
    routine.criticalLimit,
    routine.acceptCriteria,
    risk.criticalLimit
  );
  const correctiveAction = pickFirstText(
    source.correctiveAction,
    routine.correctiveAction,
    risk.defaultCorrectiveAction,
    definition.correctiveAction
  );

  return {
    id: routineKey,
    key: routineKey,
    name: definition.title,
    title: definition.title,
    type: "CCP",
    classification: "CCP",
    category: "ccp",
    routineKey,
    routineType: routineKey,
    templateKey,
    canonicalRoutineType: routineKey,
    shortText,
    description: shortText,
    guideDescription: pickFirstText(source.description, routine.longDescription, routine.description, shortText),
    hazard: pickFirstText(risk.hazard, source.hazard, shortText),
    controlRequirement,
    control: controlRequirement,
    howToCheck: pickFirstText(source.howToCheck, routine.howToCheck, "Udfør kontrollen efter den tilknyttede rutine og registrér resultatet i egenkontrollen."),
    criticalLimit,
    acceptCriteria: pickFirstText(source.acceptCriteria, routine.acceptCriteria, criticalLimit),
    frequency: pickFirstText(definition.frequency, source.frequency, formatControlPointFrequency(routine || {})),
    frequencyDays: source.frequencyDays || routine.frequencyDays || null,
    documentation: "Registrér resultat, tidspunkt, medarbejder og eventuelle bemærkninger i egenkontrollen.",
    correctiveAction,
    taskTemplateKeys: Array.from(new Set([templateKey, ...arrayOrEmpty(source.taskTemplateKeys)].filter(Boolean))),
    programSectionKeys: Array.from(new Set([routineKey, ...arrayOrEmpty(source.programSectionKeys)].filter(Boolean))),
    controlKeys: Array.from(new Set(arrayOrEmpty(source.controlKeys)))
  };
}

function dedupeCanonicalControlPoints(controlPoints = []) {
  const byKey = new Map();

  controlPoints.forEach((controlPoint) => {
    const key = normalizeControlPointDedupeValue(controlPoint.routineKey || controlPoint.templateKey || controlPoint.title);
    if (!key || byKey.has(key)) return;
    byKey.set(key, controlPoint);
  });

  return Array.from(byKey.values());
}

function buildCanonicalControlPointsFromOnboarding(onboarding, guideControlPoints = []) {
  return dedupeCanonicalControlPoints(
    CANONICAL_CCP_DEFINITIONS
      .filter((definition) => definition.include(onboarding))
      .map((definition) => buildCanonicalControlPoint(definition, guideControlPoints))
  );
}

function buildSectionFromCanonicalControlPoint(controlPoint) {
  return {
    key: controlPoint.key,
    pageGroup: "ccp",
    classification: "CCP",
    title: controlPoint.title,
    body: controlPoint.shortText || controlPoint.description || "",
    products: [],
    ingredients: [],
    controls: [controlPoint.controlRequirement].filter(Boolean),
    controlKeys: controlPoint.controlKeys || [],
    programSectionKeys: controlPoint.programSectionKeys || [],
    taskTemplateKeys: controlPoint.taskTemplateKeys || []
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

  const sourceSections = selectedBlocks.map((block) =>
    buildSectionFromBlock(block, onboarding)
  );
  console.log(`[buildRiskAnalysisFromOnboarding] Sections generated: ${sourceSections.length}`);

  if (sourceSections.length === 0) {
    console.log(`[buildRiskAnalysisFromOnboarding] WARNING: No sections generated. Selected blocks count: ${selectedBlocks.length}`);
  }

  const guideControlPoints = dedupeControlPointsPreservingGuide(buildRealControlPointsFromSections(sourceSections));
  const controlPoints = buildCanonicalControlPointsFromOnboarding(onboarding, guideControlPoints);
  const sections = controlPoints.map(buildSectionFromCanonicalControlPoint);

  const microbiologicalSections = sections.filter(
    (section) => section.pageGroup === "microbiological"
  );
  const chemicalSections = sections.filter(
    (section) => section.pageGroup === "chemical"
  );
  const physicalSections = sections.filter(
    (section) => section.pageGroup === "physical"
  );
  const ccpSections = sections.filter(
    (section) => section.pageGroup === "ccp"
  );

  const pages = [
    buildCoverPage(onboarding),
    buildHazardPage("Kritiske kontrolpunkter", "ccp", ccpSections),
    buildSummaryPage(sections)
  ];

  const riskAnalysisReport = buildRiskAnalysisReportFromControlPoints(controlPoints);

  return {
    id: `risk_analysis_${slugify(onboarding.locationId)}_${Date.now()}`,
    companyId: onboarding.companyId,
    locationId: onboarding.locationId,
    version: "2.1.0",
    restaurantType: onboarding.restaurantType,
    source: "generated_from_onboarding",
    riskAnalysisReport,
    reportIntro: riskAnalysisReport.body,
    createdAt: new Date().toISOString(),
    pages,
    sections,
    sourceSections,
    guideControlPoints,
    controlPoints,
    totalControlPoints: controlPoints.length,
    onboardingSnapshot: rawOnboarding,
    meta: {
      totalSections: sections.length,
      microbiologicalCount: microbiologicalSections.length,
      chemicalCount: chemicalSections.length,
      physicalCount: physicalSections.length
    }
  };
}

// TIL HER
