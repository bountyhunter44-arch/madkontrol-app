// SLET FRA HER

export const RISK_CONTROL_MAP = {
  goods_receiving: {
    label: "Varemodtagelse",
    taskTemplateKey: "goods_receiving",
    programSectionKey: "varemodtagelse"
  },

  fridge_units: {
    label: "Køleskabe (+5)",
    taskTemplateKey: "fridge_temperature",
    programSectionKey: "opbevaring_af_foedevarer"
  },

  freezer_units: {
    label: "Frysere (-18)",
    taskTemplateKey: "freezer_temperature",
    programSectionKey: "opbevaring_af_foedevarer"
  },

  heat_treatment: {
    label: "Opvarmning / tilberedning af fødevarer",
    taskTemplateKey: "heat_treatment",
    programSectionKey: "opvarmning_varmebehandling"
  },

  reheating_food: {
    label: "Genopvarmning af fødevarer",
    taskTemplateKey: "reheating_food",
    programSectionKey: "opvarmning_varmebehandling"
  },

  hot_holding: {
    label: "Varmholdelse (+65)",
    taskTemplateKey: "hot_holding",
    programSectionKey: "varmholdelse_salg_uden_koel"
  },

  cooling_food: {
    label: "Nedkøling af fødevarer",
    taskTemplateKey: "cooling_food",
    programSectionKey: "nedkoeling"
  },

  date_control: {
    label: "Datokontrol af opbevarede fødevarer",
    taskTemplateKey: "date_control",
    programSectionKey: "opbevaring_af_foedevarer"
  },

  separation: {
    label: "Adskillelse",
    taskTemplateKey: "separation",
    programSectionKey: "adskillelse"
  },

  cleaning_temperature_control: {
    label: "Rengøringskontrol / temperaturkontrol",
    taskTemplateKey: "cleaning_temperature_control",
    programSectionKey: "rengoering_og_desinfektion"
  },

  cleaning_disinfection_control: {
    label: "Rengøring og desinfektion",
    taskTemplateKey: "cleaning_control",
    programSectionKey: "rengoering_og_desinfektion"
  },

  cleaning_chemical_storage: {
    label: "Rengørings- og desinfektionsmidler",
    taskTemplateKey: null,
    programSectionKey: "rengoering_og_desinfektion"
  },

  dishwasher_control: {
    label: "Opvaskemaskine",
    taskTemplateKey: "dishwasher_control",
    programSectionKey: "rengoering_og_desinfektion"
  },

  ice_machine_control: {
    label: "Isterningemaskine",
    taskTemplateKey: "ice_machine_control",
    programSectionKey: "rengoering_og_desinfektion"
  },

  allergen_control: {
    label: "Allergener",
    taskTemplateKey: null,
    programSectionKey: "allergener"
  },

  personal_hygiene_program: {
    label: "Personlig hygiejne",
    taskTemplateKey: null,
    programSectionKey: "personlig_hygiejne"
  },

  food_contact_materials: {
    label: "Fødevarekontaktmaterialer",
    taskTemplateKey: null,
    programSectionKey: "foedevarekontaktmaterialer"
  },

  verification_maintenance: {
    label: "Vedligeholdelse og skadedyrssikring",
    taskTemplateKey: null,
    programSectionKey: "vedligeholdelse_og_skadedyrssikring",
    verificationTemplateKey: "maintenance_and_pest_control"
  },

  equipment_maintenance: {
    label: "Vedligeholdelse af inventar og udstyr",
    taskTemplateKey: null,
    programSectionKey: "vedligeholdelse_og_udstyr",
    verificationTemplateKey: "equipment_maintenance"
  },

  pest_control: {
    label: "Sikring mod skadedyr",
    taskTemplateKey: null,
    programSectionKey: "skadedyrssikring",
    verificationTemplateKey: "pest_control"
  },

  sale_3_hour_rule: {
    label: "Salg uden køl/varme (3 timers regel)",
    taskTemplateKey: "sale_3_hour_rule",
    programSectionKey: "varmholdelse_salg_uden_koel"
  }
};

export function getControlDefinition(controlKey) {
  return RISK_CONTROL_MAP[controlKey] || null;
}

// TIL HER
