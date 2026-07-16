/**
 * migrateAroidTaskEntriesLegacyToCanonical.js
 *
 * Migrate COMPLIANCE/AUDIT task_entries (registrations) from the legacy Aroi-D scope to the
 * canonical scope, so the full HACCP history lives in the same scope as masterdata + future
 * employee registrations.
 *
 * DRY-RUN by default. Pass --apply to write. NO hard delete. Legacy docs are NEVER modified.
 *
 * Rewrites on each copied entry:
 *   companyId, organizationId -> targetCompanyId
 *   locationId               -> targetLocationId
 *   equipmentId              -> remapped via legacy->canonical equipment map (if found)
 *   taskId/templateId/taskInstanceId/sourceTaskInstanceId -> legacy scope tokens replaced with canonical
 * Preserves everything else (measurements, temperature, documentation, completedAt/performedAt,
 * completedBy/performedBy/createdBy, media/file refs, equipmentName, status, comments, ...).
 * Adds owner metadata (real_owner) + restore metadata (restoredFrom*, restoreBatchId, restoredBy, restoredAt).
 *
 * Idempotent: deterministic target doc IDs derived from source doc id; re-run overwrites the same
 * target (no duplicates). If a target doc already exists WITHOUT matching restore metadata -> CONFLICT (stop).
 *
 * Usage (DRY-RUN):
 *   node --use-system-ca functions/scripts/migrateAroidTaskEntriesLegacyToCanonical.js \
 *     --sourceCompanyId="company_1778453641187_xxaoilz18" \
 *     --sourceLocationId="location_1778453641187_fbljxh1ym" \
 *     --targetCompanyId="onboarding_aroi-d_42405000" \
 *     --targetLocationId="onboarding_aroi-d_42405000__main" \
 *     --restoreBatchId="restore_aroi_d_entries_2026_06_15_001"
 */

"use strict";

const path = require("path");
const admin = require("firebase-admin");

const RESTORED_BY = "migrateAroidTaskEntriesLegacyToCanonical";
const AROID_NAME_HINT = "aroi";
const MAX_BATCH = 450;

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq === -1) args[raw.slice(2)] = true;
    else args[raw.slice(2, eq)] = raw.slice(eq + 1);
  }
  return args;
}
function fail(m) { console.error("\n[STOP] " + m); process.exit(1); }
function sanitizeScopeSegment(v) { return String(v || "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_"); }

async function main() {
  const args = parseArgs(process.argv);
  const APPLY = args.apply === true;
  const ctx = {
    sourceCompanyId: args.sourceCompanyId || "",
    sourceLocationId: args.sourceLocationId || "",
    targetCompanyId: args.targetCompanyId || "",
    targetLocationId: args.targetLocationId || "",
    restoreBatchId: args.restoreBatchId || ""
  };

  if (!ctx.restoreBatchId) fail("restoreBatchId mangler (--restoreBatchId paakraevet).");
  for (const k of ["sourceCompanyId", "sourceLocationId", "targetCompanyId", "targetLocationId"]) {
    if (!ctx[k]) fail(`${k} mangler.`);
  }
  if (ctx.targetCompanyId === ctx.sourceCompanyId) fail("targetCompanyId == sourceCompanyId — afvist.");
  if (ctx.targetLocationId === ctx.sourceLocationId) fail("targetLocationId == sourceLocationId — afvist.");

  if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  const ownerScope = { ownerKind: "real_owner", ownerLabel: "Rigtig owner", isDemoScope: false, scopeType: "customer" };

  console.log("==================================================");
  console.log("migrateAroidTaskEntriesLegacyToCanonical");
  console.log("MODE:", APPLY ? "APPLY (WRITES)" : "DRY-RUN (no writes)");
  console.log("restoreBatchId:", ctx.restoreBatchId);
  console.log("SOURCE:", ctx.sourceCompanyId, "/", ctx.sourceLocationId);
  console.log("TARGET:", ctx.targetCompanyId, "/", ctx.targetLocationId);
  console.log("==================================================");

  // ---- Safety checks ----
  const srcLoc = await db.collection("companies").doc(ctx.sourceCompanyId).collection("locations").doc(ctx.sourceLocationId).get();
  if (!srcLoc.exists) fail("source location findes ikke.");
  const tgtCompany = await db.collection("companies").doc(ctx.targetCompanyId).get();
  const tgtLoc = await db.collection("companies").doc(ctx.targetCompanyId).collection("locations").doc(ctx.targetLocationId).get();
  if (!tgtCompany.exists || !tgtLoc.exists) fail("target company/location findes ikke.");
  const identity = `${(tgtLoc.data() || {}).name || ""} ${(tgtCompany.data() || {}).name || ""} ${ctx.targetCompanyId}`.toLowerCase();
  if (!identity.includes(AROID_NAME_HINT)) fail("target identificeres ikke som Aroi-D.");

  // ---- Build equipment map legacy->canonical (from already-restored canonical equipment) ----
  const eqMap = new Map();
  const tgtEquip = await db.collection("equipment").where("locationId", "==", ctx.targetLocationId).get();
  tgtEquip.docs.forEach((d) => {
    const x = d.data();
    if (x.restoredFromDocId) eqMap.set(x.restoredFromDocId, d.id); // legacy equip doc id -> canonical equip doc id
  });
  console.log("\nequipment map (legacy->canonical) entries:", eqMap.size);

  // ---- Canonical template ids (for templateId mapping check) ----
  const canonicalTemplateIds = new Set();
  const tgtTpl = await db.collection("task_templates").where("locationId", "==", ctx.targetLocationId).get();
  tgtTpl.docs.forEach((d) => canonicalTemplateIds.add(d.id));

  // ---- READ-ONLY investigation of related legacy collections ----
  console.log("\n-- Related legacy collections (read-only, for awareness; NOT migrated by this script) --");
  for (const col of ["daily_runs", "daily_reports", "deviations", "alerts", "media_assets", "logbook_entries"]) {
    try {
      const s = await db.collection(col).where("locationId", "==", ctx.sourceLocationId).count().get();
      console.log(`   ${col}: ${s.data().count} (legacy)`);
    } catch (e) { console.log(`   ${col}: (query failed)`); }
  }
  // media that references task_entries (taskEntryId / entryId)
  let mediaRefEntries = 0;
  try {
    const ms = await db.collection("media_assets").where("locationId", "==", ctx.sourceLocationId).get();
    mediaRefEntries = ms.docs.filter((d) => d.data().taskEntryId || d.data().entryId).length;
  } catch (e) {}
  console.log("   media_assets referencing task_entries:", mediaRefEntries);

  // ---- Load SOURCE task_entries ----
  const srcSnap = await db.collection("task_entries").where("locationId", "==", ctx.sourceLocationId).get();
  const srcEntries = srcSnap.docs.filter((d) => {
    const x = d.data();
    return !x.companyId || x.companyId === ctx.sourceCompanyId || x.organizationId === ctx.sourceCompanyId;
  });
  const dates = srcEntries.map((d) => d.data().dateKey).filter(Boolean).sort();
  console.log("\n-- SOURCE task_entries --");
  console.log("  count:", srcEntries.length, "| dateKey:", dates[0], "->", dates[dates.length - 1]);

  const targetExisting = (await db.collection("task_entries").where("locationId", "==", ctx.targetLocationId).count().get()).data().count;
  console.log("  TARGET existing task_entries (canonical):", targetExisting);

  function rewriteScopeTokens(v) {
    if (typeof v !== "string") return v;
    return v.split(ctx.sourceCompanyId).join(ctx.targetCompanyId).split(ctx.sourceLocationId).join(ctx.targetLocationId);
  }

  // ---- Build migration plan ----
  const writes = [];
  let equipRemapped = 0, equipUnmapped = 0, idRewritten = 0;
  let tplWith = 0, tplMapped = 0, tplUnmapped = 0;
  for (const doc of srcEntries) {
    const data = doc.data() || {};
    const targetDocId = `${sanitizeScopeSegment(ctx.targetLocationId)}__entry__${doc.id}`;

    const payload = { ...data };
    payload.companyId = ctx.targetCompanyId;
    if (data.organizationId !== undefined) payload.organizationId = ctx.targetCompanyId;
    payload.locationId = ctx.targetLocationId;

    // equipmentId remap (preserve equipmentName as-is)
    if (data.equipmentId) {
      if (eqMap.has(data.equipmentId)) { payload.equipmentId = eqMap.get(data.equipmentId); equipRemapped++; }
      else { equipUnmapped++; } // leave original, flagged
    }

    // scope-token rewrite on reference id fields
    for (const f of ["taskId", "templateId", "taskInstanceId", "sourceTaskInstanceId"]) {
      if (typeof data[f] === "string") {
        const rew = rewriteScopeTokens(data[f]);
        if (rew !== data[f]) { payload[f] = rew; idRewritten++; }
      }
    }

    // templateId mapping check (does the entry's templateId resolve to a canonical template?)
    const tplId = payload.templateId || data.templateId;
    if (tplId) {
      tplWith++;
      if (canonicalTemplateIds.has(tplId)) tplMapped++; else tplUnmapped++;
    }

    Object.assign(payload, ownerScope, {
      restoredFromCompanyId: ctx.sourceCompanyId,
      restoredFromLocationId: ctx.sourceLocationId,
      restoredFromDocId: doc.id,
      restoreBatchId: ctx.restoreBatchId,
      restoredBy: RESTORED_BY,
      restoredAt: admin.firestore.FieldValue.serverTimestamp()
    });

    writes.push({ targetDocId, payload, sourceDocId: doc.id });
  }

  // ---- Idempotency / conflict pre-check ----
  let fresh = 0, sameRestore = 0, conflict = 0;
  const conflicts = [];
  for (const w of writes) {
    const ex = await db.collection("task_entries").doc(w.targetDocId).get();
    if (!ex.exists) { fresh++; continue; }
    const ed = ex.data() || {};
    if (ed.restoredBy === RESTORED_BY || ed.restoredFromDocId === w.sourceDocId || ed.restoreBatchId === ctx.restoreBatchId) sameRestore++;
    else { conflict++; conflicts.push(w.targetDocId); }
  }

  // ---- Dry-run report ----
  console.log("\n-- MIGRATION PLAN --");
  console.log("  WOULD WRITE task_entries:", writes.length, `(fresh=${fresh}, overwrite-same-restore=${sameRestore}, CONFLICT=${conflict})`);
  console.log("  equipmentId remapped:", equipRemapped, "| unmapped (kept as-is):", equipUnmapped);
  console.log("  templateId: withTemplateId=" + tplWith + " | mapped-to-canonical=" + tplMapped + " | UNMAPPED=" + tplUnmapped + " (display ok; perfect linkage secondary)");
  console.log("  reference-id fields scope-rewritten:", idRewritten);
  console.log("\n  REWRITTEN fields: companyId, organizationId, locationId, equipmentId(map), taskId/templateId/taskInstanceId/sourceTaskInstanceId(scope tokens)");
  console.log("  PRESERVED fields: measurement/temperature, documentation, completedAt/performedAt, completedBy/performedBy/createdBy + *Name/*Email, media/file refs, equipmentName, status, comment, dateKey, ...");
  console.log("  OWNER metadata:", JSON.stringify(ownerScope));
  console.log("  RESTORE metadata: restoredFromCompanyId, restoredFromLocationId, restoredFromDocId, restoreBatchId, restoredBy, restoredAt(serverTimestamp)");

  console.log("\n  sample entries (up to 5):");
  writes.slice(0, 5).forEach((w) => {
    const d = w.payload;
    console.log("    -", w.sourceDocId, "->", w.targetDocId);
    console.log("        title=" + JSON.stringify(d.title || d.routineType) + " dateKey=" + d.dateKey + " completedByName=" + JSON.stringify(d.completedByName) + " measurement=" + JSON.stringify(d.measurement ?? d.temperature ?? d.value ?? "-") + " equipmentName=" + JSON.stringify(d.equipmentName || "-"));
  });

  if (conflict > 0) {
    console.log("\n  ⚠️ CONFLICT: " + conflict + " target docs already exist WITHOUT matching restore metadata.");
    conflicts.slice(0, 10).forEach((id) => console.log("      conflict:", id));
    console.log("  Per spec: STOP. Apply must not overwrite non-restore data.");
  }

  console.log("\n==================================================");
  console.log("SUMMARY");
  console.log("  source task_entries:", srcEntries.length, "(expect 647)");
  console.log("  date range:", dates[0], "->", dates[dates.length - 1], "(expect 2026-05-10 -> 2026-06-12)");
  console.log("  WOULD WRITE:", writes.length, "| fresh:", fresh, "| same-restore:", sameRestore, "| conflict:", conflict);

  if (!APPLY) {
    console.log("\n  NO WRITES because dry-run (pass --apply to write).");
    console.log("==================================================");
    return;
  }

  // ================= APPLY =================
  if (conflict > 0) fail(`APPLY afvist: ${conflict} conflict-docs (eksisterer uden matchende restore-metadata). Ingen overskrivning af fremmed data.`);

  for (let i = 0; i < writes.length; i += MAX_BATCH) {
    const batch = db.batch();
    writes.slice(i, i + MAX_BATCH).forEach((w) => batch.set(db.collection("task_entries").doc(w.targetDocId), w.payload));
    await batch.commit();
  }
  console.log(`\n[APPLY] migrated ${writes.length} task_entries legacy -> canonical (no legacy docs modified).`);
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  if (e && e.stack) console.error(e.stack);
  process.exit(1);
});
