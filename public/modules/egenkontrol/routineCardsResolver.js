function clean(value) {
  return String(value || "").trim();
}

function normalizeDateKey(value) {
  const text = clean(value);
  const match = text.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function dateKeyFromValue(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return normalizeDateKey(value.toDate().toISOString());
  if (value instanceof Date) return normalizeDateKey(value.toISOString());
  if (typeof value === "object" && typeof value._seconds === "number") {
    return normalizeDateKey(new Date(value._seconds * 1000).toISOString());
  }
  return normalizeDateKey(value);
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

function sourceList(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  const normalized = clean(value);
  return normalized ? [normalized] : [];
}

function uniqueList(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function isActiveDefinition(item = {}) {
  return item.archived !== true && item.disabled !== true;
}

function isPausedRoutine(item = {}) {
  return item.hiddenFromDailyView === true ||
    item.paused === true ||
    item.isPaused === true ||
    item.active === false ||
    item.isActive === false ||
    item.pauseState === "paused" ||
    item.status === "paused";
}

function hasExplicitPauseState(item = {}) {
  const status = normalizeKey(item.status);
  return status === "paused" ||
    status === "active" ||
    status === "enabled" ||
    status === "disabled" ||
    item.paused === true ||
    item.paused === false ||
    item.isPaused === true ||
    item.isPaused === false ||
    item.pauseState === "paused" ||
    item.pauseState === "active";
}

function isMasterCard(item = {}) {
  const priority = Number(item._sourcePriority || 0);
  const source = clean(item._routineCardSource || item.source || item.sourceType || item.templateSource);
  return priority >= 90 ||
    source === "task_templates" ||
    source === "verification_templates" ||
    source === "canonical_routine";
}

function stripScopedId(value = "", { companyId = "", locationId = "" } = {}) {
  return clean(value)
    .replace(companyId, "")
    .replace(locationId, "")
    .replace(/\d{4}-\d{2}-\d{2}/g, "")
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
      .filter((part) => !["canonical", "task", "instance"].includes(part.toLowerCase()));

    if (!parts.length) continue;

    return {
      routineKey: parts[0] || "",
      equipmentKey: parts.slice(1).join("__")
    };
  }

  return {
    routineKey: "",
    equipmentKey: ""
  };
}

function getRoutineKey(item = {}, context = {}) {
  const parsed = parseScopedRoutineParts(item, context);
  return clean(
    item.routineKey ||
    item.routineType ||
    item.canonicalRoutineType ||
    item.templateKey ||
    item.definitionKey ||
    parsed.routineKey ||
    item.controlType ||
    item.title ||
    item.name
  );
}

function getEquipmentKey(item = {}, context = {}) {
  const parsed = parseScopedRoutineParts(item, context);
  return clean(
    item.equipmentId ||
    item.equipmentKey ||
    item.unitId ||
    item.unitKey ||
    parsed.equipmentKey ||
    item.equipmentName ||
    item.unitName ||
    item.machineName
  );
}

function getRoutineTitleKey(item = {}) {
  return clean(item.title || item.name || item.taskTitle || item.controlPoint || "");
}

function isWeakRoutineKey(value = "") {
  return ["", "routine", "rutine", "task", "opgave", "control", "kontrol", "egenkontrol", "default"].includes(normalizeKey(value));
}

function isPlaceholderEquipmentKey(value = "") {
  return ["default", "generic", "general", "none", "null", "undefined", "na", "n_a", "all", "alle"].includes(normalizeKey(value));
}

function getIdentityEquipmentKey(item = {}, context = {}) {
  const key = getEquipmentKey(item, context);
  return isPlaceholderEquipmentKey(key) ? "" : key;
}

function getAreaKey(item = {}) {
  return clean(item.areaId || item.areaKey || item.areaName || "");
}

function getControlFallbackKey(item = {}) {
  return clean(item.controlPoint || item.category || item.type || item.controlType || "");
}

function getRiskRoutineKey(item = {}, index = 0) {
  return clean(
    item.routineKey ||
    item.taskKey ||
    item.templateKey ||
    item.canonicalRoutineType ||
    item.routineType ||
    item.taskTemplateKey ||
    (Array.isArray(item.taskTemplateKeys) ? item.taskTemplateKeys[0] : "") ||
    item.guideKey ||
    item.controlType ||
    item.category ||
    item.processKey ||
    item.process ||
    item.key ||
    item.id ||
    item.title ||
    item.name ||
    `risk_control_${index + 1}`
  );
}

function extractRiskControlPoints(riskAnalysis = {}) {
  const sources = [
    riskAnalysis?.controlPoints,
    riskAnalysis?.controls,
    riskAnalysis?.activeSnapshot?.controlPoints,
    riskAnalysis?.snapshot?.controlPoints,
    riskAnalysis?.haccpSnapshot?.controlPoints,
    riskAnalysis?.generated?.controlPoints,
    riskAnalysis?.generated?.controls,
    riskAnalysis?.onboardingSnapshot?.taskTemplates,
    riskAnalysis?.onboardingSnapshot?.templates,
    riskAnalysis?.onboardingSnapshot?.routines
  ];

  const byKey = new Map();
  sources.flatMap((value) => Array.isArray(value) ? value : []).forEach((item, index) => {
    const source = typeof item === "string" ? { title: item, name: item } : (item || {});
    const routineKey = getRiskRoutineKey(source, index);
    if (!routineKey) return;

    const key = [
      routineKey,
      source.equipmentId || source.unitId || source.equipmentName || source.unitName || "",
      source.areaId || source.areaName || ""
    ].map(normalizeKey).filter(Boolean).join("__");
    if (!key || byKey.has(key)) return;
    byKey.set(key, { ...source, _riskRoutineKey: routineKey });
  });

  return [...byKey.values()];
}

function riskControlPointToRoutineSource(controlPoint = {}, index = 0, context = {}) {
  const routineKey = getRiskRoutineKey(controlPoint, index);
  const title = clean(controlPoint.title || controlPoint.name || controlPoint.controlPoint || routineKey || "Rutine");
  const frequency = clean(controlPoint.frequency || controlPoint.frequencyType || controlPoint.interval || controlPoint.interval_days || "daily");
  const category = clean(controlPoint.category || controlPoint.type || controlPoint.group || controlPoint.controlType || "egenkontrol");
  const templateKey = clean(controlPoint.templateKey || controlPoint.taskKey || controlPoint._riskRoutineKey || routineKey);
  const id = clean(controlPoint.id || controlPoint.key || `${context.companyId || ""}__${context.locationId || ""}__risk__${normalizeKey(templateKey || title)}`);

  return {
    ...controlPoint,
    id,
    taskId: clean(controlPoint.taskId || templateKey || id),
    templateId: clean(controlPoint.templateId || controlPoint.taskTemplateId || ""),
    templateKey,
    routineKey,
    routineType: clean(controlPoint.routineType || routineKey),
    canonicalRoutineType: clean(controlPoint.canonicalRoutineType || controlPoint.routineType || routineKey),
    title,
    name: clean(controlPoint.name || title),
    category,
    controlPoint: clean(controlPoint.controlPoint || title),
    controlType: clean(controlPoint.controlType || controlPoint.guideKey || category),
    guideKey: clean(controlPoint.guideKey || controlPoint.controlType || ""),
    frequency,
    description: clean(controlPoint.description || controlPoint.longDescription || controlPoint.hazard || controlPoint.risk || ""),
    riskLevel: clean(controlPoint.riskLevel || controlPoint.severity || "medium"),
    equipmentId: clean(controlPoint.equipmentId || controlPoint.equipmentKey || controlPoint.unitId || ""),
    equipmentName: clean(controlPoint.equipmentName || controlPoint.unitName || controlPoint.machineName || ""),
    areaId: clean(controlPoint.areaId || ""),
    areaName: clean(controlPoint.areaName || ""),
    templateType: clean(controlPoint.templateType || "operational"),
    sourceType: "risk_analysis",
    templateSource: "risk_analysis",
    isActive: controlPoint.isActive !== false,
    active: controlPoint.active !== false
  };
}

export function makeRoutineCardKey(card = {}, context = {}) {
  const routineKey = getRoutineKey(card, context);
  const titleKey = getRoutineTitleKey(card);
  const identityTitleKey = isWeakRoutineKey(routineKey) ? titleKey : "";
  const equipmentKey = getIdentityEquipmentKey(card, context);
  const areaKey = getAreaKey(card);
  const controlKey = routineKey ? "" : getControlFallbackKey(card);

  return [
    context.companyId || card.companyId || card.organizationId,
    context.locationId || card.locationId,
    routineKey,
    identityTitleKey,
    equipmentKey,
    areaKey,
    controlKey
  ].map(normalizeKey).filter(Boolean).join("__");
}

function getGenericRoutineKey(card = {}, context = {}) {
  return [
    context.companyId || card.companyId || card.organizationId,
    context.locationId || card.locationId,
    getRoutineKey(card, context)
  ].map(normalizeKey).filter(Boolean).join("__");
}

function hasEquipmentScope(item = {}, context = {}) {
  return Boolean(getIdentityEquipmentKey(item, context) || getAreaKey(item));
}

function getRecordDateKeys(item = {}) {
  return uniqueList([
    dateKeyFromValue(item.dateKey),
    dateKeyFromValue(item.selectedDateKey),
    dateKeyFromValue(item.completedAt),
    dateKeyFromValue(item.completedAtClient),
    dateKeyFromValue(item.notRelevantAt),
    dateKeyFromValue(item.createdAt),
    dateKeyFromValue(item.updatedAt),
    dateKeyFromValue(item.createdAtClient),
    dateKeyFromValue(item.updatedAtClient)
  ]);
}

function isSelectedDateRecord(item = {}, selectedDate = "") {
  const dateKey = normalizeDateKey(selectedDate);
  return Boolean(dateKey && getRecordDateKeys(item).includes(dateKey));
}

function getStatusValue(item = {}) {
  return clean(item.statusForSelectedDate || item.entryStatus || item.status || item.actionType || "");
}

function getSelectedDateStatus(item = {}, selectedDate = "") {
  return isSelectedDateRecord(item, selectedDate) ? getStatusValue(item) : "";
}

function buildFallbackInstanceId(item = {}, selectedDate = "", context = {}) {
  const dateKey = normalizeDateKey(selectedDate);
  const existingId = clean(item.id || item.taskInstanceId || item.instanceId);
  if (existingId && dateKey) {
    const replaced = existingId.replace(/\d{4}[-_]\d{2}[-_]\d{2}/, dateKey);
    if (replaced !== existingId) return replaced;
  }

  const routineKey = getRoutineKey(item, context) || "routine";
  const equipmentKey = getEquipmentKey(item, context);

  return [
    normalizeKey(context.companyId || item.companyId || item.organizationId),
    normalizeKey(context.locationId || item.locationId),
    dateKey,
    normalizeKey(routineKey),
    normalizeKey(equipmentKey)
  ].filter(Boolean).join("__");
}

function toRoutineCard(source = {}, {
  context = {},
  selectedDate = "",
  sourceName = "unknown",
  virtual = false,
  sourcePriority = 0
} = {}) {
  const routineKey = getRoutineKey(source, context);
  const equipmentKey = getEquipmentKey(source, context);
  const dateKey = normalizeDateKey(selectedDate) || normalizeDateKey(source.dateKey);
  const concreteId = clean(source.id || source.taskInstanceId || source.instanceId);
  const id = virtual ? buildFallbackInstanceId(source, dateKey, context) : concreteId || buildFallbackInstanceId(source, dateKey, context);
  const selectedDateStatus = getSelectedDateStatus(source, dateKey);

  return {
    ...source,
    id,
    taskInstanceId: id,
    taskId: clean(source.taskId || source.templateId || source.id || routineKey),
    templateId: clean(source.templateId || source.id || source.taskId),
    templateKey: clean(source.templateKey || routineKey),
    routineKey,
    routineType: clean(source.routineType || routineKey),
    canonicalRoutineType: clean(source.canonicalRoutineType || source.routineType || routineKey),
    title: clean(source.title || source.name || source.taskTitle || source.controlPoint || routineKey || "Rutine"),
    name: clean(source.name || source.title || source.taskTitle || source.controlPoint || routineKey || "Rutine"),
    category: clean(source.category || source.type || "egenkontrol"),
    controlPoint: clean(source.controlPoint || source.category || source.type || ""),
    frequency: clean(source.frequency || source.frequencyType || source.interval_days || "daily"),
    equipmentId: clean(source.equipmentId || source.equipmentKey || source.unitId || equipmentKey),
    equipmentName: clean(source.equipmentName || source.unitName || source.machineName || ""),
    dateKey,
    status: clean(source.status || "pending"),
    source: sourceName,
    sourceType: clean(source.sourceType || source.templateSource || source.source || sourceName),
    sources: uniqueList([...sourceList(source.sources), sourceName]),
    canOpenCard: true,
    linkedTemplateId: clean(source.templateId || source.id || source.taskId),
    linkedInstanceId: virtual ? clean(source.linkedInstanceId) : concreteId,
    _routineCardSource: sourceName,
    _sourcePriority: sourcePriority,
    _needsLazyInstance: virtual || !concreteId,
    _routineCardKey: makeRoutineCardKey(source, context),
    _pausedBySource: isPausedRoutine(source),
    _selectedDateStatus: selectedDateStatus,
    _selectedDateAt: selectedDateStatus ? dateKey : ""
  };
}

function hasRealValue(value) {
  return value !== "" && value !== null && value !== undefined;
}

function pickLatestValue(existingValue, incomingValue) {
  return hasRealValue(existingValue) ? existingValue : incomingValue;
}

const AUDIT_FIELD_NAMES = [
  "createdAt",
  "createdAtClient",
  "createdBy",
  "createdByUid",
  "createdByName",
  "createdByEmail",
  "updatedAt",
  "updatedAtClient",
  "updatedBy",
  "updatedByUid",
  "updatedByName",
  "updatedByEmail",
  "completedAt",
  "completedAtClient",
  "completedBy",
  "completedByUid",
  "completedByName",
  "completedByEmail",
  "notRelevantAt",
  "notRelevantBy",
  "notRelevantByName",
  "lastCompletedBy",
  "lastCompletedByName"
];

function pickFirstReal(...values) {
  return values.find(hasRealValue);
}

function copyAuditFields(...sources) {
  const result = {};
  for (const field of AUDIT_FIELD_NAMES) {
    const value = pickFirstReal(...sources.map((source) => source?.[field]));
    if (hasRealValue(value)) result[field] = value;
  }
  return result;
}

function buildLatestEntrySnapshot(record = {}) {
  if (!record) {
    return {
      at: null,
      status: "",
      summary: ""
    };
  }

  return {
    at: record.latestEntryAt || record.lastEntryAt || record.completedAt || record.completedAtClient || record.notRelevantAt || record.createdAt || record.updatedAt || record.createdAtClient || null,
    status: record.latestEntryStatus || record.lastEntryStatus || record.statusForSelectedDate || record.entryStatus || record.status || record.actionType || "",
    summary: record.latestEntrySummary || record.lastEntrySummary || record.note || record.comment || record.valueLabel || record.status || "",
    byName: record.latestEntryByName || record.completedByName || record.createdByName || "",
    measurement: record.latestMeasurement ?? record.measurementValue ?? null,
    comment: record.latestComment || record.comment || "",
    ...copyAuditFields(record)
  };
}

function mergeRoutineCards(existing, incoming) {
  if (!existing) return incoming;

  const incomingWins = Number(incoming._sourcePriority || 0) > Number(existing._sourcePriority || 0);
  const base = incomingWins ? incoming : existing;
  const secondary = incomingWins ? existing : incoming;
  const selectedConcrete = incoming._needsLazyInstance === false ? incoming : existing._needsLazyInstance === false ? existing : null;
  const selectedDateStatus = clean(incoming._selectedDateStatus || existing._selectedDateStatus);
  const selectedDateAt = clean(incoming._selectedDateAt || existing._selectedDateAt);
  const selectedAuditSource = incoming._selectedDateStatus ? incoming : existing._selectedDateStatus ? existing : null;
  const latestAt = pickLatestValue(existing.latestEntryAt || existing.lastEntryAt, incoming.latestEntryAt || incoming.lastEntryAt);
  const latestStatus = pickLatestValue(existing.latestEntryStatus || existing.lastEntryStatus, incoming.latestEntryStatus || incoming.lastEntryStatus);
  const latestSummary = pickLatestValue(existing.latestEntrySummary || existing.lastEntrySummary, incoming.latestEntrySummary || incoming.lastEntrySummary);
  const masterControlsPause = isMasterCard(base) && hasExplicitPauseState(base);
  const hiddenFromDailyView = masterControlsPause
    ? isPausedRoutine(base)
    : (base.hiddenFromDailyView !== undefined ? base.hiddenFromDailyView : secondary.hiddenFromDailyView);
  const pausedBySource = masterControlsPause ? isPausedRoutine(base) : isPausedRoutine(base);

  return {
    ...secondary,
    ...base,
    sources: uniqueList([...sourceList(existing.sources), ...sourceList(incoming.sources), existing._routineCardSource, incoming._routineCardSource]),
    entryCount: Math.max(Number(existing.entryCount || 0), Number(incoming.entryCount || 0)),
    latestEntryId: pickLatestValue(existing.latestEntryId, incoming.latestEntryId),
    latestEntryAt: latestAt || null,
    latestEntryStatus: latestStatus || "",
    latestEntrySummary: latestSummary || "",
    latestEntryByName: pickLatestValue(existing.latestEntryByName, incoming.latestEntryByName),
    latestMeasurement: pickLatestValue(existing.latestMeasurement, incoming.latestMeasurement),
    latestComment: pickLatestValue(existing.latestComment, incoming.latestComment),
    lastEntryAt: latestAt || null,
    lastEntryStatus: latestStatus || "",
    lastEntrySummary: latestSummary || "",
    ...copyAuditFields(selectedAuditSource, incoming.latestEntry, existing.latestEntry, incoming, existing, base, secondary),
    status: selectedDateStatus || base.status || secondary.status || "pending",
    statusForSelectedDate: selectedDateStatus || base.statusForSelectedDate || secondary.statusForSelectedDate || base.status || "pending",
    latestEntry: {
      at: latestAt || existing.latestEntry?.at || incoming.latestEntry?.at || null,
      status: latestStatus || existing.latestEntry?.status || incoming.latestEntry?.status || "",
      summary: latestSummary || existing.latestEntry?.summary || incoming.latestEntry?.summary || "",
      byName: existing.latestEntryByName || incoming.latestEntryByName || existing.latestEntry?.byName || incoming.latestEntry?.byName || "",
      measurement: existing.latestMeasurement ?? incoming.latestMeasurement ?? existing.latestEntry?.measurement ?? incoming.latestEntry?.measurement ?? null,
      comment: existing.latestComment || incoming.latestComment || existing.latestEntry?.comment || incoming.latestEntry?.comment || "",
      ...copyAuditFields(selectedAuditSource, incoming.latestEntry, existing.latestEntry, incoming, existing)
    },
    id: selectedConcrete?.id || base.id,
    taskInstanceId: selectedConcrete?.taskInstanceId || base.taskInstanceId,
    linkedInstanceId: selectedConcrete?.linkedInstanceId || base.linkedInstanceId || secondary.linkedInstanceId || "",
    linkedTemplateId: base.linkedTemplateId || secondary.linkedTemplateId || "",
    _needsLazyInstance: selectedConcrete ? false : (existing._needsLazyInstance && incoming._needsLazyInstance),
    _sourcePriority: Math.max(Number(existing._sourcePriority || 0), Number(incoming._sourcePriority || 0)),
    _routineCardSource: base._routineCardSource,
    hiddenFromDailyView,
    _pausedBySource: pausedBySource,
    _selectedDateStatus: selectedDateStatus,
    _selectedDateAt: selectedDateAt
  };
}

function getRecordTimestamp(item = {}) {
  if (!item) return 0;

  const candidates = [
    item.completedAt,
    item.createdAt,
    item.updatedAt,
    item.createdAtClient,
    item.updatedAtClient,
    item.dateKey
  ];

  for (const value of candidates) {
    if (!value) continue;
    if (typeof value.toDate === "function") return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === "object" && typeof value._seconds === "number") return value._seconds * 1000;
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function summarizeHistory(entries = [], context = {}, selectedDate = "") {
  const summaryByKey = new Map();

  for (const entry of entries) {
    const key = makeRoutineCardKey(entry, context);
    if (!key) continue;

    const current = summaryByKey.get(key) || { latest: null, selected: null };
    const entryTime = getRecordTimestamp(entry);
    const latestTime = getRecordTimestamp(current.latest);
    if (!current.latest || entryTime >= latestTime) {
      current.latest = entry;
    }

    if (isSelectedDateRecord(entry, selectedDate)) {
      const selectedTime = getRecordTimestamp(current.selected);
      if (!current.selected || entryTime >= selectedTime) current.selected = entry;
    }

    summaryByKey.set(key, current);
  }

  return summaryByKey;
}

function createDedupState() {
  return {
    rawCardsBeforeDedup: 0,
    fallbackAdded: 0,
    duplicatesMerged: 0,
    duplicatesSkipped: 0,
    duplicateSamples: []
  };
}

function logDedupSample(state, label, key, existing, incoming) {
  if (state.duplicateSamples.length >= 20) return;

  const sample = {
    key,
    existingSource: existing?._routineCardSource,
    incomingSource: incoming?._routineCardSource,
    existingTitle: existing?.title,
    incomingTitle: incoming?.title,
    existingId: existing?.id,
    incomingId: incoming?.id
  };
  state.duplicateSamples.push(sample);
  console.log(label, sample);
}

function addRoutineCard(cards, card, {
  state,
  fallback = false
} = {}) {
  const key = card._routineCardKey || makeRoutineCardKey(card);
  if (!key) return false;

  state.rawCardsBeforeDedup += 1;
  const existing = cards.get(key);

  if (!existing) {
    cards.set(key, {
      ...card,
      _routineCardKey: key
    });
    if (fallback) state.fallbackAdded += 1;
    return true;
  }

  const merged = mergeRoutineCards(existing, card);
  cards.set(key, {
    ...merged,
    _routineCardKey: key
  });
  state.duplicatesMerged += 1;
  logDedupSample(state, "[routine resolver merged duplicate]", key, existing, card);
  return false;
}

export function resolveRoutineCardsForLocation({
  companyId = "",
  locationId = "",
  selectedDate = "",
  riskAnalysis = null,
  taskTemplates = [],
  verificationTemplates = [],
  taskInstances = [],
  verificationInstances = [],
  history = []
} = {}) {
  const dateKey = normalizeDateKey(selectedDate);
  const context = { companyId, locationId };
  const riskRoutineSources = extractRiskControlPoints(riskAnalysis);
  const rawInputCount = taskTemplates.length +
    verificationTemplates.length +
    riskRoutineSources.length +
    taskInstances.length +
    verificationInstances.length +
    history.length;
  const cards = new Map();
  const state = createDedupState();
  const concreteGenericKeys = new Set();

  for (const instance of [...taskInstances, ...verificationInstances]) {
    if (!isActiveDefinition(instance)) continue;
    if (hasEquipmentScope(instance, context)) {
      concreteGenericKeys.add(getGenericRoutineKey(instance, context));
    }
  }

  for (const template of taskTemplates) {
    if (!isActiveDefinition(template)) continue;

    const genericKey = getGenericRoutineKey(template, context);
    const skipGenericTemplate = !hasEquipmentScope(template, context) && concreteGenericKeys.has(genericKey);
    if (skipGenericTemplate) {
      state.rawCardsBeforeDedup += 1;
      state.duplicatesSkipped += 1;
      const skipped = toRoutineCard(template, {
        context,
        selectedDate: dateKey,
        sourceName: template.templateSource || "task_templates",
        virtual: true,
        sourcePriority: 100
      });
      logDedupSample(state, "[routine resolver dedup] skipped duplicate", genericKey, null, skipped);
      continue;
    }

    addRoutineCard(cards, toRoutineCard(template, {
      context,
      selectedDate: dateKey,
      sourceName: template.templateSource || "task_templates",
      virtual: true,
      sourcePriority: 100
    }), { state });
  }

  for (const template of verificationTemplates) {
    if (!isActiveDefinition(template)) continue;

    addRoutineCard(cards, toRoutineCard(template, {
      context,
      selectedDate: dateKey,
      sourceName: "verification_templates",
      virtual: true,
      sourcePriority: 90
    }), { state });
  }

  for (let index = 0; index < riskRoutineSources.length; index += 1) {
    const source = riskControlPointToRoutineSource(riskRoutineSources[index], index, context);
    if (!isActiveDefinition(source)) continue;

    addRoutineCard(cards, toRoutineCard(source, {
      context,
      selectedDate: dateKey,
      sourceName: "risk_analysis",
      virtual: true,
      sourcePriority: 80
    }), { state });
  }

  for (const instance of taskInstances) {
    if (!isActiveDefinition(instance)) continue;

    const selectedDateInstance = normalizeDateKey(instance.dateKey) === dateKey;
    addRoutineCard(cards, toRoutineCard(instance, {
      context,
      selectedDate: dateKey,
      sourceName: selectedDateInstance ? "task_instances_selected_date" : "task_instances_history",
      virtual: !selectedDateInstance,
      sourcePriority: selectedDateInstance ? 70 : 40
    }), { state });
  }

  for (const instance of verificationInstances) {
    if (!isActiveDefinition(instance)) continue;

    const selectedDateInstance = normalizeDateKey(instance.dateKey) === dateKey;
    addRoutineCard(cards, toRoutineCard(instance, {
      context,
      selectedDate: dateKey,
      sourceName: selectedDateInstance ? "verification_instances_selected_date" : "verification_instances_history",
      virtual: !selectedDateInstance,
      sourcePriority: selectedDateInstance ? 65 : 35
    }), { state });
  }

  const latestHistory = summarizeHistory(history, context, dateKey);
  for (const [key, summary] of latestHistory.entries()) {
    const entry = summary.selected || summary.latest;
    if (!entry) continue;

    const selectedDateEntry = Boolean(summary.selected);
    const historyCard = toRoutineCard(entry, {
      context,
      selectedDate: dateKey,
      sourceName: selectedDateEntry ? "task_entries_selected_date" : "task_entries_history",
      virtual: true,
      sourcePriority: selectedDateEntry ? 75 : 10
    });
    const latestEntry = summary.latest || entry;
    historyCard.lastEntryAt = latestEntry.completedAt || latestEntry.createdAt || latestEntry.updatedAt || null;
    historyCard.lastEntryStatus = latestEntry.status || latestEntry.entryStatus || "";
    historyCard.lastEntrySummary = latestEntry.note || latestEntry.comment || latestEntry.status || "";
    historyCard.latestEntry = buildLatestEntrySnapshot(latestEntry);
    Object.assign(historyCard, copyAuditFields(entry, latestEntry));
    historyCard.entryCount = 1;
    historyCard._routineCardKey = key;

    addRoutineCard(cards, historyCard, { state, fallback: true });
  }

  const resolved = [...cards.values()].map((card) => {
    const selectedDateStatus = clean(card._selectedDateStatus || card.statusForSelectedDate);
    const effectiveStatus = selectedDateStatus || card.status || "pending";

    return {
      ...card,
      companyId: card.companyId || companyId,
      organizationId: card.organizationId || companyId,
      locationId: card.locationId || locationId,
      selectedDateKey: dateKey,
      status: effectiveStatus,
      statusForSelectedDate: effectiveStatus,
      latestEntry: {
        at: card.latestEntryAt || card.lastEntryAt || card.latestEntry?.at || null,
        status: card.latestEntryStatus || card.lastEntryStatus || card.latestEntry?.status || "",
        summary: card.latestEntrySummary || card.lastEntrySummary || card.latestEntry?.summary || "",
        byName: card.latestEntryByName || card.latestEntry?.byName || "",
        measurement: card.latestMeasurement ?? card.latestEntry?.measurement ?? null,
        comment: card.latestComment || card.latestEntry?.comment || "",
        ...copyAuditFields(card.latestEntry, card)
      },
      ...copyAuditFields(card)
    };
  });

  const pausedCount = resolved.filter(isPausedRoutine).length;
  const activeCount = resolved.length - pausedCount;

  console.log("[routine resolver raw]", {
    companyId,
    locationId,
    selectedDate: dateKey,
    riskControlPoints: riskRoutineSources.length,
    taskTemplates: taskTemplates.length,
    verificationTemplates: verificationTemplates.length,
    taskInstances: taskInstances.length,
    verificationInstances: verificationInstances.length,
    history: history.length,
    resolvedCards: resolved.length,
    lazyCards: resolved.filter((card) => card._needsLazyInstance).length
  });

  console.log("[routine resolver dedup]", {
    duplicatesMerged: state.duplicatesMerged,
    duplicatesSkipped: state.duplicatesSkipped,
    duplicateSamples: state.duplicateSamples.slice(0, 5)
  });

  console.log("[routine resolver result]", {
    active: activeCount,
    paused: pausedCount,
    fallbackAdded: state.fallbackAdded,
    duplicatesMerged: state.duplicatesMerged,
    duplicatesSkipped: state.duplicatesSkipped,
    rawCardsBeforeDedup: rawInputCount,
    processedCandidates: state.rawCardsBeforeDedup,
    finalTotal: resolved.length
  });

  return resolved;
}
