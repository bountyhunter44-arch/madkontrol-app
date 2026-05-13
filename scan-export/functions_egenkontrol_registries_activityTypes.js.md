# FILE: functions/egenkontrol/registries/activityTypes.js

```javascript
const activityTypes = {
  hot_production: {
    key: "hot_production",
    label: "Varm produktion",
    controlTags: ["hot_holding", "cleaning", "workflow_hygiene"]
  },

  cold_production: {
    key: "cold_production",
    label: "Kold produktion",
    controlTags: ["cross_contamination", "temperature_control", "workflow_hygiene"]
  },

  fish_handling: {
    key: "fish_handling",
    label: "Håndtering af fisk",
    controlTags: ["fish_hygiene", "temperature_control", "cleaning_between_workflows"]
  },

  raw_to_ready_separation: {
    key: "raw_to_ready_separation",
    label: "Adskillelse mellem råt og spiseklart",
    controlTags: ["cross_contamination", "workflow_hygiene", "board_change"]
  },

  board_change_between_tasks: {
    key: "board_change_between_tasks",
    label: "Skift af skærebræt mellem opgaver",
    controlTags: ["board_change", "workflow_hygiene"]
  },

  cleaning_between_workflows: {
    key: "cleaning_between_workflows",
    label: "Rengøring mellem arbejdsgange",
    controlTags: ["cleaning_between_workflows", "workflow_hygiene"]
  },

  allergen_handling: {
    key: "allergen_handling",
    label: "Allergenhåndtering",
    controlTags: ["allergen_control", "workflow_hygiene"]
  },

  dough_handling: {
    key: "dough_handling",
    label: "Dejhåndtering",
    controlTags: ["cleaning", "allergen_control"]
  },

  cooling_process: {
    key: "cooling_process",
    label: "Nedkøling af varme fødevarer",
    controlTags: ["cooling_control", "time_temperature_control"]
  }
};

module.exports = {
  activityTypes
};

```
