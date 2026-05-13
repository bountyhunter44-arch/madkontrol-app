const areaTypes = {
  kitchen: {
    key: "kitchen",
    label: "Køkken",
    controlTags: ["cleaning", "cross_contamination", "workflow_hygiene"]
  },

  cutting_area: {
    key: "cutting_area",
    label: "Opskæringsområde",
    controlTags: ["cross_contamination", "board_change", "workflow_hygiene", "cleaning_between_workflows"]
  },

  fish_counter: {
    key: "fish_counter",
    label: "Fiskedisk",
    controlTags: ["fish_hygiene", "temperature_control", "cleaning"]
  },

  bakery_production: {
    key: "bakery_production",
    label: "Bageriområde",
    controlTags: ["cleaning", "allergen_control", "workflow_hygiene"]
  },

  serving_area: {
    key: "serving_area",
    label: "Serveringsområde",
    controlTags: ["cleaning", "hot_holding", "cross_contamination"]
  },

  receiving: {
    key: "receiving",
    label: "Modtagelse",
    controlTags: ["goods_receiving", "temperature_control"]
  },

  cold_storage: {
    key: "cold_storage",
    label: "Kølerum",
    controlTags: ["temperature_control", "storage_rules"]
  },

  freezer_storage: {
    key: "freezer_storage",
    label: "Fryser",
    controlTags: ["temperature_control", "storage_rules"]
  },

  dry_storage: {
    key: "dry_storage",
    label: "Tørlager",
    controlTags: ["storage_rules", "cleaning"]
  },

  dishwashing: {
    key: "dishwashing",
    label: "Opvask",
    controlTags: ["cleaning"]
  },

  cleaning_station: {
    key: "cleaning_station",
    label: "Rengøringsområde",
    controlTags: ["cleaning"]
  }
};

module.exports = {
  areaTypes
};
