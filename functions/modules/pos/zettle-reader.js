"use strict";

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const ZETTLE_CLIENT_ID = defineSecret("ZETTLE_CLIENT_ID");
const ZETTLE_CLIENT_SECRET = defineSecret("ZETTLE_CLIENT_SECRET");
const ZETTLE_CALLBACK_URL = "https://madkontrollen.dk/api/zettle/callback";

function sanitizeString(value, maxLen = 500) {
  return String(value || "").trim().slice(0, maxLen);
}

function zettleUnavailableResponse(message, technicalStatus = "reader_endpoint_not_configured") {
  return {
    ok: false,
    provider: "zettle",
    status: "unavailable",
    technicalStatus,
    readers: [],
    message
  };
}

async function assertPosLocationAccess(requestData = {}, requestAuth = {}) {
  const uid = sanitizeString(requestAuth?.uid || "", 160);
  const companyId = sanitizeString(requestData.companyId || "", 120);
  const locationId = sanitizeString(requestData.locationId || "", 120);

  if (!uid) {
    throw new HttpsError("unauthenticated", "Log ind for at bruge Zettle Reader Connect.");
  }
  if (!companyId || !locationId) {
    throw new HttpsError("invalid-argument", "companyId og locationId er påkrævet.");
  }

  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const role = sanitizeString(user.role || "", 80);
  const userCompanyId = sanitizeString(user.companyId || user.organizationId || "", 120);
  const locationIds = Array.isArray(user.locationIds) ? user.locationIds.map(String) : [];
  const primaryLocationId = sanitizeString(user.primaryLocationId || user.locationId || "", 120);
  const superAdminEmails = ["mn@aroid.dk", "michael@madkontrollen.dk"];
  const isSuperAdmin = role === "super-admin" &&
    superAdminEmails.includes(String(requestAuth?.token?.email || "").toLowerCase());
  const hasCompany = userCompanyId === companyId;
  const hasLocation = ["owner", "hq_admin", "admin", "location_manager"].includes(role) ||
    locationIds.includes(locationId) ||
    primaryLocationId === locationId;

  if (!isSuperAdmin && (!hasCompany || !hasLocation)) {
    throw new HttpsError("permission-denied", "Du har ikke adgang til POS-indstillinger for denne lokation.");
  }

  return { uid, companyId, locationId, role };
}

function getZettleSecretStatus() {
  const clientId = String(ZETTLE_CLIENT_ID.value() || process.env.ZETTLE_CLIENT_ID || "").trim();
  const clientSecret = String(ZETTLE_CLIENT_SECRET.value() || process.env.ZETTLE_CLIENT_SECRET || "").trim();
  return {
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret)
  };
}

function getZettleClientIdStatus() {
  const clientId = String(ZETTLE_CLIENT_ID.value() || process.env.ZETTLE_CLIENT_ID || "").trim();
  return {
    hasClientId: Boolean(clientId)
  };
}

function throwZettleNotReady() {
  const secretStatus = getZettleSecretStatus();
  if (!secretStatus.hasClientId || !secretStatus.hasClientSecret) {
    throw new HttpsError(
      "failed-precondition",
      "Zettle OAuth mangler ZETTLE_CLIENT_ID eller ZETTLE_CLIENT_SECRET i Firebase Functions secrets."
    );
  }
  throw new HttpsError(
    "failed-precondition",
    "Zettle Reader Connect OAuth/linking er ikke færdigkonfigureret endnu. POS falder tilbage til manuel Zettle-reference."
  );
}

const createZettleSdkSession = onCall(
  {
    region: "us-central1",
    secrets: [ZETTLE_CLIENT_ID]
  },
  async (request) => {
    const data = request.data || {};
    await assertPosLocationAccess(data, request.auth);
    const secretStatus = getZettleClientIdStatus();
    if (!secretStatus.hasClientId) {
      return {
        ok: false,
        provider: "zettle",
        status: "unavailable",
        code: "ZETTLE_CLIENT_ID_MISSING",
        clientIdConfigured: false,
        sdkMode: "android-payments-sdk",
        callbackUrl: ZETTLE_CALLBACK_URL,
        message: "ZETTLE_CLIENT_ID mangler i Firebase Functions secrets."
      };
    }

    return {
      ok: true,
      provider: "zettle",
      clientIdConfigured: true,
      sdkMode: "android-payments-sdk",
      callbackUrl: ZETTLE_CALLBACK_URL
    };
  }
);

const getZettleLinkedReaders = onCall(
  {
    region: "us-central1",
    secrets: [ZETTLE_CLIENT_ID, ZETTLE_CLIENT_SECRET]
  },
  async (request) => {
    const data = request.data || {};
    await assertPosLocationAccess(data, request.auth);
    const secretStatus = getZettleSecretStatus();
    if (!secretStatus.hasClientId || !secretStatus.hasClientSecret) {
      return zettleUnavailableResponse(
        "Zettle OAuth mangler ZETTLE_CLIENT_ID eller ZETTLE_CLIENT_SECRET i Firebase Functions secrets.",
        "credentials_missing"
      );
    }
    return zettleUnavailableResponse(
      "Reader-hentning er ikke aktiveret endnu. Zettle/PayPal Reader Connect kræver merchant OAuth, scopes og et konkret reader-list endpoint.",
      "reader_list_endpoint_not_configured"
    );
  }
);

const saveZettleReaderForLocation = onCall(
  { region: "us-central1" },
  async (request) => {
    const data = request.data || {};
    const access = await assertPosLocationAccess(data, request.auth);
    const readerLinkId = sanitizeString(data.readerLinkId || "", 220);
    const readerLabel = sanitizeString(data.readerLabel || "Zettle / PayPal Reader", 160);

    if (!readerLinkId) {
      throw new HttpsError("invalid-argument", "readerLinkId mangler.");
    }

    const ref = db
      .collection("companies").doc(access.companyId)
      .collection("locations").doc(access.locationId)
      .collection("pos_settings").doc("zettle");

    await ref.set({
      companyId: access.companyId,
      locationId: access.locationId,
      provider: "zettle",
      readerConnectEnabled: true,
      readerLinkId,
      readerLabel,
      updatedBy: access.uid,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return {
      ok: true,
      provider: "zettle",
      readerConnectEnabled: true,
      readerLinkId,
      readerLabel
    };
  }
);

const createZettlePaymentRequest = onCall(
  {
    region: "us-central1",
    secrets: [ZETTLE_CLIENT_ID, ZETTLE_CLIENT_SECRET]
  },
  async (request) => {
    const data = request.data || {};
    const access = await assertPosLocationAccess(data, request.auth);
    const settingsSnap = await db
      .collection("companies").doc(access.companyId)
      .collection("locations").doc(access.locationId)
      .collection("pos_settings").doc("zettle")
      .get();
    const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};

    if (!settings.readerLinkId) {
      throw new HttpsError(
        "failed-precondition",
        "Der er ikke valgt Zettle/PayPal Reader for denne lokation. Brug manuel Zettle-reference eller vælg en terminal først."
      );
    }

    throwZettleNotReady();
  }
);

const cancelZettlePaymentRequest = onCall(
  {
    region: "us-central1",
    secrets: [ZETTLE_CLIENT_ID, ZETTLE_CLIENT_SECRET]
  },
  async (request) => {
    const data = request.data || {};
    await assertPosLocationAccess(data, request.auth);
    throwZettleNotReady();
  }
);

module.exports = {
  createZettleSdkSession,
  getZettleLinkedReaders,
  saveZettleReaderForLocation,
  createZettlePaymentRequest,
  cancelZettlePaymentRequest
};
