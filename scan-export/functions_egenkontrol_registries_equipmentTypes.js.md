# FILE: functions/egenkontrol/registries/equipmentTypes.js

```javascript
const equipmentTypes = {
  fridge: {
    key: "fridge",
    label: "Køleskab",
    controlTags: ["temperature_control", "storage_rules"],
    defaultControlFamilies: ["cold_storage_temperature", "cold_storage_placement"]
  },

  display_cooler: {
    key: "display_cooler",
    label: "Displaykøler",
    controlTags: ["temperature_control", "storage_rules"],
    defaultControlFamilies: ["cold_storage_temperature", "cold_storage_placement"]
  },

  walk_in_cooler: {
    key: "walk_in_cooler",
    label: "Walk-in køler",
    controlTags: ["temperature_control", "storage_rules"],
    defaultControlFamilies: ["walk_in_cooler_temperature", "cold_storage_placement"]
  },

  freezer: {
    key: "freezer",
    label: "Fryser",
    controlTags: ["temperature_control", "storage_rules"],
    defaultControlFamilies: ["frozen_storage_temperature"]
  },

  ice_machine: {
    key: "ice_machine",
    label: "Ismaskine",
    controlTags: ["cleaning", "machine_hygiene"],
    defaultControlFamilies: ["ice_machine_hygiene"]
  },

  soft_ice_machine: {
    key: "soft_ice_machine",
    label: "Softicemaskine",
    controlTags: ["cleaning", "machine_hygiene", "temperature_control"],
    defaultControlFamilies: ["soft_ice_hygiene"]
  },

  handwash_sink: {
    key: "handwash_sink",
    label: "Håndvask",
    controlTags: ["personal_hygiene"],
    defaultControlFamilies: []
  },

  oven: {
    key: "oven",
    label: "Ovn",
    controlTags: ["hot_holding", "heating"],
    defaultControlFamilies: []
  },

  mixer: {
    key: "mixer",
    label: "Mixer",
    controlTags: ["cleaning", "machine_hygiene"],
    defaultControlFamilies: []
  },

  coffee_machine: {
    key: "coffee_machine",
    label: "Kaffemaskine",
    controlTags: ["cleaning", "machine_hygiene"],
    defaultControlFamilies: []
  }
};

module.exports = {
  equipmentTypes
};

```
