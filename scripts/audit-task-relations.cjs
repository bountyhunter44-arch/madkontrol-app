const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const serviceAccount = require("../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

function formatTimestamp(value) {
  if (!value) return "";
  try {
    if (typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }
    return String(value);
  } catch {
    return String(value);
  }
}

function looksLikeDeterministicId(id) {
  return typeof id === "string" && id.includes("__");
}

function deriveDateKeyFromId(id) {
  if (!id || typeof id !== "string") return "";
  const parts = id.split("__");
  const maybeDate = parts[parts.length - 1] || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(maybeDate) ? maybeDate : "";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

async function loadCollection(name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((doc) => ({
    docId: doc.id,
    ...doc.data()
  }));
}

async function run() {
  const [taskInstances, taskTemplates] = await Promise.all([
    loadCollection("task_instances"),
    loadCollection("task_templates")
  ]);

  const templatesById = new Map();
  for (const tpl of taskTemplates) {
    templatesById.set(tpl.docId, tpl);
  }

  const rows = [];
  const missingTemplateRef = [];
  const missingDateKey = [];
  const nonDeterministicIds = [];
  const duplicateGroupsMap = new Map();
  const templateUsageMap = new Map();

  for (const item of taskInstances) {
    const docId = item.docId;
    const taskInstanceId = item.taskInstanceId || "";
    const templateId = item.templateId || "";
    const locationId = item.locationId || "";
    const title = item.title || "";
    const description = item.description || "";
    const category = item.category || "";
    const guideKey = item.guideKey || "";
    const controlType = item.controlType || "";
    const status = item.status || "";
    const createdAt = formatTimestamp(item.createdAt);
    const completedAt = formatTimestamp(item.completedAt);

    const dateKey =
      item.dateKey ||
      deriveDateKeyFromId(docId) ||
      deriveDateKeyFromId(taskInstanceId) ||
      "";

    const deterministicDocId = looksLikeDeterministicId(docId);
    const deterministicTaskInstanceId = looksLikeDeterministicId(taskInstanceId);

    const template = templatesById.get(templateId) || null;

    const templateSummary = template
      ? {
          templateDocId: template.docId || "",
          templateTitle: template.title || "",
          templateDescription: template.description || "",
          templateCategory: template.category || "",
          templateGuideKey: template.guideKey || "",
          templateControlType: template.controlType || "",
          templateFrequency: template.frequency || "",
          templateLocationId: template.locationId || ""
        }
      : null;

    if (!dateKey) {
      missingDateKey.push({
        docId,
        taskInstanceId,
        templateId,
        title,
        locationId,
        createdAt
      });
    }

    if (!deterministicDocId || !deterministicTaskInstanceId) {
      nonDeterministicIds.push({
        docId,
        taskInstanceId,
        templateId,
        title,
        dateKey,
        locationId,
        deterministicDocId,
        deterministicTaskInstanceId
      });
    }

    if (templateId && !template) {
      missingTemplateRef.push({
        docId,
        taskInstanceId,
        templateId,
        title,
        dateKey,
        locationId
      });
    }

    if (templateId) {
      if (!templateUsageMap.has(templateId)) {
        templateUsageMap.set(templateId, []);
      }
      templateUsageMap.get(templateId).push({
        docId,
        taskInstanceId,
        title,
        dateKey,
        locationId,
        status,
        category,
        guideKey,
        controlType
      });
    }

    const duplicateKey = [
      normalizeText(locationId),
      normalizeText(dateKey),
      normalizeText(title),
      normalizeText(guideKey),
      normalizeText(controlType)
    ].join(" | ");

    if (!duplicateGroupsMap.has(duplicateKey)) {
      duplicateGroupsMap.set(duplicateKey, []);
    }

    duplicateGroupsMap.get(duplicateKey).push({
      docId,
      taskInstanceId,
      templateId,
      title,
      description,
      category,
      guideKey,
      controlType,
      locationId,
      dateKey,
      status,
      createdAt
    });

    rows.push({
      docId,
      taskInstanceId,
      templateId,
      locationId,
      dateKey,
      title,
      description,
      category,
      guideKey,
      controlType,
      status,
      createdAt,
      completedAt,
      deterministicDocId,
      deterministicTaskInstanceId,
      templateFound: !!template,
      templateSummary
    });
  }

  const duplicateGroups = [];
  for (const [duplicateKey, items] of duplicateGroupsMap.entries()) {
    if (items.length > 1) {
      duplicateGroups.push({
        duplicateKey,
        count: items.length,
        items
      });
    }
  }

  const templatesWithMultipleInstancesSameDay = [];
  for (const [templateId, items] of templateUsageMap.entries()) {
    const byLocationAndDate = new Map();

    for (const item of items) {
      const key = `${normalizeText(item.locationId)} | ${normalizeText(item.dateKey)}`;
      if (!byLocationAndDate.has(key)) {
        byLocationAndDate.set(key, []);
      }
      byLocationAndDate.get(key).push(item);
    }

    for (const [key, grouped] of byLocationAndDate.entries()) {
      if (grouped.length > 1) {
        templatesWithMultipleInstancesSameDay.push({
          templateId,
          locationDateKey: key,
          count: grouped.length,
          items: grouped
        });
      }
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    collectionsScanned: ["task_instances", "task_templates"],
    totals: {
      taskInstances: taskInstances.length,
      taskTemplates: taskTemplates.length,
      missingDateKey: missingDateKey.length,
      nonDeterministicIds: nonDeterministicIds.length,
      missingTemplateRef: missingTemplateRef.length,
      duplicateGroups: duplicateGroups.length,
      templatesWithMultipleInstancesSameDay: templatesWithMultipleInstancesSameDay.length
    },
    allRows: rows,
    missingDateKey,
    nonDeterministicIds,
    missingTemplateRef,
    duplicateGroups,
    templatesWithMultipleInstancesSameDay
  };

  const outputPath = path.join(process.cwd(), "audit-task-relations.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log(`Færdig. JSON skrevet til: ${outputPath}`);
  console.log(`task_instances: ${taskInstances.length}`);
  console.log(`task_templates: ${taskTemplates.length}`);
  console.log(`missingDateKey: ${missingDateKey.length}`);
  console.log(`nonDeterministicIds: ${nonDeterministicIds.length}`);
  console.log(`missingTemplateRef: ${missingTemplateRef.length}`);
  console.log(`duplicateGroups: ${duplicateGroups.length}`);
  console.log(`templatesWithMultipleInstancesSameDay: ${templatesWithMultipleInstancesSameDay.length}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Audit fejl:", error);
    process.exit(1);
  });