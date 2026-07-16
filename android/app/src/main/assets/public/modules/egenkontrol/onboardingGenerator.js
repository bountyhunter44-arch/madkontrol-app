
import {
  PRODUCT_PRESETS,
  DEFAULT_LIMITS
} from "./onboardingPresets.js";

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "oe")
    .replace(/[å]/g, "aa")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function generateProductsFromBusinessType(businessType) {
  return [...(PRODUCT_PRESETS[businessType] || [])];
}

export function generateEquipmentUnits(equipment = {}) {
  const units = [];

  for (let i = 1; i <= Number(equipment.fridges || 0); i += 1) {
    units.push({
      key: `fridge_${i}`,
      type: "fridge",
      name: `Køleskab ${i}`,
      limitMax: DEFAULT_LIMITS.fridgeMaxTemp,
      measurementUnit: "C",
      cameraEnabled: true
    });
  }

  for (let i = 1; i <= Number(equipment.freezers || 0); i += 1) {
    units.push({
      key: `freezer_${i}`,
      type: "freezer",
      name: `Fryser ${i}`,
      limitMax: DEFAULT_LIMITS.freezerMaxTemp,
      measurementUnit: "C",
      cameraEnabled: true
    });
  }

  if (equipment.hasWalkInFridge) {
    units.push({
      key: "walkin_fridge_1",
      type: "walk_in_fridge",
      name: "Walk-in køler",
      limitMax: DEFAULT_LIMITS.fridgeMaxTemp,
      measurementUnit: "C",
      cameraEnabled: true
    });
  }

  if (equipment.hasWalkInFreezer) {
    units.push({
      key: "walkin_freezer_1",
      type: "walk_in_freezer",
      name: "Walk-in fryser",
      limitMax: DEFAULT_LIMITS.freezerMaxTemp,
      measurementUnit: "C",
      cameraEnabled: true
    });
  }

  return units;
}

export function buildRiskProfile(onboarding) {
  const businessType = onboarding?.business?.type || "";
  const products = onboarding?.products?.selected || [];
  const allergens = onboarding?.allergens?.enabled || [];
  const equipment = onboarding?.equipment || {};

  return {
    businessType,
    products,
    allergens,
    equipment,
    hasImportedGoods: Boolean(onboarding?.receiving?.fromAbroad),
    hasAnimalProducts: Boolean(onboarding?.receiving?.animalProducts),
    hasChilledGoods: Boolean(onboarding?.receiving?.chilledGoods),
    hasFrozenGoods: Boolean(onboarding?.receiving?.frozenGoods),
    generatedAt: new Date().toISOString()
  };
}

export function buildRiskAnalysisDraft(onboarding) {
  const companyId = onboarding?.meta?.companyId || "company_1";
  const locationId = onboarding?.meta?.locationId || "location_1";
  const businessType = onboarding?.business?.type || "";
  const products = onboarding?.products?.selected || [];
  const allergens = onboarding?.allergens?.enabled || [];
  const equipment = onboarding?.equipment || {};

  const hazards = [];

  if ((equipment.fridges || 0) > 0 || equipment.hasWalkInFridge) {
    hazards.push({
      key: "store_chilled_goods",
      title: "Køleopbevaring",
      hazardType: "temperature",
      riskLevel: "high",
      limitMax: DEFAULT_LIMITS.fridgeMaxTemp,
      limitUnit: "C",
      isCCP: true
    });
  }

  if ((equipment.freezers || 0) > 0 || equipment.hasWalkInFreezer) {
    hazards.push({
      key: "store_frozen_goods",
      title: "Fryseopbevaring",
      hazardType: "temperature",
      riskLevel: "high",
      limitMax: DEFAULT_LIMITS.freezerMaxTemp,
      limitUnit: "C",
      isCCP: true
    });
  }

  if (equipment.hasHotHolding) {
    hazards.push({
      key: "hot_hold_food",
      title: "Varmholdelse",
      hazardType: "temperature",
      riskLevel: "high",
      limitMin: DEFAULT_LIMITS.hotHoldingMinTemp,
      limitUnit: "C",
      isCCP: true
    });
  }

  if (equipment.hasReheating) {
    hazards.push({
      key: "reheat_food",
      title: "Genopvarmning",
      hazardType: "temperature",
      riskLevel: "high",
      limitMin: DEFAULT_LIMITS.reheatingMinTemp,
      limitUnit: "C",
      isCCP: true
    });
  }

  if (equipment.hasCoolingProcess) {
    hazards.push({
      key: "cool_food",
      title: "Nedkøling af fødevarer",
      hazardType: "temperature",
      riskLevel: "high",
      limitMax: DEFAULT_LIMITS.coolingMaxTemp,
      limitUnit: "C",
      isCCP: true
    });
  }

  if (equipment.hasReceivingArea) {
    hazards.push({
      key: "receiving_goods",
      title: "Varemodtagelse",
      hazardType: "receiving",
      riskLevel: "medium",
      isCCP: false
    });
  }

  if (equipment.hasAllergenSeparation || allergens.length) {
    hazards.push({
      key: "allergen_handling",
      title: "Allergener og krydskontaminering",
      hazardType: "allergen",
      riskLevel: "high",
      isCCP: false
    });
  }

  return {
    companyId,
    locationId,
    source: "onboarding",
    businessType,
    products,
    allergens,
    hazards,
    equipment,
    createdAt: new Date().toISOString()
  };
}

export function buildTaskTemplatesFromOnboarding(onboarding) {
  const companyId = onboarding?.meta?.companyId || "company_1";
  const locationId = onboarding?.meta?.locationId || "location_1";
  const units = generateEquipmentUnits(onboarding?.equipment || {});
  const templates = [];

  units.forEach((unit) => {
    if (unit.type === "fridge" || unit.type === "walk_in_fridge") {
      templates.push({
        companyId,
        locationId,
        title: `Temperaturkontrol ${unit.name.toLowerCase()}`,
        area: unit.name,
        category: "Temperatur",
        controlType: "fridge_temperature",
        guideKey: "fridge_temperature",
        frequency: "daily",
        linkedUnitKey: unit.key,
        measurementUnit: "C",
        limitMax: unit.limitMax,
        cameraEnabled: true,
        quickActions: ["ok", "deviation", "not_in_use"]
      });
    }

    if (unit.type === "freezer" || unit.type === "walk_in_freezer") {
      templates.push({
        companyId,
        locationId,
        title: `Temperaturkontrol ${unit.name.toLowerCase()}`,
        area: unit.name,
        category: "Temperatur",
        controlType: "freezer_temperature",
        guideKey: "freezer_temperature",
        frequency: "daily",
        linkedUnitKey: unit.key,
        measurementUnit: "C",
        limitMax: unit.limitMax,
        cameraEnabled: true,
        quickActions: ["ok", "deviation", "not_in_use"]
      });
    }
  });

  if (onboarding?.equipment?.hasReceivingArea) {
    templates.push({
      companyId,
      locationId,
      title: "Varemodtagelse",
      area: "Modtagelse",
      category: "Modtagekontrol",
      controlType: "receiving_goods",
      guideKey: "receiving_goods",
      frequency: "daily",
      cameraEnabled: true,
      quickActions: ["ok", "deviation", "not_in_use"]
    });
  }

  if (onboarding?.equipment?.hasAllergenSeparation) {
    templates.push({
      companyId,
      locationId,
      title: "Adskillelse og krydskontaminering",
      area: "Produktion",
      category: "Adskillelse",
      controlType: "cross_contamination",
      guideKey: "cross_contamination",
      frequency: "daily",
      cameraEnabled: true,
      quickActions: ["ok", "deviation", "not_in_use"]
    });
  }

  templates.push({
    companyId,
    locationId,
    title: "Dato-kontrol af opbevarede fødevarer",
    area: "Lager / køl",
    category: "Datokontrol",
    controlType: "date_control",
    guideKey: "date_control",
    frequency: "daily",
    cameraEnabled: true,
    quickActions: ["ok", "deviation", "not_in_use"]
  });

  templates.push({
    companyId,
    locationId,
    title: "Rengøringskontrol",
    area: "Køkken",
    category: "Rengøring",
    controlType: "cleaning_control",
    guideKey: "cleaning_control",
    frequency: "daily",
    cameraEnabled: true,
    quickActions: ["ok", "deviation", "not_in_use"]
  });

  if (onboarding?.equipment?.hasDishwasher) {
    templates.push({
      companyId,
      locationId,
      title: "Kontrol af opvaskemaskine",
      area: "Opvask",
      category: "Maskiner",
      controlType: "dishwasher_control",
      guideKey: "dishwasher_control",
      frequency: "daily",
      cameraEnabled: true,
      quickActions: ["ok", "deviation", "not_in_use"]
    });
  }

  if (onboarding?.equipment?.hasIceMachine) {
    templates.push({
      companyId,
      locationId,
      title: "Kontrol af isterningemaskine",
      area: "Køkken",
      category: "Maskiner",
      controlType: "ice_machine_control",
      guideKey: "ice_machine_control",
      frequency: "daily",
      cameraEnabled: true,
      quickActions: ["ok", "deviation", "not_in_use"]
    });
  }

  if (onboarding?.equipment?.hasSoftIceMachine) {
    templates.push({
      companyId,
      locationId,
      title: "Kontrol af softicemaskine",
      area: "Servering",
      category: "Maskiner",
      controlType: "softice_machine_control",
      guideKey: "softice_machine_control",
      frequency: "daily",
      cameraEnabled: true,
      quickActions: ["ok", "deviation", "not_in_use"]
    });
  }

  if (onboarding?.equipment?.hasHotHolding) {
    templates.push({
      companyId,
      locationId,
      title: "Temperaturkontrol ved varmholdelse",
      area: "Produktion",
      category: "Temperatur",
      controlType: "hot_holding_temperature",
      guideKey: "hot_holding_temperature",
      frequency: "daily",
      measurementUnit: "C",
      limitMin: DEFAULT_LIMITS.hotHoldingMinTemp,
      cameraEnabled: true,
      quickActions: ["ok", "deviation", "not_in_use"]
    });
  }

  if (onboarding?.equipment?.hasReheating) {
    templates.push({
      companyId,
      locationId,
      title: "Genopvarmning af fødevarer",
      area: "Produktion",
      category: "Temperatur",
      controlType: "reheating_temperature",
      guideKey: "reheating_temperature",
      frequency: "daily",
      measurementUnit: "C",
      limitMin: DEFAULT_LIMITS.reheatingMinTemp,
      cameraEnabled: true,
      quickActions: ["ok", "deviation", "not_in_use"]
    });
  }

  if (onboarding?.equipment?.hasCoolingProcess) {
    templates.push({
      companyId,
      locationId,
      title: "Nedkøling af fødevarer",
      area: "Produktion",
      category: "Temperatur",
      controlType: "cooling_temperature",
      guideKey: "cooling_temperature",
      frequency: "daily",
      measurementUnit: "C",
      limitMax: DEFAULT_LIMITS.coolingMaxTemp,
      cameraEnabled: true,
      quickActions: ["ok", "deviation", "not_in_use"]
    });
  }

  return templates.map((template) => ({
    ...template,
    slug: slugify(`${template.controlType}_${template.title}_${template.area}`)
  }));
}

export function buildOnboardingPayload(formState) {
  const businessType = formState.business?.type || formState.company?.businessType || "";
  const sel = formState.equipment?.selected || {};
  const qty = (key) => Number((sel[key] || {}).quantity || 0);
  const has = (key) => Boolean((sel[key] || {}).enabled) && qty(key) > 0;
  const pt = formState.business?.productionTypes || [];
  const inc = (s) => pt.some((t) => t.toLowerCase().includes(s.toLowerCase()));

  const generatedProducts = generateProductsFromBusinessType(businessType);
  const selectedProducts = formState.business?.products?.length
    ? formState.business.products
    : generatedProducts;

  return {
    company: {
      cvr: formState.company?.cvr || "",
      name: formState.company?.name || "",
      address: formState.company?.address || "",
      postalCode: formState.company?.zip || "",
      city: formState.company?.city || "",
      contactName: formState.company?.leader || "",
      email: formState.company?.email || "",
      phone: formState.company?.phone || ""
    },
    business: {
      type: businessType,
      unitName: formState.company?.name || "",
      concept: ""
    },
    products: {
      generated: generatedProducts,
      selected: selectedProducts,
      custom: []
    },
    equipment: {
      fridges: qty("fridges"),
      freezers: qty("freezers"),
      hasWalkInFridge: has("walkInCoolers"),
      hasWalkInFreezer: has("walkInFreezers"),
      hasDishwasher: has("dishwashers"),
      hasIceMachine: has("iceMachines"),
      hasSoftIceMachine: false,
      hasHotHolding: has("hotHoldingUnits"),
      hasCoolingProcess: has("coolingUnits"),
      hasReheating: has("reheatingUnits"),
      hasReceivingArea: inc("Varemodtagelse") || inc("Vare modtagelse"),
      hasCuttingArea: inc("Opskæring") || inc("Skæring"),
      hasAllergenSeparation: inc("Adskillelse") || inc("allergen"),
      hasDryStorage: true,
      hasFishHandling: inc("Fisk"),
      hasBakeryArea: inc("Bageri") || inc("Brød")
    },
    allergens: {
      enabled: [],
      notes: formState.business?.allergenHandling || ""
    },
    receiving: {
      fromDenmark: !formState.business?.importFromAbroad,
      fromAbroad: Boolean(formState.business?.importFromAbroad),
      chilledGoods: has("fridges") || has("walkInCoolers"),
      frozenGoods: has("freezers") || has("walkInFreezers"),
      animalProducts: inc("Kød") || inc("Fisk") || inc("Fjerkræ")
    },
    defaults: {
      ...DEFAULT_LIMITS,
      cameraEnabled: true
    },
    meta: {
      companyId: "company_1",
      locationId: "location_1",
      createdBy: "anonymous",
      createdByName: ""
    }
  };
}
