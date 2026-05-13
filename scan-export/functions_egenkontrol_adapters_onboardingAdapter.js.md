# FILE: functions/egenkontrol/adapters/onboardingAdapter.js

```javascript
/**
 * Onboarding Adapter
 * Maps existing onboarding/risk analysis data to new modular profile format
 */

function mapLegacyBusinessTypeToKey(legacyType) {
  const mapping = {
    "restaurant": "restaurant",
    "cafe": "cafe",
    "café": "cafe",
    "bakery": "bakery",
    "bageri": "bakery",
    "fish_shop": "fish_shop",
    "fiskebutik": "fish_shop",
    "institution": "institution",
    "school": "school",
    "skole": "school"
  };

  const normalized = String(legacyType || "").toLowerCase().trim();
  return mapping[normalized] || null;
}

function mapLegacyEquipmentToKeys(legacyEquipment = []) {
  const mapping = {
    "køleskab": "fridge",
    "fridge": "fridge",
    "køl": "fridge",
    "fryser": "freezer",
    "freezer": "freezer",
    "frost": "freezer",
    "walk-in køler": "walk_in_cooler",
    "walk_in_cooler": "walk_in_cooler",
    "displaykøler": "display_cooler",
    "display_cooler": "display_cooler",
    "ismaskine": "ice_machine",
    "ice_machine": "ice_machine",
    "softicemaskine": "soft_ice_machine",
    "soft_ice_machine": "soft_ice_machine",
    "håndvask": "handwash_sink",
    "handwash": "handwash_sink",
    "ovn": "oven",
    "oven": "oven",
    "mixer": "mixer",
    "kaffemaskine": "coffee_machine",
    "coffee_machine": "coffee_machine"
  };

  const equipmentKeys = [];
  for (const item of legacyEquipment) {
    const normalized = String(item || "").toLowerCase().trim();
    const key = mapping[normalized];
    if (key && !equipmentKeys.includes(key)) {
      equipmentKeys.push(key);
    }
  }

  return equipmentKeys;
}

function mapLegacyAreasToKeys(legacyAreas = []) {
  const mapping = {
    "køkken": "kitchen",
    "kitchen": "kitchen",
    "opskæringsområde": "cutting_area",
    "cutting_area": "cutting_area",
    "fiskedisk": "fish_counter",
    "fish_counter": "fish_counter",
    "bageriområde": "bakery_production",
    "bakery_production": "bakery_production",
    "serveringsområde": "serving_area",
    "serving_area": "serving_area",
    "modtagelse": "receiving",
    "receiving": "receiving",
    "kølerum": "cold_storage",
    "cold_storage": "cold_storage",
    "fryserum": "freezer_storage",
    "freezer_storage": "freezer_storage",
    "tørlager": "dry_storage",
    "dry_storage": "dry_storage",
    "opvask": "dishwashing",
    "dishwashing": "dishwashing",
    "rengøringsområde": "cleaning_station",
    "cleaning_station": "cleaning_station"
  };

  const areaKeys = [];
  for (const item of legacyAreas) {
    const normalized = String(item || "").toLowerCase().trim();
    const key = mapping[normalized];
    if (key && !areaKeys.includes(key)) {
      areaKeys.push(key);
    }
  }

  return areaKeys;
}

function mapLegacyActivitiesToKeys(legacyActivities = [], legacyRisks = []) {
  const activityMapping = {
    "varm produktion": "hot_production",
    "hot_production": "hot_production",
    "kold produktion": "cold_production",
    "cold_production": "cold_production",
    "fiskhåndtering": "fish_handling",
    "fish_handling": "fish_handling",
    "adskillelse råt/spiseklart": "raw_to_ready_separation",
    "raw_to_ready_separation": "raw_to_ready_separation",
    "skift skærebræt": "board_change_between_tasks",
    "board_change": "board_change_between_tasks",
    "rengøring mellem arbejdsgange": "cleaning_between_workflows",
    "cleaning_between_workflows": "cleaning_between_workflows",
    "allergenhåndtering": "allergen_handling",
    "allergen_handling": "allergen_handling",
    "dejhåndtering": "dough_handling",
    "dough_handling": "dough_handling"
  };

  const activityKeys = [];

  // Map explicit activities
  for (const item of legacyActivities) {
    const normalized = String(item || "").toLowerCase().trim();
    const key = activityMapping[normalized];
    if (key && !activityKeys.includes(key)) {
      activityKeys.push(key);
    }
  }

  // Infer activities from risk tags
  for (const risk of legacyRisks) {
    const normalized = String(risk || "").toLowerCase().trim();
    
    if (normalized.includes("fisk") && !activityKeys.includes("fish_handling")) {
      activityKeys.push("fish_handling");
    }
    if (normalized.includes("krydskontamin") && !activityKeys.includes("raw_to_ready_separation")) {
      activityKeys.push("raw_to_ready_separation");
    }
    if (normalized.includes("allergen") && !activityKeys.includes("allergen_handling")) {
      activityKeys.push("allergen_handling");
    }
    if (normalized.includes("rengøring") && !activityKeys.includes("cleaning_between_workflows")) {
      activityKeys.push("cleaning_between_workflows");
    }
  }

  return activityKeys;
}

function adaptLegacyOnboardingToProfile(legacyData = {}) {
  const businessType = mapLegacyBusinessTypeToKey(
    legacyData.businessType || legacyData.virksomhedstype || legacyData.type
  );

  const equipmentTypes = mapLegacyEquipmentToKeys(
    legacyData.equipment || legacyData.udstyr || []
  );

  const areaTypes = mapLegacyAreasToKeys(
    legacyData.areas || legacyData.områder || []
  );

  const activityTypes = mapLegacyActivitiesToKeys(
    legacyData.activities || legacyData.aktiviteter || [],
    legacyData.risks || legacyData.risici || []
  );

  const riskTags = (legacyData.risks || legacyData.risici || [])
    .map(r => String(r || "").toLowerCase().trim())
    .filter(Boolean);

  return {
    businessType,
    areaTypes,
    equipmentTypes,
    activityTypes,
    riskTags
  };
}

module.exports = {
  adaptLegacyOnboardingToProfile,
  mapLegacyBusinessTypeToKey,
  mapLegacyEquipmentToKeys,
  mapLegacyAreasToKeys,
  mapLegacyActivitiesToKeys
};

```
