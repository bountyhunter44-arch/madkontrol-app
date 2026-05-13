const businessTypes = {
  restaurant: {
    key: "restaurant",
    label: "Restaurant",
    defaultAreaTypes: ["kitchen", "receiving", "cold_storage", "freezer_storage", "dishwashing"],
    defaultEquipmentTypes: ["fridge", "freezer", "handwash_sink"],
    defaultActivities: ["hot_production", "cold_production", "cleaning_between_workflows"],
    defaultRiskTags: ["cross_contamination", "temperature_control", "cleaning"]
  },

  bakery: {
    key: "bakery",
    label: "Bageri",
    defaultAreaTypes: ["bakery_production", "receiving", "cold_storage", "dry_storage", "dishwashing"],
    defaultEquipmentTypes: ["fridge", "freezer", "mixer", "oven"],
    defaultActivities: ["dough_handling", "cleaning_between_workflows"],
    defaultRiskTags: ["cross_contamination", "cleaning", "allergen_control"]
  },

  fish_shop: {
    key: "fish_shop",
    label: "Fiskebutik",
    defaultAreaTypes: ["fish_counter", "cutting_area", "receiving", "cold_storage", "cleaning_station"],
    defaultEquipmentTypes: ["fridge", "ice_machine", "display_cooler", "handwash_sink"],
    defaultActivities: ["fish_handling", "raw_to_ready_separation", "cleaning_between_workflows"],
    defaultRiskTags: ["fish_hygiene", "temperature_control", "cross_contamination", "cleaning"]
  },

  institution: {
    key: "institution",
    label: "Institution",
    defaultAreaTypes: ["kitchen", "serving_area", "receiving", "cold_storage", "dishwashing"],
    defaultEquipmentTypes: ["fridge", "freezer", "handwash_sink"],
    defaultActivities: ["hot_production", "cold_production", "allergen_handling"],
    defaultRiskTags: ["temperature_control", "allergen_control", "cleaning"]
  },

  school: {
    key: "school",
    label: "Skole",
    defaultAreaTypes: ["kitchen", "serving_area", "receiving", "cold_storage", "dishwashing"],
    defaultEquipmentTypes: ["fridge", "freezer", "handwash_sink"],
    defaultActivities: ["hot_production", "cold_production", "allergen_handling"],
    defaultRiskTags: ["temperature_control", "allergen_control", "cleaning"]
  },

  cafe: {
    key: "cafe",
    label: "Café",
    defaultAreaTypes: ["kitchen", "serving_area", "receiving", "cold_storage"],
    defaultEquipmentTypes: ["fridge", "freezer", "ice_machine", "coffee_machine"],
    defaultActivities: ["cold_production", "hot_production", "cleaning_between_workflows"],
    defaultRiskTags: ["temperature_control", "cleaning", "cross_contamination"]
  }
};

module.exports = {
  businessTypes
};
