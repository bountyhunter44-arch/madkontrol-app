// Load environment variables from .env file (for local development)
require("dotenv").config();

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");
const { defineJsonSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const egenkontrol = require("./egenkontrol");
// âœ… KUN Ã‰N INITIALISERING
if (!admin.apps.length) {
  admin.initializeApp();
}

// IMPORTS EFTER INIT
const { generateComprehensiveHaccp, generateTaskTemplatesFromKcps } = require("./generateComprehensiveHaccp");
const { generateScenarioBasedHaccp } = require("./scenarioBasedHaccp");
const { guardDangerousOperation } = require("./security/environmentGuard");
const demoMode = require("./admin/demoMode");
const softArchive = require("./admin/softArchive");
const {
  closeDailyRun,
  startCoolingProcess,
  addCoolingMeasurement,
  completeCoolingProcess,
  startReheatingProcess,
  completeReheatingProcess,
  disposeCoolingProcess,
  startNewCoolingFromReheating,
  loadActiveProcessInstances,
  pauseEgenkontrolRoutine,
  reactivateEgenkontrolRoutine,
  setRoutinePauseState,
  updateEgenkontrolRoutineFrequency
} = require("./modules/egenkontrol");
const { generateAndSaveEgenkontrolProgram } = require("./egenkontrol/egenkontrolGenerator");
const provisioning = require("./provisioning");
Object.assign(exports, require("./modules/pos"));
const Stripe = require("stripe");
const { OWNER_KIND, buildOwnerScopeMetadata } = require("./lib/ownerScope");
const { normalizeRoutineType } = require("./js/canonicalRoutines");

// === AI RULES ===
// Read functions/egenkontrol/operationalTemplateReference.js first
// Use it as source of truth
// Only generate operational templates
// Never use schema.titleKey or descriptionKey
// No GAG / CCP / compliance logic
// Always use guideKey
// =================

const db = admin.firestore();
const { getUserLocationIds, getUserAccessProfile, assertLexiCustomerAccess, assertStartDayAccess, assertAdminAccess, assertSeoGeneratorAccess } = require("./lib/access")({ db });
db.settings({ ignoreUndefinedProperties: true });
const { FieldValue } = admin.firestore;
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const FUNCTIONS_CONFIG = defineJsonSecret("FUNCTIONS_CONFIG_EXPORT");

// === provisioning — flyttet til ./modules/provisioning ===
Object.assign(exports, require("./modules/provisioning")({ ADDON_CATALOG, AREA_CLEANING_DEFINITIONS, CHECKOUT_ALLOWED_MODULES, CHECKOUT_FALLBACK_ORIGIN, CHECKOUT_MODULE_ALIASES, EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS, EQUIPMENT_COUNT_MAPPING, EQUIPMENT_MAINTENANCE_TEMPLATE_DEFINITIONS, FUNCTIONS_CONFIG, FieldValue, INSTANCE_COMPARABLE_FIELDS, PROCESS_DRIFT_TEMPLATE_DEFINITIONS, WATER_CONTROL_TEMPLATE_DEFINITIONS, assertAdminAccess, assertLexiCustomerAccess, assertSeoGeneratorAccess, assertStartDayAccess, db, getUserAccessProfile, getUserLocationIds, sanitizeOnboardingProfile, sanitizeRiskModelInput }));



// â”€â”€â”€ STRIPE WEBHOOK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const { onRequest } = require("firebase-functions/v2/https");
const { sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt, toDocSafeId, toAsciiSlug, toLegacyId, getDateKey, addDays, daysBetween, normalizeDateKey, removeUndefinedFields, getWeekdayFromDateKey, sanitizeRelativePath, parsePageCount } = require("./lib/util");

// === payment-webhook — flyttet til ./modules/payment-webhook ===
Object.assign(exports, require("./modules/payment-webhook")({ FieldValue, db }));


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






//
// ðŸ”¹ SIMPLE API (temporarily commented out due to 1st Gen to 2nd Gen upgrade conflict)
//
// exports.api = functions.https.onRequest((req, res) => {
//   if (req.path === "/hello") {
//     return res.json({ message: "Hello from Firebase API!" });
//   }

//   if (req.path === "/lexivoice/customer-context") {
//     if (req.method !== "GET") {
//       return res.status(405).json({
//         ok: false,
//         error: "method-not-allowed",
//         message: "Brug GET til dette endpoint."
//       });
//     }

//     const requiredApiKey = String(process.env.LEXIVOICE_API_KEY || "").trim();
//     if (requiredApiKey) {
//       const providedApiKey = String(req.get("x-api-key") || "").trim();
//       if (!providedApiKey || providedApiKey !== requiredApiKey) {
//         return res.status(401).json({
//           ok: false,
//           error: "unauthorized",
//           message: "Ugyldig API noegle."
//         });
//       }
//     }

//     const companyId = sanitizeString(req.query.companyId || "", 120);
//     const locationId = sanitizeString(req.query.locationId || "", 120);

//     if (!companyId || !locationId) {
//       return res.status(400).json({
//         ok: false,
//         error: "invalid-argument",
//         message: "companyId og locationId er paakraevet."
//       });
//     }

//     return getLexiCustomerStatusPayload({ companyId, locationId })
//       .then((statusPayload) => {
//         return res.json({
//           ok: true,
//           ...statusPayload
//         });
//       })
//       .catch((error) => {
//         console.error("Fejl i /lexivoice/customer-context:", error);
//         return res.status(500).json({
//           ok: false,
//           error: "internal",
//           message: "Kunne ikke hente kundestatus."
//         });
//       });
//   }

//   return res.json({ status: "API is running" });
// });

//
// ðŸ”¹ HJÃ†LPEFUNKTIONER
//
// === egenkontrol-ops — flyttet til ./modules/egenkontrol-ops ===
Object.assign(exports, require("./modules/egenkontrol-ops")({ FieldValue, assertAdminAccess, assertStartDayAccess, db }));




function sanitizeOnboardingProfile(profile = {}) {
  return {
    companyName: sanitizeString(profile.companyName || profile.name, 140),
    cvr: sanitizeString(profile.cvr, 30),
    address: sanitizeString(profile.address, 180),
    city: sanitizeString(profile.city, 80),
    zip: sanitizeString(profile.zip, 20),
    companyType: sanitizeString(profile.companyType || profile.businessType, 80),
    ownerName: sanitizeString(profile.ownerName || profile.contactName || profile.leader, 120),
    phone: sanitizeString(profile.phone || profile.phoneNumber, 40),
    accountEmail: sanitizeString(profile.accountEmail, 160),
    accountPassword: sanitizeString(profile.accountPassword, 200),
    registrationDate: sanitizeString(profile.registrationDate, 40),
    cleaningNotes: sanitizeString(profile.cleaningNotes, 2000),
    supplierInput: sanitizeString(profile.supplierInput, 2000),
    // Step 1: Modtagelse
    receivesChilledGoods: sanitizeBoolean(profile.receivesChilledGoods),
    receivesChilledGoodsDetails: sanitizeString(profile.receivesChilledGoodsDetails, 2000),
    receivesFrozenGoods: sanitizeBoolean(profile.receivesFrozenGoods),
    receivesFrozenGoodsDetails: sanitizeString(profile.receivesFrozenGoodsDetails, 2000),
    receivesFrozenGoodsCritical: sanitizeBoolean(profile.receivesFrozenGoodsCritical),
    receivesRoomTempGoods: sanitizeBoolean(profile.receivesRoomTempGoods),
    receivesRoomTempGoodsDetails: sanitizeString(profile.receivesRoomTempGoodsDetails, 2000),
    // Step 2: Opbevaring
    storesChilledGoods: sanitizeBoolean(profile.storesChilledGoods),
    storesChilledGoodsDetails: sanitizeString(profile.storesChilledGoodsDetails, 2000),
    storesChilledGoodsCritical: sanitizeBoolean(profile.storesChilledGoodsCritical),
    storesFrozenGoods: sanitizeBoolean(profile.storesFrozenGoods),
    storesFrozenGoodsDetails: sanitizeString(profile.storesFrozenGoodsDetails, 2000),
    storesFrozenGoodsCritical: sanitizeBoolean(profile.storesFrozenGoodsCritical),
    storesRoomTempGoods: sanitizeBoolean(profile.storesRoomTempGoods),
    storesRoomTempGoodsDetails: sanitizeString(profile.storesRoomTempGoodsDetails, 2000),
    // Step 3: Tilberedning
    preparesHotFood: sanitizeBoolean(profile.preparesHotFood),
    preparesHotFoodDetails: sanitizeString(profile.preparesHotFoodDetails, 2000),
    preparesHotFoodCritical: sanitizeBoolean(profile.preparesHotFoodCritical),
    preparesColdFood: sanitizeBoolean(profile.preparesColdFood),
    preparesColdFoodDetails: sanitizeString(profile.preparesColdFoodDetails, 2000),
    preparesColdFoodCritical: sanitizeBoolean(profile.preparesColdFoodCritical),
    // Step 4: Varmholdelse/NedkÃ¸ling
    holdsHotFood: sanitizeBoolean(profile.holdsHotFood),
    holdsHotFoodDetails: sanitizeString(profile.holdsHotFoodDetails, 2000),
    holdsHotFoodCritical: sanitizeBoolean(profile.holdsHotFoodCritical),
    coolsHotFood: sanitizeBoolean(profile.coolsHotFood),
    coolsHotFoodDetails: sanitizeString(profile.coolsHotFoodDetails, 2000),
    coolsHotFoodCritical: sanitizeBoolean(profile.coolsHotFoodCritical),
    // Step 5: HÃ¥ndtering/Allergener
    handlesDifferentFoods: sanitizeBoolean(profile.handlesDifferentFoods),
    handlesDifferentFoodsDetails: sanitizeString(profile.handlesDifferentFoodsDetails, 2000),
    handlesAllergens: sanitizeBoolean(profile.handlesAllergens),
    handlesAllergensDetails: sanitizeString(profile.handlesAllergensDetails, 2000),
    handlesAllergensCritical: sanitizeBoolean(profile.handlesAllergensCritical),
    // Step 6: Salg og servering
    sellsPackagedChilled: sanitizeBoolean(profile.sellsPackagedChilled),
    sellsPackagedFrozen: sanitizeBoolean(profile.sellsPackagedFrozen),
    sellsPackagedRoomTemp: sanitizeBoolean(profile.sellsPackagedRoomTemp),
    sellsUnpackagedChilled: sanitizeBoolean(profile.sellsUnpackagedChilled),
    sellsUnpackagedRoomTemp: sanitizeBoolean(profile.sellsUnpackagedRoomTemp),
    sellsFoodWithAllergens: sanitizeBoolean(profile.sellsFoodWithAllergens),
    sellsFoodWithAllergensDetails: sanitizeString(profile.sellsFoodWithAllergensDetails, 2000),
    packagesOwnFood: sanitizeBoolean(profile.packagesOwnFood),
    packagesOwnFoodDetails: sanitizeString(profile.packagesOwnFoodDetails, 2000),
    // Step 7: Transport
    transportsChilledGoods: sanitizeBoolean(profile.transportsChilledGoods),
    transportsFrozenGoods: sanitizeBoolean(profile.transportsFrozenGoods),
    transportsRoomTempGoods: sanitizeBoolean(profile.transportsRoomTempGoods),
    transportsHotTakeaway: sanitizeBoolean(profile.transportsHotTakeaway),
    transportsHotTakeawayDetails: sanitizeString(profile.transportsHotTakeawayDetails, 2000),
    // Legacy fields
    servesHotFood: sanitizeBoolean(profile.servesHotFood),
    servesColdFood: sanitizeBoolean(profile.servesColdFood),
    sellsRawFish: sanitizeBoolean(profile.sellsRawFish),
    makesDesserts: sanitizeBoolean(profile.makesDesserts),
    packsTakeaway: sanitizeBoolean(profile.packsTakeaway),
    hasHotHolding: sanitizeBoolean(profile.hasHotHolding),
    hasDryStorage: sanitizeBoolean(profile.hasDryStorage),
    hasProductionKitchen: sanitizeBoolean(profile.hasProductionKitchen),
    hasServingArea: sanitizeBoolean(profile.hasServingArea),
    hasToilet: sanitizeBoolean(profile.hasToilet),
    hasDishwashing: sanitizeBoolean(profile.hasDishwashing),
    hasWarmKitchen: sanitizeBoolean(profile.hasWarmKitchen),
    hasColdKitchen: sanitizeBoolean(profile.hasColdKitchen),
    hasHandwash: sanitizeBoolean(profile.hasHandwash),
    hasWashingRoom: sanitizeBoolean(profile.hasWashingRoom),
    hasVegetableRoom: sanitizeBoolean(profile.hasVegetableRoom),
    hasWalkInFreezer: sanitizeBoolean(profile.hasWalkInFreezer),
    hasWalkInCooler: sanitizeBoolean(profile.hasWalkInCooler),
    hasSofticeachine: sanitizeBoolean(profile.hasSofticeachine),
    hasOvens: sanitizeBoolean(profile.hasOvens),
    fridgeCount: toPositiveInt(profile.fridgeCount),
    freezerCount: toPositiveInt(profile.freezerCount),
    suppliers: sanitizeStringList(profile.suppliers, 80, 140),
    // Activity fields from onboarding (Danish names)
    tilberederVarmMad: sanitizeBoolean(profile.tilberederVarmMad),
    modtagerKoelevarer: sanitizeBoolean(profile.modtagerKoelevarer),
    modtagerFrostvarer: sanitizeBoolean(profile.modtagerFrostvarer),
    varmholder: sanitizeBoolean(profile.varmholder),
    nedkoelerMad: sanitizeBoolean(profile.nedkoelerMad),
    servererKoldMad: sanitizeBoolean(profile.servererKoldMad),
    antalKoeleskabe: toPositiveInt(profile.antalKoeleskabe),
    antalFrysere: toPositiveInt(profile.antalFrysere),
    walkInCoolerCount: toPositiveInt(profile.walkInCoolerCount),
    walkInFreezerCount: toPositiveInt(profile.walkInFreezerCount),
    antalIsterningemaskiner: toPositiveInt(profile.antalIsterningemaskiner),
    antalIsbokse: toPositiveInt(profile.antalIsbokse),
    antalFrityreGryder: toPositiveInt(profile.antalFrityreGryder),
    hasIceMachine: sanitizeBoolean(profile.hasIceMachine || profile.hasIsterningemaskine),
    hasIsboks: sanitizeBoolean(profile.hasIsboks),
    hasFrituregryde: sanitizeBoolean(profile.hasFrituregryde),
    madkoncept: sanitizeString(profile.madkoncept, 500),
    produkter: sanitizeString(profile.produkter, 1000)
  };
}

function sanitizeRiskModelInput(riskModel = {}) {
  return {
    hazards: toArray(riskModel.hazards).slice(0, 100).map((hazard) => ({
      name: sanitizeString(hazard?.name, 180),
      riskLevel: sanitizeString(hazard?.riskLevel, 40),
      control: sanitizeString(hazard?.control, 220),
      frequency: sanitizeString(hazard?.frequency, 80)
    })),
    controls: sanitizeStringList(riskModel.controls, 100, 180),
    tasks: sanitizeStringList(riskModel.tasks, 200, 180),
    suppliers: sanitizeStringList(riskModel.suppliers, 100, 140),
    companyType: sanitizeString(riskModel.companyType, 80),
    organizationName: sanitizeString(riskModel.organizationName, 140),
    generatedAt: sanitizeString(riskModel.generatedAt, 80)
  };
}
















// === demo — flyttet til ./modules/demo ===
Object.assign(exports, require("./modules/demo")({ FieldValue, assertAdminAccess, db, getUserLocationIds }));






// === company-admin — flyttet til ./modules/company-admin ===
Object.assign(exports, require("./modules/company-admin")({ FieldValue, assertAdminAccess, assertStartDayAccess, db }));






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













// â”€â”€â”€ ADMIN: RE-PROVISION EQUIPMENT FOR EXISTING LOCATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Kald dette for lokationer som ikke gik igennem det nye checkout-flow.
// Populerer `equipment` collection, rydder op i cleaning/maintenance templates.

// â”€â”€â”€ ADMIN: GENERER RISKS FRA ONBOARDING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ ADMIN: GENERER EGENKONTROL-TEMPLATES FRA RISKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€



//
// ðŸ”¹ FREKVENS LOGIK
//

/**
 * Ny unified schedule evaluator med support for scheduleConfig.
 * UnderstÃ¸tter: daily, every_n_days, weekly_days, monthly, yearly, firstRunImmediately.
 */



/**
 * Resolver der kombinerer template scheduleConfig, location settings og unit overrides
 * til et normaliseret schedule-objekt klar til shouldRunToday().
 */

/**
 * Sikrer at en location har temperatureControlSettings med defaults.
 * Opretter eller fylder manglende felter uden at overskrive brugerdata.
 * 
 * @param {Object} db - Firestore database reference
 * @param {string} companyId - company ID
 * @param {string} locationId - location ID
 * @param {string} todayKey - dagens dateKey (YYYY-MM-DD) til anchorDate default
 * @returns {Promise<Object>} det endelige temperatureControlSettings objekt
 */

/**
 * Sikrer at temperature-relevante equipment units har temperatureControl med defaults.
 * Opretter eller fylder manglende felter uden at overskrive brugerdata.
 * 
 * @param {Object} db - Firestore database reference
 * @param {string} locationId - location ID
 * @param {Object} unit - equipment unit objekt
 * @returns {Promise<Object>} det normaliserede unit objekt med temperatureControl
 */

//
// ðŸ”¹ HENT SENESTE FULDFÃ˜RTE
//


/**
 * Beregner status for en temperaturtask ud fra threshold og mÃ¥lt temperatur.
 * @param {{ measuredTemperature?: number, thresholds?: { mode: string, value: number } }} opts
 * @returns {"ok" | "deviation" | "unknown"}
 */
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









// â”€â”€â”€ ONBOARDING EQUIPMENT SYNC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ EQUIPMENT-BASED CLEANING TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Defines which equipment types should generate a per-unit cleaning task.
// controlType "cleaning_check" + explicit equipmentType triggers per-unit expansion.

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

// â”€â”€â”€ EQUIPMENT-BASED MAINTENANCE TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Defines which equipment types should generate a per-unit maintenance task.
// controlType "maintenance_check" + explicit equipmentType triggers per-unit expansion.

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


// â”€â”€â”€ AREA-BASEREDE RENGÃ˜RINGSRUTINER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ã‰n template per rengÃ¸ringsomrÃ¥de afledt af onboarding_answers.areas[].
// templateSource = "area_cleaning_library"  templateType = "operational"

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


// â”€â”€â”€ PROCES-BASEREDE DRIFTSOPGAVER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ã‰n template per driftsopgave afledt af onboarding_answers.processes[].
// Visse opgaver genereres altid (datokontrol, adskillelse, luk dag).
// 3-timers regel genereres kun ved buffet/servering uden permanent kÃ¸l/varme.
// templateSource = "process_drift_library"

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


// â”€â”€â”€ VANDKONTROL RUTINER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ã‰n template per vandroutine. drikkevand og filter er altid aktive.
// isterningemaskine genereres kun hvis ice_machine-udstyr er registreret.
// controlType "water_control" â†’ specifik UI-formular i rutiner.html

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




// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


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


// â”€â”€â”€ START-DAY IDEMPOTENCY HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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





// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Helper: Unified rule for daily routine template filtering

// Updated: 2026-04-09 - New schedule-based task generation










// â”€â”€â”€ BILLING PLANS REGISTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ CANONICAL COMPANY ID (STABLE SLUG-BASED) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VIGTIGT: companyId mÃ¥ IKKE bruge Date.now() (ikke stabil ved re-runs)
// VIGTIGT: companyId mÃ¥ IKKE kun bruge slug (collision mellem virksomheder med samme navn)
// LÃ˜SNING: slug + CVR (hvis findes) eller slug + hash (fallback for uniqueness)


// â”€â”€â”€ COMPANY KEY (DEDUPLICATION) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// â”€â”€â”€ CREATE OR GET COMPANY (TRANSACTION) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// â”€â”€â”€ ONBOARDING CHECKOUT SESSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CHECKOUT_ALLOWED_MODULES = new Set(["pos", "lagerkontrol", "bogforing", "egenkontrol", "menu", "seo", "kalkulation", "koerselskontrol"]);
const CHECKOUT_MODULE_ALIASES = {
  accounting: "bogforing",
  bogfoering: "bogforing",
  "bogføring": "bogforing"
};





// === seo — flyttet til ./modules/seo ===
Object.assign(exports, require("./modules/seo")({ FieldValue, OPENAI_API_KEY, assertSeoGeneratorAccess, db }));





// â”€â”€ SEO SITE RENDERER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HTTP function â€” serves *.madkontrollen.dk subdomains as real HTML pages
// Map *.madkontrollen.dk â†’ this function via Google Cloud Run custom domains


// â”€â”€â”€ PROVISION RISK ANALYSIS SNAPSHOT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Auto-generates HACCP snapshot from central risk library
// Idempotent: Won't overwrite manual edits

// â”€â”€â”€ CREATE QUICK ONBOARDING ACCOUNT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Creates Auth user AND all Firestore documents in one atomic operation

// â”€â”€â”€ COMPLETE QUICK ONBOARDING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Complete quick onboarding with setup-based equipment and routines

// â”€â”€â”€ PROVISION QUICK ONBOARDING ACCOUNT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DEPRECATED: Use createQuickOnboardingAccount instead
// Creates all Firestore documents for quick onboarding after Auth user is created


// === media — flyttet til ./modules/media ===
Object.assign(exports, require("./modules/media")({ FUNCTIONS_CONFIG, FieldValue, OPENAI_API_KEY, assertStartDayAccess, db }));













exports.startCoolingProcess = startCoolingProcess;
exports.createEgenkontrolProgramForLocation =
  egenkontrol.createEgenkontrolProgramForLocation({
    db,
    sanitizeString,
    getUserAccessProfile,
    assertSeoGeneratorAccess,
    sanitizeOnboardingProfile,
    sanitizeRiskModelInput
  });
  
exports.addCoolingMeasurement = addCoolingMeasurement;
exports.completeCoolingProcess = completeCoolingProcess;
exports.startReheatingProcess = startReheatingProcess;
exports.completeReheatingProcess = completeReheatingProcess;
exports.disposeCoolingProcess = disposeCoolingProcess;
exports.startNewCoolingFromReheating = startNewCoolingFromReheating;
exports.loadActiveProcessInstances = loadActiveProcessInstances;
exports.pauseEgenkontrolRoutine = pauseEgenkontrolRoutine;
exports.reactivateEgenkontrolRoutine = reactivateEgenkontrolRoutine;
exports.setRoutinePauseState = setRoutinePauseState;
exports.updateEgenkontrolRoutineFrequency = updateEgenkontrolRoutineFrequency;

// Demo Mode - DEVELOPER ONLY (not for production customers)


// Soft Archive - Safe alternative to hard delete


exports.closeDailyRun = closeDailyRun;


// === crm — flyttet til ./modules/crm ===
Object.assign(exports, require("./modules/crm")({ FieldValue, db }));


// Manual risk analysis generator for existing onboardings

// â”€â”€â”€ REGENERATE TASK TEMPLATES FOR LOCATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ WATER MODULE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Object.assign(exports, require("./water-module"));

// â”€â”€â”€ AUDIT TOOLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const { auditCompanyLocationIntegrity } = require("./auditCompanyLocation");
exports.auditCompanyLocationIntegrity = auditCompanyLocationIntegrity;

// â”€â”€â”€ ONBOARDING FIX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const { fixOnboardingStructure } = require("./fixOnboardingStructure");
exports.fixOnboardingStructure = fixOnboardingStructure;

// â”€â”€â”€ CANONICAL TASK ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const {
  generateCanonicalTaskTemplates,
  ensureSingleTaskInstance,
  startDayForLocationCanonical
} = require("./canonicalTaskEngine");


// â”€â”€â”€ CREATE DEMO ENVIRONMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ ADD MISSING PROCESSES TO ONBOARDING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ CVR ENRICHMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€





