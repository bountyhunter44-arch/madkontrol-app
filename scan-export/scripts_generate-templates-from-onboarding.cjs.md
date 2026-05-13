# FILE: scripts/generate-templates-from-onboarding.cjs

```javascript
const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.resolve(__dirname, "../serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function dedupeByTemplateId(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || !item.templateId) return false;
    if (seen.has(item.templateId)) return false;
    seen.add(item.templateId);
    return true;
  });
}

function buildControlPackagesFromOnboarding(onboarding) {
  const set = new Set();

  const processes = safeArray(onboarding.processes);
  const equipment = safeArray(onboarding.equipment);
  const hazardFlags = safeArray(onboarding.hazardFlags);

  const processToGuideKeys = {
    receiving: ["receiving_goods"],
    storage_chilled: ["fridge_temperature", "cold_storage_placement"],
    storage_frozen: ["freezer_temperature"],
    walkin_storage: ["walkin_cooler_temperature"],
    hot_preparation: ["hot_preparation_core_temperature"],
    hot_holding: ["hot_holding"],
    cold_preparation: ["cold_preparation_hygiene"],
    cooling: ["fridge_temperature"],
  };

  const equipmentToGuideKeys = {
    fridge: ["fridge_temperature"],
    freezer: ["freezer_temperature"],
    walkin_cooler: ["walkin_cooler_temperature"],
    oven: ["oven_control"],
    dishwasher: ["dishwasher_control"],
    softice: ["cleaning_control"],
    ice_machine: ["cleaning_control"],
    fish_station: ["cold_preparation_hygiene"],
    cutting_area: ["cold_preparation_hygiene"],
  };

  const hazardToGuideKeys = {
    allergens: ["cold_preparation_hygiene"],
    raw_fish: ["cold_preparation_hygiene"],
    buffet: ["hot_holding"],
    frequent_deliveries: ["receiving_goods"],
  };

  processes.forEach((key) => {
    safeArray(processToGuideKeys[key]).forEach((guideKey) => set.add(guideKey));
  });

  equipment.forEach((key) => {
    safeArray(equipmentToGuideKeys[key]).forEach((guideKey) => set.add(guideKey));
  });

  hazardFlags.forEach((key) => {
    safeArray(hazardToGuideKeys[key]).forEach((guideKey) => set.add(guideKey));
  });

  set.add("cleaning_control");

  return Array.from(set);
}

function getTemplateDefinitionForGuideKey(guideKey, onboarding) {
  const industryType = normalizeText(onboarding.industryType);
  const operatingDays = safeArray(onboarding.operatingDays);

  const hasWeekend =
    operatingDays.includes(6) ||
    operatingDays.includes(7) ||
    operatingDays.includes("Sat") ||
    operatingDays.includes("Sun");

  const defs = {
    receiving_goods: {
      title: "Modtagekontrol",
      category: "receiving",
      frequency: "daily",
      area: "Modtagelse",
      description: "Kontrol af modtagne varer, temperatur, emballage og holdbarhed.",
      tags: ["varer", "modtagelse", "temperatur"],
      equipmentTypes: [],
    },
    fridge_temperature: {
      title: "Temperaturkontrol køleskab",
      category: "temperature",
      frequency: "daily",
      area: "Køl",
      description: "Daglig temperaturkontrol af køleskab.",
      tags: ["køl", "temperatur"],
      equipmentTypes: ["fridge"],
      measurementUnit: "C",
      limitMax: 5,
    },
    freezer_temperature: {
      title: "Temperaturkontrol fryser",
      category: "temperature",
      frequency: "daily",
      area: "Frost",
      description: "Daglig temperaturkontrol af fryser.",
      tags: ["frost", "temperatur"],
      equipmentTypes: ["freezer"],
      measurementUnit: "C",
      limitMax: -18,
    },
    walkin_cooler_temperature: {
      title: "Walk-in køler",
      category: "temperature",
      frequency: "daily",
      area: "Walk-in køler",
      description: "Daglig temperaturkontrol af walk-in køler.",
      tags: ["walk-in", "køl", "temperatur"],
      equipmentTypes: ["walkin_cooler"],
      measurementUnit: "C",
      limitMax: 5,
    },
    cold_storage_placement: {
      title: "Kontrol af korrekt placering i køl",
      category: "storage",
      frequency: "daily",
      area: "Køl",
      description: "Kontrol af korrekt placering og opbevaring i køl.",
      tags: ["placering", "køl", "opbevaring"],
      equipmentTypes: ["fridge", "walkin_cooler"],
    },
    hot_preparation_core_temperature: {
      title: "Kernetemperaturkontrol ved tilberedning",
      category: "preparation",
      frequency: "daily",
      area: "Varm tilberedning",
      description: "Kontrol af kernetemperatur ved tilberedning.",
      tags: ["tilberedning", "kernetemperatur"],
      equipmentTypes: ["oven"],
      measurementUnit: "C",
      limitMin: 75,
    },
    hot_holding: {
      title: "Kontrol af varmholdning",
      category: "temperature",
      frequency: "daily",
      area: "Varmholdning",
      description: "Kontrol af temperatur ved varmholdning.",
      tags: ["varmholdning", "temperatur"],
      equipmentTypes: [],
      measurementUnit: "C",
      limitMin: 65,
    },
    cold_preparation_hygiene: {
      title: "Hygiejnekontrol ved kold tilberedning",
      category: "hygiene",
      frequency: "daily",
      area: "Kold tilberedning",
      description: "Kontrol af allergener, krydskontaminering og hygiejne.",
      tags: ["hygiejne", "allergener", "krydskontaminering"],
      equipmentTypes: ["fish_station", "cutting_area"],
    },
    dishwasher_control: {
      title: "Kontrollér opvaskemaskine vaske-/slutskylletemperatur",
      category: "dishwashing",
      frequency: "daily",
      area: "Opvask",
      description: "Kontrol af industriopvaskemaskinens temperatur og funktion.",
      tags: ["opvaskemaskine", "temperatur"],
      equipmentTypes: ["dishwasher"],
    },
    oven_control: {
      title: "Test ovntemperatur med kalibreret termometer",
      category: "equipment",
      frequency: "weekly",
      daysOfWeek: hasWeekend ? [1, 4] : [2],
      area: "Ovn",
      description: "Kontrol af ovntemperatur og rengøringsstatus.",
      tags: ["ovn", "temperatur", "rengøring"],
      equipmentTypes: ["oven"],
    },
    cleaning_control: {
      title: industryType === "bageri" ? "Rengøring og klargøring" : "Rengøringskontrol",
      category: "cleaning",
      frequency: "daily",
      area: "Rengøring",
      description: "Kontrol af rengøring og renhold.",
      tags: ["rengøring", "renhold"],
      equipmentTypes: [],
    },
  };

  const def = defs[guideKey];
  if (!def) return null;

  return {
    ...def,
    guideKey,
    controlType: guideKey,
  };
}

function generateTemplatesFromOnboarding(onboarding) {
  const companyId = onboarding.companyId || "company_1";
  const locationId = onboarding.locationId || "location_1";
  const createdBy = onboarding.createdBy || "user_michael";
  const nowIso = new Date().toISOString();

  const controlPackages =
    safeArray(onboarding.controlPackages).length > 0
      ? safeArray(onboarding.controlPackages)
      : buildControlPackagesFromOnboarding(onboarding);

  const templates = controlPackages
    .map((guideKey) => {
      const def = getTemplateDefinitionForGuideKey(guideKey, onboarding);
      if (!def) return null;

      const templateId = `tpl_${slugify(def.guideKey)}_${slugify(def.title)}`;

      return {
        templateId,
        title: def.title,
        description: def.description || "",
        companyId,
        locationId,
        createdBy,
        createdAt: nowIso,
        updatedAt: nowIso,
        isActive: true,
        category: def.category || "general",
        area: def.area || "",
        frequency: def.frequency || "daily",
        daysOfWeek: safeArray(def.daysOfWeek),
        daysOfMonth: safeArray(def.daysOfMonth),
        guideKey: def.guideKey,
        controlType: def.controlType,
        equipmentTypes: safeArray(def.equipmentTypes),
        tags: safeArray(def.tags),
        measurementUnit: def.measurementUnit || null,
        limitMin: def.limitMin ?? null,
        limitMax: def.limitMax ?? null,
        source: "onboarding",
        sourceRule: `onboarding_${def.guideKey}`,
      };
    })
    .filter(Boolean);

  return dedupeByTemplateId(templates);
}

async function upsertTemplatesToFirestore(templates) {
  console.log("\n=== UPSERTING TEMPLATES TO FIRESTORE ===\n");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const template of templates) {
    const templateId = template.templateId;
    const docRef = db.collection("task_templates").doc(templateId);

    // Enforce controlType = guideKey
    const templateData = {
      ...template,
      controlType: template.guideKey,
    };

    try {
      const docSnapshot = await docRef.get();

      const existing = docSnapshot.exists ? docSnapshot.data() : null;

      let hasChanges = false;

      if (!existing) {
        hasChanges = true;
      } else {
        hasChanges =
          existing.title !== templateData.title ||
          existing.guideKey !== templateData.guideKey ||
          existing.controlType !== templateData.controlType ||
          existing.description !== templateData.description ||
          existing.frequency !== templateData.frequency ||
          existing.category !== templateData.category ||
          JSON.stringify(existing.tags || []) !== JSON.stringify(templateData.tags || []) ||
          JSON.stringify(existing.equipmentTypes || []) !== JSON.stringify(templateData.equipmentTypes || []);
      }

      if (!existing) {
        await docRef.set(templateData, { merge: true });

        console.log("CREATED TEMPLATE");
        console.log(`TemplateId: ${templateData.templateId}`);
        console.log(`Title: ${templateData.title}`);
        console.log(`GuideKey: ${templateData.guideKey}`);
        console.log(`ControlType: ${templateData.controlType}`);
        console.log("");

        created++;
      } else if (hasChanges) {
        await docRef.set(templateData, { merge: true });

        console.log("UPDATED TEMPLATE");
        console.log(`TemplateId: ${templateData.templateId}`);
        console.log(`Title: ${templateData.title}`);
        console.log(`GuideKey: ${templateData.guideKey}`);
        console.log(`ControlType: ${templateData.controlType}`);
        console.log("");

        updated++;
      } else {
        console.log("SKIPPED TEMPLATE");
        console.log(`TemplateId: ${templateData.templateId}`);
        console.log(`Title: ${templateData.title}`);
        console.log(`Reason: No changes`);
        console.log("");

        skipped++;
      }
    } catch (error) {
      console.error(`Error upserting template ${templateId}:`, error.message);
    }
  }

  console.log("\n=== SUMMARY ===\n");
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log("");
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shouldGenerateForDate(template, date) {
  const frequency = template.frequency;
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayOfMonth = date.getDate();

  if (frequency === "daily") {
    return true;
  }

  if (frequency === "weekdays") {
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday-Friday
  }

  if (frequency === "weekends") {
    return dayOfWeek === 0 || dayOfWeek === 6; // Saturday-Sunday
  }

  if (frequency === "weekly") {
    const daysOfWeek = safeArray(template.daysOfWeek);
    if (daysOfWeek.length === 0) {
      return dayOfWeek === 1; // Default to Monday
    }
    return daysOfWeek.includes(dayOfWeek);
  }

  if (frequency === "monthly") {
    const daysOfMonth = safeArray(template.daysOfMonth);
    if (daysOfMonth.length === 0) {
      return dayOfMonth === 1; // Default to 1st of month
    }
    return daysOfMonth.includes(dayOfMonth);
  }

  return false;
}

async function regenerateTaskInstancesFromTemplates(locationId, date = new Date(), templateIds = null) {
  console.log("\n=== REGENERATING TASK_INSTANCES FROM TEMPLATES ===\n");
  console.log(`LocationId: ${locationId}`);
  console.log(`Date: ${getDateKey(date)}`);
  
  if (templateIds && templateIds.length > 0) {
    console.log("TARGETED REGENERATION");
    console.log(`TemplateIds count: ${templateIds.length}\n`);
  } else {
    console.log("ALL ACTIVE TEMPLATES\n");
  }

  const dateKey = getDateKey(date);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    let templatesSnapshot;

    if (templateIds && templateIds.length > 0) {
      // Targeted regeneration: read only specific templates
      const templateDocs = [];
      for (const templateId of templateIds) {
        const docRef = db.collection("task_templates").doc(templateId);
        const docSnapshot = await docRef.get();
        if (docSnapshot.exists) {
          templateDocs.push(docSnapshot);
        }
      }
      templatesSnapshot = { docs: templateDocs, empty: templateDocs.length === 0, size: templateDocs.length };
    } else {
      // Full regeneration: read all active templates for location
      templatesSnapshot = await db
        .collection("task_templates")
        .where("isActive", "==", true)
        .where("locationId", "==", locationId)
        .get();
    }

    if (templatesSnapshot.empty) {
      console.log("⚠️  No templates found\n");
      return;
    }

    console.log(`Found ${templatesSnapshot.size} templates\n`);

    for (const templateDoc of templatesSnapshot.docs) {
      const template = templateDoc.data();
      const templateId = templateDoc.id;

      // Check if template should generate for this date
      if (!shouldGenerateForDate(template, date)) {
        console.log("SKIPPED TEMPLATE");
        console.log(`TemplateId: ${templateId}`);
        console.log(`Title: ${template.title || "N/A"}`);
        console.log(`Reason: Frequency/date mismatch (${template.frequency})`);
        console.log("");
        skipped++;
        continue;
      }

      // Create task_instance
      const taskInstanceId = `task_${templateId}__${dateKey}`;
      const docRef = db.collection("task_instances").doc(taskInstanceId);

      const taskInstanceData = {
        taskInstanceId,
        templateId,
        title: template.title || "",
        description: template.description || "",
        category: template.category || "",
        area: template.area || "",
        frequency: template.frequency || "daily",
        guideKey: template.guideKey || null,
        controlType: template.guideKey || null, // Enforce controlType = guideKey
        equipmentTypes: safeArray(template.equipmentTypes),
        tags: safeArray(template.tags),
        measurementUnit: template.measurementUnit || null,
        limitMin: template.limitMin ?? null,
        limitMax: template.limitMax ?? null,
        companyId: template.companyId || "",
        locationId: template.locationId || locationId,
        dateKey,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "template_regeneration",
      };

      try {
        const docSnapshot = await docRef.get();

        if (!docSnapshot.exists) {
          // Create new task_instance
          await docRef.set(taskInstanceData);
          console.log("CREATED TASK_INSTANCE");
          console.log(`TaskInstanceId: ${taskInstanceId}`);
          console.log(`TemplateId: ${templateId}`);
          console.log(`Title: ${taskInstanceData.title}`);
          console.log(`GuideKey: ${taskInstanceData.guideKey}`);
          console.log(`ControlType: ${taskInstanceData.controlType}`);
          console.log(`DateKey: ${dateKey}`);
          console.log("");
          created++;
        } else {
          // Update existing task_instance
          await docRef.update(taskInstanceData);
          console.log("UPDATED TASK_INSTANCE");
          console.log(`TaskInstanceId: ${taskInstanceId}`);
          console.log(`TemplateId: ${templateId}`);
          console.log(`Title: ${taskInstanceData.title}`);
          console.log(`GuideKey: ${taskInstanceData.guideKey}`);
          console.log(`ControlType: ${taskInstanceData.controlType}`);
          console.log(`DateKey: ${dateKey}`);
          console.log("");
          updated++;
        }
      } catch (error) {
        console.error(`Error upserting task_instance ${taskInstanceId}:`, error.message);
      }
    }

    console.log("\n=== SUMMARY ===\n");
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log("");
  } catch (error) {
    console.error("Error regenerating task_instances:", error.message);
    throw error;
  }
}

async function run() {
  const onboarding = {
    companyId: "company_1",
    locationId: "location_1",
    createdBy: "user_michael",
    industryType: "restaurant",
    processes: [
      "receiving",
      "storage_chilled",
      "storage_frozen",
      "hot_holding",
      "cold_preparation",
    ],
    equipment: [
      "fridge",
      "freezer",
      "walkin_cooler",
      "dishwasher",
      "oven",
    ],
    hazardFlags: ["allergens"],
    operatingDays: [1, 2, 3, 4, 5, 6],
  };

  const templates = generateTemplatesFromOnboarding(onboarding);

  console.log("\n=== GENERATED TEMPLATES FROM ONBOARDING ===\n");
  console.log(`Generated ${templates.length} templates\n`);

  await upsertTemplatesToFirestore(templates);

  await regenerateTaskInstancesFromTemplates("location_1", new Date(), templates.map(t => t.templateId));
}

run().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
```
