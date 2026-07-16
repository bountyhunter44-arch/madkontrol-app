/**
 * SETUP TO CANONICAL ROUTINES MAPPER
 * 
 * Maps quick onboarding setup (industry + equipment/processes)
 * to canonical routine keys and equipment units.
 * 
 * Supports both:
 * - New format: setup.equipment + setup.activities
 * - Old format: flat fields (backward compatible)
 */

/**
 * Normalize quick onboarding setup
 * Handles both new nested format and old flat format
 */
function normalizeQuickOnboardingSetup(input) {
  const industry = String(input.industry || "restaurant").toLowerCase();
  
  // Check if questions format (new intelligent onboarding)
  const questions = input.questions || {};
  const hasQuestions = Object.keys(questions).length > 0;
  
  // Check if new format (equipment + activities objects)
  const hasNewFormat = input.equipment || input.activities;
  
  if (hasQuestions) {
    // Questions format: map questions to activities
    return {
      industry,
      
      // Equipment counts (from flat fields)
      fridgeCount: parseInt(input.fridgeCount || 0, 10),
      freezerCount: parseInt(input.freezerCount || 0, 10),
      walkinCoolerCount: parseInt(input.walkinCoolerCount || 0, 10),
      walkinFreezerCount: parseInt(input.walkinFreezerCount || 0, 10),
      refrigeratedDisplayCount: parseInt(input.refrigeratedDisplayCount || 0, 10),
      ovenCount: parseInt(input.ovenCount || 0, 10),
      stoveCount: parseInt(input.stoveCount || 0, 10),
      blastChillerCount: parseInt(input.blastChillerCount || 0, 10),
      hotCabinetCount: parseInt(input.hotCabinetCount || 0, 10),
      proofingCabinetCount: parseInt(input.proofingCabinetCount || 0, 10),
      smokeOvenCount: parseInt(input.smokeOvenCount || 0, 10),
      slicerCount: parseInt(input.slicerCount || 0, 10),
      dishwasherCount: parseInt(input.dishwasherCount || 0, 10),
      fryerCount: parseInt(input.fryerCount || 0, 10),
      softiceMachineCount: parseInt(input.softiceMachineCount || 0, 10),
      
      // Map questions to activities
      hasReceiving: questions.receivesFood === true,
      hasCooling: questions.coolsFood === true,
      hasHeating: questions.heatsFood === true,
      hasHotHolding: questions.hotHolding === true,
      hasThreeHourRule: questions.threeHourRule === true,
      hasSeparation: questions.storesRawAndReady === true,
      hasStorage: questions.storesRawAndReady === true,
      hasAllergens: questions.handlesAllergens === true,
      hasTransport: questions.transportsFood === true,
      hasTraceability: questions.needsTraceability === true,
      hasRecall: questions.needsRecall === true,
      hasAnnualRevision: questions.needsAnnualRevision === true,
      
      // Cleaning plan controls all cleaning routines
      hasCleaningPlan: questions.hasCleaningPlan === true,
      hasFridgeCleaning: questions.hasCleaningPlan === true,
      hasFreezerCleaning: questions.hasCleaningPlan === true,
      hasKitchenCleaning: questions.hasCleaningPlan === true,
      hasSlicerCleaning: questions.hasCleaningPlan === true,
      hasDishwasherCleaning: questions.hasCleaningPlan === true,
      hasFryerCleaning: questions.hasCleaningPlan === true,
      hasEquipmentMaintenance: questions.hasCleaningPlan === true,
      hasSmokeOvenCleaning: questions.hasCleaningPlan === true,
      hasProofingCabinetCleaning: questions.hasCleaningPlan === true,
      hasColdDisplayCleaning: questions.hasCleaningPlan === true
    };
  } else if (hasNewFormat) {
    // New format: extract from equipment and activities
    const equipment = input.equipment || {};
    const activities = input.activities || {};
    
    return {
      industry,
      
      // Equipment counts
      fridgeCount: parseInt(equipment.fridgeCount || 0, 10),
      freezerCount: parseInt(equipment.freezerCount || 0, 10),
      walkinCoolerCount: parseInt(equipment.walkinCoolerCount || 0, 10),
      walkinFreezerCount: parseInt(equipment.walkinFreezerCount || 0, 10),
      refrigeratedDisplayCount: parseInt(equipment.refrigeratedDisplayCount || 0, 10),
      ovenCount: parseInt(equipment.ovenCount || 0, 10),
      stoveCount: parseInt(equipment.stoveCount || 0, 10),
      blastChillerCount: parseInt(equipment.blastChillerCount || 0, 10),
      hotCabinetCount: parseInt(equipment.hotCabinetCount || 0, 10),
      proofingCabinetCount: parseInt(equipment.proofingCabinetCount || 0, 10),
      smokeOvenCount: parseInt(equipment.smokeOvenCount || 0, 10),
      slicerCount: parseInt(equipment.slicerCount || 0, 10),
      dishwasherCount: parseInt(equipment.dishwasherCount || 0, 10),
      fryerCount: parseInt(equipment.fryerCount || 0, 10),
      softiceMachineCount: parseInt(equipment.softiceMachineCount || 0, 10),
      
      // Activities (check if enabled)
      hasReceiving: activities.hasReceiving?.enabled || false,
      hasCooling: activities.hasCooling?.enabled || false,
      hasHeating: activities.hasHeating?.enabled || false,
      hasHotHolding: activities.hasHotHolding?.enabled || false,
      hasThreeHourRule: activities.hasThreeHourRule?.enabled || false,
      hasSeparation: activities.hasSeparation?.enabled || false,
      hasStorage: activities.hasStorage?.enabled || false,
      hasAllergens: activities.hasAllergens?.enabled || false,
      hasFridgeCleaning: activities.hasFridgeCleaning?.enabled || false,
      hasFreezerCleaning: activities.hasFreezerCleaning?.enabled || false,
      hasKitchenCleaning: activities.hasKitchenCleaning?.enabled || false,
      hasSlicerCleaning: activities.hasSlicerCleaning?.enabled || false,
      hasDishwasherCleaning: activities.hasDishwasherCleaning?.enabled || false,
      hasFryerCleaning: activities.hasFryerCleaning?.enabled || false,
      hasEquipmentMaintenance: activities.hasEquipmentMaintenance?.enabled || false,
      hasSmokeOvenCleaning: activities.hasSmokeOvenCleaning?.enabled || false,
      hasProofingCabinetCleaning: activities.hasProofingCabinetCleaning?.enabled || false,
      hasColdDisplayCleaning: activities.hasColdDisplayCleaning?.enabled || false,
      hasTraceability: activities.hasTraceability?.enabled || false,
      hasRecall: activities.hasRecall?.enabled || false,
      hasAnnualRevision: activities.hasAnnualRevision?.enabled || false
    };
  } else {
    // Old format: flat fields (backward compatible)
    return {
      industry,
      fridgeCount: parseInt(input.fridgeCount || 0, 10),
      freezerCount: parseInt(input.freezerCount || 0, 10),
      walkinCoolerCount: parseInt(input.walkinCoolerCount || 0, 10),
      walkinFreezerCount: parseInt(input.walkinFreezerCount || 0, 10),
      refrigeratedDisplayCount: parseInt(input.refrigeratedDisplayCount || 0, 10),
      ovenCount: parseInt(input.ovenCount || 0, 10),
      stoveCount: parseInt(input.stoveCount || 0, 10),
      blastChillerCount: parseInt(input.blastChillerCount || 0, 10),
      hotCabinetCount: parseInt(input.hotCabinetCount || 0, 10),
      proofingCabinetCount: parseInt(input.proofingCabinetCount || 0, 10),
      smokeOvenCount: parseInt(input.smokeOvenCount || 0, 10),
      slicerCount: parseInt(input.slicerCount || 0, 10),
      dishwasherCount: parseInt(input.dishwasherCount || 0, 10),
      fryerCount: parseInt(input.fryerCount || 0, 10),
      softiceMachineCount: parseInt(input.softiceMachineCount || 0, 10),
      hasReceiving: input.hasReceiving || false,
      hasCooling: input.hasCooling || false,
      hasHeating: input.hasHeating || false,
      hasHotHolding: input.hasHotHolding || false,
      hasThreeHourRule: input.hasThreeHourRule || false,
      hasSeparation: input.hasSeparation || false,
      hasStorage: input.hasStorage || false,
      hasAllergens: input.hasAllergens || false,
      hasFridgeCleaning: input.hasFridgeCleaning || false,
      hasFreezerCleaning: input.hasFreezerCleaning || false,
      hasKitchenCleaning: input.hasKitchenCleaning || false,
      hasSlicerCleaning: input.hasSlicerCleaning || false,
      hasDishwasherCleaning: input.hasDishwasherCleaning || false,
      hasFryerCleaning: input.hasFryerCleaning || false,
      hasEquipmentMaintenance: input.hasEquipmentMaintenance || false,
      hasSmokeOvenCleaning: input.hasSmokeOvenCleaning || false,
      hasProofingCabinetCleaning: input.hasProofingCabinetCleaning || false,
      hasColdDisplayCleaning: input.hasColdDisplayCleaning || false,
      hasTraceability: input.hasTraceability || false,
      hasRecall: input.hasRecall || false,
      hasAnnualRevision: input.hasAnnualRevision || false
    };
  }
}

/**
 * Resolve canonical routine keys from setup
 * Returns ONLY selected routines (strict mode)
 */
function resolveCanonicalRoutineKeysFromSetup(setup) {
  const routines = [];
  
  // EQUIPMENT-BASED ROUTINES
  
  // Fridges
  if (setup.fridgeCount > 0) {
    routines.push("koeleskab_temperatur");
    if (setup.hasFridgeCleaning) {
      routines.push("koeleskab_rengoering");
    }
  }
  
  // Freezers
  if (setup.freezerCount > 0) {
    routines.push("fryser_temperatur");
    if (setup.hasFreezerCleaning) {
      routines.push("fryser_rengoering");
    }
  }
  
  // Walk-in coolers
  if (setup.walkinCoolerCount > 0) {
    routines.push("walkin_koeler_temperatur");
    if (setup.hasFridgeCleaning) {
      routines.push("walkin_koeler_rengoering");
    }
  }
  
  // Walk-in freezers
  if (setup.walkinFreezerCount > 0) {
    routines.push("walkin_fryser_temperatur");
    if (setup.hasFreezerCleaning) {
      routines.push("walkin_fryser_rengoering");
    }
  }
  
  // Refrigerated display
  if (setup.refrigeratedDisplayCount > 0) {
    routines.push("koledisk_temperatur");
    if (setup.hasColdDisplayCleaning) {
      routines.push("koledisk_rengoering");
    }
  }
  
  // Dishwasher
  if (setup.dishwasherCount > 0) {
    routines.push("opvaskemaskine_skyllevand");
    if (setup.hasDishwasherCleaning) {
      routines.push("opvaskemaskine_rengoering");
    }
  }
  
  // Fryer
  if (setup.fryerCount > 0 && setup.hasFryerCleaning) {
    routines.push("friture_rengoering");
  }
  
  // Slicer
  if (setup.slicerCount > 0 && setup.hasSlicerCleaning) {
    routines.push("paalaegsmaskine_rengoering");
  }
  
  // Oven
  if (setup.ovenCount > 0) {
    routines.push("ovn_rengoering");
  }
  
  // Stove
  if (setup.stoveCount > 0) {
    routines.push("komfur_rengoering");
  }
  
  // Blast chiller
  if (setup.blastChillerCount > 0) {
    routines.push("blaesekoeler_temperatur");
    routines.push("blaesekoeler_rengoering");
    if (setup.hasCooling) {
      routines.push("nedkoeling");
    }
  }
  
  // Hot cabinet
  if (setup.hotCabinetCount > 0) {
    routines.push("varmeskab_temperatur");
    routines.push("varmeskab_rengoering");
    if (setup.hasHotHolding) {
      routines.push("varmholdelse");
    }
  }
  
  // Proofing cabinet
  if (setup.proofingCabinetCount > 0 && setup.hasProofingCabinetCleaning) {
    routines.push("rasteskab_rengoering");
  }
  
  // Smoke oven
  if (setup.smokeOvenCount > 0) {
    routines.push("roegeovn_temperatur");
    if (setup.hasSmokeOvenCleaning) {
      routines.push("roegeovn_rengoering");
    }
  }
  
  // Softice machine
  if (setup.softiceMachineCount > 0) {
    routines.push("softice_temperatur_kontrol");
    routines.push("softice_maskine_rengoering");
  }
  
  // ACTIVITY-BASED ROUTINES
  
  if (setup.hasReceiving) {
    routines.push("varemodtagelse");
  }
  
  if (setup.hasCooling) {
    routines.push("nedkoeling");
  }
  
  if (setup.hasHeating) {
    routines.push("opvarmning");
  }
  
  if (setup.hasHotHolding) {
    routines.push("varmholdelse");
  }
  
  if (setup.hasThreeHourRule) {
    routines.push("tre_timers_regel");
  }
  
  if (setup.hasSeparation) {
    routines.push("adskillelse");
  }
  
  if (setup.hasStorage) {
    routines.push("opbevaring");
  }
  
  if (setup.hasAllergens) {
    routines.push("allergener");
  }
  
  if (setup.hasTransport) {
    routines.push("transport");
  }
  
  if (setup.hasKitchenCleaning) {
    routines.push("koekken_rengoering");
  }
  
  if (setup.hasEquipmentMaintenance) {
    routines.push("udstyr_vedligeholdelse");
  }
  
  if (setup.hasTraceability) {
    routines.push("sporbarhed");
  }
  
  if (setup.hasRecall) {
    routines.push("tilbagetraekning");
  }
  
  if (setup.hasAnnualRevision) {
    routines.push("aarlig_revision");
  }
  
  return routines;
}

function toSafeIdSegment(value, fallback = "item") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

function toPositiveInt(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.floor(number));
}

function buildEquipmentSeedKey({ companyId, locationId, type, index }) {
  return [
    toSafeIdSegment(companyId, "company"),
    toSafeIdSegment(locationId, "location"),
    toSafeIdSegment(type, "equipment"),
    toPositiveInt(index) || 1
  ].join("__");
}

function buildEquipmentDocumentId(seedKey) {
  return `onboarding__${String(seedKey || "").slice(0, 170)}`;
}

function getEquipmentDefaults(type) {
  const temperatureTypes = new Set([
    "fridge",
    "freezer",
    "walk_in_cooler",
    "walk_in_freezer",
    "display_fridge",
    "blast_chiller",
    "warming_cabinet",
    "softice_machine"
  ]);
  const limits = {
    fridge: { minTemp: 0, maxTemp: 5 },
    freezer: { minTemp: -30, maxTemp: -18 },
    walk_in_cooler: { minTemp: 0, maxTemp: 5 },
    walk_in_freezer: { minTemp: -30, maxTemp: -18 },
    display_fridge: { minTemp: 0, maxTemp: 5 },
    blast_chiller: { minTemp: 0, maxTemp: 5 },
    warming_cabinet: { minTemp: 65, maxTemp: null },
    softice_machine: { minTemp: 0, maxTemp: 5 }
  };
  const temperatureRequired = temperatureTypes.has(type);

  return {
    haccpRelevant: true,
    routineRelevant: true,
    temperatureRequired,
    minTemp: limits[type]?.minTemp ?? null,
    maxTemp: limits[type]?.maxTemp ?? null,
    cleaningRequired: true,
    cleaningFrequency: ["freezer", "walk_in_freezer"].includes(type) ? "monthly" : "weekly",
    serviceRequired: true,
    serviceFrequency: "yearly",
    calibrationRequired: temperatureRequired,
    calibrationFrequency: temperatureRequired ? "yearly" : ""
  };
}

/**
 * Build equipment units from setup
 * Creates ALL equipment types
 */
function buildEquipmentFromSetup(setup, { companyId, locationId, userId, onboardingDraftId = "" }) {
  const equipment = [];
  const nowTs = new Date();
  
  // Helper to create equipment
  const createEquipment = (type, name, index = 1) => {
    const unitNumber = toPositiveInt(index) || 1;
    const displayName = `${name} ${unitNumber}`;
    const seedKey = buildEquipmentSeedKey({ companyId, locationId, type, index: unitNumber });
    const equipmentId = buildEquipmentDocumentId(seedKey);

    return {
      id: equipmentId,
      equipmentId,
      seedKey,
      name: displayName,
      displayName,
      title: displayName,
      type,
      equipmentType: type,
      category: type,
      companyId,
      locationId,
      organizationId: companyId,
      active: true,
      isActive: true,
      unitNumber,
      ...getEquipmentDefaults(type),
      source: "onboarding",
      onboardingSource: "quick_onboarding",
      onboardingDraftId: String(onboardingDraftId || ""),
      createdBy: userId,
      createdByUid: userId,
      createdAt: nowTs,
      updatedAt: nowTs
    };
  };
  
  // Fridges
  for (let i = 1; i <= setup.fridgeCount; i++) {
    equipment.push(createEquipment("fridge", "Køleskab", i));
  }
  
  // Freezers
  for (let i = 1; i <= setup.freezerCount; i++) {
    equipment.push(createEquipment("freezer", "Fryser", i));
  }
  
  // Walk-in coolers
  for (let i = 1; i <= setup.walkinCoolerCount; i++) {
    equipment.push(createEquipment("walk_in_cooler", "Walk-in køler", i));
  }
  
  // Walk-in freezers
  for (let i = 1; i <= setup.walkinFreezerCount; i++) {
    equipment.push(createEquipment("walk_in_freezer", "Walk-in fryser", i));
  }
  
  // Refrigerated displays
  for (let i = 1; i <= setup.refrigeratedDisplayCount; i++) {
    equipment.push(createEquipment("display_fridge", "Køledisk", i));
  }
  
  // Ovens
  for (let i = 1; i <= setup.ovenCount; i++) {
    equipment.push(createEquipment("oven", "Ovn", i));
  }
  
  // Stoves
  for (let i = 1; i <= setup.stoveCount; i++) {
    equipment.push(createEquipment("stove", "Komfur", i));
  }
  
  // Blast chillers
  for (let i = 1; i <= setup.blastChillerCount; i++) {
    equipment.push(createEquipment("blast_chiller", "Blæsekøler", i));
  }
  
  // Hot cabinets
  for (let i = 1; i <= setup.hotCabinetCount; i++) {
    equipment.push(createEquipment("warming_cabinet", "Varmeskab", i));
  }
  
  // Proofing cabinets
  for (let i = 1; i <= setup.proofingCabinetCount; i++) {
    equipment.push(createEquipment("proofing_cabinet", "Rasteskab", i));
  }
  
  // Smoke ovens
  for (let i = 1; i <= setup.smokeOvenCount; i++) {
    equipment.push(createEquipment("smoke_oven", "Røgeovn", i));
  }
  
  // Slicers
  for (let i = 1; i <= setup.slicerCount; i++) {
    equipment.push(createEquipment("slicer", "Pålægsmaskine", i));
  }
  
  // Dishwashers
  for (let i = 1; i <= setup.dishwasherCount; i++) {
    equipment.push(createEquipment("dishwasher", "Opvaskemaskine", i));
  }
  
  // Fryers
  for (let i = 1; i <= setup.fryerCount; i++) {
    equipment.push(createEquipment("fryer", "Friture", i));
  }
  
  // Softice machines
  for (let i = 1; i <= setup.softiceMachineCount; i++) {
    equipment.push(createEquipment("softice_machine", "Softice-maskine", i));
  }
  
  return equipment;
}

module.exports = {
  normalizeQuickOnboardingSetup,
  resolveCanonicalRoutineKeysFromSetup,
  buildEquipmentFromSetup
};
