// egenkontrol-ops — udtrukket fra functions/index.js.
// Følger DI-factory-mønsteret fra functions/egenkontrol/.
// Kode flyttet ORDRET; eneste ændring er `exports.` -> `api.`.

const functions = require("firebase-functions");
const { logger } = require("firebase-functions");
const { OWNER_KIND, buildOwnerScopeMetadata } = require("../../lib/ownerScope");
const { normalizeRoutineType } = require("../../js/canonicalRoutines");
const { sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt, toDocSafeId, toAsciiSlug, toLegacyId, getDateKey, addDays, daysBetween, normalizeDateKey, removeUndefinedFields, getWeekdayFromDateKey, sanitizeRelativePath, parsePageCount } = require("../../lib/util");
const {
  generateCanonicalTaskTemplates,
  ensureSingleTaskInstance,
  startDayForLocationCanonical
} = require("../../canonicalTaskEngine");

module.exports = ({
  FieldValue,
  assertAdminAccess,
  assertStartDayAccess,
  db
}) => {
  const api = {};

function buildRoutineInstanceId(companyId = "", locationId = "", dateKey = "", identity = "") {
  const normalizedDateKey = normalizeDateKey(dateKey) || getDateKey();
  const identityKey = toDocSafeId(identity || "routine");
  return `${companyId}__${locationId}__${normalizedDateKey}__${identityKey}`.slice(0, 180);
}

function normalizeTaskInstanceDateInId(instanceId = "", dateKey = "") {
  const id = sanitizeString(instanceId, 240);
  const normalizedDateKey = normalizeDateKey(dateKey);
  if (!id || !normalizedDateKey) return id;
  return id.replace(/\d{4}[-_]\d{2}[-_]\d{2}/, normalizedDateKey);
}

api.saveRoutineTask = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind for at gemme en rutine.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const rawTaskInstanceId = sanitizeString(data?.taskInstanceId || "", 120);
  const taskDateKeyHint = normalizeDateKey(data?.taskDateKey || data?.dateKey || data?.selectedDateKey || "") || getDateKey();
  
  logger.info("saveRoutineTask called", {
    userId: auth.uid,
    companyId,
    locationId,
    rawTaskInstanceId,
    taskDateKeyHint
  });
  const taskIdHint = sanitizeString(data?.taskId || "", 120);
  const templateIdHint = sanitizeString(data?.templateId || data?.taskTemplateId || "", 120);
  const templateKeyHint = sanitizeString(data?.templateKey || "", 120);
  const routineKeyHint = sanitizeString(data?.routineKey || data?.routineType || "", 120);
  const actionType = sanitizeString(data?.actionType || "save", 60);
  const rawTaskInstanceHasDate = /\d{4}[-_]\d{2}[-_]\d{2}/.test(rawTaskInstanceId);
  const taskInstanceId = rawTaskInstanceHasDate
    ? normalizeTaskInstanceDateInId(rawTaskInstanceId, taskDateKeyHint)
    : buildRoutineInstanceId(companyId, locationId, taskDateKeyHint, routineKeyHint || templateKeyHint || templateIdHint || taskIdHint || rawTaskInstanceId);

  if (!companyId || !locationId || !taskInstanceId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId, locationId og taskInstanceId er paakraevet.");
  }

  await assertStartDayAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  const todayKey = taskDateKeyHint || getDateKey();
  let taskRef = db.collection("task_instances").doc(taskInstanceId);
  let taskSnap = await taskRef.get();

  if (!taskSnap.exists && rawTaskInstanceId && rawTaskInstanceId !== taskInstanceId) {
    const rawTaskSnap = await db.collection("task_instances").doc(rawTaskInstanceId).get();
    if (rawTaskSnap.exists) {
      taskSnap = rawTaskSnap;
    }
  }

  if (!taskSnap.exists && taskIdHint) {
    let fallbackQuery = db
      .collection("task_instances")
      .where("locationId", "==", locationId)
      .where("taskId", "==", taskIdHint);

    if (taskDateKeyHint) {
      fallbackQuery = fallbackQuery.where("dateKey", "==", taskDateKeyHint);
    }

    const fallbackSnap = await fallbackQuery.limit(10).get();
    for (const doc of fallbackSnap.docs) {
      const candidate = doc.data() || {};
      const candidateOrgId = sanitizeString(candidate.companyId || candidate.organizationId, 120);
      if (!candidateOrgId || candidateOrgId === companyId) {
        taskRef = doc.ref;
        taskSnap = doc;
        break;
      }
    }
  }

  // Additional fallback: try routineType/canonicalTaskKey
  if (!taskSnap.exists && routineKeyHint && taskDateKeyHint) {
    const routineKey = routineKeyHint;
    let routineFallbackQuery = db
      .collection("task_instances")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .where("dateKey", "==", taskDateKeyHint);

    const routineFallbackSnap = await routineFallbackQuery.limit(20).get();
    for (const doc of routineFallbackSnap.docs) {
      const candidate = doc.data() || {};
      const candidateRoutineKey = candidate.routineType || candidate.canonicalTaskKey || candidate.templateKey || "";
      if (candidateRoutineKey === routineKey) {
        taskRef = doc.ref;
        taskSnap = doc;
        logger.info("Found task via routineKey fallback", { routineKey, docId: doc.id });
        break;
      }
    }
  }

  // Lazy-create exactly one selected-date task instance when a template card is saved.
  // This preserves the lazy-create model: normal routine load must not generate daily instances.
  if (!taskSnap.exists) {
    const templateCandidateIds = [
      templateIdHint,
      taskIdHint,
      templateKeyHint
    ].map((value) => sanitizeString(value, 160)).filter(Boolean);

    if (!templateCandidateIds.length && !routineKeyHint) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Rutinen mangler templateId, templateKey eller routineKey, saa den kan ikke oprettes for den valgte dato."
      );
    }

    let templateSnap = null;
    let templateCollectionName = "";

    for (const collectionName of ["task_templates", "verification_templates"]) {
      for (const candidateId of templateCandidateIds) {
        const candidateSnap = await db.collection(collectionName).doc(candidateId).get();
        if (!candidateSnap.exists) continue;

        const candidate = candidateSnap.data() || {};
        const candidateCompanyId = sanitizeString(candidate.companyId || candidate.organizationId, 120);
        const candidateLocationId = sanitizeString(candidate.locationId || "", 120);
        const companyMatches = !candidateCompanyId || candidateCompanyId === companyId;
        const locationMatches = !candidateLocationId || candidateLocationId === locationId;

        if (companyMatches && locationMatches) {
          templateSnap = candidateSnap;
          templateCollectionName = collectionName;
          break;
        }
      }
      if (templateSnap) break;
    }

    if (!templateSnap && routineKeyHint) {
      for (const collectionName of ["task_templates", "verification_templates"]) {
        const templateQuerySnap = await db
          .collection(collectionName)
          .where("companyId", "==", companyId)
          .where("locationId", "==", locationId)
          .limit(100)
          .get();

        for (const doc of templateQuerySnap.docs) {
          const candidate = doc.data() || {};
          const candidateRoutineKeys = [
            candidate.routineKey,
            candidate.routineType,
            candidate.canonicalRoutineType,
            candidate.templateKey,
            candidate.taskKey,
            candidate.taskId,
            doc.id
          ].map((value) => sanitizeString(value, 120)).filter(Boolean);

          if (candidateRoutineKeys.includes(routineKeyHint)) {
            templateSnap = doc;
            templateCollectionName = collectionName;
            break;
          }
        }
        if (templateSnap) break;
      }
    }

    if (templateSnap) {
      const template = templateSnap.data() || {};
      const lazyDateKey = normalizeDateKey(taskDateKeyHint) || todayKey;
      const resolvedRoutineKey = sanitizeString(
        routineKeyHint ||
        template.routineKey ||
        template.routineType ||
        template.canonicalRoutineType ||
        template.templateKey ||
        template.taskKey ||
        templateSnap.id,
        120
      );
      const lazyTaskPayload = {
        companyId,
        organizationId: companyId,
        locationId,
        unitId: sanitizeString(data?.unitId || template.unitId || "", 120),
        taskId: sanitizeString(template.taskId || templateSnap.id, 120),
        templateId: templateSnap.id,
        linkedTemplateId: templateSnap.id,
        templateKey: sanitizeString(template.templateKey || template.taskKey || templateSnap.id, 120),
        templateSource: templateCollectionName,
        source: "lazy_save",
        title: sanitizeString(template.title || data?.title || "Rutine", 220),
        description: sanitizeString(template.description || "", 1000),
        category: sanitizeString(template.category || data?.category || "", 120),
        controlPoint: sanitizeString(template.controlPoint || data?.controlPoint || template.category || "", 160),
        type: sanitizeString(template.type || template.taskType || "", 80),
        taskType: sanitizeString(template.taskType || template.type || "", 80),
        routineKey: resolvedRoutineKey,
        routineType: sanitizeString(template.routineType || resolvedRoutineKey, 120),
        canonicalTaskKey: sanitizeString(template.canonicalTaskKey || resolvedRoutineKey, 120),
        canonicalRoutineType: sanitizeString(template.canonicalRoutineType || resolvedRoutineKey, 120),
        equipmentId: sanitizeString(template.equipmentId || "", 120),
        equipmentName: sanitizeString(template.equipmentName || template.unitName || "", 140),
        equipmentType: sanitizeString(template.equipmentType || "", 80),
        frequency: sanitizeString(template.frequency || "daily", 40),
        dateKey: lazyDateKey,
        status: "active",
        documented: false,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: auth.uid
      };

      await taskRef.set(lazyTaskPayload, { merge: true });
      taskSnap = await taskRef.get();

      logger.info("Lazy-created task instance for saveRoutineTask", {
        userId: auth.uid,
        companyId,
        locationId,
        taskInstanceId,
        templateId: templateSnap.id,
        templateCollectionName,
        routineKey: resolvedRoutineKey
      });
    }
  }

  if (!taskSnap.exists) {
    logger.warn("Task instance not found", {
      userId: auth.uid,
      companyId,
      locationId,
      taskInstanceId,
      taskIdHint,
      templateIdHint,
      templateKeyHint,
      routineKeyHint,
      taskDateKeyHint
    });
    throw new functions.https.HttpsError(
      "not-found",
      `Rutinen blev ikke fundet, og lazy-create kunne ikke finde en template for ${taskDateKeyHint}.`
    );
  }

  const task = taskSnap.data() || {};
  const taskOrgId = sanitizeString(task.companyId || task.organizationId, 120);
  const taskLocationId = sanitizeString(task.locationId || "", 120);

  if (taskOrgId !== companyId || taskLocationId !== locationId) {
    throw new functions.https.HttpsError("permission-denied", "Rutinen tilhoerer ikke denne lokation.");
  }

  const entryData = data?.entryData || {};
  const result = data?.result || {};
  const completedBy = sanitizeString(data?.completedBy || auth.uid, 120) || auth.uid;
  const completedByName = sanitizeString(data?.completedByName || auth.token?.name || auth.token?.email || auth.uid, 140);
  const note = sanitizeString(entryData.note || entryData.comment || "", 2000);
  const aiBeskrivelse = sanitizeString(entryData.beskrivelse || entryData.aiDescription || "", 4000);
  const aiSource = sanitizeString(entryData.ai_source || "", 80);
  const aiCategory = sanitizeString(entryData.ai_category || "", 80);
  const aiHandlingUdfort =
    entryData.handling_udfort === true ||
    entryData.handlingUdfort === true;
  const hasAiHandlingFlag =
    typeof entryData.handling_udfort === "boolean" ||
    typeof entryData.handlingUdfort === "boolean";
  const aiConfidenceRaw = entryData.ai_confidence;
  const aiConfidenceValue =
    aiConfidenceRaw === null || aiConfidenceRaw === undefined || aiConfidenceRaw === ""
      ? null
      : Number(aiConfidenceRaw);
  const aiConfidence = Number.isFinite(aiConfidenceValue)
    ? Math.max(0, Math.min(1, aiConfidenceValue))
    : null;
  const contextMachineName = sanitizeString(result?.contextMachineName || "", 140);
  const contextAreaName = sanitizeString(result?.contextAreaName || "", 140);
  const contextAreaType = sanitizeString(result?.contextAreaType || "", 80);
  const contextSpecificLabel = sanitizeString(result?.contextSpecificLabel || "", 220);
  const measurementUnit = sanitizeString(entryData.measurementUnit || "", 20);
  const valueLabel = sanitizeString(entryData.valueLabel || "", 120);
  const entryType = sanitizeString(entryData.entryType || "check", 40);
  const instanceStatus = sanitizeString(result.instanceStatus || "completed", 40) || "completed";
  const entryStatus = sanitizeString(result.entryStatus || instanceStatus, 40) || instanceStatus;
  const deadlineAt = sanitizeString(data?.deadlineAt || task.deadlineAt || "", 80);
  const completedLate = data?.completedLate === true;
  const overdueLogged = data?.overdueLogged === true;

  let measurementValue = null;
  if (entryData.measurementValue !== null && entryData.measurementValue !== undefined && entryData.measurementValue !== "") {
    measurementValue = Number(entryData.measurementValue);
    if (!Number.isFinite(measurementValue)) {
      throw new functions.https.HttpsError("invalid-argument", "Maalevaerdi er ugyldig.");
    }
  }

  if (actionType === "save" && task.status === "overdue" && !note) {
    throw new functions.https.HttpsError("invalid-argument", "Forklaring er paakraevet, fordi rutinen er gaaet over tid.");
  }

  const resolvedTaskInstanceId = taskRef.id;

  const autoDocumentationNote = (() => {
    if (note) return note;
    const scope = contextSpecificLabel || contextMachineName || contextAreaName || sanitizeString(task.equipmentName || task.title || "Rutine", 220);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const timeLabel = `${hh}:${mm}`;

    if (actionType === "save") {
      if (measurementValue !== null && measurementValue !== undefined) {
        return `${scope} udfÃ¸rt kl. ${timeLabel}. MÃ¥ling registreret: ${measurementValue}${measurementUnit || ""}.`;
      }
      return `${scope} udfÃ¸rt kl. ${timeLabel}. OmrÃ¥de/maskine kontrolleret og dokumenteret.`;
    }

    return "";
  })();

  const resolvedTemplateId = sanitizeString(task.templateId || task.linkedTemplateId || templateIdHint || "", 120);
  const resolvedTemplateKey = sanitizeString(task.templateKey || templateKeyHint || resolvedTemplateId || task.taskId || taskIdHint || "", 120);
  const resolvedRoutineKey = sanitizeString(
    data?.routineKey ||
    task.routineKey ||
    task.routineType ||
    task.canonicalRoutineType ||
    task.canonicalTaskKey ||
    resolvedTemplateKey ||
    task.taskId ||
    taskIdHint ||
    "",
    120
  );
  const resolvedRoutineType = sanitizeString(task.routineType || data?.routineType || resolvedRoutineKey, 120);
  const resolvedCanonicalTaskKey = sanitizeString(task.canonicalTaskKey || data?.canonicalTaskKey || resolvedRoutineKey || resolvedTemplateKey, 120);
  const coolingData = entryData?.coolingData || {};
  const isCoolingEntry =
    entryType === "cooling_control" ||
    String(data?.actionType || entryData?.actionType || "").toLowerCase().includes("cooling") ||
    normalizeRoutineType(resolvedRoutineKey || resolvedTemplateKey || task.routineKey || task.templateKey || "") === "nedkoeling";
  const coolingFoodItem = sanitizeString(
    entryData.foodItem ||
    entryData.productName ||
    data?.foodItem ||
    data?.productName ||
    coolingData.foodItem ||
    coolingData.productName ||
    "",
    180
  );
  const coolingMethod = sanitizeString(entryData.method || data?.method || coolingData.coolingMethodLabel || coolingData.coolingMethod || "", 140);
  const coolingPerformedByUid = sanitizeString(entryData.performedByUid || data?.performedByUid || entryData.completedBy || completedBy, 120) || completedBy;
  const coolingPerformedByName = sanitizeString(entryData.performedByName || data?.performedByName || entryData.completedByName || completedByName, 140) || completedByName;
  const latestComment = sanitizeString(entryData.comment || entryData.note || "", 2000);
  const startTime = sanitizeString(entryData.startTime || entryData.startAt || entryData.cooling_startTime || entryData.coolingData?.startedAt || "", 120);
  const endTime = sanitizeString(entryData.endTime || entryData.endAt || entryData.finishedAt || entryData.cooling_endTime || entryData.coolingData?.finishedAt || "", 120);

  const entryPayload = {
    taskInstanceId: resolvedTaskInstanceId,
    taskId: sanitizeString(task.taskId || "", 120),
    sourceTaskInstanceId: resolvedTaskInstanceId,
    companyId,
    organizationId: companyId,
    unitId: sanitizeString(data?.unitId || task.unitId || "", 120),
    locationId,
    routineKey: resolvedRoutineKey,
    routineType: resolvedRoutineType,
    canonicalTaskKey: resolvedCanonicalTaskKey,
    canonicalRoutineType: sanitizeString(task.canonicalRoutineType || resolvedRoutineType, 120),
    templateKey: resolvedTemplateKey,
    templateId: resolvedTemplateId,
    taskTitle: sanitizeString(task.title || "", 220),
    title: sanitizeString(task.title || "", 220),
    taskType: sanitizeString(task.type || task.category || "", 80),
    category: sanitizeString(task.category || "", 120),
    controlPoint: sanitizeString(task.controlPoint || "", 160),
    equipmentId: sanitizeString(task.equipmentId || "", 120),
    equipmentName: sanitizeString(task.equipmentName || "", 140),
    equipmentType: sanitizeString(task.equipmentType || "", 80),
    entryType,
    measurementValue,
    measurementUnit,
    valueLabel,
    status: entryStatus,
    startTime,
    startAt: sanitizeString(entryData.startAt || startTime || "", 120),
    endTime,
    endAt: sanitizeString(entryData.endAt || endTime || "", 120),
    note: autoDocumentationNote,
    comment: latestComment || autoDocumentationNote,
    beskrivelse: aiBeskrivelse || autoDocumentationNote,
    handling_udfort: hasAiHandlingFlag ? aiHandlingUdfort : actionType === "save",
    deadlineAt,
    completedLate,
    overdueLogged,
    dateKey: todayKey,
    completedBy,
    completedByName,
    completedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    actionType: entryStatus === "not_relevant_today" ? "not_relevant_today" : actionType
  };

  if (aiSource) entryPayload.aiSource = aiSource;
  if (aiCategory) entryPayload.aiCategory = aiCategory;
  if (aiConfidence !== null) entryPayload.aiConfidence = aiConfidence;

  const entryRiskId = Array.isArray(task.linkedRiskIds) && task.linkedRiskIds.length
    ? sanitizeString(task.linkedRiskIds[0], 120)
    : sanitizeString(task.sourceRiskAnalysisId || task.sourceHazard || "", 120);
  const sourceRiskAnalysisId = sanitizeString(task.sourceRiskAnalysisId || "", 120);
  const sourceHazard = sanitizeString(task.sourceHazard || "", 220);

  if (contextMachineName) entryPayload.machineName = contextMachineName;
  if (contextAreaName) entryPayload.areaName = contextAreaName;
  if (contextAreaType) entryPayload.areaType = contextAreaType;
  if (contextSpecificLabel) entryPayload.specificLabel = contextSpecificLabel;
  if (entryRiskId) entryPayload.riskId = entryRiskId;
  if (sourceRiskAnalysisId) entryPayload.sourceRiskAnalysisId = sourceRiskAnalysisId;
  if (sourceHazard) entryPayload.sourceHazard = sourceHazard;
  if (isCoolingEntry) {
    entryPayload.foodItem = coolingFoodItem;
    entryPayload.productName = coolingFoodItem;
    entryPayload.performedByUid = coolingPerformedByUid;
    entryPayload.performedByName = coolingPerformedByName;
    entryPayload.completedByName = coolingPerformedByName;
    entryPayload.method = coolingMethod;
    entryPayload.documentation = autoDocumentationNote;
    entryPayload.coolingData = {
      foodItem: coolingFoodItem,
      productName: coolingFoodItem,
      quantityBucket: sanitizeString(coolingData.quantityBucket || entryData.quantityBucket || "", 80),
      coolingMethod: sanitizeString(coolingData.coolingMethod || entryData.coolingMethod || "", 80),
      coolingMethodLabel: sanitizeString(coolingData.coolingMethodLabel || coolingMethod || "", 140),
      startTemp: coolingData.startTemp ?? entryData.startTemp ?? null,
      endTemp: coolingData.endTemp ?? entryData.endTemp ?? measurementValue,
      coolingDuration: coolingData.coolingDuration ?? entryData.coolingDuration ?? null,
      startedAt: sanitizeString(coolingData.startedAt || entryData.startedAt || "", 80),
      finishedAt: sanitizeString(coolingData.finishedAt || entryData.completedAt || data?.completedAt || "", 80),
      aborted: coolingData.aborted === true || entryData.aborted === true
    };
  }

  const entryRef = await db.collection("task_entries").add(entryPayload);
  
  logger.info("Task entry created", {
    userId: auth.uid,
    companyId,
    locationId,
    taskInstanceId,
    entryId: entryRef.id,
    status: entryStatus
  });

  const sourceDateKey = normalizeDateKey(task.dateKey) || todayKey;
  const activeUntilDateKey = normalizeDateKey(task.activeUntilDateKey) || addDays(sourceDateKey, 7);
  const instanceUpdate = {
    status: "active",
    statusForSelectedDate: entryStatus,
    dateKey: todayKey,
    taskInstanceId: resolvedTaskInstanceId,
    sourceTaskInstanceId: resolvedTaskInstanceId,
    routineKey: resolvedRoutineKey,
    routineType: resolvedRoutineType,
    canonicalTaskKey: resolvedCanonicalTaskKey,
    canonicalRoutineType: sanitizeString(task.canonicalRoutineType || resolvedRoutineType, 120),
    templateKey: resolvedTemplateKey,
    templateId: resolvedTemplateId,
    latestEntryId: entryRef.id,
    latestEntryAt: FieldValue.serverTimestamp(),
    latestEntryStatus: entryStatus,
    latestEntrySummary: autoDocumentationNote,
    latestEntryByName: isCoolingEntry ? coolingPerformedByName : completedByName,
    latestMeasurement: measurementValue,
    latestComment,
    startTime,
    startAt: sanitizeString(entryData.startAt || startTime || "", 120),
    endTime,
    endAt: sanitizeString(entryData.endAt || endTime || "", 120),
    lastEntryStatus: entryStatus,
    documented: true,
    lastEntryAt: FieldValue.serverTimestamp(),
    lastEntrySummary: autoDocumentationNote,
    entryCount: FieldValue.increment(1),
    activeUntilDateKey,
    lastCompletedBy: completedBy,
    lastCompletedByName: isCoolingEntry ? coolingPerformedByName : completedByName,
    completedAt: FieldValue.serverTimestamp(),
    completedBy,
    completedByName: isCoolingEntry ? coolingPerformedByName : completedByName,
    completedLate,
    overdueResolvedAt: completedLate ? FieldValue.serverTimestamp() : null,
    updatedAt: FieldValue.serverTimestamp()
  };

  if (entryStatus === "not_relevant_today" || actionType === "not_relevant_today") {
    instanceUpdate.notRelevantAt = FieldValue.serverTimestamp();
    instanceUpdate.skippedAt = FieldValue.serverTimestamp();
  }

  await taskRef.set(instanceUpdate, { merge: true });

  if (result?.shouldCreateDeviation === true) {
    const deviationTitle = sanitizeString(result.deviationTitle || "", 220);
    const deviationType = sanitizeString(result.deviationType || "task_failure", 80) || "task_failure";
    const deviationDescription = sanitizeString(result.deviationDescription || "", 500);
    const deviationData = entryData?.deviationData || {};

    let exists = false;
    const existingDeviations = await db
      .collection("deviations")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .where("taskInstanceId", "==", resolvedTaskInstanceId)
      .where("dateKey", "==", todayKey)
      .where("status", "==", "open")
      .get();

    if (!existingDeviations.empty) {
      exists = existingDeviations.docs.some((doc) => sanitizeString(doc.data()?.title || "", 220) === deviationTitle);
    }

    if (!exists) {
      await db.collection("deviations").add({
        companyId,
        organizationId: companyId,
        locationId,
        taskInstanceId: resolvedTaskInstanceId,
        templateKey: sanitizeString(deviationData.templateKey || task.templateKey || "", 120),
        deviationType,
        severity: "high",
        status: "open",
        title: deviationTitle,
        description: deviationDescription,
        failureReason: sanitizeString(deviationData.failureReason || "", 500),
        productName: sanitizeString(deviationData.productName || "", 140),
        quantityBucket: sanitizeString(deviationData.quantityBucket || "", 80),
        coolingMethod: sanitizeString(deviationData.coolingMethod || "", 80),
        coolingMethodLabel: sanitizeString(deviationData.coolingMethodLabel || "", 140),
        startTemp: deviationData.startTemp || null,
        endTemp: deviationData.endTemp || null,
        durationMinutes: deviationData.durationMinutes || null,
        startedAt: sanitizeString(deviationData.startedAt || "", 80),
        finishedAt: sanitizeString(deviationData.finishedAt || "", 80),
        correctiveActionRequired: deviationData.correctiveActionRequired === true,
        correctiveActionText: "",
        dateKey: todayKey,
        createdBy: completedBy,
        createdByName: completedByName,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      logger.info("Deviation created for cooling failure", {
        companyId,
        locationId,
        taskInstanceId: resolvedTaskInstanceId,
        deviationType,
        productName: deviationData.productName
      });
    }
  }
  
  // Legacy alert support (keep for backward compatibility)
  if (result?.shouldCreateAlert === true) {
    const alertTitle = sanitizeString(result.alertTitle || "", 220);
    const alertType = sanitizeString(result.alertType || "task_failure", 80) || "task_failure";
    const alertDescription = sanitizeString(result.alertDescription || "", 500);

    let exists = false;
    const existingAlerts = await db
      .collection("alerts")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .where("sourceTaskInstanceId", "==", resolvedTaskInstanceId)
      .where("dateKey", "==", todayKey)
      .where("status", "==", "open")
      .get();

    if (!existingAlerts.empty) {
      exists = existingAlerts.docs.some((doc) => sanitizeString(doc.data()?.title || "", 220) === alertTitle);
    }

    if (!exists) {
      await db.collection("alerts").add({
        companyId,
        organizationId: companyId,
        unitId: sanitizeString(data?.unitId || task.unitId || "", 120),
        locationId,
        alertType,
        severity: sanitizeString(task.alertSeverityOnFailure || "medium", 40) || "medium",
        status: "open",
        title: alertTitle,
        description: alertDescription,
        equipmentId: sanitizeString(task.equipmentId || "", 120),
        equipmentName: sanitizeString(task.equipmentName || "", 140),
        equipmentType: sanitizeString(task.equipmentType || "", 80),
        riskId: Array.isArray(task.linkedRiskIds) && task.linkedRiskIds.length
          ? sanitizeString(task.linkedRiskIds[0], 120)
          : "",
        sourceTaskId: sanitizeString(task.taskId || "", 120),
        sourceTaskInstanceId: resolvedTaskInstanceId,
        sourceType: "task_entry",
        sourceId: entryRef.id,
        dateKey: todayKey,
        assignedTo: completedByName,
        requiresAction: true,
        machineName: contextMachineName || sanitizeString(task.machineName || task.equipmentName || "", 140) || null,
        areaName: contextAreaName || sanitizeString(task.areaName || task.equipmentName || "", 140) || null,
        areaType: contextAreaType || sanitizeString(task.areaType || task.equipmentType || "", 80) || null,
        specificLabel: contextSpecificLabel || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  }

  return {
    ok: true,
    entryId: entryRef.id,
    taskEntryId: entryRef.id,
    taskInstanceId: resolvedTaskInstanceId,
    dateKey: todayKey,
    entryStatus,
    instanceStatus: "active",
    statusForSelectedDate: entryStatus,
    latestEntryId: entryRef.id,
    latestEntryAt: new Date().toISOString(),
    latestEntryStatus: entryStatus,
    latestEntrySummary: autoDocumentationNote,
    latestEntryByName: isCoolingEntry ? coolingPerformedByName : completedByName,
    latestMeasurement: measurementValue,
    latestComment,
    startTime,
    startAt: sanitizeString(entryData.startAt || startTime || "", 120),
    endTime,
    endAt: sanitizeString(entryData.endAt || endTime || "", 120),
    completedAt: new Date().toISOString(),
    completedByName: isCoolingEntry ? coolingPerformedByName : completedByName,
    foodItem: isCoolingEntry ? coolingFoodItem : "",
    productName: isCoolingEntry ? coolingFoodItem : "",
    performedByUid: isCoolingEntry ? coolingPerformedByUid : "",
    performedByName: isCoolingEntry ? coolingPerformedByName : "",
    activeUntilDateKey,
    entryCount: Number(task.entryCount || 0) + 1
  };
});

api.generateRisksForLocation = functions.https.onCall(async (request) => {
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

  const { generateRisksFromOnboardingAnswers } = require("../../admin/generateRisksFromOnboardingAnswers");
  const result = await generateRisksFromOnboardingAnswers({ locationId });

  return { ok: true, ...result };
});

api.generateTemplatesForLocation = functions.https.onCall(async (request) => {
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

  const { generateEgenkontrolFromRiskAnalysis } = require("../../admin/generateEgenkontrolFromRiskAnalysis");
  const result = await generateEgenkontrolFromRiskAnalysis({ locationId, db });

  return { ok: true, ...result };
});

api.manualGenerateRiskAnalysis = functions.https.onCall(async (data, context) => {
  console.log("ðŸ”¥ manualGenerateRiskAnalysis START");

  try {
    const payload =
      data?.companyId || data?.locationId
        ? data
        : data?.data?.companyId || data?.data?.locationId
          ? data.data
          : {};

    const companyId = sanitizeString(payload?.companyId || "", 120);
    const locationId = sanitizeString(payload?.locationId || "", 120);

    console.log("companyId:", companyId, "locationId:", locationId);

    if (!companyId || !locationId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "companyId og locationId er pÃ¥krÃ¦vet."
      );
    }

    // Load profile from haccp_snapshots (query by field, not doc ID)
    const snapshotQuery = await db.collection("haccp_snapshots")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .limit(1)
      .get();

    if (snapshotQuery.empty) {
      throw new functions.https.HttpsError(
        "not-found",
        `Ingen HACCP snapshot fundet for ${companyId} / ${locationId}`
      );
    }

    const snapshot = snapshotQuery.docs[0].data();
    const profile = snapshot?.profile || snapshot || {};

    console.log("ðŸ“¦ Loading buildStructuredHaccpData...");
    const { buildStructuredHaccpData } = require("../../provisioning");

    if (!buildStructuredHaccpData) {
      throw new Error("buildStructuredHaccpData not found in provisioning module");
    }

    const controlPoints = buildStructuredHaccpData(profile);
    console.log(`ðŸ“Š Generated ${controlPoints.length} control points`);

    await db
      .collection("companies")
      .doc(companyId)
      .collection("locations")
      .doc(locationId)
      .collection("risk_analysis")
      .doc("current")
      .set({
        status: "generated",
        onboardingSnapshot: profile,
        controlPoints: controlPoints,
        totalControlPoints: controlPoints.length,
        generatedBy: "manualGenerateRiskAnalysis",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

    console.log(`âœ… Risk analysis saved: ${controlPoints.length} control points`);

    return {
      ok: true,
      companyId,
      locationId,
      totalControlPoints: controlPoints.length
    };
  } catch (error) {
    console.error("âŒ manualGenerateRiskAnalysis FAILED:", error?.message);
    console.error("âŒ stack:", error?.stack || null);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      "internal",
      error?.message || "manualGenerateRiskAnalysis crashed"
    );
  }
});

api.generateCanonicalTaskTemplates = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }
  
  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);
  
  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }
  
  let ownerScopeMetadata = {};
  const locationSnap = await db.collection("companies").doc(companyId).collection("locations").doc(locationId).get();
  const companySnap = await db.collection("companies").doc(companyId).get();
  const inheritedOwnerKind = locationSnap.data()?.ownerKind || companySnap.data()?.ownerKind || "";
  if (inheritedOwnerKind) {
    ownerScopeMetadata = buildOwnerScopeMetadata(inheritedOwnerKind);
  }
  const result = await generateCanonicalTaskTemplates({ db, companyId, locationId, ownerScopeMetadata });
  
  return {
    ok: true,
    ...result
  };
});

  return api;
};
