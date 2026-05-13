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
      
      // Debug logging for schedule consistency validation
      console.log("[SCHEDULE_DEBUG]", {
        templateId: doc.id,
        taskId: scopedTaskId,
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
      
      if (!due) continue;

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
      const isCompleted = ["completed", "failed", "not_in_use"].includes(existingStatus);

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
        status: isCompleted ? existingStatus : "pending",
        completedAt: isCompleted ? existingData.completedAt || null : null,
        completedBy: isCompleted ? existingData.completedBy || "" : "",
        completedByName: isCompleted ? existingData.completedByName || "" : "",
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

  // 🔹 gem daily run
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

exports.saveRoutineTask = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind for at gemme en rutine.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const taskInstanceId = sanitizeString(data?.taskInstanceId || "", 120);
  
  logger.info("saveRoutineTask called", {
    userId: auth.uid,
    companyId,
    locationId,
    taskInstanceId
  });
  const taskIdHint = sanitizeString(data?.taskId || "", 120);
  const taskDateKeyHint = sanitizeString(data?.taskDateKey || "", 40);
  const actionType = sanitizeString(data?.actionType || "save", 60);

  if (!companyId || !locationId || !taskInstanceId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId, locationId og taskInstanceId er paakraevet.");
  }

  await assertStartDayAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  let taskRef = db.collection("task_instances").doc(taskInstanceId);
  let taskSnap = await taskRef.get();

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

  if (!taskSnap.exists) {
    logger.warn("Task instance not found", {
      userId: auth.uid,
      companyId,
      locationId,
      taskInstanceId
    });
    throw new functions.https.HttpsError("not-found", "Rutinen blev ikke fundet.");
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
  const note = sanitizeString(entryData.note || "", 2000);
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

  const todayKey = getDateKey();
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
        return `${scope} udført kl. ${timeLabel}. Måling registreret: ${measurementValue}${measurementUnit || ""}.`;
      }
      return `${scope} udført kl. ${timeLabel}. Område/maskine kontrolleret og dokumenteret.`;
    }

    return "";
  })();

  const entryPayload = {
    taskInstanceId: resolvedTaskInstanceId,
    taskId: sanitizeString(task.taskId || "", 120),
    companyId,
    organizationId: companyId,
    unitId: sanitizeString(data?.unitId || task.unitId || "", 120),
    locationId,
    taskTitle: sanitizeString(task.title || "", 220),
    taskType: sanitizeString(task.type || task.category || "", 80),
    equipmentId: sanitizeString(task.equipmentId || "", 120),
    equipmentName: sanitizeString(task.equipmentName || "", 140),
    equipmentType: sanitizeString(task.equipmentType || "", 80),
    entryType,
    measurementValue,
    measurementUnit,
    valueLabel,
    status: entryStatus,
    note: autoDocumentationNote,
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
    actionType
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

  const entryRef = await db.collection("task_entries").add(entryPayload);
  
  logger.info("Task entry created", {
    userId: auth.uid,
    companyId,
    locationId,
    taskInstanceId,
    entryId: entryRef.id,
    status: entryStatus
  });

  const instanceUpdate = {
    status: instanceStatus,
    completedAt: FieldValue.serverTimestamp(),
    completedBy,
    completedByName,
    completedLate,
    overdueResolvedAt: completedLate ? FieldValue.serverTimestamp() : null,
    updatedAt: FieldValue.serverTimestamp()
  };

  await taskRef.set(instanceUpdate, { merge: true });

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
    entryId: entryRef.id
  };
}); // Added closing brace here

exports.getDashboardSnapshot = functions.https.onCall(async (request) => {
  // Firebase Functions v2: auth is in request.auth, data is in request.data
  const data = request.data;
  const auth = request.auth;
  
  console.log("DEBUG getDashboardSnapshot - request.auth:", auth ? {
    uid: auth.uid,
    email: auth.token?.email
  } : "NULL");
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind for at hente dashboard-data.");
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const dateKey = sanitizeString(data?.dateKey || getDateKey(), 40) || getDateKey();

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
  }

  await assertStartDayAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  const [operatingOverride, tasks, alertCount, haccpSnapshot] = await Promise.all([
    getOperatingOverrideDataForLocation({ companyId, locationId }),
    loadDashboardTaskInstances({ companyId, locationId, dateKey }),
    loadDashboardAlertCount({ companyId, locationId, dateKey }),
    loadLatestHaccpSnapshot({ companyId })
  ]);

  return {
    ok: true,
    dateKey,
    operatingOverride,
    tasks,
    alertCount,
    haccpSnapshot
  };
});

exports.seedDemoData = functions.https.onCall(async (data, context) => {
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
      title: "Køleskab 1 temperatur",
      description: "Mål temperatur i køleskab 1 og udfyld målefelt.",
      type: "measurement",
      measurementUnit: "°C",
      minValue: 0,
      maxValue: 5,
      equipmentType: "fridge",
      equipmentName: "Køleskab 1"
    },
    {
      taskId: "demo_fridge_temperature_2",
      title: "Køleskab 2 temperatur",
      description: "Mål temperatur i køleskab 2 og udfyld målefelt.",
      type: "measurement",
      measurementUnit: "°C",
      minValue: 0,
      maxValue: 5,
      equipmentType: "fridge",
      equipmentName: "Køleskab 2"
    },
    {
      taskId: "demo_freezer_temperature_1",
      title: "Fryser 1 temperatur",
      description: "Mål temperatur i fryser 1 og udfyld målefelt.",
      type: "measurement",
      measurementUnit: "°C",
      minValue: -30,
      maxValue: -18,
      equipmentType: "freezer",
      equipmentName: "Fryser 1"
    },
    {
      taskId: "demo_cleaning_surface",
      title: "Rengøring af arbejdsflader",
      description: "Kontroller at arbejdsflader er rengjort og kryds af.",
      type: "check",
      equipmentType: "cleaning",
      equipmentName: "Arbejdsflader"
    },
    {
      taskId: "demo_allergen_separation",
      title: "Adskillelse af allergener",
      description: "Bekræft adskillelse mellem allergenvarer og øvrige varer.",
      type: "check",
      equipmentType: "storage",
      equipmentName: "Tørvarelager"
    },
    {
      taskId: "demo_receiving_check",
      title: "Varemodtagelse kontrol",
      description: "Kontroller emballage, temperatur og datomærkning.",
      type: "check",
      equipmentType: "receiving",
      equipmentName: "Varemodtagelse"
    },
    {
      taskId: "demo_softice_cleaning",
      title: "Softice-maskine rengøring",
      description: "Rengør softice-maskine inkl. tappetud, slanger, pakninger og drypbakke.",
      type: "check",
      equipmentType: "softice",
      equipmentName: "Softice-maskine",
      guideTitle: "Softice-maskine - rengøring af maskine og dele",
      guideIntro: "Maskinen skal adskilles og rengøres efter producentens procedure for at undgå bakterievækst.",
      guideAreas: [
        "Tappetud, pakninger, slanger, omrører og drypbakke",
        "Beholder og alle produktberørte kontaktflader",
        "Korrekt samling af alle dele efter rengøring"
      ],
      guideSteps: [
        "Stop drift, tøm produkt og adskil de dele der skal rengøres.",
        "Vask, skyl og desinficér delene efter godkendt rengøringsinstruks.",
        "Saml maskinen igen, kør test/skyl og registrér opgaven."
      ],
      guideApproval: [
        "Alle dele er synligt rene og korrekt monteret.",
        "Ingen rester af produkt eller rengøringsmiddel.",
        "Maskinen er klar til sikker drift."
      ],
      guideIfNotOk: [
        "Registrér afvigelse med hvilken del der ikke er ok.",
        "Gentag rengøring før maskinen tages i brug.",
        "Informer ansvarlig ved teknisk fejl eller manglende tæthed."
      ]
    },
    {
      taskId: "demo_oven_cleaning_and_temp",
      title: "Ovn rengøring og temperaturkontrol",
      description: "Rengør ovn og verificér at ovntemperatur er korrekt.",
      type: "measurement",
      measurementUnit: "°C",
      minValue: 160,
      maxValue: 260,
      equipmentType: "oven",
      equipmentName: "Kombiovn 1",
      guideTitle: "Ovn - rengøring og temperaturkontrol",
      guideIntro: "Ovnen skal være ren og holde den temperatur der er sat for sikker tilberedning.",
      guideAreas: [
        "Ovnrum, riste, plader, tætningslister og håndtag",
        "Temperaturvisning og evt. kernetermometer",
        "Luftcirkulation og ventilationsåbninger"
      ],
      guideSteps: [
        "Rengør ovnens indvendige flader og tilbehør.",
        "Forvarm ovnen og mål faktisk temperatur med kalibreret termometer.",
        "Indtast målingen og registrér kommentar ved afvigelse."
      ],
      guideApproval: [
        "Ovnen er fri for fastbrændte rester.",
        "Målt temperatur ligger inden for tilladt interval.",
        "Kontrollen er dokumenteret i systemet."
      ],
      guideIfNotOk: [
        "Opret afvigelse med målt temperatur og forventet værdi.",
        "Tag ovn ud af drift ved kritisk temperaturfejl.",
        "Bestil service/kalibrering."
      ]
    },
    {
      taskId: "demo_industrial_dishwasher_temp",
      title: "Industriopvaskemaskine temperaturkontrol",
      description: "Kontrollér vaske-/slutskylletemperatur og rengør filtre/dyser.",
      type: "measurement",
      measurementUnit: "°C",
      minValue: 60,
      maxValue: 90,
      equipmentType: "dishwasher",
      equipmentName: "Industriopvaskemaskine",
      guideTitle: "Industriopvaskemaskine - rengøring og temperatur",
      guideIntro: "Maskinen skal være ren, og temperaturer skal sikre hygiejnisk opvask.",
      guideAreas: [
        "Filtre, dyser, skyllearme og tank",
        "Sæbe-/afspændingsdosering",
        "Vaske- og slutskylletemperatur"
      ],
      guideSteps: [
        "Rengør filtre, dyser og tank efter daglig rutine.",
        "Kør testprogram og aflæs temperaturer.",
        "Registrér temperaturmåling og evt. afvigelse."
      ],
      guideApproval: [
        "Maskinen er rengjort uden madrester.",
        "Målt temperatur ligger inden for tilladt interval.",
        "Dokumentation er gemt."
      ],
      guideIfNotOk: [
        "Opret afvigelse med målte temperaturer.",
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
        "Læs opgaven",
        "Udfyld måling eller vælg udført",
        "Tilføj kommentar ved afvigelse"
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

exports.resetDemoData = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  

  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind.");
  }

  // CRITICAL: Block reset demo in production
  guardDangerousOperation(request, "resetDemoData");

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
  }

  await assertAdminAccess({
    uid: auth.uid,
    email: auth.token?.email || "",
    companyId,
    locationId
  });

  const snapshots = await Promise.all([
    db.collection("users").where("companyId", "==", companyId).limit(100).get(),