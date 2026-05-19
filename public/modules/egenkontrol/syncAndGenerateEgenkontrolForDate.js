/**
 * syncAndGenerateEgenkontrolForDate.js
 *
 * Orkestrerer hele egenkontrol-flowet i korrekt rækkefølge:
 *   1. Sync control templates til Firestore
 *   2. Generér daglige task_instances
 *   3. Generér verification_instances
 *
 * Fejler én step stopper flowet — ingen silent failures.
 *
 * Brug:
 *   const result = await syncAndGenerateEgenkontrolForDate({
 *     companyId, locationId, dateKey, createdBy, createdByName
 *   });
 */

// DISABLED: syncControlTemplatesToFirestore – templates styres nu kun af backend (startDayForLocation)
// import { syncControlTemplatesToFirestore }  from "./syncControlTemplatesToFirestore.js";

// DISABLED: generateDailyTaskInstances – task_instances styres nu kun af backend (startDayForLocation)
// import { generateDailyTaskInstances }       from "./generateDailyTaskInstances.js";

import { generateVerificationInstances }    from "./generateVerificationInstances.js";

/**
 * @param {{
 *   companyId:     string,
 *   locationId:    string,
 *   dateKey:       string,   // YYYY-MM-DD
 *   createdBy:     string,
 *   createdByName: string
 * }} params
 * @returns {Promise<{
 *   success: boolean,
 *   dateKey: string,
 *   sync: object,
 *   daily: object,
 *   verification: object,
 *   summary: {
 *     taskTemplates: number,
 *     verificationTemplates: number,
 *     programSections: number,
 *     dailyCreated: number,
 *     verificationCreated: number
 *   }
 * }>}
 */
export async function syncAndGenerateEgenkontrolForDate({
  companyId,
  locationId,
  dateKey,
  createdBy,
  createdByName = "",
}) {
  if (!companyId)  throw new Error("syncAndGenerateEgenkontrolForDate: companyId mangler.");
  if (!locationId) throw new Error("syncAndGenerateEgenkontrolForDate: locationId mangler.");
  if (!dateKey)    throw new Error("syncAndGenerateEgenkontrolForDate: dateKey mangler.");
  if (!createdBy)  throw new Error("syncAndGenerateEgenkontrolForDate: createdBy mangler.");

  // ── Trin 1: DISABLED – templates styres af backend (startDayForLocation) ───────
  // syncControlTemplatesToFirestore er deaktiveret; client skriver ikke længere templates.
  const syncResult = { counts: { taskTemplates: 0, verificationTemplates: 0, programSections: 0 } };

  // ── Trin 2: DISABLED – task_instances styres af backend (startDayForLocation) ──
  // generateDailyTaskInstances er deaktiveret; client skriver ikke længere task_instances.
  const dailyResult = {
    counts: { scanned: 0, eligible: 0, created: 0, skippedExisting: 0, skippedInactive: 0 },
    createdIds: [],
    skippedExistingIds: [],
    skippedInactiveIds: [],
  };

  // ── Trin 3: Generér verification_instances ───────────────────────────────────
  console.log("[syncAndGenerate] trin 3: generateVerificationInstances...");
  const verificationResult = await generateVerificationInstances({
    companyId,
    locationId,
    nowDateKey: dateKey,
    createdBy,
    createdByName,
  });

  // ── Returnér samlet resultat ─────────────────────────────────────────────────
  return {
    success: true,
    dateKey,
    sync:         syncResult,
    daily:        dailyResult,
    verification: verificationResult,
    summary: {
      taskTemplates:         syncResult.counts.taskTemplates,
      verificationTemplates: syncResult.counts.verificationTemplates,
      programSections:       syncResult.counts.programSections,
      dailyCreated:          dailyResult.counts.created,
      verificationCreated:   verificationResult.counts.created,
    },
  };
}
