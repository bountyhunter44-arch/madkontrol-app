// demo — udtrukket fra functions/index.js.
// Følger DI-factory-mønsteret fra functions/egenkontrol/.
// Kode flyttet ORDRET; eneste ændring er `exports.` -> `api.`.

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { guardDangerousOperation } = require("./security/environmentGuard");
const demoMode = require("./admin/demoMode");
const { OWNER_KIND, buildOwnerScopeMetadata } = require("./lib/ownerScope");
const { sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt, toDocSafeId, toAsciiSlug, toLegacyId, getDateKey, addDays, daysBetween, normalizeDateKey, removeUndefinedFields, getWeekdayFromDateKey, sanitizeRelativePath, parsePageCount } = require("./lib/util");
const {
  generateCanonicalTaskTemplates,
  ensureSingleTaskInstance,
  startDayForLocationCanonical
} = require("./canonicalTaskEngine");

module.exports = ({
  FieldValue,
  assertAdminAccess,
  db,
  getUserLocationIds
}) => {
  const api = {};

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

function normalizeEmploymentRole(value) {
  const raw = sanitizeString(value, 80).toLowerCase();
  if (raw === "ansat") return "ansat";
  if (raw === "employee" || raw === "medarbejder") return "medarbejder";
  return "medarbejder";
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

api.resetDemoData = functions.https.onCall(async (request) => {
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
    db.collection("users").where("organizationId", "==", companyId).limit(100).get()
  ]);

  const usersById = new Map();
  snapshots.forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      if (!usersById.has(docSnap.id)) {
        usersById.set(docSnap.id, docSnap.data() || {});
      }
    });
  });

  const users = [...usersById.entries()]
    .filter(([, userData]) => {
      const locationIds = getUserLocationIds(userData);
      if (!locationIds.length) return true;
      return locationIds.includes(locationId);
    })
    .map(([userId, userData]) => buildScopedUserResponse(userId, userData))
    .sort((left, right) => {
      const leftName = String(left.displayName || left.email || left.userId || "").toLowerCase();
      const rightName = String(right.displayName || right.email || right.userId || "").toLowerCase();
      return leftName.localeCompare(rightName, "da");
    });

  return { ok: true, users };
});

api.resetTaskInstances = functions.https.onCall(async (request) => {
  const data = request.data;
  const auth = request.auth;
  
  if (!auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Du skal vaere logget ind.");
  }

  // CRITICAL: Block reset task instances in production
  guardDangerousOperation(request, "resetTaskInstances");

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

  const [deletedTaskInstances, deletedDailyRuns] = await Promise.all([
    deleteScopedCollectionDocs({ collectionName: "task_instances", companyId, locationId }),
    deleteScopedCollectionDocs({ collectionName: "daily_runs", companyId, locationId })
  ]);

  return {
    ok: true,
    deleted: {
      task_instances: deletedTaskInstances,
      daily_runs: deletedDailyRuns
    },
    message: `Slettet ${deletedTaskInstances} task instances og ${deletedDailyRuns} daily runs`
  };
});

api.enableDemoMode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal vÃ¦re logget ind");
  }

  // CRITICAL: Demo mode is DEVELOPER ONLY
  guardDangerousOperation(context, "enableDemoMode");

  try {
    const userDoc = await db.collection("users").doc(context.auth.uid).get();
    const userData = userDoc.data();

    const result = await demoMode.enableDemoMode({
      userId: context.auth.uid,
      userData
    });

    return result;
  } catch (error) {
    console.error("Enable demo mode fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

api.disableDemoMode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Bruger skal vÃ¦re logget ind");
  }

  try {
    const userDoc = await db.collection("users").doc(context.auth.uid).get();
    const userData = userDoc.data();

    const result = await demoMode.disableDemoMode({
      userId: context.auth.uid,
      userData
    });

    return result;
  } catch (error) {
    console.error("Disable demo mode fejl:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

api.createDemoEnvironment = functions.https.onCall(async (request) => {
  const data = request.data || {};
  const origin = String(data.origin || "https://madkontrollen.dk").replace(/\/+$/, "");
  
  try {
    const demoEmail = `demo_${Date.now()}@madkontrollen.dk`;
    const demoPassword = Math.random().toString(36).slice(2, 12);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Create user
    const userRecord = await admin.auth().createUser({
      email: demoEmail,
      password: demoPassword,
      displayName: "Demo Bruger"
    });
    
    const userId = userRecord.uid;
    
    // Create company and location
    const companyRef = db.collection("companies").doc();
    const locationRef = db.collection("locations").doc();
    
    const companyId = companyRef.id;
    const locationId = locationRef.id;
    
    const nowTs = FieldValue.serverTimestamp();
    const ownerScopeMetadata = buildOwnerScopeMetadata(OWNER_KIND.DEMO_OWNER);
    
    await companyRef.set({
      id: companyId,
      companyId,
      organizationId: companyId,
      ...ownerScopeMetadata,
      name: "Demo Restaurant",
      displayName: "Demo Restaurant",
      status: "active",
      isDemo: true,
      demoMode: true,
      demoExpiresAt: expiresAt,
      demoCreatedBy: userId,
      createdBy: userId,
      createdAt: nowTs,
      updatedAt: nowTs
    });
    
    const locationData = {
      id: locationId,
      locationId,
      companyId,
      organizationId: companyId,
      ...ownerScopeMetadata,
      name: "Demo Lokation",
      displayName: "Demo Lokation",
      status: "active",
      isDemo: true,
      demoMode: true,
      demoExpiresAt: expiresAt,
      demoCreatedBy: userId,
      createdBy: userId,
      createdAt: nowTs,
      updatedAt: nowTs
    };
    await locationRef.set(locationData);
    await db.collection("companies").doc(companyId).collection("locations").doc(locationId).set(locationData);
    
    // Create user documents
    await db.collection("users").doc(userId).set({
      uid: userId,
      email: demoEmail,
      displayName: "Demo Bruger",
      companyId,
      organizationId: companyId,
      locationId,
      locationIds: [locationId],
      primaryLocationId: locationId,
      ...ownerScopeMetadata,
      role: "owner",
      roles: ["owner", "admin", "demo"],
      status: "active",
      isDemo: true,
      demoMode: true,
      demoExpiresAt: expiresAt,
      onboardingStatus: "completed",
      subscriptionStatus: "demo",
      createdAt: nowTs,
      updatedAt: nowTs
    });
    
    await db.collection("companies").doc(companyId).collection("members").doc(userId).set({
      uid: userId,
      userId,
      email: demoEmail,
      role: "owner",
      roles: ["owner", "admin", "demo"],
      companyId,
      organizationId: companyId,
      locationId,
      locationIds: [locationId],
      ...ownerScopeMetadata,
      status: "active",
      isDemo: true,
      demoMode: true,
      demoExpiresAt: expiresAt,
      createdAt: nowTs,
      updatedAt: nowTs
    });
    
    // Create demo equipment units
    const equipmentUnits = [
      { id: "demo_fridge_1", name: "KÃ¸leskab 1", type: "fridge" },
      { id: "demo_freezer_1", name: "Fryser 1", type: "freezer" },
      { id: "demo_dishwasher_1", name: "Opvaskemaskine 1", type: "dishwasher" },
      { id: "demo_fryer_1", name: "Friture 1", type: "fryer" },
      { id: "demo_slicer_1", name: "PÃ¥lÃ¦gsmaskine 1", type: "slicer" },
      { id: "demo_softice_1", name: "Softicemaskine 1", type: "softice_machine" },
      { id: "demo_walkin_cooler_1", name: "Walk-in kÃ¸ler", type: "walkin_cooler" },
      { id: "demo_walkin_freezer_1", name: "Walk-in fryser", type: "walkin_freezer" }
    ];
    
    for (const unit of equipmentUnits) {
      await db.collection("equipment").doc(unit.id).set({
        id: unit.id,
        equipmentId: unit.id,
        companyId,
        organizationId: companyId,
        locationId,
        ...ownerScopeMetadata,
        name: unit.name,
        displayName: unit.name,
        type: unit.type,
        equipmentType: unit.type,
        category: unit.type,
        isActive: true,
        active: true,
        isDemo: true,
        createdBy: userId,
        createdAt: nowTs,
        updatedAt: nowTs
      });
    }
    
    console.log("[createDemoEnvironment] Created 8 equipment units");
    
    // Generate canonical templates
    const templatesResult = await generateCanonicalTaskTemplates({
      db,
      companyId,
      locationId,
      ownerScopeMetadata
    });
    
    console.log("[createDemoEnvironment] Templates generated:", templatesResult);
    
    // Verify templates were created
    const verifySnap = await db.collection("task_templates")
      .where("companyId", "==", companyId)
      .where("locationId", "==", locationId)
      .get();
    
    console.log("[createDemoEnvironment] Templates verification:", verifySnap.size);
    
    if (verifySnap.empty) {
      throw new Error("CRITICAL: No templates were created for demo!");
    }
    
    // Generate instances for today using canonical engine
    const todayDateKey = new Date().toISOString().slice(0, 10);
    const instancesResult = await startDayForLocationCanonical({
      db,
      companyId,
      locationId,
      dateKey: todayDateKey,
      createdBy: userId,
      ownerScopeMetadata
    });
    
    console.log("[createDemoEnvironment] Instances generated:", instancesResult);
    
    console.log("[createDemoEnvironment] Demo created successfully", {
      userId,
      companyId,
      locationId,
      equipment: equipmentUnits.length,
      templates: templatesResult.created + templatesResult.updated,
      verified: verifySnap.size,
      instances: instancesResult.instancesCreated
    });
    
    return {
      ok: true,
      email: demoEmail,
      password: demoPassword,
      userId,
      uid: userId,
      companyId,
      locationId,
      demoCompanyId: companyId,
      demoLocationId: locationId,
      demoExpiresAt: expiresAt.toISOString(),
      equipment: equipmentUnits.length,
      templates: verifySnap.size,
      instances: instancesResult.instancesCreated,
      dashboardUrl: `${origin}/modules/egenkontrol/rutiner.html`
    };
    
  } catch (error) {
    console.error("[createDemoEnvironment] ERROR:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

  return api;
};
