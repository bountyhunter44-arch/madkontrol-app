/**
 * controlLibraryOperational.js
 * Driftskontroller der genererer task_templates og task_instances.
 * Disse er daglige eller event-baserede registreringer.
 */

/** @type {OperationalDefinition[]} */
export const controlLibraryOperational = [
  {
    key: "cooling_control",
    title: "Nedkøling af fødevarer",
    libraryType: "operational",
    category: "varmebehandling",
    controlType: "cooling_control",
    frequency: {
      mode: "event_based",
      trigger: "manual_or_production_event"
    },
    riskLevel: "high",
    guide: {
      title: "Vejledning: Nedkøling",
      body: "Nedkøling af opvarmet mad skal ske hurtigt. Fra +65°C til under +10°C inden for 3 timer. Brug små beholdere, isbad eller blast-chiller. Registrér start- og sluttemperatur samt metode."
    },
    fields: [
      { key: "productName",  type: "text",     label: "Produktnavn",           required: true },
      { key: "quantity",     type: "select",   label: "Mængde",                options: ["Lille portion (<2 kg)", "Medium portion (2–5 kg)", "Stor portion (>5 kg)"] },
      { key: "startTemp",    type: "number",   label: "Starttemperatur (°C)",  unit: "C",  required: true },
      { key: "endTemp",      type: "number",   label: "Sluttemperatur (°C)",   unit: "C",  required: true },
      { key: "method",       type: "select",   label: "Nedkølingsmetode",      options: ["Små beholdere", "Isbad", "Blast-chiller", "Køleskab"] },
      { key: "comment",      type: "textarea", label: "Kommentar" },
      { key: "photo",        type: "photo",    label: "Foto",                  requiredOnDeviation: true }
    ],
    actions: {
      allowApprove: true,
      allowDeviation: true
    },
    rules: [
      {
        type: "temperature_threshold",
        field: "endTemp",
        max: 10,
        severity: "critical",
        deviationMessage: "Sluttemperatur over 10°C — opret afvigelse og iværksæt korrigerende handling."
      }
    ]
  },

  {
    key: "receiving_control",
    title: "Varemodtagelse og temperaturkontrol",
    libraryType: "operational",
    category: "varemodtagelse",
    controlType: "receiving_control",
    frequency: {
      mode: "event_based",
      trigger: "delivery_event"
    },
    riskLevel: "high",
    guide: {
      title: "Vejledning: Varemodtagelse",
      body: "Kontrollér temperatur på køle- og frostprodukter ved modtagelse. Afvis varer der er for varme. Tjek emballagebeskrivelse, dato og mærkning. Kølevarer skal holde maks. +5°C, frostvarer under -15°C."
    },
    fields: [
      { key: "supplier",      type: "text",        label: "Leverandør",               required: true },
      { key: "productName",   type: "text",        label: "Produktnavn",              required: true },
      { key: "temperature",   type: "number",      label: "Modtagelsestemperatur (°C)", unit: "C", required: true },
      { key: "productType",   type: "radio_group", label: "Produkttype",              options: ["Kølevare", "Frostprodukt", "Tørvare"] },
      { key: "expiryDate",    type: "text",        label: "Udløbsdato (ÅÅÅÅ-MM-DD)" },
      { key: "labeling",      type: "radio_group", label: "Mærkning ok?",             options: ["Ja", "Nej"] },
      { key: "packaging",     type: "radio_group", label: "Emballage intakt?",        options: ["Ja", "Nej"] },
      { key: "comment",       type: "textarea",    label: "Kommentar" },
      { key: "photo",         type: "photo",       label: "Foto",                     requiredOnDeviation: true }
    ],
    actions: {
      allowApprove: true,
      allowDeviation: true,
      allowReject: true
    },
    rules: [
      {
        type: "temperature_threshold",
        field: "temperature",
        max: 5,
        condition: { field: "productType", value: "Kølevare" },
        severity: "critical",
        deviationMessage: "Kølevare modtaget over +5°C — afvis eller opret afvigelse."
      },
      {
        type: "temperature_threshold",
        field: "temperature",
        max: -15,
        condition: { field: "productType", value: "Frostprodukt" },
        severity: "critical",
        deviationMessage: "Frostprodukt modtaget over -15°C — afvis eller opret afvigelse."
      }
    ]
  },

  {
    key: "storage_date_control",
    title: "Opbevaring og datokontrol",
    libraryType: "operational",
    category: "opbevaring",
    controlType: "storage_date_control",
    frequency: {
      mode: "daily"
    },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Datokontrol",
      body: "Gennemgå dagligt alle varer i køl, frys og lager. Kassér varer over dato. Sørg for FIFO (first in, first out). Tjek at åbnede produkter er tildækkede og mærkede med åbningsdato."
    },
    fields: [
      { key: "area",           type: "select",      label: "Område",                  options: ["Køl 1", "Køl 2", "Frys", "Tørlager"], required: true },
      { key: "expiredFound",   type: "radio_group", label: "Udgåede varer fundet?",   options: ["Ja", "Nej"], required: true },
      { key: "expiredItems",   type: "textarea",    label: "Beskriv udgåede varer",   showWhen: { field: "expiredFound", value: "Ja" } },
      { key: "fifoOk",         type: "radio_group", label: "FIFO overholdt?",         options: ["Ja", "Nej", "Ikke relevant"] },
      { key: "labelingOk",     type: "radio_group", label: "Mærkning ok?",            options: ["Ja", "Nej"] },
      { key: "comment",        type: "textarea",    label: "Kommentar" },
      { key: "photo",          type: "photo",       label: "Foto",                    requiredOnDeviation: true }
    ],
    actions: {
      allowApprove: true,
      allowDeviation: true
    },
    rules: [
      {
        type: "field_value_trigger",
        field: "expiredFound",
        value: "Ja",
        severity: "high",
        deviationMessage: "Udgåede varer fundet — registrér afvigelse og beskriv kassation."
      }
    ]
  },

  {
    key: "separation_control",
    title: "Adskillelse af fødevarer",
    libraryType: "operational",
    category: "hygiejne",
    controlType: "separation_control",
    frequency: {
      mode: "daily"
    },
    riskLevel: "high",
    guide: {
      title: "Vejledning: Adskillelse",
      body: "Rå og tilberedt mad må ikke komme i kontakt. Brug adskilte skærebrætter og knive (farvekodet). Opbevar råt kød nederst i kølet. Kontrollér at der ikke sker krydskontaminering."
    },
    fields: [
      { key: "rawCookedSeparated", type: "radio_group", label: "Rå og tilberedt mad adskilt?",          options: ["Ja", "Nej"], required: true },
      { key: "colorCodingUsed",    type: "radio_group", label: "Farvekodet udstyr anvendt korrekt?",    options: ["Ja", "Nej", "Ikke relevant"] },
      { key: "rawMeatPosition",    type: "radio_group", label: "Råt kød opbevaret nederst i køl?",      options: ["Ja", "Nej", "Ikke relevant"] },
      { key: "crossContaminationRisk", type: "radio_group", label: "Risiko for krydskontaminering?",   options: ["Ja", "Nej"] },
      { key: "comment",            type: "textarea",   label: "Kommentar" },
      { key: "photo",              type: "photo",      label: "Foto",                                   requiredOnDeviation: true }
    ],
    actions: {
      allowApprove: true,
      allowDeviation: true
    },
    rules: [
      {
        type: "field_value_trigger",
        field: "rawCookedSeparated",
        value: "Nej",
        severity: "critical",
        deviationMessage: "Adskillelse ikke overholdt — opret afvigelse straks."
      },
      {
        type: "field_value_trigger",
        field: "crossContaminationRisk",
        value: "Ja",
        severity: "critical",
        deviationMessage: "Krydskontamineringsrisiko identificeret — opret afvigelse."
      }
    ]
  },

  {
    key: "temperature_fridge_control",
    title: "Temperaturkontrol, køl",
    description: "Daglig temperaturkontrol af køleenhed. Angiv hvilken køler (f.eks. Køleskab 1).",
    equipmentType: "fridge",
    libraryType: "operational",
    category: "temperaturkontrol",
    controlType: "temperature_check",
    frequency: {
      mode: "daily"
    },
    riskLevel: "high",
    targetTemperature: 5.0,
    thresholds: {
      mode: "max",
      value: 5.0,
      unit: "°C"
    },
    defaultValues: {
      measuredTemperature: 5.0,
      status: "ok",
      note: "",
      measurementSource: "default"
    },
    formDefinition: {
      formType: "temperature_check",
      fields: [
        { key: "measuredTemperature", type: "number",   label: "Målt temperatur", unit: "°C", required: true, decimals: 1 },
        { key: "status",             type: "select",   label: "Status",          required: true, options: [{ value: "ok", label: "OK" }, { value: "deviation", label: "Afvigelse" }] },
        { key: "note",               type: "textarea", label: "Bemærkning",      required: false, maxLength: 500 }
      ]
    },
    displayHints: {
      thresholdText: "Maks 5 °C",
      helpText: "Registrér den målte temperatur for denne enhed."
    },
    guide: {
      title: "Vejledning: Temperaturkontrol køl",
      body: "Køletemperatur skal holdes under +5°C. Aflæs termometeret og registrér. Er temperaturen over +8°C, er der tale om en kritisk afvigelse. Kontakt leder."
    },
    fields: [
      { key: "unit",        type: "text",        label: "Køleenhed (navn/nummer)",   required: true },
      { key: "temperature", type: "number",      label: "Temperatur (°C)",           unit: "C", required: true },
      { key: "comment",     type: "textarea",    label: "Kommentar" },
      { key: "photo",       type: "photo",       label: "Foto",                      requiredOnDeviation: true }
    ],
    actions: {
      allowApprove: true,
      allowDeviation: true
    },
    rules: [
      {
        type: "temperature_threshold",
        field: "temperature",
        max: 5,
        severity: "warning",
        deviationMessage: "Køletemperatur over +5°C — overvåg og opret afvigelse ved fortsat overskridelse."
      },
      {
        type: "temperature_threshold",
        field: "temperature",
        max: 8,
        severity: "critical",
        deviationMessage: "Køletemperatur over +8°C — kritisk afvigelse. Flyt varer og kontakt leder."
      }
    ]
  },

  {
    key: "temperature_freezer_control",
    title: "Temperaturkontrol, frys",
    description: "Daglig temperaturkontrol af fryseenhed. Angiv hvilken fryser (f.eks. Fryseskab 1).",
    equipmentType: "freezer",
    libraryType: "operational",
    category: "temperaturkontrol",
    controlType: "temperature_check",
    frequency: {
      mode: "daily"
    },
    riskLevel: "high",
    targetTemperature: -18.0,
    thresholds: {
      mode: "max",
      value: -18.0,
      unit: "°C"
    },
    defaultValues: {
      measuredTemperature: -18.0,
      status: "ok",
      note: "",
      measurementSource: "default"
    },
    formDefinition: {
      formType: "temperature_check",
      fields: [
        { key: "measuredTemperature", type: "number",   label: "Målt temperatur", unit: "°C", required: true, decimals: 1 },
        { key: "status",             type: "select",   label: "Status",          required: true, options: [{ value: "ok", label: "OK" }, { value: "deviation", label: "Afvigelse" }] },
        { key: "note",               type: "textarea", label: "Bemærkning",      required: false, maxLength: 500 }
      ]
    },
    displayHints: {
      thresholdText: "Maks -18 °C",
      helpText: "Registrér den målte temperatur for denne enhed."
    },
    guide: {
      title: "Vejledning: Temperaturkontrol frys",
      body: "Frystemperatur skal holdes under -18°C. Aflæs og registrér dagligt. Temperatur over -12°C er kritisk afvigelse."
    },
    fields: [
      { key: "unit",        type: "text",   label: "Fryseenhed (navn/nummer)",   required: true },
      { key: "temperature", type: "number", label: "Temperatur (°C)",            unit: "C", required: true },
      { key: "comment",     type: "textarea", label: "Kommentar" },
      { key: "photo",       type: "photo",   label: "Foto",                      requiredOnDeviation: true }
    ],
    actions: {
      allowApprove: true,
      allowDeviation: true
    },
    rules: [
      {
        type: "temperature_threshold",
        field: "temperature",
        max: -18,
        severity: "warning",
        deviationMessage: "Frystemperatur over -18°C."
      },
      {
        type: "temperature_threshold",
        field: "temperature",
        max: -12,
        severity: "critical",
        deviationMessage: "Frystemperatur over -12°C — kritisk afvigelse. Flyt varer og kontakt leder."
      }
    ]
  },

  {
    key: "heat_treatment_control",
    title: "Opvarmning og varmebehandling",
    libraryType: "operational",
    category: "varmebehandling",
    controlType: "heat_treatment_control",
    frequency: {
      mode: "event_based",
      trigger: "cooking_event"
    },
    riskLevel: "high",
    guide: {
      title: "Vejledning: Varmebehandling",
      body: "Fødevarer skal opvarmes til minimum 75°C i centrum for at dræbe bakterier. Undtagelser: Hele kødstykker (ikke fjerkræ) kan være lyserøde indeni. Fisk skal til minimum 60°C i 1 minut. Brug stegetermometer."
    },
    fields: [
      { key: "productName",     type: "text",        label: "Produktnavn",                required: true },
      { key: "productType",     type: "select",      label: "Produkttype",                options: ["Kød (hakket)", "Kød (helt stykke)", "Fjerkræ", "Fisk", "Grøntsager", "Andet"], required: true },
      { key: "coreTemp",        type: "number",      label: "Kernetemperatur (°C)",       unit: "C", required: true },
      { key: "cookingMethod",   type: "select",      label: "Tilberedningsmetode",        options: ["Stegning", "Kogning", "Grillning", "Ovn", "Frituresteging", "Dampning"] },
      { key: "comment",         type: "textarea",    label: "Kommentar" },
      { key: "photo",           type: "photo",       label: "Foto",                       requiredOnDeviation: true }
    ],
    actions: {
      allowApprove: true,
      allowDeviation: true
    },
    rules: [
      {
        type: "temperature_threshold",
        field: "coreTemp",
        min: 75,
        condition: { field: "productType", value: "Kød (hakket)" },
        severity: "critical",
        deviationMessage: "Hakket kød skal til minimum 75°C — opret afvigelse."
      },
      {
        type: "temperature_threshold",
        field: "coreTemp",
        min: 75,
        condition: { field: "productType", value: "Fjerkræ" },
        severity: "critical",
        deviationMessage: "Fjerkræ skal til minimum 75°C — opret afvigelse."
      },
      {
        type: "temperature_threshold",
        field: "coreTemp",
        min: 60,
        condition: { field: "productType", value: "Fisk" },
        severity: "critical",
        deviationMessage: "Fisk skal til minimum 60°C — opret afvigelse."
      }
    ]
  },

  {
    key: "hot_holding_control",
    title: "Varmholdelse",
    libraryType: "operational",
    category: "varmebehandling",
    controlType: "hot_holding_control",
    frequency: {
      mode: "event_based",
      trigger: "hot_holding_check"
    },
    riskLevel: "high",
    guide: {
      title: "Vejledning: Varmholdelse",
      body: "Mad der varmholdes skal holde minimum 65°C i alle dele. Tjek temperaturen regelmæssigt. Falder temperaturen under 65°C, skal maden serveres, genopvarmes eller kasseres inden 3 timer."
    },
    fields: [
      { key: "productName",   type: "text",        label: "Produktnavn",              required: true },
      { key: "temperature",   type: "number",      label: "Temperatur (°C)",          unit: "C", required: true },
      { key: "timeHeld",      type: "select",      label: "Tid på varmholdelse",      options: ["Under 1 time", "1-2 timer", "2-3 timer", "Over 3 timer"] },
      { key: "equipment",     type: "text",        label: "Varmholdelsesudstyr" },
      { key: "comment",       type: "textarea",    label: "Kommentar" },
      { key: "photo",         type: "photo",       label: "Foto",                     requiredOnDeviation: true }
    ],
    actions: {
      allowApprove: true,
      allowDeviation: true
    },
    rules: [
      {
        type: "temperature_threshold",
        field: "temperature",
        min: 65,
        severity: "critical",
        deviationMessage: "Varmholdelsestemperatur under 65°C — genopvarm, server eller kassér inden 3 timer."
      }
    ]
  },

  {
    key: "daily_cleaning_control",
    title: "Daglig rengøring",
    libraryType: "operational",
    category: "rengøring",
    controlType: "cleaning_checklist",
    frequency: {
      mode: "daily"
    },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Daglig rengøring",
      body: "Daglig rengøring omfatter alle arbejdsflader, skærebrætter, knive, køkkengrej og gulve. Brug godkendte rengøringsmidler. Desinficer efter rengøring af overflader der har været i kontakt med rå fødevarer."
    },
    fields: [
      { key: "workSurfaces",      type: "radio_group", label: "Arbejdsflader rengjort?",        options: ["Ja", "Nej"], required: true },
      { key: "cuttingBoards",     type: "radio_group", label: "Skærebrætter rengjort?",         options: ["Ja", "Nej"], required: true },
      { key: "knivesUtensils",    type: "radio_group", label: "Knive og redskaber rengjort?",   options: ["Ja", "Nej"], required: true },
      { key: "floors",            type: "radio_group", label: "Gulve rengjort?",                options: ["Ja", "Nej"], required: true },
      { key: "sinks",             type: "radio_group", label: "Vaske rengjort?",                options: ["Ja", "Nej"], required: true },
      { key: "disinfectionDone",  type: "radio_group", label: "Desinfektion udført?",           options: ["Ja", "Nej", "Ikke relevant"] },
      { key: "comment",           type: "textarea",    label: "Kommentar" },
      { key: "photo",             type: "photo",       label: "Foto",                           requiredOnDeviation: true }
    ],
    actions: {
      allowApprove: true,
      allowDeviation: true
    },
    rules: [
      {
        type: "field_value_trigger",
        field: "workSurfaces",
        value: "Nej",
        severity: "high",
        deviationMessage: "Arbejdsflader ikke rengjort — opret afvigelse."
      }
    ]
  },

  {
    key: "handwash_compliance",
    title: "Håndvask compliance check",
    libraryType: "operational",
    category: "hygiejne",
    controlType: "hygiene_check",
    frequency: {
      mode: "daily"
    },
    riskLevel: "high",
    guide: {
      title: "Vejledning: Håndvask",
      body: "Personalet skal vaske hænder før arbejde, efter toiletbesøg, efter håndtering af rå fødevarer, efter affaldshåndtering og efter pauser. Tjek at sæbe, varmt vand og engangshåndklæder er tilgængeligt."
    },
    fields: [
      { key: "soapAvailable",       type: "radio_group", label: "Sæbe tilgængelig?",              options: ["Ja", "Nej"], required: true },
      { key: "hotWaterAvailable",   type: "radio_group", label: "Varmt vand tilgængeligt?",       options: ["Ja", "Nej"], required: true },
      { key: "towelsAvailable",     type: "radio_group", label: "Engangshåndklæder tilgængelige?", options: ["Ja", "Nej"], required: true },
      { key: "staffCompliance",     type: "radio_group", label: "Personale overholder håndvask?",  options: ["Ja", "Delvist", "Nej"] },
      { key: "comment",             type: "textarea",    label: "Kommentar" },
      { key: "photo",               type: "photo",       label: "Foto",                           requiredOnDeviation: true }
    ],
    actions: {
      allowApprove: true,
      allowDeviation: true
    },
    rules: [
      {
        type: "field_value_trigger",
        field: "soapAvailable",
        value: "Nej",
        severity: "critical",
        deviationMessage: "Sæbe ikke tilgængelig — kritisk afvigelse. Genopfyld straks."
      },
      {
        type: "field_value_trigger",
        field: "staffCompliance",
        value: "Nej",
        severity: "critical",
        deviationMessage: "Personale overholder ikke håndvask — instruer og opret afvigelse."
      }
    ]
  }
  // ─── EQUIPMENT-BASED CLEANING (per-unit) ────────────────────────────────────
  // These entries have an explicit equipmentType, which causes buildStartDayTargets
  // to expand one instance per active equipment unit of that type.
  // Area-based cleaning (floors, drains, surfaces) remains in daily_cleaning_control.

  {
    key: "cleaning_fridge_control",
    title: "Rengøringskontrol",
    description: "Rengøring og desinfektion af køleskab. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "fridge",
    libraryType: "operational",
    category: "rengøring",
    controlType: "cleaning_check",
    frequency: { mode: "daily" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Rengøring af køleskab",
      body: "Rengør og desinficér køleskab grundigt. Fjern alle varer. Rengør hylder, skuffer og gummilister. Tør indvendigt tørt. Placer varerne tilbage. Kontrollér at døren lukker tæt."
    },
    fields: [
      { key: "cleaned",       type: "radio_group", label: "Køleskab rengjort?",       options: ["Ja", "Nej"], required: true },
      { key: "disinfected",   type: "radio_group", label: "Desinficeret?",            options: ["Ja", "Nej", "Ikke nødvendig"] },
      { key: "sealOk",        type: "radio_group", label: "Gummilister og lukning ok?", options: ["Ja", "Nej"] },
      { key: "comment",       type: "textarea",    label: "Kommentar" },
      { key: "photo",         type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "cleaning_freezer_control",
    title: "Rengøringskontrol",
    description: "Rengøring og desinfektion af fryser. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "freezer",
    libraryType: "operational",
    category: "rengøring",
    controlType: "cleaning_check",
    frequency: { mode: "daily" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Rengøring af fryser",
      body: "Afrim og rengør fryser. Fjern alle varer og isbelægning. Rengør indvendigt med godkendt middel. Tør af og sæt varerne tilbage. Kontrollér temperatur efterfølgende."
    },
    fields: [
      { key: "cleaned",     type: "radio_group", label: "Fryser rengjort?",      options: ["Ja", "Nej"], required: true },
      { key: "iceRemoved",  type: "radio_group", label: "Isbelægning fjernet?",  options: ["Ja", "Nej", "Ikke relevant"] },
      { key: "sealOk",      type: "radio_group", label: "Gummilister ok?",       options: ["Ja", "Nej"] },
      { key: "comment",     type: "textarea",    label: "Kommentar" },
      { key: "photo",       type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "cleaning_fryer_control",
    title: "Rengøringskontrol",
    description: "Rengøring af frituregryde. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "fryer",
    libraryType: "operational",
    category: "rengøring",
    controlType: "cleaning_check",
    frequency: { mode: "daily" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Rengøring af frituregryde",
      body: "Sluk og afkøl frituregryden. Tøm og filtrer olien. Rengør kar, kurve og varmeelement. Kontrollér oliernes kvalitet. Varm op til driftstemperatur igen."
    },
    fields: [
      { key: "cleaned",   type: "radio_group", label: "Frituregryden rengjort?",    options: ["Ja", "Nej"], required: true },
      { key: "oilOk",     type: "radio_group", label: "Olie kontrolleret/skiftet?", options: ["Ja", "Nej"] },
      { key: "comment",   type: "textarea",    label: "Kommentar" },
      { key: "photo",     type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "cleaning_dishwasher_control",
    title: "Rengøringskontrol",
    description: "Rengøring og kontrol af opvaskemaskine. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "dishwasher",
    libraryType: "operational",
    category: "rengøring",
    controlType: "cleaning_check",
    frequency: { mode: "daily" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Rengøring af opvaskemaskine",
      body: "Rens opvaskemaskinens filtre, arme og indre vægge. Kontrollér afkalkningsmiddel og skyllemiddel. Kør et tomt program. Kontrollér skylletemperatur (min. 82°C)."
    },
    fields: [
      { key: "filterCleaned",  type: "radio_group", label: "Filtre rengjort?",           options: ["Ja", "Nej"], required: true },
      { key: "rinseTempOk",    type: "radio_group", label: "Skylletemperatur min. 82°C?", options: ["Ja", "Nej"] },
      { key: "detergentOk",    type: "radio_group", label: "Rengørings-/skyllemiddel ok?", options: ["Ja", "Nej"] },
      { key: "comment",        type: "textarea",    label: "Kommentar" },
      { key: "photo",          type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "cleaning_ice_machine_control",
    title: "Rengøringskontrol",
    description: "Rengøring og hygiejnekontrol af isterningemaskine. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "ice_machine",
    libraryType: "operational",
    category: "rengøring",
    controlType: "cleaning_check",
    frequency: { mode: "daily" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Rengøring af isterningemaskine",
      body: "Rengør isterningemaskinen dagligt. Tøm isterningebeholderen og rengør indvendigt med godkendt middel. Skyl grundigt. Kontrollér at ingen snavs eller slim er synlig."
    },
    fields: [
      { key: "cleaned",   type: "radio_group", label: "Maskine rengjort?",        options: ["Ja", "Nej"], required: true },
      { key: "noSlime",   type: "radio_group", label: "Ingen snavs/slim synlig?", options: ["Ja", "Nej"] },
      { key: "comment",   type: "textarea",    label: "Kommentar" },
      { key: "photo",     type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "cleaning_softice_control",
    title: "Rengøringskontrol",
    description: "Daglig rengøring og desinfektion af softice-maskine. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "softice_machine",
    libraryType: "operational",
    category: "rengøring",
    controlType: "cleaning_check",
    frequency: { mode: "daily" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Rengøring af softice-maskine",
      body: "Rens softice-maskinen dagligt. Skil de dele ad, der kan fjernes. Rengør og desinficér alle overflader der berøres af blandingen. Skyl og sæt sam­men igen."
    },
    fields: [
      { key: "cleaned",     type: "radio_group", label: "Maskine rengjort?",       options: ["Ja", "Nej"], required: true },
      { key: "disinfected", type: "radio_group", label: "Desinficeret?",           options: ["Ja", "Nej"] },
      { key: "comment",     type: "textarea",    label: "Kommentar" },
      { key: "photo",       type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "cleaning_display_fridge_control",
    title: "Rengøringskontrol",
    description: "Rengøring af displaykøl. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "display_fridge",
    libraryType: "operational",
    category: "rengøring",
    controlType: "cleaning_check",
    frequency: { mode: "daily" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Rengøring af displaykøl",
      body: "Tøm displaykøl. Rengør hylder og vægge indvendigt. Kontrollér gummilister og låger. Tør af og fyld op med korrekt placerede varer. Kontrollér temperatur."
    },
    fields: [
      { key: "cleaned",   type: "radio_group", label: "Displaykøl rengjort?", options: ["Ja", "Nej"], required: true },
      { key: "sealOk",    type: "radio_group", label: "Gummilister ok?",      options: ["Ja", "Nej"] },
      { key: "comment",   type: "textarea",    label: "Kommentar" },
      { key: "photo",     type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "cleaning_warming_cabinet_control",
    title: "Rengøringskontrol",
    description: "Rengøring af varmeskab. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "warming_cabinet",
    libraryType: "operational",
    category: "rengøring",
    controlType: "cleaning_check",
    frequency: { mode: "daily" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Rengøring af varmeskab",
      body: "Rengør varmeskab. Fjern mad-rester fra hylder og vægge. Rengør med varmt vand og godkendt rengøringsmiddel. Tør af. Kontrollér varmeelementer og termostat."
    },
    fields: [
      { key: "cleaned", type: "radio_group", label: "Varmeskab rengjort?", options: ["Ja", "Nej"], required: true },
      { key: "comment", type: "textarea",    label: "Kommentar" },
      { key: "photo",   type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "cleaning_blast_chiller_control",
    title: "Rengøringskontrol",
    description: "Rengøring af blast chiller. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "blast_chiller",
    libraryType: "operational",
    category: "rengøring",
    controlType: "cleaning_check",
    frequency: { mode: "daily" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Rengøring af blast chiller",
      body: "Rengør blast chiller efter brug. Fjern alle madrester. Rengør indvendigt med godkendt middel. Kontrollér fordamper for isophobning. Tør og klargør til næste brug."
    },
    fields: [
      { key: "cleaned", type: "radio_group", label: "Blast chiller rengjort?", options: ["Ja", "Nej"], required: true },
      { key: "comment", type: "textarea",    label: "Kommentar" },
      { key: "photo",   type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  // ─── EQUIPMENT-BASED MAINTENANCE (per-unit) ──────────────────────────────────
  // These entries have an explicit equipmentType, which causes buildStartDayTargets
  // to expand one instance per active equipment unit of that type.
  // General/building maintenance (pest control, floors, walls) is NOT included here.

  {
    key: "maintenance_fridge_control",
    title: "Vedligeholdelse",
    description: "Vedligeholdelseskontrol af køleskab. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "fridge",
    libraryType: "operational",
    category: "vedligeholdelse",
    controlType: "maintenance_check",
    frequency: { mode: "weekly" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Vedligeholdelse af køleskab",
      body: "Kontrollér køleskab for mekaniske fejl. Tjek termostat, kompressor og ventilator. Kontrollér gummilister og dørlukning. Afrim om nødvendigt. Rens kondensatorbakke."
    },
    fields: [
      { key: "mechanicsOk",  type: "radio_group", label: "Kompressor og ventilator ok?",  options: ["Ja", "Nej"], required: true },
      { key: "sealOk",       type: "radio_group", label: "Gummilister og dørlukning ok?", options: ["Ja", "Nej"] },
      { key: "drainCleaned", type: "radio_group", label: "Kondensatorbakke rengjort?",    options: ["Ja", "Nej", "Ikke nødvendig"] },
      { key: "comment",      type: "textarea",    label: "Kommentar" },
      { key: "photo",        type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "maintenance_freezer_control",
    title: "Vedligeholdelse",
    description: "Vedligeholdelseskontrol af fryser. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "freezer",
    libraryType: "operational",
    category: "vedligeholdelse",
    controlType: "maintenance_check",
    frequency: { mode: "weekly" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Vedligeholdelse af fryser",
      body: "Kontrollér fryser for mekaniske fejl. Tjek termostat, kompressor og lås. Kontrollér gummilister. Afrim og rengør kondensatorbakke."
    },
    fields: [
      { key: "mechanicsOk",  type: "radio_group", label: "Kompressor og termostat ok?",  options: ["Ja", "Nej"], required: true },
      { key: "sealOk",       type: "radio_group", label: "Gummilister og låsning ok?",   options: ["Ja", "Nej"] },
      { key: "defrostedOk",  type: "radio_group", label: "Ingen unormal isophobning?",   options: ["Ja", "Nej"] },
      { key: "comment",      type: "textarea",    label: "Kommentar" },
      { key: "photo",        type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "maintenance_walk_in_cooler_control",
    title: "Vedligeholdelse",
    description: "Vedligeholdelseskontrol af walk-in køler. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "walk_in_cooler",
    libraryType: "operational",
    category: "vedligeholdelse",
    controlType: "maintenance_check",
    frequency: { mode: "weekly" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Vedligeholdelse af walk-in køler",
      body: "Kontrollér walk-in køler. Tjek kompressor, fordamper, lys og dørlukning. Kontrollér pakninger og låsemekanisme. Kontrollér gulvafløb."
    },
    fields: [
      { key: "mechanicsOk",  type: "radio_group", label: "Kompressor og fordamper ok?",  options: ["Ja", "Nej"], required: true },
      { key: "doorOk",       type: "radio_group", label: "Dørlukning og pakninger ok?",  options: ["Ja", "Nej"] },
      { key: "lightOk",      type: "radio_group", label: "Belysning fungerer?",          options: ["Ja", "Nej"] },
      { key: "comment",      type: "textarea",    label: "Kommentar" },
      { key: "photo",        type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "maintenance_walk_in_freezer_control",
    title: "Vedligeholdelse",
    description: "Vedligeholdelseskontrol af walk-in fryser. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "walk_in_freezer",
    libraryType: "operational",
    category: "vedligeholdelse",
    controlType: "maintenance_check",
    frequency: { mode: "weekly" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Vedligeholdelse af walk-in fryser",
      body: "Kontrollér walk-in fryser. Tjek kompressor, fordamper, lys og dørlukning. Afgørende: ingen isophobning på fordamper. Kontrollér pakninger og låsemekanisme."
    },
    fields: [
      { key: "mechanicsOk",  type: "radio_group", label: "Kompressor og fordamper ok?",   options: ["Ja", "Nej"], required: true },
      { key: "noIceBuildup", type: "radio_group", label: "Ingen isophobning på fordamper?",options: ["Ja", "Nej"] },
      { key: "doorOk",       type: "radio_group", label: "Dørlukning og pakninger ok?",   options: ["Ja", "Nej"] },
      { key: "comment",      type: "textarea",    label: "Kommentar" },
      { key: "photo",        type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "maintenance_fryer_control",
    title: "Vedligeholdelse",
    description: "Vedligeholdelseskontrol af frituregryde. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "fryer",
    libraryType: "operational",
    category: "vedligeholdelse",
    controlType: "maintenance_check",
    frequency: { mode: "weekly" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Vedligeholdelse af frituregryde",
      body: "Kontrollér frituregryde. Tjek termostat og sikkerhedsafbryder. Kontrollér varmeelement og drænsystem. Kontrollér oliestanden og oliernes kvalitet."
    },
    fields: [
      { key: "thermostatOk",  type: "radio_group", label: "Termostat og sikkerhedsafbryder ok?", options: ["Ja", "Nej"], required: true },
      { key: "heatingOk",     type: "radio_group", label: "Varmeelement og drænventil ok?",       options: ["Ja", "Nej"] },
      { key: "comment",       type: "textarea",    label: "Kommentar" },
      { key: "photo",         type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "maintenance_dishwasher_control",
    title: "Vedligeholdelse",
    description: "Vedligeholdelseskontrol af opvaskemaskine. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "dishwasher",
    libraryType: "operational",
    category: "vedligeholdelse",
    controlType: "maintenance_check",
    frequency: { mode: "weekly" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Vedligeholdelse af opvaskemaskine",
      body: "Kontrollér opvaskemaskine. Tjek skylletemperatur (min. 82°C), vandtryk og doseringssystem. Rens filtre og sprøjtearme. Kontrollér tætninger og låger."
    },
    fields: [
      { key: "rinseTempOk",  type: "radio_group", label: "Skylletemperatur min. 82°C?",  options: ["Ja", "Nej"], required: true },
      { key: "filtersOk",    type: "radio_group", label: "Filtre og sprøjtearme ok?",    options: ["Ja", "Nej"] },
      { key: "dosingOk",     type: "radio_group", label: "Doseringssystem ok?",          options: ["Ja", "Nej"] },
      { key: "comment",      type: "textarea",    label: "Kommentar" },
      { key: "photo",        type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "maintenance_ice_machine_control",
    title: "Vedligeholdelse",
    description: "Vedligeholdelseskontrol af isterningemaskine. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "ice_machine",
    libraryType: "operational",
    category: "vedligeholdelse",
    controlType: "maintenance_check",
    frequency: { mode: "weekly" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Vedligeholdelse af isterningemaskine",
      body: "Kontrollér isterningemaskine. Tjek vandfilter og afkølingssystem. Kontrollér at ingen slim eller alger er synlige. Efterse vandindløb og afløb."
    },
    fields: [
      { key: "filterOk",    type: "radio_group", label: "Vandfilter ok?",               options: ["Ja", "Nej"], required: true },
      { key: "noSlime",     type: "radio_group", label: "Ingen slim/alger synlig?",     options: ["Ja", "Nej"] },
      { key: "drainOk",     type: "radio_group", label: "Vandindløb og afløb ok?",      options: ["Ja", "Nej"] },
      { key: "comment",     type: "textarea",    label: "Kommentar" },
      { key: "photo",       type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "maintenance_blast_chiller_control",
    title: "Vedligeholdelse",
    description: "Vedligeholdelseskontrol af blast chiller. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "blast_chiller",
    libraryType: "operational",
    category: "vedligeholdelse",
    controlType: "maintenance_check",
    frequency: { mode: "weekly" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Vedligeholdelse af blast chiller",
      body: "Kontrollér blast chiller. Tjek kompressor, fordamper og temperaturprobe. Kontrollér dørlukning og pakninger. Kontrollér at fordamper er fri for isophobning."
    },
    fields: [
      { key: "mechanicsOk",  type: "radio_group", label: "Kompressor og fordamper ok?",  options: ["Ja", "Nej"], required: true },
      { key: "probeOk",      type: "radio_group", label: "Temperaturprobe ok?",          options: ["Ja", "Nej"] },
      { key: "doorOk",       type: "radio_group", label: "Dørlukning og pakninger ok?",  options: ["Ja", "Nej"] },
      { key: "comment",      type: "textarea",    label: "Kommentar" },
      { key: "photo",        type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "maintenance_warming_cabinet_control",
    title: "Vedligeholdelse",
    description: "Vedligeholdelseskontrol af varmeskab. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "warming_cabinet",
    libraryType: "operational",
    category: "vedligeholdelse",
    controlType: "maintenance_check",
    frequency: { mode: "weekly" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Vedligeholdelse af varmeskab",
      body: "Kontrollér varmeskab. Tjek termostat og varmeelement. Kontrollér temperaturjustering og dørlukning. Eftersyn af pakninger og vandskuffe (ved dampvarmeskabe)."
    },
    fields: [
      { key: "thermostatOk", type: "radio_group", label: "Termostat og varmeelement ok?", options: ["Ja", "Nej"], required: true },
      { key: "doorOk",       type: "radio_group", label: "Dørlukning ok?",                options: ["Ja", "Nej"] },
      { key: "comment",      type: "textarea",    label: "Kommentar" },
      { key: "photo",        type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "maintenance_display_fridge_control",
    title: "Vedligeholdelse",
    description: "Vedligeholdelseskontrol af displaykøl. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "display_fridge",
    libraryType: "operational",
    category: "vedligeholdelse",
    controlType: "maintenance_check",
    frequency: { mode: "weekly" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Vedligeholdelse af displaykøl",
      body: "Kontrollér displaykøl. Tjek kompressor, belysning og dørlukning. Kontrollér gummilister og hyldeplaceringer. Rens kondensatorgitter og kontrollér afløb."
    },
    fields: [
      { key: "mechanicsOk",   type: "radio_group", label: "Kompressor og belysning ok?",   options: ["Ja", "Nej"], required: true },
      { key: "sealOk",        type: "radio_group", label: "Gummilister og dørlukning ok?", options: ["Ja", "Nej"] },
      { key: "condenserOk",   type: "radio_group", label: "Kondensatorgitter renset?",     options: ["Ja", "Nej", "Ikke nødvendig"] },
      { key: "comment",       type: "textarea",    label: "Kommentar" },
      { key: "photo",         type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },

  {
    key: "maintenance_softice_control",
    title: "Vedligeholdelse",
    description: "Vedligeholdelseskontrol af softice-maskine. Ét kontrolpunkt pr. aktiv enhed.",
    equipmentType: "softice_machine",
    libraryType: "operational",
    category: "vedligeholdelse",
    controlType: "maintenance_check",
    frequency: { mode: "weekly" },
    riskLevel: "medium",
    guide: {
      title: "Vejledning: Vedligeholdelse af softice-maskine",
      body: "Kontrollér softice-maskine. Tjek blandeenhed, pumper og seals. Kontrollér temperatur og viskositet. Kontrollér at sikkerhedstermostat fungerer korrekt."
    },
    fields: [
      { key: "mechanicsOk",  type: "radio_group", label: "Blandeenhed og pumper ok?",         options: ["Ja", "Nej"], required: true },
      { key: "sealsOk",      type: "radio_group", label: "Tætninger (seals) i god stand?",    options: ["Ja", "Nej"] },
      { key: "thermostatOk", type: "radio_group", label: "Sikkerhedstermostat fungerer?",     options: ["Ja", "Nej"] },
      { key: "comment",      type: "textarea",    label: "Kommentar" },
      { key: "photo",        type: "photo",       label: "Foto", requiredOnDeviation: true }
    ],
    actions: { allowApprove: true, allowDeviation: true }
  },
];

/**
 * @param {string} key
 * @returns {OperationalDefinition|undefined}
 */
export function getOperationalDefinition(key) {
  return controlLibraryOperational.find((d) => d.key === key);
}
