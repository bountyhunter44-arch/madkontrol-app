"use strict";

/*
 * Safe repair for Egenkontrol routine master cards.
 *
 * Dry-run is the default:
 *   node functions/scripts/repairEgenkontrolRoutineMasterlist.js
 *   node functions/scripts/repairEgenkontrolRoutineMasterlist.js --companyId <ID> --locationId <ID>
 *
 * Writes only with:
 *   node functions/scripts/repairEgenkontrolRoutineMasterlist.js --apply
 *   node functions/scripts/repairEgenkontrolRoutineMasterlist.js --companyId <ID> --locationId <ID> --apply
 */

const admin = require("firebase-admin");
const path = require("path");
const { OWNER_LABEL, buildOwnerScopeMetadata } = require("../lib/ownerScope");

const serviceAccount = require(path.resolve(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    apply: false,
    companyId: "",
    locationId: ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--apply") {
      args.apply = true;
    } else if (item === "--companyId") {
      args.companyId = String(argv[index + 1] || "").trim();
      index += 1;
    } else if (item === "--locationId") {
      args.locationId = String(argv[index + 1] || "").trim();
      index += 1;
    } else if (item === "--help" || item === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return args;
}

function printUsage() {
  console.log([
    "Usage:",
    "  node functions/scripts/repairEgenkontrolRoutineMasterlist.js",
    "  node functions/scripts/repairEgenkontrolRoutineMasterlist.js --companyId <ID> --locationId <ID>",
    "  node functions/scripts/repairEgenkontrolRoutineMasterlist.js --companyId <ID> --locationId <ID> --apply",
    "",
    "Default mode is dry-run. Writes require --apply."
  ].join("\n"));
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00e6/g, "ae")
    .replace(/\u00f8/g, "oe")
    .replace(/\u00e5/g, "aa")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toDocSafeId(value) {
  return clean(value)
    .replace(/[\/\\#?[\]]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);
}

function normalizeDateKey(value) {
  const text = clean(value);
  const match = text.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function stripScopedId(value = "", { companyId = "", locationId = "" } = {}) {
  return clean(value)
    .replace(companyId, "")
    .replace(locationId, "")
    .replace(/\d{4}-\d{2}-\d{2}/g, "")
    .replace(/\d{4}_\d{2}_\d{2}/g, "")
    .replace(/__?canonical__?/gi, "__");
}

function parseScopedRoutineParts(item = {}, context = {}) {
  const candidates = [
    item.taskId,
    item.templateId,
    item.taskInstanceId,
    item.instanceId,
    item.id
  ];

  for (const candidate of candidates) {
    const stripped = stripScopedId(candidate, context);
    const parts = stripped
      .split("__")
      .map(clean)
      .filter(Boolean)
      .filter((part) => !["canonical", "task", "instance", "repair"].includes(part.toLowerCase()));

    if (parts.length) {
      return {
        routineKey: parts[0] || "",
        equipmentKey: parts.slice(1).join("__")
      };
    }
  }

  return { routineKey: "", equipmentKey: "" };
}

function isPlaceholderEquipment(value = "") {
  return ["", "default", "generic", "general", "none", "null", "undefined", "na", "n_a", "all", "alle"].includes(normalizeKey(value));
}

function getRoutineKey(item = {}, context = {}) {
  const parsed = parseScopedRoutineParts(item, context);
  return clean(
    item.routineKey ||
    item.taskKey ||
    item.templateKey ||
    item.definitionKey ||
    item.canonicalRoutineType ||
    item.routineType ||
    item.canonicalTaskKey ||
    item.controlType ||
    item.guideKey ||
    item.category ||
    parsed.routineKey ||
    item.title ||
    item.name
  );
}

function getEquipmentKey(item = {}, context = {}) {
  const parsed = parseScopedRoutineParts(item, context);
  const equipmentKey = clean(
    item.equipmentId ||
    item.equipmentKey ||
    item.unitId ||
    item.unitKey ||
    parsed.equipmentKey ||
    item.equipmentName ||
    item.unitName ||
    item.machineName
  );
  return isPlaceholderEquipment(equipmentKey) ? "" : equipmentKey;
}

function getAreaKey(item = {}) {
  return clean(item.areaId || item.areaKey || item.areaName || "");
}

function makeRoutineKey(item = {}, context = {}) {
  return [
    context.companyId || item.companyId || item.organizationId,
    context.locationId || item.locationId,
    getRoutineKey(item, context),
    getEquipmentKey(item, context),
    getAreaKey(item)
  ].map(normalizeKey).filter(Boolean).join("__");
}

function isPaused(item = {}) {
  const status = normalizeKey(item.status || item.pauseState || "");
  return item.hiddenFromDailyView === true ||
    item.paused === true ||
    item.isPaused === true ||
    item.active === false ||
    item.isActive === false ||
    status === "paused";
}

function isArchivedOrDisabled(item = {}) {
  return item.archived === true || item.deleted === true || item.disabled === true || item.skippedDuplicate === true;
}

function getFrequencyDays(source = {}) {
  const explicit = Number(source.frequencyDays || source.interval_days || source.intervalDays || source.recurrenceValue);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const frequency = normalizeKey(source.frequency || source.frequencyType || source.registrationFrequency || "");
  if (frequency === "weekly") return 7;
  if (frequency === "monthly") return 30;
  if (frequency === "quarterly") return 91;
  if (frequency === "yearly" || frequency === "annual") return 365;
  return 1;
}

function buildScheduleConfig(source = {}) {
  const days = getFrequencyDays(source);
  return {
    scheduleType: "recurring",
    recurrenceMode: "interval_days",
    recurrenceValue: days,
    anchorDate: normalizeDateKey(source.dateKey) || new Date().toISOString().slice(0, 10)
  };
}

function getFrequencyLabel(source = {}) {
  const frequency = clean(source.frequency || source.frequencyType || "");
  if (frequency) return frequency;
  const days = getFrequencyDays(source);
  if (days === 1) return "daily";
  if (days === 7) return "weekly";
  if (days === 30) return "monthly";
  if (days === 365) return "yearly";
  return "interval_days";
}

async function loadTargetOwnerScope(companyId, locationId) {
  const [locationSnap, companySnap] = await Promise.all([
    db.collection("companies").doc(companyId).collection("locations").doc(locationId).get(),
    db.collection("companies").doc(companyId).get()
  ]);
  const ownerKind = clean(locationSnap.data()?.ownerKind || companySnap.data()?.ownerKind);
  return ownerKind ? buildOwnerScopeMetadata(ownerKind) : {};
}

function extractRiskControlPoints(riskAnalysis = {}) {
  const sources = [
    riskAnalysis.controlPoints,
    riskAnalysis.controls,
    riskAnalysis.generated && riskAnalysis.generated.controlPoints,
    riskAnalysis.generated && riskAnalysis.generated.controls,
    riskAnalysis.activeSnapshot && riskAnalysis.activeSnapshot.controlPoints,
    riskAnalysis.snapshot && riskAnalysis.snapshot.controlPoints,
    riskAnalysis.haccpSnapshot && riskAnalysis.haccpSnapshot.controlPoints,
    riskAnalysis.onboardingSnapshot && riskAnalysis.onboardingSnapshot.taskTemplates,
    riskAnalysis.onboardingSnapshot && riskAnalysis.onboardingSnapshot.templates,
    riskAnalysis.onboardingSnapshot && riskAnalysis.onboardingSnapshot.routines
  ];

  const out = [];
  const seen = new Set();
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      const data = typeof item === "string" ? { title: item, name: item } : (item || {});
      const key = normalizeKey(
        data.routineKey ||
        data.taskKey ||
        data.templateKey ||
        data.canonicalRoutineType ||
        data.routineType ||
        data.guideKey ||
        data.controlType ||
        data.category ||
        data.key ||
        data.id ||
        data.title ||
        data.name
      );
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(data);
    }
  }
  return out;
}

async function loadScopedDocs(collectionName, companyId, locationId) {
  const docsById = new Map();
  const queries = [
    db.collection(collectionName).where("companyId", "==", companyId).where("locationId", "==", locationId),
    db.collection(collectionName).where("organizationId", "==", companyId).where("locationId", "==", locationId)
  ];

  for (const scopedQuery of queries) {
    const snap = await scopedQuery.get();
    snap.docs.forEach((doc) => {
      docsById.set(doc.id, { id: doc.id, ref: doc.ref, ...doc.data() });
    });
  }

  return Array.from(docsById.values());
}

async function loadRiskAnalysisCurrent(companyId, locationId) {
  const ref = db
    .collection("companies")
    .doc(companyId)
    .collection("locations")
    .doc(locationId)
    .collection("risk_analysis")
    .doc("current");
  const snap = await ref.get();
  return snap.exists ? { id: snap.id, ref, ...snap.data() } : null;
}

function addScope(scopes, item = {}) {
  const companyId = clean(item.companyId || item.organizationId);
  const locationId = clean(item.locationId);
  if (!companyId || !locationId) return;
  scopes.set(`${companyId}|||${locationId}`, { companyId, locationId });
}

async function discoverScopes() {
  const scopes = new Map();
  for (const collectionName of ["task_templates", "verification_templates", "task_instances", "task_entries"]) {
    const snap = await db.collection(collectionName).get();
    snap.docs.forEach((doc) => addScope(scopes, doc.data() || {}));
  }

  try {
    const riskSnap = await db.collectionGroup("risk_analysis").get();
    riskSnap.docs.forEach((doc) => {
      if (doc.id !== "current") return;
      const locationRef = doc.ref.parent.parent;
      const companyRef = locationRef && locationRef.parent && locationRef.parent.parent;
      if (!locationRef || !companyRef) return;
      addScope(scopes, { companyId: companyRef.id, locationId: locationRef.id });
    });
  } catch (error) {
    console.warn("[discover] collectionGroup risk_analysis skipped:", error.message);
  }

  return Array.from(scopes.values());
}

function buildCandidateFromSource(source = {}, sourceName = "history", context = {}) {
  const routineKey = getRoutineKey(source, context);
  if (!routineKey) return null;

  const paused = isPaused(source);
  const templateKey = clean(source.templateKey || source.taskKey || source.definitionKey || routineKey);
  const title = clean(source.title || source.name || source.taskTitle || source.controlPoint || routineKey);
  const frequency = getFrequencyLabel(source);
  const frequencyDays = getFrequencyDays(source);
  const equipmentId = getEquipmentKey(source, context);
  const templateId = toDocSafeId([
    context.companyId,
    context.locationId,
    "repair",
    normalizeKey(templateKey || routineKey),
    normalizeKey(equipmentId)
  ].filter(Boolean).join("__"));

  return {
    key: makeRoutineKey({ ...source, routineKey, templateKey, equipmentId }, context),
    templateId,
    sourceName,
    paused,
    payload: {
      templateId,
      id: templateId,
      companyId: context.companyId,
      organizationId: context.companyId,
      locationId: context.locationId,
      ...(context.ownerScopeMetadata || {}),
      title,
      name: title,
      description: clean(source.description || source.longDescription || source.guideBody || source.hazard || ""),
      category: clean(source.category || source.type || source.group || "egenkontrol"),
      templateType: clean(source.templateType || "operational"),
      templateSource: "routine_masterlist_repair",
      sourceType: "routine_masterlist_repair",
      repairSource: sourceName,
      repairedFromCollection: sourceName,
      routineKey,
      routineType: clean(source.routineType || routineKey),
      canonicalRoutineType: clean(source.canonicalRoutineType || source.routineType || routineKey),
      templateKey,
      taskKey: clean(source.taskKey || templateKey),
      controlType: clean(source.controlType || source.guideKey || source.formType || "checklist"),
      guideKey: clean(source.guideKey || ""),
      formType: clean(source.formType || (source.requiresMeasurement === true ? "temperature" : "check")),
      frequency,
      frequencyType: frequency === "daily" ? "daily" : "interval_days",
      frequencyDays,
      interval_days: frequencyDays,
      scheduleConfig: buildScheduleConfig(source),
      equipmentId,
      equipmentName: clean(source.equipmentName || source.unitName || ""),
      areaId: clean(source.areaId || ""),
      areaName: clean(source.areaName || ""),
      requiresMeasurement: source.requiresMeasurement === true,
      requiresRegistration: source.requiresRegistration !== false,
      isActive: paused ? false : source.isActive !== false,
      active: paused ? false : source.active !== false,
      enabled: paused ? false : source.enabled !== false,
      paused: paused === true,
      pauseState: paused ? "paused" : "active",
      status: paused ? "paused" : "active",
      restoredFromOwnerKind: clean(source.ownerKind),
      restoredFromOwnerLabel: clean(source.ownerLabel || OWNER_LABEL[source.ownerKind] || ""),
      restoredFromCompanyId: clean(source.companyId || source.organizationId),
      restoredFromLocationId: clean(source.locationId),
      restoredFromDocId: clean(source.id || source.templateId || source.taskId || source.instanceId),
      restoreBatchId: context.restoreBatchId || "",
      restoredAt: FieldValue.serverTimestamp(),
      repairedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }
  };
}

function collectExistingMasterKeys(items = [], context = {}) {
  const keys = new Map();
  for (const item of items) {
    const key = makeRoutineKey(item, context);
    if (!key) continue;
    if (!keys.has(key)) keys.set(key, item);
  }
  return keys;
}

function collectCandidates({ riskAnalysis, taskInstances, taskEntries, context }) {
  const candidatesByKey = new Map();
  const historicalKeys = new Set();

  const riskSources = extractRiskControlPoints(riskAnalysis || {});
  for (const source of riskSources) {
    const candidate = buildCandidateFromSource(source, "risk_analysis", context);
    if (candidate && !candidatesByKey.has(candidate.key)) {
      candidatesByKey.set(candidate.key, candidate);
    }
  }

  for (const source of taskInstances) {
    if (isArchivedOrDisabled(source)) continue;
    const candidate = buildCandidateFromSource(source, "task_instances", context);
    if (!candidate) continue;
    historicalKeys.add(candidate.key);
    if (!candidatesByKey.has(candidate.key)) {
      candidatesByKey.set(candidate.key, candidate);
    }
  }

  for (const source of taskEntries) {
    if (isArchivedOrDisabled(source)) continue;
    const candidate = buildCandidateFromSource(source, "task_entries", context);
    if (!candidate) continue;
    historicalKeys.add(candidate.key);
    if (!candidatesByKey.has(candidate.key)) {
      candidatesByKey.set(candidate.key, candidate);
    }
  }

  return {
    candidates: Array.from(candidatesByKey.values()),
    historicalFound: historicalKeys.size
  };
}

async function repairScope({ companyId, locationId, apply }) {
  const context = {
    companyId,
    locationId,
    ownerScopeMetadata: await loadTargetOwnerScope(companyId, locationId),
    restoreBatchId: `routine_masterlist_repair_${companyId}_${locationId}_${new Date().toISOString()}`
  };
  const [
    taskTemplates,
    verificationTemplates,
    riskAnalysis,
    taskInstances,
    taskEntries
  ] = await Promise.all([
    loadScopedDocs("task_templates", companyId, locationId),
    loadScopedDocs("verification_templates", companyId, locationId),
    loadRiskAnalysisCurrent(companyId, locationId),
    loadScopedDocs("task_instances", companyId, locationId),
    loadScopedDocs("task_entries", companyId, locationId)
  ]);

  const existingTemplateKeys = collectExistingMasterKeys(taskTemplates, context);
  const existingVerificationKeys = collectExistingMasterKeys(verificationTemplates, context);
  const existingMasterKeys = new Map([...existingTemplateKeys, ...existingVerificationKeys]);
  const pausedPreserved = [...taskTemplates, ...verificationTemplates].filter(isPaused).length;
  const { candidates, historicalFound } = collectCandidates({ riskAnalysis, taskInstances, taskEntries, context });

  let missingCount = 0;
  let skippedDuplicate = 0;
  const toCreate = [];

  for (const candidate of candidates) {
    if (!candidate.key) continue;
    if (existingMasterKeys.has(candidate.key)) {
      skippedDuplicate += 1;
      continue;
    }
    if (toCreate.some((item) => item.key === candidate.key || item.templateId === candidate.templateId)) {
      skippedDuplicate += 1;
      continue;
    }
    missingCount += 1;
    toCreate.push(candidate);
  }

  let created = 0;
  if (apply && toCreate.length) {
    let batch = db.batch();
    let batchSize = 0;

    for (const candidate of toCreate) {
      const ref = db.collection("task_templates").doc(candidate.templateId);
      const existingDoc = await ref.get();
      if (existingDoc.exists) {
        skippedDuplicate += 1;
        continue;
      }

      batch.set(ref, candidate.payload, { merge: true });
      batchSize += 1;
      created += 1;

      if (batchSize >= 450) {
        await batch.commit();
        batch = db.batch();
        batchSize = 0;
      }
    }

    if (batchSize > 0) {
      await batch.commit();
    }
  }

  const summary = {
    companyId,
    locationId,
    templatesBefore: taskTemplates.length,
    verificationTemplatesBefore: verificationTemplates.length,
    historicalRoutinesFound: historicalFound,
    missingRoutines: missingCount,
    wouldCreateDryRun: apply ? 0 : toCreate.length,
    created: apply ? created : 0,
    skippedDuplicate,
    pausedPreserved,
    mode: apply ? "apply" : "dry-run"
  };

  console.log("[repair scope]", JSON.stringify(summary, null, 2));
  if (toCreate.length) {
    console.log("[repair candidates]", toCreate.slice(0, 25).map((item) => ({
      templateId: item.templateId,
      key: item.key,
      title: item.payload.title,
      source: item.sourceName,
      paused: item.paused
    })));
  }

  return summary;
}

async function main() {
  const args = parseArgs();
  const mode = args.apply ? "APPLY" : "DRY-RUN";

  if ((args.companyId && !args.locationId) || (!args.companyId && args.locationId)) {
    throw new Error("Both --companyId and --locationId are required when scoping.");
  }

  console.log("[repair] mode:", mode);
  console.log("[repair] project:", serviceAccount.project_id);

  const scopes = args.companyId && args.locationId
    ? [{ companyId: args.companyId, locationId: args.locationId }]
    : await discoverScopes();

  console.log("[repair] scopes:", scopes.length);

  const totals = {
    templatesBefore: 0,
    verificationTemplatesBefore: 0,
    historicalRoutinesFound: 0,
    missingRoutines: 0,
    wouldCreateDryRun: 0,
    created: 0,
    skippedDuplicate: 0,
    pausedPreserved: 0
  };

  for (const scope of scopes) {
    const summary = await repairScope({ ...scope, apply: args.apply });
    for (const key of Object.keys(totals)) {
      totals[key] += Number(summary[key] || 0);
    }
  }

  console.log("[repair totals]", JSON.stringify({
    ...totals,
    scopes: scopes.length,
    mode: args.apply ? "apply" : "dry-run"
  }, null, 2));
}

main().catch((error) => {
  console.error("[repair] failed:", error);
  process.exitCode = 1;
});
