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
const { sanitizeOnboardingProfile, sanitizeRiskModelInput } = require("./lib/onboarding-sanitize");
Object.assign(exports, require("./modules/provisioning")({ FUNCTIONS_CONFIG, FieldValue, assertAdminAccess, assertLexiCustomerAccess, assertSeoGeneratorAccess, assertStartDayAccess, db, getUserAccessProfile, getUserLocationIds, sanitizeOnboardingProfile, sanitizeRiskModelInput }));



// â”€â”€â”€ STRIPE WEBHOOK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const { onRequest } = require("firebase-functions/v2/https");
const { sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt, toDocSafeId, toAsciiSlug, toLegacyId, getDateKey, addDays, daysBetween, normalizeDateKey, removeUndefinedFields, getWeekdayFromDateKey, sanitizeRelativePath, parsePageCount } = require("./lib/util");

// === payment-webhook — flyttet til ./modules/payment-webhook ===
Object.assign(exports, require("./modules/payment-webhook")({ FieldValue, db }));


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




// === demo — flyttet til ./modules/demo ===
Object.assign(exports, require("./modules/demo")({ FieldValue, assertAdminAccess, db, getUserLocationIds }));






// === company-admin — flyttet til ./modules/company-admin ===
Object.assign(exports, require("./modules/company-admin")({ FieldValue, assertAdminAccess, assertStartDayAccess, db }));






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
// â”€â”€â”€ ONBOARDING EQUIPMENT SYNC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ EQUIPMENT-BASED CLEANING TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Defines which equipment types should generate a per-unit cleaning task.
// controlType "cleaning_check" + explicit equipmentType triggers per-unit expansion.

// â”€â”€â”€ EQUIPMENT-BASED MAINTENANCE TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Defines which equipment types should generate a per-unit maintenance task.
// controlType "maintenance_check" + explicit equipmentType triggers per-unit expansion.

// â”€â”€â”€ AREA-BASEREDE RENGÃ˜RINGSRUTINER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ã‰n template per rengÃ¸ringsomrÃ¥de afledt af onboarding_answers.areas[].
// templateSource = "area_cleaning_library"  templateType = "operational"

// â”€â”€â”€ PROCES-BASEREDE DRIFTSOPGAVER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ã‰n template per driftsopgave afledt af onboarding_answers.processes[].
// Visse opgaver genereres altid (datokontrol, adskillelse, luk dag).
// 3-timers regel genereres kun ved buffet/servering uden permanent kÃ¸l/varme.
// templateSource = "process_drift_library"

// â”€â”€â”€ VANDKONTROL RUTINER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Ã‰n template per vandroutine. drikkevand og filter er altid aktive.
// isterningemaskine genereres kun hvis ice_machine-udstyr er registreret.
// controlType "water_control" â†’ specifik UI-formular i rutiner.html

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// â”€â”€â”€ START-DAY IDEMPOTENCY HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Helper: Unified rule for daily routine template filtering

// Updated: 2026-04-09 - New schedule-based task generation










// â”€â”€â”€ BILLING PLANS REGISTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ CANONICAL COMPANY ID (STABLE SLUG-BASED) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VIGTIGT: companyId mÃ¥ IKKE bruge Date.now() (ikke stabil ved re-runs)
// VIGTIGT: companyId mÃ¥ IKKE kun bruge slug (collision mellem virksomheder med samme navn)
// LÃ˜SNING: slug + CVR (hvis findes) eller slug + hash (fallback for uniqueness)


// â”€â”€â”€ COMPANY KEY (DEDUPLICATION) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// â”€â”€â”€ CREATE OR GET COMPANY (TRANSACTION) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// â”€â”€â”€ ONBOARDING CHECKOUT SESSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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





