/**
 * fixAfCrossTenantScope.js
 *
 * TRIN 1 — repair cross-tenant contamination for af@madkontrollen.dk (Ali Fallah / Cafe Victoria).
 *
 * The users/{afUid} doc points at the Aroi-D scope by mistake, so af@ lands in Aroi-D on login.
 * This script repoints ONLY that one users doc back to Cafe Victoria, and creates/repairs the
 * Cafe Victoria membership. It NEVER touches Supawan or any Aroi-D data.
 *
 * DRY-RUN by default. Pass --apply to write. No deletes, no Auth changes, no Aroi-D writes.
 *
 * Usage (DRY-RUN):  node --use-system-ca functions/scripts/fixAfCrossTenantScope.js
 * Apply (later):    node --use-system-ca functions/scripts/fixAfCrossTenantScope.js --apply
 */

"use strict";

const path = require("path");
const admin = require("firebase-admin");

// ---- Hardcoded, guarded identities (exact values from audit) ----
const AF_UID = "UhE1RUdljBNUQmhmktXiULjWyKr1";
const AF_EMAIL = "af@madkontrollen.dk";
const CV_COMP = "company_1778059074471_sh45d3wbu";   // Cafe Victoria
const CV_LOC = "location_1778059074471_9i7w1ko3s";
const SUPAWAN_UID = "HNcGHMrzsUPqbyBcmodsxBuWuJc2";   // must NOT be touched
const AROI_COMP = "onboarding_aroi-d_42405000";       // must NOT be touched

const REPAIRED_BY = "fixAfCrossTenantScope";

function fail(m) { console.error("\n[STOP] " + m); process.exit(1); }
const J = (v) => JSON.stringify(v);

async function main() {
  const APPLY = process.argv.slice(2).includes("--apply");

  // ---- Hard guards (defensive: refuse to ever touch Supawan / Aroi-D) ----
  if (AF_UID === SUPAWAN_UID) fail("AF_UID == SUPAWAN_UID — afvist.");
  if (CV_COMP === AROI_COMP) fail("target company == Aroi-D — afvist.");

  if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  console.log("==================================================");
  console.log("fixAfCrossTenantScope");
  console.log("MODE:", APPLY ? "APPLY (WRITES)" : "DRY-RUN (no writes)");
  console.log("af UID:", AF_UID, "(" + AF_EMAIL + ")");
  console.log("target (Cafe Victoria):", CV_COMP, "/", CV_LOC);
  console.log("==================================================");

  // ---- Verify Cafe Victoria scope exists ----
  const cvComp = await db.collection("companies").doc(CV_COMP).get();
  const cvLoc = await db.collection("companies").doc(CV_COMP).collection("locations").doc(CV_LOC).get();
  if (!cvComp.exists) fail("Cafe Victoria company findes ikke.");
  if (!cvLoc.exists) fail("Cafe Victoria location findes ikke.");
  console.log("\nCafe Victoria company name:", J((cvComp.data() || {}).name), "| location name:", J((cvLoc.data() || {}).name));

  // ---- Load af@ users doc + verify identity ----
  const afRef = db.collection("users").doc(AF_UID);
  const afSnap = await afRef.get();
  if (!afSnap.exists) fail("users/" + AF_UID + " findes ikke.");
  const af = afSnap.data() || {};
  // NOTE: this doc is known to carry the CONTAMINATED email (supawan@aroid.dk). We repair it.
  // Safety is enforced by UID, not email: we only ever write users/AF_UID, and AF_UID != SUPAWAN_UID
  // (guarded above), so Supawan's real doc (HNcGHMrz...) is never touched.
  if (AF_UID === SUPAWAN_UID) fail("AF_UID == SUPAWAN_UID — afvist.");
  if (af.email && af.email !== AF_EMAIL) {
    console.log("\n[CONTAMINATION] users/" + AF_UID + ".email = " + J(af.email) + " (forkert) — rettes til " + J(AF_EMAIL) + ".");
  }

  // ---- 1. current scope ----
  console.log("\n=== 1. CURRENT af@ users scope ===");
  ["companyId", "organizationId", "locationId", "primaryLocationId", "locationIds", "role", "email", "activeModules"].forEach((f) => console.log("  " + f + " = " + J(af[f])));

  if (af.companyId !== AROI_COMP) {
    console.log("\n[NOTE] users.companyId er IKKE Aroi-D (" + J(af.companyId) + ") — muligvis allerede rettet. Fortsætter dry-run for at vise plan.");
  }

  // ---- 2. target scope ----
  console.log("\n=== 2. TARGET Cafe Victoria scope ===");
  console.log("  companyId = " + J(CV_COMP));
  console.log("  locationId = " + J(CV_LOC));

  // ---- Build users patch (ONLY scope fields + audit; preserve everything else) ----
  const usersPatch = {
    email: AF_EMAIL,
    companyId: CV_COMP,
    organizationId: CV_COMP,
    locationId: CV_LOC,
    primaryLocationId: CV_LOC,
    locationIds: [CV_LOC],
    scopeRepairedAt: admin.firestore.FieldValue.serverTimestamp(),
    scopeRepairedBy: REPAIRED_BY,
    previousEmail: af.email ?? null,
    previousCompanyId: af.companyId ?? null,
    previousLocationId: af.locationId ?? null,
    previousLocationIds: af.locationIds ?? null
  };

  // ---- 3. users before/after ----
  console.log("\n=== 3. users/" + AF_UID + " BEFORE -> AFTER ===");
  [["email", af.email, AF_EMAIL], ["companyId", af.companyId, CV_COMP], ["organizationId", af.organizationId, CV_COMP], ["locationId", af.locationId, CV_LOC], ["primaryLocationId", af.primaryLocationId, CV_LOC], ["locationIds", af.locationIds, [CV_LOC]]]
    .forEach(([f, b, a]) => console.log("  " + f.padEnd(18) + J(b) + "  ->  " + J(a)));
  console.log("  PRESERVED (uændret): role=" + J(af.role) + ", activeModules=" + J(af.activeModules) + ", createdAt, + alle øvrige felter");
  console.log("  AUDIT tilføjes: scopeRepairedAt, scopeRepairedBy, previousEmail, previousCompanyId/LocationId/LocationIds");

  // ---- Membership doc ----
  const memRef = db.collection("companies").doc(CV_COMP).collection("members").doc(AF_UID);
  const memSnap = await memRef.get();
  const memberDoc = {
    uid: AF_UID,
    email: AF_EMAIL,
    role: "owner",
    companyId: CV_COMP,
    locationId: CV_LOC,
    locationIds: [CV_LOC],
    ownerKind: "real_owner",
    ownerLabel: "Rigtig owner",
    isDemoScope: false,
    scopeType: "customer",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(memSnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() })
  };

  // ---- 4. membership before/after ----
  console.log("\n=== 4. companies/" + CV_COMP + "/members/" + AF_UID + " BEFORE -> AFTER ===");
  console.log("  BEFORE exists: " + memSnap.exists + (memSnap.exists ? " | role=" + J((memSnap.data() || {}).role) : ""));
  console.log("  AFTER: " + J({ role: memberDoc.role, companyId: memberDoc.companyId, locationId: memberDoc.locationId, ownerKind: memberDoc.ownerKind, isDemoScope: memberDoc.isDemoScope, scopeType: memberDoc.scopeType }));

  // ---- 5. Supawan untouched confirmation ----
  console.log("\n=== 5. SUPAWAN untouched ===");
  console.log("  This script writes ONLY to: users/" + AF_UID + " and companies/" + CV_COMP + "/members/" + AF_UID);
  console.log("  Neither is Supawan (uid " + SUPAWAN_UID + ") -> Supawan urørt: " + (AF_UID !== SUPAWAN_UID ? "CONFIRMED" : "FAIL"));

  // ---- 6. Aroi-D untouched confirmation ----
  const aroiMem = await db.collection("companies").doc(AROI_COMP).collection("members").doc(AF_UID).get();
  console.log("\n=== 6. AROI-D untouched ===");
  console.log("  af@ member of Aroi-D? " + aroiMem.exists + (aroiMem.exists ? "  (note: script does NOT write/remove it in this version)" : ""));
  console.log("  No Aroi-D doc is written by this script -> Aroi-D data urørt: CONFIRMED");
  console.log("  live_user_profiles (already Cafe Victoria) -> NOT touched in this version: CONFIRMED");

  if (!APPLY) {
    console.log("\n=== 7. NO WRITES because dry-run (pass --apply to write) ===");
    console.log("==================================================");
    return;
  }

  // ================= APPLY (guarded) =================
  if (AF_UID === SUPAWAN_UID || CV_COMP === AROI_COMP) fail("Guard tripped at apply — afvist.");
  await afRef.update(usersPatch);                 // update => preserves all other fields
  await memRef.set(memberDoc, { merge: true });
  console.log("\n[APPLY] users/" + AF_UID + " scope repaired -> Cafe Victoria.");
  console.log("[APPLY] membership companies/" + CV_COMP + "/members/" + AF_UID + " written.");
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  if (e && e.stack) console.error(e.stack);
  process.exit(1);
});
