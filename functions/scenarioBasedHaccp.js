/**
 * Scenario-Based HACCP Risk Analysis Engine v3.0
 * Generates comprehensive HACCP analysis based on specific operational scenarios
 * 
 * @typedef {"low" | "medium" | "high" | "critical"} RiskLevel
 * @typedef {"biological" | "chemical" | "physical" | "allergen"} HazardType
 * @typedef {"CCP" | "CP"} ControlPointType
 * @typedef {"temperature" | "receiving" | "checklist" | "hygiene" | "cleaning"} FormType
 * @typedef {"daily" | "weekly" | "monthly" | "quarterly" | "yearly"} FrequencyType
 */

const { MIKROBIOLOGISKE_FARER_CCP, MIKROBIOLOGISKE_FARER_GAG } = require('./egenkontrol/risikoanalyseData');

/**
 * Main scenario-based HACCP generator
 * Returns RiskAnalysis schema with processes, hazards, and task templates
 * @param {object} params - Parameters
 * @param {object} params.profile - Onboarding profile
 * @param {string} params.companyType - Company type
 * @returns {object} RiskAnalysis object with processes, hazards, and task templates
 */
function generateScenarioBasedHaccp({ profile = {}, companyType = "" }) {
  // Generate processes from profile
  const processes = generateProcessesFromProfile(profile);
  
  // Generate hazards from CCP and GAG definitions
  const hazards = generateHazardsFromRisikoanalyse(profile);
  
  // Generate verification tasks from hazards
  const verificationTasks = buildVerificationTasks(hazards, profile);
  
  // Generate documentation requirements
  const documentationRequirements = buildDocumentationRequirements(hazards, verificationTasks);
  
  // Build risk analysis object for task template generation
  const riskAnalysis = {
    processes: processes,
    hazards: hazards,
    verificationTasks: verificationTasks
  };
  
  // Generate task templates from risk analysis
  const taskTemplates = buildTaskTemplatesFromRiskAnalysis(riskAnalysis);
  
  // Count CCPs and CPs
  const totalCCPs = hazards.filter(h => h.isCCP).length;
  const totalCPs = hazards.filter(h => !h.isCCP).length;
  
  // Build scenarios from active process areas
  const scenarios = [];
  const processAreas = [...new Set(processes.map(p => p.area))];
  
  processAreas.forEach(area => {
    const areaProcesses = processes.filter(p => p.area === area);
    const areaHazards = hazards.filter(h => areaProcesses.some(p => p.key === h.processKey));
    const areaCCPs = areaHazards.filter(h => h.isCCP);
    
    scenarios.push({
      id: `scenario_${area}`,
      area: area,
      title: `${area.charAt(0).toUpperCase() + area.slice(1)} - HACCP kontrol`,
      description: `Fødevaresikkerhedskontrol for ${area}`,
      processKeys: areaProcesses.map(p => p.key),
      hazardIds: areaHazards.map(h => h.id),
      ccpCount: areaCCPs.length,
      cpCount: areaHazards.length - areaCCPs.length
    });
  });
  
  return {
    version: "3.0_scenario_based",
    companyType: companyType || profile.companyType || "",
    scenarios: scenarios,
    processes: processes,
    hazards: hazards,
    controlMeasures: [],
    criticalLimits: [],
    monitoringProcedures: [],
    correctiveActions: [],
    verificationTasks: verificationTasks,
    documentationRequirements: documentationRequirements,
    taskTemplates: taskTemplates,
    kcps: [], // Backward compatibility
    generatedAt: new Date().toISOString(),
    summary: {
      totalScenarios: scenarios.length,
      totalProcesses: processes.length,
      totalHazards: hazards.length,
      totalControlMeasures: 0,
      totalCCPs: totalCCPs,
      totalCPs: totalCPs,
      totalVerificationTasks: verificationTasks.length,
      totalDocumentationRequirements: documentationRequirements.length,
      totalTaskTemplates: taskTemplates.length,
      totalKcps: 0
    }
  };
}

/**
 * Generate processes from profile
 * Maps onboarding fields to process definitions
 * @returns {ProcessDefinition[]} Array of process definitions
 */
function generateProcessesFromProfile(profile) {
  const processes = [];
  
  // Receiving processes - check both English and Danish field names
  if (profile.receivesChilledGoods || profile.modtagerKoelevarer || profile.antalKoeleskabe > 0) {
    processes.push({
      key: "receiving_chilled_goods",
      title: "Modtagelse af kølevarer",
      description: "Kontrol af temperatur, emballage og kvalitet ved modtagelse af kølevarer",
      area: "modtagelse",
      enabled: true,
      sourceFields: ["receivesChilledGoods", "modtagerKoelevarer", "receivesChilledGoodsDetails"],
      scenarioTags: ["receiving", "temperature_control", "chilled"],
      defaultCategory: "modtagelse"
    });
  }
  
  if (profile.receivesFrozenGoods || profile.modtagerFrostvarer || profile.antalFrysere > 0) {
    processes.push({
      key: "receiving_frozen_goods",
      title: "Modtagelse af frostvarer",
      description: "Kontrol af temperatur, emballage og kvalitet ved modtagelse af frostvarer",
      area: "modtagelse",
      enabled: true,
      sourceFields: ["receivesFrozenGoods", "modtagerFrostvarer", "receivesFrozenGoodsDetails"],
      scenarioTags: ["receiving", "temperature_control", "frozen"],
      defaultCategory: "modtagelse"
    });
  }
  
  if (profile.receivesRoomTempGoods) {
    processes.push({
      key: "receiving_room_temp_goods",
      title: "Modtagelse af stuetemperatur-varer",
      description: "Kontrol af emballage, datomærkning og kvalitet ved modtagelse af tørvarer",
      area: "modtagelse",
      enabled: true,
      sourceFields: ["receivesRoomTempGoods", "receivesRoomTempGoodsDetails"],
      scenarioTags: ["receiving", "dry_goods"],
      defaultCategory: "modtagelse"
    });
  }
  
  // Storage processes - check both English and Danish field names
  if (profile.storesChilledGoods || profile.modtagerKoelevarer || profile.antalKoeleskabe > 0) {
    processes.push({
      key: "storage_chilled",
      title: "Opbevaring af kølevarer",
      description: "Temperaturkontrol og korrekt opbevaring af kølevarer",
      area: "opbevaring",
      enabled: true,
      sourceFields: ["storesChilledGoods", "modtagerKoelevarer", "storesChilledGoodsDetails", "fridgeCount", "antalKoeleskabe", "hasWalkInCooler"],
      scenarioTags: ["storage", "temperature_control", "chilled"],
      defaultCategory: "opbevaring"
    });
  }
  
  if (profile.storesFrozenGoods || profile.modtagerFrostvarer || profile.antalFrysere > 0) {
    processes.push({
      key: "storage_frozen",
      title: "Opbevaring af frostvarer",
      description: "Temperaturkontrol og korrekt opbevaring af frostvarer",
      area: "opbevaring",
      enabled: true,
      sourceFields: ["storesFrozenGoods", "modtagerFrostvarer", "storesFrozenGoodsDetails", "freezerCount", "antalFrysere", "hasWalkInFreezer"],
      scenarioTags: ["storage", "temperature_control", "frozen"],
      defaultCategory: "opbevaring"
    });
  }
  
  if (profile.storesRoomTempGoods) {
    processes.push({
      key: "storage_dry",
      title: "Opbevaring af tørvarer",
      description: "Korrekt opbevaring af tørvarer og stuetemperatur-produkter",
      area: "opbevaring",
      enabled: true,
      sourceFields: ["storesRoomTempGoods", "storesRoomTempGoodsDetails"],
      scenarioTags: ["storage", "dry_goods"],
      defaultCategory: "opbevaring"
    });
  }
  
  // Preparation processes - check both English and Danish field names
  if (profile.preparesHotFood || profile.tilberederVarmMad) {
    processes.push({
      key: "hot_preparation",
      title: "Tilberedning af varm mad",
      description: "Kontrol af kernetemperatur og korrekt tilberedning af varme retter",
      area: "tilberedning",
      enabled: true,
      sourceFields: ["preparesHotFood", "tilberederVarmMad", "preparesHotFoodDetails", "hasWarmKitchen", "hasOvens"],
      scenarioTags: ["preparation", "temperature_control", "hot_food"],
      defaultCategory: "tilberedning"
    });
  }
  
  if (profile.preparesColdFood || profile.servererKoldMad) {
    processes.push({
      key: "cold_preparation",
      title: "Tilberedning af kold mad",
      description: "Hygiejnekontrol og korrekt håndtering ved tilberedning af kolde retter",
      area: "tilberedning",
      enabled: true,
      sourceFields: ["preparesColdFood", "servererKoldMad", "preparesColdFoodDetails", "hasColdKitchen"],
      scenarioTags: ["preparation", "hygiene", "cold_food"],
      defaultCategory: "tilberedning"
    });
  }
  
  // Hot holding and cooling - check both English and Danish field names
  if (profile.holdsHotFood || profile.varmholder) {
    processes.push({
      key: "hot_holding",
      title: "Varmholdelse af tilberedte retter",
      description: "Temperaturkontrol ved varmholdelse af færdige retter",
      area: "varmholdelse",
      enabled: true,
      sourceFields: ["holdsHotFood", "varmholder", "holdsHotFoodDetails"],
      scenarioTags: ["hot_holding", "temperature_control"],
      defaultCategory: "varmholdelse"
    });
  }
  
  if (profile.coolsHotFood || profile.nedkoelerMad) {
    processes.push({
      key: "cooling",
      title: "Nedkøling af tilberedte retter",
      description: "Kontrol af nedkølingstid og temperatur for tilberedte retter",
      area: "nedkoeling",
      enabled: true,
      sourceFields: ["coolsHotFood", "nedkoelerMad", "coolsHotFoodDetails"],
      scenarioTags: ["cooling", "temperature_control", "critical"],
      defaultCategory: "nedkoeling"
    });
  }
  
  // Allergen handling
  if (profile.handlesAllergens) {
    processes.push({
      key: "allergen_handling",
      title: "Håndtering af allergener",
      description: "Kontrol af krydskontaminering og korrekt håndtering af allergener",
      area: "allergener",
      enabled: true,
      sourceFields: ["handlesAllergens", "handlesAllergensDetails"],
      scenarioTags: ["allergen", "critical"],
      defaultCategory: "allergener"
    });
  }
  
  if (profile.sellsFoodWithAllergens) {
    processes.push({
      key: "allergen_information",
      title: "Allergeninformation til kunder",
      description: "Korrekt mærkning og information om allergener til kunder",
      area: "allergener",
      enabled: true,
      sourceFields: ["sellsFoodWithAllergens"],
      scenarioTags: ["allergen", "information", "critical"],
      defaultCategory: "allergener"
    });
  }
  
  // Packaging and transport
  if (profile.packagesOwnFood) {
    processes.push({
      key: "packaging",
      title: "Pakning af egne produkter",
      description: "Hygiejnekontrol og korrekt pakning af fødevarer",
      area: "pakning",
      enabled: true,
      sourceFields: ["packagesOwnFood"],
      scenarioTags: ["packaging", "hygiene"],
      defaultCategory: "pakning"
    });
  }
  
  if (profile.transportsHotTakeaway) {
    processes.push({
      key: "hot_transport",
      title: "Transport af varm takeaway",
      description: "Temperaturkontrol ved transport af varme retter",
      area: "transport",
      enabled: true,
      sourceFields: ["transportsHotTakeaway", "transportsHotTakeawayDetails"],
      scenarioTags: ["transport", "temperature_control", "hot_food"],
      defaultCategory: "transport"
    });
  }
  
  if (profile.transportsChilledGoods) {
    processes.push({
      key: "chilled_transport",
      title: "Transport af kølevarer",
      description: "Temperaturkontrol ved transport af kølevarer",
      area: "transport",
      enabled: true,
      sourceFields: ["transportsChilledGoods"],
      scenarioTags: ["transport", "temperature_control", "chilled"],
      defaultCategory: "transport"
    });
  }
  
  if (profile.transportsFrozenGoods) {
    processes.push({
      key: "frozen_transport",
      title: "Transport af frostvarer",
      description: "Temperaturkontrol ved transport af frostvarer",
      area: "transport",
      enabled: true,
      sourceFields: ["transportsFrozenGoods"],
      scenarioTags: ["transport", "temperature_control", "frozen"],
      defaultCategory: "transport"
    });
  }
  
  // Equipment and facilities
  if (profile.hasWarmKitchen) {
    processes.push({
      key: "warm_kitchen_equipment",
      title: "Kontrol af varmt køkkenudstyr",
      description: "Vedligeholdelse og kontrol af ovne, komfurer og varmt udstyr",
      area: "udstyr",
      enabled: true,
      sourceFields: ["hasWarmKitchen"],
      scenarioTags: ["equipment", "maintenance"],
      defaultCategory: "udstyr"
    });
  }
  
  if (profile.hasColdKitchen) {
    processes.push({
      key: "cold_kitchen_handling",
      title: "Håndtering i koldt køkken",
      description: "Hygiejnekontrol og korrekt håndtering i koldt køkken",
      area: "hygiejne",
      enabled: true,
      sourceFields: ["hasColdKitchen"],
      scenarioTags: ["hygiene", "cold_kitchen"],
      defaultCategory: "hygiejne"
    });
  }
  
  if (profile.hasHandwash) {
    processes.push({
      key: "personal_hygiene_station",
      title: "Personlig hygiejne og håndvask",
      description: "Kontrol af håndvaskefaciliteter og personlig hygiejne",
      area: "hygiejne",
      enabled: true,
      sourceFields: ["hasHandwash"],
      scenarioTags: ["hygiene", "personal", "critical"],
      defaultCategory: "hygiejne"
    });
  }
  
  if (profile.hasDishwashing || profile.hasWashingRoom) {
    processes.push({
      key: "dishwashing",
      title: "Opvask og rengøring af service",
      description: "Kontrol af opvasketemperatur og korrekt rengøring",
      area: "rengoering",
      enabled: true,
      sourceFields: ["hasDishwashing", "hasWashingRoom"],
      scenarioTags: ["cleaning", "dishwashing", "temperature_control"],
      defaultCategory: "rengoering"
    });
  }
  
  if (profile.hasOvens) {
    processes.push({
      key: "oven_control",
      title: "Kontrol af ovne og tilberedningsudstyr",
      description: "Temperaturkontrol og vedligeholdelse af ovne",
      area: "udstyr",
      enabled: true,
      sourceFields: ["hasOvens"],
      scenarioTags: ["equipment", "temperature_control"],
      defaultCategory: "udstyr"
    });
  }
  
  if (profile.hasWalkInCooler) {
    processes.push({
      key: "walk_in_cold_storage",
      title: "Kontrol af kølerum",
      description: "Temperaturkontrol og vedligeholdelse af kølerum",
      area: "opbevaring",
      enabled: true,
      sourceFields: ["hasWalkInCooler"],
      scenarioTags: ["storage", "temperature_control", "chilled", "walk_in"],
      defaultCategory: "opbevaring"
    });
  }
  
  if (profile.hasWalkInFreezer) {
    processes.push({
      key: "walk_in_frozen_storage",
      title: "Kontrol af fryserum",
      description: "Temperaturkontrol og vedligeholdelse af fryserum",
      area: "opbevaring",
      enabled: true,
      sourceFields: ["hasWalkInFreezer"],
      scenarioTags: ["storage", "temperature_control", "frozen", "walk_in"],
      defaultCategory: "opbevaring"
    });
  }
  
  if (profile.hasSofticeachine || profile.hasSoftIceMachine) {
    processes.push({
      key: "softice_machine",
      title: "Kontrol af softice-maskine",
      description: "Daglig rengøring og temperaturkontrol af softice-maskine",
      area: "udstyr",
      enabled: true,
      sourceFields: ["hasSofticeachine", "hasSoftIceMachine"],
      scenarioTags: ["equipment", "cleaning", "temperature_control", "critical"],
      defaultCategory: "udstyr"
    });
  }

  if (profile.hasIceMachine || profile.hasIsterningemaskine || (profile.antalIsterningemaskiner > 0)) {
    processes.push({
      key: "ice_machine_control",
      title: "Kontrol og rengøring af isterningemaskine",
      description: "Daglig rengøring og hygiejnekontrol af isterningemaskine. Rengøres adskilt dagligt.",
      area: "udstyr",
      enabled: true,
      sourceFields: ["hasIceMachine", "antalIsterningemaskiner"],
      scenarioTags: ["equipment", "cleaning", "hygiene", "critical"],
      defaultCategory: "udstyr"
    });
  }

  if (profile.hasIsboks || (profile.antalIsbokse > 0)) {
    processes.push({
      key: "isboks_control",
      title: "Temperaturkontrol og rengøring af isboks",
      description: "Ugentlig rengøring og daglig temperaturkontrol af isboks/isfryser (-18°C eller koldere)",
      area: "opbevaring",
      enabled: true,
      sourceFields: ["hasIsboks", "antalIsbokse"],
      scenarioTags: ["storage", "temperature_control", "frozen"],
      defaultCategory: "opbevaring"
    });
  }

  if (profile.hasFrituregryde || (profile.antalFrityreGryder > 0)) {
    processes.push({
      key: "friture_control",
      title: "Kontrol af frituregryde og olieskift",
      description: "Daglig kontrol af olietemperatur (max 175°C), oliehygiejne og ugentlig rengøring af frituregryde",
      area: "tilberedning",
      enabled: true,
      sourceFields: ["hasFrituregryde", "antalFrityreGryder"],
      scenarioTags: ["equipment", "temperature_control", "cleaning", "critical"],
      defaultCategory: "tilberedning"
    });
  }
  
  if (profile.hasProductionKitchen) {
    processes.push({
      key: "production_area_cleaning",
      title: "Rengøring af produktionsområde",
      description: "Daglig og periodisk rengøring af produktionskøkken",
      area: "rengoering",
      enabled: true,
      sourceFields: ["hasProductionKitchen"],
      scenarioTags: ["cleaning", "production"],
      defaultCategory: "rengoering"
    });
  }
  
  if (profile.hasServingArea) {
    processes.push({
      key: "serving_area",
      title: "Kontrol af serveringsområde",
      description: "Hygiejne og rengøring af serveringsområde",
      area: "servering",
      enabled: true,
      sourceFields: ["hasServingArea"],
      scenarioTags: ["serving", "hygiene"],
      defaultCategory: "servering"
    });
  }
  
  if (profile.hasToilet) {
    processes.push({
      key: "toilet_hygiene",
      title: "Toilethygiejne",
      description: "Rengøring og vedligeholdelse af toiletfaciliteter",
      area: "hygiejne",
      enabled: true,
      sourceFields: ["hasToilet"],
      scenarioTags: ["hygiene", "toilet"],
      defaultCategory: "hygiejne"
    });
  }
  
  return processes;
}

/**
 * Determine if a process/hazard is a CCP or CP
 * @param {string} processKey - Process key
 * @param {string} hazardType - Type of hazard
 * @param {object} profile - User profile
 * @returns {object} { isCCP: boolean, controlPointType: string }
 */
function determineControlPointType(processKey, hazardType, profile) {
  // Critical Control Points (CCPs)
  if (processKey === "cooling") return { isCCP: true, controlPointType: "CCP" };
  if (processKey === "hot_holding") return { isCCP: true, controlPointType: "CCP" };
  if (processKey === "hot_preparation") return { isCCP: true, controlPointType: "CCP" };
  if (processKey === "storage_chilled") return { isCCP: true, controlPointType: "CCP" };
  
  // Allergen handling is CCP if allergens are handled or sold
  if (processKey === "allergen_handling" || processKey === "allergen_information") {
    if (profile.handlesAllergens || profile.sellsFoodWithAllergens) {
      return { isCCP: true, controlPointType: "CCP" };
    }
  }
  
  // Dishwashing is CCP if temperature-critical
  if (processKey === "dishwashing") {
    return { isCCP: true, controlPointType: "CCP" };
  }
  
  // Softice machine is CCP due to high risk
  if (processKey === "softice_machine") {
    return { isCCP: true, controlPointType: "CCP" };
  }
  
  // Transport can be CCP if temperature-critical
  if (processKey === "hot_transport" && profile.transportsHotTakeaway) {
    return { isCCP: true, controlPointType: "CCP" };
  }
  if (processKey === "chilled_transport" && profile.transportsChilledGoods) {
    return { isCCP: true, controlPointType: "CCP" };
  }
  if (processKey === "frozen_transport" && profile.transportsFrozenGoods) {
    return { isCCP: true, controlPointType: "CCP" };
  }
  
  // Walk-in storage is CCP due to large volume
  if (processKey === "walk_in_cold_storage") return { isCCP: true, controlPointType: "CCP" };
  if (processKey === "walk_in_frozen_storage") return { isCCP: true, controlPointType: "CCP" };
  
  // All others are Control Points (CPs)
  return { isCCP: false, controlPointType: "CP" };
}

/**
 * Build critical limits for a process
 * @param {string} processKey - Process key
 * @param {object} profile - User profile
 * @returns {object} Critical limits object
 */
function buildCriticalLimits(processKey, profile) {
  const limits = {};
  
  switch (processKey) {
    case "storage_chilled":
    case "walk_in_cold_storage":
      return { min: 0, max: 5, unit: "C", rule: "Køleskab skal holde 0-5°C" };
    
    case "storage_frozen":
    case "walk_in_frozen_storage":
      return { max: -18, unit: "C", rule: "Fryser skal holde -18°C eller koldere" };
    
    case "hot_holding":
      return { min: 65, unit: "C", rule: "Varmholdelse minimum 65°C" };
    
    case "hot_preparation":
      return { min: 75, unit: "C", rule: "Kernetemperatur minimum 75°C i 2 minutter" };
    
    case "cooling":
      return { rule: "Fra 65°C til 10°C inden 3 timer" };
    
    case "dishwashing":
      return { rule: "Vask min. 60°C, slutskyl 80-85°C" };
    
    case "receiving_chilled_goods":
      return { max: 5, unit: "C", rule: "Kølevarer modtages ved max +5°C" };
    
    case "receiving_frozen_goods":
      return { max: -12, unit: "C", rule: "Frostvarer modtages ved max -12°C (ideelt -18°C)" };
    
    case "chilled_transport":
      return { max: 5, unit: "C", rule: "Transport af kølevarer ved max +5°C" };
    
    case "frozen_transport":
      return { max: -18, unit: "C", rule: "Transport af frostvarer ved max -18°C" };
    
    case "hot_transport":
      return { min: 65, unit: "C", rule: "Transport af varm mad ved min. 65°C" };
    
    case "softice_machine":
      return { rule: "Daglig rengøring og korrekt driftstemperatur jf. fabrikant" };
    
    case "personal_hygiene_station":
      return { rule: "Varmt vand, sæbe og engangshåndklæder skal være tilgængelige" };
    
    case "allergen_handling":
    case "allergen_information":
      return { rule: "Alle 14 allergener skal være korrekt deklareret og håndteret" };
    
    default:
      return { rule: "Følg god hygiejnepraksis" };
  }
}

/**
 * Generate hazards from processes
 * Creates hazard definitions for each process
 * @param {ProcessDefinition[]} processes - Array of process definitions
 * @param {object} profile - User profile
 * @returns {HazardDefinition[]} Array of hazard definitions
 */
function generateHazardsFromProcesses(processes, profile) {
  const hazards = [];
  
  processes.forEach(process => {
    const processKey = process.key;
    const cpType = determineControlPointType(processKey, "biological", profile);
    const criticalLimits = buildCriticalLimits(processKey, profile);
    
    // Build hazard based on process type
    let hazard = {
      id: `hazard_${processKey}`,
      processKey: processKey,
      title: "",
      description: "",
      hazardType: "biological",
      riskLevel: "medium",
      isCCP: cpType.isCCP,
      controlPointType: cpType.controlPointType,
      controlMeasure: "",
      criticalLimits: criticalLimits,
      monitoring: {
        frequency: "daily",
        frequencyType: "daily",
        frequencyDays: 1,
        method: "",
        responsibleRole: ""
      },
      procedure: [],
      correctiveActions: [],
      verification: [],
      documentation: [],
      formType: "checklist",
      category: process.defaultCategory,
      sourceFields: process.sourceFields
    };
    
    // Customize hazard based on process key
    switch (processKey) {
      case "receiving_chilled_goods":
        hazard.title = "Bakterievækst fra forkert modtagetemperatur";
        hazard.description = "Salmonella, Listeria og Campylobacter kan vokse i kølevarer modtaget ved for høj temperatur";
        hazard.riskLevel = "high";
        hazard.controlMeasure = "Temperaturkontrol ved modtagelse";
        hazard.formType = "receiving";
        hazard.monitoring.method = "Temperaturmåling med kalibreret termometer";
        hazard.monitoring.responsibleRole = "Modtagende medarbejder";
        hazard.procedure = ["Mål temperatur på kølevarer", "Tjek emballage og datomærkning", "Afvis varer over 5°C", "Registrér i modtagelseslog"];
        hazard.correctiveActions = ["Afvis varer over 5°C", "Returner til leverandør", "Dokumentér afvisning"];
        hazard.verification = ["Månedlig gennemgang af modtagelseslog"];
        hazard.documentation = ["Modtagelseslog", "Afvisningslog"];
        break;
      
      case "receiving_frozen_goods":
        hazard.title = "Bakterievækst fra optøede frostvarer";
        hazard.description = "Frostvarer der er optøet under transport kan indeholde farlige bakterier";
        hazard.riskLevel = "high";
        hazard.controlMeasure = "Temperaturkontrol ved modtagelse";
        hazard.formType = "receiving";
        hazard.monitoring.method = "Temperaturmåling med kalibreret termometer";
        hazard.monitoring.responsibleRole = "Modtagende medarbejder";
        hazard.procedure = ["Mål temperatur på frostvarer", "Tjek for tegn på optøning", "Afvis varer over -12°C", "Registrér i modtagelseslog"];
        hazard.correctiveActions = ["Afvis optøede varer", "Returner til leverandør", "Dokumentér afvisning"];
        hazard.verification = ["Månedlig gennemgang af modtagelseslog"];
        hazard.documentation = ["Modtagelseslog", "Afvisningslog"];
        break;
      
      case "receiving_room_temp_goods":
        hazard.title = "Forurening fra beskadiget emballage";
        hazard.description = "Beskadiget emballage kan føre til forurening af tørvarer";
        hazard.riskLevel = "low";
        hazard.controlMeasure = "Visuel kontrol af emballage";
        hazard.formType = "receiving";
        hazard.monitoring.method = "Visuel inspektion";
        hazard.monitoring.responsibleRole = "Modtagende medarbejder";
        hazard.procedure = ["Inspicer emballage", "Tjek datomærkning", "Afvis beskadigede varer", "Registrér i modtagelseslog"];
        hazard.correctiveActions = ["Afvis beskadigede varer", "Returner til leverandør"];
        hazard.verification = ["Månedlig gennemgang af modtagelseslog"];
        hazard.documentation = ["Modtagelseslog"];
        break;
      
      case "storage_chilled":
      case "walk_in_cold_storage":
        hazard.title = "Bakterievækst ved forkert køletemperatur";
        hazard.description = "Listeria, Salmonella og E. coli kan vokse ved temperaturer over 5°C";
        hazard.riskLevel = "critical";
        hazard.controlMeasure = "Daglig temperaturkontrol";
        hazard.formType = "temperature";
        hazard.monitoring.method = "Temperaturmåling med kalibreret termometer";
        hazard.monitoring.responsibleRole = "Køkkenchef eller ansvarlig medarbejder";
        hazard.procedure = ["Aflæs temperatur dagligt", "Kontrollér at døren lukker korrekt", "Tjek korrekt adskillelse af varer", "Registrér måling"];
        hazard.correctiveActions = ["Flyt varer til fungerende køl", "Bestil service", "Kassér varer hvis nødvendigt", "Dokumentér afvigelse"];
        hazard.verification = ["Ugentlig gennemgang af temperaturlog", "Månedlig kalibrering af termometer"];
        hazard.documentation = ["Temperaturlog", "Afvigelseslog", "Kalibreringslog"];
        break;
      
      case "storage_frozen":
      case "walk_in_frozen_storage":
        hazard.title = "Bakterievækst ved for høj frysetemperatur";
        hazard.description = "Frostvarer kan optø og blive usikre ved temperaturer over -12°C";
        hazard.riskLevel = "high";
        hazard.controlMeasure = "Daglig temperaturkontrol";
        hazard.formType = "temperature";
        hazard.monitoring.method = "Temperaturmåling med kalibreret termometer";
        hazard.monitoring.responsibleRole = "Køkkenchef eller ansvarlig medarbejder";
        hazard.procedure = ["Aflæs temperatur dagligt", "Kontrollér at døren lukker korrekt", "Registrér måling"];
        hazard.correctiveActions = ["Flyt varer til fungerende fryser", "Bestil service", "Kassér optøede varer"];
        hazard.verification = ["Ugentlig gennemgang af temperaturlog"];
        hazard.documentation = ["Temperaturlog", "Afvigelseslog"];
        break;
      
      case "storage_dry":
        hazard.title = "Forurening fra ukorrekt opbevaring";
        hazard.description = "Tørvarer kan blive forurenet ved ukorrekt opbevaring";
        hazard.riskLevel = "low";
        hazard.controlMeasure = "Visuel kontrol af opbevaring";
        hazard.formType = "checklist";
        hazard.monitoring.frequency = "weekly";
        hazard.monitoring.frequencyType = "weekly";
        hazard.monitoring.frequencyDays = 7;
        hazard.monitoring.method = "Visuel inspektion";
        hazard.monitoring.responsibleRole = "Køkkenchef";
        hazard.procedure = ["Kontrollér FIFO-princip", "Tjek for skadedyr", "Verificer korrekt mærkning"];
        hazard.correctiveActions = ["Kassér beskadigede varer", "Kontakt skadedyrsbekæmpelse hvis nødvendigt"];
        hazard.verification = ["Månedlig inspektion"];
        hazard.documentation = ["Inspektionslog"];
        break;
      
      case "hot_preparation":
        hazard.title = "Utilstrækkelig varmebehandling";
        hazard.description = "Salmonella, Campylobacter og E. coli kan overleve ved kernetemperatur under 75°C";
        hazard.riskLevel = "critical";
        hazard.controlMeasure = "Kernetemperaturkontrol";
        hazard.formType = "temperature";
        hazard.monitoring.method = "Måling med kalibreret kernetermometer";
        hazard.monitoring.responsibleRole = "Kok eller tilberedende medarbejder";
        hazard.procedure = ["Stik termometer i tykkeste del", "Vent 10 sekunder", "Aflæs minimum 75°C", "Registrér temperatur"];
        hazard.correctiveActions = ["Fortsæt tilberedning til 75°C", "Kassér hvis gentagne problemer", "Kalibrer termometer"];
        hazard.verification = ["Ugentlig gennemgang af temperaturlog", "Månedlig kalibrering af termometre"];
        hazard.documentation = ["Temperaturlog", "Kalibreringslog"];
        break;
      
      case "cold_preparation":
        hazard.title = "Krydskontaminering ved kold tilberedning";
        hazard.description = "Bakterieoverførsel fra hænder og redskaber ved tilberedning af kolde retter";
        hazard.riskLevel = "medium";
        hazard.controlMeasure = "Hygiejnekontrol";
        hazard.formType = "hygiene";
        hazard.monitoring.method = "Observation af arbejdsgange";
        hazard.monitoring.responsibleRole = "Køkkenchef";
        hazard.procedure = ["Vask hænder før tilberedning", "Brug rene redskaber", "Hold ingredienser kølige", "Undgå krydskontaminering"];
        hazard.correctiveActions = ["Kassér berørt mad", "Instruér medarbejdere", "Rengør grundigt"];
        hazard.verification = ["Daglig observation"];
        hazard.documentation = ["Hygiejnelog"];
        break;
      
      case "hot_holding":
        hazard.title = "Bakterievækst ved lav varmholdelsestemperatur";
        hazard.description = "Bacillus cereus og Clostridium perfringens kan vokse ved temperaturer under 65°C";
        hazard.riskLevel = "critical";
        hazard.controlMeasure = "Temperaturkontrol ved varmholdelse";
        hazard.formType = "temperature";
        hazard.monitoring.frequency = "every_2_hours";
        hazard.monitoring.frequencyType = "interval_hours";
        hazard.monitoring.frequencyDays = 1;
        hazard.monitoring.method = "Temperaturmåling i produktet";
        hazard.monitoring.responsibleRole = "Kok eller serveringspersonale";
        hazard.procedure = ["Mål temperatur i midten af retten", "Kontrollér minimum 65°C", "Notér starttidspunkt", "Kassér efter 3 timer"];
        hazard.correctiveActions = ["Varm op til 75°C eller kassér", "Kassér efter 3 timer", "Tjek varmholdelsesudstyr"];
        hazard.verification = ["Ugentlig gennemgang af varmholdelseslog"];
        hazard.documentation = ["Varmholdelseslog", "Afvigelseslog"];
        break;
      
      case "cooling":
        hazard.title = "Bakterievækst ved langsom nedkøling";
        hazard.description = "Bacillus cereus og Clostridium perfringens vokser hurtigt i temperaturzonen 10-65°C";
        hazard.riskLevel = "critical";
        hazard.controlMeasure = "Nedkølingstidskontrol";
        hazard.formType = "temperature";
        hazard.monitoring.method = "Måling af start- og sluttemperatur samt tid";
        hazard.monitoring.responsibleRole = "Kok eller tilberedende medarbejder";
        hazard.procedure = ["Mål starttemperatur (skal være under 65°C)", "Placer i blast chiller eller køl", "Mål sluttemperatur efter max 3 timer", "Registrér tid og temperaturer"];
        hazard.correctiveActions = ["Kassér hvis over 3 timer", "Brug blast chiller eller mindre portioner", "Dokumentér afvigelse"];
        hazard.verification = ["Ugentlig gennemgang af nedkølingslog"];
        hazard.documentation = ["Nedkølingslog", "Afvigelseslog"];
        break;
      
      case "allergen_handling":
      case "allergen_information":
        hazard.title = "Allergisk reaktion fra ukorrekt allergenhåndtering";
        hazard.description = "Anafylaksi og andre allergiske reaktioner fra krydskontaminering eller manglende information";
        hazard.hazardType = "allergen";
        hazard.riskLevel = "critical";
        hazard.controlMeasure = "Allergenkontrol og mærkning";
        hazard.formType = "checklist";
        hazard.monitoring.method = "Kontrol af mærkning og adskillelse";
        hazard.monitoring.responsibleRole = "Køkkenchef";
        hazard.procedure = ["Tjek allergenmærkning på menukort", "Brug separate redskaber", "Rengør mellem allergenfrie retter", "Informér personale"];
        hazard.correctiveActions = ["Opdater mærkning omgående", "Kassér berørt mad", "Instruér personale", "Ring 112 ved alvorlig reaktion"];
        hazard.verification = ["Månedlig gennemgang af allergenliste", "Kvartalsvise stikprøver"];
        hazard.documentation = ["Allergenliste", "Mærkningslog", "Instruktionslog"];
        break;
      
      case "packaging":
        hazard.title = "Forurening ved pakning";
        hazard.description = "Bakterieoverførsel fra hænder og emballage ved pakning";
        hazard.riskLevel = "medium";
        hazard.controlMeasure = "Hygiejnekontrol ved pakning";
        hazard.formType = "hygiene";
        hazard.monitoring.method = "Observation af arbejdsgange";
        hazard.monitoring.responsibleRole = "Ansvarlig medarbejder";
        hazard.procedure = ["Vask hænder før pakning", "Brug ren emballage", "Mærk med dato og indhold"];
        hazard.correctiveActions = ["Kassér ukorrekt pakket mad", "Instruér medarbejdere"];
        hazard.verification = ["Ugentlig observation"];
        hazard.documentation = ["Pakningslog"];
        break;
      
      case "hot_transport":
        hazard.title = "Bakterievækst ved lav transporttemperatur";
        hazard.description = "Varm mad kan blive usikker hvis temperaturen falder under 65°C under transport";
        hazard.riskLevel = "high";
        hazard.controlMeasure = "Temperaturkontrol ved transport";
        hazard.formType = "temperature";
        hazard.monitoring.method = "Temperaturmåling før og efter transport";
        hazard.monitoring.responsibleRole = "Chauffør eller ansvarlig medarbejder";
        hazard.procedure = ["Mål temperatur før afgang", "Brug isolerede beholdere", "Mål temperatur ved levering"];
        hazard.correctiveActions = ["Kassér hvis under 65°C", "Brug bedre isolering", "Reducer transporttid"];
        hazard.verification = ["Ugentlig gennemgang af transportlog"];
        hazard.documentation = ["Transportlog", "Temperaturlog"];
        break;
      
      case "chilled_transport":
        hazard.title = "Bakterievækst ved for høj transporttemperatur";
        hazard.description = "Kølevarer kan blive usikre hvis temperaturen stiger over 5°C under transport";
        hazard.riskLevel = "high";
        hazard.controlMeasure = "Temperaturkontrol ved transport";
        hazard.formType = "temperature";
        hazard.monitoring.method = "Temperaturmåling før og efter transport";
        hazard.monitoring.responsibleRole = "Chauffør eller ansvarlig medarbejder";
        hazard.procedure = ["Mål temperatur før afgang", "Brug kølebil eller kølebokse", "Mål temperatur ved levering"];
        hazard.correctiveActions = ["Kassér hvis over 8°C i >2 timer", "Brug bedre køling"];
        hazard.verification = ["Ugentlig gennemgang af transportlog"];
        hazard.documentation = ["Transportlog", "Temperaturlog"];
        break;
      
      case "frozen_transport":
        hazard.title = "Optøning ved for høj transporttemperatur";
        hazard.description = "Frostvarer kan optø hvis temperaturen stiger over -12°C under transport";
        hazard.riskLevel = "high";
        hazard.controlMeasure = "Temperaturkontrol ved transport";
        hazard.formType = "temperature";
        hazard.monitoring.method = "Temperaturmåling før og efter transport";
        hazard.monitoring.responsibleRole = "Chauffør eller ansvarlig medarbejder";
        hazard.procedure = ["Mål temperatur før afgang", "Brug frysebil eller fryseboxe", "Mål temperatur ved levering"];
        hazard.correctiveActions = ["Kassér optøede varer", "Brug bedre frysning"];
        hazard.verification = ["Ugentlig gennemgang af transportlog"];
        hazard.documentation = ["Transportlog", "Temperaturlog"];
        break;
      
      case "personal_hygiene_station":
        hazard.title = "Bakterieoverførsel fra utilstrækkelig håndhygiejne";
        hazard.description = "Salmonella, E. coli og virus kan overføres fra hænder til fødevarer";
        hazard.riskLevel = "high";
        hazard.controlMeasure = "Håndvaskekontrol";
        hazard.formType = "hygiene";
        hazard.monitoring.method = "Kontrol af faciliteter og observation";
        hazard.monitoring.responsibleRole = "Køkkenchef";
        hazard.procedure = ["Tjek varmt vand", "Tjek sæbe og håndklæder", "Observér medarbejdere", "Instruér ved behov"];
        hazard.correctiveActions = ["Genopfyld sæbe og håndklæder", "Reparer defekte faciliteter", "Instruér medarbejdere"];
        hazard.verification = ["Daglig kontrol af faciliteter"];
        hazard.documentation = ["Hygiejnelog", "Vedligeholdelseslog"];
        break;
      
      case "dishwashing":
        hazard.title = "Bakterieoverførsel fra utilstrækkelig opvask";
        hazard.description = "Bakterier kan overleve på service hvis opvasketemperaturen er for lav";
        hazard.riskLevel = "high";
        hazard.controlMeasure = "Temperaturkontrol ved opvask";
        hazard.formType = "temperature";
        hazard.monitoring.method = "Temperaturmåling af vask og skyllevand";
        hazard.monitoring.responsibleRole = "Ansvarlig for opvask";
        hazard.procedure = ["Tjek vasketemperatur (min. 60°C)", "Tjek skylletemperatur (80-85°C)", "Kontrollér rengøringsresultat"];
        hazard.correctiveActions = ["Juster temperatur", "Genvask service", "Bestil service på opvaskemaskine"];
        hazard.verification = ["Ugentlig temperaturkontrol"];
        hazard.documentation = ["Opvaskelog", "Temperaturlog"];
        break;
      
      case "oven_control":
        hazard.title = "Utilstrækkelig tilberedning fra defekt ovn";
        hazard.description = "Ukorrekt ovntemperatur kan føre til utilstrækkelig varmebehandling";
        hazard.riskLevel = "medium";
        hazard.controlMeasure = "Ovntemperaturkontrol";
        hazard.formType = "temperature";
        hazard.monitoring.frequency = "weekly";
        hazard.monitoring.frequencyType = "weekly";
        hazard.monitoring.frequencyDays = 7;
        hazard.monitoring.method = "Temperaturmåling med ovntermometer";
        hazard.monitoring.responsibleRole = "Køkkenchef";
        hazard.procedure = ["Tjek ovntemperatur med termometer", "Sammenlign med display", "Registrér afvigelser"];
        hazard.correctiveActions = ["Kalibrer ovn", "Bestil service", "Brug alternativ ovn"];
        hazard.verification = ["Månedlig kalibrering"];
        hazard.documentation = ["Vedligeholdelseslog", "Kalibreringslog"];
        break;
      
      case "softice_machine":
        hazard.title = "Bakterievækst i softice-maskine";
        hazard.description = "Listeria og Salmonella kan vokse i softice-maskiner ved utilstrækkelig rengøring";
        hazard.riskLevel = "critical";
        hazard.controlMeasure = "Daglig rengøring og temperaturkontrol";
        hazard.formType = "cleaning";
        hazard.monitoring.method = "Rengøringskontrol og temperaturmåling";
        hazard.monitoring.responsibleRole = "Ansvarlig for softice";
        hazard.procedure = ["Adskil og rengør dagligt", "Desinficer alle dele", "Tjek driftstemperatur", "Dokumentér rengøring"];
        hazard.correctiveActions = ["Intensiv rengøring ved fund af biofilm", "Kassér produkt ved tvivl", "Bestil service"];
        hazard.verification = ["Ugentlig inspektion", "Månedlig podning (anbefalet)"];
        hazard.documentation = ["Rengøringslog", "Temperaturlog", "Podningsresultater"];
        break;
      
      case "production_area_cleaning":
        hazard.title = "Krydskontaminering fra utilstrækkelig rengøring";
        hazard.description = "Listeria og andre bakterier kan overleve i produktionsområder ved dårlig rengøring";
        hazard.riskLevel = "high";
        hazard.controlMeasure = "Daglig og periodisk rengøring";
        hazard.formType = "cleaning";
        hazard.monitoring.method = "Visuel inspektion og tjekliste";
        hazard.monitoring.responsibleRole = "Køkkenchef";
        hazard.procedure = ["Rengør arbejdsflader dagligt", "Rengør afløb dagligt", "Dybderengør ugentligt", "Dokumentér rengøring"];
        hazard.correctiveActions = ["Rengør omgående ved fund af snavs", "Ekstra instruktion", "Kontakt skadedyrsbekæmpelse ved behov"];
        hazard.verification = ["Ugentlig inspektion", "Månedlig dybdeinspektion"];
        hazard.documentation = ["Rengøringslog", "Inspektionslog"];
        break;
      
      case "serving_area":
        hazard.title = "Forurening i serveringsområde";
        hazard.description = "Bakterieoverførsel fra utilstrækkelig hygiejne i serveringsområde";
        hazard.riskLevel = "medium";
        hazard.controlMeasure = "Hygiejnekontrol i serveringsområde";
        hazard.formType = "hygiene";
        hazard.monitoring.method = "Visuel inspektion";
        hazard.monitoring.responsibleRole = "Ansvarlig for servering";
        hazard.procedure = ["Rengør serveringsborde", "Tjek renlighed af redskaber", "Kontrollér personlig hygiejne"];
        hazard.correctiveActions = ["Rengør omgående", "Instruér personale"];
        hazard.verification = ["Daglig inspektion"];
        hazard.documentation = ["Rengøringslog"];
        break;
      
      case "toilet_hygiene":
        hazard.title = "Bakterieoverførsel fra toilet";
        hazard.description = "E. coli og andre bakterier kan overføres fra toilet til fødevarer";
        hazard.riskLevel = "medium";
        hazard.controlMeasure = "Toilethygiejne og rengøring";
        hazard.formType = "cleaning";
        hazard.monitoring.method = "Visuel inspektion og tjekliste";
        hazard.monitoring.responsibleRole = "Rengøringspersonale";
        hazard.procedure = ["Rengør toilet dagligt", "Tjek sæbe og håndklæder", "Kontrollér ventilation"];
        hazard.correctiveActions = ["Rengør omgående ved behov", "Genopfyld forsyninger"];
        hazard.verification = ["Daglig inspektion"];
        hazard.documentation = ["Rengøringslog"];
        break;
      
      case "warm_kitchen_equipment":
      case "cold_kitchen_handling":
        hazard.title = "Forurening fra ukorrekt udstyrsvedligeholdelse";
        hazard.description = "Bakterier kan vokse på dårligt vedligeholdt udstyr";
        hazard.riskLevel = "medium";
        hazard.controlMeasure = "Vedligeholdelse og rengøring af udstyr";
        hazard.formType = "checklist";
        hazard.monitoring.frequency = "weekly";
        hazard.monitoring.frequencyType = "weekly";
        hazard.monitoring.frequencyDays = 7;
        hazard.monitoring.method = "Visuel inspektion";
        hazard.monitoring.responsibleRole = "Køkkenchef";
        hazard.procedure = ["Inspicer udstyr ugentligt", "Rengør jf. plan", "Dokumentér vedligeholdelse"];
        hazard.correctiveActions = ["Rengør omgående", "Bestil service ved defekt"];
        hazard.verification = ["Månedlig inspektion"];
        hazard.documentation = ["Vedligeholdelseslog"];
        break;
      
      default:
        // Generic hazard for any unmapped processes
        hazard.title = `Fødevaresikkerhedsrisiko ved ${process.title.toLowerCase()}`;
        hazard.description = "Generel fødevaresikkerhedsrisiko";
        hazard.controlMeasure = "Kontrol og overvågning";
        hazard.monitoring.method = "Visuel kontrol";
        hazard.monitoring.responsibleRole = "Ansvarlig medarbejder";
        hazard.procedure = ["Udfør kontrol", "Registrér resultat"];
        hazard.correctiveActions = ["Ret fejl omgående", "Dokumentér afvigelse"];
        hazard.verification = ["Periodisk gennemgang"];
        hazard.documentation = ["Kontrollog"];
    }
    
    hazards.push(hazard);
  });
  
  return hazards;
}

/**
 * Build verification tasks from hazards
 * Creates verification task definitions based on hazard types and CCPs
 * @param {HazardDefinition[]} hazards - Array of hazard definitions
 * @param {object} profile - User profile
 * @returns {VerificationTask[]} Array of verification task definitions
 */
function buildVerificationTasks(hazards, profile) {
  const tasks = [];
  const taskIds = new Set();
  
  // Helper to add task only if not duplicate
  const addTask = (task) => {
    if (!taskIds.has(task.id)) {
      taskIds.add(task.id);
      tasks.push(task);
    }
  };
  
  // Check for temperature hazards
  const hasTemperatureHazards = hazards.some(h => h.formType === "temperature");
  const hasCCPTemperatureHazards = hazards.some(h => h.isCCP && h.formType === "temperature");
  
  // Check for cleaning/hygiene hazards
  const hasCleaningHazards = hazards.some(h => h.formType === "cleaning" || h.formType === "hygiene");
  
  // Check for allergen hazards
  const hasAllergenHazards = hazards.some(h => h.hazardType === "allergen");
  
  // Check for receiving hazards
  const hasReceivingHazards = hazards.some(h => h.formType === "receiving");
  
  // 1. Termometer kalibrering (hvis temperature hazards)
  if (hasTemperatureHazards) {
    const relatedHazards = hazards.filter(h => h.formType === "temperature");
    addTask({
      id: "verification_thermometer_calibration",
      title: "Kalibrering af termometre",
      description: "Månedlig kontrol og kalibrering af alle termometre for at sikre nøjagtige temperaturmålinger",
      frequency: "monthly",
      frequencyType: "monthly",
      frequencyDays: 30,
      category: "verifikation",
      formType: "checklist",
      procedure: [
        "Kontrollér alle termometre mod kalibreret referencetermometer",
        "Test i isvand (0°C) og kogende vand (100°C)",
        "Notér afvigelser større end ±1°C",
        "Udskift eller justér termometre med afvigelser",
        "Dokumentér kalibrering med dato og resultat"
      ],
      deviationActions: [
        "Udskift termometre med afvigelser over ±2°C",
        "Gennemgå temperaturmålinger siden sidste kalibrering",
        "Vurdér om fødevarer skal kasseres"
      ],
      relatedProcessKeys: relatedHazards.map(h => h.processKey),
      relatedHazardIds: relatedHazards.map(h => h.id)
    });
  }
  
  // 2. Ledelseskontrol af temperaturregistreringer (hvis CCP temperature hazards)
  if (hasCCPTemperatureHazards) {
    const relatedHazards = hazards.filter(h => h.isCCP && h.formType === "temperature");
    addTask({
      id: "verification_temperature_review",
      title: "Ledelseskontrol af temperaturregistreringer",
      description: "Ugentlig gennemgang af alle temperaturregistreringer for kritiske kontrolpunkter",
      frequency: "weekly",
      frequencyType: "weekly",
      frequencyDays: 7,
      category: "verifikation",
      formType: "checklist",
      procedure: [
        "Gennemgå alle temperaturlogs for ugen",
        "Kontrollér at alle målinger er inden for kritiske grænser",
        "Verificér at afvigelser er håndteret korrekt",
        "Kontrollér at korrigerende handlinger er dokumenteret",
        "Underskriv og dater gennemgangen"
      ],
      deviationActions: [
        "Identificér årsag til manglende registreringer",
        "Instruér medarbejdere i korrekt procedure",
        "Opfølg på ikke-håndterede afvigelser"
      ],
      relatedProcessKeys: relatedHazards.map(h => h.processKey),
      relatedHazardIds: relatedHazards.map(h => h.id)
    });
  }
  
  // 3. Verifikation af rengøringsplan (hvis cleaning/hygiene hazards)
  if (hasCleaningHazards) {
    const relatedHazards = hazards.filter(h => h.formType === "cleaning" || h.formType === "hygiene");
    addTask({
      id: "verification_cleaning_plan",
      title: "Verifikation af rengøringsplan",
      description: "Månedlig kontrol af at rengøringsplanen følges og er effektiv",
      frequency: "monthly",
      frequencyType: "monthly",
      frequencyDays: 30,
      category: "verifikation",
      formType: "checklist",
      procedure: [
        "Gennemgå rengøringslog for måneden",
        "Udfør visuel inspektion af rengøringsområder",
        "Kontrollér at alle planlagte rengøringer er udført",
        "Vurdér om rengøringsfrekvens er tilstrækkelig",
        "Dokumentér fund og eventuelle justeringer"
      ],
      deviationActions: [
        "Opdater rengøringsplan hvis utilstrækkelig",
        "Ekstra instruktion til rengøringspersonale",
        "Overvej mikrobiologisk prøvetagning ved gentagne problemer"
      ],
      relatedProcessKeys: relatedHazards.map(h => h.processKey),
      relatedHazardIds: relatedHazards.map(h => h.id)
    });
  }
  
  // 4. Verifikation af allergeninformation (hvis allergen hazards)
  if (hasAllergenHazards) {
    const relatedHazards = hazards.filter(h => h.hazardType === "allergen");
    addTask({
      id: "verification_allergen_info",
      title: "Verifikation af allergeninformation",
      description: "Månedlig kontrol af at allergeninformation er korrekt og opdateret",
      frequency: "monthly",
      frequencyType: "monthly",
      frequencyDays: 30,
      category: "verifikation",
      formType: "checklist",
      procedure: [
        "Gennemgå allergenliste for alle retter",
        "Kontrollér at menukort og skiltning er opdateret",
        "Verificér at leverandørdokumentation er tilgængelig",
        "Kontrollér at personale kender allergenprocedurer",
        "Dokumentér gennemgang og eventuelle ændringer"
      ],
      deviationActions: [
        "Opdater allergenliste og menukort omgående",
        "Instruér personale i korrekte procedurer",
        "Kontakt leverandører for manglende dokumentation"
      ],
      relatedProcessKeys: relatedHazards.map(h => h.processKey),
      relatedHazardIds: relatedHazards.map(h => h.id)
    });
  }
  
  // 5. Verifikation af leverandør- og modtagekontrol (hvis receiving hazards)
  if (hasReceivingHazards) {
    const relatedHazards = hazards.filter(h => h.formType === "receiving");
    addTask({
      id: "verification_supplier_receiving",
      title: "Verifikation af leverandør- og modtagekontrol",
      description: "Kvartalsvis gennemgang af leverandører og modtagelseskontrol",
      frequency: "quarterly",
      frequencyType: "quarterly",
      frequencyDays: 90,
      category: "verifikation",
      formType: "checklist",
      procedure: [
        "Gennemgå modtagelseslog for kvartalet",
        "Identificér leverandører med gentagne afvigelser",
        "Kontrollér at leverandørliste er opdateret",
        "Verificér at afviste varer er dokumenteret",
        "Vurdér om leverandører skal skiftes"
      ],
      deviationActions: [
        "Kontakt leverandører med gentagne problemer",
        "Skift leverandør hvis nødvendigt",
        "Opdater modtagelsesprocedurer"
      ],
      relatedProcessKeys: relatedHazards.map(h => h.processKey),
      relatedHazardIds: relatedHazards.map(h => h.id)
    });
  }
  
  // 6. Revision af risikoanalyse (altid)
  addTask({
    id: "verification_risk_analysis_review",
    title: "Revision af risikoanalyse ved ændringer i drift",
    description: "Årlig eller ved væsentlige ændringer: gennemgang og opdatering af risikoanalyse",
    frequency: "yearly",
    frequencyType: "yearly",
    frequencyDays: 365,
    category: "verifikation",
    formType: "checklist",
    procedure: [
      "Gennemgå alle processer og hazards",
      "Vurdér om der er nye processer eller produkter",
      "Kontrollér at kontrolforanstaltninger er effektive",
      "Opdater risikoanalyse ved ændringer",
      "Dokumentér revision med dato og ansvarlig"
    ],
    deviationActions: [
      "Opdater risikoanalyse omgående ved væsentlige ændringer",
      "Instruér personale i nye procedurer",
      "Opdater task templates og dokumentation"
    ],
    relatedProcessKeys: hazards.map(h => h.processKey),
    relatedHazardIds: hazards.map(h => h.id)
  });
  
  return tasks;
}

/**
 * Build documentation requirements from hazards and verification tasks
 * Creates documentation requirement definitions based on hazard types
 * @param {HazardDefinition[]} hazards - Array of hazard definitions
 * @param {VerificationTask[]} verificationTasks - Array of verification tasks
 * @returns {DocumentationRequirement[]} Array of documentation requirements
 */
function buildDocumentationRequirements(hazards, verificationTasks) {
  const requirements = [];
  const requirementIds = new Set();
  
  // Helper to add requirement only if not duplicate
  const addRequirement = (req) => {
    if (!requirementIds.has(req.id)) {
      requirementIds.add(req.id);
      requirements.push(req);
    }
  };
  
  // Check for different hazard types
  const hasTemperatureHazards = hazards.some(h => h.formType === "temperature");
  const hasReceivingHazards = hazards.some(h => h.formType === "receiving");
  const hasCleaningHazards = hazards.some(h => h.formType === "cleaning" || h.formType === "hygiene");
  const hasAllergenHazards = hazards.some(h => h.hazardType === "allergen");
  const hasCCPHazards = hazards.some(h => h.isCCP);
  const hasThermometerCalibration = verificationTasks.some(t => t.id === "verification_thermometer_calibration");
  
  // 1. Temperaturlog (hvis temperature hazards)
  if (hasTemperatureHazards) {
    const relatedHazards = hazards.filter(h => h.formType === "temperature");
    addRequirement({
      id: "doc_temperature_log",
      title: "Temperaturlog",
      description: "Daglig registrering af temperaturer for alle temperaturkritiske processer og udstyr",
      appliesTo: relatedHazards.map(h => h.id),
      type: "log"
    });
  }
  
  // 2. Modtagekontrolskema (hvis receiving hazards)
  if (hasReceivingHazards) {
    const relatedHazards = hazards.filter(h => h.formType === "receiving");
    addRequirement({
      id: "doc_receiving_log",
      title: "Modtagekontrolskema",
      description: "Registrering af alle varemodtagelser med temperatur, kvalitet og leverandøroplysninger",
      appliesTo: relatedHazards.map(h => h.id),
      type: "log"
    });
  }
  
  // 3. Leverandørliste (hvis receiving hazards)
  if (hasReceivingHazards) {
    const relatedHazards = hazards.filter(h => h.formType === "receiving");
    addRequirement({
      id: "doc_supplier_list",
      title: "Leverandørliste og sporbarhed",
      description: "Opdateret liste over godkendte leverandører med kontaktoplysninger og produkter",
      appliesTo: relatedHazards.map(h => h.id),
      type: "list"
    });
  }
  
  // 4. Rengøringslog (hvis cleaning/hygiene hazards)
  if (hasCleaningHazards) {
    const relatedHazards = hazards.filter(h => h.formType === "cleaning" || h.formType === "hygiene");
    addRequirement({
      id: "doc_cleaning_log",
      title: "Rengøringslog",
      description: "Dokumentation af daglig og periodisk rengøring med ansvarlig og tidspunkt",
      appliesTo: relatedHazards.map(h => h.id),
      type: "log"
    });
  }
  
  // 5. Afvigelseslog (hvis CCP hazards)
  if (hasCCPHazards) {
    const relatedHazards = hazards.filter(h => h.isCCP);
    addRequirement({
      id: "doc_deviation_log",
      title: "Afvigelseslog",
      description: "Registrering af alle afvigelser fra kritiske grænser med korrigerende handlinger",
      appliesTo: relatedHazards.map(h => h.id),
      type: "log"
    });
  }
  
  // 6. Verifikationslog (hvis verification tasks)
  if (verificationTasks.length > 0) {
    addRequirement({
      id: "doc_verification_log",
      title: "Verifikationslog",
      description: "Dokumentation af alle verifikationsaktiviteter med dato, resultat og ansvarlig",
      appliesTo: verificationTasks.map(t => t.id),
      type: "log"
    });
  }
  
  // 7. Allergendokumentation (hvis allergen hazards)
  if (hasAllergenHazards) {
    const relatedHazards = hazards.filter(h => h.hazardType === "allergen");
    addRequirement({
      id: "doc_allergen_documentation",
      title: "Allergendokumentation",
      description: "Komplet allergenliste for alle retter med leverandørdokumentation og opdateringsdato",
      appliesTo: relatedHazards.map(h => h.id),
      type: "list"
    });
  }
  
  // 8. Kalibreringslog (hvis thermometer calibration)
  if (hasThermometerCalibration) {
    addRequirement({
      id: "doc_calibration_log",
      title: "Kalibreringslog",
      description: "Dokumentation af termometerkalibrering med dato, resultat og eventuelle justeringer",
      appliesTo: ["verification_thermometer_calibration"],
      type: "log"
    });
  }
  
  return requirements;
}

/**
 * Build task template fields based on form type
 * @param {string} formType - Form type (temperature, receiving, checklist, hygiene, cleaning)
 * @param {object} hazard - Hazard definition
 * @returns {Array} Array of field definitions
 */
function buildTaskTemplateFields(formType, hazard) {
  const fields = [];
  
  switch (formType) {
    case "temperature":
      fields.push(
        {
          key: "measurement",
          label: "Målt temperatur",
          type: "number",
          required: true,
          unit: "°C"
        },
        {
          key: "comment",
          label: "Kommentar",
          type: "text",
          required: false
        },
        {
          key: "deviationReason",
          label: "Årsag til afvigelse",
          type: "text",
          required: false,
          showOnDeviation: true
        }
      );
      break;
    
    case "receiving":
      fields.push(
        {
          key: "supplier",
          label: "Leverandør",
          type: "text",
          required: true
        },
        {
          key: "status",
          label: "Status",
          type: "select",
          required: true,
          options: ["Godkendt", "Afvist", "Betinget godkendt"]
        },
        {
          key: "comment",
          label: "Kommentar",
          type: "text",
          required: false
        },
        {
          key: "deviationReason",
          label: "Årsag til afvisning",
          type: "text",
          required: false,
          showOnDeviation: true
        }
      );
      break;
    
    case "checklist":
      fields.push(
        {
          key: "completed",
          label: "Udført",
          type: "boolean",
          required: true
        },
        {
          key: "comment",
          label: "Kommentar",
          type: "text",
          required: false
        },
        {
          key: "deviationReason",
          label: "Årsag til afvigelse",
          type: "text",
          required: false,
          showOnDeviation: true
        }
      );
      break;
    
    case "hygiene":
      fields.push(
        {
          key: "completed",
          label: "Kontrol udført",
          type: "boolean",
          required: true
        },
        {
          key: "comment",
          label: "Kommentar",
          type: "text",
          required: false
        },
        {
          key: "deviationReason",
          label: "Årsag til afvigelse",
          type: "text",
          required: false,
          showOnDeviation: true
        }
      );
      break;
    
    case "cleaning":
      fields.push(
        {
          key: "completed",
          label: "Rengøring udført",
          type: "boolean",
          required: true
        },
        {
          key: "comment",
          label: "Kommentar",
          type: "text",
          required: false
        },
        {
          key: "deviationReason",
          label: "Årsag til afvigelse",
          type: "text",
          required: false,
          showOnDeviation: true
        }
      );
      break;
    
    default:
      fields.push(
        {
          key: "completed",
          label: "Udført",
          type: "boolean",
          required: true
        },
        {
          key: "comment",
          label: "Kommentar",
          type: "text",
          required: false
        }
      );
  }
  
  return fields;
}

/**
 * Build alert rules based on form type and critical limits
 * @param {string} formType - Form type
 * @param {object} hazard - Hazard definition with criticalLimits
 * @returns {Array} Array of alert rule definitions
 */
function buildTaskTemplateAlertRules(formType, hazard) {
  const alertRules = [];
  
  if (formType === "temperature" && hazard.criticalLimits) {
    const limits = hazard.criticalLimits;
    
    // Max temperature alert
    if (limits.max !== undefined) {
      alertRules.push({
        field: "measurement",
        operator: ">",
        value: limits.max,
        severity: "critical",
        message: `Temperatur over ${limits.max}°C - kritisk grænse overskredet`
      });
    }
    
    // Min temperature alert
    if (limits.min !== undefined) {
      alertRules.push({
        field: "measurement",
        operator: "<",
        value: limits.min,
        severity: "critical",
        message: `Temperatur under ${limits.min}°C - kritisk grænse overskredet`
      });
    }
    
    // Rule-based alert (if no numeric limits)
    if (!limits.max && !limits.min && limits.rule) {
      alertRules.push({
        field: "measurement",
        operator: "custom",
        severity: "warning",
        message: `Kontrollér: ${limits.rule}`
      });
    }
  }
  
  // Receiving status alert
  if (formType === "receiving") {
    alertRules.push({
      field: "status",
      operator: "==",
      value: "Afvist",
      severity: "high",
      message: "Varer afvist - dokumentér årsag og returner til leverandør"
    });
  }
  
  // Checklist/hygiene/cleaning completion alert
  if (["checklist", "hygiene", "cleaning"].includes(formType)) {
    alertRules.push({
      field: "completed",
      operator: "==",
      value: false,
      severity: "warning",
      message: "Kontrol ikke udført - angiv årsag"
    });
  }
  
  return alertRules;
}

/**
 * Build short operational description for task templates
 * Returns concise action-oriented text instead of long risk analysis explanations
 * @param {object} hazard - Hazard object with processKey and formType
 * @returns {string} Short operational description
 */
function buildShortOperationalDescription(hazard) {
  // Map processKey to short operational descriptions
  const descriptionMap = {
    storage_chilled: "Kontroller og registrer temperatur",
    storage_frozen: "Kontroller og registrer temperatur",
    walk_in_cold_storage: "Kontroller og registrer temperatur",
    walk_in_frozen_storage: "Kontroller og registrer temperatur",
    hot_preparation: "Kontroller kernetemperatur ved tilberedning",
    hot_holding: "Kontroller temperatur over 65°C",
    cooling: "Kontroller nedkøling indenfor 3 timer",
    receiving_chilled_goods: "Kontroller temperatur, emballage og holdbarhed",
    receiving_frozen_goods: "Kontroller temperatur, emballage og holdbarhed",
    receiving_room_temp_goods: "Kontroller emballage og holdbarhed",
    allergen_handling: "Kontroller adskillelse og mærkning af allergener",
    allergen_information: "Kontroller allergeninformation til kunder",
    personal_hygiene_station: "Kontroller håndvask og personlig hygiejne",
    dishwashing: "Kontroller opvasketemperatur",
    cleaning: "Kontroller at overflader og udstyr er rene",
    packaging: "Kontroller korrekt pakning og mærkning",
    hot_transport: "Kontroller temperatur ved transport",
    chilled_transport: "Kontroller temperatur ved transport",
    frozen_transport: "Kontroller temperatur ved transport"
  };
  
  // Return mapped description or generic fallback
  if (hazard.processKey && descriptionMap[hazard.processKey]) {
    return descriptionMap[hazard.processKey];
  }
  
  // Fallback based on formType
  if (hazard.formType === "temperature") {
    return "Kontroller og registrer temperatur";
  } else if (hazard.formType === "checklist") {
    return "Udfør kontrol og registrer resultat";
  } else if (hazard.formType === "cleaning") {
    return "Kontroller rengøring";
  }
  
  // Final fallback
  return "Udfør kontrol";
}

/**
 * Build task templates from risk analysis
 * Converts hazards and verification tasks to Firestore-ready templates
 * Aggregates related hazards to reduce operational templates to 8-15
 * @param {object} riskAnalysis - Risk analysis with hazards and verificationTasks
 * @returns {Array} Array of task template objects
 */
function buildTaskTemplatesFromRiskAnalysis(riskAnalysis) {
  const templates = [];
  const templateIds = new Set();
  const { hazards = [], verificationTasks = [] } = riskAnalysis;
  
  // Aggregation map: combine related hazards into single operational templates
  const aggregationMap = {
    // All receiving processes → 1 template
    receiving: ['receiving_chilled_goods', 'receiving_frozen_goods', 'receiving_room_temp_goods'],
    // All chilled storage → 1 template
    storage_chilled: ['storage_chilled', 'walk_in_cold_storage'],
    // All frozen storage → 1 template
    storage_frozen: ['storage_frozen', 'walk_in_frozen_storage'],
    // All allergen processes → 1 template
    allergen: ['allergen_handling', 'allergen_information'],
    // All transport → 1 template per type
    transport_hot: ['hot_transport'],
    transport_chilled: ['chilled_transport'],
    transport_frozen: ['frozen_transport']
  };
  
  // Group hazards by aggregation key
  const hazardGroups = {};
  const standaloneHazards = [];
  
  hazards.forEach(hazard => {
    let grouped = false;
    
    for (const [aggKey, processKeys] of Object.entries(aggregationMap)) {
      if (processKeys.includes(hazard.processKey)) {
        if (!hazardGroups[aggKey]) {
          hazardGroups[aggKey] = [];
        }
        hazardGroups[aggKey].push(hazard);
        grouped = true;
        break;
      }
    }
    
    if (!grouped) {
      standaloneHazards.push(hazard);
    }
  });
  
  // Create aggregated operational templates
  Object.entries(hazardGroups).forEach(([aggKey, groupHazards]) => {
    if (groupHazards.length === 0) return;
    
    // Use first hazard as base, but aggregate title
    const baseHazard = groupHazards[0];
    const templateId = `template_agg_${aggKey}`;
    
    const aggregatedTitles = {
      receiving: "Modtagekontrol af varer",
      storage_chilled: "Temperaturkontrol af køl",
      storage_frozen: "Temperaturkontrol af frost",
      allergen: "Kontrol af allergenhåndtering",
      transport_hot: "Temperaturkontrol ved varm transport",
      transport_chilled: "Temperaturkontrol ved køletransport",
      transport_frozen: "Temperaturkontrol ved frysetransport"
    };
    
    const fields = buildTaskTemplateFields(baseHazard.formType, baseHazard);
    const alertRules = buildTaskTemplateAlertRules(baseHazard.formType, baseHazard);
    
    // Build short operational description for aggregated template
    const aggregatedDescriptions = {
      receiving: "Kontroller temperatur, emballage og holdbarhed",
      storage_chilled: "Kontroller og registrer temperatur",
      storage_frozen: "Kontroller og registrer temperatur",
      allergen: "Kontroller adskillelse og mærkning af allergener",
      transport_hot: "Kontroller temperatur ved transport",
      transport_chilled: "Kontroller temperatur ved transport",
      transport_frozen: "Kontroller temperatur ved transport"
    };
    
    templates.push({
      id: templateId,
      title: aggregatedTitles[aggKey] || baseHazard.title,
      description: aggregatedDescriptions[aggKey] || buildShortOperationalDescription(baseHazard),
      category: baseHazard.category,
      formType: baseHazard.formType,
      riskLevel: groupHazards.some(h => h.riskLevel === 'critical') ? 'critical' : baseHazard.riskLevel,
      isCCP: groupHazards.some(h => h.isCCP),
      controlPoint: baseHazard.controlMeasure || "",
      controlPointType: baseHazard.controlPointType,
      sourceHazardId: groupHazards.map(h => h.id).join(','),
      sourceHazard: aggregatedTitles[aggKey] || baseHazard.title,
      sourceProcessKey: groupHazards.map(h => h.processKey).join(','),
      criticalLimits: baseHazard.criticalLimits,
      procedure: baseHazard.procedure,
      deviationActions: baseHazard.correctiveActions,
      frequency: baseHazard.monitoring.frequency,
      frequencyType: baseHazard.monitoring.frequencyType,
      frequencyDays: baseHazard.monitoring.frequencyDays,
      registrationFrequency: baseHazard.monitoring.frequency,
      registrationFrequencyType: baseHazard.monitoring.frequencyType,
      registrationFrequencyDays: baseHazard.monitoring.frequencyDays,
      fields: fields,
      alertRules: alertRules,
      sourceType: "hazard",
      templateType: "operational",
      active: true,
      isActive: true,
      relatedHazardIds: groupHazards.map(h => h.id)
    });
  });
  
  // Convert standalone hazards to operational templates
  standaloneHazards.forEach(hazard => {
    const templateId = `template_${hazard.id}`;
    
    // Skip if duplicate
    if (templateIds.has(templateId)) {
      return;
    }
    templateIds.add(templateId);
    
    const fields = buildTaskTemplateFields(hazard.formType, hazard);
    const alertRules = buildTaskTemplateAlertRules(hazard.formType, hazard);
    
    // Build professional title based on process
    let title = hazard.title;
    if (hazard.processKey) {
      const processMap = {
        storage_chilled: "Temperaturkontrol af køleskab",
        storage_frozen: "Temperaturkontrol af fryser",
        walk_in_cold_storage: "Temperaturkontrol af kølerum",
        walk_in_frozen_storage: "Temperaturkontrol af fryserum",
        hot_preparation: "Kernetemperaturkontrol ved tilberedning",
        hot_holding: "Temperaturkontrol ved varmholdelse",
        cooling: "Kontrol af nedkøling",
        receiving_chilled_goods: "Modtagekontrol af kølevarer",
        receiving_frozen_goods: "Modtagekontrol af frostvarer",
        receiving_room_temp_goods: "Modtagekontrol af tørvarer",
        allergen_handling: "Kontrol af allergenhåndtering",
        allergen_information: "Kontrol af allergeninformation",
        personal_hygiene_station: "Kontrol af personlig hygiejne",
        dishwashing: "Kontrol af opvasketemperatur",
        cleaning: "Rengøringskontrol",
        packaging: "Kontrol af pakning",
        hot_transport: "Temperaturkontrol ved varm transport",
        chilled_transport: "Temperaturkontrol ved køletransport",
        frozen_transport: "Temperaturkontrol ved frysetransport"
      };
      
      if (processMap[hazard.processKey]) {
        title = processMap[hazard.processKey];
      }
    }
    
    // Build short operational description instead of long risk analysis text
    const operationalDescription = buildShortOperationalDescription(hazard);
    
    templates.push({
      id: templateId,
      title: title,
      description: operationalDescription,
      category: hazard.category,
      formType: hazard.formType,
      riskLevel: hazard.riskLevel,
      isCCP: hazard.isCCP,
      controlPoint: hazard.controlMeasure || "",
      controlPointType: hazard.controlPointType,
      sourceHazardId: hazard.id,
      sourceHazard: hazard.title,
      sourceProcessKey: hazard.processKey,
      criticalLimits: hazard.criticalLimits,
      procedure: hazard.procedure,
      deviationActions: hazard.correctiveActions,
      frequency: hazard.monitoring.frequency,
      frequencyType: hazard.monitoring.frequencyType,
      frequencyDays: hazard.monitoring.frequencyDays,
      registrationFrequency: hazard.monitoring.frequency,
      registrationFrequencyType: hazard.monitoring.frequencyType,
      registrationFrequencyDays: hazard.monitoring.frequencyDays,
      fields: fields,
      alertRules: alertRules,
      sourceType: "hazard",
      templateType: "operational",
      active: true,
      isActive: true
    });
  });
  
  // Convert verification tasks to task templates
  verificationTasks.forEach(task => {
    const templateId = `template_${task.id}`;
    
    // Skip if duplicate
    if (templateIds.has(templateId)) {
      return;
    }
    templateIds.add(templateId);
    
    const fields = buildTaskTemplateFields("checklist", {});
    const alertRules = buildTaskTemplateAlertRules("checklist", {});
    
    // Use short operational description for verification tasks
    const verificationDescription = task.description && task.description.length < 100 
      ? task.description 
      : "Udfør verifikation og registrer resultat";
    
    templates.push({
      id: templateId,
      title: task.title,
      description: verificationDescription,
      category: task.category,
      formType: task.formType,
      riskLevel: "medium",
      isCCP: false,
      controlPoint: "Verifikation",
      controlPointType: "verification",
      sourceHazardId: null,
      sourceHazard: null,
      sourceProcessKey: null,
      criticalLimits: {},
      procedure: task.procedure,
      deviationActions: task.deviationActions,
      frequency: task.frequency,
      frequencyType: task.frequencyType,
      frequencyDays: task.frequencyDays,
      registrationFrequency: task.frequency,
      registrationFrequencyType: task.frequencyType,
      registrationFrequencyDays: task.frequencyDays,
      fields: fields,
      alertRules: alertRules,
      sourceType: "verification",
      templateType: "verification",
      relatedProcessKeys: task.relatedProcessKeys,
      relatedHazardIds: task.relatedHazardIds,
      active: true,
      isActive: true
    });
  });
  
  return templates;
}

/**
 * Generate hazards from MIKROBIOLOGISKE_FARER_CCP and MIKROBIOLOGISKE_FARER_GAG
 * @param {object} profile - User profile
 * @returns {Array} Array of hazard objects
 */
function generateHazardsFromRisikoanalyse(profile) {
  // TRACE LOGGING - PROBLEM B
  console.log(`[generateHazardsFromRisikoanalyse] START: MIKROBIOLOGISKE_FARER_CCP keys=${Object.keys(MIKROBIOLOGISKE_FARER_CCP).length}, MIKROBIOLOGISKE_FARER_GAG keys=${Object.keys(MIKROBIOLOGISKE_FARER_GAG).length}`);
  
  const hazards = [];
  
  // Add all 6 CCPs
  let ccpCount = 0;
  Object.entries(MIKROBIOLOGISKE_FARER_CCP).forEach(([key, ccp]) => {
    ccpCount++;
    hazards.push({
      id: `ccp_${ccp.ccpNumber}_${key}`,
      processKey: key,
      title: ccp.title,
      description: ccp.forklaring || ccp.title,
      hazardType: "biological",
      riskLevel: "critical",
      isCCP: true,
      ccpNumber: ccp.ccpNumber,
      controlPointType: "CCP",
      controlMeasure: ccp.kontroller || "",
      criticalLimits: ccp.criticalLimits || {},
      monitoring: {
        frequency: "daily",
        frequencyType: "daily",
        frequencyDays: 1,
        method: ccp.kontroller || "",
        responsibleRole: "Ansvarlig medarbejder"
      },
      procedure: [],
      correctiveActions: [],
      verification: [],
      documentation: [],
      formType: key.includes('modtagelse') ? 'receiving' : key.includes('koel_frost') ? 'temperature' : 'checklist',
      category: 'mikrobiologisk',
      sourceFields: []
    });
  });
  
  console.log(`[generateHazardsFromRisikoanalyse] Added ${ccpCount} CCP hazards`);
  
  // Add all 46 GAGs
  let gagCount = 0;
  Object.entries(MIKROBIOLOGISKE_FARER_GAG).forEach(([key, gag]) => {
    gagCount++;
    hazards.push({
      id: `gag_${key}`,
      processKey: key,
      title: gag.title,
      description: gag.forklaring || gag.title,
      hazardType: "biological",
      riskLevel: "medium",
      isCCP: false,
      controlPointType: "CP",
      controlMeasure: gag.kontroller || "",
      criticalLimits: {},
      monitoring: {
        frequency: "daily",
        frequencyType: "daily",
        frequencyDays: 1,
        method: gag.kontroller || "",
        responsibleRole: "Ansvarlig medarbejder"
      },
      procedure: [],
      correctiveActions: [],
      verification: [],
      documentation: [],
      formType: 'checklist',
      category: 'mikrobiologisk',
      sourceFields: []
    });
  });
  
  console.log(`[generateHazardsFromRisikoanalyse] Added ${gagCount} GAG hazards`);
  console.log(`[generateHazardsFromRisikoanalyse] TOTAL: ${hazards.length} hazards (${hazards.filter(h => h.isCCP).length} CCPs, ${hazards.filter(h => !h.isCCP).length} GAGs)`);
  
  return hazards;
}

// Export functions for use in index.js
module.exports = {
  generateScenarioBasedHaccp,
  generateProcessesFromProfile,
  generateHazardsFromProcesses,
  generateHazardsFromRisikoanalyse,
  buildTaskTemplatesFromRiskAnalysis
};
