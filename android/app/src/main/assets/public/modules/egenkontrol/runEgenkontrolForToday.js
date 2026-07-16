/**
 * runEgenkontrolForToday.js
 *
 * Frontend-wrapper der finder dagens dato og orkestrerer
 * hele egenkontrol-flowet via syncAndGenerateEgenkontrolForDate.
 *
 * Indeholder ingen Firestore-, generator- eller template-logik.
 *
 * Brug:
 *   const result = await runEgenkontrolForToday({
 *     companyId, locationId, createdBy, createdByName
 *   });
 */

import { syncAndGenerateEgenkontrolForDate } from "./syncAndGenerateEgenkontrolForDate.js";

function getTodayDateKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Copenhagen",
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
  }).format(new Date());
}

/**
 * @param {{
 *   companyId:     string,
 *   locationId:    string,
 *   createdBy:     string,
 *   createdByName: string
 * }} params
 * @returns {Promise<object>}
 */
export async function runEgenkontrolForToday({
  companyId,
  locationId,
  createdBy,
  createdByName = "",
}) {
  if (!companyId)  throw new Error("runEgenkontrolForToday: companyId mangler.");
  if (!locationId) throw new Error("runEgenkontrolForToday: locationId mangler.");
  if (!createdBy)  throw new Error("runEgenkontrolForToday: createdBy mangler.");

  const dateKey = getTodayDateKey();

  const result = await syncAndGenerateEgenkontrolForDate({
    companyId,
    locationId,
    dateKey,
    createdBy,
    createdByName,
  });

  return {
    ...result,
    ranAt: new Date().toISOString(),
  };
}
