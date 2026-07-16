"use strict";

const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { getEffectiveActiveModules } = require("../admin/module-access");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const SUPER_ADMIN_EMAILS = new Set(["mn@aroid.dk", "michael@madkontrollen.dk"]);
const POS_ROLES = new Set(["owner", "hq_admin", "admin", "location_manager", "manager", "employee"]);
const POS_ADMIN_ROLES = new Set(["owner", "hq_admin", "admin", "super-admin", "superadmin"]);

function sanitizeString(value, maxLen = 500) {
  return String(value || "").trim().slice(0, maxLen);
}

function getUserLocationIds(user = {}) {
  const ids = new Set();
  if (Array.isArray(user.locationIds)) {
    user.locationIds.forEach((id) => ids.add(String(id)));
  }
  [user.primaryLocationId, user.locationId].filter(Boolean).forEach((id) => ids.add(String(id)));
  return [...ids];
}

async function assertPosLocationAccess({ data = {}, auth = {}, adminOnly = false }) {
  const uid = sanitizeString(auth?.uid || "", 160);
  const email = sanitizeString(auth?.token?.email || "", 200).toLowerCase();
  const companyId = sanitizeString(data.companyId || "", 140);
  const locationId = sanitizeString(data.locationId || "", 140);

  if (!uid) throw new HttpsError("unauthenticated", "Log ind for at bruge POS.");
  if (!companyId || !locationId) {
    throw new HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) throw new HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");

  const user = userSnap.data() || {};
  const role = sanitizeString(user.role || "", 80).toLowerCase();
  const isSuperAdmin = ["super-admin", "superadmin"].includes(role) && SUPER_ADMIN_EMAILS.has(email);
  const allowedRoles = adminOnly ? POS_ADMIN_ROLES : POS_ROLES;
  if (!isSuperAdmin && !allowedRoles.has(role)) {
    throw new HttpsError("permission-denied", adminOnly
      ? "Kun superadmin eller admin må markere betalinger manuelt."
      : "Brugerrollen har ikke adgang til POS."
    );
  }

  const userCompanyId = sanitizeString(user.companyId || user.organizationId || "", 140);
  const locationIds = getUserLocationIds(user);
  const hasCompany = userCompanyId === companyId;
  const hasLocation = ["owner", "hq_admin", "admin", "location_manager"].includes(role) ||
    locationIds.includes(locationId);

  if (!isSuperAdmin && (!hasCompany || !hasLocation)) {
    throw new HttpsError("permission-denied", "Du har ikke adgang til POS for denne lokation.");
  }

  try {
    const effective = await getEffectiveActiveModules(companyId, locationId, uid);
    if (Array.isArray(effective.activeModules) &&
        effective.activeModules.length > 0 &&
        !effective.activeModules.includes("pos")) {
      console.warn("[pos access] POS mangler i activeModules, men bruger har company/location-adgang", {
        companyId,
        locationId,
        uid
      });
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.warn("[pos access] Moduladgang kunne ikke valideres", { companyId, locationId, uid });
  }

  return { uid, email, role, isSuperAdmin, companyId, locationId };
}

module.exports = {
  assertPosLocationAccess,
  sanitizeString
};
