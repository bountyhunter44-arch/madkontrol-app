  // Generate comprehensive HACCP with all 7 KCPs (legacy)
  const comprehensiveHaccp = generateComprehensiveHaccp({
    profile: sanitizedProfile,
    companyType: sanitizedProfile.companyType
  });

  // Generate task templates from KCPs (legacy)
  const generatedTasks = generateTaskTemplatesFromKcps(comprehensiveHaccp.kcps);

  // Generate scenario-based HACCP (new motor)
  const scenarioHaccp = generateScenarioBasedHaccp({
    profile: sanitizedProfile,
    companyType: sanitizedProfile.companyType
  });

  // Transform risk analysis hazards to routine templates using controls field

  // Derive legacy fields from new motor (preserve object shape)
  const derivedHazards = scenarioHaccp.hazards.map(h => ({
    name: h.title || "",
    riskLevel: h.riskLevel || "medium",
    control: h.controlMeasure || "",
    frequency: h.monitoring?.frequency || "daily"
  }));
  const derivedControls = [...new Set(scenarioHaccp.hazards.map(h => h.controlMeasure).filter(Boolean))];
  const derivedTasks = scenarioHaccp.taskTemplates.map(t => t.title);

  return {
    documentType: "lovpligtig_risikoanalyse_haccp",
    title: `Lovpligtig Risikoanalyse & HACCP for ${sanitizedProfile.companyName || "Virksomhed"}`,
    organizationId: companyId,
    companyId,
    locationId,
    createdBy: userId,
    companyName: sanitizedProfile.companyName,
    cvr: sanitizedProfile.cvr,
    address: normalizedAddress,
    companyType: sanitizedProfile.companyType,
    profile: {
      ...sanitizedProfile,
      address: sanitizedProfile.address,
      zip: sanitizedProfile.zip,
      city: sanitizedProfile.city,
      suppliers: sanitizedRiskModel.suppliers.length ? sanitizedRiskModel.suppliers : sanitizedProfile.suppliers
    },
    // NEW: Scenario-based HACCP structure (v3.0)
    haccp: {
      version: scenarioHaccp.version,
      scenarios: scenarioHaccp.scenarios,
      processes: scenarioHaccp.processes,
      hazards: scenarioHaccp.hazards,
      verificationTasks: scenarioHaccp.verificationTasks,
      documentationRequirements: scenarioHaccp.documentationRequirements,
      taskTemplates: scenarioHaccp.taskTemplates,
      summary: scenarioHaccp.summary,
      // Legacy KCP structure for backward compatibility
      kcps: comprehensiveHaccp.kcps,
      generatedTasks: generatedTasks,
      totalKcps: comprehensiveHaccp.summary.totalKcps
    },
    // LEGACY: Keep old structure for backwards compatibility
    generated: {
      hazards: sanitizedRiskModel.hazards.length ? sanitizedRiskModel.hazards : derivedHazards,
      controls: sanitizedRiskModel.controls.length ? sanitizedRiskModel.controls : derivedControls,
      tasks: sanitizedRiskModel.tasks.length ? sanitizedRiskModel.tasks : derivedTasks,
      suppliers: sanitizedRiskModel.suppliers.length ? sanitizedRiskModel.suppliers : sanitizedProfile.suppliers
    },
    status: "generated",
    source: "onboarding",
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: now.toISOString(),
    createdAtEpochMs: now.getTime()
  };
}

function removeUndefinedFields(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)).filter(item => item !== undefined);
  }
  
  const cleaned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (value !== undefined) {
        cleaned[key] = removeUndefinedFields(value);
      }
    }
  }
  return cleaned;
}

async function createHaccpSnapshotDocument({ profile = {}, riskModel = {}, companyId, locationId, userId }) {
  const payload = buildHaccpSnapshotPayload({
    profile,
    riskModel,
    companyId,
    locationId,
    userId
  });

  // Remove undefined fields to prevent Firestore errors
  const cleanedPayload = removeUndefinedFields(payload);

  const docRef = await db.collection("haccp_snapshots").add(cleanedPayload);
  
  // Create egenkontrol_programs document to enable operational task generation
  const programId = `${companyId}__${locationId}`;
  const programRef = db.collection("egenkontrol_programs").doc(programId);
  
  await programRef.set({
    companyId,
    locationId,
    organizationId: companyId,
    personalisering: {
      antalKoeleskabe: parseInt(profile.antalKoeleskabe || 0, 10),
      antalFrysere: parseInt(profile.antalFrysere || 0, 10),
      tilberederVarmMad: profile.tilberederVarmMad || false,
      nedkoelerMad: profile.nedkoelerMad || false,
      varmholder: profile.varmholder || false
    },
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  
  return {
    snapshotId: docRef.id,
    payload: cleanedPayload,
    activatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function upsertOnboardingAnswersDocument({ companyId, locationId, userId, liveProfilePayload }) {
  const onboardingDocId = toDocSafeId(`${companyId}__${locationId}__onboarding`);
  const onboardingRef = db.collection("onboarding_answers").doc(onboardingDocId);
  const answers = liveProfilePayload.onboardingAnswers || {};

  await onboardingRef.set({
    companyId,
    locationId,
    organizationId: companyId,
    businessTypes: toArray(answers.businessTypes),
    processes: toArray(answers.processes),
    ingredients: toArray(answers.ingredients),
    serviceTypes: toArray(answers.serviceTypes),
    specialConditions: toArray(answers.specialConditions),
    areas: toArray(answers.areas),
    equipmentCounts: answers.equipmentCounts || {},
    cloudinaryAssets: toArray(answers.cloudinaryAssets),
    createdBy: sanitizeString(userId, 120),
    source: "onboarding_checkout",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return onboardingDocId;
}

function resolveOperatingMode(data, todayKey) {
  if (!data || data.isActive === false) return "open";

  const untilDateKey =
    normalizeDateKey(data.untilDateKey) ||
    normalizeDateKey(data.until) ||
    normalizeDateKey(data.endDate);

  const stillValid = !untilDateKey || todayKey <= untilDateKey;
  if (!stillValid) return "open";

  if (data.closed === true) return "closed";
  if (data.vacation === true) return "vacation";
  return "open";
}

async function getOperatingModeForLocation({ companyId, locationId, todayKey }) {
  const queries = [
    db.collection("operating_overrides")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .limit(1),
    db.collection("operating_overrides")
      .where("locationId", "==", locationId)
      .limit(1)
  ];

  for (const q of queries) {
    const snap = await q.get();
    if (snap.empty) continue;

    const mode = resolveOperatingMode(snap.docs[0].data() || {}, todayKey);
    if (mode !== "open") return mode;
  }

  return "open";
}

function resolveLexiStatus({ operatingMode, totalActive, dueToday }) {
  if (operatingMode === "closed") return "lukket";
  if (operatingMode === "vacation") return "ferie";
  if (totalActive <= 0) return "ingen_rutiner";
  if (dueToday > 0) return "mangler_opgaver";
  return "opdateret";
}

function getUserLocationIds(userData) {
  const ids = [];
  if (Array.isArray(userData?.locationIds)) {
    for (const value of userData.locationIds) {
      const id = sanitizeString(value, 120);
      if (id) ids.push(id);
    }
  }

  const primaryLocationId = sanitizeString(
    userData?.primaryLocationId || userData?.locationId,
    120
  );
  if (primaryLocationId) ids.push(primaryLocationId);

  return [...new Set(ids)];
}

function isDemoScopedId(value) {
  return sanitizeString(value, 120).toLowerCase().includes("demo");
}

function buildPreferredLocationIds(userData, preferredLocationId = "") {
  const existingIds = getUserLocationIds(userData);
  const normalizedPreferred = sanitizeString(preferredLocationId, 120);
  const hasLivePreferred = normalizedPreferred && !isDemoScopedId(normalizedPreferred);

  const preservedIds = hasLivePreferred
    ? existingIds.filter((item) => !isDemoScopedId(item))
    : existingIds;

  if (normalizedPreferred && !preservedIds.includes(normalizedPreferred)) {
    preservedIds.push(normalizedPreferred);
  }

  return [...new Set(preservedIds.filter(Boolean))];
}

async function getUserAccessProfile({ uid, email }) {
  const byUid = await db.collection("users").doc(uid).get();
  if (byUid.exists) {
    return byUid.data() || {};
  }

  const normalizedEmail = sanitizeString(email, 160).toLowerCase();
  if (!normalizedEmail) return null;

  const byEmail = await db
    .collection("users")
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (byEmail.empty) return null;
  return byEmail.docs[0].data() || {};
}

async function assertLexiCustomerAccess({ uid, email, companyId, locationId }) {
  const userData = await getUserAccessProfile({ uid, email });
  if (!userData) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Brugerprofil blev ikke fundet."
    );
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
  if (!userCompanyId || userCompanyId !== companyId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Adgang til companyId afvist."
    );
  }

  const locationIds = getUserLocationIds(userData);
  if (locationIds.length > 0 && !locationIds.includes(locationId)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Adgang til locationId afvist."
    );
  }
}

async function assertStartDayAccess({ uid, email, companyId, locationId }) {
  const userData = await getUserAccessProfile({ uid, email });
  if (!userData) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Brugerprofil blev ikke fundet."
    );
  }

  const role = sanitizeString(userData.role || "", 80).toLowerCase();
  const allowedRoles = ["owner", "hq_admin", "location_manager", "admin", "manager", "employee", "super-admin"];
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Brugerrolle maa ikke starte dagen."
    );
  }

  // Super-admin can access any company/location (for impersonation)
  const isSuperAdmin = role === "super-admin";
  if (isSuperAdmin) {
    return;
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
  if (!userCompanyId || userCompanyId !== companyId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Adgang til companyId afvist."
    );
  }

  const allowedLocationIds = getUserLocationIds(userData);

  // OWNER override: owners can always access their own location
  const isOwner =
    role === "owner" &&
    (
      userData.locationId === locationId ||
      userData.primaryLocationId === locationId ||
      (userData.locationIds || []).includes(locationId)
    );

  // Debug logging
  console.log("[AUTH CHECK startDayForLocation]", {
    uid,
    role,
    locationId,
    allowedLocationIds,
    isOwner,
    isSuperAdmin
  });

  if (!isSuperAdmin && !isOwner && !allowedLocationIds.includes(locationId)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Adgang til locationId afvist."
    );
  }
}

async function assertAdminAccess({ uid, email, companyId, locationId }) {
  const userData = await getUserAccessProfile({ uid, email });
  if (!userData) {
    throw new functions.https.HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
  }

  const role = sanitizeString(userData.role || "", 80).toLowerCase();
  const allowedRoles = ["owner", "hq_admin", "location_manager", "admin", "super-admin"];
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError("permission-denied", "Kun admin maa udfoere denne handling.");
  }

  // Super-admin can access any company/location (for impersonation)
  if (role === "super-admin") {
    return;
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
  if (!userCompanyId || userCompanyId !== companyId) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til companyId afvist.");
  }

  const locationIds = getUserLocationIds(userData);
  if (locationIds.length > 0 && !locationIds.includes(locationId)) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til locationId afvist.");
  }
}

async function assertSeoGeneratorAccess({ uid, email, companyId, locationId }) {
  const userData = await getUserAccessProfile({ uid, email });
  if (!userData) {
    throw new functions.https.HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
  }

  const role = sanitizeString(userData.role || "", 80).toLowerCase();
  const allowedRoles = ["owner", "hq_admin", "location_manager", "admin", "manager", "employee", "customer", "signup", "onboarding", "onboarding_user", "pending"];
  if (role && !allowedRoles.includes(role)) {
    throw new functions.https.HttpsError("permission-denied", "Brugerrolle maa ikke bruge SEO-generatoren.");
  }

  const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
  if (!userCompanyId || userCompanyId !== companyId) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til companyId afvist.");
  }

  const locationIds = getUserLocationIds(userData);
  if (locationIds.length > 0 && !locationIds.includes(locationId)) {
    throw new functions.https.HttpsError("permission-denied", "Adgang til locationId afvist.");
  }
}

function normalizeEmploymentRole(value) {
  const raw = sanitizeString(value, 80).toLowerCase();
  if (raw === "ansat") return "ansat";
  if (raw === "employee" || raw === "medarbejder") return "medarbejder";
  return "medarbejder";
}

function buildScopedUserResponse(userId, data = {}) {
  const locationIds = getUserLocationIds(data);
  const createdAt = data?.createdAt && typeof data.createdAt.toDate === "function"
    ? data.createdAt.toDate().toISOString()
    : null;

  return {
    userId,
    displayName: sanitizeString(data.displayName || data.name || "", 160),
    email: sanitizeString(data.email || "", 160).toLowerCase(),
    role: sanitizeString(data.role || "employee", 80).toLowerCase() || "employee",
    employmentRole: normalizeEmploymentRole(data.employmentRole || data.roleLabel || data.role),
    companyId: sanitizeString(data.companyId || data.organizationId || "", 120),
    primaryLocationId: sanitizeString(data.primaryLocationId || data.locationId || "", 120),
    locationIds,
    createdAt,
    status: sanitizeString(data.status || "active", 60).toLowerCase() || "active"
  };
}

function toDocSafeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function deleteScopedCollectionDocs({ collectionName, companyId, locationId }) {
  const refsByPath = new Map();
  const variantQueries = [
    db.collection(collectionName)
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId),
    db.collection(collectionName)
      .where("organizationId", "==", companyId)
      .where("locationId", "==", locationId)
  ];

  for (const q of variantQueries) {
    const snap = await q.get();
    for (const doc of snap.docs) {
      refsByPath.set(doc.ref.path, doc.ref);
    }
  }

  const refs = Array.from(refsByPath.values());
  if (!refs.length) return 0;

  let deleted = 0;
  for (let i = 0; i < refs.length; i += 450) {
    const chunk = refs.slice(i, i + 450);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

async function loadActiveTaskTemplates({ companyId, locationId }) {
  const refsByPath = new Map();
  const variants = [
    { companyField: "companyId", companyValue: companyId, locationValue: locationId },
    { companyField: "organizationId", companyValue: companyId, locationValue: locationId },
    { companyField: "companyId", companyValue: companyId, locationValue: toLegacyId(locationId) },
    { companyField: "organizationId", companyValue: companyId, locationValue: toLegacyId(locationId) }
  ].filter((variant) => variant.companyValue && variant.locationValue);

  for (const variant of variants) {
    const normalizedCompanyValue = sanitizeString(variant.companyValue, 120);
    const normalizedLocationValue = sanitizeString(variant.locationValue, 120);
    if (!normalizedCompanyValue || !normalizedLocationValue) continue;

    const snapshot = await db
      .collection("task_templates")
      .where(variant.companyField, "==", normalizedCompanyValue)
      .where("locationId", "==", normalizedLocationValue)
      .get();

    for (const doc of snapshot.docs) {
      refsByPath.set(doc.ref.path, doc);
    }
  }

  return Array.from(refsByPath.values()).filter((doc) => {
    const data = doc.data() || {};
    if (data.isActive === false) return false;
    if (data.active === false) return false;
    return true;
  });
}

async function getExistingTaskInstanceMap({ companyId, locationId, todayKey }) {
  const snapshot = await db
    .collection("task_instances")
    .where("locationId", "==", locationId)
    .where("dateKey", "==", todayKey)
    .get();

  const taskMap = new Map();

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const organizationId = sanitizeString(data.companyId || data.organizationId, 120);
    if (companyId && organizationId && organizationId !== companyId) continue;

    // Nøglen er doc.id — kompatibel med nyt templateDocId__[equipmentId__]dateKey skema
    taskMap.set(doc.id, {
      ref: doc.ref,
      data
    });
  }

  return taskMap;
}

async function getOperatingOverrideDataForLocation({ companyId, locationId }) {
  const snapshot = await db
    .collection("operating_overrides")
    .where("locationId", "==", locationId)
    .limit(10)
    .get();

  if (snapshot.empty) return null;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const organizationId = sanitizeString(data.companyId || data.organizationId, 120);
    if (companyId && organizationId && organizationId !== companyId) continue;

    return {
      id: doc.id,
      ...data
    };
  }

  return null;
}

async function loadDashboardTaskInstances({ companyId, locationId, dateKey }) {
  const snapshot = await db
    .collection("task_instances")
    .where("locationId", "==", locationId)
    .where("dateKey", "==", dateKey)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((item) => {
      const organizationId = sanitizeString(item.companyId || item.organizationId, 120);
      return !companyId || !organizationId || organizationId === companyId;
    });
}

async function loadDashboardAlertCount({ companyId, locationId, dateKey }) {
  const snapshot = await db
    .collection("alerts")
    .where("locationId", "==", locationId)
    .where("dateKey", "==", dateKey)
    .get();

  return snapshot.docs.filter((doc) => {
    const data = doc.data() || {};
    const organizationId = sanitizeString(data.companyId || data.organizationId, 120);
    const status = sanitizeString(data.status || "", 40);
    return (!companyId || !organizationId || organizationId === companyId) && status === "open";
  }).length;
}

function getSnapshotEpoch(snapshotData) {
  const epoch = Number(snapshotData?.createdAtEpochMs || 0);
  if (Number.isFinite(epoch) && epoch > 0) return epoch;

  if (snapshotData?.createdAt && typeof snapshotData.createdAt.toMillis === "function") {
    return snapshotData.createdAt.toMillis();
  }

  return 0;
}

async function loadLatestHaccpSnapshot({ companyId }) {
  const queries = [
    db.collection("haccp_snapshots")
      .where("companyId", "==", companyId)
      .limit(50),
    db.collection("haccp_snapshots")
      .where("organizationId", "==", companyId)
      .limit(50)
  ];

  for (const q of queries) {
    const snapshot = await q.get();
    if (snapshot.empty) continue;

    let best = null;
    for (const doc of snapshot.docs) {
      const data = doc.data() || {};
      if (!best || getSnapshotEpoch(data) > getSnapshotEpoch(best)) {
        best = data;
      }
    }

    if (best) return best;
  }

  return null;
}

function inferProvisionedTemplateMeta(title = "", hazard = {}) {
  const text = sanitizeString(title, 220).toLowerCase();
  const hazardName = sanitizeString(hazard?.name || "", 220);
  const controlPoint = sanitizeString(hazard?.control || title, 220) || title;

  if (
    text.includes("temperatur") ||
    text.includes("køl") ||
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

  if (text.includes("rengør") || text.includes("rengor") || text.includes("lukker")) {
    return {
      category: text.includes("lukker") ? "lukkerutine" : "rengøring",
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

function buildProvisionedTemplateFields(formType, suppliers = []) {
  if (formType === "temperature") {
    return [
      { key: "measurement", label: "Måling", type: "number", required: true },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Årsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  if (formType === "receiving") {
    return [
      { key: "supplier", label: "Leverandør", type: suppliers.length ? "select" : "text", required: true, options: suppliers },
      { key: "status", label: "Status", type: "radio", required: true, options: ["OK", "Afvigelse"] },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Årsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  if (formType === "checklist") {
    return [
      { key: "completed", label: "Udført", type: "checkbox", required: false },
      { key: "comment", label: "Kommentar", type: "textarea", required: false },
      { key: "deviationReason", label: "Årsag ved afvigelse", type: "textarea", required: false }
    ];
  }

  return [
    { key: "status", label: "Status", type: "radio", required: true, options: ["OK", "Afvigelse"] },
    { key: "comment", label: "Kommentar", type: "textarea", required: false },
    { key: "deviationReason", label: "Årsag ved afvigelse", type: "textarea", required: false }
  ];
}

function buildProvisionedTemplateAlertRules(formType, title, riskLevel) {
  if (formType === "temperature") {
    return [{
      type: "measurement_out_of_range",
      severity: riskLevel === "high" ? "critical" : "warning",
      message: `${sanitizeString(title, 160)} kræver temperaturkontrol`
    }];
  }

  return [{
    type: "status_equals",
    value: "Afvigelse",
    severity: riskLevel === "high" ? "critical" : "warning",
    message: `${sanitizeString(title, 160)} kræver handling`
  }];
}

function extractTemperatureLimits(kcp) {
  if (!kcp || !kcp.criticalLimit) return { minValue: null, maxValue: null, unit: "°C" };
  
  const criticalLimit = kcp.criticalLimit;
  const category = (kcp.category || "").toLowerCase();
  const title = (kcp.title || "").toLowerCase();
  
  // KCP 1: Modtagelse (Receiving) - Default to chilled goods temperature
  if (category.includes("modtagelse") || title.includes("modtagelse") || title.includes("varemodtagelse")) {
    return { minValue: 0, maxValue: 5, unit: "°C", target: "Kølevarer" };
  }
  
  // KCP 2: Opbevaring - Køl/Frost
  if (category.includes("opbevaring") || title.includes("lager")) {
    if (title.includes("køl") || title.includes("fridge")) {
      return { minValue: 0, maxValue: 5, unit: "°C", target: "Køleskab" };
    }
    if (title.includes("frost") || title.includes("frys")) {
      return { minValue: -25, maxValue: -18, unit: "°C", target: "Fryser" };
    }
    // Default for storage
    return { minValue: 0, maxValue: 5, unit: "°C", target: "Køl" };
  }
  
  // KCP 3: Tilberedning
  if (category.includes("tilberedning") || title.includes("tilberedning") || title.includes("opvarmning")) {
    return { minValue: 75, maxValue: 100, unit: "°C", target: "Kernetemperatur" };
  }
  
  // KCP 4: Nedkøling
  if (category.includes("nedkoeling") || title.includes("nedkøl")) {
    return { minValue: 0, maxValue: 10, unit: "°C", target: "Sluttemperatur", timeLimit: "4 timer" };
  }
  
  // KCP 5: Varmholdelse
  if (category.includes("varmholdelse") || title.includes("varmhold")) {
    return { minValue: 60, maxValue: 100, unit: "°C", target: "Varmholdelse", timeLimit: "3 timer" };
  }
  
  return { minValue: null, maxValue: null, unit: "°C" };
}

function formatInstructions(kcp) {
  if (!kcp || !kcp.monitoring) return null;
  
  const monitoring = kcp.monitoring;
  const instructions = [];
  
  if (monitoring.what) {
    instructions.push(`**Hvad skal kontrolleres:** ${monitoring.what}`);
  }
  
  if (monitoring.how) {
    instructions.push(`**Hvordan:** ${monitoring.how}`);
  }
  
  if (monitoring.frequency) {
    instructions.push(`**Frekvens:** ${monitoring.frequency}`);
  }
  
  if (monitoring.responsible) {
    instructions.push(`**Ansvarlig:** ${monitoring.responsible}`);
  }
  
  return instructions.length > 0 ? instructions.join("\n\n") : null;
}

function formatCriticalLimits(kcp) {
  if (!kcp || !kcp.criticalLimit) return null;
  
  const limits = [];
  const criticalLimit = kcp.criticalLimit;
  
  Object.entries(criticalLimit).forEach(([key, value]) => {
    if (value && typeof value === "string") {
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1");
      limits.push(`**${label}:** ${value}`);
    }
  });