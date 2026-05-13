/**
 * inspectStartDay.cjs
 *
 * Replays startDayForLocation-logikken for én company/location
 * med Admin SDK (bypasser callable auth).
 *
 * DRY_RUN = true   → vis hvad der ville ske, skriv ingenting
 * DRY_RUN = false  → opret task_instances + daily_run præcis som funktionen ville
 *
 * Output pr. instance:
 *   doc.id | title | controlType | templateId | dateKey | equipmentId
 */

"use strict";

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─── KONFIGURATION ───────────────────────────────────────────────────────────
const DRY_RUN    = false;
const COMPANY_ID  = "onboarding_aroi-d";
const LOCATION_ID = "onboarding_aroi-d__main";
// ─────────────────────────────────────────────────────────────────────────────

function getTodayKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Copenhagen",
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
  }).format(new Date());
}

function toLegacyId(id) {
  return (id || "").replace(/__/g, "_").replace(/-/g, "_");
}

function sanitize(value, max = 120) {
  if (value == null) return "";
  return String(value).trim().slice(0, max);
}

// Replika af loadActiveTaskTemplates fra functions/index.js
async function loadActiveTaskTemplates(companyId, locationId) {
  const refsByPath = new Map();
  const variants = [
    { companyField: "companyId",    companyValue: companyId, locationValue: locationId },
    { companyField: "organizationId", companyValue: companyId, locationValue: locationId },
    { companyField: "companyId",    companyValue: companyId, locationValue: toLegacyId(locationId) },
    { companyField: "organizationId", companyValue: companyId, locationValue: toLegacyId(locationId) },
  ].filter((v) => v.companyValue && v.locationValue);

  for (const v of variants) {
    const snap = await db
      .collection("task_templates")
      .where(v.companyField, "==", v.companyValue)
      .where("locationId",   "==", v.locationValue)
      .get();
    for (const doc of snap.docs) {
      refsByPath.set(doc.ref.path, doc);
    }
  }

  return Array.from(refsByPath.values()).filter((doc) => {
    const d = doc.data() || {};
    if (d.isActive === false) return false;
    if (d.active   === false) return false;
    return true;
  });
}

// Replika af filteret i startDayForLocation
function applyStartDayFilter(allDocs) {
  const hasUnitSpecificKoelFrost = allDocs.some((doc) => {
    const id = doc.id || "";
    return id.includes("egenkontrol_koel_frost__") &&
      (id.includes("fridge_") || id.includes("freezer_") || id.includes("ice_machine_"));
  });

  return allDocs.filter((doc) => {
    const t  = doc.data();
    const id = doc.id || "";

    if (id.includes("auto_task")) return false;
    if (id.includes("kcp_") && !t.isAggregated) return false;
    const title = (t.title || "").toLowerCase();
    if (title.includes("kcp") && !t.isAggregated) return false;
    if (hasUnitSpecificKoelFrost &&
        id.match(/egenkontrol_koel_frost$/) &&
        !id.includes("__fridge_") &&
        !id.includes("__freezer_") &&
        !id.includes("__ice_machine_")) return false;
    if (t.templateSource === "scenario_based_haccp") return false;
    if (t.haccpVersion) return false;
    if (t.sourceType === "hazard") return false;

    const templateType = t.templateType || "operational";
    return templateType === "operational";
  });
}

// buildTargets — replika af buildStartDayTargets i functions/index.js
function buildTargets({ template, templateDocId, equipmentByType }) {
  const controlType = (template.controlType || "").toLowerCase();
  const docId = (templateDocId || "").toLowerCase();

  if (controlType === "temperature_check") {
    const templateEqType = (template.equipmentType || "").toLowerCase();
    let lookupKey = templateEqType;
    if (!lookupKey) {
      if (docId.includes("walk_in_cooler"))       lookupKey = "walk_in_cooler";
      else if (docId.includes("walk_in_freezer")) lookupKey = "walk_in_freezer";
      else if (docId.includes("display"))         lookupKey = "display_fridge";
      else if (docId.includes("softice"))         lookupKey = "softice_machine";
      else if (docId.includes("fridge"))          lookupKey = "fridge";
      else if (docId.includes("freezer"))         lookupKey = "freezer";
    }
    const units = lookupKey ? (equipmentByType[lookupKey] || []) : [];
    if (units.length === 0) return [];
    return units.map((u) => ({
      suffix:        u.id,
      equipmentId:   u.id,
      equipmentType: u.type,
      equipmentName: u.displayName || u.name || u.id
    }));
  }

  // Generic per-unit expansion: any template with explicit equipmentType (e.g. cleaning_check)
  const explicitEqType = (template.equipmentType || "").toLowerCase().trim();
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

  return [{ suffix: "default", equipmentId: "", equipmentType: "", equipmentName: "" }];
}

async function loadEquipment(companyId, locationId) {
  const eqSnap = await db.collection("equipment").where("locationId", "==", locationId).get();
  const byType = {};
  const all = [];
  for (const doc of eqSnap.docs) {
    const d = doc.data() || {};
    if (d.active === false) continue;
    const type = (d.type || d.equipmentType || "").toLowerCase();
    const item = { id: doc.id, type, name: d.name || d.displayName || doc.id, displayName: d.displayName || d.name || doc.id };
    if (!byType[type]) byType[type] = [];
    byType[type].push(item);
    all.push(item);
  }

  // Legacy compat keys
  if (!byType.fridge)  byType.fridge  = all.filter((x) => x.type.includes("fridge") || x.type.includes("koleskab") || x.type.includes("køleskab"));
  if (!byType.freezer) byType.freezer = all.filter((x) => x.type.includes("freezer") || x.type.includes("fryser"));

  // Fallback: onboarding_answers equipmentCounts
  if (byType.fridge.length === 0 || byType.freezer.length === 0) {
    const oaSnap = await db.collection("onboarding_answers").where("locationId", "==", locationId).limit(1).get();
    const oaData = oaSnap.empty ? {} : (oaSnap.docs[0].data() || {});
    const counts = oaData.equipmentCounts || {};
    const labelMap = { fridge: "Køleskab", freezer: "Fryser", dishwasher: "Opvaskemaskine", warming_cabinet: "Varmeskab", walk_in_cooler: "Walk-in køler", walk_in_freezer: "Walk-in fryser" };
    for (const [rawType, rawCount] of Object.entries(counts)) {
      const type = rawType.toLowerCase();
      const count = Math.max(0, Math.floor(Number(rawCount) || 0));
      if (count <= 0) continue;
      const label = labelMap[type] || type;
      for (let i = 1; i <= count; i++) {
        const name = `${label} ${i}`;
        const item = { id: `onboarding_${type}_${i}`, type, name, displayName: name };
        if (!all.some((x) => x.id === item.id)) {
          all.push(item);
          if (!byType[type]) byType[type] = [];
          byType[type].push(item);
        }
      }
    }
    if (!byType.fridge)  byType.fridge  = all.filter((x) => x.type.includes("fridge") || x.type.includes("koleskab") || x.type.includes("køleskab"));
    if (!byType.freezer) byType.freezer = all.filter((x) => x.type.includes("freezer") || x.type.includes("fryser"));
  }

  return { all, byType };
}

// ─── IDEMPOTENCY HELPERS (replika af functions/index.js) ─────────────────────

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
  if (typeof value === "object" && value !== null && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (Array.isArray(value)) {
    return value.map(stableNormalize).sort((a, b) => {
      const sa = JSON.stringify(a) || ""; const sb = JSON.stringify(b) || "";
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

function buildComparablePayload(data) {
  const out = {};
  for (const field of INSTANCE_COMPARABLE_FIELDS) {
    out[field] = stableNormalize(data[field] !== undefined ? data[field] : null);
  }
  return out;
}

function materiallyEqual(existingDocData, nextData) {
  return JSON.stringify(buildComparablePayload(existingDocData || {})) ===
         JSON.stringify(buildComparablePayload(nextData || {}));
}

function diffFields(existingComp, nextComp) {
  return INSTANCE_COMPARABLE_FIELDS.filter(
    (f) => JSON.stringify(existingComp[f]) !== JSON.stringify(nextComp[f])
  );
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const todayKey = getTodayKey();
  console.log(`[inspectStartDay] DRY_RUN=${DRY_RUN}  company=${COMPANY_ID}  location=${LOCATION_ID}  date=${todayKey}\n`);

  // ── 0. Hent equipment ─────────────────────────────────────────────────────
  const equipment = await loadEquipment(COMPANY_ID, LOCATION_ID);
  console.log(`[inspectStartDay] equipment: fridge=${equipment.byType.fridge.length}  freezer=${equipment.byType.freezer.length}  total=${equipment.all.length}`);

  // ── 1. Hent task_templates ────────────────────────────────────────────────
  const allDocs = await loadActiveTaskTemplates(COMPANY_ID, LOCATION_ID);
  console.log(`[inspectStartDay] task_templates loaded: ${allDocs.length} (aktive)`);

  // ── 2. Anvend startDayForLocation-filter ──────────────────────────────────
  const filtered = applyStartDayFilter(allDocs);
  console.log(`[inspectStartDay] task_templates efter filter: ${filtered.length}`);

  if (filtered.length !== allDocs.length) {
    const removed = allDocs.filter((d) => !filtered.includes(d));
    console.log(`[inspectStartDay] FILTRERET VÆK (${removed.length}):`);
    for (const doc of removed) {
      const t = doc.data();
      console.log(`  SKIP: ${doc.id}  templateSource=${t.templateSource || "–"}  haccpVersion=${t.haccpVersion || "–"}  sourceType=${t.sourceType || "–"}`);
    }
  }

  console.log("");

  // ── 3. Hent eksisterende instanser (dublet-check) ─────────────────────────
  const existingSnap = await db
    .collection("task_instances")
    .where("locationId", "==", LOCATION_ID)
    .where("dateKey",    "==", todayKey)
    .get();

  const existingKeys = new Map();
  for (const doc of existingSnap.docs) {
    const d = doc.data() || {};
    const companyOk = !d.companyId || d.companyId === COMPANY_ID || d.organizationId === COMPANY_ID;
    if (!companyOk) continue;
    // Key is doc.id — matches deployed function's templateDocId__[eq__]dateKey scheme
    existingKeys.set(doc.id, { ref: doc.ref, data: d });
  }

  console.log(`[inspectStartDay] eksisterende instanser i dag: ${existingKeys.size}\n`);

  // ── 4. Byg preview af hvad der ville blive oprettet ───────────────────────
  const toCreate  = [];
  const toUpdate  = [];
  const toSkip    = [];

  for (const doc of filtered) {
    const t          = doc.data();
    const baseTaskId = sanitize(t.taskId || t.id || doc.id);
    const targets    = buildTargets({ template: t, templateDocId: doc.id, equipmentByType: equipment.byType });

    for (const target of targets) {
      const baseTitle  = sanitize(t.title, 220) || "Rutine";
      const scopedTitle = target.equipmentName
        ? `${baseTitle} - ${target.equipmentName}`
        : baseTitle;
      const scopedTaskId = (target.suffix && target.suffix !== "default")
        ? `${baseTaskId}__${target.suffix}`
        : baseTaskId;

      const equipmentId = target.equipmentId || t.equipmentId || "";
      // ID formula matches deployed startDayForLocation exactly
      const instanceId  = equipmentId
        ? `${doc.id}__${equipmentId}__${todayKey}`
        : `${doc.id}__${todayKey}`;
      const uniqueKey   = instanceId;
      const existing    = existingKeys.get(uniqueKey) || null;
      const rawFreq = t.frequency || t.frequencyType || "daily";
      const freq = (typeof rawFreq === "string" ? rawFreq : rawFreq?.type || "daily").toLowerCase();
      if (freq === "event_based") {
        toSkip.push({ id: uniqueKey, reason: "event_based", templateId: doc.id });
        continue;
      }

      // Build next payload for materiality comparison
      const nextPayload = {
        companyId: COMPANY_ID, locationId: LOCATION_ID, dateKey: todayKey,
        templateId: doc.id, taskId: doc.id,
        equipmentId: target.equipmentId || t.equipmentId || "",
        equipmentType: target.equipmentType || t.equipmentType || "",
        equipmentName: target.equipmentName || t.equipmentName || "",
        title: scopedTitle, description: t.description || "",
        controlType: t.controlType || t.templateKey || t.definitionKey || "",
        category: t.category || "", formType: t.formType || "",
        areaId: target.areaId || t.areaId || "", areaType: target.areaType || t.areaType || "",
        status: existing ? (
          ["completed","failed","not_in_use"].includes(existing.data.status) ? existing.data.status : "pending"
        ) : "pending",
        requiresMeasurement: t.requiresMeasurement === true || (t.formType || "").toLowerCase() === "temperature",
        requiresRegistration: true,
        registrationDeferred: false,
        deadlineAt: t.deadlineAt || null,
        overduePolicy: t.overduePolicy || "",
        overdueExplanationRequired: t.overdueExplanationRequired || false,
        frequency: t.frequency || "", frequencyType: t.frequencyType || "", frequencyDays: t.frequencyDays || 0,
        completedAt: existing ? (existing.data.completedAt || null) : null,
        completedBy: existing ? (existing.data.completedBy || "") : "",
        completedByName: existing ? (existing.data.completedByName || "") : "",
        isCCP: t.isCCP || false, riskLevel: t.riskLevel || "",
        visibility: t.visibility || "", sortOrder: t.sortOrder || 0,
        fields: t.fields || [], alertRules: t.alertRules || [],
        criticalLimits: t.criticalLimits || {}, thresholds: t.thresholds || {},
        guideKey: t.guideKey || "", templateType: t.templateType || "",
        templateSource: t.templateSource || "", sourceType: t.sourceType || ""
      };

      const isExistingMateriallyEqual = existing ? materiallyEqual(existing.data, nextPayload) : false;

      const entry = {
        instanceId,
        title:       scopedTitle,
        controlType: t.controlType || t.templateKey || t.definitionKey || "",
        templateId:  doc.id,
        dateKey:     todayKey,
        equipmentId: (target.equipmentId || t.equipmentId || "") || "(ingen)",
        unitId:      t.equipmentUnit || "(ingen)",
        status:      existing ? existing.data.status : "pending",
        isNew:       !existing,
        willSkip:    !!existing && isExistingMateriallyEqual,
        changedFields: (existing && !isExistingMateriallyEqual)
          ? diffFields(buildComparablePayload(existing.data), buildComparablePayload(nextPayload))
          : [],
        nextPayload
      };

      if (!existing) {
        toCreate.push(entry);
      } else if (isExistingMateriallyEqual) {
        toSkip.push({ id: uniqueKey, reason: "unchanged", templateId: doc.id });
      } else {
        toUpdate.push(entry);
      }
    }
  }

  // ── 5. Log output ─────────────────────────────────────────────────────────
  console.log(`── OPRETTES (${toCreate.length}) ─────────────────────────────────────`);
  for (const e of toCreate) {
    console.log(`  CREATE  ${e.instanceId}`);
    console.log(`    title: ${e.title}  controlType: ${e.controlType}  equipmentId: ${e.equipmentId}`);
    console.log("");
  }

  console.log(`── OPDATERES (${toUpdate.length}) ────────────────────────────────────`);
  for (const e of toUpdate) {
    console.log(`  UPDATE  ${e.instanceId}  (status=${e.status})`);
    console.log(`    changedFields: ${e.changedFields.join(", ") || "(none)"}`);
    console.log("");
  }

  console.log(`── SPRINGES OVER (${toSkip.length}) ─────────────────────────────────`);
  for (const e of toSkip) {
    console.log(`  SKIP  ${e.id}  reason=${e.reason}`);
  }

  console.log("");

  // Dublet-tjek: kig om nogen instanceId optræder mere end én gang i toCreate
  const idSet = new Set();
  const dupes = [];
  for (const e of toCreate) {
    if (idSet.has(e.instanceId)) dupes.push(e.instanceId);
    idSet.add(e.instanceId);
  }
  if (dupes.length) {
    console.log(`⚠️  DUBLETTE instance-IDs (${dupes.length}):`);
    dupes.forEach((id) => console.log(`  DUPE: ${id}`));
  } else {
    console.log(`✅ Ingen dublette instance-IDs`);
  }

  console.log(`\n[inspectStartDay] summary: create=${toCreate.length} update=${toUpdate.length} skip=${toSkip.length}`);

  if (DRY_RUN) {
    console.log("[inspectStartDay] DRY_RUN — ingen ændringer skrevet.");
    return;
  }

  // ── 6. Skriv instanser — kun create + update, skip berøres ikke ───────────
  const BATCH_SIZE = 400;
  const allOps = [...toCreate, ...toUpdate];

  for (let i = 0; i < allOps.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = allOps.slice(i, i + BATCH_SIZE);
    for (const e of chunk) {
      const templateDoc = filtered.find((d) => d.id === e.templateId);
      if (!templateDoc) continue;
      const t = templateDoc.data();
      const ref = db.collection("task_instances").doc(e.instanceId);
      batch.set(ref, {
        ...e.nextPayload,
        taskInstanceId: e.instanceId,
        organizationId: COMPANY_ID,
        createdAt:      FieldValue.serverTimestamp(),
        updatedAt:      FieldValue.serverTimestamp(),
      }, { merge: false });
    }
    await batch.commit();
    console.log(`[inspectStartDay] batch ${Math.floor(i / BATCH_SIZE) + 1} committed (${chunk.length} docs)`);
  }

  // Gem daily_run
  const runId  = `${COMPANY_ID}__${LOCATION_ID}__${todayKey}`;
  const runRef = db.collection("daily_runs").doc(runId);
  await runRef.set({
    companyId:     COMPANY_ID,
    organizationId: COMPANY_ID,
    locationId:    LOCATION_ID,
    dateKey:       todayKey,
    taskCount:     allOps.length,
    createdAt:     FieldValue.serverTimestamp(),
    updatedAt:     FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`[inspectStartDay] daily_run skrevet: ${runId}`);
  console.log("[inspectStartDay] done.");
}

main().catch((err) => {
  console.error("[inspectStartDay] FEJL:", err.message);
  process.exit(1);
});
