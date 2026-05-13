const admin = require("firebase-admin");
const serviceAccount = require("../../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const UID = "GgIT0dJu3mP5BVSKjwuygdrf1Oy1";

function clean(value) {
  return String(value || "").trim();
}

function firstText(...values) {
  for (const value of values) {
    const normalized = clean(value);
    if (normalized) return normalized;
  }
  return "";
}

function toDocSafeId(value) {
  return clean(value)
    .replace(/[\/\\#?[\]]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resolveLocationId(userData = {}) {
  const direct = firstText(userData.locationId, userData.primaryLocationId);
  if (direct) return direct;

  if (Array.isArray(userData.locationIds)) {
    return userData.locationIds.map(clean).find(Boolean) || "";
  }

  return "";
}

function buildAddressParts(source = {}) {
  return {
    address: firstText(source.address, source.street, source.adresse),
    zip: firstText(source.zip, source.postalCode, source.postnummer),
    city: firstText(source.city, source.by)
  };
}

function buildSchedule({ recurrenceMode = "daily", recurrenceValue = 1, anchorDate = todayKey(), firstRunImmediately = true }) {
  return {
    scheduleType: "operational",
    recurrenceMode,
    recurrenceValue,
    documentedIntervalMode: recurrenceMode,
    documentedIntervalValue: recurrenceValue,
    anchorDate,
    nextDueDate: anchorDate,
    firstRunImmediately,
    useDailyObservation: recurrenceMode === "daily"
  };
}

function buildTemplate({ companyId, locationId, key, title, description, category, guideKey, templateKey, controlType = "check", formType = "checklist", equipmentType = "", requiresMeasurement = false, recurrenceMode = "daily", recurrenceValue = 1, sortOrder = 100 }) {
  const id = toDocSafeId(`${companyId}__${locationId}__minimal__${key}`);
  const isTemperature = controlType === "temperature_check" || formType === "temperature";

  return {
    id,
    templateId: id,
    companyId,
    organizationId: companyId,
    locationId,
    title,
    description,
    category,
    templateType: "operational",
    templateSource: "minimal_admin_seed",
    sourceType: "minimal_admin_seed",
    guideKey,
    templateKey,
    controlType,
    taskType: category,
    formType,
    equipmentType,
    frequency: recurrenceMode === "daily" ? "daily" : "interval_days",
    frequencyType: recurrenceMode === "daily" ? "daily" : "interval_days",
    frequencyDays: recurrenceValue,
    registrationFrequency: recurrenceMode === "daily" ? "daily" : "interval_days",
    registrationFrequencyType: recurrenceMode === "daily" ? "daily" : "interval_days",
    registrationFrequencyDays: recurrenceValue,
    scheduleConfig: buildSchedule({
      recurrenceMode,
      recurrenceValue,
      firstRunImmediately: true
    }),
    requiresMeasurement,
    requiresRegistration: true,
    measurementUnit: isTemperature ? "°C" : "",
    riskLevel: isTemperature ? "high" : "medium",
    isCCP: isTemperature,
    fields: [],
    rules: [],
    alertRules: [],
    actions: { allowApprove: true, allowDeviation: true },
    guideTitle: `Vejledning: ${title}`,
    guideBody: description,
    visibility: "active",
    sortOrder,
    schemaVersion: 1,
    isActive: true,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

function buildMinimalTemplates({ companyId, locationId }) {
  return [
    buildTemplate({
      companyId,
      locationId,
      key: "varemodtagelse",
      title: "Varemodtagelse",
      description: "Kontroller temperatur, emballage og kvalitet ved modtagelse af varer.",
      category: "varemodtagelse",
      guideKey: "receiving_control",
      templateKey: "receiving_control",
      controlType: "receiving_check",
      sortOrder: 10
    }),
    buildTemplate({
      companyId,
      locationId,
      key: "temperatur-koel",
      title: "Temperaturkontrol køl",
      description: "Kontroller og registrer temperatur for køl. Køl skal normalt være maks. 5 °C.",
      category: "temperatur",
      guideKey: "fridge_temperature",
      templateKey: "temperature_control",
      controlType: "temperature_check",
      formType: "temperature",
      equipmentType: "cooling",
      requiresMeasurement: true,
      sortOrder: 20
    }),
    buildTemplate({
      companyId,
      locationId,
      key: "temperatur-frost",
      title: "Temperaturkontrol frost",
      description: "Kontroller og registrer temperatur for frost. Frost skal normalt være -18 °C eller koldere.",
      category: "temperatur",
      guideKey: "freezer_temperature",
      templateKey: "temperature_control",
      controlType: "temperature_check",
      formType: "temperature",
      equipmentType: "freezing",
      requiresMeasurement: true,
      sortOrder: 30
    }),
    buildTemplate({
      companyId,
      locationId,
      key: "rengoering",
      title: "Rengøring",
      description: "Gennemfør og dokumenter rengøring efter rengøringsplanen.",
      category: "rengoering",
      guideKey: "cleaning_control",
      templateKey: "cleaning_control",
      controlType: "cleaning_check",
      recurrenceMode: "every_n_days",
      recurrenceValue: 7,
      sortOrder: 40
    }),
    buildTemplate({
      companyId,
      locationId,
      key: "opvarmning",
      title: "Opvarmning",
      description: "Kontroller at fødevarer opvarmes til sikker temperatur.",
      category: "opvarmning",
      guideKey: "heating_control",
      templateKey: "heating_control",
      controlType: "temperature_check",
      formType: "temperature",
      requiresMeasurement: true,
      sortOrder: 50
    }),
    buildTemplate({
      companyId,
      locationId,
      key: "nedkoeling",
      title: "Nedkøling",
      description: "Kontroller og dokumenter korrekt nedkøling af varmebehandlede fødevarer.",
      category: "nedkoeling",
      guideKey: "cooling_control",
      templateKey: "cooling_control",
      controlType: "cooling_check",
      formType: "cooling",
      requiresMeasurement: true,
      sortOrder: 60
    }),
    buildTemplate({
      companyId,
      locationId,
      key: "varmholdelse",
      title: "Varmholdelse",
      description: "Kontroller og registrer temperatur for varmholdte fødevarer.",
      category: "varmholdelse",
      guideKey: "hot_holding_control",
      templateKey: "hot_holding_control",
      controlType: "temperature_check",
      formType: "temperature",
      requiresMeasurement: true,
      sortOrder: 70
    })
  ];
}

function buildEquipment({ companyId, locationId, key, name, equipmentType }) {
  const id = toDocSafeId(`${companyId}__${locationId}__minimal__${key}`);
  return {
    id,
    equipmentId: id,
    companyId,
    organizationId: companyId,
    locationId,
    name,
    displayName: name,
    title: name,
    equipmentName: name,
    equipmentType,
    type: equipmentType,
    source: "minimal_admin_seed",
    temperatureControlEnabled: true,
    temperatureControl: {
      enabled: true,
      useGlobalSchedule: true
    },
    isActive: true,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function main() {
  console.log("[seedMinimalEgenkontrol] uid", UID);

  const userRef = db.collection("users").doc(UID);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new Error(`users/${UID} findes ikke.`);
  }

  const userData = userSnap.data() || {};
  const companyId = firstText(userData.companyId, userData.organizationId);
  const locationId = resolveLocationId(userData);

  console.log("[seedMinimalEgenkontrol] companyId", companyId || "MISSING");
  console.log("[seedMinimalEgenkontrol] locationId", locationId || "MISSING");

  if (!companyId || !locationId) {
    throw new Error("Brugeren mangler companyId/locationId. Scriptet opretter ikke ny company/location.");
  }

  const companyRef = db.collection("companies").doc(companyId);
  const locationRef = companyRef.collection("locations").doc(locationId);
  const liveProfileId = `${companyId}__${locationId}__live_profile`;
  const liveProfileRef = db.collection("live_user_profiles").doc(liveProfileId);

  const [companySnap, locationSnap, liveProfileSnap] = await Promise.all([
    companyRef.get(),
    locationRef.get(),
    liveProfileRef.get()
  ]);

  const companyData = companySnap.exists ? (companySnap.data() || {}) : {};
  const locationData = locationSnap.exists ? (locationSnap.data() || {}) : {};
  const liveData = liveProfileSnap.exists ? (liveProfileSnap.data() || {}) : {};
  const liveProfile = { ...(liveData.profile || {}), ...liveData };
  const addressParts = buildAddressParts({ ...companyData, ...locationData, ...liveProfile, ...userData });

  const companyName = firstText(liveProfile.companyName, companyData.companyName, companyData.name, userData.companyName, "Eksisterende virksomhed");
  const locationName = firstText(locationData.locationName, locationData.name, liveProfile.locationName, "Hovedlokation");
  const contactName = firstText(liveProfile.ownerName, liveProfile.contactName, companyData.ownerName, companyData.contactName, userData.displayName, userData.email);
  const phone = firstText(liveProfile.phone, liveProfile.phoneNumber, companyData.phone, companyData.phoneNumber, userData.phone, userData.phoneNumber);

  await companyRef.set({
    id: companyId,
    companyId,
    organizationId: companyId,
    companyName,
    name: firstText(companyData.name, companyName),
    ownerName: firstText(companyData.ownerName, contactName),
    contactName: firstText(companyData.contactName, contactName),
    phone: firstText(companyData.phone, phone),
    phoneNumber: firstText(companyData.phoneNumber, phone),
    ...addressParts,
    status: firstText(companyData.status, "active"),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await locationRef.set({
    id: locationId,
    locationId,
    companyId,
    organizationId: companyId,
    name: locationName,
    locationName,
    ...addressParts,
    status: firstText(locationData.status, "active"),
    isActive: locationData.isActive !== false,
    active: locationData.active !== false,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await liveProfileRef.set({
    id: liveProfileId,
    documentType: "live_user_profile",
    companyId,
    organizationId: companyId,
    locationId,
    userId: UID,
    userEmail: firstText(userData.email),
    companyName,
    locationName,
    ownerName: contactName,
    contactName,
    phone,
    phoneNumber: phone,
    ...addressParts,
    status: "active",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log("[seedMinimalEgenkontrol] profile docs ensured", {
    companyPath: companyRef.path,
    locationPath: locationRef.path,
    liveProfilePath: liveProfileRef.path
  });

  const existingTemplatesSnap = await db.collection("task_templates")
    .where("companyId", "==", companyId)
    .where("locationId", "==", locationId)
    .get();

  console.log("[seedMinimalEgenkontrol] existing task_templates count", existingTemplatesSnap.size);

  if (!existingTemplatesSnap.empty) {
    console.log("[seedMinimalEgenkontrol] templates already exist; skipping template/equipment seed.");
    console.log("[seedMinimalEgenkontrol] done");
    return;
  }

  const batch = db.batch();
  const templates = buildMinimalTemplates({ companyId, locationId });

  for (const template of templates) {
    const ref = db.collection("task_templates").doc(template.id);
    batch.set(ref, template, { merge: true });
  }

  const equipment = [
    buildEquipment({
      companyId,
      locationId,
      key: "koeleskab-1",
      name: "Køleskab 1",
      equipmentType: "cooling"
    }),
    buildEquipment({
      companyId,
      locationId,
      key: "fryser-1",
      name: "Fryser 1",
      equipmentType: "freezing"
    })
  ];

  for (const unit of equipment) {
    const ref = db.collection("equipment").doc(unit.id);
    batch.set(ref, unit, { merge: true });
  }

  await batch.commit();

  console.log("[seedMinimalEgenkontrol] task_templates created", templates.length);
  console.log("[seedMinimalEgenkontrol] equipment ensured", equipment.length);
  console.log("[seedMinimalEgenkontrol] next step: open rutiner.html and let startDayForLocation create task_instances.");
  console.log("[seedMinimalEgenkontrol] done");
}

main().catch((error) => {
  console.error("[seedMinimalEgenkontrol] failed", error);
  process.exitCode = 1;
});
