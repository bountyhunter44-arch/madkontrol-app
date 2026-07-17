// provisioning — udtrukket fra functions/index.js.
// Følger DI-factory-mønsteret fra functions/egenkontrol/.
// Kode flyttet ORDRET; eneste ændring er `exports.` -> `api.`.

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { generateComprehensiveHaccp, generateTaskTemplatesFromKcps } = require("./generateComprehensiveHaccp");
const { generateScenarioBasedHaccp } = require("./scenarioBasedHaccp");
const { guardDangerousOperation } = require("./security/environmentGuard");
const Stripe = require("stripe");
const { OWNER_KIND, buildOwnerScopeMetadata } = require("./lib/ownerScope");
const { sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt, toDocSafeId, toAsciiSlug, toLegacyId, getDateKey, addDays, daysBetween, normalizeDateKey, removeUndefinedFields, getWeekdayFromDateKey, sanitizeRelativePath, parsePageCount } = require("./lib/util");
const {
  generateCanonicalTaskTemplates,
  ensureSingleTaskInstance,
  startDayForLocationCanonical
} = require("./canonicalTaskEngine");

module.exports = ({
  FUNCTIONS_CONFIG,
  FieldValue,
  assertAdminAccess,
  assertLexiCustomerAccess,
  assertSeoGeneratorAccess,
  assertStartDayAccess,
  db,
  getUserAccessProfile,
  getUserLocationIds,
  sanitizeOnboardingProfile,
  sanitizeRiskModelInput
}) => {

  // Flyttet fra index.js — provisioning-only definitioner.
  const ADDON_CATALOG = {
    egenkontrol: { name: "Egenkontrol", amount: 14900 },
    kalkulation: { name: "Kalkulation", amount: 24900 },
    seo: { name: "SEO & Hjemmeside", amount: 34900 },
    accounting: { name: "Accounting", amount: 69900 },
    pos: { name: "POS", amount: 59900 },
    "bon-ai": { name: "Bon-AI", amount: 39900 },
    connector: { name: "Connector Support", amount: 29900 }
  };
  
  const CHECKOUT_FALLBACK_ORIGIN = "https://madkontrollen.dk";
  
  function inferProvisionedTemplateMeta(title = "", hazard = {}) {
    const text = sanitizeString(title, 220).toLowerCase();
    const hazardName = sanitizeString(hazard?.name || "", 220);
    const controlPoint = sanitizeString(hazard?.control || title, 220) || title;
  
    if (
      text.includes("temperatur") ||
      text.includes("kÃ¸l") ||
      text.includes("kol") ||
      text.includes("frys") ||
      text.includes("varmhold") ||
      text.includes("opvask")
    ) {
      return {
        category: text.includes("modtage") ? "modtagelse" : "temperatur",
        formType: "temperature",
        riskLevel: sanitizeString(hazard?.riskLevel || "high", 20).toLowerCase() || "high",
        controlPoint,
        sourceHazard: hazardName
      };
    }
  
    if (text.includes("modtage") || text.includes("leveran")) {
      return {
        category: "modtagelse",
        formType: "receiving",
        riskLevel: sanitizeString(hazard?.riskLevel || "medium", 20).toLowerCase() || "medium",
        controlPoint,
        sourceHazard: hazardName
      };
    }
  
    if (text.includes("rengÃ¸r") || text.includes("rengor") || text.includes("lukker")) {
      return {
        category: text.includes("lukker") ? "lukkerutine" : "rengÃ¸ring",
        formType: "checklist",
        riskLevel: sanitizeString(hazard?.riskLevel || "medium", 20).toLowerCase() || "medium",
        controlPoint,
        sourceHazard: hazardName
      };
    }
  
    return {
      category: "egenkontrol",
      formType: "check",
      riskLevel: sanitizeString(hazard?.riskLevel || "medium", 20).toLowerCase() || "medium",
      controlPoint,
      sourceHazard: hazardName
    };
  }
  
  function deriveTemperatureStatus({ measuredTemperature, thresholds } = {}) {
    if (measuredTemperature === null || measuredTemperature === undefined || typeof measuredTemperature !== "number") {
      return "unknown";
    }
    if (!thresholds || typeof thresholds.value !== "number") {
      return "unknown";
    }
    const mode  = thresholds.mode || "max";
    const limit = thresholds.value;
    if (mode === "max") return measuredTemperature <= limit ? "ok" : "deviation";
    if (mode === "min") return measuredTemperature >= limit ? "ok" : "deviation";
    return "unknown";
  }
  
  function getEquipmentDisplayName(item, fallbackLabel) {
    const explicit = sanitizeString(
      item?.displayName || item?.name || item?.equipmentName || fallbackLabel,
      140
    );
    return explicit || fallbackLabel;
  }
  
  const EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS = [
    { key: "cleaning_fridge_control",         equipmentType: "fridge",          titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "RengÃ¸r og desinficÃ©r kÃ¸leskab grundigt. Fjern alle varer. RengÃ¸r hylder, skuffer og gummilister. TÃ¸r indvendigt tÃ¸rt. Placer varerne tilbage. KontrollÃ©r at dÃ¸ren lukker tÃ¦t." },
    { key: "cleaning_freezer_control",        equipmentType: "freezer",         titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Afrim og rengÃ¸r fryser. Fjern alle varer og isbelÃ¦gning. RengÃ¸r indvendigt med godkendt middel. TÃ¸r af og sÃ¦t varerne tilbage. KontrollÃ©r temperatur efterfÃ¸lgende." },
    { key: "cleaning_fryer_control",          equipmentType: "fryer",           titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Sluk og afkÃ¸l frituregryden. TÃ¸m og filtrer olien. RengÃ¸r kar, kurve og varmeelementet. KontrollÃ©r oliernes kvalitet (friture-test). Varm op til driftstemperatur igen." },
    { key: "cleaning_dishwasher_control",     equipmentType: "dishwasher",      titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rens opvaskemaskinens filtre, arme og indre vÃ¦gge. KontrollÃ©r afkalkningsmiddel og skyllemiddel. KÃ¸r et tomt program. KontrollÃ©r skylletemperatur (min. 82Â°C)." },
    { key: "paalaegsmaskine_rengoering",      equipmentType: "slicer",          routineType: "paalaegsmaskine_rengoering", templateKey: "paalaegsmaskine_rengoering", titleBase: "PÃ¥lÃ¦gsmaskine rengÃ¸ring", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "RengÃ¸r og desinficÃ©r pÃ¥lÃ¦gsmaskinens kniv, slÃ¦de, afskÃ¦rmning og fÃ¸devarekontaktflader. KontrollÃ©r at der ikke er synlige madrester, fedt, belÃ¦gninger eller snavs, og at aftagelige dele er samlet korrekt." },
    { key: "softice_maskine_rengoering",      equipmentType: "softice_machine", routineType: "softice_maskine_rengoering", templateKey: "softice_maskine_rengoering", titleBase: "Ismaskine / softicemaskine rengÃ¸ring", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "RengÃ¸r og desinficÃ©r ismaskine eller softicemaskine efter virksomhedens plan og producentens anvisning. KontrollÃ©r kontaktflader, dyser, tappetud, beholdere, aftagelige dele og omrÃ¥det omkring maskinen." },
    { key: "cleaning_display_fridge_control", equipmentType: "display_fridge",  titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "TÃ¸m displaykÃ¸l. RengÃ¸r hylder og vÃ¦gge indvendigt. KontrollÃ©r gummilister og lÃ¥ger. TÃ¸r af og fyld op med korrekt placerede varer. KontrollÃ©r temperatur." },
    { key: "cleaning_warming_cabinet_control",equipmentType: "warming_cabinet", titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "RengÃ¸r varmeskab. Fjern mad-rester fra hylder og vÃ¦gge. RengÃ¸r med varmt vand og godkendt rengÃ¸ringsmiddel. TÃ¸r af. KontrollÃ©r varmeelementer og termostat." },
    { key: "cleaning_blast_chiller_control",  equipmentType: "blast_chiller",   titleBase: "RengÃ¸ringskontrol", category: "rengÃ¸ring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "RengÃ¸r blast chiller efter brug. Fjern alle madrester. RengÃ¸r indvendigt med godkendt middel. KontrollÃ©r fordamper for isophobning. TÃ¸r og klargÃ¸r til nÃ¦ste brug." },
  ];
  
  const EQUIPMENT_MAINTENANCE_TEMPLATE_DEFINITIONS = [
    { key: "maintenance_fridge_control",        equipmentType: "fridge",          titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r kÃ¸leskab for mekaniske fejl. Tjek termostat, kompressor og ventilator. KontrollÃ©r gummilister og dÃ¸rlukning. Afrim om nÃ¸dvendigt. Rens kondensatorbakke." },
    { key: "maintenance_freezer_control",       equipmentType: "freezer",         titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r fryser for mekaniske fejl. Tjek termostat, kompressor og lÃ¥s. KontrollÃ©r gummilister. Afrim og rengÃ¸r kondensatorbakke." },
    { key: "maintenance_walk_in_cooler_control",equipmentType: "walk_in_cooler",  titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r walk-in kÃ¸ler. Tjek kompressor, fordamper, lys og dÃ¸rlukning. KontrollÃ©r pakninger og lÃ¥semekanisme. KontrollÃ©r gulvaflÃ¸b." },
    { key: "maintenance_walk_in_freezer_control",equipmentType: "walk_in_freezer",titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r walk-in fryser. Tjek kompressor, fordamper, lys og dÃ¸rlukning. AfgÃ¸rende: ingen isophobning pÃ¥ fordamper. KontrollÃ©r pakninger og lÃ¥semekanisme." },
    { key: "maintenance_fryer_control",         equipmentType: "fryer",           titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r frituregryde. Tjek termostat og sikkerhedsafbryder. KontrollÃ©r varmeelement og drÃ¦nsystem. KontrollÃ©r oliestanden og oliernes kvalitet." },
    { key: "maintenance_dishwasher_control",    equipmentType: "dishwasher",      titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r opvaskemaskine. Tjek skylletemperatur (min. 82Â°C), vandtryk og doseringssystem. Rens filtre og sprÃ¸jtearme. KontrollÃ©r tÃ¦tninger og lÃ¥ger." },
    { key: "maintenance_ice_machine_control",   equipmentType: "ice_machine",     titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r isterningemaskine. Tjek vandfilter og afkÃ¸lingssystem. KontrollÃ©r at ingen slim eller alger er synlige. Efterse vandindlÃ¸b og aflÃ¸b." },
    { key: "maintenance_blast_chiller_control", equipmentType: "blast_chiller",   titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r blast chiller. Tjek kompressor, fordamper og temperaturprobe. KontrollÃ©r dÃ¸rlukning og pakninger. KontrollÃ©r at fordamper er fri for isophobning." },
    { key: "maintenance_warming_cabinet_control",equipmentType: "warming_cabinet",titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r varmeskab. Tjek termostat og varmeelement. KontrollÃ©r temperaturjustering og dÃ¸rlukning. Eftersyn af pakninger og vandskuffe (ved dampvarmeskabe)." },
    { key: "maintenance_display_fridge_control",equipmentType: "display_fridge",  titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r displaykÃ¸l. Tjek kompressor, belysning og dÃ¸rlukning. KontrollÃ©r gummilister og hyldeplaceringer. Rens kondensatorgitter og kontrollÃ©r aflÃ¸b." },
    { key: "maintenance_softice_control",       equipmentType: "softice_machine", titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "KontrollÃ©r softice-maskine. Tjek blandeenhed, pumper og seals. KontrollÃ©r temperatur og viskositet. KontrollÃ©r at sikkerhedstermostat fungerer korrekt." },
  ];
  
  const AREA_CLEANING_DEFINITIONS = [
    { areaKey: "kitchen",              title: "RengÃ¸ring af kÃ¸kken",                  frequency: "daily",   riskLevel: "high",   guideBody: "RengÃ¸r og desinficÃ©r alle kÃ¸kkenoverflader: bordplader, gulv, vaskestationer og udstyr. Tjek at der er rene karklude. Tip affald ud. DokumentÃ©r udfÃ¸relse." },
    { areaKey: "production_kitchen",   title: "RengÃ¸ring af produktionskÃ¸kken",       frequency: "daily",   riskLevel: "high",   guideBody: "RengÃ¸r produktionsoverflader og -udstyr. Tip affaldsposer og skift. RengÃ¸r gulv, vask og drÃ¦n. KontrollÃ©r at ingen fÃ¸devareaffald er tilbage." },
    { areaKey: "serving_area",         title: "RengÃ¸ring af serveringsomrÃ¥de",        frequency: "daily",   riskLevel: "medium", guideBody: "RengÃ¸r borde, stole, buffet og serveringsstationer. RengÃ¸r gulv og sÃ¸rg for at alle overflader gÃ¦ster har kontakt med er rene." },
    { areaKey: "dry_storage",          title: "RengÃ¸ring af tÃ¸rlager",                frequency: "weekly",  riskLevel: "low",    guideBody: "RengÃ¸r hylder og gulv. KontrollÃ©r at alle varer er hÃ¦vet fra gulvet og korrekt opbevaret. KontrollÃ©r holdbarhedsdatoer. Tjek for skadedyr." },
    { areaKey: "toilet",               title: "RengÃ¸ring af toilet og hÃ¥ndvask",      frequency: "daily",   riskLevel: "high",   guideBody: "RengÃ¸r og desinficÃ©r toilet, hÃ¥ndvask og gulv. Fyld sÃ¦be og papirhÃ¥ndklÃ¦der op. KontrollÃ©r at der er hÃ¥ndsprit tilgÃ¦ngeligt for personale." },
    { areaKey: "dishwashing_area",     title: "RengÃ¸ring af opvaskomrÃ¥de",            frequency: "daily",   riskLevel: "medium", guideBody: "RengÃ¸r opvaskemaskine, bakkestativ og gulvaflÃ¸b. Tip madrester ud. KontrollÃ©r rengÃ¸ringsmidler og skyllemidler. Tjek at alle overflader er rene." },
    { areaKey: "washing_room",         title: "RengÃ¸ring af vaskerum",                frequency: "daily",   riskLevel: "medium", guideBody: "RengÃ¸r vaskerum og drÃ¦n. KontrollÃ©r at lagervarer er ryddeligt placeret og hÃ¦vet fra gulvet." },
    { areaKey: "vegetable_room",       title: "RengÃ¸ring af grÃ¸ntrum",                frequency: "daily",   riskLevel: "medium", guideBody: "RengÃ¸r hylder og gulv. Fjern blade og affald. Tjek at temperatur er korrekt (typisk 10â€“12Â°C). KontrollÃ©r at ingen rÃ¥d/mug pÃ¥ varer." },
    { areaKey: "walk_in_cooler_room",  title: "RengÃ¸ring af kÃ¸lerum",                 frequency: "daily",   riskLevel: "high",   guideBody: "RengÃ¸r gulv og hylder. Tjek at alle varer er korrekt dÃ¦kket og mÃ¦rket. KontrollÃ©r at gulvaflÃ¸bet ikke er tilstoppet. RengÃ¸r dÃ¸rpakninger." },
    { areaKey: "walk_in_freezer_room", title: "RengÃ¸ring af fryserum",                frequency: "weekly",  riskLevel: "medium", guideBody: "RengÃ¸r gulv og hylder. Tjek at alle varer er korrekt dÃ¦kket og mÃ¦rket. Afrim om nÃ¸dvendigt. KontrollÃ©r at dÃ¸r lukker tÃ¦t og pakninger er intakte." },
  ];
  
  const PROCESS_DRIFT_TEMPLATE_DEFINITIONS = [
    {
      key:         "process_drift_varemodtagelse",
      title:       "Varemodtagelse",
      description: "KontrollÃ©r temperatur, emballage og holdbarhed ved modtagelse af fÃ¸devarer.",
      frequency:   "daily",
      category:    "modtagelse",
      controlType: "receiving_control",
      guideKey:    "receiving_goods",
      sortOrder:   10,
      alwaysInclude: true,
    },
    {
      key:         "process_drift_nedkoeling",
      title:       "NedkÃ¸ling",
      description: "KontrollÃ©r at varmebehandlede fÃ¸devarer nedkÃ¸les korrekt fra +65Â°C til under +10Â°C inden for 4 timer (lovkrav).",
      frequency:   "daily",
      category:    "nedkoeling",
      controlType: "cooling_process",
      guideKey:    "cooling_process",
      sortOrder:   20,
      alwaysInclude: false,
      requiresProcessAny: ["cool_food"],
    },
    {
      key:         "process_drift_varmholdelse",
      title:       "Varmholdelse",
      description: "KontrollÃ©r at varme retter holdes ved minimum 60Â°C og ikke varmholdes i mere end 3 timer.",
      frequency:   "daily",
      category:    "varmholdelse",
      controlType: "hot_holding",
      guideKey:    "hot_holding",
      sortOrder:   30,
      alwaysInclude: false,
      requiresProcessAny: ["hot_hold_food"],
    },
    {
      key:         "process_drift_opvarmning",
      title:       "Opvarmning",
      description: "KontrollÃ©r at genopvarmede fÃ¸devarer nÃ¥r minimum 75Â°C i kernen.",
      frequency:   "daily",
      category:    "opvarmning",
      controlType: "reheating_process",
      guideKey:    "hot_preparation_core_temperature",
      sortOrder:   40,
      alwaysInclude: false,
      requiresProcessAny: ["reheat_food", "cook_food"],
    },
    {
      key:         "process_drift_datokontrol",
      title:       "Datokontrol",
      description: "KontrollÃ©r holdbarhedsdatoer pÃ¥ alle opbevarede fÃ¸devarer. Fjern udgÃ¥ede varer og fÃ¸lg FIFO-princippet (fÃ¸rst ind, fÃ¸rst ud).",
      frequency:   "daily",
      category:    "drift",
      controlType: "date_control",
      guideKey:    "date_check",
      sortOrder:   50,
      alwaysInclude: true,
    },
    {
      key:         "process_drift_adskillelse",
      title:       "Adskillelse",
      description: "KontrollÃ©r korrekt adskillelse af rÃ¥ og tilberedte fÃ¸devarer i kÃ¸l, pÃ¥ arbejdsborde og med redskaber.",
      frequency:   "daily",
      category:    "drift",
      controlType: "separation_control",
      guideKey:    "separation_control",
      sortOrder:   60,
      alwaysInclude: true,
    },
    {
      key:         "process_drift_tre_timers_regel",
      title:       "3-timers regel",
      description: "KontrollÃ©r at fÃ¸devarer uden aktiv kÃ¸l eller varme ikke har stÃ¥et i farezonen (8â€“65Â°C) i mere end 3 timer.",
      frequency:   "daily",
      category:    "drift",
      controlType: "three_hour_rule",
      guideKey:    "three_hour_rule",
      sortOrder:   70,
      alwaysInclude: false,
      requiresProcessAny: ["serve_cold_food", "hot_hold_food"],
    },
  ];
  
  const WATER_CONTROL_TEMPLATE_DEFINITIONS = [
    {
      key:            "water_control_drikkevand",
      title:          "Kontrol af drikkevand",
      description:    "KontrollÃ©r drikkevandets udseende (klar/uklar), lugt og smag. MÃ¥l temperatur hvis relevant (koldt vand max 12Â°C, varmt min 55Â°C). NotÃ©r visuel status og eventuelle afvigelser.",
      frequency:      "daily",
      category:       "vandkontrol",
      controlType:    "water_control",
      guideKey:       "water_control",
      riskLevel:      "high",
      alwaysInclude:  true,
    },
    // REMOVED: water_control_isterningemaskine
    // Ice machines are covered by softice_maskine_rengoering in EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS.
    // Water control for ice machines is redundant and creates duplicate routines.
    {
      key:            "water_control_filter",
      title:          "Kontrol af vandfilter",
      description:    "InspicÃ©r vandfilter for tilstopning eller misfarvning. KontrollÃ©r filtrets levetid og udskiftningsdato. NotÃ©r filterets aktuelle status.",
      frequency:      "weekly",
      category:       "vandkontrol",
      controlType:    "water_control",
      guideKey:       "water_control",
      riskLevel:      "medium",
      alwaysInclude:  true,
    },
  ];
  
  const EQUIPMENT_COUNT_MAPPING = [
    { countKeys: ["fridge", "fridgeCount", "antalKoeleskabe"],                equipmentType: "fridge",          titleBase: "KÃ¸leskab",          controlTypes: ["temperature_check"] },
    { countKeys: ["freezer", "freezerCount", "antalFrysere"],                 equipmentType: "freezer",         titleBase: "Fryser",            controlTypes: ["temperature_check"] },
    { countKeys: ["walk_in_cooler", "walkinCoolerCount", "walkInCooler", "walkInCoolerCount"],     equipmentType: "walk_in_cooler",   titleBase: "Walk-in kÃ¸ler",     controlTypes: ["temperature_check"] },
    { countKeys: ["walk_in_freezer", "walkinFreezerCount", "walkInFreezer", "walkInFreezerCount"],  equipmentType: "walk_in_freezer",  titleBase: "Walk-in fryser",    controlTypes: ["temperature_check"] },
    { countKeys: ["ice_machine", "iceMachine", "antalIsterningemaskiner"],    equipmentType: "ice_machine",      titleBase: "Isterningemaskine", controlTypes: [] },
    { countKeys: ["ice_box", "isboks", "antalIsbokse"],                       equipmentType: "ice_box",          titleBase: "Isboks",            controlTypes: ["temperature_check"] },
    { countKeys: ["fryer", "antalFrityreGryder"],                             equipmentType: "fryer",            titleBase: "Frituregryden",     controlTypes: [] },
    { countKeys: ["dishwasher", "dishwasherCount", "antalOpvaskemaskiner"],   equipmentType: "dishwasher",       titleBase: "Opvaskemaskine",    controlTypes: [] },
    { countKeys: ["oven", "ovenCount", "antalOvne"],                          equipmentType: "oven",             titleBase: "Ovn",               controlTypes: [] },
    { countKeys: ["stove", "stoveCount", "antalKomfurer"],                    equipmentType: "stove",            titleBase: "Komfur",            controlTypes: [] },
    { countKeys: ["blast_chiller", "blastChiller", "antalBlastChillere"],     equipmentType: "blast_chiller",    titleBase: "Blast chiller",     controlTypes: ["temperature_check"] },
    { countKeys: ["warming_cabinet", "hotCabinetCount", "warmingCabinet", "antalVarmeskabe"],    equipmentType: "warming_cabinet",  titleBase: "Varmeskab",         controlTypes: ["temperature_check"] },
    { countKeys: ["display_fridge", "refrigeratedDisplayCount", "displayFridge", "antalDisplaykoele"],   equipmentType: "display_fridge",   titleBase: "DisplaykÃ¸l",        controlTypes: ["temperature_check"] },
    { countKeys: ["slicer", "slicerCount", "antalPaalaegsmaskiner"],          equipmentType: "slicer",           titleBase: "PÃ¥lÃ¦gsmaskine",    controlTypes: [] },
    { countKeys: ["smoke_oven", "smokeOvenCount", "antalRoegeovne"],          equipmentType: "smoke_oven",       titleBase: "RÃ¸geovn",          controlTypes: ["temperature_check"] },
    { countKeys: ["proofing_cabinet", "proofingCabinetCount", "antalRasteskabe"], equipmentType: "proofing_cabinet", titleBase: "Rasteskab", controlTypes: [] },
    { countKeys: ["softice_machine", "softiceMachine"],                       equipmentType: "softice_machine",  titleBase: "Softice maskine",   controlTypes: ["temperature_check"] },
  ];
  
  function createTaskTemplate(templateId, schema, schemaKey, unit, companyId, locationId, userId, userEmail, nowIso, formType, frequency, frequencyDays, customTitle = null, cleaningArea = null) {
    // TRACE LOGGING - PROBLEM A - v2
    console.log(`[createTaskTemplate] INPUT: schemaKey=${schemaKey}, schema.titleKey=${schema.titleKey}, schema.descriptionKey=${schema.descriptionKey}, customTitle=${customTitle}`);
    
    // Danish title and description mappings
    const schemaTitles = {
      'varemodtagelse': 'Varemodtagelse af kÃ¸le- og frostvarer',
      'koel_frost': 'Temperaturkontrol af kÃ¸le- og frostudstyr',
      'opvarmning': 'Opvarmning og genopvarmning',
      'varmholdelse': 'Varmholdelse af tilberedte retter',
      'nedkoeling': 'NedkÃ¸ling af varmbehandlede fÃ¸devarer',
      'rengoering': 'RengÃ¸ring og hygiejne',
      'adskillelse': 'Adskillelse og krydskontaminering',
      'opvaskemaskine': 'Opvaskemaskine - kontrol og rengÃ¸ring'
    };
    
    const schemaDescriptions = {
      'varemodtagelse': 'Kontroller temperatur, emballage og kvalitet ved modtagelse af kÃ¸le- og frostvarer. Registrer temperatur og eventuelle afvigelser.',
      'koel_frost': 'Daglig temperaturkontrol af kÃ¸leskabe og frysere. Temperaturen skal vÃ¦re max 5Â°C for kÃ¸l og max -18Â°C for frost.',
      'opvarmning': 'Kontroller at kernetemperaturen nÃ¥r minimum 75Â°C i mindst 2 minutter ved opvarmning og genopvarmning af fÃ¸devarer.',
      'varmholdelse': 'Varmholdte retter skal holdes ved minimum 65Â°C. Kontroller temperaturen regelmÃ¦ssigt.',
      'nedkoeling': 'NedkÃ¸l varmebehandlede fÃ¸devarer fra +65Â°C til under +10Â°C pÃ¥ maksimalt 4 timer (lovkrav). Registrer start- og sluttidspunkt samt temperaturer.',
      'rengoering': 'Daglig rengÃ¸ring og hygiejnekontrol af arbejdsflader, udstyr og lokaler. FÃ¸lg rengÃ¸ringsplanen.',
      'adskillelse': 'Kontroller adskillelse mellem rÃ¥varer og fÃ¦rdige produkter. Brug separate redskaber og skÃ¦rebrÃ¦tter.',
      'opvaskemaskine': 'Kontroller opvaskemaskinens temperatur og rengÃ¸ring. Skylletemperatur skal vÃ¦re minimum 82Â°C.'
    };
    
    const title = customTitle || schemaTitles[schemaKey] || schemaKey;
    
    let description = schemaDescriptions[schemaKey] || '';
    
    if (schemaKey === 'koel_frost' && unit) {
      if (unit.type === 'fridge') {
        description = 'Kontroller og registrer temperaturen for dette kÃ¸leskab. Temperaturen mÃ¥ hÃ¸jst vÃ¦re 5Â°C.';
      } else if (unit.type === 'freezer') {
        description = 'Kontroller og registrer temperaturen for denne fryser. Temperaturen skal vÃ¦re -18Â°C eller koldere.';
      } else if (unit.type === 'ice_machine') {
        description = 'Kontroller renhed, drift og temperaturforhold for denne isterningemaskine.';
      }
    }
    
    // TRACE LOGGING - PROBLEM A
    console.log(`[createTaskTemplate] OUTPUT: final title="${title}", final description="${description}"`);
    if (title.includes('schema.') || title.includes('skema')) {
      console.error(`[createTaskTemplate] ERROR: Title contains i18n key! title="${title}"`);
    }
    if (description.includes('schema.') || description.includes('skema')) {
      console.error(`[createTaskTemplate] ERROR: Description contains i18n key! description="${description}"`);
    }
    
    return {
      id: templateId,
      companyId,
      organizationId: companyId,
      locationId,
      title,
      description,
      category: schema.key || 'egenkontrol',
      frequency,
      frequencyType: frequency,
      frequencyDays,
      registrationFrequency: frequency,
      registrationFrequencyType: frequency,
      registrationFrequencyDays: frequencyDays,
      riskLevel: schema.isCCP ? 'high' : 'medium',
      isCCP: schema.isCCP || false,
      ccpNumber: schema.ccpNumber || 0,
      isGAG: schema.isGAG || false,
      controlPoint: schema.controlPointKey || '',
      formType,
      fields: [],
      alertRules: [],
      sourceType: 'egenkontrol_program',
      templateType: 'operational',
      templateSource: 'egenkontrol_generator',
      egenkontrolSchemaKey: schemaKey,
      criticalLimits: schema.criticalLimits || {},
      equipmentUnit: unit ? {
        id: unit.id,
        type: unit.type,
        name: unit.fallbackName,
        limits: unit.limits
      } : null,
      cleaningArea: cleaningArea,
      active: true,
      isActive: true,
      createdBy: userId,
      createdByName: userEmail,
      updatedBy: userId,
      generatedAt: nowIso,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
  }
  
  const INSTANCE_COMPARABLE_FIELDS = [
    "companyId", "locationId", "dateKey",
    "templateId", "taskId",
    "equipmentId", "equipmentType", "equipmentName",
    "title", "description",
    "controlType", "category", "formType",
    "areaId", "areaType",
    "status",
    "requiresMeasurement", "requiresRegistration", "registrationDeferred",
    "deadlineAt", "overduePolicy", "overdueExplanationRequired",
    "frequency", "frequencyType", "frequencyDays",
    "completedAt", "completedBy", "completedByName",
    "isCCP", "riskLevel", "visibility", "sortOrder",
    "fields", "alertRules", "criticalLimits", "thresholds",
    "guideKey", "templateType", "templateSource", "sourceType"
  ];
  
  const BILLING_PLANS = {
    monthly: {
      code: "monthly",
      label: "MÃ¥nedsabonnement",
      interval: "month",
      intervalCount: 1,
      exVatOre: 14900,
      vatRate: 0.25,
      inclVatOre: 18625
    },
    yearly: {
      code: "yearly",
      label: "Ã…rsabonnement (Spar 10%)",
      interval: "year",
      intervalCount: 1,
      exVatOre: 160920,
      vatRate: 0.25,
      inclVatOre: 201150
    }
  };
  
  function getBillingPlan(planCode) {
    const plan = BILLING_PLANS[planCode];
    if (!plan) {
      throw new functions.https.HttpsError("invalid-argument", "Ugyldig billingPlan");
    }
    return plan;
  }
  
  const CHECKOUT_ALLOWED_MODULES = new Set(["pos", "lagerkontrol", "bogforing", "egenkontrol", "menu", "seo", "kalkulation", "koerselskontrol"]);
  
  const CHECKOUT_MODULE_ALIASES = {
    accounting: "bogforing",
    bogfoering: "bogforing",
    "bogføring": "bogforing"
  };

  const api = {};

async function ensureLiveTaskTemplatesForProvisioning({ companyId, locationId, profile, riskModel, userId, userEmail }) {
  const templates = buildProvisionedTaskTemplates({
    companyId,
    locationId,
    profile,
    riskModel,
    userId,
    userEmail
  });

  if (!templates.length) {
    return { created: 0 };
  }

  await Promise.all(templates.map((template) => db.collection("task_templates").doc(template.id).set(template, { merge: true })));
  return { created: templates.length };
}

function buildProvisionedTaskTemplates({ companyId, locationId, profile = {}, riskModel = {}, userId = "", userEmail = "" }) {
  const suppliers = sanitizeStringList(riskModel?.suppliers || profile?.suppliers || [], 20, 120);
  const nowIso = new Date().toISOString();
  
  // Generate scenario-based HACCP (new motor)
  const scenarioHaccp = generateScenarioBasedHaccp({
    profile: profile,
    companyType: profile.companyType
  });
  
  // Use scenario-based task templates if available
  const scenarioTasks = scenarioHaccp.taskTemplates || [];
  
  if (scenarioTasks.length > 0) {
    // Use new scenario-based templates
    return scenarioTasks.map((task, index) => {
      const templateId = task.id || toDocSafeId(`${companyId}__${locationId}__${task.sourceType}_${task.title}`).slice(0, 120);
      
      // Robust fallback for fields and alertRules
      const taskFields = Array.isArray(task.fields) && task.fields.length > 0 
        ? task.fields 
        : buildProvisionedTemplateFields(task.formType, suppliers);
      
      const taskAlertRules = Array.isArray(task.alertRules) && task.alertRules.length > 0 
        ? task.alertRules 
        : buildProvisionedTemplateAlertRules(task.formType, task.title, task.riskLevel);
      
      // Defensive defaults for objects/arrays
      const safeCriticalLimits = task.criticalLimits && typeof task.criticalLimits === "object" 
        ? task.criticalLimits 
        : {};
      
      const safeProcedure = Array.isArray(task.procedure) 
        ? task.procedure 
        : [];
      
      const safeDeviationActions = Array.isArray(task.deviationActions) 
        ? task.deviationActions 
        : [];
      
      return {
        id: templateId,
        companyId,
        organizationId: companyId,
        locationId,
        title: sanitizeString(task.title, 220),
        description: sanitizeString(task.description, 500),
        category: sanitizeString(task.category, 80),
        frequency: task.frequency || task.frequencyType || "daily",
        frequencyType: task.frequencyType || "daily",
        frequencyDays: task.frequencyDays || 1,
        registrationFrequency: task.registrationFrequency || task.frequency || "daily",
        registrationFrequencyType: task.registrationFrequencyType || task.frequencyType || "daily",
        registrationFrequencyDays: task.registrationFrequencyDays || task.frequencyDays || 1,
        riskLevel: sanitizeString(task.riskLevel, 40) || "medium",
        isCCP: task.isCCP || false,
        controlPoint: sanitizeString(task.controlPoint, 180),
        controlPointType: sanitizeString(task.controlPointType, 80),
        formType: sanitizeString(task.formType, 40) || "checklist",
        fields: taskFields,
        alertRules: taskAlertRules,
        sourceHazardId: task.sourceHazardId,
        sourceHazard: task.sourceHazard,
        sourceProcessKey: task.sourceProcessKey,
        sourceType: task.sourceType || "hazard",
        templateType: task.templateType || "operational",
        templateSource: "scenario_based_haccp",
        haccpVersion: scenarioHaccp.version || "3.0_scenario_based",
        criticalLimits: safeCriticalLimits,
        procedure: safeProcedure,
        deviationActions: safeDeviationActions,
        active: task.active !== false,
        isActive: task.isActive !== false,
        createdBy: userId,
        createdByName: userEmail,
        updatedBy: userId,
        generatedAt: nowIso,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        relatedProcessKeys: Array.isArray(task.relatedProcessKeys) ? task.relatedProcessKeys : [],
        relatedHazardIds: Array.isArray(task.relatedHazardIds) ? task.relatedHazardIds : []
      };
    });
  }
  
  // Fallback to legacy KCP-based templates
  const comprehensiveHaccp = generateComprehensiveHaccp({
    profile: profile,
    companyType: profile.companyType
  });
  
  const kcpTasks = generateTaskTemplatesFromKcps(comprehensiveHaccp.kcps);
  
  return kcpTasks.map((task, index) => {
    const templateId = toDocSafeId(`${companyId}__${locationId}__kcp_${task.kcpNumber}_${task.title}`).slice(0, 120);
    
    // Find the corresponding KCP for detailed information
    const kcp = comprehensiveHaccp.kcps.find(k => k.id === task.kcpId);
    
    // Extract temperature limits if this is a temperature task
    const tempLimits = task.formType === "temperature" ? extractTemperatureLimits(kcp) : {};
    
    // Format instructions and corrective actions
    const instructions = kcp ? formatInstructions(kcp) : null;
    const criticalLimits = kcp ? formatCriticalLimits(kcp) : null;
    const correctiveActions = kcp ? formatCorrectiveActions(kcp) : null;
    
    // Get specific guide content based on KCP type
    const specificGuide = kcp ? buildSpecificGuideContent(kcp) : null;
    
    const baseTemplate = {
      id: templateId,
      companyId,
      organizationId: companyId,
      locationId,
      title: sanitizeString(task.title, 220),
      description: sanitizeString(task.description, 500),
      category: sanitizeString(task.category, 80),
      frequency: task.frequency || "daily",
      frequencyType: task.frequency || "daily",
      frequencyDays: task.frequency === "weekly" ? 7 : task.frequency === "monthly" ? 30 : 1,
      registrationFrequency: task.frequency || "daily",
      registrationFrequencyType: task.frequency || "daily",
      registrationFrequencyDays: task.frequency === "weekly" ? 7 : task.frequency === "monthly" ? 30 : 1,
      riskLevel: sanitizeString(task.riskLevel, 40) || "medium",
      controlPoint: sanitizeString(task.controlPoint, 180),
      formType: sanitizeString(task.formType, 40) || "checklist",
      fields: buildProvisionedTemplateFields(task.formType, suppliers),
      alertRules: buildProvisionedTemplateAlertRules(task.formType, task.title, task.riskLevel),
      kcpNumber: task.kcpNumber,
      kcpId: sanitizeString(task.kcpId, 120),
      isVerification: task.isVerification === true,
      sourceHazard: sanitizeString(task.controlPoint, 180),
      sourceType: "kcp_comprehensive_haccp",
      haccpVersion: "2.0_comprehensive",
      active: true,
      isActive: true,
      createdBy: userId,
      createdByName: userEmail,
      updatedBy: userId,
      generatedAt: nowIso,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    
    // Add temperature limits if applicable
    if (tempLimits.minValue !== null && tempLimits.minValue !== undefined) {
      baseTemplate.minValue = tempLimits.minValue;
    }
    if (tempLimits.maxValue !== null && tempLimits.maxValue !== undefined) {
      baseTemplate.maxValue = tempLimits.maxValue;
    }
    if (tempLimits.unit) {
      baseTemplate.measurementUnit = tempLimits.unit;
    }
    if (tempLimits.target) {
      baseTemplate.measurementTarget = tempLimits.target;
    }
    if (tempLimits.timeLimit) {
      baseTemplate.timeLimit = tempLimits.timeLimit;
    }
    
    // Add instructions and guidance
    if (instructions) {
      baseTemplate.instructions = instructions;
    }
    if (criticalLimits) {
      baseTemplate.criticalLimitsText = criticalLimits;
    }
    if (correctiveActions) {
      baseTemplate.correctiveActionsText = correctiveActions;
    }
    
    // Add hazard information from KCP
    if (kcp && kcp.hazard) {
      baseTemplate.hazardInfo = kcp.hazard;
    }
    
    // Add regulatory reference
    if (kcp && kcp.regulatoryReference) {
      baseTemplate.regulatoryReference = kcp.regulatoryReference;
    }
    
    // Add specific guide content
    if (specificGuide) {
      if (specificGuide.guidePurpose) {
        baseTemplate.guidePurpose = specificGuide.guidePurpose;
      }
      if (specificGuide.guideExecutionTimes) {
        baseTemplate.guideExecutionTimes = specificGuide.guideExecutionTimes;
      }
      if (specificGuide.guideCriticalLimit) {
        baseTemplate.guideCriticalLimit = specificGuide.guideCriticalLimit;
      }
      if (specificGuide.guideAreas) {
        baseTemplate.guideAreas = specificGuide.guideAreas;
      }
      if (specificGuide.guideSteps) {
        baseTemplate.guideSteps = specificGuide.guideSteps;
      }
      if (specificGuide.guideWhatToRegister) {
        baseTemplate.guideWhatToRegister = specificGuide.guideWhatToRegister;
      }
      if (specificGuide.guideApproval) {
        baseTemplate.guideApproval = specificGuide.guideApproval;
      }
      if (specificGuide.guideDeviationCriteria) {
        baseTemplate.guideDeviationCriteria = specificGuide.guideDeviationCriteria;
      }
      if (specificGuide.guideIfNotOk) {
        baseTemplate.guideIfNotOk = specificGuide.guideIfNotOk;
      }
      if (specificGuide.guideShortTips) {
        baseTemplate.guideShortTips = specificGuide.guideShortTips;
      }
      baseTemplate.guideEnabled = true;
    }
    
    return baseTemplate;
  });
}

function buildSpecificGuideContent(kcp) {
  const category = (kcp?.category || "").toLowerCase();
  const title = (kcp?.title || "").toLowerCase();
  
  if (category.includes("nedkoeling") || title.includes("nedkÃ¸l")) {
    return {
      guidePurpose: "At sikre at tilberedte retter nedkÃ¸les hurtigt nok til at forhindre bakterievÃ¦kst. Langsom nedkÃ¸ling mellem 10Â°C og 60Â°C er farligt.",
      guideExecutionTimes: "Efter hver tilberedning af retter der skal opbevares kÃ¸ligt",
      guideCriticalLimit: "Sluttemperatur under 10Â°C inden for 4 timer fra 60Â°C",
      guideSteps: [
        "MÃ¥l og noter starttemperatur umiddelbart efter tilberedning (skal vÃ¦re under 60Â°C)",
        "Placer maden i blast chiller eller kÃ¸l med god luftcirkulation",
        "TildÃ¦k maden korrekt og mÃ¦rk med dato og tidspunkt",
        "MÃ¥l sluttemperatur efter nedkÃ¸ling",
        "RegistrÃ©r bÃ¥de start- og sluttemperatur samt nedkÃ¸lingstid i systemet"
      ],
      guideWhatToRegister: ["Dato og klokkeslÃ¦t for start", "Starttemperatur", "Sluttemperatur", "NedkÃ¸lingstid", "Hvem der har udfÃ¸rt kontrollen", "Eventuel kommentar"],
      guideApproval: ["Sluttemperatur er under 10Â°C", "NedkÃ¸ling tog mindre end 4 timer", "Maden er korrekt tildÃ¦kket og mÃ¦rket", "Dokumentation er registreret"],
      guideDeviationCriteria: ["Sluttemperatur over 10Â°C efter 4 timer", "Blast chiller fungerer ikke", "Maden blev ikke tildÃ¦kket korrekt", "NedkÃ¸lingstid overskred 4 timer"],
      guideIfNotOk: [
        "RegistrÃ©r afvigelsen straks med prÃ¦cise temperaturer og tidspunkter",
        "Hvis over 10Â°C efter 4 timer: KassÃ©r maden omgÃ¥ende - bakterievÃ¦kst kan vÃ¦re farlig",
        "Hvis blast chiller defekt: Brug isvandsbad eller fordel i mindre portioner i kÃ¸l",
        "Flyt andre varer til fungerende udstyr",
        "InformÃ©r kÃ¸kkenchef eller ansvarlig leder",
        "Bestil service pÃ¥ blast chiller hvis nÃ¸dvendigt",
        "Ved tvivl om fÃ¸devaresikkerhed: KassÃ©r altid maden"
      ],
      guideShortTips: ["MÃ¥l altid roligt og korrekt", "Brug kalibreret termometer", "Skriv den rigtige temperatur, ikke et gÃ¦t", "Ved afvigelse skal du altid handle med det samme", "DokumentÃ©r alt"]
    };
  }
  
  if (category.includes("tilberedning") || title.includes("tilberedning") || title.includes("opvarmning")) {
    return {
      guidePurpose: "At sikre at maden tilberedes korrekt til en sikker temperatur for at forhindre bakterievÃ¦kst.",
      guideExecutionTimes: "FÃ¸r hver servering af tilberedte retter",
      guideCriticalLimit: "Kernetemperatur pÃ¥ minimum 75Â°C",
      guideSteps: [
        "Stik termometeret i den tykkeste del af kÃ¸det eller fjerkrÃ¦et",
        "Vent 10 sekunder for at fÃ¥ en stabil mÃ¥ling",
        "AflÃ¦s temperaturen og sikr dig at den er minimum 75Â°C",
        "RegistrÃ©r temperaturen i systemet"
      ],
      guideWhatToRegister: ["Dato og klokkeslÃ¦t for mÃ¥ling", "Kernetemperatur", "Hvem der har udfÃ¸rt kontrollen", "Eventuel kommentar"],
      guideApproval: ["Kernetemperatur er minimum 75Â°C", "Maden ser appetitlig ud", "Dokumentation er registreret"],
      guideDeviationCriteria: ["Kernetemperatur under 75Â°C", "Termometeret er ikke kalibreret", "Maden ser ikke appetitlig ud"],
      guideIfNotOk: [
        "RegistrÃ©r afvigelsen straks med prÃ¦cise temperaturer og tidspunkter",
        "Hvis under 75Â°C: Tilbered maden lÃ¦ngere ved lavere varme",
        "Hvis termometeret ikke er kalibreret: KalibrÃ©r det fÃ¸r nÃ¦ste brug",
        "Hvis maden ikke ser appetitlig ud: KassÃ©r den",
        "InformÃ©r kÃ¸kkenchef eller ansvarlig leder",
        "Ved tvivl om fÃ¸devaresikkerhed: KassÃ©r altid maden"
      ],
      guideShortTips: ["Brug altid et kalibreret termometer", "MÃ¥l kernetemperaturen korrekt", "Skriv den rigtige temperatur, ikke et gÃ¦t", "Ved afvigelse skal du altid handle med det samme", "DokumentÃ©r alt"]
    };
  }
  
  if (category.includes("varmholdelse") || title.includes("varmhold")) {
    return {
      guideAreas: ["Temperatur (min 60Â°C)", "Varighed (max 3 timer)", "Madkvalitet"],
      guideSteps: ["MÃ¥l i midten af retten", "Tjek varmeskab temperatur", "Noter starttidspunkt", "Registrer data"],
      guideApproval: ["Minimum 60Â°C", "Under 3 timer", "Ser appetitlig ud"],
      guideIfNotOk: ["Under 60Â°C: Varm til 75Â°C eller kassÃ©r", "Over 3 timer: KassÃ©r maden", "Varmeskab defekt: Flyt eller server", "Ved tvivl: KassÃ©r", "Registrer afvigelse"]
    };
  }
  
  if (category.includes("modtagelse") || title.includes("modtagelse")) {
    return {
      guideAreas: ["Temperatur (kÃ¸l max 5Â°C, frost max -12Â°C)", "Emballage-integritet", "Holdbarhedsdato", "Sensorisk vurdering"],
      guideSteps: ["Tjek temperaturer", "Inspicer emballage", "Tjek datoer", "Lugt og se pÃ¥ varerne"],
      guideApproval: ["Temperaturer OK", "Emballage intakt", "Datoer acceptable", "Frisk lugt og udseende"],
      guideIfNotOk: ["KÃ¸levarer over 5Â°C: Afvis", "Frostvarer optÃ¸ede: Afvis", "Beskadiget emballage: Afvis eller dokumenter", "DÃ¥rlig lugt: Afvis altid", "Kort holdbarhed: Afvis eller brug samme dag", "Dokumenter med billeder"]
    };
  }
  
  if (category.includes("opbevaring") || title.includes("lager")) {
    return {
      guideAreas: ["Temperatur (kÃ¸l 0-5Â°C, frost -18 til -25Â°C)", "FIFO-princip", "Adskillelse rÃ¥t/tilberedt", "TildÃ¦kning og mÃ¦rkning"],
      guideSteps: ["MÃ¥l temperaturer", "Tjek FIFO", "KontrollÃ©r adskillelse", "Verificer mÃ¦rkning"],
      guideApproval: ["Temperaturer korrekte", "FIFO overholdt", "Ingen krydskontaminering", "Alt mÃ¦rket"],
      guideIfNotOk: ["HÃ¸j temperatur: Tjek dÃ¸re, kontakt tekniker", "RÃ¥t over tilberedt: Flyt og rengÃ¸r", "UmÃ¦rket: MÃ¦rk nu eller kassÃ©r", "Gammelt mad: KassÃ©r", "Gentagne problemer: Tag ud af drift", "Registrer afvigelse"]
    };
  }
  
  if (category.includes("allergen")) {
    return {
      guideAreas: ["AllergenmÃ¦rkning pÃ¥ menukort", "Separate redskaber", "RengÃ¸ring mellem retter", "Personaleviden"],
      guideSteps: ["GennemgÃ¥ menukort", "Tjek separate redskaber", "Test personaleviden", "KontrollÃ©r rengÃ¸ring"],
      guideApproval: ["Alt mÃ¦rket korrekt", "Separate redskaber findes", "Personale kender allergener", "RengÃ¸ring forhindrer krydskontaminering"],
      guideIfNotOk: ["Mangler mÃ¦rkning: Opdater omgÃ¥ende", "Personale ukyndigt: Hold briefing nu", "Ingen separate redskaber: Anskaf eller vask grundigt", "Krydskontaminering: KassÃ©r og lav ny", "Allergisk reaktion: Ring 112 hvis alvorligt", "TrÃ¦n personale"]
    };
  }
  
  if (category.includes("rengoering") || category.includes("cleaning")) {
    return {
      guideAreas: ["Arbejdsflader og redskaber", "KÃ¸le/frostenheder", "AflÃ¸b og gulve", "Maskiner"],
      guideSteps: ["Inspicer visuelt", "Tjek kritiske omrÃ¥der", "Verificer rengÃ¸ringsplan", "Test med hvid klud"],
      guideApproval: ["Visuelt rent", "Ingen dÃ¥rlig lugt", "Plan fulgt", "Hvid klud-test OK"],
      guideIfNotOk: ["Synligt snavs: RengÃ¸r omgÃ¥ende", "AflÃ¸b lugter: Rens dagligt", "Beskidte tÃ¦tninger: RengÃ¸r og desinficer", "Maskiner urene: Stop brug og rengÃ¸r", "Gentagne problemer: Ekstra instruktion", "Skadedyr: Kontakt bekÃ¦mpelse", "Registrer afvigelse"]
    };
  }
  
  return {
    guideAreas: ["KontrollÃ©r visuelt", "BekrÃ¦ft udfÃ¸relse", "Beskriv afvigelser"],
    guideSteps: ["Vask hÃ¦nder", "GennemfÃ¸r kontrol", "Gem dokumentation"],
    guideApproval: ["Rent og vedligeholdt", "UdfÃ¸rt uden mangler", "Gemt i systemet"],
    guideIfNotOk: ["RegistrÃ©r afvigelse", "UdfÃ¸r korrigerende handling", "Informer ansvarlig"]
  };
}

function formatCorrectiveActions(kcp) {
  if (!kcp || !kcp.correctiveAction) return null;
  
  const actions = [];
  const correctiveAction = kcp.correctiveAction;
  
  if (correctiveAction.immediate) {
    actions.push(`**Ã˜jeblikkelig handling:** ${correctiveAction.immediate}`);
  }
  
  if (correctiveAction.prevention) {
    actions.push(`**Forebyggelse:** ${correctiveAction.prevention}`);
  }
  
  if (correctiveAction.documentation) {
    actions.push(`**Dokumentation:** ${correctiveAction.documentation}`);
  }
  
  Object.entries(correctiveAction).forEach(([key, value]) => {
    if (value && typeof value === "string" && !["immediate", "prevention", "documentation", "training"].includes(key)) {
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
      actions.push(`**${label}:** ${value}`);
    }
  });
  
  return actions.length > 0 ? actions.join("\n\n") : null;
}

function formatCriticalLimits(kcp) {
  if (!kcp || !kcp.criticalLimit) return null;
  
  const limits = [];
  const criticalLimit = kcp.criticalLimit;
  
  Object.entries(criticalLimit).forEach(([key, value]) => {
    if (value && typeof value === "string") {
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
      limits.push(`**${label}:** ${value}`);
    }
  });
  
  return limits.length > 0 ? limits.join("\n\n") : null;
}

function formatInstructions(kcp) {
  if (!kcp || !kcp.monitoring) return null;
  
  const monitoring = kcp.monitoring;
  const instructions = [];
  
  if (monitoring.what) {
    instructions.push(`**Hvad skal kontrolleres:** ${monitoring.what}`);
  }
  
  if (monitoring.how) {
    instructions.push(`**Hvordan:** ${monitoring.how}`);
  }
  
  if (monitoring.frequency) {
    instructions.push(`**Frekvens:** ${monitoring.frequency}`);
  }
  
  if (monitoring.responsible) {
    instructions.push(`**Ansvarlig:** ${monitoring.responsible}`);
  }
  
  return instructions.length > 0 ? instructions.join("\n\n") : null;
}

function extractTemperatureLimits(kcp) {
  if (!kcp || !kcp.criticalLimit) return { minValue: null, maxValue: null, unit: "Â°C" };
  
  const criticalLimit = kcp.criticalLimit;
  const category = (kcp.category || "").toLowerCase();
  const title = (kcp.title || "").toLowerCase();
  
  // KCP 1: Modtagelse (Receiving) - Default to chilled goods temperature
  if (category.includes("modtagelse") || title.includes("modtagelse") || title.includes("varemodtagelse")) {
    return { minValue: 0, maxValue: 5, unit: "Â°C", target: "KÃ¸levarer" };
  }
  
  // KCP 2: Opbevaring - KÃ¸l/Frost
  if (category.includes("opbevaring") || title.includes("lager")) {
    if (title.includes("kÃ¸l") || title.includes("fridge")) {
      return { minValue: 0, maxValue: 5, unit: "Â°C", target: "KÃ¸leskab" };
    }
    if (title.includes("frost") || title.includes("frys")) {
      return { minValue: -25, maxValue: -18, unit: "Â°C", target: "Fryser" };
    }
    // Default for storage
    return { minValue: 0, maxValue: 5, unit: "Â°C", target: "KÃ¸l" };
  }
  
  // KCP 3: Tilberedning
  if (category.includes("tilberedning") || title.includes("tilberedning") || title.includes("opvarmning")) {
    return { minValue: 75, maxValue: 100, unit: "Â°C", target: "Kernetemperatur" };
  }
  
  // KCP 4: NedkÃ¸ling
  if (category.includes("nedkoeling") || title.includes("nedkÃ¸l")) {
    return { minValue: 0, maxValue: 10, unit: "Â°C", target: "Sluttemperatur", timeLimit: "4 timer" };
  }
  
  // KCP 5: Varmholdelse
  if (category.includes("varmholdelse") || title.includes("varmhold")) {
    return { minValue: 60, maxValue: 100, unit: "Â°C", target: "Varmholdelse", timeLimit: "3 timer" };
  }
  
  return { minValue: null, maxValue: null, unit: "Â°C" };
}

function buildProvisionedTemplateAlertRules(formType, title, riskLevel) {
  if (formType === "temperature") {
    return [{
      type: "measurement_out_of_range",
      severity: riskLevel === "high" ? "critical" : "warning",
      message: `${sanitizeString(title, 160)} krÃ¦ver temperaturkontrol`
    }];
  }

  return [{
    type: "status_equals",
    value: "Afvigelse",
    severity: riskLevel === "high" ? "critical" : "warning",
    message: `${sanitizeString(title, 160)} krÃ¦ver handling`
  }];
}

function buildProvisionedTemplateFields(formType, suppliers = []) {
  if (formType === "temperature") {
    return [
      { key: "measurement", label: "MÃ¥ling", type: "number", required: true },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Ã…rsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  if (formType === "receiving") {
    return [
      { key: "supplier", label: "LeverandÃ¸r", type: suppliers.length ? "select" : "text", required: true, options: suppliers },
      { key: "status", label: "Status", type: "radio", required: true, options: ["OK", "Afvigelse"] },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Ã…rsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  if (formType === "checklist") {
    return [
      { key: "completed", label: "UdfÃ¸rt", type: "checkbox", required: false },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Ã…rsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  return [
    { key: "status", label: "Status", type: "radio", required: true, options: ["OK", "Afvigelse"] },
    { key: "comment", label: "Kommentar", type: "textarea", required: false },
    { key: "deviationReason", label: "Ã…rsag ved afvigelse", type: "textarea", required: false }
  ];
}

async function loadLatestScopedRiskSource({ companyId, locationId }) {
  const variants = [
    { companyField: "companyId", companyValue: companyId, locationValue: locationId },
    { companyField: "organizationId", companyValue: companyId, locationValue: locationId },
    { companyField: "companyId", companyValue: toLegacyId(companyId), locationValue: toLegacyId(locationId) },
    { companyField: "organizationId", companyValue: toLegacyId(companyId), locationValue: toLegacyId(locationId) }
  ];

  for (const variant of variants) {
    const normalizedCompanyValue = sanitizeString(variant.companyValue, 120);
    const normalizedLocationValue = sanitizeString(variant.locationValue, 120);
    if (!normalizedCompanyValue || !normalizedLocationValue) continue;

    for (const collectionName of ["live_user_profiles", "haccp_snapshots"]) {
      try {
        const snapshot = await db
          .collection(collectionName)
          .where(variant.companyField, "==", normalizedCompanyValue)
          .where("locationId", "==", normalizedLocationValue)
          .limit(20)
          .get();

        if (!snapshot.empty) {
          const docs = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .sort((a, b) => getComparableEpoch(b) - getComparableEpoch(a));

          const latest = docs[0] || null;
          if (latest) {
            return {
              sourceCollection: collectionName,
              payload: latest
            };
          }
        }
      } catch (error) {
        console.warn(`Kunne ikke hente ${collectionName} for ${variant.companyField}:`, error);
      }
    }
  }

  return null;
}

function getComparableEpoch(item = {}) {
  const epoch = Number(item?.createdAtEpochMs || item?.updatedAtEpochMs || 0);
  if (Number.isFinite(epoch) && epoch > 0) return epoch;

  const iso = sanitizeString(item?.createdAtIso || item?.updatedAtIso || "", 80);
  if (iso) {
    const parsed = new Date(iso).getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const timestamp = item?.createdAt || item?.updatedAt;
  if (timestamp && typeof timestamp.toDate === "function") {
    const parsed = timestamp.toDate().getTime();
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 0;
}

async function syncWaterControlTemplates({ db: dbRef, companyId, locationId, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncWaterControlTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0, skipped: 0 };
  }

  // Hent aktive equipment types for isterningemaskine-check
  const eqSnap = await dbRef.collection("equipment")
    .where("locationId", "==", locationId)
    .get();

  const activeEquipmentTypes = new Set();
  for (const doc of eqSnap.docs) {
    const d = doc.data() || {};
    if (d.active === false) continue;
    const type = sanitizeEquipmentType(d.type || d.equipmentType || "");
    if (type) activeEquipmentTypes.add(type);
  }

  // Fallback: check onboarding_answers for equipment counts
  if (activeEquipmentTypes.size === 0) {
    try {
      const oaSnap = await dbRef.collection("onboarding_answers")
        .where("locationId", "==", locationId)
        .limit(1)
        .get();
      if (!oaSnap.empty) {
        const counts = oaSnap.docs[0].data()?.equipmentCounts || {};
        for (const [k, v] of Object.entries(counts)) {
          const n = Math.max(0, Math.floor(Number(v) || 0));
          if (n > 0) activeEquipmentTypes.add(k.toLowerCase());
        }
      }
    } catch (_) { /* silent */ }
  }

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;

  for (const def of WATER_CONTROL_TEMPLATE_DEFINITIONS) {
    // Skip equipment-gated templates if equipment not present
    if (!def.alwaysInclude && def.requiresEquipmentAny) {
      const hasAny = def.requiresEquipmentAny.some((t) => activeEquipmentTypes.has(t));
      if (!hasAny) continue;
    }

    const docId = `${companyId}_${locationId}_${def.key}`;
    const ref = dbRef.collection("task_templates").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      const existing = snap.data() || {};
      const patch = buildOwnerScopeUpdatePatch(existing, ownerScopeMetadata);
      if (existing.title !== def.title || existing.description !== def.description) {
        patch.title = def.title;
        patch.description = def.description;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = nowTs;
        await ref.update(patch);
      }
      skipped++;
      continue;
    }

    const freqConfig = parseFrequencyConfig({ frequency: def.frequency }, "frequency");
    await ref.set({
      templateId:     docId,
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      title:          def.title,
      description:    def.description,
      category:       def.category,
      controlType:    def.controlType,
      guideKey:       def.guideKey,
      libraryType:    "operational",
      templateType:   "operational",
      templateSource: "water_control_library",
      sourceType:     "water_control_library",
      frequency:      def.frequency,
      frequencyType:  freqConfig.type,
      frequencyDays:  freqConfig.days,
      riskLevel:      def.riskLevel,
      fields:         [],
      rules:          [],
      actions:        { allowApprove: true, allowDeviation: true },
      guideTitle:     `Vejledning: ${def.title}`,
      guideBody:      def.description,
      schemaVersion:  1,
      isActive:       true,
      active:         true,
      createdAt:      nowTs,
      updatedAt:      nowTs,
    });
    created++;
    console.log(`[syncWaterControlTemplates] created ${docId}`);
  }

  console.log(`[syncWaterControlTemplates] done â€” created=${created} skipped=${skipped}`);
  return { ok: true, created, skipped };
}

function parseFrequencyConfig(template, prefix = "frequency") {
  const typeKey = `${prefix}Type`;
  const daysKey = `${prefix}Days`;

  const explicitType = sanitizeString(template?.[typeKey], 60).toLowerCase();
  const explicitDays = Number(template?.[daysKey] || 0);
  const legacy = sanitizeString(template?.[prefix], 80).toLowerCase();

  let type = explicitType;
  let days = Number.isFinite(explicitDays) && explicitDays > 0 ? Math.floor(explicitDays) : 1;

  // Normalize named interval types to interval_days
  if (type === "yearly" || type === "annual" || type === "aarlig" || type === "Ã¥rlig") {
    type = "interval_days";
    days = 365;
  } else if (type === "monthly" || type === "maanedlig" || type === "mÃ¥nedlig") {
    type = "interval_days";
    days = 30;
  } else if (type === "weekly" || type === "ugentlig") {
    type = "interval_days";
    days = 7;
  }

  if (!type) {
    if (!legacy || legacy === "daily" || legacy === "daglig") {
      type = "daily";
    } else if (legacy === "weekly" || legacy === "ugentlig") {
      type = "interval_days";
      days = 7;
    } else if (legacy === "monthly" || legacy === "maanedlig" || legacy === "mÃ¥nedlig") {
      type = "interval_days";
      days = 30;
    } else if (legacy === "yearly" || legacy === "annual" || legacy === "aarlig" || legacy === "Ã¥rlig") {
      type = "interval_days";
      days = 365;
    } else if (legacy === "weekdays") {
      type = "weekdays";
    } else if (legacy === "weekends") {
      type = "weekends";
    } else {
      const match = legacy.match(/(\d+)/);
      if (match) {
        type = "interval_days";
        days = Math.max(1, Number(match[1]));
      } else {
        type = "daily";
      }
    }
  }

  return {
    type: type || "daily",
    days: Math.max(1, days)
  };
}

function buildOwnerScopeUpdatePatch(existing = {}, ownerScopeMetadata = {}) {
  const patch = {};
  for (const field of ["ownerKind", "ownerLabel", "isDemoScope", "scopeType"]) {
    if (ownerScopeMetadata[field] !== undefined && existing[field] !== ownerScopeMetadata[field]) {
      patch[field] = ownerScopeMetadata[field];
    }
  }
  return patch;
}

function sanitizeEquipmentType(value) {
  const normalized = sanitizeString(value, 80).toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    "pÃ¥lÃ¦gsmaskine": "paalaegsmaskine",
    paalaegsmaskine: "paalaegsmaskine",
    slicer: "slicer",
    slicing_machine: "slicing_machine",
    softice: "softice_machine",
    softice_machine: "softice_machine",
    softice_maskine: "softice_machine",
    "softice-maskine": "softice_machine",
    ice_machine: "ice_machine",
    ismaskine: "ismaskine",
    isemaskine: "ismaskine",
    "is-maskine": "ismaskine",
    walkin_cooler: "walk_in_cooler",
    walkin_koeler: "walk_in_cooler",
    walkin_freezer: "walk_in_freezer",
    walkin_fryser: "walk_in_freezer",
    refrigerated_display: "display_fridge",
    koledisk: "display_fridge",
    hot_cabinet: "warming_cabinet",
    varmeskab: "warming_cabinet"
  };
  return aliases[normalized] || normalized;
}

async function syncProcessDriftTemplates({ db: dbRef, companyId, locationId, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncProcessDriftTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0, skipped: 0 };
  }

  // Hent aktive processes fra onboarding_answers (canonical doc)
  const canonicalDocId = `${companyId}__${locationId}__onboarding`;
  const oaDoc = await dbRef.collection("onboarding_answers").doc(canonicalDocId).get();
  const processes = oaDoc.exists ? (oaDoc.data().processes || []) : [];

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;

  for (const def of PROCESS_DRIFT_TEMPLATE_DEFINITIONS) {
    // Feature-flag: spring over hvis requiresProcessAny ikke er opfyldt
    if (!def.alwaysInclude && def.requiresProcessAny) {
      const hasAny = def.requiresProcessAny.some((p) => processes.includes(p));
      if (!hasAny) continue;
    }

    const docId = `${companyId}_${locationId}_${def.key}`;
    const ref   = dbRef.collection("task_templates").doc(docId);
    const snap  = await ref.get();

    if (snap.exists) {
      // Patch title/description hvis stale
      const existing = snap.data() || {};
      const patch = buildOwnerScopeUpdatePatch(existing, ownerScopeMetadata);
      if (existing.title !== def.title || existing.description !== def.description) {
        patch.title = def.title;
        patch.description = def.description;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = nowTs;
        await ref.update(patch);
      }
      skipped++;
      continue;
    }

    await ref.set({
      templateId:     docId,
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      title:          def.title,
      description:    def.description,
      category:       def.category,
      controlType:    def.controlType,
      guideKey:       def.guideKey,
      libraryType:    "operational",
      templateType:   "operational",
      templateSource: "process_drift_library",
      sourceType:     "process_drift_library",
      frequency:      def.frequency,
      frequencyType:  def.frequency,
      frequencyDays:  1,
      riskLevel:      "medium",
      sortOrder:      def.sortOrder || 100,
      fields:         [],
      rules:          [],
      actions:        { allowApprove: true, allowDeviation: true },
      guideTitle:     `Vejledning: ${def.title}`,
      guideBody:      def.description,
      schemaVersion:  1,
      isActive:       true,
      active:         true,
      createdAt:      nowTs,
      updatedAt:      nowTs,
    });
    created++;
    console.log(`[syncProcessDriftTemplates] created ${docId}`);
  }

  console.log(`[syncProcessDriftTemplates] done â€” created=${created} skipped=${skipped}`);
  return { ok: true, created, skipped };
}

async function syncAreaCleaningTemplates({ db: dbRef, companyId, locationId, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncAreaCleaningTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0 };
  }

  // Hent areas fra onboarding_answers â€” lÃ¦s canonical doc direkte for at undgÃ¥ at ramme forkert doc
  const canonicalDocId = `${companyId}__${locationId}__onboarding`;
  const oaDoc = await dbRef.collection("onboarding_answers").doc(canonicalDocId).get();
  const oaData = oaDoc.exists ? oaDoc.data() : {};
  const areas = toArray(oaData.areas);

  // Fallback: alle lokationer har et kÃ¸kken
  const activeAreas = new Set(areas.length > 0 ? areas : ["kitchen"]);

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;

  for (const def of AREA_CLEANING_DEFINITIONS) {
    if (!activeAreas.has(def.areaKey)) continue;

    const docId = `${companyId}_${locationId}_area_cleaning_${def.areaKey}`;
    const ref   = dbRef.collection("task_templates").doc(docId);
    const snap  = await ref.get();
    if (snap.exists) {
      const patch = buildOwnerScopeUpdatePatch(snap.data() || {}, ownerScopeMetadata);
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = nowTs;
        await ref.update(patch);
      }
      skipped++;
      continue;
    }

    await ref.set({
      templateId:     docId,
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      areaKey:        def.areaKey,
      title:          def.title,
      description:    def.guideBody,
      category:       "area_cleaning",
      controlType:    "cleaning_check",
      libraryType:    "operational",
      templateType:   "operational",
      templateSource: "area_cleaning_library",
      sourceType:     "area_cleaning_library",
      frequency:      def.frequency,
      frequencyType:  def.frequency,
      riskLevel:      def.riskLevel,
      fields:         [],
      rules:          [],
      actions:        { allowApprove: true, allowDeviation: true },
      guideTitle:     `Vejledning: ${def.title}`,
      guideBody:      def.guideBody,
      schemaVersion:  1,
      isActive:       true,
      active:         true,
      createdAt:      nowTs,
      updatedAt:      nowTs,
    });
    created++;
    console.log(`[syncAreaCleaningTemplates] created ${docId}`);
  }

  console.log(`[syncAreaCleaningTemplates] done â€” created=${created} skipped=${skipped} areas=${[...activeAreas].join(",")}`);
  return { ok: true, created, skipped };
}

async function syncEquipmentMaintenanceTemplates({ db: dbRef, companyId, locationId, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncEquipmentMaintenanceTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0 };
  }

  const eqSnap = await dbRef.collection("equipment")
    .where("locationId", "==", locationId)
    .get();

  const activeTypes = new Set();
  for (const doc of eqSnap.docs) {
    const d = doc.data() || {};
    if (d.active === false) continue;
    const type = sanitizeEquipmentType(d.type || d.equipmentType || "");
    if (type) activeTypes.add(type);
  }

  if (activeTypes.size === 0) {
    try {
      const oaSnap = await dbRef.collection("onboarding_answers")
        .where("locationId", "==", locationId)
        .limit(1)
        .get();
      if (!oaSnap.empty) {
        const counts = oaSnap.docs[0].data()?.equipmentCounts || {};
        for (const [k, v] of Object.entries(counts)) {
          const n = Math.max(0, Math.floor(Number(v) || 0));
          if (n > 0) activeTypes.add(k.toLowerCase());
        }
      }
    } catch (_) { /* silent */ }
  }

  const nowTs = FieldValue.serverTimestamp();
  let created = 0;

  for (const def of EQUIPMENT_MAINTENANCE_TEMPLATE_DEFINITIONS) {
    if (!activeTypes.has(def.equipmentType)) continue;

    const docId = `${companyId}_${locationId}_${def.key}`;
    const ref = dbRef.collection("task_templates").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      const existing = snap.data() || {};
      const patch = buildOwnerScopeUpdatePatch(existing, ownerScopeMetadata);
      if (existing.title !== def.titleBase) {
        patch.title = def.titleBase;
        patch.guideTitle = `Vejledning: ${def.titleBase}`;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = nowTs;
        await ref.update(patch);
      }
      continue;
    }

    const freqConfig = parseFrequencyConfig({ frequency: def.frequency }, "frequency");
    await ref.set({
      templateId:     docId,
      id:             def.key,
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      title:          def.titleBase,
      description:    def.guideBody || "",
      category:       def.category,
      controlType:    def.controlType,
      equipmentType:  def.equipmentType,
      libraryType:    "operational",
      templateType:   "operational",
      templateSource: "equipment_maintenance_library",
      sourceType:     "equipment_maintenance_library",
      frequency:      def.frequency,
      frequencyType:  freqConfig.type,
      frequencyDays:  freqConfig.days,
      interval_days:  freqConfig.days,
      riskLevel:      def.riskLevel,
      fields:         [],
      rules:          [],
      actions:        { allowApprove: true, allowDeviation: true },
      guideTitle:     `Vejledning: ${def.titleBase}`,
      guideBody:      def.guideBody || "",
      schemaVersion:  1,
      isActive:       true,
      active:         true,
      scheduleConfig: {
        scheduleType: "maintenance",
        recurrenceMode: "yearly",
        recurrenceValue: 1,
        firstRunImmediately: true,
        useDailyObservation: false
      },
      createdAt:      nowTs,
      updatedAt:      nowTs,
    });
    created++;
    console.log(`[syncEquipmentMaintenanceTemplates] created ${docId}`);
  }

  console.log(`[syncEquipmentMaintenanceTemplates] done â€” created=${created}, activeTypes=${[...activeTypes].join(",")}`);
  return { ok: true, created };
}

async function syncEquipmentCleaningTemplates({ db: dbRef, companyId, locationId, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncEquipmentCleaningTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0 };
  }

  // Get active equipment types for this location
  const eqSnap = await dbRef.collection("equipment")
    .where("locationId", "==", locationId)
    .get();

  const activeTypes = new Set();
  for (const doc of eqSnap.docs) {
    const d = doc.data() || {};
    if (d.active === false) continue;
    const type = sanitizeEquipmentType(d.type || d.equipmentType || "");
    if (type) activeTypes.add(type);
  }

  if (activeTypes.has("paalaegsmaskine") || activeTypes.has("slicing_machine")) {
    activeTypes.add("slicer");
  }
  if (activeTypes.has("ice_machine") || activeTypes.has("ismaskine")) {
    activeTypes.add("softice_machine");
  }

  // Also check onboarding_answers fallback (same as startDayForLocation)
  if (activeTypes.size === 0) {
    try {
      const oaSnap = await dbRef.collection("onboarding_answers")
        .where("locationId", "==", locationId)
        .limit(1)
        .get();
      if (!oaSnap.empty) {
        const counts = oaSnap.docs[0].data()?.equipmentCounts || {};
        for (const [k, v] of Object.entries(counts)) {
          const n = Math.max(0, Math.floor(Number(v) || 0));
          if (n > 0) activeTypes.add(sanitizeEquipmentType(k));
        }
        if (activeTypes.has("paalaegsmaskine") || activeTypes.has("slicing_machine")) {
          activeTypes.add("slicer");
        }
        if (activeTypes.has("ice_machine") || activeTypes.has("ismaskine")) {
          activeTypes.add("softice_machine");
        }
      }
    } catch (_) { /* silent */ }
  }

  const nowTs = FieldValue.serverTimestamp();
  let created = 0;

  for (const def of EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS) {
    if (!activeTypes.has(def.equipmentType)) continue;

    const docId = `${companyId}_${locationId}_${def.key}`;
    const ref = dbRef.collection("task_templates").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      // Patch title if stale (e.g. old code stored equipment type in title)
      const existing = snap.data() || {};
      const patch = buildOwnerScopeUpdatePatch(existing, ownerScopeMetadata);
      if (existing.title !== def.titleBase) {
        patch.title = def.titleBase;
        patch.guideTitle = `Vejledning: ${def.titleBase}`;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = nowTs;
        await ref.update(patch);
      }
      continue;
    }

    await ref.set({
      templateId:    docId,
      id:            def.key,
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      routineType:   def.routineType || def.key,
      templateKey:   def.templateKey || def.routineType || def.key,
      taskKey:       def.templateKey || def.routineType || def.key,
      title:         def.titleBase,
      displayTitle:  def.titleBase,
      templateTitle: def.titleBase,
      name:          def.titleBase,
      description:   def.guideBody || "",
      category:      def.category,
      controlType:   def.controlType,
      equipmentType: def.equipmentType,
      libraryType:   "operational",
      templateType:  "operational",
      templateSource: "equipment_cleaning_library",
      sourceType:    "equipment_cleaning_library",
      frequency:     def.frequency,
      frequencyType: def.frequency,
      frequencyDays: def.frequency === "weekly" ? 7 : 1,
      riskLevel:     def.riskLevel,
      fields:        [],
      rules:         [],
      actions:       { allowApprove: true, allowDeviation: true },
      guideTitle:    `Vejledning: ${def.titleBase}`,
      guideBody:     def.guideBody || "",
      schemaVersion: 1,
      isActive:      true,
      active:        true,
      createdAt:     nowTs,
      updatedAt:     nowTs,
    });
    created++;
    console.log(`[syncEquipmentCleaningTemplates] created ${docId}`);
  }

  console.log(`[syncEquipmentCleaningTemplates] done â€” created=${created}, activeTypes=${[...activeTypes].join(",")}`);
  return { ok: true, created };
}

async function syncOnboardingEquipmentUnits({ db: dbRef, companyId, locationId, equipmentCounts = {}, profile = {}, ownerScopeMetadata = {} }) {
  if (!companyId || !locationId) {
    console.warn("[syncOnboardingEquipmentUnits] missing companyId or locationId, skipping");
    return { ok: false, error: "missing companyId or locationId" };
  }
  console.log("[syncOnboardingEquipmentUnits] start", { companyId, locationId });

  const normalizedCounts = normalizeEquipmentCounts(equipmentCounts, profile);
  console.log("[syncOnboardingEquipmentUnits] normalizedCounts", normalizedCounts);

  const existingSnap = await dbRef
    .collection("equipment")
    .where("locationId", "==", locationId)
    .where("source", "==", "onboarding")
    .get();

  const existingById = new Map();
  const existingBySeedKey = new Map();
  const existingByType = new Map();
  for (const doc of existingSnap.docs) {
    const data = doc.data() || {};
    const itemCompanyId = sanitizeString(data.companyId || data.organizationId, 120);
    if (itemCompanyId && itemCompanyId !== companyId) continue;
    const itemType = sanitizeEquipmentType(data.type || data.equipmentType || "");
    const unitNumber = toPositiveInt(data.unitNumber) || parseEquipmentUnitNumberFromId(doc.id, itemType);
    const entry = { id: doc.id, ref: doc.ref, data, type: itemType, unitNumber };
    existingById.set(doc.id, entry);
    if (data.seedKey) existingBySeedKey.set(String(data.seedKey), entry);
    if (!existingByType.has(itemType)) existingByType.set(itemType, []);
    existingByType.get(itemType).push(entry);
  }

  const batch = dbRef.batch();
  let created = 0, updated = 0, deactivated = 0, kept = 0;
  const equipmentIds = [];
  const nowTs = FieldValue.serverTimestamp();

  for (const mapping of EQUIPMENT_COUNT_MAPPING) {
    const count = normalizedCounts[mapping.equipmentType] || 0;
    const { equipmentType, titleBase, controlTypes } = mapping;

    // Upsert active units 1..count
    for (let i = 1; i <= count; i++) {
      const seedKey = buildEquipmentSeedKey({ companyId, locationId, equipmentType, unitNumber: i });
      const scopedDocId = buildEquipmentDocId({ companyId, locationId, equipmentType, unitNumber: i });
      const legacyDocId = `onboarding_${equipmentType}_${i}`;
      const title = `${titleBase} ${i}`;
      const existing = existingBySeedKey.get(seedKey) || existingById.get(scopedDocId) || existingById.get(legacyDocId);
      const docId = existing?.id || scopedDocId;
      const ref = existing?.ref || dbRef.collection("equipment").doc(docId);
      const runtimeFlags = buildEquipmentRuntimeFlags(equipmentType, controlTypes);
      const payload = {
        companyId,
        organizationId: companyId,
        locationId,
        ...ownerScopeMetadata,
        source: "onboarding",
        onboardingSource: existing?.data?.onboardingSource || "quick_onboarding",
        equipmentId: docId,
        seedKey,
        equipmentType,
        type: equipmentType,
        controlTypes,
        controlType: controlTypes[0] || "",
        title,
        name: title,
        displayName: title,
        unitNumber: i,
        active: true,
        isActive: true,
        ...runtimeFlags,
        updatedAt: nowTs
      };

      if (existing) {
        batch.set(ref, payload, { merge: true });
        if (existing.data.active === false) { updated++; } else { kept++; }
      } else {
        batch.set(ref, { ...payload, createdAt: nowTs });
        created++;
        console.log(`[syncOnboardingEquipmentUnits] created ${docId}`);
      }
      equipmentIds.push(docId);
    }

    // Deactivate units above current count
    for (const existing of existingByType.get(equipmentType) || []) {
      if (toPositiveInt(existing.unitNumber) > count && existing.data.active !== false) {
        batch.set(existing.ref, { active: false, isActive: false, updatedAt: nowTs }, { merge: true });
        deactivated++;
        console.log(`[syncOnboardingEquipmentUnits] deactivated ${existing.id}`);
      }
    }
  }

  await batch.commit();
  
  // Ensure temperature-relevant units have temperatureControl settings
  let tempControlUpdated = 0;
  for (const equipmentId of equipmentIds) {
    try {
      const unitRef = dbRef.collection("equipment").doc(equipmentId);
      const unitSnap = await unitRef.get();
      if (unitSnap.exists) {
        const unitData = unitSnap.data() || {};
        const normalizedUnit = await ensureEquipmentTemperatureControl(dbRef, locationId, {
          id: equipmentId,
          ...unitData
        });
        
        // Only update if temperatureControl was added/changed
        if (normalizedUnit.temperatureControl && 
            JSON.stringify(unitData.temperatureControl) !== JSON.stringify(normalizedUnit.temperatureControl)) {
          await unitRef.update({
            temperatureControl: normalizedUnit.temperatureControl,
            updatedAt: FieldValue.serverTimestamp()
          });
          tempControlUpdated++;
        }
      }
    } catch (tempErr) {
      console.warn(`[syncOnboardingEquipmentUnits] ensureEquipmentTemperatureControl failed for ${equipmentId}:`, tempErr.message);
    }
  }
  
  if (tempControlUpdated > 0) {
    console.log(`[syncOnboardingEquipmentUnits] Added temperatureControl to ${tempControlUpdated} units`);
  }
  
  // Create temperature control templates for all active units
  const units = [];
  for (const equipmentId of equipmentIds) {
    const unitSnap = await dbRef.collection("equipment").doc(equipmentId).get();
    if (unitSnap.exists) {
      const unitData = unitSnap.data() || {};
      units.push({
        id: equipmentId,
        name: unitData.name || unitData.title,
        type: unitData.type || unitData.equipmentType
      });
    }
  }
  
  if (units.length > 0) {
    console.log(`[syncOnboardingEquipmentUnits] Creating temperature templates for ${units.length} units`);
    await ensureEgenkontrolTaskTemplates({
      db: dbRef,
      companyId,
      locationId,
      units,
      ownerScopeMetadata
    });
  }
  
  const summary = { ok: true, created, updated, deactivated, kept, equipmentIds, tempControlUpdated };
  console.log("[syncOnboardingEquipmentUnits] summary", summary);
  return summary;
}

async function ensureEgenkontrolTaskTemplates({
  db,
  companyId,
  locationId,
  units = [],
  ownerScopeMetadata = {}
}) {
  const templatesRef = db.collection("task_templates");

  async function createTemplateIfNotExists(template) {
    const docRef = templatesRef.doc(template.templateId);
    const snap = await docRef.get();
    if (snap.exists) {
      const existing = snap.data() || {};
      const patch = buildOwnerScopeUpdatePatch(existing, ownerScopeMetadata);
      if (!existing.templateType || existing.templateType !== "operational") {
        patch.templateType = "operational";
      }

      for (const field of [
        "routineType",
        "routineKey",
        "taskKey",
        "equipmentId",
        "equipmentType",
        "equipmentName",
        "unitId",
        "unitName"
      ]) {
        if (template[field] && !existing[field]) patch[field] = template[field];
      }

      if (template.equipmentUnit && !existing.equipmentUnit) {
        patch.equipmentUnit = template.equipmentUnit;
      }

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = new Date();
        await docRef.update(patch);
        console.log(`[ensureEgenkontrolTaskTemplates] Updated equipment metadata for ${template.templateId}`);
      }
      return;
    }
    await docRef.set(template);
    console.log(`[ensureEgenkontrolTaskTemplates] Created ${template.templateId}`);
  }

  const baseMeta = {
    companyId,
    locationId,
    ...ownerScopeMetadata,
    templateType: "operational",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const temperatureRoutineByType = {
    fridge: "koeleskab_temperatur",
    freezer: "fryser_temperatur",
    walk_in_cooler: "walkin_koeler_temperatur",
    walk_in_freezer: "walkin_fryser_temperatur",
    display_fridge: "koledisk_temperatur",
    blast_chiller: "blaesekoeler_temperatur",
    warming_cabinet: "varmeskab_temperatur",
    softice_machine: "softice_temperatur_kontrol",
    dishwasher: "opvaskemaskine_skyllevand"
  };

  const cleaningRoutineByType = {
    fridge: "koeleskab_rengoering",
    freezer: "fryser_rengoering",
    walk_in_cooler: "walkin_koeler_rengoering",
    walk_in_freezer: "walkin_fryser_rengoering",
    display_fridge: "koledisk_rengoering",
    blast_chiller: "blaesekoeler_rengoering",
    warming_cabinet: "varmeskab_rengoering",
    dishwasher: "opvaskemaskine_rengoering",
    fryer: "friture_rengoering",
    friture: "friture_rengoering",
    slicer: "paalaegsmaskine_rengoering",
    paalaegsmaskine: "paalaegsmaskine_rengoering",
    softice_machine: "softice_maskine_rengoering",
    ice_machine: "softice_maskine_rengoering",
    oven: "ovn_rengoering",
    stove: "komfur_rengoering",
    smoke_oven: "roegeovn_rengoering",
    proofing_cabinet: "rasteskab_rengoering"
  };

  // TEMPERATUR PER UNIT
  for (const unit of units) {
    const unitType = sanitizeEquipmentType(unit.type || unit.equipmentType || "");
    const unitId = sanitizeString(unit.id || unit.equipmentId || "", 180);
    if (!unitId || !unitType) continue;

    let guideKey = null;
    let cleanGuideKey = null;
    const label = unit.name || unit.displayName || unit.equipmentName || "Enhed";
    const equipmentMeta = {
      equipmentId: unitId,
      equipmentType: unitType,
      equipmentName: label,
      unitId,
      unitName: label,
      equipmentUnit: unitId
    };
    const temperatureRoutineKey = temperatureRoutineByType[unitType] || "";
    const cleaningRoutineKey = cleaningRoutineByType[unitType] || "";

    if (unitType === "fridge")           { guideKey = "fridge_temperature";          cleanGuideKey = "cleaning_control"; }
    if (unitType === "freezer")          { guideKey = "freezer_temperature";         cleanGuideKey = "cleaning_control"; }
    if (unitType === "walk_in_cooler")   { guideKey = "walkin_cooler_temperature";   cleanGuideKey = "cleaning_control"; }
    if (unitType === "walk_in_freezer")  { guideKey = "walk_in_freezer_temperature"; cleanGuideKey = "cleaning_control"; }
    if (unitType === "ice_machine")      { guideKey = "ice_machine_cleaning";        cleanGuideKey = "ice_machine_cleaning"; }
    if (unitType === "ice_box" || unitType === "isboks") { guideKey = "freezer_temperature"; cleanGuideKey = "cleaning_control"; }
    if (unitType === "fryer" || unitType === "friture")  { cleanGuideKey = "friture_control"; }
    if (unitType === "dishwasher")       { guideKey = "dishwasher_control";          cleanGuideKey = "cleaning_control"; }
    if (unitType === "blast_chiller")    { guideKey = "blast_chiller_temperature";   cleanGuideKey = "cleaning_control"; }
    if (unitType === "display_fridge")   { guideKey = "display_fridge_temperature";  cleanGuideKey = "cleaning_control"; }
    if (unitType === "warming_cabinet")  { guideKey = "warming_cabinet_temperature"; cleanGuideKey = "cleaning_control"; }
    if (unitType === "softice_machine")  { guideKey = "softice_temperature";         cleanGuideKey = "softice_machine_cleaning"; }
    if (unitType === "oven" || unitType === "stove" || unitType === "smoke_oven" || unitType === "proofing_cabinet") {
      cleanGuideKey = "cleaning_control";
    }

    // Temperaturrutine (kun for kÃ¸le/fryse-enheder og friture)
    if (guideKey && temperatureRoutineKey && unitType !== "ice_machine") {
      const description = unitType === "blast_chiller"
        ? "Intern skÃ¦rpet kontrol: NedkÃ¸l til under +5Â°C inden for 90 min (ikke lovkrav)"
        : "Kontroller og registrer temperatur";
      
      await createTemplateIfNotExists({
        templateId: `${companyId}__${locationId}__temp__${unitId}`,
        ...baseMeta,
        templateKey: temperatureRoutineKey,
        taskKey: temperatureRoutineKey,
        routineKey: temperatureRoutineKey,
        routineType: temperatureRoutineKey,
        title: `Temperaturkontrol â€“ ${label}`,
        description: description,
        guideKey,
        frequency: "daily",
        ...equipmentMeta,
        scheduleConfig: {
          scheduleType: "operational",
          recurrenceMode: "every_n_days",
          recurrenceValue: 7,
          firstRunImmediately: false,
          useDailyObservation: true
        }
      });
    }

    // RengÃ¸ringsrutine per enhed
    if (cleanGuideKey && cleaningRoutineKey) {
      await createTemplateIfNotExists({
        templateId: `${companyId}__${locationId}__clean__${unitId}`,
        ...baseMeta,
        templateKey: cleaningRoutineKey,
        taskKey: cleaningRoutineKey,
        routineKey: cleaningRoutineKey,
        routineType: cleaningRoutineKey,
        title: `RengÃ¸ring â€“ ${label}`,
        description: `RengÃ¸r og desinficer ${label.toLowerCase()} grundigt`,
        guideKey: cleanGuideKey,
        frequency: unitType === "fridge" || unitType === "freezer" || unitType === "ice_box" || unitType === "isboks" ? "weekly" : "daily",
        ...equipmentMeta
      });
    }
  }

  // LOG A: After template creation/update
  const tempTemplateCount = units.filter(u => 
    u.type === "fridge" || u.type === "freezer" || u.type === "walk_in_cooler" || 
    u.type === "walk_in_freezer" || u.type === "isboks" || u.type === "friture" || u.type === "blast_chiller"
  ).length;
  
  console.log(`[LOG A - ensureEgenkontrolTaskTemplates] Temperature templates processed: ${tempTemplateCount}`);
  for (const unit of units) {
    if (unit.type === "fridge" || unit.type === "freezer" || unit.type === "walk_in_cooler" || 
        unit.type === "walk_in_freezer" || unit.type === "isboks" || unit.type === "friture" || unit.type === "blast_chiller") {
      const templateId = `${companyId}__${locationId}__temp__${unit.id}`;
      console.log(`[LOG A] Temperature template: ${templateId}`, {
        title: `Temperaturkontrol â€“ ${unit.name || "Enhed"}`,
        templateType: "operational",
        unitId: unit.id,
        unitType: unit.type,
        unitName: unit.name
      });
    }
  }
  
  return { ok: true };
}

async function ensureEquipmentTemperatureControl(db, locationId, unit) {
  if (!unit || !unit.id) {
    console.warn("[ensureEquipmentTemperatureControl] missing unit or unit.id");
    return unit;
  }

  const unitType = sanitizeEquipmentType(unit.type || unit.equipmentType || "");
  
  // Kun relevante typer fÃ¥r temperatureControl
  const temperatureRelevantTypes = [
    "fridge", "freezer", "walk_in_cooler", "walk_in_freezer",
    "display_fridge", "isboks", "ice_machine", "softice_machine"
  ];
  
  if (!temperatureRelevantTypes.includes(unitType)) {
    return unit;
  }

  const existing = unit.temperatureControl || {};

  // Default settings
  const defaults = {
    enabled: true,
    useGlobalSchedule: true,
    useDailyObservation: true,
    overrideSchedule: null
  };

  // Merge: bevar eksisterende brugerdata, tilfÃ¸j kun manglende felter
  const merged = {
    enabled: existing.enabled !== undefined ? existing.enabled : defaults.enabled,
    useGlobalSchedule: existing.useGlobalSchedule !== undefined ? existing.useGlobalSchedule : defaults.useGlobalSchedule,
    useDailyObservation: existing.useDailyObservation !== undefined ? existing.useDailyObservation : defaults.useDailyObservation,
    overrideSchedule: existing.overrideSchedule || defaults.overrideSchedule
  };

  // Kun opdater hvis der er Ã¦ndringer
  const needsUpdate = JSON.stringify(existing) !== JSON.stringify(merged);
  
  if (needsUpdate) {
    const unitRef = db.collection("equipment").doc(unit.id);
    await unitRef.update({
      temperatureControl: merged,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`[ensureEquipmentTemperatureControl] Updated temperatureControl for unit ${unit.id}`);
  }

  // Returner unit med opdateret temperatureControl
  return {
    ...unit,
    temperatureControl: merged
  };
}

function buildEquipmentRuntimeFlags(equipmentType = "", controlTypes = []) {
  const type = sanitizeEquipmentType(equipmentType);
  const temperatureTypes = new Set([
    "fridge",
    "freezer",
    "walk_in_cooler",
    "walk_in_freezer",
    "display_fridge",
    "ice_box",
    "blast_chiller",
    "warming_cabinet",
    "softice_machine"
  ]);
  const limits = {
    fridge: { minTemp: 0, maxTemp: 5 },
    freezer: { minTemp: -30, maxTemp: -18 },
    walk_in_cooler: { minTemp: 0, maxTemp: 5 },
    walk_in_freezer: { minTemp: -30, maxTemp: -18 },
    display_fridge: { minTemp: 0, maxTemp: 5 },
    ice_box: { minTemp: -30, maxTemp: -18 },
    blast_chiller: { minTemp: 0, maxTemp: 5 },
    warming_cabinet: { minTemp: 65, maxTemp: null },
    softice_machine: { minTemp: 0, maxTemp: 5 }
  };
  const temperatureRequired = temperatureTypes.has(type) || controlTypes.includes("temperature_check");
  return {
    haccpRelevant: true,
    routineRelevant: true,
    temperatureRequired,
    minTemp: limits[type]?.minTemp ?? null,
    maxTemp: limits[type]?.maxTemp ?? null,
    cleaningRequired: true,
    cleaningFrequency: ["freezer", "walk_in_freezer", "ice_box"].includes(type) ? "monthly" : "weekly",
    serviceRequired: true,
    serviceFrequency: "yearly",
    calibrationRequired: temperatureRequired,
    calibrationFrequency: temperatureRequired ? "yearly" : ""
  };
}

function buildEquipmentDocId({ companyId, locationId, equipmentType, unitNumber }) {
  return `onboarding__${buildEquipmentSeedKey({ companyId, locationId, equipmentType, unitNumber }).slice(0, 170)}`;
}

function buildEquipmentSeedKey({ companyId, locationId, equipmentType, unitNumber }) {
  return [
    toDocSafeId(companyId || "company"),
    toDocSafeId(locationId || "location"),
    toDocSafeId(equipmentType || "equipment"),
    toPositiveInt(unitNumber) || 1
  ].join("__");
}

function parseEquipmentUnitNumberFromId(id = "", equipmentType = "") {
  const raw = String(id || "");
  const scopedMatch = raw.match(/__(\d+)$/);
  if (scopedMatch) return toPositiveInt(scopedMatch[1]);

  const legacyPrefix = `onboarding_${equipmentType}_`;
  if (equipmentType && raw.startsWith(legacyPrefix)) {
    return toPositiveInt(raw.slice(legacyPrefix.length));
  }

  const trailingMatch = raw.match(/_(\d+)$/);
  return trailingMatch ? toPositiveInt(trailingMatch[1]) : 0;
}

function normalizeEquipmentCounts(rawCounts = {}, profile = {}) {
  const result = {};
  for (const mapping of EQUIPMENT_COUNT_MAPPING) {
    let count = 0;
    for (const key of mapping.countKeys) {
      const val = rawCounts[key] != null ? rawCounts[key] : profile[key];
      if (val != null) {
        count = toPositiveInt(val);
        break;
      }
    }
    // Boolean fallbacks for single-unit types
    if (count === 0 && mapping.equipmentType === "walk_in_cooler" && profile.hasWalkInCooler) count = 1;
    if (count === 0 && mapping.equipmentType === "walk_in_freezer" && profile.hasWalkInFreezer) count = 1;
    if (count === 0 && mapping.equipmentType === "ice_machine"     && profile.hasIceMachine)    count = 1;
    if (count === 0 && mapping.equipmentType === "softice_machine" && profile.hasSofticeachine) count = 1;
    if (count === 0 && mapping.equipmentType === "ice_box"         && profile.hasIsboks)        count = 1;
    result[mapping.equipmentType] = count;
  }
  return result;
}

async function getLexiCustomerStatusPayload({ companyId, locationId }) {
  const todayKey = getDateKey();
  const operatingMode = await getOperatingModeForLocation({
    companyId,
    locationId,
    todayKey
  });

  // Ensure location has temperature control settings for new schedule system
  let locationTemperatureSettings = null;
  try {
    locationTemperatureSettings = await ensureLocationTemperatureSettings(db, companyId, locationId, todayKey);
  } catch (err) {
    console.warn("[getLexiCustomerStatusPayload] ensureLocationTemperatureSettings failed:", err.message);
  }

  // Load equipment units with temperatureControl settings
  const equipmentUnitMap = new Map();
  try {
    const equipmentSnap = await db.collection("equipment")
      .where("locationId", "==", locationId)
      .get();
    
    for (const equipmentDoc of equipmentSnap.docs) {
      const equipment = equipmentDoc.data() || {};
      if (equipment.active === false) continue;
      const normalized = {
        id: equipmentDoc.id,
        type: sanitizeEquipmentType(equipment.type || equipment.equipmentType),
        temperatureControl: equipment.temperatureControl || null
      };
      
      try {
        const normalizedUnit = await ensureEquipmentTemperatureControl(db, locationId, normalized);
        if (normalizedUnit.temperatureControl) {
          normalized.temperatureControl = normalizedUnit.temperatureControl;
        }
      } catch (err) {
        console.warn(`[getLexiCustomerStatusPayload] ensureEquipmentTemperatureControl failed for ${normalized.id}:`, err.message);
      }
      
      equipmentUnitMap.set(normalized.id, normalized);
    }
  } catch (err) {
    console.warn("[getLexiCustomerStatusPayload] Failed to load equipment:", err.message);
  }

  const [templateDocs] = await Promise.all([
    loadActiveTaskTemplates({ companyId, locationId })
  ]);

  const routineChecks = await Promise.all(templateDocs.map(async (doc) => {
    const template = doc.data() || {};
    const taskId = sanitizeString(template.taskId, 120);

    try {
      // Resolve schedule configuration combining template, location and unit settings
      const equipmentUnitId = template.equipmentUnit || template.equipmentId || "";
      const unitForTemplate = equipmentUnitId ? equipmentUnitMap.get(equipmentUnitId) : null;
      
      const resolvedSchedule = resolveTemplateSchedule({
        template,
        locationTemperatureSettings,
        unitTemperatureControl: unitForTemplate?.temperatureControl || null,
        todayKey
      });

      // Check if unit is disabled - skip if so
      if (resolvedSchedule && resolvedSchedule.enabled === false) {
        return { dueToday: false };
      }

      const lastCompletedDateKey = taskId
        ? await getLastCompleted(taskId, locationId)
        : null;
      
      // Use new schedule system if available, otherwise fallback to legacy
      let dueToday = false;
      if (resolvedSchedule && resolvedSchedule.useNewSchedule) {
        const anchorDate = resolvedSchedule.anchorDate || locationTemperatureSettings?.anchorDate || todayKey;
        dueToday = shouldRunToday(resolvedSchedule, todayKey, anchorDate, lastCompletedDateKey);
      } else {
        dueToday = isDueToday(template, todayKey, lastCompletedDateKey);
      }
      
      // Debug logging for schedule consistency validation
      console.log("[SCHEDULE_DEBUG]", {
        templateId: doc.id,
        taskId: taskId,
        hasScheduleConfig: !!template.scheduleConfig,
        resolvedSchedule: resolvedSchedule ? {
          useNewSchedule: resolvedSchedule.useNewSchedule,
          enabled: resolvedSchedule.enabled,
          scheduleType: resolvedSchedule.scheduleType,
          recurrenceMode: resolvedSchedule.recurrenceMode,
          recurrenceValue: resolvedSchedule.recurrenceValue
        } : null,
        lastCompletedDateKey: lastCompletedDateKey,
        dueToday: dueToday,
        source: "lexi"
      });
      
      return { dueToday };
    } catch (error) {
      console.error(`Kunne ikke beregne rutine for template ${doc.id}:`, error);
      return { dueToday: true };
    }
  }));

  const totalActive = routineChecks.length;
  const dueToday = routineChecks.filter((routine) => routine.dueToday).length;
  const status = resolveLexiStatus({ operatingMode, totalActive, dueToday });

  return {
    source: "madkontrol",
    companyId,
    locationId,
    dateKey: todayKey,
    operatingMode,
    status,
    antal_rutiner: totalActive,
    antal_forfaldne_rutiner: dueToday
  };
}

function resolveLexiStatus({ operatingMode, totalActive, dueToday }) {
  if (operatingMode === "closed") return "lukket";
  if (operatingMode === "vacation") return "ferie";
  if (totalActive <= 0) return "ingen_rutiner";
  if (dueToday > 0) return "mangler_opgaver";
  return "opdateret";
}

function isDueToday(template, todayKey, lastCompletedDateKey, prefix = "frequency") {
  const config = parseFrequencyConfig(template, prefix);
  const type = config.type;
  const days = config.days;
  const startDate = template.startDate || todayKey;

  if (todayKey < startDate) return false;

  if (type === "daily") return true;

  if (type === "weekdays") {
    const weekday = getWeekdayFromDateKey(todayKey);
    return weekday !== 0 && weekday !== 6;
  }

  if (type === "weekends") {
    const weekday = getWeekdayFromDateKey(todayKey);
    return weekday === 0 || weekday === 6;
  }

  if (type === "interval_days") {
    if (!lastCompletedDateKey) {
      return true;
    }

    const nextDue = addDays(lastCompletedDateKey, days);
    return todayKey >= nextDue;
  }
  return true;
}

function shouldRunToday(scheduleConfig, todayKey, anchorDateKey, lastCompletedDateKey) {
  if (!scheduleConfig) return false;

  const scheduleType = scheduleConfig.scheduleType || "operational";
  const firstRunImmediately = scheduleConfig.firstRunImmediately === true;
  let recurrenceMode = scheduleConfig.documentedIntervalMode || scheduleConfig.recurrenceMode || "daily";

  // Alias: writers emit "interval_days" / "days" for the same "every N days" cadence
  // that this function implements under the "every_n_days" branch. Normalize so the
  // existing every_n_days logic is reused unchanged.
  if (recurrenceMode === "interval_days" || recurrenceMode === "days") {
    recurrenceMode = "every_n_days";
  }

  const recurrenceValue = Number(scheduleConfig.documentedIntervalValue || scheduleConfig.recurrenceValue || 1);
  const weekdays = scheduleConfig.weekdays || [];
  const monthDays = scheduleConfig.monthDays || [];
  const anchor = anchorDateKey || todayKey;

  if (scheduleType === "event_driven") return false;

  if (scheduleType === "maintenance") {
    if (firstRunImmediately && !lastCompletedDateKey) {
      console.log("[shouldRunToday] Maintenance task - first run immediately");
      return true;
    }
    if (!lastCompletedDateKey) return false;
    
    const yearlyInterval = recurrenceMode === "yearly" ? (recurrenceValue || 1) * 365 : 365;
    const nextDue = addDays(lastCompletedDateKey, yearlyInterval);
    const due = todayKey >= nextDue;
    console.log("[shouldRunToday] Maintenance task - yearly check", { lastCompletedDateKey, nextDue, todayKey, due });
    return due;
  }

  if (todayKey < anchor) return false;

  if (recurrenceMode === "daily") return true;

  if (recurrenceMode === "every_n_days") {
    if (!lastCompletedDateKey) {
      console.log("[shouldRunToday] every_n_days - no completion, using anchor", { anchor, todayKey });
      const daysSinceAnchor = daysBetween(anchor, todayKey);
      const due = daysSinceAnchor % recurrenceValue === 0;
      console.log("[shouldRunToday] every_n_days from anchor", { daysSinceAnchor, recurrenceValue, due });
      return due;
    }
    const nextDue = addDays(lastCompletedDateKey, recurrenceValue);
    const due = todayKey >= nextDue;
    console.log("[shouldRunToday] every_n_days from last completion", { lastCompletedDateKey, nextDue, todayKey, recurrenceValue, due });
    return due;
  }

  if (recurrenceMode === "weekly_days") {
    if (weekdays.length === 0) return false;
    const weekday = getWeekdayFromDateKey(todayKey);
    return weekdays.includes(weekday);
  }

  if (recurrenceMode === "monthly") {
    if (monthDays.length === 0) return false;
    const day = Number(todayKey.slice(8, 10));
    return monthDays.includes(day);
  }

  if (recurrenceMode === "yearly") {
    if (!lastCompletedDateKey) {
      const daysSinceAnchor = daysBetween(anchor, todayKey);
      return daysSinceAnchor % 365 === 0;
    }
    const nextDue = addDays(lastCompletedDateKey, 365);
    return todayKey >= nextDue;
  }

  return false;
}

async function getLastCompleted(taskId, locationId) {
  if (!taskId || !locationId) return null;

  const snap = await db
    .collection("task_entries")
    .where("taskId", "==", taskId)
    .where("locationId", "==", locationId)
    .get();

  if (snap.empty) return null;

  let latest = null;
  for (const doc of snap.docs) {
    const dateKey = normalizeDateKey(doc.data()?.dateKey);
    if (!dateKey) continue;
    if (!latest || dateKey > latest) {
      latest = dateKey;
    }
  }

  return latest;
}

function resolveTemplateSchedule({
  template,
  locationTemperatureSettings = null,
  unitTemperatureControl = null,
  todayKey = null
}) {
  if (!template) return null;

  const templateKey = sanitizeString(template.templateKey || "", 80);
  const isTemperatureTemplate = templateKey === "temperature_control" || 
                                 (template.controlType || "").toLowerCase() === "temperature_check";

  // Regel 1: Hvis template har scheduleConfig, brug det som basis
  if (template.scheduleConfig && typeof template.scheduleConfig === "object") {
    const config = template.scheduleConfig;
    
    // Regel 3: Check unit override for temperature templates
    if (isTemperatureTemplate && unitTemperatureControl) {
      // Hvis unit er disabled, returner disabled schedule
      if (unitTemperatureControl.enabled === false) {
        return {
          enabled: false,
          useNewSchedule: true
        };
      }
      
      // Hvis unit har override og ikke bruger global schedule
      if (unitTemperatureControl.useGlobalSchedule === false && unitTemperatureControl.overrideSchedule) {
        const override = unitTemperatureControl.overrideSchedule;
        return {
          enabled: true,
          useNewSchedule: true,
          scheduleType: config.scheduleType || "operational",
          recurrenceMode: override.documentedIntervalMode || override.recurrenceMode || "every_n_days",
          recurrenceValue: Number(override.documentedIntervalValue || override.recurrenceValue || 7),
          anchorDate: override.anchorDate || (locationTemperatureSettings?.anchorDate) || todayKey,
          firstRunImmediately: config.firstRunImmediately === true,
          useDailyObservation: override.useDailyObservation !== false,
          weekdays: override.weekdays || [],
          monthDays: override.monthDays || []
        };
      }
    }
    
    // Regel 2: Temperature template med location settings
    if (isTemperatureTemplate && locationTemperatureSettings && locationTemperatureSettings.enabled !== false) {
      return {
        enabled: true,
        useNewSchedule: true,
        scheduleType: config.scheduleType || "operational",
        recurrenceMode: locationTemperatureSettings.documentedIntervalMode || config.documentedIntervalMode || "every_n_days",
        recurrenceValue: Number(locationTemperatureSettings.documentedIntervalValue || config.documentedIntervalValue || 7),
        anchorDate: locationTemperatureSettings.anchorDate || todayKey,
        firstRunImmediately: config.firstRunImmediately === true,
        useDailyObservation: locationTemperatureSettings.useDailyObservation !== false,
        weekdays: config.weekdays || [],
        monthDays: config.monthDays || []
      };
    }
    
    // Standard scheduleConfig uden overrides
    return {
      enabled: true,
      useNewSchedule: true,
      scheduleType: config.scheduleType || "operational",
      recurrenceMode: config.documentedIntervalMode || config.recurrenceMode || "daily",
      recurrenceValue: Number(config.documentedIntervalValue || config.recurrenceValue || 1),
      anchorDate: config.anchorDate || template.startDate || todayKey,
      firstRunImmediately: config.firstRunImmediately === true,
      useDailyObservation: config.useDailyObservation === true,
      weekdays: config.weekdays || [],
      monthDays: config.monthDays || []
    };
  }
  
  // Regel 4: Default schedule for templates without scheduleConfig.
  // Do not fall back to legacy isDueToday(), because that path can make
  // interval-based templates due too often when no completion exists yet.
  return {
    useNewSchedule: true,
    enabled: true,
    scheduleType: "operational",
    recurrenceMode: template.frequency || "every_n_days",
    recurrenceValue: 7,
    anchorDate: template.startDate || todayKey
  };
}

async function loadActiveTaskTemplates({ companyId, locationId }) {
  const refsByPath = new Map();
  const variants = [
    { companyField: "companyId", companyValue: companyId, locationValue: locationId },
    { companyField: "organizationId", companyValue: companyId, locationValue: locationId },
    { companyField: "companyId", companyValue: companyId, locationValue: toLegacyId(locationId) },
    { companyField: "organizationId", companyValue: companyId, locationValue: toLegacyId(locationId) }
  ].filter((variant) => variant.companyValue && variant.locationValue);

  for (const variant of variants) {
    const normalizedCompanyValue = sanitizeString(variant.companyValue, 120);
    const normalizedLocationValue = sanitizeString(variant.locationValue, 120);
    if (!normalizedCompanyValue || !normalizedLocationValue) continue;

    const snapshot = await db
      .collection("task_templates")
      .where(variant.companyField, "==", normalizedCompanyValue)
      .where("locationId", "==", normalizedLocationValue)
      .get();

    for (const doc of snapshot.docs) {
      refsByPath.set(doc.ref.path, doc);
    }
  }

  return Array.from(refsByPath.values()).filter((doc) => {
    const data = doc.data() || {};
    if (data.isActive === false) return false;
    if (data.active === false) return false;
    return true;
  });
}

async function ensureLocationTemperatureSettings(db, companyId, locationId, todayKey) {
  if (!companyId || !locationId) {
    console.warn("[ensureLocationTemperatureSettings] missing companyId or locationId");
    return null;
  }

  const locationRef = db.collection("companies").doc(companyId)
    .collection("locations").doc(locationId);
  
  const locationSnap = await locationRef.get();
  
  if (!locationSnap.exists) {
    console.warn(`[ensureLocationTemperatureSettings] location ${locationId} does not exist`);
    return null;
  }

  const locationData = locationSnap.data() || {};
  const existing = locationData.temperatureControlSettings || {};

  // Default settings
  const defaults = {
    enabled: true,
    documentedIntervalMode: "every_n_days",
    documentedIntervalValue: 7,
    anchorDate: todayKey || getDateKey(),
    defaultTimes: ["09:00"],
    appliesTo: {
      fridge: true,
      freezer: true
    },
    useDailyObservation: true
  };

  // Merge: bevar eksisterende brugerdata, tilfÃ¸j kun manglende felter
  const merged = {
    enabled: existing.enabled !== undefined ? existing.enabled : defaults.enabled,
    documentedIntervalMode: existing.documentedIntervalMode || defaults.documentedIntervalMode,
    documentedIntervalValue: existing.documentedIntervalValue !== undefined 
      ? Number(existing.documentedIntervalValue) 
      : defaults.documentedIntervalValue,
    anchorDate: existing.anchorDate || defaults.anchorDate,
    defaultTimes: Array.isArray(existing.defaultTimes) && existing.defaultTimes.length > 0
      ? existing.defaultTimes
      : defaults.defaultTimes,
    appliesTo: existing.appliesTo && typeof existing.appliesTo === "object"
      ? { ...defaults.appliesTo, ...existing.appliesTo }
      : defaults.appliesTo,
    useDailyObservation: existing.useDailyObservation !== undefined 
      ? existing.useDailyObservation 
      : defaults.useDailyObservation
  };

  // Kun opdater hvis der er Ã¦ndringer
  const needsUpdate = JSON.stringify(existing) !== JSON.stringify(merged);
  
  if (needsUpdate) {
    await locationRef.update({
      temperatureControlSettings: merged,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`[ensureLocationTemperatureSettings] Updated settings for location ${locationId}`);
  }

  return merged;
}

async function getOperatingModeForLocation({ companyId, locationId, todayKey }) {
  const queries = [
    db.collection("operating_overrides")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .limit(1),
    db.collection("operating_overrides")
      .where("locationId", "==", locationId)
      .limit(1)
  ];

  for (const q of queries) {
    const snap = await q.get();
    if (snap.empty) continue;

    const mode = resolveOperatingMode(snap.docs[0].data() || {}, todayKey);
    if (mode !== "open") return mode;
  }

  return "open";
}

function resolveOperatingMode(data, todayKey) {
  if (!data || data.isActive === false) return "open";

  const untilDateKey =
    normalizeDateKey(data.untilDateKey) ||
    normalizeDateKey(data.until) ||
    normalizeDateKey(data.endDate);

  const stillValid = !untilDateKey || todayKey <= untilDateKey;
  if (!stillValid) return "open";

  if (data.closed === true) return "closed";
  if (data.vacation === true) return "vacation";
  return "open";
}

function buildComparableInstancePayload(data) {
  const out = {};
  for (const field of INSTANCE_COMPARABLE_FIELDS) {
    out[field] = stableNormalize(data[field] !== undefined ? data[field] : null);
  }
  return out;
}

function stableNormalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && !Array.isArray(value) && value.constructor?.name === "Timestamp") {
    // Firestore Timestamp â€” convert to ms for stable comparison
    return typeof value.toMillis === "function" ? value.toMillis() : String(value);
  }
  if (Array.isArray(value)) {
    return value.map(stableNormalize).sort((a, b) => {
      const sa = JSON.stringify(a) || "";
      const sb = JSON.stringify(b) || "";
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
  }
  if (typeof value === "object") {
    const sorted = {};
    for (const k of Object.keys(value).sort()) sorted[k] = stableNormalize(value[k]);
    return sorted;
  }
  return value;
}

function diffComparableFields(existingComparable, nextComparable) {
  const changed = [];
  for (const field of INSTANCE_COMPARABLE_FIELDS) {
    if (JSON.stringify(existingComparable[field]) !== JSON.stringify(nextComparable[field])) {
      changed.push(field);
    }
  }
  return changed;
}

function materiallyEqualInstance(existingDocData, nextData) {
  const a = buildComparableInstancePayload(existingDocData || {});
  const b = buildComparableInstancePayload(nextData || {});
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildTaskDeadlineMeta(template, todayKey) {
  const execution = parseFrequencyConfig(template, "frequency");
  const registration = parseFrequencyConfig(template, "registrationFrequency");
  const cadenceDays = Math.max(execution.days || 1, registration.days || 1);
  const usesInterval = execution.type === "interval_days" || registration.type === "interval_days";

  if (!usesInterval || cadenceDays < 7) {
    return {
      deadlineAt: "",
      overduePolicy: "",
      overdueExplanationRequired: false
    };
  }

  return {
    deadlineAt: `${todayKey}T23:59:59`,
    overduePolicy: "end_of_day",
    overdueExplanationRequired: true
  };
}

function buildStartDayTargets({ template, templateDocId, equipmentByType, allEquipment, areas }) {
  const controlType = (template.controlType || "").toLowerCase();
  const docId = (templateDocId || "").toLowerCase();
  const routineType = sanitizeString(template.routineType || template.templateKey || template.taskKey || "", 120).toLowerCase();

  // If template is pinned to a specific unit, return only that unit (no cross-join)
  if (template.equipmentId) {
    const unit = allEquipment.find(u => u.id === template.equipmentId);
    if (!unit) return [];
    return [{
      suffix:        unit.id,
      equipmentId:   unit.id,
      equipmentType: unit.type,
      equipmentName: unit.displayName || unit.name || unit.id
    }];
  }

  const routineEquipmentTypes = {
    paalaegsmaskine_rengoering: ["slicer", "paalaegsmaskine", "slicing_machine"],
    softice_maskine_rengoering: ["softice_machine", "ice_machine", "ismaskine"]
  };

  if (routineEquipmentTypes[routineType]) {
    const units = getEquipmentByAnyType(equipmentByType, routineEquipmentTypes[routineType]);
    if (units.length === 0) return [];
    return units.map((u) => ({
      suffix:        u.id,
      equipmentId:   u.id,
      equipmentType: u.type,
      equipmentName: u.displayName || u.name || u.id
    }));
  }

  if (controlType === "temperature_check") {
    // Prefer explicit equipmentType on template, else infer from doc ID
    const templateEqType = sanitizeEquipmentType(template.equipmentType || "");
    let lookupKey = templateEqType;
    if (!lookupKey) {
      if (docId.includes("walk_in_cooler"))  lookupKey = "walk_in_cooler";
      else if (docId.includes("walk_in_freezer")) lookupKey = "walk_in_freezer";
      else if (docId.includes("display"))    lookupKey = "display_fridge";
      else if (docId.includes("softice"))    lookupKey = "softice_machine";
      else if (docId.includes("fridge"))     lookupKey = "fridge";
      else if (docId.includes("freezer"))    lookupKey = "freezer";
    }
    const units = lookupKey ? (equipmentByType[lookupKey] || []) : [];
    // ingen generisk fallback â€” hvis ingen units, skip template
    if (units.length === 0) return [];
    return units.map((u) => ({
      suffix:        u.id,
      equipmentId:   u.id,
      equipmentType: u.type,
      equipmentName: u.displayName || u.name || u.id
    }));
  }

  // Generic per-unit expansion: any template with explicit equipmentType (e.g. cleaning_check)
  const explicitEqType = sanitizeEquipmentType(template.equipmentType || "");
  if (explicitEqType) {
    const units = equipmentByType[explicitEqType] || [];
    if (units.length === 0) return [];
    return units.map((u) => ({
      suffix:        u.id,
      equipmentId:   u.id,
      equipmentType: u.type,
      equipmentName: u.displayName || u.name || u.id
    }));
  }

  return [{ suffix: "default" }];
}

function getEquipmentByAnyType(equipmentByType, types = []) {
  const seen = new Set();
  const units = [];

  for (const rawType of types) {
    const type = sanitizeEquipmentType(rawType);
    const matches = equipmentByType[type] || [];
    for (const unit of matches) {
      if (!unit?.id || seen.has(unit.id)) continue;
      seen.add(unit.id);
      units.push(unit);
    }
  }

  return units;
}

async function getExistingTaskInstanceMap({ companyId, locationId, todayKey }) {
  const snapshot = await db
    .collection("task_instances")
    .where("locationId", "==", locationId)
    .where("dateKey", "==", todayKey)
    .get();

  const taskMap = new Map();

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const organizationId = sanitizeString(data.companyId || data.organizationId, 120);
    if (companyId && organizationId && organizationId !== companyId) continue;

    // NÃ¸glen er doc.id â€” kompatibel med nyt templateDocId__[equipmentId__]dateKey skema
    taskMap.set(doc.id, {
      ref: doc.ref,
      data
    });
  }

  return taskMap;
}

function buildSyntheticEquipmentFromCounts(counts = {}) {
  const equipment = [];

  for (const [rawType, rawCount] of Object.entries(counts || {})) {
    const type = sanitizeEquipmentType(rawType);
    if (!type) continue;

    const count = toPositiveInt(rawCount);
    if (count <= 0) continue;

    for (let i = 1; i <= count; i++) {
      const label = `${prettyEquipmentTypeName(type)} ${i}`;
      equipment.push({
        id: `onboarding_${type}_${i}`,
        type,
        name: label,
        displayName: label
      });
    }
  }

  return equipment;
}

function prettyEquipmentTypeName(type) {
  const map = {
    fridge: "KÃ¸leskab",
    freezer: "Fryser",
    dishwasher: "Opvaskemaskine",
    warming_cabinet: "Varmeskab",
    blast_chiller: "Blast chiller",
    display_fridge: "DisplaykÃ¸l"
  };
  const normalized = sanitizeEquipmentType(type);
  return map[normalized] || normalized || "Maskine";
}

async function getOnboardingEquipmentCounts({ companyId, locationId }) {
  const byLocation = await db
    .collection("onboarding_answers")
    .where("locationId", "==", locationId)
    .limit(1)
    .get();

  let data = byLocation.empty ? null : (byLocation.docs[0].data() || {});

  if (!data) {
    const byCompanyAndLocation = await db
      .collection("onboarding_answers")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .limit(1)
      .get();

    data = byCompanyAndLocation.empty ? null : (byCompanyAndLocation.docs[0].data() || {});
  }

  const counts = data?.equipmentCounts || {};

  return {
    rawCounts: counts,
    fridges:
      toPositiveInt(counts.fridge) ||
      toPositiveInt(counts.fridges) ||
      toPositiveInt(counts.koleskab) ||
      toPositiveInt(counts.koleskabe) ||
      toPositiveInt(counts["køleskab"]) ||
      toPositiveInt(counts["køleskabe"]),
    freezers:
      toPositiveInt(counts.freezer) ||
      toPositiveInt(counts.freezers) ||
      toPositiveInt(counts.fryser) ||
      toPositiveInt(counts.frysere)
  };
}

function shouldGenerateDailyRoutineTemplate(template) {
  const templateSource = template.templateSource || template.source || "";
  const templateType = (template.templateType || "").toLowerCase();
  const category = (template.category || "").toLowerCase();
  const controlType = (template.controlType || "").toLowerCase();
  const taskType = (template.taskType || "").toLowerCase();
  const guideKey = (template.guideKey || "").toLowerCase();
  const title = (template.title || "").toLowerCase();

  const blocked = (
    templateSource === "equipment_maintenance_library" ||
    templateType === "maintenance" ||
    category === "vedligeholdelse" ||
    controlType === "maintenance_check" ||
    taskType === "vedligeholdelse" ||
    title.startsWith("vedligeholdelse -") ||
    title.includes("drikkevand")
  );

  if (blocked) return false;

  return templateType === "operational";
}

function normalizeCheckoutOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return CHECKOUT_FALLBACK_ORIGIN;

  try {
    const parsed = new URL(raw);
    const host = String(parsed.hostname || "").toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";

    if (host === "madkontrollen.dk" || host === "www.madkontrollen.dk") {
      return "https://madkontrollen.dk";
    }

    if (!isAllowedCheckoutHost(host)) {
      return CHECKOUT_FALLBACK_ORIGIN;
    }

    if (isLocal) {
      const port = parsed.port ? `:${parsed.port}` : "";
      return `http://${host}${port}`;
    }

    return `https://${host}`;
  } catch (_error) {
    return CHECKOUT_FALLBACK_ORIGIN;
  }
}

function isAllowedCheckoutHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return false;
  if (host === "madkontrollen.dk") return true;
  if (host === "www.madkontrollen.dk") return true;
  if (host === "madkontrollen.web.app") return true;
  if (host === "localhost") return true;
  if (host === "127.0.0.1") return true;
  return host.endsWith(".madkontrollen.dk");
}

function sanitizeAddonKeys(raw) {
  if (!Array.isArray(raw)) return [];

  const keys = raw
    .map((item) => String(item || "").trim())
    .filter((key) => Object.prototype.hasOwnProperty.call(ADDON_CATALOG, key));

  return [...new Set(keys)];
}

function getStripeClient() {
  const { secretKey } = getStripeConfig();
  return new Stripe(secretKey, { apiVersion: "2023-10-16" });
}

function getStripeConfig() {
  const config = FUNCTIONS_CONFIG.value();

  if (!config || typeof config !== "object") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "FUNCTIONS_CONFIG_EXPORT mangler eller er ikke et JSON object."
    );
  }

  if (!config.stripe || typeof config.stripe !== "object") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "FUNCTIONS_CONFIG_EXPORT.stripe mangler."
    );
  }

  const secretKey = String(config.stripe.secret_key || "").trim();
  const priceMonthly = String(config.stripe.price_monthly || "").trim();
  const priceYearly = String(config.stripe.price_yearly || "").trim();

  if (!secretKey.startsWith("sk_")) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stripe secret_key mangler eller er ugyldig i FUNCTIONS_CONFIG_EXPORT.stripe.secret_key."
    );
  }

  if (!priceMonthly.startsWith("price_")) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stripe monthly price mangler eller er ugyldig i FUNCTIONS_CONFIG_EXPORT.stripe.price_monthly."
    );
  }

  if (!priceYearly.startsWith("price_")) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stripe yearly price mangler eller er ugyldig i FUNCTIONS_CONFIG_EXPORT.stripe.price_yearly."
    );
  }

  return {
    secretKey,
    priceMonthly,
    priceYearly
  };
}

function buildCheckoutModuleAccess(selectedModules = [], source = "onboarding_checkout") {
  return selectedModules.reduce((acc, moduleKey) => {
    acc[moduleKey] = {
      enabled: true,
      status: "active",
      source,
      activatedAt: FieldValue.serverTimestamp()
    };
    return acc;
  }, {});
}

function buildOnboardingSummary({ profile = {}, riskModel = {}, customerName = "Velkommen" }) {
  return {
    customerName,
    companyName: sanitizeString(profile.companyName, 140),
    companyType: sanitizeString(profile.companyType || riskModel.companyType, 80) || "Restaurant",
    city: sanitizeString(profile.city, 80),
    criticalPoints: deriveCriticalPoints(riskModel)
  };
}

function deriveCriticalPoints(riskModel = {}) {
  const controls = sanitizeStringList(riskModel.controls, 10, 160);
  if (controls.length) {
    return controls.slice(0, 3);
  }

  return toArray(riskModel.hazards)
    .map((hazard) => sanitizeString(hazard?.name, 160))
    .filter(Boolean)
    .slice(0, 3);
}

function deriveCustomerName({ profile = {}, userData = {}, email = "" }) {
  const rawName =
    sanitizeString(profile.ownerName || profile.contactName, 120) ||
    sanitizeString(userData.displayName || userData.name || userData.fullName, 120) ||
    sanitizeString(String(email || "").split("@")[0], 80) ||
    "Velkommen";

  return sanitizeString(rawName.split(/\s+/)[0], 80) || "Velkommen";
}

function extractCloudinaryAssets(...candidates) {
  const assets = [];

  candidates.forEach((candidate) => {
    toArray(candidate).forEach((item) => {
      if (!item || typeof item !== "object") return;

      const asset = {
        assetId: sanitizeString(item.assetId || item.cloudinaryAssetId || item.id, 180),
        publicId: sanitizeString(item.publicId || item.cloudinaryPublicId, 240),
        url: sanitizeString(item.url || item.secureUrl || item.secure_url, 2000),
        thumbnailUrl: sanitizeString(item.thumbnailUrl || item.thumbnail_url, 2000),
        format: sanitizeString(item.format, 40),
        bytes: Number(item.bytes || 0) || 0,
        width: Number(item.width || 0) || 0,
        height: Number(item.height || 0) || 0,
        moduleType: sanitizeString(item.moduleType, 80),
        itemId: sanitizeString(item.itemId, 180),
        uploadedAt: sanitizeString(item.uploadedAt || item.createdAt, 80)
      };

      if (!asset.url && !asset.publicId && !asset.assetId) return;
      assets.push(asset);
    });
  });

  const deduped = [];
  const seen = new Set();

  assets.forEach((asset) => {
    const key = asset.assetId || asset.publicId || asset.url;
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(asset);
  });

  return deduped.slice(0, 50);
}

async function getOrCreateCompany(tx, input) {
  const { companyKey, keyType } = buildCompanyKey(input);

  const registryRef = db.collection("company_registry").doc(companyKey);
  const registrySnap = await tx.get(registryRef);

  // Registry hit: company already exists, return canonical companyId
  if (registrySnap.exists) {
    return {
      companyId: registrySnap.data().companyId,
      companyKey,
      keyType,
      alreadyExists: true
    };
  }

  // Generate canonical companyId (CVR-based or hash-based for uniqueness)
  let companyId = buildCanonicalCompanyId(input);
  let companyRef = db.collection("companies").doc(companyId);
  let companySnap = await tx.get(companyRef);

  // Collision check: if companies/{companyId} already exists, append suffix
  if (companySnap.exists) {
    const crypto = require("crypto");
    const collisionSuffix = crypto
      .createHash("sha256")
      .update(companyKey)
      .digest("hex")
      .slice(0, 6);
    
    companyId = `${companyId}_${collisionSuffix}`;
    companyRef = db.collection("companies").doc(companyId);
  }

  tx.set(companyRef, {
    companyId,
    companyKey,
    keyType,
    name: input.companyName || "",
    displayName: input.companyName || "",
    cvr: input.cvr || null,
    address: input.address || null,
    zip: input.zip || null,
    city: input.city || null,
    status: "pending_payment",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  tx.set(registryRef, {
    companyId,
    companyKey,
    keyType,
    createdAt: FieldValue.serverTimestamp()
  });

  return {
    companyId,
    companyKey,
    keyType,
    alreadyExists: false
  };
}

function buildCanonicalCompanyId(input) {
  const crypto = require("crypto");
  
  const slug = (input.companyName || "company")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const cleanCvr = String(input.cvr || "").replace(/\D/g, "");

  // Path 1: CVR findes â†’ slug + CVR (garanteret unik)
  if (/^\d{8}$/.test(cleanCvr)) {
    return `onboarding_${slug}_${cleanCvr}`;
  }

  // Path 2: Ingen CVR â†’ slug + stabil hash baseret pÃ¥ fallback-seed
  // Hash sikrer uniqueness selv ved samme company name
  const fallbackSeed = `${input.companyName || ""}_${input.address || ""}_${input.zip || ""}_${input.city || ""}`
    .toLowerCase()
    .replace(/\s+/g, "");
  
  const hash = crypto
    .createHash("sha256")
    .update(fallbackSeed)
    .digest("hex")
    .slice(0, 8);

  return `onboarding_${slug}_${hash}`;
}

function buildCompanyKey({ cvr, companyName, address, zip, city }) {
  const cleanCvr = String(cvr || "").replace(/\D/g, "");

  if (/^\d{8}$/.test(cleanCvr)) {
    return {
      companyKey: `cvr_${cleanCvr}`,
      keyType: "cvr"
    };
  }

  const slug = `${companyName}_${address}_${zip}_${city}` 
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 120);

  return {
    companyKey: `fallback_${slug}`,
    keyType: "fallback"
  };
}

function normalizeCheckoutSelectedModules(...sources) {
  const result = [];
  const pushValue = (value) => {
    if (Array.isArray(value)) {
      value.forEach(pushValue);
      return;
    }
    String(value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .forEach((item) => {
        const moduleKey = CHECKOUT_MODULE_ALIASES[item] || item;
        if (CHECKOUT_ALLOWED_MODULES.has(moduleKey) && !result.includes(moduleKey)) {
          result.push(moduleKey);
        }
      });
  };
  sources.forEach(pushValue);
  return result;
}

async function upsertWebsiteAndSeoPages({ companyId, locationId, config, activatedByUid }) {
  const subdomain = sanitizeString(config?.subdomain || "", 120);
  const businessName = sanitizeString(config?.businessName || "", 140);
  const description = sanitizeString(config?.description || "", 800);
  const selectedTemplate = sanitizeString(config?.selectedTemplate || "classic", 60) || "classic";
  const pageCount = parsePageCount(config?.pageCount, 50);
  const logoDataUrl = sanitizeString(config?.logoDataUrl || "", 500000);

  if (!subdomain) {
    throw new functions.https.HttpsError("invalid-argument", "Subdomaene mangler i generator-konfigurationen.");
  }

  const websiteId = toDocSafeId(`${companyId}__${locationId}__${subdomain}`);
  const websiteRef = db.collection("websites").doc(websiteId);

  await websiteRef.set({
    organizationId: companyId,
    companyId,
    locationId,
    subdomain,
    template: selectedTemplate,
    brandMode: "madkontrollen_default",
    logoUrl: logoDataUrl || null,
    heroTitle: businessName || subdomain,
    heroText: description || "Autogenereret website fra SEO-generator.",
    heroImageUrl: sanitizeString(config?.heroImageUrl || "", 2000) || null,
    ctaText: sanitizeString(config?.ctaText || "", 120) || null,
    ctaUrl: sanitizeString(config?.ctaUrl || "", 500) || null,
    phone: sanitizeString(config?.phone || "", 80) || null,
    address: sanitizeString(config?.address || "", 220) || null,
    themePrimary: sanitizeString(config?.theme?.primary || "", 20) || "#1f7a3d",
    themeSecondary: sanitizeString(config?.theme?.secondary || "", 20) || "#f8f4ea",
    themeAccent: sanitizeString(config?.theme?.accent || "", 20) || "#b91c1c",
    themeText: sanitizeString(config?.theme?.text || "", 20) || "#1f2937",
    status: "published",
    seoPreviewEnabled: true,
    seoModuleActive: true,
    customDomain: null,
    updatedAt: FieldValue.serverTimestamp(),
    activatedBy: activatedByUid
  }, { merge: true });

  const pages = buildSeoLandingPages(config, pageCount);
  const batch = db.batch();

  pages.forEach((page, index) => {
    const pageId = toDocSafeId(`${websiteId}__${page.slug}`);
    const pageRef = db.collection("seo_pages").doc(pageId);
    batch.set(pageRef, {
      organizationId: companyId,
      companyId,
      locationId,
      websiteId,
      subdomain,
      slug: page.slug,
      url: `https://${subdomain}.madkontrollen.dk/${page.slug}`,
      keyword: page.keyword,
      title: page.title,
      metaDescription: page.metaDescription,
      h1: page.h1,
      h2: page.h2,
      h3: page.h3,
      canonicalPath: page.canonicalPath,
      sourceTitle: page.sourceTitle,
      ordering: index + 1,
      status: "published",
      generatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      generatedBy: activatedByUid
    }, { merge: true });
  });

  await batch.commit();

  return {
    websiteId,
    generatedPages: pages.length,
    subdomain
  };
}

function buildSeoLandingPages(config, count) {
  const businessName = sanitizeString(config?.businessName || "Restaurant", 140) || "Restaurant";
  const cuisineType = sanitizeString(config?.cuisineType || "Restaurant", 80) || "Restaurant";
  const city = sanitizeString(config?.city || "Kobenhavn", 80) || "Kobenhavn";
  const keyword = sanitizeString(config?.keyword || `bedste ${String(cuisineType).toLowerCase()} i ${city}`, 120);
  const subdomain = sanitizeString(config?.subdomain || toAsciiSlug(businessName), 120);

  const seeds = [
    keyword,
    `${cuisineType} i ${city}`,
    `Takeaway ${city}`,
    `Restaurant ${city}`,
    `Bedste ${String(cuisineType).toLowerCase()} i ${city}`,
    `Billig ${String(cuisineType).toLowerCase()} i ${city}`,
    `Familie restaurant i ${city}`,
    `Online bestilling ${city}`,
    `${cuisineType} menu i ${city}`,
    `${subdomain}.madkontrollen.dk`
  ];

  const pages = [];
  for (let i = 0; i < count; i += 1) {
    const seed = sanitizeString(seeds[i % seeds.length], 140) || `Landing side ${i + 1}`;
    const variant = Math.floor(i / seeds.length) + 1;
    const pageTitleSeed = `${businessName} - ${seed}${variant > 1 ? ` #${variant}` : ""}`;
    const slugBase = toAsciiSlug(`${seed}${variant > 1 ? `-${variant}` : ""}`, 100) || `landing-side-${i + 1}`;
    const title = sanitizeString(`${businessName} | ${seed}`, 220);
    const metaDescription = sanitizeString(
      `${businessName} i ${city}. ${seed}. Book bord eller bestil online via ${subdomain}.madkontrollen.dk.`,
      320
    );

    pages.push({
      sourceTitle: pageTitleSeed,
      slug: slugBase,
      keyword: seed,
      title,
      metaDescription,
      h1: sanitizeString(`${businessName} - ${seed}`, 220),
      h2: sanitizeString(`Hvorfor vaelge ${businessName} i ${city}?`, 220),
      h3: sanitizeString(`Bestil ${String(cuisineType).toLowerCase()} online i ${city}`, 220),
      canonicalPath: `/${slugBase}`
    });
  }

  return pages;
}

async function createHaccpSnapshotDocument({ profile = {}, riskModel = {}, companyId, locationId, userId, ownerScopeMetadata = {} }) {
  const payload = buildHaccpSnapshotPayload({
    profile,
    riskModel,
    companyId,
    locationId,
    userId,
    ownerScopeMetadata
  });

  // Remove undefined fields to prevent Firestore errors
  const cleanedPayload = removeUndefinedFields(payload);

  const docRef = await db.collection("haccp_snapshots").add(cleanedPayload);
  
  // Create egenkontrol_programs document to enable operational task generation
  const programId = `${companyId}__${locationId}`;
  const programRef = db.collection("egenkontrol_programs").doc(programId);
  
  await programRef.set({
    companyId,
    locationId,
    organizationId: companyId,
    ...ownerScopeMetadata,
    personalisering: {
      antalKoeleskabe: parseInt(profile.antalKoeleskabe || 0, 10),
      antalFrysere: parseInt(profile.antalFrysere || 0, 10),
      tilberederVarmMad: profile.tilberederVarmMad || false,
      nedkoelerMad: profile.nedkoelerMad || false,
      varmholder: profile.varmholder || false
    },
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  
  return {
    snapshotId: docRef.id,
    payload: cleanedPayload,
    activatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

function buildHaccpSnapshotPayload({ profile = {}, riskModel = {}, companyId, locationId, userId, ownerScopeMetadata = {} }) {
  const sanitizedProfile = sanitizeOnboardingProfile(profile);
  const sanitizedRiskModel = sanitizeRiskModelInput(riskModel);
  const normalizedAddress = [sanitizedProfile.address, sanitizedProfile.zip, sanitizedProfile.city]
    .filter(Boolean)
    .join(", ");
  const now = new Date();

  // Generate comprehensive HACCP with all 7 KCPs (legacy)
  const comprehensiveHaccp = generateComprehensiveHaccp({
    profile: sanitizedProfile,
    companyType: sanitizedProfile.companyType
  });

  // Generate task templates from KCPs (legacy)
  const generatedTasks = generateTaskTemplatesFromKcps(comprehensiveHaccp.kcps);

  // Generate scenario-based HACCP (new motor)
  const scenarioHaccp = generateScenarioBasedHaccp({
    profile: sanitizedProfile,
    companyType: sanitizedProfile.companyType
  });

  // Transform risk analysis hazards to routine templates using controls field

  // Derive legacy fields from new motor (preserve object shape)
  const derivedHazards = scenarioHaccp.hazards.map(h => ({
    name: h.title || "",
    riskLevel: h.riskLevel || "medium",
    control: h.controlMeasure || "",
    frequency: h.monitoring?.frequency || "daily"
  }));
  const derivedControls = [...new Set(scenarioHaccp.hazards.map(h => h.controlMeasure).filter(Boolean))];
  const derivedTasks = scenarioHaccp.taskTemplates.map(t => t.title);

  return {
    documentType: "lovpligtig_risikoanalyse_haccp",
    title: `Lovpligtig Risikoanalyse & HACCP for ${sanitizedProfile.companyName || "Virksomhed"}`,
    organizationId: companyId,
    companyId,
    locationId,
    ...ownerScopeMetadata,
    createdBy: userId,
    companyName: sanitizedProfile.companyName,
    cvr: sanitizedProfile.cvr,
    address: normalizedAddress,
    companyType: sanitizedProfile.companyType,
    profile: {
      ...sanitizedProfile,
      address: sanitizedProfile.address,
      zip: sanitizedProfile.zip,
      city: sanitizedProfile.city,
      suppliers: sanitizedRiskModel.suppliers.length ? sanitizedRiskModel.suppliers : sanitizedProfile.suppliers
    },
    // NEW: Scenario-based HACCP structure (v3.0)
    haccp: {
      version: scenarioHaccp.version,
      scenarios: scenarioHaccp.scenarios,
      processes: scenarioHaccp.processes,
      hazards: scenarioHaccp.hazards,
      verificationTasks: scenarioHaccp.verificationTasks,
      documentationRequirements: scenarioHaccp.documentationRequirements,
      taskTemplates: scenarioHaccp.taskTemplates,
      summary: scenarioHaccp.summary,
      // Legacy KCP structure for backward compatibility
      kcps: comprehensiveHaccp.kcps,
      generatedTasks: generatedTasks,
      totalKcps: comprehensiveHaccp.summary.totalKcps
    },
    // LEGACY: Keep old structure for backwards compatibility
    generated: {
      hazards: sanitizedRiskModel.hazards.length ? sanitizedRiskModel.hazards : derivedHazards,
      controls: sanitizedRiskModel.controls.length ? sanitizedRiskModel.controls : derivedControls,
      tasks: sanitizedRiskModel.tasks.length ? sanitizedRiskModel.tasks : derivedTasks,
      suppliers: sanitizedRiskModel.suppliers.length ? sanitizedRiskModel.suppliers : sanitizedProfile.suppliers
    },
    status: "generated",
    source: "onboarding",
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: now.toISOString(),
    createdAtEpochMs: now.getTime()
  };
}

function buildPreferredLocationIds(userData, preferredLocationId = "") {
  const existingIds = getUserLocationIds(userData);
  const normalizedPreferred = sanitizeString(preferredLocationId, 120);
  const hasLivePreferred = normalizedPreferred && !isDemoScopedId(normalizedPreferred);

  const preservedIds = hasLivePreferred
    ? existingIds.filter((item) => !isDemoScopedId(item))
    : existingIds;

  if (normalizedPreferred && !preservedIds.includes(normalizedPreferred)) {
    preservedIds.push(normalizedPreferred);
  }

  return [...new Set(preservedIds.filter(Boolean))];
}

function isDemoScopedId(value) {
  return sanitizeString(value, 120).toLowerCase().includes("demo");
}

async function upsertOnboardingAnswersDocument({ companyId, locationId, userId, liveProfilePayload, ownerScopeMetadata = {} }) {
  const onboardingDocId = toDocSafeId(`${companyId}__${locationId}__onboarding`);
  const onboardingRef = db.collection("onboarding_answers").doc(onboardingDocId);
  const answers = liveProfilePayload.onboardingAnswers || {};

  await onboardingRef.set({
    companyId,
    locationId,
    organizationId: companyId,
    ...ownerScopeMetadata,
    businessTypes: toArray(answers.businessTypes),
    processes: toArray(answers.processes),
    ingredients: toArray(answers.ingredients),
    serviceTypes: toArray(answers.serviceTypes),
    specialConditions: toArray(answers.specialConditions),
    areas: toArray(answers.areas),
    equipmentCounts: answers.equipmentCounts || {},
    cloudinaryAssets: toArray(answers.cloudinaryAssets),
    createdBy: sanitizeString(userId, 120),
    source: "onboarding_checkout",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return onboardingDocId;
}

function buildLiveUserProfilePayload({ profile = {}, riskModel = {}, companyId, locationId, userId, userEmail, summary, cloudinaryAssets, draftId, checkoutSessionId, ownerScopeMetadata = {} }) {
  const sanitizedProfile = sanitizeOnboardingProfile(profile);
  const sanitizedRiskModel = sanitizeRiskModelInput(riskModel);
  const onboardingAnswers = deriveOnboardingAnswers(sanitizedProfile);
  
  return {
    documentType: "live_user_profile",
    companyId,
    locationId,
    organizationId: companyId,
    ...ownerScopeMetadata,
    userId,
    userEmail: sanitizeString(userEmail, 160),
    profile: sanitizedProfile,
    riskModel: sanitizedRiskModel,
    onboardingAnswers,
    summary: summary || {},
    cloudinaryAssets: cloudinaryAssets || [],
    draftId: sanitizeString(draftId, 180),
    checkoutSessionId: sanitizeString(checkoutSessionId, 220),
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

function deriveOnboardingAnswers(profile = {}) {
  const businessTypeSlug = toAsciiSlug(profile.companyType || "restaurant", 80) || "restaurant";
  const processes = [];
  const specialConditions = [];
  const ingredients = [];
  const serviceTypes = [];

  // â”€â”€ Modtagelse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (profile.receivesChilledGoods || profile.fridgeCount > 0 || profile.antalKoeleskabe > 0 || profile.modtagerKoelevarer) {
    processes.push("receive_chilled_goods");
  }
  if (profile.receivesFrozenGoods || profile.freezerCount > 0 || profile.antalFrysere > 0 || profile.modtagerFrostvarer) {
    processes.push("receive_frozen_goods");
  }

  // â”€â”€ Opbevaring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (profile.storesChilledGoods || profile.receivesChilledGoods || profile.fridgeCount > 0 || profile.antalKoeleskabe > 0) {
    processes.push("store_chilled_goods");
  }
  if (profile.storesFrozenGoods || profile.receivesFrozenGoods || profile.freezerCount > 0 || profile.antalFrysere > 0) {
    processes.push("store_frozen_goods");
  }

  // â”€â”€ Tilberedning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (profile.preparesHotFood || profile.servesHotFood || profile.hasWarmKitchen || profile.tilberederVarmMad) {
    processes.push("cook_food");
  }

  // â”€â”€ Varmholdelse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (profile.holdsHotFood || profile.hasHotHolding || profile.varmholder) {
    processes.push("hot_hold_food");
  }

  // â”€â”€ NedkÃ¸ling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (profile.coolsHotFood || profile.nedkoelerMad) {
    processes.push("cool_food");
  }

  // â”€â”€ Genopvarmning: kun relevant nÃ¥r der tilberedes OG evt. nedkÃ¸les â”€â”€â”€â”€â”€â”€
  if (profile.preparesHotFood || profile.servesHotFood || profile.tilberederVarmMad) {
    processes.push("reheat_food");
  }

  // â”€â”€ Servering koldt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (profile.servesColdFood || profile.hasColdKitchen || profile.servererKoldMad || profile.preparesColdFood) {
    processes.push("serve_cold_food");
  }

  if (profile.packsTakeaway || profile.transportsHotTakeaway || profile.transportsChilledGoods || profile.transportsFrozenGoods) {
    specialConditions.push("transport_food");
    serviceTypes.push("takeaway");
  }

  if (profile.hasServingArea) {
    serviceTypes.push("dine_in");
  }

  if (!serviceTypes.length) {
    serviceTypes.push("production_only");
  }

  if (profile.handlesAllergens || profile.handlesDifferentFoods || profile.sellsFoodWithAllergens) {
    specialConditions.push("handles_allergens");
  }

  if (profile.sellsRawFish) {
    ingredients.push("raw_fish");
  }

  if (profile.makesDesserts) {
    ingredients.push("desserts");
  }

  // â”€â”€ Areas: afledt fra lokaleboolanerne i profilen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const areas = ["kitchen"]; // alle lokationer har et kÃ¸kken
  if (profile.hasProductionKitchen) areas.push("production_kitchen");
  if (profile.hasServingArea)       areas.push("serving_area");
  if (profile.hasDryStorage)        areas.push("dry_storage");
  if (profile.hasToilet)            areas.push("toilet");
  if (profile.hasDishwashing)       areas.push("dishwashing_area");
  if (profile.hasWashingRoom)       areas.push("washing_room");
  if (profile.hasVegetableRoom)     areas.push("vegetable_room");
  if (profile.hasWalkInCooler || profile.walkInCoolerCount > 0)   areas.push("walk_in_cooler_room");
  if (profile.hasWalkInFreezer || profile.walkInFreezerCount > 0) areas.push("walk_in_freezer_room");

  return {
    businessTypes: [businessTypeSlug],
    processes: [...new Set(processes)],
    ingredients: [...new Set(ingredients)],
    serviceTypes: [...new Set(serviceTypes)],
    specialConditions: [...new Set(specialConditions)],
    areas: [...new Set(areas)],
    equipmentCounts: {
      fridge: toPositiveInt(profile.antalKoeleskabe || profile.fridgeCount),
      freezer: toPositiveInt(profile.antalFrysere || profile.freezerCount),
      walk_in_cooler: toPositiveInt(profile.walkInCoolerCount) || (profile.hasWalkInCooler ? 1 : 0),
      walk_in_freezer: toPositiveInt(profile.walkInFreezerCount) || (profile.hasWalkInFreezer ? 1 : 0),
      ice_machine: toPositiveInt(profile.antalIsterningemaskiner) || (profile.hasIceMachine ? 1 : 0),
      ice_box: toPositiveInt(profile.antalIsbokse) || (profile.hasIsboks ? 1 : 0),
      fryer: toPositiveInt(profile.antalFrityreGryder) || (profile.hasFrituregryde ? 1 : 0),
      softice_machine: profile.hasSofticeachine ? 1 : 0
    }
  };
}

function buildCheckoutModuleMap(selectedModules = []) {
  return selectedModules.reduce((acc, moduleKey) => {
    acc[moduleKey] = true;
    return acc;
  }, {});
}

api.syncRiskTaskTemplates = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind for at synkronisere task-skabeloner.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const userData = await getUserAccessProfile({ uid, email });

  if (!userData) {
    throw new functions.https.HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
  }

  const requestedCompanyId = sanitizeString(data?.companyId, 120);
  const requestedLocationId = sanitizeString(data?.locationId, 120);

  const companyId = requestedCompanyId || sanitizeString(userData.companyId || userData.organizationId, 120);
  const locationIds = getUserLocationIds(userData);
  const locationId = requestedLocationId || locationIds[0] || sanitizeString(userData.primaryLocationId || userData.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("failed-precondition", "companyId eller locationId mangler.");
  }

  await assertLexiCustomerAccess({ uid, email, companyId, locationId });

  const riskSource = await loadLatestScopedRiskSource({ companyId, locationId });
  if (!riskSource?.payload) {
    throw new functions.https.HttpsError("not-found", "Ingen live risikoanalyse fundet for denne lokation.");
  }

  const payload = riskSource.payload || {};
  const profile = sanitizeOnboardingProfile(payload.profile || {
    companyName: payload.companyName,
    companyType: payload.companyType,
    cvr: payload.cvr,
    address: payload.address
  });
  const riskModel = sanitizeRiskModelInput(payload.riskModel || payload.generated || {});

  // Generate scenario-based HACCP analysis
  const scenarioHaccp = generateScenarioBasedHaccp({
    profile: profile,
    companyType: profile.companyType
  });

  // Save comprehensive HACCP snapshot to haccp_snapshots collection
  const snapshotId = toDocSafeId(`${companyId}__${locationId}__${Date.now()}`);
  await db.collection("haccp_snapshots").doc(snapshotId).set({
    companyId,
    organizationId: companyId,
    locationId,
    profile,
    riskModel,
    // Scenario-based data structures
    scenarios: scenarioHaccp.scenarios || [],
    processes: scenarioHaccp.processes || [],
    hazards: scenarioHaccp.hazards || [],
    controlMeasures: scenarioHaccp.controlMeasures || [],
    criticalLimits: scenarioHaccp.criticalLimits || [],
    monitoringProcedures: scenarioHaccp.monitoringProcedures || [],
    correctiveActions: scenarioHaccp.correctiveActions || [],
    verificationTasks: scenarioHaccp.verificationTasks || [],
    documentationRequirements: scenarioHaccp.documentationRequirements || [],
    taskTemplates: scenarioHaccp.taskTemplates || [],
    // Backward compatible KCPs
    kcps: scenarioHaccp.kcps || [],
    // Metadata
    version: scenarioHaccp.version || "3.0_scenario_based",
    summary: scenarioHaccp.summary || {},
    generatedAt: scenarioHaccp.generatedAt || new Date().toISOString(),
    generatedBy: uid,
    generatedByEmail: email,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  const summary = await ensureLiveTaskTemplatesForProvisioning({
    companyId,
    locationId,
    profile,
    riskModel,
    userId: uid,
    userEmail: email
  });

  return {
    ok: true,
    companyId,
    locationId,
    sourceCollection: riskSource.sourceCollection,
    snapshotId,
    taskTemplateCount: Number(summary?.created || 0),
    scenarioCount: scenarioHaccp.scenarios?.length || 0,
    processCount: scenarioHaccp.processes?.length || 0,
    hazardCount: scenarioHaccp.hazards?.length || 0,
    controlMeasureCount: scenarioHaccp.controlMeasures?.length || 0,
    ccpCount: scenarioHaccp.summary?.totalCCPs || 0,
    cpCount: scenarioHaccp.summary?.totalCPs || 0
  };
});

api.adminReprovisionEquipment = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }

  const uid = sanitizeString(auth.uid, 160);
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }

  await assertAdminAccess({ uid, email, companyId, locationId });

  // Accept explicit counts or fall back to live_user_profiles â†’ profile
  let equipmentCounts = {};
  let profile = {};

  if (data?.equipmentCounts && typeof data.equipmentCounts === "object") {
    equipmentCounts = data.equipmentCounts;
  } else {
    // Try to load from live_user_profiles
    const liveSnap = await db.collection("live_user_profiles")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .limit(1)
      .get();

    if (!liveSnap.empty) {
      const liveData = liveSnap.docs[0].data() || {};
      profile = liveData.profile || {};
      equipmentCounts = liveData.onboardingAnswers?.equipmentCounts || {};
    }
  }

  const eqResult = await syncOnboardingEquipmentUnits({ db, companyId, locationId, equipmentCounts, profile });
  const cleanResult = await syncEquipmentCleaningTemplates({ db, companyId, locationId });
  const maintResult = await syncEquipmentMaintenanceTemplates({ db, companyId, locationId });
  const areaResult  = await syncAreaCleaningTemplates({ db, companyId, locationId });
  const driftResult = await syncProcessDriftTemplates({ db, companyId, locationId });
  const waterResult = await syncWaterControlTemplates({ db, companyId, locationId });

  // Steg 4: Generer/opdater risks fra onboarding
  const { generateRisksFromOnboardingAnswers } = require("./admin/generateRisksFromOnboardingAnswers");
  const risksResult = await generateRisksFromOnboardingAnswers({ locationId });

  // Steg 5: Byg task_templates fra risks
  const { generateEgenkontrolFromRiskAnalysis } = require("./admin/generateEgenkontrolFromRiskAnalysis");
  const templatesResult = await generateEgenkontrolFromRiskAnalysis({ locationId, db });

  return {
    ok: true,
    companyId,
    locationId,
    equipment: eqResult,
    cleaningTemplates: cleanResult,
    maintenanceTemplates: maintResult,
    areaTemplates: areaResult,
    driftTemplates: driftResult,
    waterControlTemplates: waterResult,
    risks: risksResult,
    riskTemplates: templatesResult
  };
});

api.getLexiCustomerStatus = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Du skal vaere logget ind for at hente kundestatus."
    );
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "companyId og locationId er paakraevet."
    );
  }

  await assertLexiCustomerAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  return {
    ...(await getLexiCustomerStatusPayload({ companyId, locationId }))
  };
});

api.saveLocationEquipmentUnits = functions.https.onCall(async (request, context) => {
  const data = request.data || request;

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }

  const userData = await getUserAccessProfile({
    uid: context.auth.uid,
    email: context.auth.token?.email || ""
  });

  if (!userData) {
    throw new functions.https.HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
  }

  const role = sanitizeString(userData.role || "", 80).toLowerCase();
  if (role !== "owner") {
    throw new functions.https.HttpsError("permission-denied", "Kun owner kan redigere enheder.");
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
  if (!userCompanyId || userCompanyId !== companyId) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til companyId afvist.");
  }

  const allowedLocationIds = getUserLocationIds(userData);
  if (allowedLocationIds.length > 0 && !allowedLocationIds.includes(locationId)) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til locationId afvist.");
  }

  const supportedTypeMap = new Map(
    EQUIPMENT_COUNT_MAPPING.map((item) => [sanitizeEquipmentType(item.equipmentType), item])
  );
  const inputUnits = Array.isArray(data?.units) ? data.units : [];

  const existingSnap = await db
    .collection("equipment")
    .where("locationId", "==", locationId)
    .where("source", "==", "onboarding")
    .get();

  const existingById = new Map();
  const existingByType = new Map();

  for (const docSnap of existingSnap.docs) {
    const item = docSnap.data() || {};
    const itemCompanyId = sanitizeString(item.companyId || item.organizationId, 120);
    const itemType = sanitizeEquipmentType(item.type || item.equipmentType || "");
    if (itemCompanyId !== companyId || !supportedTypeMap.has(itemType)) continue;

    let unitNumber = toPositiveInt(item.unitNumber);
    if (!unitNumber) {
      unitNumber = parseEquipmentUnitNumberFromId(docSnap.id, itemType);
    }

    const entry = {
      id: docSnap.id,
      ref: docSnap.ref,
      data: item,
      type: itemType,
      unitNumber
    };

    existingById.set(docSnap.id, entry);
    if (!existingByType.has(itemType)) existingByType.set(itemType, []);
    existingByType.get(itemType).push(entry);
  }

  for (const entries of existingByType.values()) {
    entries.sort((left, right) => (left.unitNumber || 0) - (right.unitNumber || 0));
  }

  const reservedIds = new Set();
  const desiredUnits = [];

  for (const rawUnit of inputUnits) {
    const type = sanitizeEquipmentType(rawUnit?.type || "");
    if (!supportedTypeMap.has(type)) continue;

    const id = sanitizeString(rawUnit?.id || "", 180);
    const active = rawUnit?.active !== false;
    const name = sanitizeString(rawUnit?.name || rawUnit?.displayName || "", 140);

    if (id) reservedIds.add(id);
    desiredUnits.push({ id, type, active, name });
  }

  const reusableInactiveByType = new Map();
  const maxNumberByType = new Map();

  for (const [type, entries] of existingByType.entries()) {
    reusableInactiveByType.set(
      type,
      entries.filter((entry) => entry.data.active === false && !reservedIds.has(entry.id))
    );
    maxNumberByType.set(
      type,
      entries.reduce((maxValue, entry) => Math.max(maxValue, toPositiveInt(entry.unitNumber)), 0)
    );
  }

  const batch = db.batch();
  const nowTs = FieldValue.serverTimestamp();
  const normalizedUnits = [];
  let created = 0;
  let updated = 0;
  let deactivated = 0;
  let kept = 0;

  for (const desired of desiredUnits) {
    let existing = desired.id ? existingById.get(desired.id) : null;

    if (existing && existing.type !== desired.type) {
      throw new functions.https.HttpsError("invalid-argument", "Enhedstype matcher ikke eksisterende enhed.");
    }

    let unitNumber = toPositiveInt(existing?.unitNumber);
    let docId = existing?.id || "";

    if (!docId) {
      const reusablePool = reusableInactiveByType.get(desired.type) || [];
      const reusable = reusablePool.shift() || null;
      if (reusable) {
        existing = reusable;
        docId = reusable.id;
        unitNumber = toPositiveInt(reusable.unitNumber);
      } else {
        unitNumber = (maxNumberByType.get(desired.type) || 0) + 1;
        maxNumberByType.set(desired.type, unitNumber);
        docId = buildEquipmentDocId({
          companyId,
          locationId,
          equipmentType: desired.type,
          unitNumber
        });
      }
    }

    if (!unitNumber) {
      unitNumber = parseEquipmentUnitNumberFromId(docId, desired.type);
    }
    if (!unitNumber) {
      unitNumber = (maxNumberByType.get(desired.type) || 0) + 1;
      maxNumberByType.set(desired.type, unitNumber);
    }

    const meta = supportedTypeMap.get(desired.type);
    const fallbackName = `${meta.titleBase} ${unitNumber}`;
    const displayName = desired.name || fallbackName;
    const nextActive = desired.active !== false;
    const ref = existing?.ref || db.collection("equipment").doc(docId);
    const seedKey = buildEquipmentSeedKey({
      companyId,
      locationId,
      equipmentType: desired.type,
      unitNumber
    });

    batch.set(ref, {
      companyId,
      organizationId: companyId,
      locationId,
      source: "onboarding",
      onboardingSource: existing?.data?.onboardingSource || "equipment_page",
      equipmentId: docId,
      seedKey,
      equipmentType: desired.type,
      type: desired.type,
      controlTypes: meta.controlTypes,
      controlType: meta.controlTypes[0] || "",
      title: displayName,
      name: displayName,
      displayName,
      unitNumber,
      active: nextActive,
      isActive: nextActive,
      ...buildEquipmentRuntimeFlags(desired.type, meta.controlTypes),
      updatedAt: nowTs,
      ...(existing ? {} : { createdAt: nowTs })
    }, { merge: true });

    normalizedUnits.push({
      id: docId,
      type: desired.type,
      active: nextActive,
      name: displayName,
      unitNumber
    });

    if (!existing) {
      created++;
    } else if (!nextActive && existing.data.active !== false) {
      deactivated++;
    } else {
      const previousName = sanitizeString(
        existing.data.displayName || existing.data.name || existing.data.title || "",
        140
      );
      const wasActive = existing.data.active !== false;
      if (previousName !== displayName || wasActive !== nextActive) {
        updated++;
      } else {
        kept++;
      }
    }
  }

  await batch.commit();

  const activeUnits = normalizedUnits
    .filter((unit) => unit.active !== false)
    .sort((left, right) => {
      if (left.type !== right.type) return left.type.localeCompare(right.type, "da");
      return (left.unitNumber || 0) - (right.unitNumber || 0);
    })
    .map((unit) => ({
      id: unit.id,
      type: unit.type,
      name: unit.name,
      displayName: unit.name
    }));

  const equipmentCounts = {};
  for (const key of supportedTypeMap.keys()) {
    equipmentCounts[key] = 0;
  }
  for (const unit of activeUnits) {
    equipmentCounts[unit.type] = (equipmentCounts[unit.type] || 0) + 1;
  }

  await db.collection("onboarding_answers").doc(`${companyId}__${locationId}__onboarding`).set({
    companyId,
    organizationId: companyId,
    locationId,
    equipmentCounts,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const liveProfileRef = db.collection("live_user_profiles").doc(`${companyId}__${locationId}__live_profile`);
  const liveProfileSnap = await liveProfileRef.get();
  if (liveProfileSnap.exists) {
    await liveProfileRef.set({
      onboardingAnswers: {
        ...(liveProfileSnap.data()?.onboardingAnswers || {}),
        equipmentCounts
      },
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    await ensureLocationTemperatureSettings(db, companyId, locationId, todayKey);
  } catch (tempErr) {
    console.error("[saveLocationEquipmentUnits] ensureLocationTemperatureSettings failed:", tempErr.message);
  }

  for (const unit of activeUnits) {
    try {
      await ensureEquipmentTemperatureControl(db, locationId, unit);
    } catch (tempErr) {
      console.warn(`[saveLocationEquipmentUnits] ensureEquipmentTemperatureControl failed for ${unit.id}:`, tempErr.message);
    }
  }

  await ensureEgenkontrolTaskTemplates({
    db,
    companyId,
    locationId,
    units: activeUnits
  });

  await syncEquipmentCleaningTemplates({ db, companyId, locationId });
  await syncEquipmentMaintenanceTemplates({ db, companyId, locationId });
  await syncWaterControlTemplates({ db, companyId, locationId });

  return {
    ok: true,
    companyId,
    locationId,
    created,
    updated,
    deactivated,
    kept,
    equipmentCounts,
    activeUnitCount: activeUnits.length
  };
});

api.startDayForLocation = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Du skal vaere logget ind for at starte dagen."
    );
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "companyId og locationId er paakraevet."
    );
  }

  await assertStartDayAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  const todayKey = getDateKey();
  const forceRefresh = data?.forceRefresh === true;
  const runId = `${companyId}__${locationId}__${todayKey}`;

  // Ensure location has temperature control settings for new schedule system
  let locationTemperatureSettings = null;
  try {
    locationTemperatureSettings = await ensureLocationTemperatureSettings(db, companyId, locationId, todayKey);
  } catch (err) {
    console.warn("[startDayForLocation] ensureLocationTemperatureSettings failed:", err.message);
  }

  const runRef = db.collection("daily_runs").doc(runId);
  const runSnap = await runRef.get();
  const alreadyStarted = runSnap.exists;

  const operatingMode = await getOperatingModeForLocation({
    companyId,
    locationId,
    todayKey
  });

  if (operatingMode === "closed") {
    return {
      ok: false,
      blocked: true,
      message: "Lokationen er lukket. Automatiske rutiner er sat pÃ¥ pause for i dag."
    };
  }

  if (operatingMode === "vacation") {
    return {
      ok: false,
      blocked: true,
      message: "Lokationen er i ferie-mode. Automatiske rutiner er sat pÃ¥ pause for i dag."
    };
  }

  // ðŸ”¹ hent templates (kun operational - ikke verification)
  // Templates skal allerede eksistere (genereret via checkout eller adminReprovisionEquipment)
  const allTemplateDocs = await loadActiveTaskTemplates({ companyId, locationId });
  
  // LOG B: After templates are loaded
  console.log(`[LOG B - startDayForLocation] Templates total: ${allTemplateDocs.length}`);
  const tempTemplatesLoaded = allTemplateDocs.filter(doc => {
    const t = doc.data();
    const id = doc.id || "";
    const title = (t.title || "").toLowerCase();
    const guideKey = (t.guideKey || "").toLowerCase();
    const templateKey = (t.templateKey || "").toLowerCase();
    return title.includes("temperatur") || guideKey.includes("temperature") || 
           templateKey === "temperature_control" || id.includes("__temp__");
  });
  console.log(`[LOG B] Temperature templates loaded: ${tempTemplatesLoaded.length}`);
  tempTemplatesLoaded.forEach(doc => {
    const t = doc.data();
    console.log(`[LOG B] Loaded temp template: ${doc.id}`, {
      title: t.title,
      templateType: t.templateType,
      templateKey: t.templateKey,
      guideKey: t.guideKey,
      equipmentUnit: t.equipmentUnit,
      scheduleConfig: t.scheduleConfig
    });
  });
  
  const hasUnitSpecificKoelFrost = allTemplateDocs.some(doc => {
    const id = doc.id || "";
    return id.includes("egenkontrol_koel_frost__") && (id.includes("fridge_") || id.includes("freezer_") || id.includes("ice_machine_"));
  });
  
  const filterResults = new Map();
  const templateDocs = allTemplateDocs.filter(doc => {
    const template = doc.data();
    const id = doc.id || "";
    
    // ðŸš« Fjern gamle auto templates
    if (id.includes("auto_task")) {
      filterResults.set(id, "DROP: auto_task");
      return false;
    }
    
    // ðŸš« Fjern gamle KCP templates (ikke aggregerede)
    if (id.includes("kcp_") && !template.isAggregated) {
      filterResults.set(id, "DROP: kcp without aggregation");
      return false;
    }
    
    // ðŸš« Ekstra sikkerhed: fjern hvis title indikerer gammel struktur
    const title = (template.title || "").toLowerCase();
    if (title.includes("kcp") && !template.isAggregated) {
      filterResults.set(id, "DROP: kcp in title without aggregation");
      return false;
    }
    
    // ðŸš« Fjern generisk koel_frost template hvis der findes unit-specifikke templates
    if (hasUnitSpecificKoelFrost && id.match(/egenkontrol_koel_frost$/) && !id.includes("__fridge_") && !id.includes("__freezer_") && !id.includes("__ice_machine_")) {
      console.log(`[egenkontrol] Skipping legacy generic koel_frost template: ${id}`);
      filterResults.set(id, "DROP: legacy generic koel_frost");
      return false;
    }
    
    // âœ… Use unified daily routine filter
    const passed = shouldGenerateDailyRoutineTemplate(template);
    if (passed) {
      filterResults.set(id, "KEEP: passed shouldGenerateDailyRoutineTemplate");
    } else {
      const templateType = (template.templateType || "").toLowerCase();
      filterResults.set(id, `DROP: shouldGenerateDailyRoutineTemplate returned false (templateType='${templateType}')`);
    }
    return passed;
  });
  
  // LOG C: After filter is applied
  console.log(`[LOG C - startDayForLocation] Templates after filter: ${templateDocs.length}`);
  tempTemplatesLoaded.forEach(doc => {
    const result = filterResults.get(doc.id) || "UNKNOWN";
    console.log(`[LOG C] Temperature template filter result: ${doc.id} -> ${result}`);
  });
  
  console.log("Templates total:", allTemplateDocs.length);
  console.log("Templates after filter:", templateDocs.length);
  templateDocs.forEach(doc => {
    const t = doc.data();
    console.log("USED:", doc.id, t.title, t.templateType);
  });

  const [equipmentSnap, areasSnap] = await Promise.all([
    db.collection("equipment")
      .where("locationId", "==", locationId)
      .get(),
    db.collection("areas")
      .where("locationId", "==", locationId)
      .get()
  ]);

  const equipmentByType = {};
  const allEquipment = [];
  const equipmentUnitMap = new Map();

  for (const equipmentDoc of equipmentSnap.docs) {
    const equipment = equipmentDoc.data() || {};
    if (equipment.active === false) continue;
    const type = sanitizeEquipmentType(equipment.type || equipment.equipmentType);
    const normalized = {
      id: equipmentDoc.id,
      type,
      name: sanitizeString(equipment.name || equipment.displayName || equipment.equipmentName, 140),
      displayName: sanitizeString(equipment.displayName || equipment.name || equipment.equipmentName, 140),
      temperatureControl: equipment.temperatureControl || null
    };

    // Ensure temperature-relevant units have temperatureControl settings
    try {
      const normalizedUnit = await ensureEquipmentTemperatureControl(db, locationId, normalized);
      if (normalizedUnit.temperatureControl) {
        normalized.temperatureControl = normalizedUnit.temperatureControl;
      }
    } catch (err) {
      console.warn(`[startDayForLocation] ensureEquipmentTemperatureControl failed for ${normalized.id}:`, err.message);
    }

    equipmentUnitMap.set(normalized.id, normalized);
    if (!equipmentByType[type]) equipmentByType[type] = [];
    equipmentByType[type].push(normalized);
    allEquipment.push(normalized);
  }

  // Legacy compat keys (used by fallback logic and buildStartDayTargets inference)
  if (!equipmentByType.fridge)   equipmentByType.fridge   = allEquipment.filter((x) => x.type.includes("fridge") || x.type.includes("koleskab") || x.type.includes("kÃ¸leskab"));
  if (!equipmentByType.freezer)  equipmentByType.freezer  = allEquipment.filter((x) => x.type.includes("freezer") || x.type.includes("fryser"));
  if (!equipmentByType.slicer) equipmentByType.slicer = allEquipment.filter((x) => x.type === "slicer");
  if (!equipmentByType.paalaegsmaskine) equipmentByType.paalaegsmaskine = allEquipment.filter((x) => x.type === "paalaegsmaskine");
  if (!equipmentByType.slicing_machine) equipmentByType.slicing_machine = allEquipment.filter((x) => x.type === "slicing_machine");
  if (!equipmentByType.softice_machine) equipmentByType.softice_machine = allEquipment.filter((x) => x.type === "softice_machine");
  if (!equipmentByType.ice_machine) equipmentByType.ice_machine = allEquipment.filter((x) => x.type === "ice_machine");
  if (!equipmentByType.ismaskine) equipmentByType.ismaskine = allEquipment.filter((x) => x.type === "ismaskine");

  // Fallback: brug onboarding counts hvis equipment docs ikke er oprettet endnu.
  if (equipmentByType.fridge.length === 0 || equipmentByType.freezer.length === 0) {
    try {
      const counts = await getOnboardingEquipmentCounts({ companyId, locationId });

      const syntheticEquipment = buildSyntheticEquipmentFromCounts(counts.rawCounts || {});
      for (const equipment of syntheticEquipment) {
        const alreadyExists = allEquipment.some((item) => item.id === equipment.id);
        if (alreadyExists) continue;
        allEquipment.push(equipment);
        const stype = equipment.type || "";
        if (!equipmentByType[stype]) equipmentByType[stype] = [];
        equipmentByType[stype].push(equipment);
      }

      if (equipmentByType.fridge.length === 0 && counts.fridges > 0) {
        equipmentByType.fridge = allEquipment.filter((item) => item.type.includes("fridge") || item.type.includes("koleskab") || item.type.includes("kÃ¸leskab"));
      }

      if (equipmentByType.freezer.length === 0 && counts.freezers > 0) {
        equipmentByType.freezer = allEquipment.filter((item) => item.type.includes("freezer") || item.type.includes("fryser"));
      }
    } catch (error) {
      console.warn("Kunne ikke lÃ¦se equipmentCounts fra onboarding_answers:", error);
    }
  }

  const areas = areasSnap.docs.map((areaDoc) => {
    const area = areaDoc.data() || {};
    return {
      id: areaDoc.id,
      name: sanitizeString(area.name, 140),
      areaType: sanitizeString(area.areaType, 80)
    };
  });

  const batch = db.batch();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let ensuredCount = 0;
  let newScheduleCount = 0;
  let legacyScheduleCount = 0;
  let disabledUnitCount = 0;
  const existingTaskMap = await getExistingTaskInstanceMap({ companyId, locationId, todayKey });

  for (const doc of templateDocs) {
    const template = doc.data();
    const baseTaskId = sanitizeString(
      template.taskId || template.id || doc.id,
      120
    ) || doc.id;

    // âœ… Use unified daily routine filter
    if (!shouldGenerateDailyRoutineTemplate(template)) {
      console.log("[startDayForLocation] SKIP blocked template", {
        templateId: template.id || null,
        title: template.title || null,
        templateType: template.templateType || null,
        templateSource: template.templateSource || null,
        category: template.category || null
      });
      continue;
    }

    const targets = buildStartDayTargets({
      template,
      templateDocId: doc.id,
      equipmentByType,
      allEquipment,
      areas
    });

    for (const target of targets) {
      const baseTitle = sanitizeString(template.title, 220) || "Rutine";
      // Don't append equipment name if template is already pinned to a specific unit
      // (the title was built with the unit name already embedded)
      const scopedTitle = (target.equipmentName && !template.equipmentId)
        ? `${baseTitle} - ${target.equipmentName}`
        : baseTitle;

      const scopedTaskId = target.suffix && target.suffix !== "default"
        ? `${baseTaskId}__${target.suffix}`
        : baseTaskId;

      // Resolve schedule configuration combining template, location and unit settings
      const equipmentUnitId = target.equipmentId || template.equipmentUnit || template.equipmentId || "";
      const unitForTemplate = equipmentUnitId ? equipmentUnitMap.get(equipmentUnitId) : null;
      
      const resolvedSchedule = resolveTemplateSchedule({
        template,
        locationTemperatureSettings,
        unitTemperatureControl: unitForTemplate?.temperatureControl || null,
        todayKey
      });

      // Check if unit is disabled - skip task creation if so
      if (resolvedSchedule && resolvedSchedule.enabled === false) {
        disabledUnitCount++;
        continue;
      }

      const lastCompleted = await getLastCompleted(scopedTaskId, locationId);
      
      // Use new schedule system if available, otherwise fallback to legacy
      let due = false;
      if (resolvedSchedule && resolvedSchedule.useNewSchedule) {
        newScheduleCount++;
        const anchorDate = resolvedSchedule.anchorDate || locationTemperatureSettings?.anchorDate || todayKey;
        due = shouldRunToday(resolvedSchedule, todayKey, anchorDate, lastCompleted);
      } else {
        legacyScheduleCount++;
        due = isDueToday(template, todayKey, lastCompleted, "frequency");
      }
      
      const registrationDue = isDueToday(template, todayKey, lastCompleted, "registrationFrequency");
      
      // Debug logging for schedule consistency validation
      console.log("[SCHEDULE_DEBUG]", {
        templateId: template.id || doc.id,
        title: template.title || null,
        category: template.category || null,
        frequency: template.frequency || null,
        registrationFrequency: template.registrationFrequency || null,
        scheduleConfig: template.scheduleConfig || null,
        lastCompleted: lastCompleted || null,
        due,
        registrationDue
      });
      
      if (!due) {
        console.log("[SCHEDULE_DROP_NOT_DUE]", {
          templateId: template.id || doc.id,
          title: template.title || null,
          frequency: template.frequency || null,
          registrationFrequency: template.registrationFrequency || null,
          lastCompleted: lastCompleted || null
        });
        continue;
      }

      const deadlineMeta = buildTaskDeadlineMeta(template, todayKey);

      const formType = sanitizeString(template.formType, 60).toLowerCase();
      const templateRequiresMeasurement = template.requiresMeasurement === true || formType === "temperature";
      const requiresMeasurementToday = templateRequiresMeasurement && registrationDue;

      const equipmentId = target.equipmentId || template.equipmentId || "";
      const instanceId  = equipmentId
        ? `${doc.id}__${equipmentId}__${todayKey}`
        : `${doc.id}__${todayKey}`;
      const uniqueKey  = instanceId;
      const existing   = existingTaskMap.get(uniqueKey) || null;
      const ref        = existing?.ref || db.collection("task_instances").doc(instanceId);
      const existingData = existing?.data || {};
      const existingStatus = sanitizeString(existingData.status, 40) || "pending";
      const isClosedLegacyStatus = ["completed", "failed", "not_in_use"].includes(existingStatus);
      const nextActiveUntilDateKey = normalizeDateKey(existingData.activeUntilDateKey) || addDays(todayKey, 7);

      const instanceData = {
        ...template,
        companyId,
        organizationId: companyId,
        locationId,
        taskId: doc.id,
        title: scopedTitle,
        description: template.description || '',
        templateId: doc.id,
        dateKey: todayKey,
        equipmentId: target.equipmentId || template.equipmentId || "",
        equipmentType: target.equipmentType || template.equipmentType || "",
        equipmentName: target.equipmentName || template.equipmentName || "",
        areaId: target.areaId || template.areaId || "",
        areaType: target.areaType || template.areaType || "",
        requiresMeasurement: requiresMeasurementToday,
        requiresRegistration: registrationDue,
        registrationDeferred: !registrationDue,
        deadlineAt: deadlineMeta.deadlineAt,
        overduePolicy: deadlineMeta.overduePolicy,
        overdueExplanationRequired: deadlineMeta.overdueExplanationRequired,
        status: isClosedLegacyStatus ? existingStatus : (existingStatus === "active" || existingStatus === "open" ? existingStatus : "pending"),
        activeUntilDateKey: nextActiveUntilDateKey,
        entryCount: Number(existingData.entryCount || 0),
        lastEntryAt: existingData.lastEntryAt || null,
        lastEntryStatus: existingData.lastEntryStatus || "",
        completedAt: isClosedLegacyStatus ? existingData.completedAt || null : null,
        completedBy: isClosedLegacyStatus ? existingData.completedBy || "" : "",
        completedByName: isClosedLegacyStatus ? existingData.completedByName || "" : "",
        createdAt: existingData.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      if (!existing) {
        batch.set(ref, instanceData, { merge: true });
        createdCount++;
        console.log("[startDay] create instance", { instanceId });
      } else if (materiallyEqualInstance(existingData, instanceData)) {
        skippedCount++;
        // ingen write
      } else {
        const changedFields = diffComparableFields(
          buildComparableInstancePayload(existingData),
          buildComparableInstancePayload(instanceData)
        );
        batch.set(ref, instanceData, { merge: false });
        updatedCount++;
        console.log("[startDay] update instance", { instanceId, changedFields });
      }
      ensuredCount++;
    }
  }

  // ðŸ”¹ gem daily run
  batch.set(runRef, {
    companyId,
    organizationId: companyId,
    locationId,
    dateKey: todayKey,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    taskCount: ensuredCount
  }, { merge: true });

  await batch.commit();

  console.log(`[startDayForLocation] Schedule system usage: newSchedule=${newScheduleCount}, legacy=${legacyScheduleCount}, disabledUnits=${disabledUnitCount}`);

  return {
    ok: true,
    alreadyStarted,
    created: createdCount,
    updated: updatedCount,
    skipped: skippedCount,
    message: runSnap.exists
      ? `Dagens kort er opdateret (${createdCount} nye, ${updatedCount} opdateret, ${skippedCount} uÃ¦ndret).`
      : `Oprettet ${createdCount} opgaver`
  };
});

api.seedDemoData = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind for at oprette demo-data.");
  }

  // CRITICAL: Block seed demo in production
  guardDangerousOperation(context, "seedDemoData");

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
  }

  await assertAdminAccess({
    uid: context.auth.uid,
    email: context.auth.token?.email || "",
    companyId,
    locationId
  });

  const dateKey = getDateKey();
  const nowIso = new Date().toISOString();

  const demoTasks = [
    {
      taskId: "demo_fridge_temperature_1",
      title: "KÃ¸leskab 1 temperatur",
      description: "MÃ¥l temperatur i kÃ¸leskab 1 og udfyld mÃ¥lefelt.",
      type: "measurement",
      measurementUnit: "Â°C",
      minValue: 0,
      maxValue: 5,
      equipmentType: "fridge",
      equipmentName: "KÃ¸leskab 1"
    },
    {
      taskId: "demo_fridge_temperature_2",
      title: "KÃ¸leskab 2 temperatur",
      description: "MÃ¥l temperatur i kÃ¸leskab 2 og udfyld mÃ¥lefelt.",
      type: "measurement",
      measurementUnit: "Â°C",
      minValue: 0,
      maxValue: 5,
      equipmentType: "fridge",
      equipmentName: "KÃ¸leskab 2"
    },
    {
      taskId: "demo_freezer_temperature_1",
      title: "Fryser 1 temperatur",
      description: "MÃ¥l temperatur i fryser 1 og udfyld mÃ¥lefelt.",
      type: "measurement",
      measurementUnit: "Â°C",
      minValue: -30,
      maxValue: -18,
      equipmentType: "freezer",
      equipmentName: "Fryser 1"
    },
    {
      taskId: "demo_cleaning_surface",
      title: "RengÃ¸ring af arbejdsflader",
      description: "Kontroller at arbejdsflader er rengjort og kryds af.",
      type: "check",
      equipmentType: "cleaning",
      equipmentName: "Arbejdsflader"
    },
    {
      taskId: "demo_allergen_separation",
      title: "Adskillelse af allergener",
      description: "BekrÃ¦ft adskillelse mellem allergenvarer og Ã¸vrige varer.",
      type: "check",
      equipmentType: "storage",
      equipmentName: "TÃ¸rvarelager"
    },
    {
      taskId: "demo_receiving_check",
      title: "Varemodtagelse kontrol",
      description: "Kontroller emballage, temperatur og datomÃ¦rkning.",
      type: "check",
      equipmentType: "receiving",
      equipmentName: "Varemodtagelse"
    },
    {
      taskId: "demo_softice_cleaning",
      title: "Softice-maskine rengÃ¸ring",
      description: "RengÃ¸r softice-maskine inkl. tappetud, slanger, pakninger og drypbakke.",
      type: "check",
      equipmentType: "softice",
      equipmentName: "Softice-maskine",
      guideTitle: "Softice-maskine - rengÃ¸ring af maskine og dele",
      guideIntro: "Maskinen skal adskilles og rengÃ¸res efter producentens procedure for at undgÃ¥ bakterievÃ¦kst.",
      guideAreas: [
        "Tappetud, pakninger, slanger, omrÃ¸rer og drypbakke",
        "Beholder og alle produktberÃ¸rte kontaktflader",
        "Korrekt samling af alle dele efter rengÃ¸ring"
      ],
      guideSteps: [
        "Stop drift, tÃ¸m produkt og adskil de dele der skal rengÃ¸res.",
        "Vask, skyl og desinficÃ©r delene efter godkendt rengÃ¸ringsinstruks.",
        "Saml maskinen igen, kÃ¸r test/skyl og registrÃ©r opgaven."
      ],
      guideApproval: [
        "Alle dele er synligt rene og korrekt monteret.",
        "Ingen rester af produkt eller rengÃ¸ringsmiddel.",
        "Maskinen er klar til sikker drift."
      ],
      guideIfNotOk: [
        "RegistrÃ©r afvigelse med hvilken del der ikke er ok.",
        "Gentag rengÃ¸ring fÃ¸r maskinen tages i brug.",
        "Informer ansvarlig ved teknisk fejl eller manglende tÃ¦thed."
      ]
    },
    {
      taskId: "demo_oven_cleaning_and_temp",
      title: "Ovn rengÃ¸ring og temperaturkontrol",
      description: "RengÃ¸r ovn og verificÃ©r at ovntemperatur er korrekt.",
      type: "measurement",
      measurementUnit: "Â°C",
      minValue: 160,
      maxValue: 260,
      equipmentType: "oven",
      equipmentName: "Kombiovn 1",
      guideTitle: "Ovn - rengÃ¸ring og temperaturkontrol",
      guideIntro: "Ovnen skal vÃ¦re ren og holde den temperatur der er sat for sikker tilberedning.",
      guideAreas: [
        "Ovnrum, riste, plader, tÃ¦tningslister og hÃ¥ndtag",
        "Temperaturvisning og evt. kernetermometer",
        "Luftcirkulation og ventilationsÃ¥bninger"
      ],
      guideSteps: [
        "RengÃ¸r ovnens indvendige flader og tilbehÃ¸r.",
        "Forvarm ovnen og mÃ¥l faktisk temperatur med kalibreret termometer.",
        "Indtast mÃ¥lingen og registrÃ©r kommentar ved afvigelse."
      ],
      guideApproval: [
        "Ovnen er fri for fastbrÃ¦ndte rester.",
        "MÃ¥lt temperatur ligger inden for tilladt interval.",
        "Kontrollen er dokumenteret i systemet."
      ],
      guideIfNotOk: [
        "Opret afvigelse med mÃ¥lt temperatur og forventet vÃ¦rdi.",
        "Tag ovn ud af drift ved kritisk temperaturfejl.",
        "Bestil service/kalibrering."
      ]
    },
    {
      taskId: "demo_industrial_dishwasher_temp",
      title: "Industriopvaskemaskine temperaturkontrol",
      description: "KontrollÃ©r vaske-/slutskylletemperatur og rengÃ¸r filtre/dyser.",
      type: "measurement",
      measurementUnit: "Â°C",
      minValue: 60,
      maxValue: 90,
      equipmentType: "dishwasher",
      equipmentName: "Industriopvaskemaskine",
      guideTitle: "Industriopvaskemaskine - rengÃ¸ring og temperatur",
      guideIntro: "Maskinen skal vÃ¦re ren, og temperaturer skal sikre hygiejnisk opvask.",
      guideAreas: [
        "Filtre, dyser, skyllearme og tank",
        "SÃ¦be-/afspÃ¦ndingsdosering",
        "Vaske- og slutskylletemperatur"
      ],
      guideSteps: [
        "RengÃ¸r filtre, dyser og tank efter daglig rutine.",
        "KÃ¸r testprogram og aflÃ¦s temperaturer.",
        "RegistrÃ©r temperaturmÃ¥ling og evt. afvigelse."
      ],
      guideApproval: [
        "Maskinen er rengjort uden madrester.",
        "MÃ¥lt temperatur ligger inden for tilladt interval.",
        "Dokumentation er gemt."
      ],
      guideIfNotOk: [
        "Opret afvigelse med mÃ¥lte temperaturer.",
        "Stop brug ved kritisk afvigelse.",
        "Kontakt service ved gentagne fejl."
      ]
    }
  ];

  const batch = db.batch();
  let createdCount = 0;

  for (const item of demoTasks) {
    const docId = toDocSafeId(`demo__${companyId}__${locationId}__${dateKey}__${item.taskId}`);
    const ref = db.collection("task_instances").doc(docId);
    const snap = await ref.get();
    if (snap.exists) continue;

    batch.set(ref, {
      taskId: item.taskId,
      companyId,
      organizationId: companyId,
      locationId,
      unitId: "",
      title: item.title,
      description: item.description,
      category: "egenkontrol",
      dateKey,
      status: "pending",
      type: item.type,
      requiresMeasurement: item.type === "measurement",
      measurementUnit: item.measurementUnit || "",
      minValue: Number.isFinite(item.minValue) ? item.minValue : null,
      maxValue: Number.isFinite(item.maxValue) ? item.maxValue : null,
      equipmentId: item.taskId,
      equipmentName: item.equipmentName || "",
      equipmentType: item.equipmentType || "",
      guideEnabled: true,
      guideTitle: item.guideTitle || `${item.title} - demo guide`,
      guideIntro: item.guideIntro || "Dette er demo-data. Udfyld kun felter som en medarbejder normalt udfylder.",
      guideAreas: Array.isArray(item.guideAreas) ? item.guideAreas : [],
      guideSteps: Array.isArray(item.guideSteps) ? item.guideSteps : [
        "LÃ¦s opgaven",
        "Udfyld mÃ¥ling eller vÃ¦lg udfÃ¸rt",
        "TilfÃ¸j kommentar ved afvigelse"
      ],
      guideApproval: Array.isArray(item.guideApproval) ? item.guideApproval : [],
      guideIfNotOk: Array.isArray(item.guideIfNotOk) ? item.guideIfNotOk : [],
      frequency: "daily",
      frequencyType: "daily",
      registrationFrequency: "daily",
      registrationFrequencyType: "daily",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      demoSeed: true,
      demoSeedVersion: 1,
      demoSeededAtIso: nowIso
    }, { merge: true });

    createdCount++;
  }

  if (createdCount > 0) {
    await batch.commit();
  }

  return {
    ok: true,
    created: createdCount,
    dateKey
  };
});

api.createStripeCheckoutSession = functions.https.onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"] },
  async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at oprette checkout.");
  }

  const stripe = getStripeClient();

  const addonKeys = sanitizeAddonKeys(data?.addonKeys);
  const origin = normalizeCheckoutOrigin(data?.origin);
  const companyId = String(data?.companyId || "").trim();
  const locationId = String(data?.locationId || "").trim();
  const generatorConfigId = sanitizeString(data?.generatorConfigId || "", 180);
  const successPath = sanitizeRelativePath(data?.successPath, "/modules/business/vision.html?checkout=success&session_id={CHECKOUT_SESSION_ID}");
  const cancelPath = sanitizeRelativePath(data?.cancelPath, "/modules/business/vision.html?checkout=cancel");

  const config = FUNCTIONS_CONFIG.value() || {};
  const stripePriceCore = sanitizeString(config?.stripe?.price_core || process.env.STRIPE_PRICE_CORE || "", 180);

  const coreLineItem = stripePriceCore
    ? { quantity: 1, price: stripePriceCore }
    : {
      quantity: 1,
      price_data: {
        currency: "dkk",
        unit_amount: 199900,
        recurring: { interval: "month" },
        product_data: {
          name: "Madkontrollen Core"
        }
      }
    };

  const lineItems = [
    coreLineItem,
    ...addonKeys.map((key) => {
      const addon = ADDON_CATALOG[key];
      const dynamicPriceKey = `price_${key.replace(/-/g, "_")}`;
      const configuredPriceId = sanitizeString(
        process.env[`STRIPE_${dynamicPriceKey.toUpperCase()}`] || "",
        180
      );

      if (configuredPriceId) {
        return {
          quantity: 1,
          price: configuredPriceId
        };
      }

      return {
        quantity: 1,
        price_data: {
          currency: "dkk",
          unit_amount: addon.amount,
          recurring: { interval: "month" },
          product_data: {
            name: addon.name
          }
        }
      };
    })
  ];

  const successUrl = `${origin}${successPath}`;
  const cancelUrl = `${origin}${cancelPath}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      source: "vision_page",
      uid: context.auth.uid,
      companyId,
      locationId,
      addons: addonKeys.join(","),
      generatorConfigId
    }
  });

  await db.collection("checkout_sessions").add({
    provider: "stripe",
    mode: "subscription",
    status: "created",
    source: "vision_page",
    uid: context.auth.uid,
    companyId,
    locationId,
    addonKeys,
    generatorConfigId,
    stripeSessionId: session.id,
    stripeUrl: session.url || "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    ok: true,
    sessionId: session.id,
    url: session.url
  };
});

api.createOnboardingCheckoutSession = functions.https.onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"] },
  async (request, context) => {
  const data = request.data || request;

  console.log("=== BACKEND DEBUG START ===");
  console.log("Received data type:", typeof data);
  console.log("Received data keys:", data ? Object.keys(data) : "null");
  console.log("data.profile exists?", data?.profile ? "YES" : "NO");
  console.log("data.profile.companyName:", data?.profile?.companyName);
  console.log("data.profile.accountEmail:", data?.profile?.accountEmail);
  console.log("data.profile.accountPassword length:", data?.profile?.accountPassword?.length || 0);
  console.log("=== BACKEND DEBUG END ===");

  const stripe = getStripeClient();
  const stripeConfig = getStripeConfig();
  const authUid = sanitizeString(context.auth?.uid || "", 160);
  const authEmail = sanitizeString(context.auth?.token?.email || "", 160);
  
  // Merge profile and company data - frontend sends both
  const mergedProfile = {
    ...(data?.profile || {}),
    companyName: data?.profile?.companyName || data?.company?.name || "",
    accountEmail: data?.profile?.accountEmail || data?.company?.email || "",
    accountPassword: data?.profile?.accountPassword || data?.company?.accountPassword || "",
    cvr: data?.profile?.cvr || data?.company?.cvr || "",
    address: data?.profile?.address || data?.company?.address || "",
    zip: data?.profile?.zip || data?.company?.zip || "",
    city: data?.profile?.city || data?.company?.city || "",
    phone: data?.profile?.phone || data?.company?.phone || "",
    ownerName: data?.profile?.ownerName || data?.company?.leader || "",
    companyType: data?.profile?.companyType || data?.company?.businessType || ""
  };
  
  const profile = sanitizeOnboardingProfile(mergedProfile);
  const requestedCompanyId = sanitizeString(data?.companyId || "", 120);
  const requestedLocationId = sanitizeString(data?.locationId || "", 120);
  const selectedModules = normalizeCheckoutSelectedModules(
    data?.selectedModules,
    data?.checkoutSummary?.selectedModules,
    data?.module,
    data?.modules
  );
  if (!selectedModules.length) {
    throw new functions.https.HttpsError("invalid-argument", "Vælg mindst ét modul for at fortsætte.");
  }

  // STEP 1: Read and validate billingPlan from frontend
  const normalizedBillingPlan = String(data.billingPlan || "monthly").toLowerCase();
  const selectedStripePriceId = normalizedBillingPlan === "yearly"
    ? stripeConfig.priceYearly
    : stripeConfig.priceMonthly;

  console.log("[createOnboardingCheckoutSession] Selected billing plan:", normalizedBillingPlan);
  console.log("[createOnboardingCheckoutSession] Selected price ID:", selectedStripePriceId);
  console.log("[createOnboardingCheckoutSession] Selected modules:", selectedModules);

  console.log("=== COMPANY/LOCATION ID GENERATION ===");
  console.log("Sanitized profile.companyName:", profile.companyName);
  console.log("requestedCompanyId:", requestedCompanyId);
  console.log("requestedLocationId:", requestedLocationId);

  // Reject placeholder IDs from frontend
  const isPlaceholderCompanyId = !requestedCompanyId || requestedCompanyId.startsWith("company_");
  const isPlaceholderLocationId = !requestedLocationId || requestedLocationId.startsWith("location_");

  if (isPlaceholderCompanyId) {
    console.log("[ID_GENERATION] Rejecting placeholder companyId, will generate real ID");
  }
  if (isPlaceholderLocationId) {
    console.log("[ID_GENERATION] Rejecting placeholder locationId, will generate real ID");
  }

  // STEP 2: Get or create company via transaction (deduplication)
  let companyId = null;
  let companyKey = null;
  let keyType = null;
  let companyAlreadyExists = false;

  // Always generate real company ID (ignore placeholders)
  if (isPlaceholderCompanyId) {
    const companyResult = await db.runTransaction(async (tx) => {
      return await getOrCreateCompany(tx, {
        cvr: profile.cvr,
        companyName: profile.companyName,
        address: profile.address,
        zip: profile.zip,
        city: profile.city
      });
    });

    companyId = companyResult.companyId;
    companyKey = companyResult.companyKey;
    keyType = companyResult.keyType;
    companyAlreadyExists = companyResult.alreadyExists;

    console.log("[COMPANY] Created/found:", companyId, "Key:", companyKey, "Type:", keyType, "Exists:", companyAlreadyExists);
  } else {
    companyId = requestedCompanyId;
    console.log("[COMPANY] Using requested companyId:", companyId);
  }

  // Always generate real location ID (ignore placeholders)
  const locationId = isPlaceholderLocationId 
    ? toDocSafeId(`${companyId}__main`).slice(0, 120)
    : requestedLocationId;

  console.log("Generated companyId:", companyId);
  console.log("Generated locationId:", locationId);
  console.log("=== END ID GENERATION ===");

  const origin = normalizeCheckoutOrigin(data?.origin);
  const successPath = sanitizeRelativePath(
    data?.successPath,
    "/tak?checkout=success&session_id={CHECKOUT_SESSION_ID}"
  );
  const cancelPath = sanitizeRelativePath(
    data?.cancelPath,
    "/modules/egenkontrol/onboarding.html?checkout=cancel"
  );

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }

  if (authUid && requestedCompanyId && requestedLocationId) {
    await assertSeoGeneratorAccess({
      uid: authUid,
      email: authEmail,
      companyId,
      locationId
    });
  }

  const riskModel = sanitizeRiskModelInput(data?.riskModel || {});
  let quickOnboardingSetup = null;
  if (data?.setup && typeof data.setup === "object") {
    try {
      const { normalizeQuickOnboardingSetup } = require("./js/setupToCanonicalRoutines");
      quickOnboardingSetup = normalizeQuickOnboardingSetup(data.setup || {});
    } catch (setupErr) {
      console.warn("[createOnboardingCheckoutSession] quick setup normalization failed:", setupErr.message);
    }
  }
  const cloudinaryAssets = extractCloudinaryAssets(
    data?.cloudinaryAssets,
    data?.profile?.cloudinaryAssets,
    data?.profile?.attachments,
    data?.profile?.images
  );
  const onboardingEmail = sanitizeString(data?.profile?.accountEmail || data?.email || "", 160);
  const provisioningToken = toDocSafeId(`${Date.now()}_${Math.random().toString(36).slice(2)}_${companyId}_${locationId}`).slice(0, 180);

  if (!profile.companyName) {
    console.error("BACKEND ERROR: companyName missing. Received profile:", JSON.stringify(data?.profile || {}));
    console.error("BACKEND ERROR: Sanitized profile.companyName:", profile.companyName);
    throw new functions.https.HttpsError(
      "invalid-argument", 
      `Virksomhedsnavn mangler. Modtaget: '${data?.profile?.companyName}', Saniteret: '${profile.companyName}'`
    );
  }

  const userData = authUid
    ? (await getUserAccessProfile({ uid: authUid, email: authEmail }) || {})
    : {};
  const customerName = deriveCustomerName({
    profile,
    userData,
    email: authEmail || onboardingEmail
  });
  const summary = buildOnboardingSummary({
    profile,
    riskModel,
    customerName
  });

  const sourceType = sanitizeString(data?.source || "onboarding_checkout", 60);

  const draftRef = await db.collection("onboarding_checkout_drafts").add({
    uid: authUid || "",
    userEmail: authEmail || onboardingEmail,
    onboardingEmail,
    provisioningToken,
    companyId,
    organizationId: companyId,
    locationId,
    selectedModules,
    activeModules: selectedModules,
    moduleAccess: buildCheckoutModuleAccess(selectedModules),
    profile,
    setup: quickOnboardingSetup,
    quickOnboardingSetup,
    riskModel,
    summary,
    cloudinaryAssets,
    billingPlan: normalizedBillingPlan,
    stripePriceId: selectedStripePriceId,
    source: sourceType,
    status: "awaiting_payment",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

// STEP 3: Build Stripe line items using price ID from config
  const lineItems = [
    {
      price: selectedStripePriceId,
      quantity: 1
    }
  ];

  console.log("[BILLING] Line items created with price ID:", selectedStripePriceId);

  const successUrl = `${origin}${successPath}${successPath.includes("?") ? "&" : "?"}draftId=${encodeURIComponent(draftRef.id)}`;
  const successUrlWithToken = `${successUrl}&provisioning_token=${encodeURIComponent(provisioningToken)}`;
  const cancelUrl = `${origin}${cancelPath}${cancelPath.includes("?") ? "&" : "?"}draftId=${encodeURIComponent(draftRef.id)}&provisioning_token=${encodeURIComponent(provisioningToken)}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems,
    customer_email: onboardingEmail || authEmail || undefined,
    success_url: successUrlWithToken,
    cancel_url: cancelUrl,
    metadata: {
      source: sourceType,
      uid: authUid || "guest",
      companyId,
      locationId,
      draftId: draftRef.id,
      provisioningToken,
      onboardingEmail,
      selectedModules: selectedModules.join(","),
      plan: normalizedBillingPlan,
      companyKey: companyKey || "",
      keyType: keyType || ""
    }
  });

  await draftRef.set({
    stripeSessionId: session.id,
    stripeUrl: session.url || "",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await db.collection("checkout_sessions").add({
    provider: "stripe",
    mode: "subscription",
    status: "created",
    source: sourceType,
    uid: authUid || "",
    companyId,
    locationId,
    addonKeys: [],
    selectedModules,
    activeModules: selectedModules,
    onboardingDraftId: draftRef.id,
    stripeSessionId: session.id,
    stripeUrl: session.url || "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  return {
    ok: true,
    draftId: draftRef.id,
    sessionId: session.id,
    url: session.url,
    summary
  };
});

api.finalizeSeoCheckoutProvisioning = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at aktivere SEO-modulet.");
  }

  const stripe = getStripeClient();
  const sessionId = sanitizeString(data?.sessionId || "", 220);
  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const configId = sanitizeString(data?.configId || "", 180);

  if (!sessionId || !companyId || !locationId || !configId) {
    throw new functions.https.HttpsError("invalid-argument", "sessionId, companyId, locationId og configId er paakraevet.");
  }

  await assertAdminAccess({
    uid: context.auth.uid,
    email: context.auth.token?.email || "",
    companyId,
    locationId
  });

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  const status = sanitizeString(checkoutSession?.status || "", 40).toLowerCase();
  const paymentStatus = sanitizeString(checkoutSession?.payment_status || "", 40).toLowerCase();
  const addonKeys = sanitizeAddonKeys(
    String(checkoutSession?.metadata?.addons || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  if (!addonKeys.includes("seo")) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-session indeholder ikke SEO-modulet.");
  }

  const isPaid = status === "complete" && (paymentStatus === "paid" || paymentStatus === "no_payment_required");
  if (!isPaid) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout er ikke gennemfoert endnu.");
  }

  const configSnap = await db.collection("seo_generator_configs").doc(configId).get();
  if (!configSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Generator-konfiguration blev ikke fundet.");
  }

  const config = configSnap.data() || {};
  if (
    sanitizeString(config.companyId || config.organizationId, 120) !== companyId ||
    sanitizeString(config.locationId || "", 120) !== locationId
  ) {
    throw new functions.https.HttpsError("permission-denied", "Konfigurationen tilhoerer ikke valgt company/location.");
  }

  const result = await upsertWebsiteAndSeoPages({
    companyId,
    locationId,
    config,
    activatedByUid: context.auth.uid
  });

  const matchingCheckoutSessions = await db
    .collection("checkout_sessions")
    .where("stripeSessionId", "==", sessionId)
    .limit(5)
    .get();

  if (!matchingCheckoutSessions.empty) {
    const batch = db.batch();
    matchingCheckoutSessions.docs.forEach((docSnap) => {
      batch.set(docSnap.ref, {
        status: "completed",
        addonKeys,
        generatorConfigId: configId,
        seoProvisioned: true,
        seoWebsiteId: result.websiteId,
        seoGeneratedPages: result.generatedPages,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
    await batch.commit();
  }

  await db.collection("seo_generator_configs").doc(configId).set({
    seoModuleActive: true,
    seoWebsiteId: result.websiteId,
    seoGeneratedPages: result.generatedPages,
    seoProvisionedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    ok: true,
    websiteId: result.websiteId,
    generatedPages: result.generatedPages,
    subdomain: result.subdomain
  };
});

api.adminActivateSeoSite = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Log ind for at aktivere SEO-site.");
  }
  const companyId  = sanitizeString(data?.companyId  || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }
  await assertAdminAccess({ uid: context.auth.uid, email: context.auth.token?.email || "", companyId, locationId });

  // Use provided inline config or load saved config from Firestore
  let config = data?.config || null;
  if (!config) {
    const configId = sanitizeString(data?.configId || "", 180);
    if (!configId) throw new functions.https.HttpsError("invalid-argument", "config eller configId er pÃ¥krÃ¦vet.");
    const snap = await db.collection("seo_generator_configs").doc(configId).get();
    if (!snap.exists) throw new functions.https.HttpsError("not-found", "Generator-konfiguration ikke fundet.");
    config = snap.data();
  }

  const result = await upsertWebsiteAndSeoPages({ companyId, locationId, config, activatedByUid: context.auth.uid });

  // Mark SEO addon as active on the company location
  await db.collection("company_locations").doc(`${companyId}__${locationId}`).set({
    addons: { seo: true },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});

  return { ok: true, websiteId: result.websiteId, generatedPages: result.generatedPages, subdomain: result.subdomain };
});

api.createHaccpSnapshotFromOnboarding = functions.https.onCall(async (data, context) => {
  const userId = context.auth?.uid || "signup_anonymous";
  const companyId = sanitizeString(data?.companyId || "", 120) || "signup_unassigned";
  const locationId = sanitizeString(data?.locationId || "", 120) || "signup_unassigned";

  return {
    ok: true,
    ...(await createHaccpSnapshotDocument({
      profile: data?.profile || {},
      riskModel: data?.riskModel || {},
      companyId,
      locationId,
      userId
    }))
  };
});

api.provisionRiskAnalysisSnapshot = functions.https.onCall(async (request, context) => {
  const data = request.data || request;
  const { generateRiskAnalysisSnapshot } = require("./riskAnalysisLibrary");
  
  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const organizationId = sanitizeString(data?.organizationId || companyId, 120);
  const industry = sanitizeString(data?.industry || "restaurant", 60);
  const companyName = sanitizeString(data?.companyName || "", 160);
  const profile = data?.profile || {};
  
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }
  
  console.log("[provisionRiskAnalysisSnapshot] START", { companyId, locationId, industry });
  
  try {
    // Check if snapshot already exists
    const existingSnapshotsQuery = await db.collection("haccp_snapshots")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    
    if (!existingSnapshotsQuery.empty) {
      const existingSnapshot = existingSnapshotsQuery.docs[0].data();
      
      // Don't overwrite manual edits
      if (existingSnapshot.manualEdited || existingSnapshot.manualOverride) {
        console.log("[provisionRiskAnalysisSnapshot] Snapshot has manual edits, skipping update");
        return {
          ok: true,
          skipped: true,
          reason: "manual_edits_present",
          snapshotId: existingSnapshotsQuery.docs[0].id
        };
      }
      
      // Update auto-generated snapshot if version is older
      if (existingSnapshot.autoGenerated) {
        const existingVersion = existingSnapshot.version || "0.0.0";
        const newVersion = "2.0.0";
        
        if (existingVersion >= newVersion) {
          console.log("[provisionRiskAnalysisSnapshot] Snapshot is up to date");
          return {
            ok: true,
            skipped: true,
            reason: "already_up_to_date",
            snapshotId: existingSnapshotsQuery.docs[0].id,
            version: existingVersion
          };
        }
        
        console.log("[provisionRiskAnalysisSnapshot] Updating auto-generated snapshot");
        const updatedSnapshot = generateRiskAnalysisSnapshot({
          companyId,
          locationId,
          organizationId,
          industry,
          companyName,
          profile
        });
        
        await existingSnapshotsQuery.docs[0].ref.update({
          ...updatedSnapshot,
          updatedAt: FieldValue.serverTimestamp()
        });
        
        return {
          ok: true,
          updated: true,
          snapshotId: existingSnapshotsQuery.docs[0].id,
          controlPointsCount: updatedSnapshot.controlPoints.length
        };
      }
    }
    
    // Create new snapshot
    console.log("[provisionRiskAnalysisSnapshot] Creating new snapshot");
    const snapshot = generateRiskAnalysisSnapshot({
      companyId,
      locationId,
      organizationId,
      industry,
      companyName,
      profile
    });
    
    const docRef = await db.collection("haccp_snapshots").add({
      ...snapshot,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionRiskAnalysisSnapshot] SUCCESS", {
      snapshotId: docRef.id,
      controlPointsCount: snapshot.controlPoints.length
    });
    
    return {
      ok: true,
      created: true,
      snapshotId: docRef.id,
      controlPointsCount: snapshot.controlPoints.length,
      industry: snapshot.industry,
      industryDisplayName: snapshot.industryDisplayName
    };
    
  } catch (error) {
    console.error("[provisionRiskAnalysisSnapshot] ERROR:", error);
    throw new functions.https.HttpsError("internal", `Kunne ikke oprette risikoanalyse: ${error.message}`);
  }
});

api.createQuickOnboardingAccount = onCall(async (request) => {
  const { generateRiskAnalysisSnapshot } = require("./riskAnalysisLibrary");
  
  // V2 callable: payload is in request.data
  const payload = request.data || {};
  
  console.log("[createQuickOnboardingAccount] Received payload keys:", Object.keys(payload).join(", "));
  
  // Parse input
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const companyName = String(payload.companyName || "").trim();
  const address = String(payload.address || "").trim();
  const postalCode = String(payload.postalCode || "").trim();
  const city = String(payload.city || "").trim();
  const phone = String(payload.phone || "").trim();
  const industry = String(payload.industry || "restaurant").trim();
  const profile = payload.profile || {};

  const allowedQuickModules = new Set(["pos", "lagerkontrol", "bogforing", "egenkontrol", "menu", "seo", "kalkulation", "koerselskontrol"]);
  const quickModuleAliases = {
    accounting: "bogforing",
    bogfoering: "bogforing",
    "bogføring": "bogforing"
  };
  const selectedModules = Array.isArray(payload.selectedModules)
    ? payload.selectedModules
        .map((moduleSlug) => String(moduleSlug || "").trim().toLowerCase())
        .map((moduleSlug) => quickModuleAliases[moduleSlug] || moduleSlug)
        .filter((moduleSlug) => allowedQuickModules.has(moduleSlug))
    : [];

  const enabledModules = Array.from(new Set(selectedModules));
  if (!enabledModules.length) {
    throw new HttpsError("invalid-argument", "Vælg mindst ét modul for at fortsætte.");
  }

  const hasEgenkontrol = selectedModules.includes("egenkontrol");
  const hasPos = selectedModules.includes("pos");
  const hasLagerkontrol = selectedModules.includes("lagerkontrol");
  const hasBogforing = selectedModules.includes("bogforing");
  const hasMenu = selectedModules.includes("menu");
  const hasSeo = selectedModules.includes("seo");

  const moduleAccess = enabledModules.reduce((acc, moduleSlug) => {
    acc[moduleSlug] = {
      enabled: true,
      status: "trial",
      source: "quick-onboarding",
      activatedAt: FieldValue.serverTimestamp()
    };
    return acc;
  }, {});
  
  console.log("[createQuickOnboardingAccount] parsed:", {
    hasEmail: !!email,
    hasPassword: !!password,
    hasCompanyName: !!companyName,
    hasAddress: !!address,
    hasPhone: !!phone,
    industry,
    selectedModules: enabledModules,
    moduleFlags: {
      hasEgenkontrol,
      hasPos,
      hasLagerkontrol,
      hasBogforing,
      hasMenu,
      hasSeo
    }
  });
  
  // Validate input
  if (!email || !password || !companyName) {
    throw new HttpsError("invalid-argument", "Email, password og firmanavn er pÃ¥krÃ¦vet.");
  }
  
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Kodeordet skal vÃ¦re mindst 6 tegn.");
  }
  
  console.log("[createQuickOnboardingAccount] START", { email, companyName, industry });
  
  let uid;
  let companyId;
  let locationId;
  
  try {
    // Step 1: Create Firebase Auth user with Admin SDK
    console.log("[createQuickOnboardingAccount] STEP 1: Creating Auth user...");
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: companyName,
        emailVerified: false
      });
      console.log("[createQuickOnboardingAccount] STEP 1: SUCCESS - uid:", userRecord.uid);
    } catch (authError) {
      console.error("[createQuickOnboardingAccount] STEP 1 FAILED:", authError.code, authError.message);
      if (authError.code === "auth/email-already-exists") {
        throw new HttpsError("already-exists", "Denne email er allerede i brug.");
      }
      throw new HttpsError("internal", `Auth user creation failed: ${authError.message}`);
    }
    
    uid = userRecord.uid;
    
    // Step 2: Generate IDs
    console.log("[createQuickOnboardingAccount] STEP 2: Generating IDs...");
    companyId = `company_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    locationId = `location_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const organizationId = companyId;
    console.log("[createQuickOnboardingAccount] STEP 2: SUCCESS - companyId:", companyId, "locationId:", locationId);
    
    // Step 3: Calculate trial dates
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days
    const ownerScopeMetadata = buildOwnerScopeMetadata(OWNER_KIND.REAL_OWNER);
    
    // Step 4: Create company document
    console.log("[createQuickOnboardingAccount] STEP 3: Creating company...");
    try {
      await db.collection("companies").doc(companyId).set({
      id: companyId,
      name: companyName,
      companyName: companyName,
      organizationId: companyId,
      ...ownerScopeMetadata,
      ownerUid: uid,
      address: address,
      postalCode: postalCode,
      city: city,
      phone: phone,
      status: "trial",
      subscriptionStatus: "trial",
      isPaid: false,
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      activeModules: enabledModules,
      moduleAccess: moduleAccess,
      modules: moduleAccess,
      trialStartedAt: FieldValue.serverTimestamp(),
      trialEndsAt: trialEndsAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
      console.log("[createQuickOnboardingAccount] STEP 3: SUCCESS");
    } catch (companyError) {
      console.error("[createQuickOnboardingAccount] STEP 3 FAILED:", companyError);
      throw new HttpsError("internal", `Company creation failed: ${companyError.message}`);
    }
    
    // Step 5: Create location document
    console.log("[createQuickOnboardingAccount] STEP 4: Creating location...");
    try {
      const locationData = {
        id: locationId,
        locationId: locationId,
        companyId: companyId,
        organizationId: companyId,
        ...ownerScopeMetadata,
        name: companyName,
        companyName: companyName,
        prettyName: companyName,
        address: address,
        postalCode: postalCode,
        city: city,
        phone: phone,
        status: "active",
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      
      // Create in main locations collection
      await db.collection("locations").doc(locationId).set(locationData);
      
      // ALSO create in companies/{companyId}/locations subcollection (for prettyName.js)
      await db.collection("companies").doc(companyId).collection("locations").doc(locationId).set(locationData);
      
      console.log("[createQuickOnboardingAccount] STEP 4: SUCCESS (created in both locations and companies/{companyId}/locations)");
    } catch (locationError) {
      console.error("[createQuickOnboardingAccount] STEP 4 FAILED:", locationError);
      throw new HttpsError("internal", `Location creation failed: ${locationError.message}`);
    }
    
    // Step 6: Create user document
    console.log("[createQuickOnboardingAccount] STEP 5: Creating user document...");
    try {
      await db.collection("users").doc(uid).set({
      uid: uid,
      email: email,
      companyId: companyId,
      locationId: locationId,
      locationIds: [locationId],
      organizationId: companyId,
      ...ownerScopeMetadata,
      role: "owner",
      onboardingCompleted: false,
      trialStartedAt: FieldValue.serverTimestamp(),
      trialEndsAt: trialEndsAt,
      isPaid: false,
      subscriptionStatus: "trial",
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      activeModules: enabledModules,
      moduleAccess: moduleAccess,
      modules: moduleAccess,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
      console.log("[createQuickOnboardingAccount] STEP 5: SUCCESS");
    } catch (userError) {
      console.error("[createQuickOnboardingAccount] STEP 5 FAILED:", userError);
      throw new HttpsError("internal", `User document creation failed: ${userError.message}`);
    }
    
    // Step 7: Create live_user_profiles document
    console.log("[createQuickOnboardingAccount] STEP 6: Creating live_user_profiles...");
    try {
    const liveProfileId = `${companyId}__${locationId}__live_profile`;
    await db.collection("live_user_profiles").doc(liveProfileId).set({
      uid: uid,
      email: email,
      companyId: companyId,
      locationId: locationId,
      organizationId: companyId,
      ...ownerScopeMetadata,
      role: "owner",
      
      profile: {
        // KRITISK FELTER (primÃ¦re)
        companyName: companyName,
        profileCompanyName: companyName,
        accountEmail: email,
        
        // FALLBACK FELTER (bruges i UI)
        name: companyName,
        displayName: companyName,
        
        // KONTAKT FELTER (fra input)
        address: address,
        postalCode: postalCode,
        city: city,
        phone: phone,
        cvr: "",
        
        // STRUKTUR KONSISTENS
        locationName: "Hovedlokation"
      },
      
      latestLiveProfileId: liveProfileId,
      
      status: "active",
      subscriptionStatus: "trial",
      isPaid: false,
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      activeModules: enabledModules,
      moduleAccess: moduleAccess,
      modules: moduleAccess,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
      console.log("[createQuickOnboardingAccount] STEP 6: SUCCESS");
    } catch (profileError) {
      console.error("[createQuickOnboardingAccount] STEP 6 FAILED:", profileError);
      throw new HttpsError("internal", `Live profile creation failed: ${profileError.message}`);
    }
    
    // Step 7: Complete Egenkontrol onboarding with equipment and routines
    console.log("[createQuickOnboardingAccount] STEP 7: Completing onboarding with setup...");
    let onboardingResult = null;
    // Module-driven provisioning via the central MODULE_PROVISIONERS map (no scattered if-statements).
    // selectedModules decide which provisioner runs; egenkontrol keeps its exact previous behavior,
    // other modules are registry-ready no-ops until they have their own setup/runtime.
    const { runModuleProvisioners } = require("./modules/onboarding/moduleProvisioners");
    const moduleSetup = (payload.moduleSetup && typeof payload.moduleSetup === "object") ? payload.moduleSetup : {};
    const provisionResults = await runModuleProvisioners(enabledModules, {
      db,
      FieldValue,
      companyId,
      locationId,
      userId: uid,
      industry,
      // prefer the new moduleSetup.egenkontrol; fall back to the legacy flat setup payload
      setup: moduleSetup.egenkontrol || payload.setup,
      ownerScopeMetadata,
      generateCanonicalTaskTemplates,
      startDayForLocationCanonical
    });
    console.log("[createQuickOnboardingAccount] STEP 7 module provisioning:", provisionResults);

    const egenkontrolResult = provisionResults.egenkontrol;
    onboardingResult = (egenkontrolResult && !egenkontrolResult.error && !egenkontrolResult.skipped)
      ? egenkontrolResult
      : null;
    
    console.log("[createQuickOnboardingAccount] ALL STEPS COMPLETE", {
      uid,
      companyId,
      locationId,
      onboardingCompleted: !!onboardingResult
    });
    
    return {
      ok: true,
      uid: uid,
      email: email,
      companyId: companyId,
      locationId: locationId,
      organizationId: organizationId,
      selectedModules: enabledModules,
      enabledModules: enabledModules,
      ...(onboardingResult || {})
    };
    
  } catch (error) {
    console.error("[createQuickOnboardingAccount] ERROR:", error);
    
    // If error is already HttpsError, rethrow it
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", `Kunne ikke oprette konto: ${error.message}`);
  }
});

api.completeQuickOnboarding = onCall({ region: "us-central1" }, async (request) => {
  const {
    normalizeQuickOnboardingSetup,
    resolveCanonicalRoutineKeysFromSetup,
    buildEquipmentFromSetup
  } = require("./js/setupToCanonicalRoutines");
  
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }
  
  const payload = request.data || {};
  const userId = request.auth.uid;
  
  console.log("[completeQuickOnboarding] START", {
    userId,
    hasSetup: !!payload.setup,
    hasCompanyId: !!payload.companyId,
    hasLocationId: !!payload.locationId
  });
  
  try {
    // Validate required fields
    const companyId = String(payload.companyId || "").trim();
    const locationId = String(payload.locationId || "").trim();
    
    if (!companyId || !locationId) {
      throw new HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
    }

    const companySnap = await db.collection("companies").doc(companyId).get();
    const ownerScopeMetadata = buildOwnerScopeMetadata(companySnap.data()?.ownerKind || OWNER_KIND.REAL_OWNER);
    const companyModules = Array.isArray(companySnap.data()?.activeModules)
      ? companySnap.data().activeModules.map((moduleSlug) => String(moduleSlug || "").trim().toLowerCase()).filter(Boolean)
      : [];
    if (companyModules.length && !companyModules.includes("egenkontrol")) {
      console.log("[completeQuickOnboarding] skipped: Egenkontrol not active for company", {
        companyId,
        locationId,
        activeModules: companyModules
      });
      return {
        ok: true,
        skipped: true,
        reason: "egenkontrol_not_selected",
        companyId,
        locationId
      };
    }
    
    // Normalize setup
    const setup = normalizeQuickOnboardingSetup(payload.setup || {});
    console.log("[completeQuickOnboarding] Normalized setup:", setup);
    
    // Resolve routine keys
    const routineKeys = resolveCanonicalRoutineKeysFromSetup(setup);
    console.log("[completeQuickOnboarding] Routine keys:", routineKeys);
    
    // Build equipment
    const equipmentUnits = buildEquipmentFromSetup(setup, {
      companyId,
      locationId,
      userId
    }).map((unit) => ({ ...unit, ...ownerScopeMetadata }));
    console.log("[completeQuickOnboarding] Equipment units:", equipmentUnits.length);
    
    // Save equipment to Firestore
    for (const unit of equipmentUnits) {
      await db.collection("equipment").doc(unit.id).set(unit, { merge: true });
    }
    console.log("[completeQuickOnboarding] Equipment saved");

    const equipmentCounts = equipmentUnits.reduce((acc, unit) => {
      const type = String(unit.type || unit.equipmentType || "").trim();
      if (type) acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    await db.collection("onboarding_answers").doc(`${companyId}__${locationId}__onboarding`).set({
      companyId,
      organizationId: companyId,
      locationId,
      ...ownerScopeMetadata,
      equipmentCounts,
      quickOnboardingSetup: setup,
      source: "quick_onboarding",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Generate canonical templates (FILTERED by routineKeys)
    const templatesResult = await generateCanonicalTaskTemplates({
      db,
      companyId,
      locationId,
      routineKeys,
      units: equipmentUnits,
      ownerScopeMetadata
    });
    console.log("[completeQuickOnboarding] Templates generated:", templatesResult);
    
    // Generate instances for today (FILTERED by routineKeys)
    const todayDateKey = new Date().toISOString().slice(0, 10);
    const instancesResult = await startDayForLocationCanonical({
      db,
      companyId,
      locationId,
      dateKey: todayDateKey,
      createdBy: userId,
      routineKeys,
      ownerScopeMetadata
    });
    console.log("[completeQuickOnboarding] Instances generated:", instancesResult);
    
    // Update company with setup
    await db.collection("companies").doc(companyId).update({
      quickOnboardingSetup: setup,
      quickOnboardingCompletedAt: FieldValue.serverTimestamp(),
      ...ownerScopeMetadata,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Update location with setup
    await db.collection("locations").doc(locationId).update({
      quickOnboardingSetup: setup,
      quickOnboardingCompletedAt: FieldValue.serverTimestamp(),
      ...ownerScopeMetadata,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[completeQuickOnboarding] SUCCESS", {
      companyId,
      locationId,
      equipmentCount: equipmentUnits.length,
      templatesCount: templatesResult.created + templatesResult.updated,
      instancesCount: instancesResult.instancesCreated,
      routineKeys: routineKeys.length
    });
    
    return {
      ok: true,
      companyId,
      locationId,
      equipmentCount: equipmentUnits.length,
      templatesCount: templatesResult.created + templatesResult.updated,
      instancesCount: instancesResult.instancesCreated,
      routineKeys
    };
    
  } catch (error) {
    console.error("[completeQuickOnboarding] ERROR:", error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", `Kunne ikke fÃ¦rdiggÃ¸re onboarding: ${error.message}`);
  }
});

api.provisionQuickOnboardingAccount = functions.https.onCall(async (request, context) => {
  const data = request.data || request;
  const { generateRiskAnalysisSnapshot } = require("./riskAnalysisLibrary");
  
  const uid = sanitizeString(data?.uid || "", 160);
  const email = sanitizeString(data?.email || "", 160);
  const companyName = sanitizeString(data?.companyName || "", 160);
  const industry = sanitizeString(data?.industry || "restaurant", 60);
  const profile = data?.profile || data?.setup ? {
    equipment: data?.setup?.equipment || data?.equipment || {}
  } : {};
  
  // Verify authentication
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }
  
  if (context.auth.uid !== uid) {
    throw new functions.https.HttpsError("permission-denied", "UID matcher ikke.");
  }
  
  if (!email || !companyName) {
    throw new functions.https.HttpsError("invalid-argument", "Email og firmanavn er pÃ¥krÃ¦vet.");
  }
  
  console.log("[provisionQuickOnboardingAccount] START", { uid, email, companyName, industry });
  
  try {
    // Generate IDs
    const companyId = `company_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const locationId = `location_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const organizationId = companyId;
    
    // Calculate trial dates
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days
    const ownerScopeMetadata = buildOwnerScopeMetadata(OWNER_KIND.REAL_OWNER);
    
    console.log("[provisionQuickOnboardingAccount] Creating company:", companyId);
    
    // Create company document
    await db.collection("companies").doc(companyId).set({
      id: companyId,
      name: companyName,
      companyName: companyName,
      organizationId: companyId,
      ...ownerScopeMetadata,
      ownerUid: uid,
      status: "trial",
      subscriptionStatus: "trial",
      isPaid: false,
      trialStartedAt: FieldValue.serverTimestamp(),
      trialEndsAt: trialEndsAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionQuickOnboardingAccount] Creating location:", locationId);
    
    // Create location document
    await db.collection("locations").doc(locationId).set({
      id: locationId,
      locationId: locationId,
      companyId: companyId,
      organizationId: companyId,
      ...ownerScopeMetadata,
      name: "Hovedlokation",
      prettyName: "Hovedlokation",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionQuickOnboardingAccount] Creating user document:", uid);
    
    // Create user document
    await db.collection("users").doc(uid).set({
      uid: uid,
      email: email,
      companyId: companyId,
      locationId: locationId,
      locationIds: [locationId],
      organizationId: companyId,
      ...ownerScopeMetadata,
      role: "owner",
      onboardingCompleted: false,
      trialStartedAt: FieldValue.serverTimestamp(),
      trialEndsAt: trialEndsAt,
      isPaid: false,
      subscriptionStatus: "trial",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionQuickOnboardingAccount] Creating live_user_profiles document...");
    
    // Create live_user_profiles document
    const liveProfileId = `${companyId}__${locationId}__live_profile`;
    await db.collection("live_user_profiles").doc(liveProfileId).set({
      uid: uid,
      email: email,
      companyId: companyId,
      locationId: locationId,
      organizationId: companyId,
      ...ownerScopeMetadata,
      role: "owner",
      profile: {
        companyName: companyName,
        accountEmail: email
      },
      status: "active",
      subscriptionStatus: "trial",
      isPaid: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionQuickOnboardingAccount] Creating haccp_snapshots document...");
    
    // Create haccp_snapshots via risk library
    const snapshot = generateRiskAnalysisSnapshot({
      companyId,
      locationId,
      organizationId,
      industry,
      companyName,
      profile
    });
    
    await db.collection("haccp_snapshots").add({
      ...snapshot,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log("[provisionQuickOnboardingAccount] SUCCESS", {
      companyId,
      locationId,
      uid,
      controlPointsCount: snapshot.controlPoints.length
    });
    
    return {
      ok: true,
      companyId,
      locationId,
      organizationId,
      uid,
      controlPointsCount: snapshot.controlPoints.length,
      industry: snapshot.industry,
      industryDisplayName: snapshot.industryDisplayName
    };
    
  } catch (error) {
    console.error("[provisionQuickOnboardingAccount] ERROR:", error);
    throw new functions.https.HttpsError("internal", `Kunne ikke oprette konto: ${error.message}`);
  }
});

api.finalizeOnboardingCheckoutProvisioning = functions.https.onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"] },
  async (request, context) => {
  // Firebase Functions v2 callable wraps payload in request.data
  const data = request.data || request;
  const stripe = getStripeClient();
  const authUid = sanitizeString(context.auth?.uid || "", 160);
  const authEmail = sanitizeString(context.auth?.token?.email || "", 160);
  const sessionId = sanitizeString(data?.sessionId || "", 220);
  const requestedDraftId = sanitizeString(data?.draftId || "", 180);
  const requestedProvisioningToken = sanitizeString(data?.provisioningToken || "", 220);

  if (!sessionId) {
    throw new functions.https.HttpsError("invalid-argument", "sessionId er pÃ¥krÃ¦vet.");
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionStatus = sanitizeString(checkoutSession?.status || "", 40).toLowerCase();
  const paymentStatus = sanitizeString(checkoutSession?.payment_status || "", 40).toLowerCase();
  const metadataDraftId = sanitizeString(checkoutSession?.metadata?.draftId || "", 180);
  const draftId = requestedDraftId || metadataDraftId;
  const companyId = sanitizeString(checkoutSession?.metadata?.companyId || data?.companyId || "", 120);
  const locationId = sanitizeString(checkoutSession?.metadata?.locationId || data?.locationId || "", 120);
  const metadataProvisioningToken = sanitizeString(checkoutSession?.metadata?.provisioningToken || "", 220);
  const source = sanitizeString(checkoutSession?.metadata?.source || "", 80);
  const billingPlan = sanitizeString(checkoutSession?.metadata?.plan || "monthly", 40);
  
  console.log("[FINALIZE] Billing plan from metadata:", billingPlan);

  if (source !== "onboarding_checkout") {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-session tilhÃ¸rer ikke onboarding-flowet.");
  }

  if (!draftId || !companyId || !locationId) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-session mangler draft/company/location metadata.");
  }

  const isPaid = sessionStatus === "complete" && (paymentStatus === "paid" || paymentStatus === "no_payment_required");
  if (!isPaid) {
    throw new functions.https.HttpsError("failed-precondition", "Betalingen er ikke gennemfÃ¸rt endnu.");
  }

  const draftRef = db.collection("onboarding_checkout_drafts").doc(draftId);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Onboarding-draft blev ikke fundet.");
  }

  const draft = draftSnap.data() || {};
  if (sanitizeString(draft.companyId || draft.organizationId, 120) !== companyId || sanitizeString(draft.locationId, 120) !== locationId) {
    throw new functions.https.HttpsError("permission-denied", "Draft tilhÃ¸rer ikke valgt company/location.");
  }

  const selectedModules = normalizeCheckoutSelectedModules(
    draft.selectedModules,
    checkoutSession?.metadata?.selectedModules,
    data?.selectedModules,
    draft.checkoutSummary?.selectedModules
  );
  if (!selectedModules.length) {
    throw new functions.https.HttpsError("failed-precondition", "Checkout-draft mangler valgte moduler.");
  }
  const hasEgenkontrol = selectedModules.includes("egenkontrol");
  const hasPos = selectedModules.includes("pos");
  const hasLagerkontrol = selectedModules.includes("lagerkontrol");
  const hasBogforing = selectedModules.includes("bogforing");
  const hasMenu = selectedModules.includes("menu");
  const hasSeo = selectedModules.includes("seo");
  const moduleAccess = buildCheckoutModuleAccess(selectedModules);
  const moduleMap = buildCheckoutModuleMap(selectedModules);

  console.log("[FINALIZE] Selected modules:", {
    selectedModules,
    hasEgenkontrol,
    hasPos,
    hasLagerkontrol,
    hasBogforing,
    hasMenu,
    hasSeo
  });

  const effectiveProvisioningToken = requestedProvisioningToken || metadataProvisioningToken;
  const draftProvisioningToken = sanitizeString(draft.provisioningToken || "", 220);
  const tokenMatches = Boolean(effectiveProvisioningToken && draftProvisioningToken && effectiveProvisioningToken === draftProvisioningToken);
  const sameAuthOwner = Boolean(authUid && sanitizeString(draft.uid || "", 160) === authUid);

  if (!tokenMatches && !sameAuthOwner) {
    throw new functions.https.HttpsError("permission-denied", "Ugyldig eller manglende provisioning-token.");
  }

  const actorUserId = authUid || sanitizeString(draft.uid || "", 160) || `checkout_guest_${draftId}`;
  const actorEmail = authEmail || sanitizeString(draft.userEmail || draft.onboardingEmail || "", 160);
  const ownerScopeMetadata = buildOwnerScopeMetadata(OWNER_KIND.REAL_OWNER);

  const existingSnapshotId = sanitizeString(draft.snapshotId, 180);
  const existingLiveProfileId = sanitizeString(draft.liveProfileId, 180);
  if (existingSnapshotId && existingLiveProfileId) {
    console.log(`âš ï¸ Onboarding already provisioned for ${companyId}__${locationId}, but checking risk analysis...`);
    
    // Check if risk analysis exists, if not generate it
    if (hasEgenkontrol) {
      const profile = sanitizeOnboardingProfile(draft.profile || draft.company || {});
      const riskRef = db.collection("companies").doc(companyId).collection("locations").doc(locationId).collection("risk_analysis").doc("current");
      const riskSnap = await riskRef.get();

      if (!riskSnap.exists) {
        console.log('ðŸ” Risk analysis missing, generating now...');
        try {
          const { buildStructuredHaccpData } = require('./provisioning');
          const controlPoints = buildStructuredHaccpData(profile);

          await riskRef.set({
            status: "generated",
            ...ownerScopeMetadata,
            onboardingSnapshot: profile,
            controlPoints: controlPoints,
            totalControlPoints: controlPoints.length,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });

          console.log(`âœ… Risk analysis generated: ${controlPoints.length} control points`);
        } catch (riskError) {
          console.error('âŒ Risk analysis generation failed:', riskError);
        }
      } else {
        console.log('âœ… Risk analysis already exists');
      }
    } else {
      console.log("[FINALIZE] Risk analysis check skipped: Egenkontrol not selected", { selectedModules });
    }
    
    return {
      ok: true,
      alreadyProvisioned: true,
      draftId,
      snapshotId: existingSnapshotId,
      liveProfileId: existingLiveProfileId,
      selectedModules,
      summary: draft.summary || {}
    };
  }

  const userData = authUid
    ? (await getUserAccessProfile({ uid: authUid, email: authEmail }) || {})
    : {};
  const profile = sanitizeOnboardingProfile(draft.profile || draft.company || {});
  const riskModel = sanitizeRiskModelInput(draft.riskModel || {});
  let quickOnboardingSetup = null;
  let quickEquipmentUnits = [];
  let quickRoutineKeys = [];
  if ((draft.quickOnboardingSetup || draft.setup) && hasEgenkontrol) {
    try {
      const {
        normalizeQuickOnboardingSetup,
        resolveCanonicalRoutineKeysFromSetup,
        buildEquipmentFromSetup
      } = require("./js/setupToCanonicalRoutines");
      quickOnboardingSetup = normalizeQuickOnboardingSetup(draft.quickOnboardingSetup || draft.setup || {});
      quickRoutineKeys = resolveCanonicalRoutineKeysFromSetup(quickOnboardingSetup);
      quickEquipmentUnits = buildEquipmentFromSetup(quickOnboardingSetup, {
        companyId,
        locationId,
        userId: actorUserId,
        onboardingDraftId: draftId
      }).map((unit) => ({ ...unit, ...ownerScopeMetadata }));
    } catch (quickSetupErr) {
      console.warn("[finalizeOnboardingCheckoutProvisioning] quick setup normalization failed:", quickSetupErr.message);
    }
  }
  const customerName = deriveCustomerName({
    profile,
    userData,
    email: actorEmail
  });
  const summary = buildOnboardingSummary({
    profile,
    riskModel,
    customerName
  });
  const cloudinaryAssets = extractCloudinaryAssets(
    draft.cloudinaryAssets,
    draft.profile?.cloudinaryAssets,
    draft.profile?.attachments,
    draft.profile?.images
  );

  const liveProfileId = toDocSafeId(`${companyId}__${locationId}__live_profile`);
  const liveProfilePayload = buildLiveUserProfilePayload({
    profile,
    riskModel,
    companyId,
    locationId,
    userId: actorUserId,
    userEmail: actorEmail,
    summary,
    cloudinaryAssets,
    draftId,
    checkoutSessionId: sessionId,
    ownerScopeMetadata
  });
  if (quickOnboardingSetup) {
    liveProfilePayload.quickOnboardingSetup = quickOnboardingSetup;
    liveProfilePayload.onboardingAnswers = liveProfilePayload.onboardingAnswers || {};
    liveProfilePayload.onboardingAnswers.equipmentCounts = quickEquipmentUnits.reduce((acc, unit) => {
      const type = String(unit.type || unit.equipmentType || "").trim();
      if (type) acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  let snapshotId = "";
  let onboardingAnswersId = "";

  if (hasEgenkontrol) {
    const snapshotResult = await createHaccpSnapshotDocument({
      profile,
      riskModel,
      companyId,
      locationId,
      userId: actorUserId,
      ownerScopeMetadata
    });
    snapshotId = snapshotResult.snapshotId;

    // FJERNET: generateAndSaveEgenkontrolProgram (skriver til egenkontrol_programs, lÃ¦ses ikke af startDay)
    // FJERNET: buildStructuredHaccpData / companies/{id}/locations/... (isoleret, lÃ¦ses ingensteds)

    onboardingAnswersId = await upsertOnboardingAnswersDocument({
      companyId,
      locationId,
      userId: actorUserId,
      liveProfilePayload,
      ownerScopeMetadata
    });

    // â”€â”€â”€ PIPELINE: onboarding_answers â†’ risks â†’ task_templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Steg 1: Skriv risks fra onboarding (processer â†’ CCP/GAG regler)
    try {
      const { generateRisksFromOnboardingAnswers } = require("./admin/generateRisksFromOnboardingAnswers");
      const risksResult = await generateRisksFromOnboardingAnswers({ locationId });
      console.log("[provisioning] generateRisksFromOnboardingAnswers:", risksResult);
    } catch (risksErr) {
      console.error("[provisioning] generateRisksFromOnboardingAnswers failed:", risksErr.message);
    }

    // Steg 2: Byg task_templates fra risks (aggregeret per kontrolkategori)
    try {
      const { generateEgenkontrolFromRiskAnalysis } = require("./admin/generateEgenkontrolFromRiskAnalysis");
      const templatesResult = await generateEgenkontrolFromRiskAnalysis({ locationId, db });
      console.log("[provisioning] generateEgenkontrolFromRiskAnalysis:", templatesResult);
    } catch (templatesErr) {
      console.error("[provisioning] generateEgenkontrolFromRiskAnalysis failed:", templatesErr.message);
    }

    // Materialiser Quick Onboarding equipment til konkrete equipment docs
    if (quickEquipmentUnits.length > 0) {
      try {
        for (const unit of quickEquipmentUnits) {
          await db.collection("equipment").doc(unit.id).set(unit, { merge: true });
        }
        const templatesResult = await generateCanonicalTaskTemplates({
          db,
          companyId,
          locationId,
          routineKeys: quickRoutineKeys,
          units: quickEquipmentUnits,
          ownerScopeMetadata
        });
        console.log("[finalizeOnboardingCheckoutProvisioning] quick canonical templates:", templatesResult);
      } catch (quickEqErr) {
        console.error("[finalizeOnboardingCheckoutProvisioning] quick equipment/template sync failed:", quickEqErr.message);
      }
    }

    // Materialiser equipment counts til konkrete equipment docs
    try {
      if (quickEquipmentUnits.length === 0) {
        await syncOnboardingEquipmentUnits({
          db,
          companyId,
          locationId,
          equipmentCounts: liveProfilePayload.onboardingAnswers?.equipmentCounts || {},
          profile,
          ownerScopeMetadata
        });
      }
    } catch (eqErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncOnboardingEquipmentUnits failed:", eqErr.message);
    }

    // Ensure location has temperatureControlSettings for new schedule system
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      await ensureLocationTemperatureSettings(db, companyId, locationId, todayKey);
      console.log("[finalizeOnboardingCheckoutProvisioning] ensureLocationTemperatureSettings completed");
    } catch (tempErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] ensureLocationTemperatureSettings failed:", tempErr.message);
    }

    // Sync equipment-based cleaning task templates
    try {
      await syncEquipmentCleaningTemplates({ db, companyId, locationId, ownerScopeMetadata });
    } catch (cleanErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncEquipmentCleaningTemplates failed:", cleanErr.message);
    }

    // Sync equipment-based maintenance task templates
    try {
      await syncEquipmentMaintenanceTemplates({ db, companyId, locationId, ownerScopeMetadata });
    } catch (maintErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncEquipmentMaintenanceTemplates failed:", maintErr.message);
    }

    // Sync area-based cleaning task templates
    try {
      await syncAreaCleaningTemplates({ db, companyId, locationId, ownerScopeMetadata });
    } catch (areaErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncAreaCleaningTemplates failed:", areaErr.message);
    }

    // Sync process-based drift task templates
    try {
      await syncProcessDriftTemplates({ db, companyId, locationId, ownerScopeMetadata });
    } catch (driftErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncProcessDriftTemplates failed:", driftErr.message);
    }

    // Sync water control task templates
    try {
      await syncWaterControlTemplates({ db, companyId, locationId, ownerScopeMetadata });
    } catch (waterErr) {
      console.error("[finalizeOnboardingCheckoutProvisioning] syncWaterControlTemplates failed:", waterErr.message);
    }
  } else {
    console.log("[FINALIZE] Egenkontrol/HACCP provisioning skipped", { selectedModules });
  }

  const liveProfileUpdate = {
    ...liveProfilePayload,
    selectedModules,
    enabledModules: selectedModules,
    activeModules: selectedModules,
    moduleAccess,
    modules: moduleMap,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (snapshotId) liveProfileUpdate.haccpSnapshotId = snapshotId;
  if (onboardingAnswersId) liveProfileUpdate.onboardingAnswersId = onboardingAnswersId;

  await db.collection("live_user_profiles").doc(liveProfileId).set(liveProfileUpdate, { merge: true });

  // FJERNET: ensureLiveTaskTemplatesForProvisioning â€” genererede scenario_based_haccp templates
  // som startDayForLocation eksplicit filtrerÃ©de vÃ¦k. Erstattet af risks-pipeline ovenfor.

  let finalUserId = authUid;

  // If user is not logged in, create a new Firebase Auth user and Firestore user document
  if (!authUid && profile.accountEmail && profile.accountPassword) {
    const email = sanitizeString(profile.accountEmail, 160).toLowerCase();
    const password = String(profile.accountPassword || "").trim();
    const displayName = sanitizeString(profile.ownerName || profile.companyName || "Ejer", 120);

    console.log(`ðŸ” User creation attempt - Email: ${email}, Password length: ${password.length}, DisplayName: ${displayName}`);

    if (email && password.length >= 8) {
      try {
        // Check if user already exists
        let userRecord = null;
        try {
          userRecord = await admin.auth().getUserByEmail(email);
        } catch (error) {
          if (error?.code === "auth/user-not-found") {
            // Create new Firebase Auth user
            userRecord = await admin.auth().createUser({
              email,
              password,
              displayName,
              emailVerified: false,
              disabled: false
            });

            console.log(`Created new Firebase Auth user: ${userRecord.uid} (${email})`);
          } else {
            throw error;
          }
        }

        if (userRecord) {
          finalUserId = userRecord.uid;

          // Create or update Firestore users document
          await db.collection("users").doc(userRecord.uid).set({
            userId: userRecord.uid,
            displayName,
            email,
            role: "owner",
            companyId,
            organizationId: companyId,
            ...ownerScopeMetadata,
            primaryLocationId: locationId,
            locationId,
            locationIds: [locationId],
            latestLiveProfileId: liveProfileId,
            latestHaccpSnapshotId: snapshotId || "",
            selectedModules,
            enabledModules: selectedModules,
            activeModules: selectedModules,
            moduleAccess,
            modules: moduleMap,
            onboardingStatus: "completed",
            onboardingCompletedAt: FieldValue.serverTimestamp(),
            latestCloudinaryAssets: cloudinaryAssets,
            status: "active",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });

          console.log(`Created Firestore user document for: ${userRecord.uid}`);
        }
      } catch (error) {
        console.error("Failed to create user account during onboarding provisioning:", error);
        // Don't throw - continue with provisioning even if user creation fails
      }
    }
  } else if (authUid) {
    // User is already logged in - update their existing document
    const userRef = db.collection("users").doc(authUid);
    const userSnap = await userRef.get();
    const existingUserData = userSnap.exists ? (userSnap.data() || {}) : {};
    const nextLocationIds = buildPreferredLocationIds(existingUserData, locationId);

    await db.collection("users").doc(authUid).set({
      companyId,
      organizationId: companyId,
      ...ownerScopeMetadata,
      email: actorEmail,
      primaryLocationId: locationId,
      locationId,
      locationIds: nextLocationIds,
      latestLiveProfileId: liveProfileId,
      latestHaccpSnapshotId: snapshotId || "",
      selectedModules,
      enabledModules: selectedModules,
      activeModules: selectedModules,
      moduleAccess,
      modules: moduleMap,
      onboardingStatus: "completed",
      onboardingCompletedAt: FieldValue.serverTimestamp(),
      latestCloudinaryAssets: cloudinaryAssets,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // STEP 5: Update company status to active with subscription info
  const companyRef = db.collection("companies").doc(companyId);
  const locationRef = companyRef.collection("locations").doc(locationId);
  const companyDisplayName = sanitizeString(profile.companyName || "", 160);
  const locationDisplayName =
    sanitizeString(profile.locationName || "", 160) ||
    (String(locationId || "").trim().endsWith("__main") ? "Hovedlokation" : "") ||
    companyDisplayName ||
    locationId;

  await companyRef.set({
    companyId,
    name: companyDisplayName || companyId,
    displayName: companyDisplayName || companyId,
    ...ownerScopeMetadata,
    address: sanitizeString(profile.address || "", 220) || null,
    zip: sanitizeString(profile.zip || "", 40) || null,
    city: sanitizeString(profile.city || "", 120) || null,
    status: "active",
    selectedModules,
    enabledModules: selectedModules,
    activeModules: selectedModules,
    moduleAccess,
    modules: moduleMap,
    subscription: {
      plan: billingPlan,
      selectedModules,
      startedAt: FieldValue.serverTimestamp(),
      stripeSessionId: sessionId
    },
    activatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await locationRef.set({
    companyId,
    organizationId: companyId,
    locationId,
    ...ownerScopeMetadata,
    name: locationDisplayName,
    displayName: locationDisplayName,
    address: sanitizeString(profile.address || "", 220) || null,
    zip: sanitizeString(profile.zip || "", 40) || null,
    city: sanitizeString(profile.city || "", 120) || null,
    status: "active",
    selectedModules,
    enabledModules: selectedModules,
    activeModules: selectedModules,
    moduleAccess,
    modules: moduleMap,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await companyRef.collection("subscriptions").doc("current").set({
    status: "active",
    ...ownerScopeMetadata,
    plan: billingPlan,
    selectedModules,
    activeModules: selectedModules,
    stripeSessionId: sessionId,
    source: "onboarding_checkout",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  const accessBatch = db.batch();
  selectedModules.forEach((moduleKey) => {
    const accessDocId = `${toDocSafeId(moduleKey)}__location_${toDocSafeId(locationId)}__all-users`;
    accessBatch.set(companyRef.collection("module_access").doc(accessDocId), {
      moduleKey,
      status: "active",
      source: "onboarding_checkout",
      assignedToCompanyId: companyId,
      assignedToLocationId: locationId,
      assignedToUserId: "",
      stripeSessionId: sessionId,
      billingPlan,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  await accessBatch.commit();
  
  console.log("[FINALIZE] Company status updated to active with subscription:", billingPlan);

  const draftCompletionUpdate = {
    summary,
    cloudinaryAssets,
    liveProfileId,
    stripeSessionId: sessionId,
    billingPlan,
    selectedModules,
    activeModules: selectedModules,
    moduleAccess,
    status: "completed",
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  if (snapshotId) draftCompletionUpdate.snapshotId = snapshotId;
  if (onboardingAnswersId) draftCompletionUpdate.onboardingAnswersId = onboardingAnswersId;
  await draftRef.set(draftCompletionUpdate, { merge: true });

  const matchingCheckoutSessions = await db
    .collection("checkout_sessions")
    .where("stripeSessionId", "==", sessionId)
    .limit(5)
    .get();

  if (!matchingCheckoutSessions.empty) {
    const batch = db.batch();
    matchingCheckoutSessions.docs.forEach((docSnap) => {
      const checkoutUpdate = {
        status: "completed",
        onboardingProvisioned: true,
        onboardingDraftId: draftId,
        liveProfileId,
        selectedModules,
        activeModules: selectedModules,
        updatedAt: FieldValue.serverTimestamp()
      };
      if (onboardingAnswersId) checkoutUpdate.onboardingAnswersId = onboardingAnswersId;
      if (snapshotId) checkoutUpdate.haccpSnapshotId = snapshotId;
      batch.set(docSnap.ref, checkoutUpdate, { merge: true });
    });
    await batch.commit();
  }

  return {
    ok: true,
    draftId,
    companyId,
    locationId,
    snapshotId,
    liveProfileId,
    onboardingAnswersId,
    selectedModules,
    taskTemplateCount: 0,
    dashboardUrl: hasEgenkontrol ? "/dashboard#haccp-print-section" : "/dashboard.html",
    summary
  };
});

api.regenerateTaskTemplatesForLocation = functions.https.onCall(async (request, context) => {
  try {
    const data = request.data || request;
    const authUid = context.auth?.uid;
    
    if (!authUid) {
      throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
    }

    const companyId = sanitizeString(data?.companyId || "", 120);
    const locationId = sanitizeString(data?.locationId || "", 120);

    if (!companyId || !locationId) {
      throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
    }

    console.log(`[regenerateTaskTemplatesForLocation] START for ${companyId}/${locationId}`);

    // Verify user has access to this location
    const userDoc = await db.collection("users").doc(authUid).get();
    const userData = userDoc.data() || {};
    const userCompanyId = userData.companyId || userData.organizationId;
    
    if (userCompanyId !== companyId) {
      throw new functions.https.HttpsError("permission-denied", "Du har ikke adgang til denne virksomhed.");
    }

    // Fetch onboarding data for this location
    const canonicalDocId = `${companyId}__${locationId}__onboarding`;
    const oaDoc = await db.collection("onboarding_answers").doc(canonicalDocId).get();
    
    if (!oaDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Onboarding data ikke fundet for denne location.");
    }

    const oaData = oaDoc.data() || {};
    const profile = oaData.profile || {};
    const equipmentCounts = oaData.equipmentCounts || {};

    console.log(`[regenerateTaskTemplatesForLocation] Found onboarding data`);

    // Regenerate all template types
    const results = {
      equipment: { created: 0, skipped: 0 },
      cleaning: { created: 0, skipped: 0 },
      maintenance: { created: 0, skipped: 0 },
      area: { created: 0, skipped: 0 },
      drift: { created: 0, skipped: 0 },
      water: { created: 0, skipped: 0 }
    };

    // 1. Equipment units
    try {
      const eqResult = await syncOnboardingEquipmentUnits({ db, companyId, locationId, equipmentCounts, profile });
      results.equipment = { created: eqResult.created || 0, updated: eqResult.updated || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Equipment: created=${eqResult.created}, updated=${eqResult.updated}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Equipment sync failed:`, err.message);
    }

    // 2. Equipment cleaning templates
    try {
      const cleanResult = await syncEquipmentCleaningTemplates({ db, companyId, locationId });
      results.cleaning = { created: cleanResult.created || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Cleaning: created=${cleanResult.created}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Cleaning sync failed:`, err.message);
    }

    // 3. Equipment maintenance templates
    try {
      const maintResult = await syncEquipmentMaintenanceTemplates({ db, companyId, locationId });
      results.maintenance = { created: maintResult.created || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Maintenance: created=${maintResult.created}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Maintenance sync failed:`, err.message);
    }

    // 4. Area cleaning templates
    try {
      const areaResult = await syncAreaCleaningTemplates({ db, companyId, locationId });
      results.area = { created: areaResult.created || 0, skipped: areaResult.skipped || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Area: created=${areaResult.created}, skipped=${areaResult.skipped}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Area sync failed:`, err.message);
    }

    // 5. Process drift templates
    try {
      const driftResult = await syncProcessDriftTemplates({ db, companyId, locationId });
      results.drift = { created: driftResult.created || 0, skipped: driftResult.skipped || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Drift: created=${driftResult.created}, skipped=${driftResult.skipped}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Drift sync failed:`, err.message);
    }

    // 6. Water control templates
    try {
      const waterResult = await syncWaterControlTemplates({ db, companyId, locationId });
      results.water = { created: waterResult.created || 0, skipped: waterResult.skipped || 0 };
      console.log(`[regenerateTaskTemplatesForLocation] Water: created=${waterResult.created}, skipped=${waterResult.skipped}`);
    } catch (err) {
      console.error(`[regenerateTaskTemplatesForLocation] Water sync failed:`, err.message);
    }

    console.log(`[regenerateTaskTemplatesForLocation] DONE`, results);

    return {
      ok: true,
      companyId,
      locationId,
      results
    };

  } catch (error) {
    console.error("[regenerateTaskTemplatesForLocation] ERROR:", error.message);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError("internal", error.message || "Regenerering fejlede");
  }
});

api.addMissingProcessesToOnboarding = functions.https.onCall(async (request, context) => {
  const { companyId, locationId, processesToAdd } = request.data || {};
  
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId and locationId required");
  }
  
  if (!Array.isArray(processesToAdd) || processesToAdd.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "processesToAdd must be a non-empty array");
  }
  
  try {
    const canonicalDocId = `${companyId}__${locationId}__onboarding`;
    const oaRef = db.collection("onboarding_answers").doc(canonicalDocId);
    const oaSnap = await oaRef.get();
    
    let currentProcesses = [];
    if (oaSnap.exists) {
      currentProcesses = oaSnap.data().processes || [];
    }
    
    // Add missing processes
    const updatedProcesses = [...new Set([...currentProcesses, ...processesToAdd])];
    
    await oaRef.set({
      companyId,
      organizationId: companyId,
      locationId,
      processes: updatedProcesses,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log(`[addMissingProcessesToOnboarding] Updated processes for ${companyId}/${locationId}:`, {
      before: currentProcesses,
      after: updatedProcesses,
      added: processesToAdd
    });
    
    // Regenerate process drift templates
    const driftResult = await syncProcessDriftTemplates({ db, companyId, locationId });
    
    console.log(`[addMissingProcessesToOnboarding] Regenerated templates:`, driftResult);
    
    return {
      ok: true,
      processesAdded: processesToAdd,
      currentProcesses: updatedProcesses,
      templatesCreated: driftResult.created,
      templatesSkipped: driftResult.skipped
    };
  } catch (error) {
    console.error("[addMissingProcessesToOnboarding] ERROR:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

  return api;
};
