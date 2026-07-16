/* SLET FRA HER */

export const CONTROL_FAMILIES = {
  temperature: {
    key: "temperature",
    title: "Temperaturkontrol",
    shortTitle: "Temperatur",
  },
  cleaning: {
    key: "cleaning",
    title: "Rengøringskontrol",
    shortTitle: "Rengøring",
  },
  maintenance: {
    key: "maintenance",
    title: "Vedligeholdelseskontrol",
    shortTitle: "Vedligeholdelse",
  },
};

export const CONTROL_LEVELS = {
  ccp: {
    key: "ccp",
    title: "CCP",
    priority: 100,
  },
  gag: {
    key: "gag",
    title: "GAG",
    priority: 10,
  },
};

export const RELATION_TYPES = {
  unit: {
    key: "unit",
    title: "Enhed",
  },
  area: {
    key: "area",
    title: "Område",
  },
  process: {
    key: "process",
    title: "Proces",
  },
};

export const UNIT_TYPE_DEFINITIONS = {
  fridge: {
    key: "fridge",
    title: "Køleskab",
    pluralTitle: "Køleskabe",
  },
  freezer: {
    key: "freezer",
    title: "Fryseskab",
    pluralTitle: "Fryseskabe",
  },
  walkin_fridge: {
    key: "walkin_fridge",
    title: "Walk-in køler",
    pluralTitle: "Walk-in kølere",
  },
  walkin_freezer: {
    key: "walkin_freezer",
    title: "Walk-in fryser",
    pluralTitle: "Walk-in frysere",
  },
  softice_machine: {
    key: "softice_machine",
    title: "Softice maskine",
    pluralTitle: "Softice maskiner",
  },
  fryer: {
    key: "fryer",
    title: "Friture",
    pluralTitle: "Friturer",
  },
  bain_marie: {
    key: "bain_marie",
    title: "Bain Marie",
    pluralTitle: "Bain Marie enheder",
  },
  warming_cabinet: {
    key: "warming_cabinet",
    title: "Varmeskab",
    pluralTitle: "Varmeskabe",
  },
  cooling_fan: {
    key: "cooling_fan",
    title: "Køleblæser",
    pluralTitle: "Køleblæsere",
  },
};

export const AREA_TYPE_DEFINITIONS = {
  kitchen: {
    key: "kitchen",
    title: "Køkken",
  },
  vegetable_room: {
    key: "vegetable_room",
    title: "Grøntsagsrum",
  },
  cold_room_area: {
    key: "cold_room_area",
    title: "Kølerum",
  },
  freezer_room_area: {
    key: "freezer_room_area",
    title: "Fryserum",
  },
  dishwash_area: {
    key: "dishwash_area",
    title: "Opvaskeområde",
  },
  storage_area: {
    key: "storage_area",
    title: "Lager",
  },
  floor_drain_area: {
    key: "floor_drain_area",
    title: "Gulvafløb og riste",
  },
};

export const PROCESS_TYPE_DEFINITIONS = {
  heating: {
    key: "heating",
    title: "Opvarmning",
  },
  cooling: {
    key: "cooling",
    title: "Nedkøling",
  },
  hot_holding: {
    key: "hot_holding",
    title: "Varmholdelse",
  },
};

export const CONTROL_MATRIX = [
  // =========================
  // TEMPERATURKONTROL - CCP
  // =========================
  {
    key: "temperature_fridge",
    controlFamily: "temperature",
    controlTarget: "fridge",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Køleskab",
    evidenceMode: "photo",
    requiredPhotoSlots: ["interior_overview", "thermometer_closeup"],
    aiChecks: ["thermometer_visible", "temperature_readable"],
  },
  {
    key: "temperature_freezer",
    controlFamily: "temperature",
    controlTarget: "freezer",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Fryseskab",
    evidenceMode: "photo",
    requiredPhotoSlots: ["interior_overview", "thermometer_closeup"],
    aiChecks: ["thermometer_visible", "temperature_readable"],
  },
  {
    key: "temperature_walkin_fridge",
    controlFamily: "temperature",
    controlTarget: "walkin_fridge",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Walk-in køler",
    evidenceMode: "photo",
    requiredPhotoSlots: ["interior_overview", "thermometer_closeup"],
    aiChecks: ["thermometer_visible", "temperature_readable"],
  },
  {
    key: "temperature_walkin_freezer",
    controlFamily: "temperature",
    controlTarget: "walkin_freezer",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Walk-in fryser",
    evidenceMode: "photo",
    requiredPhotoSlots: ["interior_overview", "thermometer_closeup"],
    aiChecks: ["thermometer_visible", "temperature_readable"],
  },
  {
    key: "temperature_softice_machine",
    controlFamily: "temperature",
    controlTarget: "softice_machine",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Softice maskine",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "temperature_display_closeup"],
    aiChecks: ["temperature_readable", "machine_visible"],
  },
  {
    key: "temperature_fryer",
    controlFamily: "temperature",
    controlTarget: "fryer",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Friture",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "temperature_display_closeup"],
    aiChecks: ["temperature_readable", "machine_visible"],
  },
  {
    key: "temperature_bain_marie",
    controlFamily: "temperature",
    controlTarget: "bain_marie",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Bain Marie",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "temperature_display_closeup"],
    aiChecks: ["temperature_readable", "machine_visible"],
  },
  {
    key: "temperature_warming_cabinet",
    controlFamily: "temperature",
    controlTarget: "warming_cabinet",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Varmeskab",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "temperature_display_closeup"],
    aiChecks: ["temperature_readable", "machine_visible"],
  },
  {
    key: "temperature_cooling_fan",
    controlFamily: "temperature",
    controlTarget: "cooling_fan",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Køleblæser",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "temperature_display_closeup"],
    aiChecks: ["temperature_readable", "machine_visible"],
  },
  {
    key: "temperature_process_heating",
    controlFamily: "temperature",
    controlTarget: "heating",
    relationType: "process",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Proces – Opvarmning",
    evidenceMode: "photo",
    requiredPhotoSlots: ["product_overview", "temperature_probe_or_display"],
    aiChecks: ["temperature_readable"],
  },
  {
    key: "temperature_process_cooling",
    controlFamily: "temperature",
    controlTarget: "cooling",
    relationType: "process",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Proces – Nedkøling",
    evidenceMode: "photo",
    requiredPhotoSlots: ["product_overview", "temperature_probe_or_display"],
    aiChecks: ["temperature_readable"],
  },
  {
    key: "temperature_process_hot_holding",
    controlFamily: "temperature",
    controlTarget: "hot_holding",
    relationType: "process",
    controlLevel: "ccp",
    titleBase: "Temperaturkontrol – Proces – Varmholdelse",
    evidenceMode: "photo",
    requiredPhotoSlots: ["product_overview", "temperature_probe_or_display"],
    aiChecks: ["temperature_readable"],
  },

  // =========================
  // RENGØRINGSKONTROL - CCP
  // =========================
  {
    key: "cleaning_fridge",
    controlFamily: "cleaning",
    controlTarget: "fridge",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Køleskab",
    evidenceMode: "photo",
    requiredPhotoSlots: ["interior_overview", "surface_closeup"],
    aiChecks: ["cleanliness", "separation"],
  },
  {
    key: "cleaning_freezer",
    controlFamily: "cleaning",
    controlTarget: "freezer",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Fryser",
    evidenceMode: "photo",
    requiredPhotoSlots: ["interior_overview", "surface_closeup"],
    aiChecks: ["cleanliness", "separation"],
  },
  {
    key: "cleaning_walkin_fridge",
    controlFamily: "cleaning",
    controlTarget: "walkin_fridge",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Walk-in køler",
    evidenceMode: "photo",
    requiredPhotoSlots: ["interior_overview", "surface_closeup"],
    aiChecks: ["cleanliness", "separation"],
  },
  {
    key: "cleaning_walkin_freezer",
    controlFamily: "cleaning",
    controlTarget: "walkin_freezer",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Walk-in fryser",
    evidenceMode: "photo",
    requiredPhotoSlots: ["interior_overview", "surface_closeup"],
    aiChecks: ["cleanliness", "separation"],
  },
  {
    key: "cleaning_softice_machine",
    controlFamily: "cleaning",
    controlTarget: "softice_machine",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Softice maskine",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "critical_surface_closeup"],
    aiChecks: ["cleanliness"],
  },
  {
    key: "cleaning_fryer",
    controlFamily: "cleaning",
    controlTarget: "fryer",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Friture",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "critical_surface_closeup"],
    aiChecks: ["cleanliness"],
  },
  {
    key: "cleaning_bain_marie",
    controlFamily: "cleaning",
    controlTarget: "bain_marie",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Bain Marie",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "critical_surface_closeup"],
    aiChecks: ["cleanliness"],
  },
  {
    key: "cleaning_warming_cabinet",
    controlFamily: "cleaning",
    controlTarget: "warming_cabinet",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Varmeskab",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "critical_surface_closeup"],
    aiChecks: ["cleanliness"],
  },
  {
    key: "cleaning_cooling_fan",
    controlFamily: "cleaning",
    controlTarget: "cooling_fan",
    relationType: "unit",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Køleblæser",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "critical_surface_closeup"],
    aiChecks: ["cleanliness"],
  },

  // =========================
  // RENGØRINGSKONTROL - OMRÅDER - CCP
  // =========================
  {
    key: "cleaning_area_kitchen",
    controlFamily: "cleaning",
    controlTarget: "kitchen",
    relationType: "area",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Køkken",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "critical_surface_closeup"],
    aiChecks: ["cleanliness"],
  },
  {
    key: "cleaning_area_vegetable_room",
    controlFamily: "cleaning",
    controlTarget: "vegetable_room",
    relationType: "area",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Grøntsagsrum",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "critical_surface_closeup"],
    aiChecks: ["cleanliness"],
  },
  {
    key: "cleaning_area_cold_room",
    controlFamily: "cleaning",
    controlTarget: "cold_room_area",
    relationType: "area",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Kølerum",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "critical_surface_closeup"],
    aiChecks: ["cleanliness"],
  },
  {
    key: "cleaning_area_freezer_room",
    controlFamily: "cleaning",
    controlTarget: "freezer_room_area",
    relationType: "area",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Fryserum",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "critical_surface_closeup"],
    aiChecks: ["cleanliness"],
  },
  {
    key: "cleaning_area_dishwash",
    controlFamily: "cleaning",
    controlTarget: "dishwash_area",
    relationType: "area",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Opvaskeområde",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "critical_surface_closeup"],
    aiChecks: ["cleanliness"],
  },
  {
    key: "cleaning_area_storage",
    controlFamily: "cleaning",
    controlTarget: "storage_area",
    relationType: "area",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Lager",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "critical_surface_closeup"],
    aiChecks: ["cleanliness"],
  },
  {
    key: "cleaning_area_floor_drain",
    controlFamily: "cleaning",
    controlTarget: "floor_drain_area",
    relationType: "area",
    controlLevel: "ccp",
    titleBase: "Rengøringskontrol – Gulvafløb og riste",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview", "drain_closeup"],
    aiChecks: ["cleanliness"],
  },

  // =========================
  // VEDLIGEHOLDELSE - GAG
  // =========================
  {
    key: "maintenance_fridge",
    controlFamily: "maintenance",
    controlTarget: "fridge",
    relationType: "unit",
    controlLevel: "gag",
    titleBase: "Vedligeholdelseskontrol – Køleskab",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview"],
    aiChecks: ["visible_damage"],
  },
  {
    key: "maintenance_freezer",
    controlFamily: "maintenance",
    controlTarget: "freezer",
    relationType: "unit",
    controlLevel: "gag",
    titleBase: "Vedligeholdelseskontrol – Fryser",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview"],
    aiChecks: ["visible_damage"],
  },
  {
    key: "maintenance_walkin_fridge",
    controlFamily: "maintenance",
    controlTarget: "walkin_fridge",
    relationType: "unit",
    controlLevel: "gag",
    titleBase: "Vedligeholdelseskontrol – Walk-in køler",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview"],
    aiChecks: ["visible_damage"],
  },
  {
    key: "maintenance_walkin_freezer",
    controlFamily: "maintenance",
    controlTarget: "walkin_freezer",
    relationType: "unit",
    controlLevel: "gag",
    titleBase: "Vedligeholdelseskontrol – Walk-in fryser",
    evidenceMode: "photo",
    requiredPhotoSlots: ["overview"],
    aiChecks: ["visible_damage"],
  },
];

export function sanitizeString(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildUnitId(unitType, indexOrName) {
  const safeType = sanitizeString(unitType, 60);
  const suffix = slugify(indexOrName);
  return `${safeType}_${suffix}`;
}

export function getControlMatrixItem(key) {
  return CONTROL_MATRIX.find((item) => item.key === key) || null;
}

export function getUnitTypeDefinition(unitType) {
  return UNIT_TYPE_DEFINITIONS[unitType] || null;
}

export function getAreaTypeDefinition(areaType) {
  return AREA_TYPE_DEFINITIONS[areaType] || null;
}

export function getProcessTypeDefinition(processType) {
  return PROCESS_TYPE_DEFINITIONS[processType] || null;
}

export function buildUnitTitle(unitType, index = 1, customTitle = "") {
  const explicitTitle = sanitizeString(customTitle, 120);
  if (explicitTitle) return explicitTitle;

  const def = getUnitTypeDefinition(unitType);
  if (!def) return `Enhed ${index}`;

  // Walk-in og lignende giver ofte mening uden tal hvis der kun er én
  if (unitType === "walkin_fridge") return "Walk-in køler";
  if (unitType === "walkin_freezer") return "Walk-in fryser";

  return `${def.title} ${index}`;
}

export function buildAreaTitle(areaType, customTitle = "") {
  const explicitTitle = sanitizeString(customTitle, 120);
  if (explicitTitle) return explicitTitle;

  const def = getAreaTypeDefinition(areaType);
  if (!def) return "Område";

  return def.title;
}

export function buildProcessTitle(processType) {
  const def = getProcessTypeDefinition(processType);
  return def?.title || "Proces";
}

export function buildTemplateTitle({
  controlFamily,
  relationType,
  controlTarget,
  unitTitle = "",
  areaTitle = "",
  processType = "",
}) {
  const familyDef = CONTROL_FAMILIES[controlFamily];
  const familyTitle = familyDef?.title || "Kontrol";

  if (relationType === "unit") {
    const unitDef = getUnitTypeDefinition(controlTarget);
    const targetTitle = unitDef?.title || "Enhed";
    const safeUnitTitle = sanitizeString(unitTitle, 120);
    return safeUnitTitle
      ? `${familyTitle} – ${targetTitle} – ${safeUnitTitle}`
      : `${familyTitle} – ${targetTitle}`;
  }

  if (relationType === "area") {
    const areaDef = getAreaTypeDefinition(controlTarget);
    const targetTitle = sanitizeString(areaTitle, 120) || areaDef?.title || "Område";
    return `${familyTitle} – ${targetTitle}`;
  }

  if (relationType === "process") {
    const processTitle = buildProcessTitle(processType || controlTarget);
    return `${familyTitle} – Proces – ${processTitle}`;
  }

  return familyTitle;
}

export function buildTaskTemplateDoc({
  companyId,
  locationId,
  matrixKey,
  unit = null,
  area = null,
  processType = "",
  sortOrder = 100,
}) {
  const matrix = getControlMatrixItem(matrixKey);
  if (!matrix) {
    throw new Error(`Ukendt CONTROL_MATRIX key: ${matrixKey}`);
  }

  const relationType = matrix.relationType;
  const controlFamily = matrix.controlFamily;
  const controlTarget = matrix.controlTarget;
  const controlLevel = matrix.controlLevel;

  let unitId = null;
  let unitTitle = "";
  let areaId = null;
  let areaTitle = "";
  let resolvedProcessType = "";

  if (relationType === "unit") {
    if (!unit?.unitId) {
      throw new Error(`matrixKey ${matrixKey} kræver unit.unitId`);
    }
    unitId = sanitizeString(unit.unitId, 120);
    unitTitle = sanitizeString(unit.title || "", 120);
  }

  if (relationType === "area") {
    if (!area?.areaId) {
      throw new Error(`matrixKey ${matrixKey} kræver area.areaId`);
    }
    areaId = sanitizeString(area.areaId, 120);
    areaTitle = sanitizeString(area.title || "", 120);
  }

  if (relationType === "process") {
    resolvedProcessType = sanitizeString(processType || controlTarget, 80);
    if (!resolvedProcessType) {
      throw new Error(`matrixKey ${matrixKey} kræver processType`);
    }
  }

  const title = buildTemplateTitle({
    controlFamily,
    relationType,
    controlTarget,
    unitTitle,
    areaTitle,
    processType: resolvedProcessType,
  });

  const templateKeyParts = [
    controlFamily,
    controlTarget,
    relationType,
    unitId || areaId || resolvedProcessType || "base",
  ];

  const templateId = templateKeyParts.map((part) => slugify(part)).join("__");

  return {
    templateId,
    doc: {
      companyId: sanitizeString(companyId, 120),
      locationId: sanitizeString(locationId, 120),

      module: "egenkontrol",

      matrixKey,
      controlFamily,
      controlTarget,
      relationType,
      controlLevel,

      unitId,
      areaId,
      processType: resolvedProcessType || null,

      title,
      titleBase: matrix.titleBase,

      evidenceMode: matrix.evidenceMode || "photo",
      requiredPhotoSlots: Array.isArray(matrix.requiredPhotoSlots)
        ? [...matrix.requiredPhotoSlots]
        : [],
      aiChecks: Array.isArray(matrix.aiChecks) ? [...matrix.aiChecks] : [],

      isActive: true,
      sortOrder: Number(sortOrder) || 100,

      createdAt: null,
      updatedAt: null,
    },
  };
}

export function buildTaskInstanceId(templateId, dateKey) {
  return `${templateId}__${dateKey}`;
}

export function buildTaskInstanceDoc({
  taskTemplateId,
  templateDoc,
  dateKey,
}) {
  if (!taskTemplateId) {
    throw new Error("taskTemplateId mangler");
  }
  if (!templateDoc) {
    throw new Error("templateDoc mangler");
  }
  if (!dateKey) {
    throw new Error("dateKey mangler");
  }

  const taskInstanceId = buildTaskInstanceId(taskTemplateId, dateKey);

  return {
    taskInstanceId,
    doc: {
      taskTemplateId,
      companyId: templateDoc.companyId || "",
      locationId: templateDoc.locationId || "",

      module: templateDoc.module || "egenkontrol",
      dateKey: sanitizeString(dateKey, 20),

      matrixKey: templateDoc.matrixKey || "",
      controlFamily: templateDoc.controlFamily || "",
      controlTarget: templateDoc.controlTarget || "",
      relationType: templateDoc.relationType || "",
      controlLevel: templateDoc.controlLevel || "",

      unitId: templateDoc.unitId || null,
      areaId: templateDoc.areaId || null,
      processType: templateDoc.processType || null,

      title: templateDoc.title || "",
      titleBase: templateDoc.titleBase || "",

      evidenceMode: templateDoc.evidenceMode || "photo",
      requiredPhotoSlots: Array.isArray(templateDoc.requiredPhotoSlots)
        ? [...templateDoc.requiredPhotoSlots]
        : [],
      aiChecks: Array.isArray(templateDoc.aiChecks) ? [...templateDoc.aiChecks] : [],

      status: "pending",
      createdAt: null,
      updatedAt: null,
    },
  };
}

/**
 * Onboarding output skal være enkel og menneskelig i UI,
 * men mappe direkte til stabile interne keys.
 */
export function buildOnboardingUnitRecords(onboardingInput = {}) {
  const records = [];

  const fridgeCount = Math.max(0, Number(onboardingInput.fridgeCount) || 0);
  const freezerCount = Math.max(0, Number(onboardingInput.freezerCount) || 0);
  const walkinFridgeCount = Math.max(0, Number(onboardingInput.walkinFridgeCount) || 0);
  const walkinFreezerCount = Math.max(0, Number(onboardingInput.walkinFreezerCount) || 0);
  const softiceMachineCount = Math.max(0, Number(onboardingInput.softiceMachineCount) || 0);
  const fryerCount = Math.max(0, Number(onboardingInput.fryerCount) || 0);
  const bainMarieCount = Math.max(0, Number(onboardingInput.bainMarieCount) || 0);
  const warmingCabinetCount = Math.max(0, Number(onboardingInput.warmingCabinetCount) || 0);
  const coolingFanCount = Math.max(0, Number(onboardingInput.coolingFanCount) || 0);

  function pushUnits(unitType, count) {
    for (let i = 1; i <= count; i += 1) {
      const title = buildUnitTitle(unitType, i);
      records.push({
        unitId: buildUnitId(unitType, title),
        unitType,
        title,
        isActive: true,
      });
    }
  }

  pushUnits("fridge", fridgeCount);
  pushUnits("freezer", freezerCount);
  pushUnits("walkin_fridge", walkinFridgeCount);
  pushUnits("walkin_freezer", walkinFreezerCount);
  pushUnits("softice_machine", softiceMachineCount);
  pushUnits("fryer", fryerCount);
  pushUnits("bain_marie", bainMarieCount);
  pushUnits("warming_cabinet", warmingCabinetCount);
  pushUnits("cooling_fan", coolingFanCount);

  return records;
}

export function buildOnboardingAreaRecords(onboardingInput = {}) {
  const records = [];

  const enabledAreas = [
    { enabled: !!onboardingInput.hasKitchenArea, areaType: "kitchen" },
    { enabled: !!onboardingInput.hasVegetableRoom, areaType: "vegetable_room" },
    { enabled: !!onboardingInput.hasColdRoomArea, areaType: "cold_room_area" },
    { enabled: !!onboardingInput.hasFreezerRoomArea, areaType: "freezer_room_area" },
    { enabled: !!onboardingInput.hasDishwashArea, areaType: "dishwash_area" },
    { enabled: !!onboardingInput.hasStorageArea, areaType: "storage_area" },
    { enabled: !!onboardingInput.hasFloorDrainArea, areaType: "floor_drain_area" },
  ];

  enabledAreas.forEach((item) => {
    if (!item.enabled) return;
    const title = buildAreaTitle(item.areaType);
    records.push({
      areaId: slugify(item.areaType),
      areaType: item.areaType,
      title,
      isActive: true,
    });
  });

  return records;
}

export function buildOnboardingProcessRecords(onboardingInput = {}) {
  return [
    {
      processType: "heating",
      title: "Opvarmning",
      isActive: !!onboardingInput.hasHeatingProcess,
    },
    {
      processType: "cooling",
      title: "Nedkøling",
      isActive: !!onboardingInput.hasCoolingProcess,
    },
    {
      processType: "hot_holding",
      title: "Varmholdelse",
      isActive: !!onboardingInput.hasHotHoldingProcess,
    },
  ].filter((item) => item.isActive);
}

/**
 * Bygger alle templates ud fra onboarding records.
 * Denne funktion er vigtig, fordi onboarding og generator skal følge samme regler.
 */
export function buildTemplatesFromOnboarding({
  companyId,
  locationId,
  units = [],
  areas = [],
  processes = [],
}) {
  const templates = [];

  for (const unit of units) {
    const matchingMatrixItems = CONTROL_MATRIX.filter(
      (item) => item.relationType === "unit" && item.controlTarget === unit.unitType
    );

    for (const matrix of matchingMatrixItems) {
      templates.push(
        buildTaskTemplateDoc({
          companyId,
          locationId,
          matrixKey: matrix.key,
          unit,
        })
      );
    }
  }

  for (const area of areas) {
    const matchingMatrixItems = CONTROL_MATRIX.filter(
      (item) => item.relationType === "area" && item.controlTarget === area.areaType
    );

    for (const matrix of matchingMatrixItems) {
      templates.push(
        buildTaskTemplateDoc({
          companyId,
          locationId,
          matrixKey: matrix.key,
          area,
        })
      );
    }
  }

  for (const process of processes) {
    const matchingMatrixItems = CONTROL_MATRIX.filter(
      (item) =>
        item.relationType === "process" &&
        item.controlTarget === process.processType
    );

    for (const matrix of matchingMatrixItems) {
      templates.push(
        buildTaskTemplateDoc({
          companyId,
          locationId,
          matrixKey: matrix.key,
          processType: process.processType,
        })
      );
    }
  }

  return templates;
}

export function sortTemplatesByPriority(templates = []) {
  return [...templates].sort((a, b) => {
    const aLevel = CONTROL_LEVELS[a?.doc?.controlLevel]?.priority || 0;
    const bLevel = CONTROL_LEVELS[b?.doc?.controlLevel]?.priority || 0;
    if (bLevel !== aLevel) return bLevel - aLevel;

    const aTitle = String(a?.doc?.title || "").toLowerCase();
    const bTitle = String(b?.doc?.title || "").toLowerCase();
    return aTitle.localeCompare(bTitle, "da");
  });
}

/**
 * Hjælper til UI:
 * Brug title-felter i UI. Brug aldrig controlFamily/controlTarget direkte som visning.
 */
export function getDisplayTitle(record = {}) {
  return sanitizeString(record.title || "", 200);
}

/* TIL HER */