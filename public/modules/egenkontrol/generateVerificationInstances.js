/**
 * generateVerificationInstances.js
 *
 * Genererer verification_instances baseret på verification_templates
 * med interval_days-logik. Tjekker for eksisterende pending instanser
 * og springer over hvis forfaldsdato endnu ikke er nået.
 *
 * Skriver KUN til:
 *   verification_instances/
 *
 * Opretter ALDRIG:
 *   task_instances/
 *   program_sections/
 *   program_answers/
 *
 * Brug:
 *   const result = await generateVerificationInstances({
 *     companyId, locationId, nowDateKey, createdBy, createdByName
 *   });
 */

import { db }              from "../../core/firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  writeBatch,
  serverTimestamp,
}                          from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { isActiveForDate, getNextDueDate } from "./controlLibraryHelpers.js";

const BATCH_LIMIT = 499;

/**
 * Timeout wrapper for promises
 */
const withTimeout = (promise, label, ms = 8000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);

/**
 * @param {{
 *   companyId:     string,
 *   locationId:    string,
 *   nowDateKey:    string,   // YYYY-MM-DD
 *   createdBy:     string,
 *   createdByName: string
 * }} params
 * @returns {Promise<{
 *   success: boolean,
 *   nowDateKey: string,
 *   counts: {
 *     scanned: number,
 *     eligible: number,
 *     created: number,
 *     skippedExisting: number,
 *     skippedInactive: number
 *   },
 *   createdIds: string[],
 *   skippedExistingIds: string[],
 *   skippedInactiveIds: string[]
 * }>}
 */
export async function generateVerificationInstances({
  companyId,
  locationId,
  nowDateKey,
  createdBy,
  createdByName = "",
}) {
  try {
    if (!companyId)   throw new Error("generateVerificationInstances: companyId mangler.");
    if (!locationId)  throw new Error("generateVerificationInstances: locationId mangler.");
    if (!nowDateKey)  throw new Error("generateVerificationInstances: nowDateKey mangler.");
    if (!createdBy)   throw new Error("generateVerificationInstances: createdBy mangler.");

    console.log("[generateVerificationInstances] step 1: querying verification_templates...");
    console.log("[generateVerificationInstances] params:", {
      companyId,
      locationId,
      nowDateKey: nowDateKey,
      createdBy,
      createdByName
    });

    // ── 1. Hent aktive verification_templates ────────────────────────────────────
    console.log("[generateVerificationInstances] BEFORE getDocs - collection:", "verification_templates");
    console.log("[generateVerificationInstances] BEFORE getDocs - constraints:", [
      { field: "companyId", op: "==", value: companyId },
      { field: "locationId", op: "==", value: locationId },
      { field: "isActive", op: "==", value: true }
    ]);

    const q = query(
      collection(db, "verification_templates"),
      where("companyId",  "==", companyId),
      where("locationId", "==", locationId),
      where("isActive",   "==", true)
    );

    console.log("[generateVerificationInstances] executing getDocs with 8s timeout...");
    const templatesSnap = await withTimeout(
      getDocs(q),
      "verification_templates query"
    );

    console.log("[generateVerificationInstances] step 2: verification_templates result", {
      size: templatesSnap.size,
      empty: templatesSnap.empty
    });

    // Log each doc
    templatesSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      console.log("[generateVerificationInstances] template doc", {
        id: docSnap.id,
        companyId: data.companyId,
        organizationId: data.organizationId,
        locationId: data.locationId,
        active: data.active,
        enabled: data.enabled,
        isActive: data.isActive,
        routineType: data.routineType,
        templateKey: data.templateKey,
        canonicalTaskKey: data.canonicalTaskKey,
        controlType: data.controlType,
        title: data.title
      });
    });

    const templates = templatesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log("[generateVerificationInstances] templates array length:", templates.length);

  // ── 2. Hent eksisterende pending instanser (dublet-check per templateId) ──────
  const pendingSnap = await getDocs(
    query(
      collection(db, "verification_instances"),
      where("companyId",  "==", companyId),
      where("locationId", "==", locationId),
      where("status",     "==", "pending")
    )
  );

  const pendingTemplateIds = new Set(
    pendingSnap.docs.map((d) => d.data().templateId).filter(Boolean)
  );

  // ── 3. Find seneste afsluttede instans per template ──────────────────────────
  // Henter én gang alle ikke-pending instanser for at undgå N+1 queries
  const completedSnap = await getDocs(
    query(
      collection(db, "verification_instances"),
      where("companyId",  "==", companyId),
      where("locationId", "==", locationId),
      where("status",     "in", ["completed", "failed"])
    )
  );

  // Byg map: templateId → seneste dateKey (string-sort er tilstrækkelig for YYYY-MM-DD)
  const latestDateKeyByTemplateId = new Map();
  for (const d of completedSnap.docs) {
    const data = d.data();
    if (!data.templateId) continue;
    const existing = latestDateKeyByTemplateId.get(data.templateId);
    // dateKey YYYY-MM-DD — alfabetisk sammenligning giver korrekt datosortering
    if (!existing || (data.dateKey ?? "") > existing) {
      latestDateKeyByTemplateId.set(data.templateId, data.dateKey ?? null);
    }
  }

  // ── 4. Sorter templates i eligible / skipped ─────────────────────────────────
  const toCreate           = [];
  const skippedInactiveIds = [];
  const skippedExistingIds = [];

  for (const template of templates) {
    const instanceId = `${template.templateId}__${nowDateKey}`;

    // Dublet: der findes allerede en pending instans for denne template
    if (pendingTemplateIds.has(template.templateId)) {
      skippedExistingIds.push(instanceId);
      continue;
    }

    const lastDateKey = latestDateKeyByTemplateId.get(template.templateId) ?? null;

    // isActiveForDate håndterer interval_days-logik og returnerer false for alt andet
    const { active } = isActiveForDate(template, nowDateKey, lastDateKey);
    if (!active) {
      skippedInactiveIds.push(instanceId);
      continue;
    }

    // Beregn dueAt
    let dueDateKey;
    if (lastDateKey) {
      dueDateKey = getNextDueDate(template, lastDateKey) ?? nowDateKey;
    } else {
      dueDateKey = nowDateKey;
    }
    const dueDateISO = new Date(dueDateKey + "T00:00:00.000Z").toISOString();

    toCreate.push({ template, instanceId, dueDateISO, lastDateKey });
  }

  // ── 5. Batch write ───────────────────────────────────────────────────────────
  const createdIds = [];

  for (let i = 0; i < toCreate.length; i += BATCH_LIMIT) {
    const chunk = toCreate.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);

    for (const { template, instanceId, dueDateISO } of chunk) {
      const ref = doc(db, "verification_instances", instanceId);
      batch.set(ref, {
        verificationInstanceId: instanceId,
        templateId:    template.templateId,
        definitionKey: template.controlType ?? template.templateId,
        companyId,
        locationId,
        title:         template.title          ?? "",
        controlType:   template.controlType    ?? "",
        libraryType:   "verification",
        dateKey:       nowDateKey,
        dueAt:         dueDateISO,
        status:        "pending",
        frequency:     template.frequency      ?? null,
        riskLevel:     template.riskLevel      ?? "medium",
        fields:        template.fields         ?? [],
        actions:       template.actions        ?? {},
        guideTitle:    template.guideTitle     ?? "",
        guideBody:     template.guideBody      ?? "",
        createdBy,
        createdByName,
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
      });
      createdIds.push(instanceId);
    }

    await batch.commit();
  }

    // ── 6. Returnér resultat ─────────────────────────────────────────────────────
    return {
      success: true,
      nowDateKey,
      counts: {
        scanned:         templates.length,
        eligible:        toCreate.length,
        created:         createdIds.length,
        skippedExisting: skippedExistingIds.length,
        skippedInactive: skippedInactiveIds.length,
      },
      createdIds,
      skippedExistingIds,
      skippedInactiveIds,
    };
  } catch (error) {
    console.error("[generateVerificationInstances] FAILED", {
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
      companyId,
      locationId,
      nowDateKey
    });
    throw error;
  }
}
