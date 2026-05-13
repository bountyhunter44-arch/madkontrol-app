// Temporary file - will be merged back into index.js
// This is the startDayForLocation function that was accidentally deleted

exports.startDayForLocation = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const todayKey = sanitizeString(data?.dateKey || "", 40) || new Date().toISOString().slice(0, 10);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  await assertStartDayAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  const runRef = db.collection("daily_runs").doc(`${locationId}__${todayKey}`);
  const runSnap = await runRef.get();

  const locationTemperatureSettings = await getLocationTemperatureSettings(db, companyId, locationId);

  const allTemplateDocs = await loadActiveTaskTemplates({ companyId, locationId });
  
  const hasUnitSpecificKoelFrost = allTemplateDocs.some(doc => {
    const id = doc.id || "";
    return id.includes("egenkontrol_koel_frost__") && (id.includes("fridge_") || id.includes("freezer_") || id.includes("ice_machine_"));
  });
  
  const templateDocs = allTemplateDocs.filter(doc => {
    const template = doc.data();
    const templateType = template.templateType || "operational";
    const id = doc.id || "";
    
    if (id.includes("auto_task")) return false;
    if (id.includes("kcp_") && !template.isAggregated) return false;
    
    const title = (template.title || "").toLowerCase();
    if (title.includes("kcp") && !template.isAggregated) return false;
    
    if (hasUnitSpecificKoelFrost && id.match(/egenkontrol_koel_frost$/) && !id.includes("__fridge_") && !id.includes("__freezer_") && !id.includes("__ice_machine_")) {
      console.log(`[egenkontrol] Skipping legacy generic koel_frost template: ${id}`);
      return false;
    }
    
    if (template.templateSource === "scenario_based_haccp") {
      console.log(`[egenkontrol] Skipping scenario_based_haccp template: ${id}`);
      return false;
    }
    
    if (template.haccpVersion) {
      console.log(`[egenkontrol] Skipping template with haccpVersion: ${id}`);
      return false;
    }
    
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

  if (!equipmentByType.fridge)   equipmentByType.fridge   = allEquipment.filter((x) => x.type.includes("fridge") || x.type.includes("koleskab") || x.type.includes("køleskab"));
  if (!equipmentByType.freezer)  equipmentByType.freezer  = allEquipment.filter((x) => x.type.includes("freezer") || x.type.includes("fryser"));

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
        equipmentByType.fridge = allEquipment.filter((item) => item.type.includes("fridge") || item.type.includes("koleskab") || item.type.includes("køleskab"));
      }

      if (equipmentByType.freezer.length === 0 && counts.freezers > 0) {
        equipmentByType.freezer = allEquipment.filter((item) => item.type.includes("freezer") || item.type.includes("fryser"));
      }
    } catch (error) {
      console.warn("Kunne ikke læse equipmentCounts fra onboarding_answers:", error);
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

    const templateTitle = (template.title || "").toLowerCase();
    const isCriticalControl = templateTitle.includes("nedkøling") || 
                              templateTitle.includes("varmholdelse") || 
                              templateTitle.includes("opvarmning") || 
                              templateTitle.includes("varemodtagelse");
    
    if (isCriticalControl) {
      console.log("[generator][critical-control] CHECK", {
        docId: doc.id,
        title: template.title,
        category: template.category,
        taskType: template.taskType,
        controlType: template.controlType,
        templateType: template.templateType,
        isActive: template.isActive,
        enabled: template.enabled,
        archived: template.archived,
        notInUse: template.notInUse,
        frequency: template.frequency,
        intervalDays: template.intervalDays,
        scheduleConfig: template.scheduleConfig,
        locationId: template.locationId,
        companyId: template.companyId
      });
    }

    const targets = buildStartDayTargets({
      template,
      templateDocId: doc.id,
      equipmentByType,
      allEquipment,
      areas
    });

    if (isCriticalControl && targets.length === 0) {
      console.log("[generator][critical-control] SKIPPED reason=no_targets", { docId: doc.id, title: template.title });
    }

    for (const target of targets) {
      const baseTitle = sanitizeString(template.title, 220) || "Rutine";
      const scopedTitle = (target.equipmentName && !template.equipmentId)
        ? `${baseTitle} - ${target.equipmentName}`
        : baseTitle;

      const scopedTaskId = target.suffix && target.suffix !== "default"
        ? `${baseTaskId}__${target.suffix}`
        : baseTaskId;

      const equipmentUnitId = target.equipmentId || template.equipmentUnit || template.equipmentId || "";
      const unitForTemplate = equipmentUnitId ? equipmentUnitMap.get(equipmentUnitId) : null;
      
      const resolvedSchedule = resolveTemplateSchedule({
        template,
        locationTemperatureSettings,
        unitTemperatureControl: unitForTemplate?.temperatureControl || null,
        todayKey
      });

      if (resolvedSchedule && resolvedSchedule.enabled === false) {
        disabledUnitCount++;
        if (isCriticalControl) {
          console.log("[generator][critical-control] SKIPPED reason=unit_disabled", { docId: doc.id, title: template.title });
        }
        continue;
      }

      const lastCompleted = await getLastCompleted(scopedTaskId, locationId);
      
      let due = false;
      
      // FORCE CRITICAL CONTROLS TO ALWAYS BE DUE
      if (isCriticalControl) {
        due = true;
        console.log("[generator][critical-control] FORCE DUE (bypassing schedule check)", { docId: doc.id, title: template.title });
      } else {
        // Normal schedule logic for non-critical controls
        if (resolvedSchedule && resolvedSchedule.useNewSchedule) {
          newScheduleCount++;
          const anchorDate = resolvedSchedule.anchorDate || locationTemperatureSettings?.anchorDate || todayKey;
          due = shouldRunToday(resolvedSchedule, todayKey, anchorDate, lastCompleted);
        } else {
          legacyScheduleCount++;
          due = isDueToday(template, todayKey, lastCompleted, "frequency");
        }
      }
      
      console.log("[SCHEDULE_DEBUG]", {
        templateId: doc.id,
        taskId: scopedTaskId,
        isCriticalControl,
        hasScheduleConfig: !!template.scheduleConfig,
        resolvedSchedule: resolvedSchedule ? {
          useNewSchedule: resolvedSchedule.useNewSchedule,
          enabled: resolvedSchedule.enabled,
          scheduleType: resolvedSchedule.scheduleType,
          recurrenceMode: resolvedSchedule.recurrenceMode,
          recurrenceValue: resolvedSchedule.recurrenceValue
        } : null,
        lastCompletedDateKey: lastCompleted,
        dueToday: due,
        source: "generator"
      });
      
      if (!due) {
        if (isCriticalControl) {
          console.log("[generator][critical-control] SKIPPED reason=not_due_today", { 
            docId: doc.id, 
            title: template.title,
            lastCompleted,
            resolvedSchedule: resolvedSchedule ? {
              useNewSchedule: resolvedSchedule.useNewSchedule,
              recurrenceMode: resolvedSchedule.recurrenceMode,
              recurrenceValue: resolvedSchedule.recurrenceValue
            } : null
          });
        }
        continue;
      }
      
      if (isCriticalControl) {
        console.log("[generator][critical-control] INCLUDED - creating instance", { 
          docId: doc.id, 
          title: template.title,
          instanceId: target.equipmentId ? `${doc.id}__${target.equipmentId}__${todayKey}` : `${doc.id}__${todayKey}`
        });
      }

      const registrationDue = isDueToday(template, todayKey, lastCompleted, "registrationFrequency");
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
    created: createdCount,
    updated: updatedCount,
    skipped: skippedCount,
    message: runSnap.exists
      ? `Dagens kort er opdateret (${createdCount} nye, ${updatedCount} opdateret, ${skippedCount} uændret).`
      : `Oprettet ${createdCount} opgaver`
  };
});
