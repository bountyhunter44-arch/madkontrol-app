"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

function sanitizeString(value, maxLen = 500) {
  return String(value || "").trim().slice(0, maxLen);
}

function normalizeRole(value) {
  return sanitizeString(value, 80).toLowerCase();
}

function normalizeRoutineSource(value = "") {
  const normalized = sanitizeString(value || "task_templates", 80);
  if (["task_templates", "verification_templates"].includes(normalized)) {
    return normalized;
  }
  return "";
}

function getProfileCompanyId(profile = {}) {
  return sanitizeString(profile.companyId || profile.organizationId, 120);
}

function getProfileLocationIds(profile = {}) {
  const values = [];
  const push = (value) => {
    const normalized = sanitizeString(value, 120);
    if (normalized) values.push(normalized);
  };

  if (Array.isArray(profile.locationIds)) {
    profile.locationIds.forEach(push);
  }
  push(profile.primaryLocationId);
  push(profile.locationId);

  return [...new Set(values)];
}

function isSuperAdmin(auth = {}, role = "") {
  const email = sanitizeString(auth.token?.email || "", 160).toLowerCase();
  return role === "super-admin" && ["mn@aroid.dk", "michael@madkontrollen.dk"].includes(email);
}

function canManageRoutineMaster({ auth = {}, profile = {}, companyId = "", locationId = "" }) {
  const role = normalizeRole(profile.role);
  const companyMatches = getProfileCompanyId(profile) === companyId;
  const locationIds = getProfileLocationIds(profile);
  const locationMatches = locationIds.includes(locationId);

  if (isSuperAdmin(auth, role)) return true;
  if (!companyMatches) return false;

  if (["owner", "hq_admin", "admin", "location_manager", "location_admin"].includes(role)) {
    return true;
  }

  if (role === "manager") {
    return locationMatches;
  }

  return false;
}

async function resolveCallableAuth(context = {}) {
  if (context.auth?.uid) {
    console.log("[routine auth resolve]", {
      hasContextAuth: true,
      hasAuthorizationHeader: !!context.rawRequest?.headers?.authorization,
      uid: context.auth.uid
    });
    return context.auth;
  }

  const rawRequest = context.rawRequest || context.req || null;
  const header =
    rawRequest?.headers?.authorization ||
    rawRequest?.headers?.Authorization ||
    (typeof rawRequest?.get === "function"
      ? rawRequest.get("authorization") || rawRequest.get("Authorization")
      : "") ||
    "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);

  if (!match) {
    console.log("[routine auth resolve]", {
      hasContextAuth: false,
      hasAuthorizationHeader: false,
      uid: ""
    });
    throw new functions.https.HttpsError("unauthenticated", "Login-token mangler.");
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    console.log("[routine auth resolve]", {
      hasContextAuth: false,
      hasAuthorizationHeader: true,
      uid: decoded.uid
    });
    return { uid: decoded.uid, token: decoded };
  } catch (error) {
    console.warn("[routine auth resolve:error]", {
      code: error?.code || "",
      message: error?.message || "Token verification failed"
    });
    throw new functions.https.HttpsError("unauthenticated", "Login-token er ugyldigt eller udloebet.");
  }
}

function getTemplateCompanyId(template = {}) {
  return sanitizeString(template.companyId || template.organizationId, 120);
}

function getTemplateLocationId(template = {}) {
  return sanitizeString(template.locationId, 120);
}

function buildRoutinePausePayload({ action, actorId, actorName }) {
  const timestamp = FieldValue.serverTimestamp();

  if (action === "pause") {
    return {
      status: "paused",
      paused: true,
      hidden: true,
      hiddenFromDailyView: true,
      active: false,
      isActive: false,
      enabled: false,
      pauseState: "paused",
      pausedAt: timestamp,
      pausedBy: actorId,
      pausedByName: actorName,
      hiddenAt: timestamp,
      hiddenBy: actorId,
      hiddenByName: actorName,
      updatedAt: timestamp,
      updatedBy: actorId,
      updatedByName: actorName
    };
  }

  return {
    status: "active",
    paused: false,
    inactive: false,
    hidden: false,
    hiddenFromDailyView: false,
    active: true,
    isActive: true,
    enabled: true,
    pauseState: "active",
    reactivatedAt: timestamp,
    reactivatedBy: actorId,
    reactivatedByName: actorName,
    resumedAt: timestamp,
    resumedBy: actorId,
    resumedByName: actorName,
    updatedAt: timestamp,
    updatedBy: actorId,
    updatedByName: actorName
  };
}

function normalizeFrequencyValue(value = "") {
  const normalized = sanitizeString(value || "daily", 40).toLowerCase();
  if (["daily", "weekly", "every_14_days", "monthly", "yearly"].includes(normalized)) {
    return normalized;
  }
  if (normalized === "biweekly" || normalized === "fortnightly") return "every_14_days";
  return "daily";
}

function getFrequencyConfig(value = "") {
  const frequency = normalizeFrequencyValue(value);
  if (frequency === "weekly") {
    return { frequency, frequencyType: "interval_days", frequencyDays: 7, interval_days: 7 };
  }
  if (frequency === "every_14_days") {
    return { frequency, frequencyType: "interval_days", frequencyDays: 14, interval_days: 14 };
  }
  if (frequency === "monthly") {
    return { frequency, frequencyType: "interval_days", frequencyDays: 30, interval_days: 30 };
  }
  if (frequency === "yearly") {
    return { frequency, frequencyType: "interval_days", frequencyDays: 365, interval_days: 365 };
  }
  return { frequency: "daily", frequencyType: "daily", frequencyDays: 1, interval_days: 1 };
}

function buildFrequencyUpdatePayload({ config, actorId, actorName }) {
  const timestamp = FieldValue.serverTimestamp();
  return {
    frequency: config.frequency,
    frequencyType: config.frequencyType,
    frequencyDays: config.frequencyDays,
    interval_days: config.interval_days,
    scheduleConfig: {
      scheduleType: "recurring",
      recurrenceMode: "interval_days",
      recurrenceValue: config.interval_days || config.frequencyDays || 7,
      anchorDate: new Date().toISOString().slice(0, 10)
    },
    updatedAt: timestamp,
    updatedBy: actorId,
    updatedByName: actorName
  };
}

async function changeRoutinePauseState(data = {}, context = {}, action = "pause") {
  const auth = await resolveCallableAuth(context);
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind for at aendre rutinen.");
  }

  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);
  const templateId = sanitizeString(data?.templateId, 180);
  const routineId = sanitizeString(data?.routineId || data?.taskInstanceId || "", 180);
  const collectionName = normalizeRoutineSource(data?.source || data?.collectionName || "task_templates");

  if (!companyId || !locationId || !templateId || !routineId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId, locationId, routineId og templateId er paakraevet.");
  }

  if (!collectionName) {
    throw new functions.https.HttpsError("invalid-argument", "Ugyldig rutine-template collection.");
  }

  const userSnap = await db.collection("users").doc(auth.uid).get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError("permission-denied", "Brugerprofil mangler.");
  }

  const userProfile = userSnap.data() || {};
  if (!canManageRoutineMaster({ auth, profile: userProfile, companyId, locationId })) {
    throw new functions.https.HttpsError("permission-denied", "Ikke rettigheder til at aendre rutinen.");
  }

  const templateRef = db.collection(collectionName).doc(templateId);
  const templateSnap = await templateRef.get();
  if (!templateSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Rutinen findes ikke i masterlisten.");
  }

  const template = templateSnap.data() || {};
  const templateCompanyId = getTemplateCompanyId(template);
  const templateLocationId = getTemplateLocationId(template);
  if (templateCompanyId !== companyId || templateLocationId !== locationId) {
    throw new functions.https.HttpsError("permission-denied", "Rutinen hoerer ikke til den valgte virksomhed og lokation.");
  }

  const actorName = sanitizeString(
    userProfile.displayName || userProfile.name || auth.token?.name || auth.token?.email || auth.uid,
    160
  );
  const updatePayload = buildRoutinePausePayload({
    action,
    actorId: auth.uid,
    actorName
  });

  await templateRef.update(updatePayload);

  const paused = action === "pause";
  return {
    ok: true,
    collectionName,
    source: collectionName,
    routineId,
    templateId,
    companyId,
    locationId,
    status: paused ? "paused" : "active",
    paused,
    hiddenFromDailyView: paused,
    active: !paused,
    isActive: !paused,
    enabled: !paused,
    inactive: false,
    hidden: paused,
    pauseState: paused ? "paused" : "active"
  };
}

async function updateRoutineFrequency(data = {}, context = {}) {
  const auth = await resolveCallableAuth(context);
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind for at aendre frekvensen.");
  }

  const companyId = sanitizeString(data?.companyId, 120);
  const locationId = sanitizeString(data?.locationId, 120);
  const taskInstanceId = sanitizeString(data?.taskInstanceId || data?.routineId || "", 220);
  let templateId = sanitizeString(data?.templateId || data?.linkedTemplateId || "", 220);
  const collectionName = normalizeRoutineSource(data?.source || data?.collectionName || "task_templates");
  const frequencyConfig = getFrequencyConfig(data?.frequency || data?.frequencyType || "daily");

  if (!companyId || !locationId || !taskInstanceId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId, locationId og taskInstanceId er paakraevet.");
  }
  if (!collectionName) {
    throw new functions.https.HttpsError("invalid-argument", "Ugyldig rutine-template collection.");
  }

  const userSnap = await db.collection("users").doc(auth.uid).get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError("permission-denied", "Brugerprofil mangler.");
  }

  const userProfile = userSnap.data() || {};
  if (!canManageRoutineMaster({ auth, profile: userProfile, companyId, locationId })) {
    throw new functions.https.HttpsError("permission-denied", "Ikke rettigheder til at aendre frekvensen.");
  }

  const actorName = sanitizeString(
    userProfile.displayName || userProfile.name || auth.token?.name || auth.token?.email || auth.uid,
    160
  );
  const updatePayload = buildFrequencyUpdatePayload({
    config: frequencyConfig,
    actorId: auth.uid,
    actorName
  });

  let taskInstanceUpdated = false;
  let templateUpdated = false;

  const taskRef = db.collection("task_instances").doc(taskInstanceId);
  const taskSnap = await taskRef.get();
  if (taskSnap.exists) {
    const task = taskSnap.data() || {};
    const taskCompanyId = sanitizeString(task.companyId || task.organizationId, 120);
    const taskLocationId = sanitizeString(task.locationId, 120);
    if (taskCompanyId && taskCompanyId !== companyId) {
      throw new functions.https.HttpsError("permission-denied", "Rutinen hoerer ikke til den valgte virksomhed.");
    }
    if (taskLocationId && taskLocationId !== locationId) {
      throw new functions.https.HttpsError("permission-denied", "Rutinen hoerer ikke til den valgte lokation.");
    }
    templateId = templateId || sanitizeString(task.templateId || task.linkedTemplateId, 220);
    await taskRef.update(updatePayload);
    taskInstanceUpdated = true;
  }

  if (templateId) {
    const templateRef = db.collection(collectionName).doc(templateId);
    const templateSnap = await templateRef.get();
    if (templateSnap.exists) {
      const template = templateSnap.data() || {};
      const templateCompanyId = getTemplateCompanyId(template);
      const templateLocationId = getTemplateLocationId(template);
      if (templateCompanyId !== companyId || templateLocationId !== locationId) {
        throw new functions.https.HttpsError("permission-denied", "Rutinen hoerer ikke til den valgte virksomhed og lokation.");
      }
      await templateRef.update(updatePayload);
      templateUpdated = true;
    }
  }

  if (!taskInstanceUpdated && !templateUpdated) {
    throw new functions.https.HttpsError("not-found", "Rutinen findes ikke.");
  }

  return {
    ok: true,
    taskInstanceId,
    templateId,
    collectionName,
    source: collectionName,
    companyId,
    locationId,
    taskInstanceUpdated,
    templateUpdated,
    ...frequencyConfig
  };
}

function normalizeCallableRequest(data = {}, context = {}) {
  if ((data?.auth?.uid || data?.rawRequest) && !context?.auth?.uid && !context?.rawRequest) {
    return {
      data: data.data || {},
      context: data
    };
  }

  return { data, context };
}

const pauseEgenkontrolRoutine = functions.https.onCall(async (data, context) => {
  const request = normalizeCallableRequest(data, context);
  return changeRoutinePauseState(request.data, request.context, "pause");
});

const reactivateEgenkontrolRoutine = functions.https.onCall(async (data, context) => {
  const request = normalizeCallableRequest(data, context);
  return changeRoutinePauseState(request.data, request.context, "reactivate");
});

const setRoutinePauseState = functions.https.onCall(async (data, context) => {
  const request = normalizeCallableRequest(data, context);
  const shouldPause = request.data?.paused === true || request.data?.status === "paused";
  const routineId = sanitizeString(request.data?.routineId || request.data?.taskInstanceId || request.data?.templateId || "", 180);
  return changeRoutinePauseState({ ...request.data, routineId }, request.context, shouldPause ? "pause" : "reactivate");
});

const updateEgenkontrolRoutineFrequency = functions.https.onCall(async (data, context) => {
  const request = normalizeCallableRequest(data, context);
  return updateRoutineFrequency(request.data, request.context);
});

module.exports = {
  pauseEgenkontrolRoutine,
  reactivateEgenkontrolRoutine,
  setRoutinePauseState,
  updateEgenkontrolRoutineFrequency
};
