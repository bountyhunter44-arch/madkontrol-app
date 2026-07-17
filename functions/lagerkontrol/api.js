const { HttpsError } = require("firebase-functions/v2/https");
const { normalizeReceiveGoodsPayload } = require("./schemas");
const { receiveGoods } = require("./domain/goods-receipt");

function createLagerApi({ firestore }) {
  async function lagerReceiveGoodsHandler(request) {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at registrere varemodtagelse.");
    }

    let payload;
    try {
      payload = normalizeReceiveGoodsPayload(request.data || {});
    } catch (error) {
      throw new HttpsError(error.code || "invalid-argument", error.message || "Ugyldig lager-payload.");
    }

    try {
      await assertLagerAccess({ firestore, uid: request.auth.uid, payload });
      return await receiveGoods({
        firestore,
        payload,
        uid: request.auth.uid
      });
    } catch (error) {
      console.error("[lagerkontrol] receive goods failed", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Kunne ikke registrere varemodtagelse i Lagerkontrol Pro.");
    }
  }

  return {
    lagerReceiveGoodsHandler
  };
}

async function assertLagerAccess({ firestore, uid, payload }) {
  const profile = await firestore.getUserProfile(uid);
  if (!profile) {
    throw new HttpsError("permission-denied", "Brugerprofil blev ikke fundet.");
  }

  const role = String(profile.role || "").trim().toLowerCase();
  if (["super-admin", "super_admin"].includes(role)) return;

  const allowedRoles = new Set(["owner", "admin", "hq_admin", "manager", "employee", "medarbejder"]);
  if (!allowedRoles.has(role)) {
    throw new HttpsError("permission-denied", "Brugerrolle har ikke adgang til Lagerkontrol Pro.");
  }

  const companyId = String(profile.companyId || profile.organizationId || "").trim();
  const locationIds = Array.isArray(profile.locationIds) ? profile.locationIds.map((id) => String(id)) : [];
  const primaryLocationId = String(profile.primaryLocationId || profile.locationId || "").trim();
  const hasCompany = companyId === payload.companyId;
  const hasLocation = primaryLocationId === payload.locationId || locationIds.includes(payload.locationId);

  if (!hasCompany || !hasLocation) {
    throw new HttpsError("permission-denied", "Adgang til Lagerkontrol Pro afvist.");
  }
}

module.exports = {
  assertLagerAccess,
  createLagerApi
};
