  const canonicalDocId = `${companyId}__${locationId}__onboarding`;
  const oaDoc = await dbRef.collection("onboarding_answers").doc(canonicalDocId).get();
  const oaData = oaDoc.exists ? oaDoc.data() : {};
  const areas = toArray(oaData.areas);

  // Fallback: alle lokationer har et køkken
  const activeAreas = new Set(areas.length > 0 ? areas : ["kitchen"]);

  const nowTs = FieldValue.serverTimestamp();
  let created = 0, skipped = 0;

  for (const def of AREA_CLEANING_DEFINITIONS) {
    if (!activeAreas.has(def.areaKey)) continue;

    const docId = `${companyId}_${locationId}_area_cleaning_${def.areaKey}`;
    const ref   = dbRef.collection("task_templates").doc(docId);
    const snap  = await ref.get();
    if (snap.exists) { skipped++; continue; }

    await ref.set({
      templateId:     docId,
      companyId,
      organizationId: companyId,
      locationId,
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

  console.log(`[syncAreaCleaningTemplates] done — created=${created} skipped=${skipped} areas=${[...activeAreas].join(",")}`);
  return { ok: true, created, skipped };
}

// ─── PROCES-BASEREDE DRIFTSOPGAVER ───────────────────────────────────────────
// Én template per driftsopgave afledt af onboarding_answers.processes[].
// Visse opgaver genereres altid (datokontrol, adskillelse, luk dag).
// 3-timers regel genereres kun ved buffet/servering uden permanent køl/varme.
// templateSource = "process_drift_library"

const PROCESS_DRIFT_TEMPLATE_DEFINITIONS = [
  {
    key:         "process_drift_datokontrol",
    title:       "Datokontrol",
    description: "Kontrollér holdbarhedsdatoer på alle opbevarede fødevarer. Fjern udgåede varer og følg FIFO-princippet (først ind, først ud).",
    frequency:   "daily",
    category:    "drift",
    controlType: "date_control",
    guideKey:    "date_check",
    alwaysInclude: true,
  },
  {
    key:         "process_drift_adskillelse",
    title:       "Adskillelse",
    description: "Kontrollér korrekt adskillelse af rå og tilberedte fødevarer i køl, på arbejdsborde og med redskaber.",
    frequency:   "daily",
    category:    "drift",
    controlType: "separation_control",
    guideKey:    "separation_control",
    alwaysInclude: true,
  },
  {
    key:         "process_drift_tre_timers_regel",
    title:       "3-timers regel",
    description: "Kontrollér at fødevarer uden aktiv køl eller varme ikke har stået i farezonen (8–65°C) i mere end 3 timer.",
    frequency:   "daily",
    category:    "drift",
    controlType: "three_hour_rule",
    guideKey:    "three_hour_rule",
    alwaysInclude: false,
    requiresProcessAny: ["serve_cold_food", "hot_hold_food"],
  },
];

async function syncProcessDriftTemplates({ db: dbRef, companyId, locationId }) {
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
      if (existing.title !== def.title || existing.description !== def.description) {
        await ref.update({ title: def.title, description: def.description, updatedAt: nowTs });
      }
      skipped++;
      continue;
    }

    await ref.set({
      templateId:     docId,
      companyId,
      organizationId: companyId,
      locationId,
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

  console.log(`[syncProcessDriftTemplates] done — created=${created} skipped=${skipped}`);
  return { ok: true, created, skipped };
}

// ─── VANDKONTROL RUTINER ─────────────────────────────────────────────────────
// FJERNET: syncWaterControlTemplates funktion og WATER_CONTROL_TEMPLATE_DEFINITIONS
// Vandkontrol er nu deaktiveret i provisioning flow

const EQUIPMENT_COUNT_MAPPING = [
  { countKeys: ["fridge", "fridgeCount", "antalKoeleskabe"],                equipmentType: "fridge",          titleBase: "Køleskab",          controlTypes: ["temperature_check"] },
  { countKeys: ["freezer", "freezerCount", "antalFrysere"],                 equipmentType: "freezer",         titleBase: "Fryser",            controlTypes: ["temperature_check"] },
  { countKeys: ["walk_in_cooler", "walkInCooler", "walkInCoolerCount"],     equipmentType: "walk_in_cooler",   titleBase: "Walk-in køler",     controlTypes: ["temperature_check"] },
  { countKeys: ["walk_in_freezer", "walkInFreezer", "walkInFreezerCount"],  equipmentType: "walk_in_freezer",  titleBase: "Walk-in fryser",    controlTypes: ["temperature_check"] },
  { countKeys: ["ice_machine", "iceMachine", "antalIsterningemaskiner"],    equipmentType: "ice_machine",      titleBase: "Isterningemaskine", controlTypes: [] },
  { countKeys: ["ice_box", "isboks", "antalIsbokse"],                       equipmentType: "ice_box",          titleBase: "Isboks",            controlTypes: ["temperature_check"] },
  { countKeys: ["fryer", "antalFrityreGryder"],                             equipmentType: "fryer",            titleBase: "Frituregryden",     controlTypes: [] },
  { countKeys: ["dishwasher", "antalOpvaskemaskiner"],                      equipmentType: "dishwasher",       titleBase: "Opvaskemaskine",    controlTypes: [] },
  { countKeys: ["blast_chiller", "blastChiller", "antalBlastChillere"],     equipmentType: "blast_chiller",    titleBase: "Blast chiller",     controlTypes: ["temperature_check"] },
  { countKeys: ["warming_cabinet", "warmingCabinet", "antalVarmeskabe"],    equipmentType: "warming_cabinet",  titleBase: "Varmeskab",         controlTypes: ["temperature_check"] },
  { countKeys: ["display_fridge", "displayFridge", "antalDisplaykoele"],   equipmentType: "display_fridge",   titleBase: "Displaykøl",        controlTypes: ["temperature_check"] },
  { countKeys: ["softice_machine", "softiceMachine"],                       equipmentType: "softice_machine",  titleBase: "Softice maskine",   controlTypes: ["temperature_check"] },
];

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

async function syncOnboardingEquipmentUnits({ db: dbRef, companyId, locationId, equipmentCounts = {}, profile = {} }) {
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
  for (const doc of existingSnap.docs) {
    existingById.set(doc.id, { ref: doc.ref, data: doc.data() || {} });
  }

  const batch = dbRef.batch();
  let created = 0, updated = 0, deactivated = 0, kept = 0;
  const equipmentIds = [];
  const nowTs = FieldValue.serverTimestamp();

  for (const mapping of EQUIPMENT_COUNT_MAPPING) {
    const count = normalizedCounts[mapping.equipmentType] || 0;
    const { equipmentType, titleBase, controlTypes } = mapping;

    // Find highest existing unit number for this type
    let maxExisting = 0;
    for (const [id] of existingById) {
      const prefix = `onboarding_${equipmentType}_`;
      if (id.startsWith(prefix)) {
        const n = parseInt(id.slice(prefix.length), 10);
        if (!isNaN(n) && n > maxExisting) maxExisting = n;
      }
    }

    // Upsert active units 1..count
    for (let i = 1; i <= count; i++) {
      const docId = `onboarding_${equipmentType}_${i}`;
      const title = `${titleBase} ${i}`;
      const existing = existingById.get(docId);
      const ref = existing?.ref || dbRef.collection("equipment").doc(docId);

      if (existing) {
        batch.set(ref, {
          companyId, organizationId: companyId, locationId,
          source: "onboarding", equipmentType, type: equipmentType,
          controlTypes, controlType: controlTypes[0] || "",
          title, name: title, displayName: title,
          unitNumber: i, active: true,
          updatedAt: nowTs
        }, { merge: true });
        if (existing.data.active === false) { updated++; } else { kept++; }
      } else {
        batch.set(ref, {
          companyId, organizationId: companyId, locationId,
          source: "onboarding", equipmentType, type: equipmentType,
          controlTypes, controlType: controlTypes[0] || "",
          title, name: title, displayName: title,
          unitNumber: i, active: true,
          createdAt: nowTs, updatedAt: nowTs
        });
        created++;
        console.log(`[syncOnboardingEquipmentUnits] created ${docId}`);
      }
      equipmentIds.push(docId);
    }

    // Deactivate units above current count
    for (let i = count + 1; i <= maxExisting; i++) {
      const docId = `onboarding_${equipmentType}_${i}`;
      const existing = existingById.get(docId);
      if (existing && existing.data.active !== false) {
        batch.set(existing.ref, { active: false, updatedAt: nowTs }, { merge: true });
        deactivated++;
        console.log(`[syncOnboardingEquipmentUnits] deactivated ${docId}`);
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
  
  const summary = { ok: true, created, updated, deactivated, kept, equipmentIds, tempControlUpdated };
  console.log("[syncOnboardingEquipmentUnits] summary", summary);
  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────

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
      toPositiveInt(counts.køleskab) ||
      toPositiveInt(counts.køleskabe),
    freezers:
      toPositiveInt(counts.freezer) ||
      toPositiveInt(counts.freezers) ||
      toPositiveInt(counts.fryser) ||
      toPositiveInt(counts.frysere)
  };
}

function createTaskTemplate(templateId, schema, schemaKey, unit, companyId, locationId, userId, userEmail, nowIso, formType, frequency, frequencyDays, customTitle = null, cleaningArea = null) {
  // TRACE LOGGING - PROBLEM A - v2
  console.log(`[createTaskTemplate] INPUT: schemaKey=${schemaKey}, schema.titleKey=${schema.titleKey}, schema.descriptionKey=${schema.descriptionKey}, customTitle=${customTitle}`);
  
  // Danish title and description mappings
  const schemaTitles = {
    'varemodtagelse': 'Varemodtagelse af køle- og frostvarer',
    'koel_frost': 'Temperaturkontrol af køle- og frostudstyr',
    'opvarmning': 'Opvarmning og genopvarmning',
    'varmholdelse': 'Varmholdelse af tilberedte retter',
    'nedkoeling': 'Nedkøling af varmbehandlede fødevarer',
    'rengoering': 'Rengøring og hygiejne',
    'adskillelse': 'Adskillelse og krydskontaminering',
    'opvaskemaskine': 'Opvaskemaskine - kontrol og rengøring'
  };
  
  const schemaDescriptions = {
    'varemodtagelse': 'Kontroller temperatur, emballage og kvalitet ved modtagelse af køle- og frostvarer. Registrer temperatur og eventuelle afvigelser.',
    'koel_frost': 'Daglig temperaturkontrol af køleskabe og frysere. Temperaturen skal være max 5°C for køl og max -18°C for frost.',
    'opvarmning': 'Kontroller at kernetemperaturen når minimum 75°C i mindst 2 minutter ved opvarmning og genopvarmning af fødevarer.',
    'varmholdelse': 'Varmholdte retter skal holdes ved minimum 65°C. Kontroller temperaturen regelmæssigt.',
    'nedkoeling': 'Nedkøl varmbehandlede fødevarer fra 65°C til 10°C på maksimalt 90 minutter. Registrer start- og sluttidspunkt samt temperaturer.',
    'rengoering': 'Daglig rengøring og hygiejnekontrol af arbejdsflader, udstyr og lokaler. Følg rengøringsplanen.',
    'adskillelse': 'Kontroller adskillelse mellem råvarer og færdige produkter. Brug separate redskaber og skærebrætter.',
    'opvaskemaskine': 'Kontroller opvaskemaskinens temperatur og rengøring. Skylletemperatur skal være minimum 82°C.'
  };
  
  const title = customTitle || schemaTitles[schemaKey] || schemaKey;
  
  let description = schemaDescriptions[schemaKey] || '';
  
  if (schemaKey === 'koel_frost' && unit) {
    if (unit.type === 'fridge') {
      description = 'Kontroller og registrer temperaturen for dette køleskab. Temperaturen må højst være 5°C.';
    } else if (unit.type === 'freezer') {
      description = 'Kontroller og registrer temperaturen for denne fryser. Temperaturen skal være -18°C eller koldere.';
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

async function ensureEgenkontrolTaskTemplates({
  db,
  companyId,
  locationId,
  units = []
}) {
  const templatesRef = db.collection("task_templates");

  async function createTemplateIfNotExists(template) {
    const docRef = templatesRef.doc(template.templateId);
    const snap = await docRef.get();
    if (snap.exists) return;
    await docRef.set(template);
  }

  const baseMeta = {
    companyId,
    locationId,
    type: "operational",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // TEMPERATUR PER UNIT
  for (const unit of units) {
    let guideKey = null;
    let cleanGuideKey = null;
    const label = unit.name || "Enhed";

    if (unit.type === "fridge")           { guideKey = "fridge_temperature";          cleanGuideKey = "cleaning_control"; }
    if (unit.type === "freezer")          { guideKey = "freezer_temperature";         cleanGuideKey = "cleaning_control"; }
    if (unit.type === "walk_in_cooler")   { guideKey = "walkin_cooler_temperature";   cleanGuideKey = "cleaning_control"; }
    if (unit.type === "walk_in_freezer")  { guideKey = "walk_in_freezer_temperature"; cleanGuideKey = "cleaning_control"; }
    if (unit.type === "ice_machine")      { guideKey = "ice_machine_cleaning";        cleanGuideKey = "ice_machine_cleaning"; }
    if (unit.type === "isboks")           { guideKey = "freezer_temperature";         cleanGuideKey = "cleaning_control"; }
    if (unit.type === "friture")          { guideKey = "friture_control";             cleanGuideKey = "friture_control"; }

    // Temperaturrutine (kun for køle/fryse-enheder og friture)
    if (guideKey && unit.type !== "ice_machine") {
      await createTemplateIfNotExists({
        templateId: `${companyId}__${locationId}__temp__${unit.id}`,
        ...baseMeta,
        templateKey: "temperature_control",
        title: `Temperaturkontrol – ${label}`,
        description: "Kontroller og registrer temperatur",
        guideKey,
        frequency: "daily",
        equipmentUnit: unit.id,
        scheduleConfig: {
          scheduleType: "operational",
          recurrenceMode: "every_n_days",
          recurrenceValue: 7,
          firstRunImmediately: false,
          useDailyObservation: true
        }
      });
    }

    // Rengøringsrutine per enhed
    if (cleanGuideKey) {
      await createTemplateIfNotExists({
        templateId: `${companyId}__${locationId}__clean__${unit.id}`,
        ...baseMeta,
        templateKey: "cleaning_control",
        title: `Rengøring – ${label}`,
        description: `Rengør og desinficer ${label.toLowerCase()} grundigt`,
        guideKey: cleanGuideKey,
        frequency: unit.type === "fridge" || unit.type === "freezer" || unit.type === "isboks" ? "weekly" : "daily",
        equipmentUnit: unit.id
      });
    }
  }

  return { ok: true };
}

// ─── START-DAY IDEMPOTENCY HELPERS ───────────────────────────────────────────

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

function stableNormalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && !Array.isArray(value) && value.constructor?.name === "Timestamp") {
    // Firestore Timestamp — convert to ms for stable comparison
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

function buildComparableInstancePayload(data) {
  const out = {};
  for (const field of INSTANCE_COMPARABLE_FIELDS) {
    out[field] = stableNormalize(data[field] !== undefined ? data[field] : null);
  }
  return out;
}

function materiallyEqualInstance(existingDocData, nextData) {
  const a = buildComparableInstancePayload(existingDocData || {});
  const b = buildComparableInstancePayload(nextData || {});
  return JSON.stringify(a) === JSON.stringify(b);
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

// ─────────────────────────────────────────────────────────────────────────────

// Updated: 2026-04-09 - New schedule-based task generation

exports.startDayForLocation = functions.https.onCall(async (request) => {
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

  if (runSnap.exists && !forceRefresh) {
    return {
      alreadyStarted: true,
      message: "Dagen er allerede startet"
    };
  }

  const operatingMode = await getOperatingModeForLocation({
    companyId,
    locationId,
    todayKey
  });

  if (operatingMode === "closed") {
    return {
      ok: false,
      blocked: true,
      message: "Lokationen er lukket. Automatiske rutiner er sat på pause for i dag."
    };
  }

  if (operatingMode === "vacation") {
    return {
      ok: false,
      blocked: true,
      message: "Lokationen er i ferie-mode. Automatiske rutiner er sat på pause for i dag."
    };
  }

  // 🔹 hent templates (kun operational - ikke verification)
  // Templates skal allerede eksistere (genereret via checkout eller adminReprovisionEquipment)
  const allTemplateDocs = await loadActiveTaskTemplates({ companyId, locationId });
  
  const hasUnitSpecificKoelFrost = allTemplateDocs.some(doc => {
    const id = doc.id || "";
    return id.includes("egenkontrol_koel_frost__") && (id.includes("fridge_") || id.includes("freezer_") || id.includes("ice_machine_"));
  });
  
  const templateDocs = allTemplateDocs.filter(doc => {
    const template = doc.data();
    const templateType = template.templateType || "operational";
    const id = doc.id || "";
    
    // 🚫 Fjern gamle auto templates
    if (id.includes("auto_task")) return false;
    
    // 🚫 Fjern gamle KCP templates (ikke aggregerede)
    if (id.includes("kcp_") && !template.isAggregated) return false;
    
    // 🚫 Ekstra sikkerhed: fjern hvis title indikerer gammel struktur
    const title = (template.title || "").toLowerCase();
    if (title.includes("kcp") && !template.isAggregated) return false;
    
    // 🚫 Fjern generisk koel_frost template hvis der findes unit-specifikke templates
    if (hasUnitSpecificKoelFrost && id.match(/egenkontrol_koel_frost$/) && !id.includes("__fridge_") && !id.includes("__freezer_") && !id.includes("__ice_machine_")) {
      console.log(`[egenkontrol] Skipping legacy generic koel_frost template: ${id}`);
      return false;
    }
    
    // 🚫 NYTILFØJET: Fjern gamle scenario_based_haccp templates med lange beskrivelser
    // Disse templates har templateSource: "scenario_based_haccp" og lange description-felter
    // Nye operationelle templates har templateKey i stedet
    if (template.templateSource === "scenario_based_haccp") {
      console.log(`[egenkontrol] Skipping scenario_based_haccp template: ${id}`);
      return false;
    }
    
    // 🚫 NYTILFØJET: Fjern templates med haccpVersion (legacy marker)
    if (template.haccpVersion) {
      console.log(`[egenkontrol] Skipping template with haccpVersion: ${id}`);
      return false;
    }
    
    // 🚫 NYTILFØJET: Fjern templates med sourceType: "hazard" (genereret fra risikoanalyse)
    if (template.sourceType === "hazard") {
      console.log(`[egenkontrol] Skipping hazard-based template: ${id}`);
      return false;
    }
    
    return templateType === "operational";
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
  if (!equipmentByType.fridge)   equipmentByType.fridge   = allEquipment.filter((x) => x.type.includes("fridge") || x.type.includes("koleskab") || x.type.includes("køleskab"));
  if (!equipmentByType.freezer)  equipmentByType.freezer  = allEquipment.filter((x) => x.type.includes("freezer") || x.type.includes("fryser"));

  // Fallback: brug onboarding counts hvis equipment docs ikke er oprettet endnu.
  if (equipmentByType.fridge.length === 0 || equipmentByType.freezer.length === 0) {
    try {
      const counts = await getOnboardingEquipmentCounts({ companyId, locationId });

      const syntheticEquipment = buildSyntheticEquipmentFromCounts(counts.rawCounts || {});
      for (const equipment of syntheticEquipment) {
        const alreadyExists = allEquipment.some((item) => item.id === equipment.id);
        if (alreadyExists) continue;
        allEquipment.push(equipment);