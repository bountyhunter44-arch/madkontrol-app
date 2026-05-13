/**
 * cleanupDuplicateTaskInstances.cjs
 *
 * Finder og arkiverer/sletter dublerede task_instances i Firestore.
 *
 * Primær grupperingsnøgle:  companyId + locationId + dateKey + templateId
 * Fallback nøgle:           companyId + locationId + dateKey + controlType + normalizedTitle + equipmentUnit
 *
 * REGLER:
 *   MÅ IKKE slettes: completed, failed, har entries, har alerts, billedattachments, rapport-referencer
 *   MÅ arkiveres:    pending dubletter med referencer (daily_reports, task_entries, alerts, attachments)
 *   MÅ slettes:      pending dubletter uden nogen referencer
 *
 * Sæt DRY_RUN = false for at skrive til Firestore.
 */

"use strict";

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

// ─── KONFIGURATION ───────────────────────────────────────────────────────────
const DRY_RUN        = true;
const ARCHIVE_REASON = "duplicate-instance-cleanup";
// ─────────────────────────────────────────────────────────────────────────────

const PROTECTED_STATUSES = new Set(["completed", "failed", "not_in_use"]);

function normalizeTitle(title) {
  return (title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function primaryKey(doc) {
  const d = doc.data;
  const companyId  = d.companyId  || d.organizationId || "";
  const locationId = d.locationId || "";
  const dateKey    = d.dateKey    || "";
  const templateId = d.templateId || "";
  if (!templateId) return null;
  return `${companyId}|${locationId}|${dateKey}|${templateId}`;
}

function fallbackKey(doc) {
  const d = doc.data;
  const companyId   = d.companyId  || d.organizationId || "";
  const locationId  = d.locationId || "";
  const dateKey     = d.dateKey    || "";
  const controlType = d.controlType || d.templateKey || d.definitionKey || "";
  const title       = normalizeTitle(d.title);
  const unit        = d.equipmentUnit || d.equipmentId || d.unitId || d.areaName || "";
  return `${companyId}|${locationId}|${dateKey}|${controlType}|${title}|${unit}`;
}

/**
 * Scorer en instans: højere = bedre at bevare.
 */
function score(doc) {
  const d = doc.data;
  let s = 0;
  if (PROTECTED_STATUSES.has(d.status))             s += 500;
  if (d.entries && Object.keys(d.entries).length)   s += 200;
  if (d.hasEntries === true)                        s += 200;
  if (d.alerts && d.alerts.length)                  s += 100;
  if (d.hasAlerts === true)                         s += 100;
  if (d.imageUrl || d.attachmentUrl)                s +=  80;
  // Nyere updatedAt
  const ts = d.updatedAt?.toMillis?.() || (d.updatedAt?._seconds || 0) * 1000;
  s += Math.floor(ts / 1e10);
  return s;
}

/**
 * Tjekker om instansen har referencer i: daily_reports, task_entries, alerts, attachments.
 * Returnerer { hasRef: bool, reason: string }
 */
async function checkReferences(instanceId) {
  const checks = await Promise.all([
    // task_entries
    db.collection("task_entries")
      .where("taskInstanceId", "==", instanceId)
      .limit(1)
      .get()
      .then((s) => ({ col: "task_entries", found: !s.empty })),

    // alerts
    db.collection("alerts")
      .where("taskInstanceId", "==", instanceId)
      .limit(1)
      .get()
      .then((s) => ({ col: "alerts", found: !s.empty })),

    // attachments
    db.collection("attachments")
      .where("taskInstanceId", "==", instanceId)
      .limit(1)
      .get()
      .then((s) => ({ col: "attachments", found: !s.empty })),

    // daily_reports
    db.collection("daily_reports")
      .where("instanceIds", "array-contains", instanceId)
      .limit(1)
      .get()
      .then((s) => ({ col: "daily_reports", found: !s.empty })),
  ]);

  const hits = checks.filter((c) => c.found);
  return {
    hasRef: hits.length > 0,
    reason: hits.map((c) => c.col).join(","),
  };
}

async function main() {
  console.log(`[cleanupInstances] DRY_RUN=${DRY_RUN}`);

  // ── 1. Hent alle task_instances ──────────────────────────────────────────────
  const snap = await db.collection("task_instances").get();
  const allDocs = snap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() }));
  console.log(`[cleanupInstances] found=${allDocs.length}`);

  // ── 2. Gruppér (primær nøgle) ────────────────────────────────────────────────
  const groups = new Map();

  for (const doc of allDocs) {
    const pk = primaryKey(doc);
    const fk = fallbackKey(doc);
    const key = pk || fk;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  let totalGroups  = 0;
  let toArchive    = 0;
  let toDelete     = 0;
  let skipped      = 0;
  const archiveOps = [];
  const deleteOps  = [];

  // ── 3. Per gruppe: vælg canonical, håndtér resten ───────────────────────────
  for (const [key, members] of groups.entries()) {
    totalGroups++;
    if (members.length === 1) continue;

    members.sort((a, b) => score(b) - score(a));
    const canonical   = members[0];
    const duplicates  = members.slice(1);

    console.log(`\nGROUP: ${key}`);
    console.log(`  KEEP: ${canonical.id} (score=${score(canonical)}, status=${canonical.data.status})`);

    for (const dup of duplicates) {
      const d = dup.data;

      // Beskyttet status
      if (PROTECTED_STATUSES.has(d.status)) {
        console.log(`  SKIP: ${dup.id} reason=protectedStatus(${d.status})`);
        skipped++;
        continue;
      }

      // Allerede arkiveret
      if (d.isArchived === true) {
        console.log(`  SKIP: ${dup.id} reason=alreadyArchived`);
        skipped++;
        continue;
      }

      // Tjek data-felter direkte
      const hasLocalData =
        (d.entries && Object.keys(d.entries).length > 0) ||
        d.hasEntries === true ||
        (d.alerts && d.alerts.length > 0) ||
        d.hasAlerts === true ||
        d.imageUrl ||
        d.attachmentUrl;

      if (hasLocalData) {
        console.log(`  ARCHIVE: ${dup.id} reason=hasLocalData`);
        archiveOps.push({
          ref: dup.ref,
          payload: {
            isArchived:     true,
            archivedAt:     admin.firestore.FieldValue.serverTimestamp(),
            archivedReason: ARCHIVE_REASON,
          },
        });
        toArchive++;
        continue;
      }

      // Tjek Firestore-referencer (kun for non-DRY_RUN eller i dry-run for logging)
      const { hasRef, reason } = await checkReferences(dup.id);

      if (hasRef) {
        console.log(`  ARCHIVE: ${dup.id} reason=hasRef(${reason})`);
        archiveOps.push({
          ref: dup.ref,
          payload: {
            isArchived:     true,
            archivedAt:     admin.firestore.FieldValue.serverTimestamp(),
            archivedReason: `${ARCHIVE_REASON}:${reason}`,
          },
        });
        toArchive++;
      } else {
        // Hard delete kun for status pending eller tom — aldrig for ukendte statuser
        const status = (d.status || "").trim().toLowerCase();
        if (status === "pending" || status === "") {
          console.log(`  DELETE: ${dup.id} (status=${status || "tom"}, no refs, no data)`);
          deleteOps.push(dup.ref);
          toDelete++;
        } else {
          console.log(`  ARCHIVE: ${dup.id} reason=unknownStatus(${status})`);
          archiveOps.push({
            ref: dup.ref,
            payload: {
              isArchived:     true,
              archivedAt:     admin.firestore.FieldValue.serverTimestamp(),
              archivedReason: `${ARCHIVE_REASON}:unknownStatus`,
            },
          });
          toArchive++;
        }
      }
    }
  }

  console.log(
    `\n[cleanupInstances] found=${allDocs.length} groups=${totalGroups} archive=${toArchive} delete=${toDelete} skipped=${skipped}`
  );

  if (DRY_RUN) {
    console.log("[cleanupInstances] DRY_RUN – ingen ændringer skrevet til Firestore.");
    return;
  }

  // ── 4. Arkivér i batches ─────────────────────────────────────────────────────
  const BATCH_SIZE = 400;
  for (let i = 0; i < archiveOps.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const op of archiveOps.slice(i, i + BATCH_SIZE)) {
      batch.update(op.ref, op.payload);
    }
    await batch.commit();
    console.log(`[cleanupInstances] archived batch ${Math.floor(i / BATCH_SIZE) + 1}`);
  }

  // ── 5. Slet i batches ────────────────────────────────────────────────────────
  for (let i = 0; i < deleteOps.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of deleteOps.slice(i, i + BATCH_SIZE)) {
      batch.delete(ref);
    }
    await batch.commit();
    console.log(`[cleanupInstances] deleted batch ${Math.floor(i / BATCH_SIZE) + 1}`);
  }

  console.log("[cleanupInstances] done.");
}

main().catch((err) => {
  console.error("[cleanupInstances] FEJL:", err);
  process.exit(1);
});
