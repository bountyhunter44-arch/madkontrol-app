# FILE: functions/egenkontrol/libraries/controlLibrary.js

```javascript
const controlLibrary = {
  cold_storage_temperature: {
    controlKey: "cold_storage_temperature",
    label: "Temperaturkontrol af køl",
    scope: "equipment",
    guideKey: "guide_cold_storage_temperature",
    defaultFrequency: "daily",
    taskType: "measurement",
    evidence: {
      photoAllowed: true,
      photoRequired: false,
      minPhotos: 0,
      maxPhotos: 2,
      photoTypes: ["measurement_display", "overview"],
      captureLabel: "Tag evt. foto af temperaturvisning"
    },
    measurementConfig: {
      unit: "C",
      inputMode: "number",
      defaultValue: 3,
      step: 0.5,
      suggestedRange: { min: 2, max: 4 },
      criticalLimits: { max: 5 },
      prefillOnCreate: true
    },
    variants: {
      fridge: {
        appliesTo: ["fridge", "display_cooler"],
        limits: { max: 5, unit: "C" }
      }
    }
  },

  walk_in_cooler_temperature: {
    controlKey: "walk_in_cooler_temperature",
    label: "Temperaturkontrol af walk-in køler",
    scope: "equipment",
    guideKey: "guide_walk_in_cooler_temperature",
    defaultFrequency: "daily",
    taskType: "measurement",
    evidence: {
      photoAllowed: true,
      photoRequired: false,
      minPhotos: 0,
      maxPhotos: 3,
      photoTypes: ["measurement_display", "overview"],
      captureLabel: "Tag evt. foto af måling eller zone"
    },
    measurementConfig: {
      unit: "C",
      inputMode: "number",
      defaultValue: 3,
      step: 0.5,
      suggestedRange: { min: 2, max: 4 },
      criticalLimits: { max: 5 },
      prefillOnCreate: true
    },
    variants: {
      walk_in_cooler: {
        appliesTo: ["walk_in_cooler"],
        limits: { max: 5, unit: "C" },
        checkpoints: ["top", "middle", "floor"]
      }
    }
  },

  frozen_storage_temperature: {
    controlKey: "frozen_storage_temperature",
    label: "Temperaturkontrol af fryser",
    scope: "equipment",
    guideKey: "guide_frozen_storage_temperature",
    defaultFrequency: "daily",
    taskType: "measurement",
    evidence: {
      photoAllowed: true,
      photoRequired: false,
      minPhotos: 0,
      maxPhotos: 2,
      photoTypes: ["measurement_display", "overview"],
      captureLabel: "Tag evt. foto af temperaturvisning"
    },
    measurementConfig: {
      unit: "C",
      inputMode: "number",
      defaultValue: -18,
      step: 1,
      suggestedRange: { min: -22, max: -18 },
      criticalLimits: { max: -18 },
      prefillOnCreate: true
    },
    variants: {
      freezer: {
        appliesTo: ["freezer"],
        limits: { max: -18, unit: "C" }
      }
    }
  },

  cold_storage_placement: {
    controlKey: "cold_storage_placement",
    label: "Placering og adskillelse i køl",
    scope: "equipment",
    guideKey: "guide_cold_storage_placement",
    defaultFrequency: "daily",
    taskType: "checklist",
    evidence: {
      photoAllowed: true,
      photoRequired: false,
      minPhotos: 0,
      maxPhotos: 2,
      photoTypes: ["overview", "issue"],
      captureLabel: "Tag evt. foto af opbevaring"
    },
    variants: {
      default: {
        appliesTo: ["fridge", "display_cooler", "walk_in_cooler"]
      }
    }
  },

  cutting_area_hygiene: {
    controlKey: "cutting_area_hygiene",
    label: "Hygiejne i opskæringsområde",
    scope: "area",
    guideKey: "guide_cutting_area_hygiene",
    defaultFrequency: "daily",
    taskType: "checklist",
    evidence: {
      photoAllowed: true,
      photoRequired: true,
      minPhotos: 1,
      maxPhotos: 3,
      photoTypes: ["overview", "surface", "issue"],
      captureLabel: "Tag foto af opskæringsområde"
    },
    variants: {
      default: {
        appliesTo: ["cutting_area"]
      }
    }
  },

  board_change_control: {
    controlKey: "board_change_control",
    label: "Skift af skærebræt mellem opgaver",
    scope: "activity",
    guideKey: "guide_board_change_control",
    defaultFrequency: "daily",
    taskType: "checklist",
    evidence: {
      photoAllowed: true,
      photoRequired: false,
      minPhotos: 0,
      maxPhotos: 2,
      photoTypes: ["board_setup", "issue"],
      captureLabel: "Tag evt. foto af opsætning"
    },
    variants: {
      default: {
        appliesTo: ["board_change_between_tasks", "raw_to_ready_separation"]
      }
    }
  },

  raw_to_ready_separation: {
    controlKey: "raw_to_ready_separation",
    label: "Adskillelse mellem råt og spiseklart",
    scope: "activity",
    guideKey: "guide_raw_to_ready_separation",
    defaultFrequency: "daily",
    taskType: "checklist",
    evidence: {
      photoAllowed: true,
      photoRequired: true,
      minPhotos: 1,
      maxPhotos: 3,
      photoTypes: ["overview", "separation", "issue"],
      captureLabel: "Tag foto af adskillelse og opsætning"
    },
    variants: {
      default: {
        appliesTo: ["raw_to_ready_separation"]
      }
    }
  },

  cleaning_between_workflows: {
    controlKey: "cleaning_between_workflows",
    label: "Rengøring mellem arbejdsgange",
    scope: "activity",
    guideKey: "guide_cleaning_between_workflows",
    defaultFrequency: "daily",
    taskType: "checklist",
    evidence: {
      photoAllowed: true,
      photoRequired: true,
      minPhotos: 1,
      maxPhotos: 4,
      photoTypes: ["before", "after", "issue"],
      captureLabel: "Tag foto som dokumentation for rengøring"
    },
    variants: {
      default: {
        appliesTo: ["cleaning_between_workflows", "fish_handling"]
      }
    }
  },

  fish_hygiene_workflow: {
    controlKey: "fish_hygiene_workflow",
    label: "Fiskehygiejne og arbejdsgang",
    scope: "activity",
    guideKey: "guide_fish_hygiene_workflow",
    defaultFrequency: "daily",
    taskType: "checklist",
    evidence: {
      photoAllowed: true,
      photoRequired: true,
      minPhotos: 1,
      maxPhotos: 3,
      photoTypes: ["overview", "product_handling", "issue"],
      captureLabel: "Tag foto af arbejdsgang eller afvigelse"
    },
    variants: {
      default: {
        appliesTo: ["fish_handling"]
      }
    }
  },

  ice_machine_hygiene: {
    controlKey: "ice_machine_hygiene",
    label: "Hygiejnekontrol af ismaskine",
    scope: "equipment",
    guideKey: "guide_ice_machine_hygiene",
    defaultFrequency: "weekly",
    taskType: "checklist",
    evidence: {
      photoAllowed: true,
      photoRequired: true,
      minPhotos: 1,
      maxPhotos: 4,
      photoTypes: ["inside", "outside", "issue"],
      captureLabel: "Tag foto af ismaskinens stand"
    },
    variants: {
      default: {
        appliesTo: ["ice_machine"]
      }
    }
  },

  soft_ice_hygiene: {
    controlKey: "soft_ice_hygiene",
    label: "Hygiejnekontrol af softicemaskine",
    scope: "equipment",
    guideKey: "guide_soft_ice_hygiene",
    defaultFrequency: "daily",
    taskType: "checklist",
    evidence: {
      photoAllowed: true,
      photoRequired: true,
      minPhotos: 1,
      maxPhotos: 4,
      photoTypes: ["machine", "cleaning", "issue"],
      captureLabel: "Tag foto af softicemaskine og rengøring"
    },
    variants: {
      default: {
        appliesTo: ["soft_ice_machine"]
      }
    }
  },

  cooling_control: {
    controlKey: "cooling_control",
    label: "Nedkøling af varme fødevarer",
    scope: "activity",
    guideKey: "guide_cooling_control",
    defaultFrequency: "as_needed",
    taskType: "time_temperature_control",
    evidence: {
      photoAllowed: true,
      photoRequired: false,
      minPhotos: 0,
      maxPhotos: 3,
      photoTypes: ["start_temp", "end_temp", "product"],
      captureLabel: "Tag evt. foto af temperaturmåling"
    },
    measurementConfig: {
      unit: "C",
      inputMode: "number",
      requiresStartTemp: true,
      requiresEndTemp: true,
      requiresStartTime: true,
      requiresEndTime: true,
      step: 0.5,
      evaluationMode: "cooling_time_temperature",
      thresholds: {
        minStartTemp: 65,
        maxEndTemp: 10,
        maxDurationMinutes: 180
      }
    },
    variants: {
      default: {
        appliesTo: ["cooling_process"],
        actionOnFailure: "create_deviation",
        requiresProductInfo: true,
        requiresCoolingMethod: true
      }
    }
  }
};

function getControlByKey(controlKey) {
  return controlLibrary[controlKey] || null;
}

module.exports = {
  controlLibrary,
  getControlByKey
};

```
