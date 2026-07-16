/**
 * promotePlatformSuperAdmin.js
 *
 * Promotes ONE user to platform super-admin by --email or --uid. Merges ONLY platform-admin fields
 * onto users/{uid}. It never sets companyId/locationId, never sets role:"owner", and refuses to
 * touch Supawan or any Aroi-D user.
 *
 * Platform-admin fields written (merge only):
 *   role: "super-admin"        (used by firestore.rules isSuperAdmin() + owner-dashboard gate)
 *   isSuperAdmin: true          (used by core/environment.js)
 *   + audit: platformSuperAdminPromotedAt / platformSuperAdminPromotedBy / previousRole
 *
 * DRY-RUN by default. Pass --apply to write.
 *   node --use-system-ca functions/scripts/promotePlatformSuperAdmin.js --email=mn@madkontrollen.dk
 *   node --use-system-ca functions/scripts/promotePlatformSuperAdmin.js --uid=oQNTYi5NRdW1r0QHKW7FcwDGks52 --apply
 */
"use strict";

const path = require("path");
const admin = require("firebase-admin");

// ---- Guarded identities that must NEVER be touched ----
const SUPAWAN_UID = "HNcGHMrzsUPqbyBcmodsxBuWuJc2";
const AROI_COMP = "onboarding_aroi-d_42405000";

const PROMOTED_BY = "promotePlatformSuperAdmin";

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
const J = (v) => JSON.stringify(v);

async function main() {
  const args = parseArgs(process.argv);
  const APPLY = args.apply === true;
  const email = typeof args.email === "string" ? args.email.trim() : "";
  const uidArg = typeof args.uid === "string" ? args.uid.trim() : "";

  if (!email && !uidArg) fail("Angiv enten --email=<email> eller --uid=<uid>.");
  if (email && uidArg) fail("Angiv KUN én af --email eller --uid, ikke begge.");

  if (!admin.apps.length) {
    const sa = require(path.join(__dirname, "../../serviceAccountKey.json"));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  }
  const db = admin.firestore();
  const auth = admin.auth();

  console.log("==================================================");
  console.log("promotePlatformSuperAdmin");
  console.log("MODE:", APPLY ? "APPLY (writes)" : "DRY-RUN (no writes)");
  console.log("target:", email ? ("email=" + email) : ("uid=" + uidArg));
  console.log("==================================================");

  // ---- Resolve uid ----
  let uid = uidArg;
  let authEmail = email;
  if (!uid) {
    const rec = await auth.getUserByEmail(email).catch(() => null);
    if (!rec) fail("Ingen Auth-bruger med email " + J(email) + ".");
    uid = rec.uid;
    authEmail = rec.email || email;
  } else {
    const rec = await auth.getUser(uid).catch(() => null);
    if (rec) authEmail = rec.email || "";
  }
  console.log("\nResolved uid:", uid, "| auth email:", J(authEmail));

  // ---- HARD GUARDS ----
  if (uid === SUPAWAN_UID) fail("uid == SUPAWAN_UID — afvist. Supawan røres aldrig.");

  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  const exists = snap.exists;
  const cur = exists ? (snap.data() || {}) : {};

  if (cur.companyId === AROI_COMP || cur.organizationId === AROI_COMP) {
    fail("Brugeren tilhører Aroi-D (companyId/organizationId == " + AROI_COMP + ") — afvist. Aroi-D røres aldrig.");
  }
  if (!exists) {
    console.log("\n[NOTE] users/" + uid + " findes ikke — der OPRETTES en minimal doc med KUN platform-admin felter (+ email/uid).");
  }

  // ---- Build patch: ONLY platform-admin fields. No companyId/locationId. No role:"owner". ----
  const patch = {
    role: "super-admin",
    isSuperAdmin: true,
    platformSuperAdminPromotedAt: admin.firestore.FieldValue.serverTimestamp(),
    platformSuperAdminPromotedBy: PROMOTED_BY,
    previousRole: cur.role ?? null
  };
  // When creating a brand-new doc, include identity so the doc is usable; never on an existing doc.
  if (!exists) {
    patch.uid = uid;
    if (authEmail) patch.email = authEmail;
    patch.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  // ---- Show before -> after ----
  console.log("\n=== users/" + uid + " BEFORE -> AFTER (merge only) ===");
  console.log("  role          " + J(cur.role) + "  ->  " + J(patch.role));
  console.log("  isSuperAdmin  " + J(cur.isSuperAdmin) + "  ->  " + J(patch.isSuperAdmin));
  console.log("  PRESERVED unchanged: companyId=" + J(cur.companyId) + ", locationId=" + J(cur.locationId) + ", email=" + J(cur.email) + ", + alle øvrige felter");
  console.log("  NOT written by this script: companyId, locationId, role:\"owner\"");

  // ---- Allowlist reminder (script cannot grant access alone) ----
  console.log("\n[NOTE] Fuld super-admin-adgang kræver også at " + J(authEmail) + " står i:");
  console.log("       - public/admin/owner-dashboard.html  (SUPER_ADMIN_EMAILS)");
  console.log("       - firestore.rules  isSuperAdmin() email-allowlist");
  console.log("       Disse er hardkodede og ændres IKKE af dette script.");

  if (!APPLY) {
    console.log("\n  DRY-RUN — ingen writes. Kør med --apply for at skrive.");
    console.log("==================================================");
    return;
  }

  // ---- APPLY (guards re-checked) ----
  if (uid === SUPAWAN_UID) fail("Guard tripped at apply (Supawan) — afvist.");
  if (cur.companyId === AROI_COMP || cur.organizationId === AROI_COMP) fail("Guard tripped at apply (Aroi-D) — afvist.");
  await ref.set(patch, { merge: true });
  console.log("\n[APPLY] users/" + uid + " promoveret til platform super-admin (role + isSuperAdmin merged).");
  console.log("==================================================");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  if (e && e.stack) console.error(e.stack);
  process.exit(1);
});
