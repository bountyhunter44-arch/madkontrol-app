"use strict";

const functions = require("firebase-functions");
const { sanitizeString } = require("./util");

// Udtrukket ORDRET fra index.js. Delte helpers; db injiceres.

module.exports = ({ db }) => {

  function getUserLocationIds(userData) {
    const ids = [];
    if (Array.isArray(userData?.locationIds)) {
      for (const value of userData.locationIds) {
        const id = sanitizeString(value, 120);
        if (id) ids.push(id);
      }
    }
  
    const primaryLocationId = sanitizeString(
      userData?.primaryLocationId || userData?.locationId,
      120
    );
    if (primaryLocationId) ids.push(primaryLocationId);
  
    return [...new Set(ids)];
  }

  async function getUserAccessProfile({ uid, email }) {
    const byUid = await db.collection("users").doc(uid).get();
    if (byUid.exists) {
      return byUid.data() || {};
    }
  
    const normalizedEmail = sanitizeString(email, 160).toLowerCase();
    if (!normalizedEmail) return null;
  
    const byEmail = await db
      .collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();
  
    if (byEmail.empty) return null;
    return byEmail.docs[0].data() || {};
  }

  async function assertLexiCustomerAccess({ uid, email, companyId, locationId }) {
    const userData = await getUserAccessProfile({ uid, email });
    if (!userData) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Brugerprofil blev ikke fundet."
      );
    }
  
    const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
    if (!userCompanyId || userCompanyId !== companyId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Adgang til companyId afvist."
      );
    }
  
    const locationIds = getUserLocationIds(userData);
    if (locationIds.length > 0 && !locationIds.includes(locationId)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Adgang til locationId afvist."
      );
    }
  }

  async function assertStartDayAccess({ uid, email, companyId, locationId }) {
    const userData = await getUserAccessProfile({ uid, email });
    if (!userData) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Brugerprofil blev ikke fundet."
      );
    }
  
    const role = sanitizeString(userData.role || "", 80).toLowerCase();
    const allowedRoles = ["owner", "hq_admin", "location_manager", "admin", "manager", "employee", "super-admin"];
    if (!allowedRoles.includes(role)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Brugerrolle maa ikke starte dagen."
      );
    }
  
    // Super-admin can access any company/location (for impersonation)
    const isSuperAdmin = role === "super-admin";
    if (isSuperAdmin) {
      return;
    }
  
    const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
    if (!userCompanyId || userCompanyId !== companyId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Adgang til companyId afvist."
      );
    }
  
    const allowedLocationIds = getUserLocationIds(userData);
  
    // OWNER override: owners can always access their own location
    const isOwner =
      role === "owner" &&
      (
        userData.locationId === locationId ||
        userData.primaryLocationId === locationId ||
        (userData.locationIds || []).includes(locationId)
      );
  
    // Debug logging
    console.log("[AUTH CHECK startDayForLocation]", {
      uid,
      role,
      locationId,
      allowedLocationIds,
      isOwner,
      isSuperAdmin
    });
  
    if (!isSuperAdmin && !isOwner && !allowedLocationIds.includes(locationId)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Adgang til locationId afvist."
      );
    }
  }

  async function assertAdminAccess({ uid, email, companyId, locationId }) {
    const userData = await getUserAccessProfile({ uid, email });
    if (!userData) {
      throw new functions.https.HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
    }
  
    const role = sanitizeString(userData.role || "", 80).toLowerCase();
    const allowedRoles = ["owner", "hq_admin", "location_manager", "admin", "super-admin"];
    if (!allowedRoles.includes(role)) {
      throw new functions.https.HttpsError("permission-denied", "Kun admin maa udfoere denne handling.");
    }
  
    // Super-admin can access any company/location (for impersonation)
    if (role === "super-admin") {
      return;
    }
  
    const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
    if (!userCompanyId || userCompanyId !== companyId) {
      throw new functions.https.HttpsError("permission-denied", "Adgang til companyId afvist.");
    }
  
    const locationIds = getUserLocationIds(userData);
    if (locationIds.length > 0 && !locationIds.includes(locationId)) {
      throw new functions.https.HttpsError("permission-denied", "Adgang til locationId afvist.");
    }
  }

  async function assertSeoGeneratorAccess({ uid, email, companyId, locationId }) {
    const userData = await getUserAccessProfile({ uid, email });
    if (!userData) {
      throw new functions.https.HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
    }
  
    const role = sanitizeString(userData.role || "", 80).toLowerCase();
    const allowedRoles = ["owner", "hq_admin", "location_manager", "admin", "manager", "employee", "customer", "signup", "onboarding", "onboarding_user", "pending"];
    if (role && !allowedRoles.includes(role)) {
      throw new functions.https.HttpsError("permission-denied", "Brugerrolle maa ikke bruge SEO-generatoren.");
    }
  
    const userCompanyId = sanitizeString(userData.companyId || userData.organizationId, 120);
    if (!userCompanyId || userCompanyId !== companyId) {
      throw new functions.https.HttpsError("permission-denied", "Adgang til companyId afvist.");
    }
  
    const locationIds = getUserLocationIds(userData);
    if (locationIds.length > 0 && !locationIds.includes(locationId)) {
      throw new functions.https.HttpsError("permission-denied", "Adgang til locationId afvist.");
    }
  }

  return {
    getUserLocationIds,
    getUserAccessProfile,
    assertLexiCustomerAccess,
    assertStartDayAccess,
    assertAdminAccess,
    assertSeoGeneratorAccess
  };
};
