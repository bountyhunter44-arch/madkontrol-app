const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const SETTINGS = {
  companyId: "company_1",
  locationId: "location_1",
  assignedTo: "Michael Nielsen"
};

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return getDateKey(new Date());
}

function parseDateValue(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value.toDate === "function") {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function normalizeDateKey(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = parseDateValue(trimmed);
    return parsed ? getDateKey(parsed) : null;
  }

  const parsed = parseDateValue(value);
  return parsed ? getDateKey(parsed) : null;
}

function shouldGenerateToday(task) {
  if (!task?.isActive) return false;

  const frequency = String(task.frequency || "").toLowerCase();

  if (frequency === "daily") return true;

  if (frequency === "weekly") {
    const today = new Date().getDay(); // 0=søn, 1=man...
    return today === 1;
  }

  return false;
}

async function getOperatingOverride() {
  const directDocId = `${SETTINGS.companyId}__${SETTINGS.locationId}`;
  const directRef = db.collection("operating_overrides").doc(directDocId);
  const directSnap = await directRef.get();

  if (directSnap.exists) {
    return {
      id: directSnap.id,
      ...directSnap.data()
    };
  }

  const querySnap = await db
    .collection("operating_overrides")
    .where("companyId", "==", SETTINGS.companyId)
    .where("locationId", "==", SETTINGS.locationId)
    .limit(1)
    .get();

  if (querySnap.empty) {
    return null;
  }

  const doc = querySnap.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  };
}

function resolveOperatingState(overrideDoc, todayKey) {
  if (!overrideDoc) {
    return {
      isClosed: false,
      isVacation: false,
      reason: "",
      untilDateKey: null,
      source: null
    };
  }

  const isActive = overrideDoc.isActive !== false;
  if (!isActive) {
    return {
      isClosed: false,
      isVacation: false,
      reason: "",
      untilDateKey: null,
      source: overrideDoc.id || null
    };
  }

  const untilDateKey =
    normalizeDateKey(overrideDoc.untilDateKey) ||
    normalizeDateKey(overrideDoc.until) ||
    normalizeDateKey(overrideDoc.endDate);

  const overrideStillValid = !untilDateKey || todayKey <= untilDateKey;

  if (!overrideStillValid) {
    return {
      isClosed: false,
      isVacation: false,
      reason: "",
      untilDateKey,
      source: overrideDoc.id || null
    };
  }

  const isClosed = overrideDoc.closed === true;
  const isVacation = overrideDoc.vacation === true;

  return {
    isClosed,
    isVacation,
    reason: overrideDoc.reason || "",
    untilDateKey,
    source: overrideDoc.id || null
  };
}

async function generateDailyTaskInstances() {
  const todayKey = getTodayKey();

  console.log("Genererer task_instances fra tasks...");
  console.log("NY GENERATE FIL V4 KØRER");

  try {
    const overrideDoc = await getOperatingOverride();
    const operatingState = resolveOperatingState(overrideDoc, todayKey);

    if (operatingState.isClosed || operatingState.isVacation) {
      const modeLabel = operatingState.isClosed ? "LUKKET" : "FERIE";

      console.log("");
      console.log(`GENERERING STOPPET: ${modeLabel}`);
      console.log(`Dato: ${todayKey}`);

      if (operatingState.reason) {
        console.log(`Årsag: ${operatingState.reason}`);
      }

      if (operatingState.untilDateKey) {
        console.log(`Gælder til og med: ${operatingState.untilDateKey}`);
      }

      if (operatingState.source) {
        console.log(`Override-dokument: ${operatingState.source}`);
      }

      return;
    }

    const tasksSnapshot = await db
      .collection("tasks")
      .where("locationId", "==", SETTINGS.locationId)
      .where("isActive", "==", true)
      .get();

    if (tasksSnapshot.empty) {
      console.log("Ingen aktive tasks fundet.");
      return;
    }

    const tasks = tasksSnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    const tasksToGenerate = tasks.filter(shouldGenerateToday);

    if (!tasksToGenerate.length) {
      console.log("Ingen tasks skulle genereres i dag.");
      return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const task of tasksToGenerate) {
      const instanceId = `${task.id}__${todayKey}`;
      const instanceRef = db.collection("task_instances").doc(instanceId);
      const existingDoc = await instanceRef.get();

      if (existingDoc.exists) {
        skippedCount += 1;
        console.log(`Findes allerede: ${instanceId}`);
        continue;
      }

      await instanceRef.set({
        taskId: task.id,
        companyId: task.companyId || SETTINGS.companyId,
        locationId: task.locationId || SETTINGS.locationId,

        dateKey: todayKey,
        title: task.title || "Opgave",
        description: task.description || "",

        taskType: task.type || "",
        category: task.category || "",

        equipmentId: task.equipmentId || "",
        equipmentType: task.equipmentType || "",
        equipmentName: task.equipmentName || "",

        frequency: task.frequency || "daily",

        requiresMeasurement: !!task.requiresMeasurement,
        measurementUnit: task.measurementUnit || "",
        minValue: task.minValue ?? null,
        maxValue: task.maxValue ?? null,

        linkedRiskIds: Array.isArray(task.linkedRiskIds) ? task.linkedRiskIds : [],

        status: "pending",
        assignedTo: SETTINGS.assignedTo,

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      createdCount += 1;
      console.log(`Oprettet: ${instanceId}`);
    }

    console.log("");
    console.log("FÆRDIG");
    console.log(`Oprettet task_instances: ${createdCount}`);
    console.log(`Sprunget over (findes allerede): ${skippedCount}`);
  } catch (error) {
    console.error("Fejl i generateDailyTaskInstances:", error);
    process.exit(1);
  }
}

generateDailyTaskInstances();