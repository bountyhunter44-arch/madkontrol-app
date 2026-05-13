/**
 * CANONICAL DEMO TEMPLATES
 * 
 * Demo skal kun oprette canonical rutiner - ingen legacy/minimal/dubletter.
 */

const { CANONICAL_ROUTINE_TYPES } = require('./canonicalRoutines');

/**
 * Demo canonical templates
 * Baseret på canonical routine types med demo-specifikke enheder
 */
const DEMO_CANONICAL_TEMPLATES = [
  // CCP - Daglige kritiske kontrolpunkter
  {
    routineType: "varemodtagelse",
    unitId: "default",
    unitName: ""
  },
  {
    routineType: "opvarmning",
    unitId: "default",
    unitName: ""
  },
  {
    routineType: "nedkoeling",
    unitId: "default",
    unitName: ""
  },
  {
    routineType: "varmholdelse",
    unitId: "default",
    unitName: ""
  },
  {
    routineType: "tre_timers_regel",
    unitId: "default",
    unitName: ""
  },
  
  // Equipment-based CCP - Temperatur
  {
    routineType: "koeleskab_temperatur",
    unitId: "demo_fridge_1",
    unitName: "Køleskab 1"
  },
  {
    routineType: "fryser_temperatur",
    unitId: "demo_freezer_1",
    unitName: "Fryser 1"
  },
  
  // GAG - Daglige gode arbejdsgange
  {
    routineType: "rengoering",
    unitId: "default",
    unitName: ""
  },
  {
    routineType: "opvaskemaskine_skyllevand",
    unitId: "demo_dishwasher_1",
    unitName: "Opvaskemaskine 1"
  },
  
  // GAG - Ugentlige
  {
    routineType: "koeleskab_rengoering",
    unitId: "demo_fridge_1",
    unitName: "Køleskab 1"
  },
  {
    routineType: "adskillelse",
    unitId: "default",
    unitName: ""
  },
  
  // GAG - Månedlige
  {
    routineType: "fryser_rengoering",
    unitId: "demo_freezer_1",
    unitName: "Fryser 1"
  }
];

/**
 * Demo equipment units
 */
const DEMO_EQUIPMENT_UNITS = [
  {
    id: "demo_fridge_1",
    name: "Køleskab 1",
    displayName: "Køleskab 1",
    type: "fridge",
    category: "fridge",
    temperatureControl: {
      enabled: true,
      targetMin: 0,
      targetMax: 5,
      unit: "celsius"
    }
  },
  {
    id: "demo_freezer_1",
    name: "Fryser 1",
    displayName: "Fryser 1",
    type: "freezer",
    category: "freezer",
    temperatureControl: {
      enabled: true,
      targetMin: -25,
      targetMax: -18,
      unit: "celsius"
    }
  },
  {
    id: "demo_dishwasher_1",
    name: "Opvaskemaskine 1",
    displayName: "Opvaskemaskine 1",
    type: "dishwasher",
    category: "dishwasher"
  },
  {
    id: "demo_fryer_1",
    name: "Friture 1",
    displayName: "Friture 1",
    type: "fryer",
    category: "fryer"
  }
];

/**
 * Legacy demo titles to archive
 * These should be archived when found in existing demo data
 */
const LEGACY_DEMO_TITLES = [
  "Opvarmning / varmebehandling",
  "Opvarmning/varmebehandling",
  "Køleopbevaring",
  "Frostopbevaring",
  "Vandkontrol",
  "Opdatering af APV",
  "Opvaskemaskine skyllevandskontrol",
  "Køleskabstemperatur",
  "Frysertemperatur",
  "Køleskabsrengøring",
  "Fryserrengøring"
];

/**
 * Legacy control types to archive
 */
const LEGACY_CONTROL_TYPES = [
  "cold_storage_control",
  "freezer_storage_control",
  "dishwasher_rinse_temperature_control",
  "fridge_temperature_control",
  "freezer_temperature_control",
  "fridge_cleaning_control",
  "freezer_cleaning_control"
];

/**
 * Build canonical demo template payload
 */
function buildCanonicalDemoTemplatePayload({ routineType, unitId, unitName, companyId, locationId, userId }) {
  const definition = CANONICAL_ROUTINE_TYPES[routineType];
  if (!definition) {
    throw new Error(`Unknown routineType: ${routineType}`);
  }
  
  const anchorDate = new Date().toISOString().slice(0, 10);
  const canonicalTaskKey = `${routineType}__${unitId}`;
  
  let displayTitle = definition.title;
  if (unitId !== "default" && unitName) {
    displayTitle = `${definition.title} · ${unitName}`;
  }
  
  const templateId = `${companyId}__${locationId}__canonical__${canonicalTaskKey}`;
  
  return {
    id: templateId,
    templateId,
    companyId,
    organizationId: companyId,
    locationId,
    
    // Canonical fields
    routineType,
    unitId,
    unitName,
    canonicalTaskKey,
    
    // Display
    title: definition.title,
    displayTitle,
    longDescription: definition.longDescription,
    description: definition.longDescription,
    
    // Classification
    group: definition.group,
    category: definition.group,
    isCCP: definition.group === "CCP",
    
    // Frequency
    frequency: "interval_days",
    frequencyType: "interval_days",
    frequencyDays: definition.frequencyDays,
    interval_days: definition.frequencyDays,
    
    // Schedule
    scheduleConfig: {
      scheduleType: "recurring",
      recurrenceMode: "interval_days",
      recurrenceValue: definition.frequencyDays,
      anchorDate,
      firstRunImmediately: true,
      useDailyObservation: true
    },
    
    // Risk
    risk: definition.risk,
    
    // Metadata
    templateType: "operational",
    templateSource: "canonical_demo",
    source: "canonical_demo",
    isDemo: true,
    demoMode: true,
    isActive: true,
    active: true,
    
    // Timestamps
    createdBy: userId,
    updatedBy: userId
  };
}

/**
 * Build canonical demo equipment payload
 */
function buildCanonicalDemoEquipmentPayload({ unit, companyId, locationId, userId }) {
  return {
    id: unit.id,
    equipmentId: unit.id,
    companyId,
    organizationId: companyId,
    locationId,
    
    name: unit.name,
    displayName: unit.displayName,
    equipmentName: unit.name,
    
    type: unit.type,
    equipmentType: unit.type,
    category: unit.category,
    
    temperatureControl: unit.temperatureControl || null,
    
    isDemo: true,
    demoMode: true,
    isActive: true,
    active: true,
    
    createdBy: userId,
    updatedBy: userId
  };
}

/**
 * Check if template/instance should be archived (legacy demo)
 */
function shouldArchiveLegacyDemo(data) {
  const title = String(data.title || "").toLowerCase();
  const controlType = String(data.controlType || "").toLowerCase();
  const templateKey = String(data.templateKey || data.taskKey || "").toLowerCase();
  
  // Check legacy titles
  for (const legacyTitle of LEGACY_DEMO_TITLES) {
    if (title.includes(legacyTitle.toLowerCase())) {
      return true;
    }
  }
  
  // Check legacy control types
  if (LEGACY_CONTROL_TYPES.includes(controlType)) {
    return true;
  }
  
  // Check minimal templates
  if (templateKey.includes("minimal_")) {
    return true;
  }
  
  return false;
}

module.exports = {
  DEMO_CANONICAL_TEMPLATES,
  DEMO_EQUIPMENT_UNITS,
  LEGACY_DEMO_TITLES,
  LEGACY_CONTROL_TYPES,
  buildCanonicalDemoTemplatePayload,
  buildCanonicalDemoEquipmentPayload,
  shouldArchiveLegacyDemo
};
