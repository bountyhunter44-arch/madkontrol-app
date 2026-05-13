
exports.getLexiCustomerStatus = functions.https.onCall(async (request) => {
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

//
// 🔹 FREKVENS LOGIK
//

/**
 * Ny unified schedule evaluator med support for scheduleConfig.
 * Understøtter: daily, every_n_days, weekly_days, monthly, yearly, firstRunImmediately.
 */
function shouldRunToday(scheduleConfig, todayKey, anchorDateKey, lastCompletedDateKey) {
  if (!scheduleConfig) return false;

  const scheduleType = scheduleConfig.scheduleType || "operational";
  const firstRunImmediately = scheduleConfig.firstRunImmediately === true;
  const recurrenceMode = scheduleConfig.documentedIntervalMode || scheduleConfig.recurrenceMode || "daily";
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

/**
 * Resolver der kombinerer template scheduleConfig, location settings og unit overrides
 * til et normaliseret schedule-objekt klar til shouldRunToday().
 */
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

  // Merge: bevar eksisterende brugerdata, tilføj kun manglende felter
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

  // Kun opdater hvis der er ændringer
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

/**
 * Sikrer at temperature-relevante equipment units har temperatureControl med defaults.
 * Opretter eller fylder manglende felter uden at overskrive brugerdata.
 * 
 * @param {Object} db - Firestore database reference
 * @param {string} locationId - location ID
 * @param {Object} unit - equipment unit objekt
 * @returns {Promise<Object>} det normaliserede unit objekt med temperatureControl
 */
async function ensureEquipmentTemperatureControl(db, locationId, unit) {
  if (!unit || !unit.id) {
    console.warn("[ensureEquipmentTemperatureControl] missing unit or unit.id");
    return unit;
  }

  const unitType = sanitizeEquipmentType(unit.type || unit.equipmentType || "");
  
  // Kun relevante typer får temperatureControl
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

  // Merge: bevar eksisterende brugerdata, tilføj kun manglende felter
  const merged = {
    enabled: existing.enabled !== undefined ? existing.enabled : defaults.enabled,
    useGlobalSchedule: existing.useGlobalSchedule !== undefined ? existing.useGlobalSchedule : defaults.useGlobalSchedule,
    useDailyObservation: existing.useDailyObservation !== undefined ? existing.useDailyObservation : defaults.useDailyObservation,
    overrideSchedule: existing.overrideSchedule || defaults.overrideSchedule
  };

  // Kun opdater hvis der er ændringer
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

//
// 🔹 HENT SENESTE FULDFØRTE
//
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

function sanitizeEquipmentType(value) {
  return sanitizeString(value, 80).toLowerCase();
}

/**
 * Beregner status for en temperaturtask ud fra threshold og målt temperatur.
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

function prettyEquipmentTypeName(type) {
  const map = {
    fridge: "Køleskab",
    freezer: "Fryser",
    dishwasher: "Opvaskemaskine",
    warming_cabinet: "Varmeskab",
    blast_chiller: "Blast chiller",
    display_fridge: "Displaykøl"
  };
  const normalized = sanitizeEquipmentType(type);
  return map[normalized] || normalized || "Maskine";
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

function buildStartDayTargets({ template, templateDocId, equipmentByType, allEquipment, areas }) {
  const controlType = (template.controlType || "").toLowerCase();
  const docId = (templateDocId || "").toLowerCase();

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
    // ingen generisk fallback — hvis ingen units, skip template
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

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

// ─── ONBOARDING EQUIPMENT SYNC ───────────────────────────────────────────────

// ─── EQUIPMENT-BASED CLEANING TEMPLATES ──────────────────────────────────────
// Defines which equipment types should generate a per-unit cleaning task.
// controlType "cleaning_check" + explicit equipmentType triggers per-unit expansion.

const EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS = [
  { key: "cleaning_fridge_control",         equipmentType: "fridge",          titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør og desinficér køleskab grundigt. Fjern alle varer. Rengør hylder, skuffer og gummilister. Tør indvendigt tørt. Placer varerne tilbage. Kontrollér at døren lukker tæt." },
  { key: "cleaning_freezer_control",        equipmentType: "freezer",         titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Afrim og rengør fryser. Fjern alle varer og isbelægning. Rengør indvendigt med godkendt middel. Tør af og sæt varerne tilbage. Kontrollér temperatur efterfølgende." },
  { key: "cleaning_fryer_control",          equipmentType: "fryer",           titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Sluk og afkøl frituregryden. Tøm og filtrer olien. Rengør kar, kurve og varmeelementet. Kontrollér oliernes kvalitet (friture-test). Varm op til driftstemperatur igen." },
  { key: "cleaning_dishwasher_control",     equipmentType: "dishwasher",      titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rens opvaskemaskinens filtre, arme og indre vægge. Kontrollér afkalkningsmiddel og skyllemiddel. Kør et tomt program. Kontrollér skylletemperatur (min. 82°C)." },
  { key: "cleaning_ice_machine_control",    equipmentType: "ice_machine",     titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør isterningemaskinen dagligt. Tøm isterningebeholderen og rengør indvendigt med godkendt middel. Skyl grundigt. Kontrollér at ingen snavs eller slim er synlig." },
  { key: "cleaning_softice_control",        equipmentType: "softice_machine", titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rens softice-maskinen dagligt. Skil de dele ad, der kan fjernes. Rengør og desinficér alle overflader der berøres af blandingen. Skyl og sæt sam­men igen." },
  { key: "cleaning_display_fridge_control", equipmentType: "display_fridge",  titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Tøm displaykøl. Rengør hylder og vægge indvendigt. Kontrollér gummilister og låger. Tør af og fyld op med korrekt placerede varer. Kontrollér temperatur." },
  { key: "cleaning_warming_cabinet_control",equipmentType: "warming_cabinet", titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør varmeskab. Fjern mad-rester fra hylder og vægge. Rengør med varmt vand og godkendt rengøringsmiddel. Tør af. Kontrollér varmeelementer og termostat." },
  { key: "cleaning_blast_chiller_control",  equipmentType: "blast_chiller",   titleBase: "Rengøringskontrol", category: "rengøring", controlType: "cleaning_check", frequency: "daily", riskLevel: "medium", guideBody: "Rengør blast chiller efter brug. Fjern alle madrester. Rengør indvendigt med godkendt middel. Kontrollér fordamper for isophobning. Tør og klargør til næste brug." },
];

async function syncEquipmentCleaningTemplates({ db: dbRef, companyId, locationId }) {
  if (!companyId || !locationId) {
    console.warn("[syncEquipmentCleaningTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0, skipped: 0 };
  }

  // Get all active equipment units for this location
  const eqSnap = await dbRef.collection("equipment")
    .where("locationId", "==", locationId)
    .get();

  const activeEquipment = [];
  for (const doc of eqSnap.docs) {
    const d = doc.data() || {};
    if (d.active === false) continue;
    const type = sanitizeEquipmentType(d.type || d.equipmentType || "");
    if (!type) continue;
    activeEquipment.push({
      id: doc.id,
      type,
      name: d.name || d.displayName || d.title || `${type} ${d.unitNumber || 1}`,
      unitNumber: d.unitNumber || 1
    });
  }

  if (activeEquipment.length === 0) {
    console.warn("[syncEquipmentCleaningTemplates] no active equipment found, skipping");
    return { ok: false, created: 0, skipped: 0 };
  }

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;

  // Create one cleaning template per equipment unit
  for (const equipment of activeEquipment) {
    // Find matching definition for this equipment type
    const def = EQUIPMENT_CLEANING_TEMPLATE_DEFINITIONS.find(d => d.equipmentType === equipment.type);
    if (!def) continue;

    // Deterministic ID: locationId__equipmentId__cleaning
    const docId = `${locationId}__${equipment.id}__cleaning`;
    const ref = dbRef.collection("task_templates").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      skipped++;
      continue;
    }

    const title = `${equipment.name} - ${def.titleBase}`;

    await ref.set({
      templateId:    docId,
      id:            `${def.key}__${equipment.id}`,
      companyId,
      organizationId: companyId,
      locationId,
      equipmentId:   equipment.id,
      equipmentName: equipment.name,
      equipmentType: equipment.type,
      title,
      description:   def.guideBody || "",
      category:      def.category,
      controlType:   def.controlType,
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
    console.log(`[syncEquipmentCleaningTemplates] created ${docId} for ${equipment.name}`);
  }

  console.log(`[syncEquipmentCleaningTemplates] done — created=${created}, skipped=${skipped}, equipment=${activeEquipment.length}`);
  return { ok: true, created, skipped };
}
// ─── EQUIPMENT-BASED MAINTENANCE TEMPLATES ───────────────────────────────────
// Defines which equipment types should generate a per-unit maintenance task.
// controlType "maintenance_check" + explicit equipmentType triggers per-unit expansion.

const EQUIPMENT_MAINTENANCE_TEMPLATE_DEFINITIONS = [
  { key: "maintenance_fridge_control",        equipmentType: "fridge",          titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér køleskab for mekaniske fejl. Tjek termostat, kompressor og ventilator. Kontrollér gummilister og dørlukning. Afrim om nødvendigt. Rens kondensatorbakke." },
  { key: "maintenance_freezer_control",       equipmentType: "freezer",         titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér fryser for mekaniske fejl. Tjek termostat, kompressor og lås. Kontrollér gummilister. Afrim og rengør kondensatorbakke." },
  { key: "maintenance_walk_in_cooler_control",equipmentType: "walk_in_cooler",  titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér walk-in køler. Tjek kompressor, fordamper, lys og dørlukning. Kontrollér pakninger og låsemekanisme. Kontrollér gulvafløb." },
  { key: "maintenance_walk_in_freezer_control",equipmentType: "walk_in_freezer",titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér walk-in fryser. Tjek kompressor, fordamper, lys og dørlukning. Afgørende: ingen isophobning på fordamper. Kontrollér pakninger og låsemekanisme." },
  { key: "maintenance_fryer_control",         equipmentType: "fryer",           titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér frituregryde. Tjek termostat og sikkerhedsafbryder. Kontrollér varmeelement og drænsystem. Kontrollér oliestanden og oliernes kvalitet." },
  { key: "maintenance_dishwasher_control",    equipmentType: "dishwasher",      titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér opvaskemaskine. Tjek skylletemperatur (min. 82°C), vandtryk og doseringssystem. Rens filtre og sprøjtearme. Kontrollér tætninger og låger." },
  { key: "maintenance_ice_machine_control",   equipmentType: "ice_machine",     titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér isterningemaskine. Tjek vandfilter og afkølingssystem. Kontrollér at ingen slim eller alger er synlige. Efterse vandindløb og afløb." },
  { key: "maintenance_blast_chiller_control", equipmentType: "blast_chiller",   titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér blast chiller. Tjek kompressor, fordamper og temperaturprobe. Kontrollér dørlukning og pakninger. Kontrollér at fordamper er fri for isophobning." },
  { key: "maintenance_warming_cabinet_control",equipmentType: "warming_cabinet",titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér varmeskab. Tjek termostat og varmeelement. Kontrollér temperaturjustering og dørlukning. Eftersyn af pakninger og vandskuffe (ved dampvarmeskabe)." },
  { key: "maintenance_display_fridge_control",equipmentType: "display_fridge",  titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér displaykøl. Tjek kompressor, belysning og dørlukning. Kontrollér gummilister og hyldeplaceringer. Rens kondensatorgitter og kontrollér afløb." },
  { key: "maintenance_softice_control",       equipmentType: "softice_machine", titleBase: "Vedligeholdelse", category: "vedligeholdelse", controlType: "maintenance_check", frequency: "yearly", riskLevel: "medium", guideBody: "Kontrollér softice-maskine. Tjek blandeenhed, pumper og seals. Kontrollér temperatur og viskositet. Kontrollér at sikkerhedstermostat fungerer korrekt." },
];

async function syncEquipmentMaintenanceTemplates({ db: dbRef, companyId, locationId }) {
  if (!companyId || !locationId) {
    console.warn("[syncEquipmentMaintenanceTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0, skipped: 0 };
  }

  // Get all active equipment units for this location
  const eqSnap = await dbRef.collection("equipment")
    .where("locationId", "==", locationId)
    .get();

  const activeEquipment = [];
  for (const doc of eqSnap.docs) {
    const d = doc.data() || {};
    if (d.active === false) continue;
    const type = sanitizeEquipmentType(d.type || d.equipmentType || "");
    if (!type) continue;
    activeEquipment.push({
      id: doc.id,
      type,
      name: d.name || d.displayName || d.title || `${type} ${d.unitNumber || 1}`,
      unitNumber: d.unitNumber || 1
    });
  }

  if (activeEquipment.length === 0) {
    console.warn("[syncEquipmentMaintenanceTemplates] no active equipment found, skipping");
    return { ok: false, created: 0, skipped: 0 };
  }

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;

  // Create one maintenance template per equipment unit
  for (const equipment of activeEquipment) {
    // Find matching definition for this equipment type
    const def = EQUIPMENT_MAINTENANCE_TEMPLATE_DEFINITIONS.find(d => d.equipmentType === equipment.type);
    if (!def) continue;

    // Deterministic ID: locationId__equipmentId__maintenance
    const docId = `${locationId}__${equipment.id}__maintenance`;
    const ref = dbRef.collection("task_templates").doc(docId);
    const snap = await ref.get();

    if (snap.exists) {
      skipped++;
      continue;
    }

    const title = `${equipment.name} - ${def.titleBase}`;
    const freqConfig = parseFrequencyConfig({ frequency: def.frequency }, "frequency");

    await ref.set({
      templateId:     docId,
      id:             `${def.key}__${equipment.id}`,
      companyId,
      organizationId: companyId,
      locationId,
      equipmentId:    equipment.id,
      equipmentName:  equipment.name,
      equipmentType:  equipment.type,
      title,
      description:    def.guideBody || "",
      category:       def.category,
      controlType:    def.controlType,
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
    console.log(`[syncEquipmentMaintenanceTemplates] created ${docId} for ${equipment.name}`);
  }

  console.log(`[syncEquipmentMaintenanceTemplates] done — created=${created}, skipped=${skipped}, equipment=${activeEquipment.length}`);
  return { ok: true, created, skipped };
}

// ─── AREA-BASEREDE RENGØRINGSRUTINER ─────────────────────────────────────────
// Én template per rengøringsområde afledt af onboarding_answers.areas[].
// templateSource = "area_cleaning_library"  templateType = "operational"

const AREA_CLEANING_DEFINITIONS = [
  { areaKey: "kitchen",              title: "Rengøring af køkken",                  frequency: "daily",   riskLevel: "high",   guideBody: "Rengør og desinficér alle køkkenoverflader: bordplader, gulv, vaskestationer og udstyr. Tjek at der er rene karklude. Tip affald ud. Dokumentér udførelse." },
  { areaKey: "production_kitchen",   title: "Rengøring af produktionskøkken",       frequency: "daily",   riskLevel: "high",   guideBody: "Rengør produktionsoverflader og -udstyr. Tip affaldsposer og skift. Rengør gulv, vask og dræn. Kontrollér at ingen fødevareaffald er tilbage." },
  { areaKey: "serving_area",         title: "Rengøring af serveringsområde",        frequency: "daily",   riskLevel: "medium", guideBody: "Rengør borde, stole, buffet og serveringsstationer. Rengør gulv og sørg for at alle overflader gæster har kontakt med er rene." },
  { areaKey: "dry_storage",          title: "Rengøring af tørlager",                frequency: "weekly",  riskLevel: "low",    guideBody: "Rengør hylder og gulv. Kontrollér at alle varer er hævet fra gulvet og korrekt opbevaret. Kontrollér holdbarhedsdatoer. Tjek for skadedyr." },
  { areaKey: "toilet",               title: "Rengøring af toilet og håndvask",      frequency: "daily",   riskLevel: "high",   guideBody: "Rengør og desinficér toilet, håndvask og gulv. Fyld sæbe og papirhåndklæder op. Kontrollér at der er håndsprit tilgængeligt for personale." },
  { areaKey: "dishwashing_area",     title: "Rengøring af opvaskområde",            frequency: "daily",   riskLevel: "medium", guideBody: "Rengør opvaskemaskine, bakkestativ og gulvafløb. Tip madrester ud. Kontrollér rengøringsmidler og skyllemidler. Tjek at alle overflader er rene." },
  { areaKey: "washing_room",         title: "Rengøring af vaskerum",                frequency: "daily",   riskLevel: "medium", guideBody: "Rengør vaskerum og dræn. Kontrollér at lagervarer er ryddeligt placeret og hævet fra gulvet." },
  { areaKey: "vegetable_room",       title: "Rengøring af grøntrum",                frequency: "daily",   riskLevel: "medium", guideBody: "Rengør hylder og gulv. Fjern blade og affald. Tjek at temperatur er korrekt (typisk 10–12°C). Kontrollér at ingen råd/mug på varer." },
  { areaKey: "walk_in_cooler_room",  title: "Rengøring af kølerum",                 frequency: "daily",   riskLevel: "high",   guideBody: "Rengør gulv og hylder. Tjek at alle varer er korrekt dækket og mærket. Kontrollér at gulvafløbet ikke er tilstoppet. Rengør dørpakninger." },
  { areaKey: "walk_in_freezer_room", title: "Rengøring af fryserum",                frequency: "weekly",  riskLevel: "medium", guideBody: "Rengør gulv og hylder. Tjek at alle varer er korrekt dækket og mærket. Afrim om nødvendigt. Kontrollér at dør lukker tæt og pakninger er intakte." },
];

async function syncAreaCleaningTemplates({ db: dbRef, companyId, locationId }) {
  if (!companyId || !locationId) {
    console.warn("[syncAreaCleaningTemplates] missing companyId or locationId, skipping");
    return { ok: false, created: 0 };
  }

  // Hent areas fra onboarding_answers — læs canonical doc direkte for at undgå at ramme forkert doc