// company-admin — udtrukket fra functions/index.js.
// Følger DI-factory-mønsteret fra functions/egenkontrol/.
// Kode flyttet ORDRET; eneste ændring er `exports.` -> `api.`.

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { guardDangerousOperation } = require("./security/environmentGuard");
const softArchive = require("./admin/softArchive");
const { sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt, toDocSafeId, toAsciiSlug, toLegacyId, getDateKey, addDays, daysBetween, normalizeDateKey, removeUndefinedFields, getWeekdayFromDateKey, sanitizeRelativePath, parsePageCount } = require("./lib/util");

module.exports = ({
  FieldValue,
  assertAdminAccess,
  assertStartDayAccess,
  db
}) => {
  const api = {};

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

function getSnapshotEpoch(snapshotData) {
  const epoch = Number(snapshotData?.createdAtEpochMs || 0);
  if (Number.isFinite(epoch) && epoch > 0) return epoch;

  if (snapshotData?.createdAt && typeof snapshotData.createdAt.toMillis === "function") {
    return snapshotData.createdAt.toMillis();
  }

  return 0;
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

api.getDashboardSnapshot = functions.https.onCall(async (request) => {
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

api.listLocationUsers = onCall(
  { region: "us-central1" },
  async (request) => {
    console.log("listLocationUsers v2 debug", {
      hasAuth: !!request.auth,
      uid: request.auth?.uid || null,
      email: request.auth?.token?.email || null,
      data: request.data || null
    });

    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Du skal vaere logget ind.");
    }

    const companyId = sanitizeString(request.data?.companyId || "", 120);
    const locationId = sanitizeString(request.data?.locationId || "", 120);

    if (!companyId || !locationId) {
      throw new HttpsError("invalid-argument", "companyId og locationId er paakraevet.");
    }

    await assertAdminAccess({
      uid: request.auth.uid,
      email: request.auth.token?.email || "",
      companyId,
      locationId
    });

    try {
      const usersSnapshot = await db.collection("users")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .get();

      const users = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        users.push({
          userId: doc.id,
          displayName: userData.displayName || "",
          email: userData.email || "",
          role: userData.role || "medarbejder",
          employmentRole: userData.employmentRole || userData.role || "medarbejder",
          status: userData.status || "active",
          createdAt: userData.createdAt || null
        });
      });

      return { users };
    } catch (error) {
      console.error("Fejl ved hentning af lokationsbrugere:", error);
      throw new HttpsError("internal", "Kunne ikke hente brugere.");
    }
  }
);

api.createLocationUser = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Du skal vaere logget ind.");
    }

    const companyId = sanitizeString(request.data?.companyId || "", 120);
    const locationId = sanitizeString(request.data?.locationId || "", 120);
    const displayName = sanitizeString(request.data?.displayName || "", 100);
    const email = sanitizeString(request.data?.email || "", 100);
    const password = sanitizeString(request.data?.password || "", 100);
    const role = sanitizeString(request.data?.role || "employee", 50);
    const employmentRole = sanitizeString(request.data?.employmentRole || "medarbejder", 50);

    if (!companyId || !locationId || !displayName || !email || !password) {
      throw new HttpsError("invalid-argument", "companyId, locationId, displayName, email og password er paakraevet.");
    }

    if (password.length < 6) {
      throw new HttpsError("invalid-argument", "Password skal vaere mindst 6 tegn.");
    }

    await assertAdminAccess({
      uid: request.auth.uid,
      email: request.auth.token?.email || "",
      companyId,
      locationId
    });

    try {
      const existingUser = await db.collection("users")
        .where("email", "==", email)
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .limit(1)
        .get();

      if (!existingUser.empty) {
        throw new HttpsError("already-exists", "Bruger med denne email eksisterer allerede.");
      }

      // Get owner/admin profile to copy access fields
      const ownerDoc = await db.collection("users").doc(request.auth.uid).get();
      const ownerData = ownerDoc.exists ? (ownerDoc.data() || {}) : {};

      // Create Firebase Auth user
      const authUser = await admin.auth().createUser({
        email,
        password,
        displayName,
        emailVerified: false
      });

      // Build employee user document with same access fields as owner
      const userPayload = {
        // Employee-specific fields
        uid: authUser.uid,
        displayName,
        email,
        role,
        employmentRole,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: request.auth.uid,
        
        // Copy access fields from owner/admin
        companyId: companyId || ownerData.companyId,
        organizationId: companyId || ownerData.organizationId || ownerData.companyId,
        locationId: locationId || ownerData.locationId,
        primaryLocationId: locationId || ownerData.primaryLocationId || ownerData.locationId,
        locationIds: [locationId].filter(Boolean).length > 0 
          ? [locationId] 
          : (ownerData.locationIds || [locationId || ownerData.locationId].filter(Boolean)),
        
        // Copy optional access fields if they exist
        ...(ownerData.latestLiveProfileId && { latestLiveProfileId: ownerData.latestLiveProfileId }),
        ...(ownerData.activeLocationId && { activeLocationId: ownerData.activeLocationId }),
        ...(ownerData.companyName && { companyName: ownerData.companyName }),
        ...(ownerData.profileCompanyName && { profileCompanyName: ownerData.profileCompanyName })
      };

      // Create Firestore user document
      const userRef = db.collection("users").doc(authUser.uid);
      await userRef.set(userPayload);

      console.log("[createLocationUser] Created employee with access fields:", {
        uid: authUser.uid,
        companyId: userPayload.companyId,
        locationId: userPayload.locationId,
        locationIds: userPayload.locationIds,
        role: userPayload.role
      });

      return {
        success: true,
        userId: authUser.uid,
        message: "Bruger oprettet med login-adgang."
      };
    } catch (error) {
      console.error("Fejl ved oprettelse af lokationsbruger:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Kunne ikke oprette bruger.");
    }
  }
);

api.archiveCompany = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal vÃ¦re logget ind");
  }

  // CRITICAL: This is a dangerous operation - guard it
  guardDangerousOperation(context, "archiveCompany");

  const { companyId, reason } = data;

  if (!companyId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende pÃ¥krÃ¦vede felter");
  }

  try {
    const result = await softArchive.archiveCompany({
      companyId,
      reason,
      archivedBy: context.auth.uid
    });

    return result;
  } catch (error) {
    console.error("Archive company fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

api.restoreCompany = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal vÃ¦re logget ind");
  }

  // CRITICAL: This is a dangerous operation - guard it
  guardDangerousOperation(context, "restoreCompany");

  const { companyId } = data;

  if (!companyId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende pÃ¥krÃ¦vede felter");
  }

  try {
    const result = await softArchive.restoreCompany({
      companyId,
      restoredBy: context.auth.uid
    });

    return result;
  } catch (error) {
    console.error("Restore company fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

api.startNewPeriod = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal vÃ¦re logget ind");
  }

  const { companyId, locationId, periodName } = data;

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "Manglende pÃ¥krÃ¦vede felter");
  }

  // CRITICAL: Verify user owns this company/location
  const userDoc = await db.collection("users").doc(context.auth.uid).get();
  const userData = userDoc.data();

  if (!userData) {
    throw new functions.https.HttpsError("not-found", "Brugerprofil ikke fundet");
  }

  // Check company ownership
  const userCompanyId = userData.companyId || userData.organizationId;
  if (userCompanyId !== companyId) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Du kan kun starte ny periode for din egen virksomhed"
    );
  }

  // Check role - only owner or location_admin
  const userRole = String(userData.role || "").toLowerCase();
  if (userRole !== "owner" && userRole !== "location_admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Kun owner eller location_admin kan starte ny periode"
    );
  }

  // Check location access
  const userLocationIds = userData.locationIds || [];
  if (!userLocationIds.includes(locationId)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Du har ikke adgang til denne lokation"
    );
  }

  try {
    const result = await softArchive.startNewPeriod({
      companyId,
      locationId,
      periodName,
      startedBy: context.auth.uid
    });

    return result;
  } catch (error) {
    console.error("Start new period fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

api.cleanupTaskTemplates = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vÃ¦re logget ind.");
  }

  guardDangerousOperation(context, "cleanupTaskTemplates");

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);

  if (!companyId || !locationId) {
    throw new functions.https.HttpsError("invalid-argument", "companyId og locationId er pÃ¥krÃ¦vet.");
  }

  await assertAdminAccess({
    uid: context.auth.uid,
    email: context.auth.token?.email || "",
    companyId,
    locationId
  });

  try {
    const templatesRef = db.collection("task_templates");
    const snapshot = await templatesRef
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .get();

    if (snapshot.empty) {
      return { archived: 0, deleted: 0, message: "Ingen templates fundet." };
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.set(doc.ref, {
        active: false,
        isActive: false,
        archived: true,
        status: "inactive",
        archivedAt: FieldValue.serverTimestamp(),
        archivedByUid: context.auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: context.auth.uid
      }, { merge: true });
    });

    await batch.commit();

    return {
      archived: snapshot.size,
      deleted: 0,
      message: `Arkiverede ${snapshot.size} task templates.`
    };
  } catch (error) {
    console.error("cleanupTaskTemplates fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

  return api;
};
