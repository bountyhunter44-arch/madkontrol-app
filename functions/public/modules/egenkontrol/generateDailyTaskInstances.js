/**
 * generateDailyTaskInstances.js
 *
 * Genererer daglige task_instances fra task_templates for én dato.
 */

import { db } from "../../core/firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { isActiveForDate } from "./controlLibraryHelpers.js";

const BATCH_LIMIT = 499;

/**
 * Bygger dueAt = slutningen af dagen (23:59:59.999)
 */
function buildDueAtFromDateKey(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return null;

  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export async function generateDailyTaskInstances({
  companyId,
  locationId,
  dateKey,
  createdBy,
  createdByName = "",
}) {
  if (!companyId) throw new Error("generateDailyTaskInstances: companyId mangler.");
  if (!locationId) throw new Error("generateDailyTaskInstances: locationId mangler.");
  if (!dateKey) throw new Error("generateDailyTaskInstances: dateKey mangler.");
  if (!createdBy) throw new Error("generateDailyTaskInstances: createdBy mangler.");

  console.log("[generateDailyTaskInstances] START", { companyId, locationId, dateKey });

  // ── 1. Hent templates ─────────────────────────────────────────────
  const templatesSnap = await getDocs(
    query(
      collection(db, "task_templates"),
      where("companyId", "==", companyId),
      where("locationId", "==", locationId),
      where("isActive", "==", true)
    )
  );

  const templates = templatesSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  // ── 2. Hent eksisterende instances ────────────────────────────────
  const existingSnap = await getDocs(
    query(
      collection(db, "task_instances"),
      where("companyId", "==", companyId),
      where("locationId", "==", locationId),
      where("dateKey", "==", dateKey)
    )
  );

  const existingDocs = existingSnap.docs;
  const existingTemplateIds = new Set(
    existingDocs.map((d) => d.data().templateId).filter(Boolean)
  );

  // ── 3. Sortér ─────────────────────────────────────────────────────
  const toCreate = [];
  const toUpdate = [];
  const skippedInactiveIds = [];
  const skippedExistingIds = [];

  for (const template of templates) {
    const instanceId = `${template.templateId}__${dateKey}`;

    const existingDoc = existingDocs.find(
      (d) => d.data().templateId === template.templateId
    );

    // Hvis findes → patch (inkl. dueAt)
    if (existingDoc) {
      skippedExistingIds.push(instanceId);

      const existingData = existingDoc.data();
      const dueAt = buildDueAtFromDateKey(dateKey);

      const missingEquipmentName =
        !!template.equipmentName && !existingData.equipmentName;

      const missingAreaName =
        !!template.areaName && !existingData.areaName;

      const missingDueAt = !existingData.dueAt;

      if (missingEquipmentName || missingAreaName || missingDueAt) {
        toUpdate.push({
          ref: existingDoc.ref,
          equipmentName: missingEquipmentName
            ? template.equipmentName ?? ""
            : existingData.equipmentName ?? "",
          areaName: missingAreaName
            ? template.areaName ?? ""
            : existingData.areaName ?? "",
          dueAt: missingDueAt ? dueAt : existingData.dueAt ?? null,
        });
      }

      continue;
    }

    // Aktiv?
    const { active } = isActiveForDate(template, dateKey);
    if (!active) {
      skippedInactiveIds.push(instanceId);
      continue;
    }

    toCreate.push({ template, instanceId });
  }

  // ── 4. Opret nye instances ────────────────────────────────────────
  const createdIds = [];

  for (let i = 0; i < toCreate.length; i += BATCH_LIMIT) {
    const chunk = toCreate.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);

    for (const { template, instanceId } of chunk) {
      const ref = doc(db, "task_instances", instanceId);
      const dueAt = buildDueAtFromDateKey(dateKey);

      batch.set(ref, {
        taskInstanceId: instanceId,
        templateId: template.templateId,
        definitionKey: template.controlType || template.templateId,
        companyId,
        organizationId: companyId,
        locationId,
        title: template.title ?? "",
        description: template.description ?? "",
        equipmentName: template.equipmentName ?? "",
        areaName: template.areaName ?? "",
        equipmentType: template.equipmentType ?? "",
        category: template.category ?? "",
        controlType: template.controlType ?? "",
        libraryType: "operational",
        dateKey,
        status: "pending",
        frequency: template.frequency ?? null,
        frequencyType: template.frequencyType ?? null,
        frequencyDays: template.frequencyDays ?? null,
        interval_days: template.interval_days ?? null,
        scheduleConfig: template.scheduleConfig ?? null,
        riskLevel: template.riskLevel ?? "medium",
        fields: template.fields ?? [],
        rules: template.rules ?? [],
        actions: template.actions ?? {},
        guideTitle: template.guideTitle ?? "",
        guideBody: template.guideBody ?? "",
        dueAt,
        createdBy,
        createdByName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      createdIds.push(instanceId);
    }

    await batch.commit();
  }

  // ── 5. Patch eksisterende (inkl. dueAt) ───────────────────────────
  for (let i = 0; i < toUpdate.length; i += BATCH_LIMIT) {
    const chunk = toUpdate.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);

    for (const { ref, equipmentName, areaName, dueAt } of chunk) {
      batch.update(ref, {
        equipmentName,
        areaName,
        dueAt,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  }

  console.log("[generateDailyTaskInstances] DONE", {
    created: createdIds.length,
    updated: toUpdate.length,
  });

  return {
    success: true,
    dateKey,
    counts: {
      scanned: templates.length,
      eligible: toCreate.length,
      created: createdIds.length,
      skippedExisting: skippedExistingIds.length,
      skippedInactive: skippedInactiveIds.length,
    },
    createdIds,
    skippedExistingIds,
    skippedInactiveIds,
  };
}