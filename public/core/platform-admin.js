/**
 * platform-admin.js
 *
 * Recognizes platform / super-admin users so the login flow and the platform context can accept
 * them WITHOUT a companyId/locationId. Normal customer / owner / employee users are unaffected and
 * still require company + location.
 *
 * This is pure frontend recognition — it does NOT change Firestore rules. Backend access is still
 * gated by firestore.rules isSuperAdmin() (role:"super-admin" + email allowlist).
 */

const PLATFORM_ADMIN_UIDS = new Set([
  "oQNTYi5NRdW1r0QHKW7FcwDGks52"
]);

const PLATFORM_ADMIN_EMAILS = new Set([
  "mn@madkontrollen.dk",
  "mn@aroid.dk",
  "michael@madkontrollen.dk"
]);

export function isPlatformAdmin(user, profile) {
  const p = profile || {};
  const email = String((user && user.email) || p.email || "").trim().toLowerCase();
  const uid = String((user && user.uid) || p.uid || "").trim();
  const role = String(p.role || "").trim().toLowerCase();
  const platformRole = String(p.platformRole || "").trim().toLowerCase();
  return Boolean(
    (uid && PLATFORM_ADMIN_UIDS.has(uid)) ||
    (email && PLATFORM_ADMIN_EMAILS.has(email)) ||
    role === "super-admin" ||
    role === "superadmin" ||
    platformRole === "super_admin" ||
    p.isSuperAdmin === true ||
    p.isPlatformAdmin === true ||
    p.crmAccess === true
  );
}

export function buildPlatformContext(user, profile) {
  const p = profile || {};
  return {
    uid: (user && user.uid) || p.uid || null,
    email: (user && user.email) || p.email || null,
    contextType: "platform",
    isPlatformAdmin: true,
    isSuperAdmin: true,
    role: "super-admin",
    platformRole: "super_admin",
    companyId: null,
    locationId: null
  };
}

// Expose on window so non-module inline scripts (dashboard/index login) can reuse the same check.
if (typeof window !== "undefined") {
  window.isPlatformAdmin = isPlatformAdmin;
  window.buildPlatformContext = buildPlatformContext;
}
