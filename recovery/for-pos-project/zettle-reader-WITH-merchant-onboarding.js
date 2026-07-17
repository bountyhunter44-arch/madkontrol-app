"use strict";

const crypto = require("crypto");
const admin = require("firebase-admin");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { assertPosLocationAccess, sanitizeString } = require("./access");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const ZETTLE_CLIENT_ID = defineSecret("ZETTLE_CLIENT_ID");
const ZETTLE_CLIENT_SECRET = defineSecret("ZETTLE_CLIENT_SECRET");
const ZETTLE_API_KEY = defineSecret("ZETTLE_API_KEY");
const ZETTLE_SECRETS = [ZETTLE_CLIENT_ID, ZETTLE_API_KEY, ZETTLE_CLIENT_SECRET];

const ZETTLE_OAUTH_BASE_URL = "https://oauth.zettle.com";
const ZETTLE_PUBLIC_CALLBACK_URL = "https://madkontrollen.dk/api/zettle/callback";
const DEFAULT_ZETTLE_SCOPES = [
  "READ:USERINFO",
  "READ:FINANCE",
  "READ:PURCHASE"
];

function integrationRef(companyId, locationId) {
  return db
    .collection("companies").doc(companyId)
    .collection("locations").doc(locationId)
    .collection("integrations").doc("zettle");
}

function integrationSecretRef(companyId, locationId) {
  return db
    .collection("companies").doc(companyId)
    .collection("locations").doc(locationId)
    .collection("integration_secrets").doc("zettle");
}

function onboardingStateRef(stateHash) {
  return db.collection("zettle_oauth_states").doc(stateHash);
}

function auditRef(companyId, locationId) {
  return db
    .collection("companies").doc(companyId)
    .collection("locations").doc(locationId)
    .collection("pos_audit_log").doc();
}

function saleRef(companyId, locationId, saleId) {
  return db
    .collection("companies").doc(companyId)
    .collection("locations").doc(locationId)
    .collection("pos_sales").doc(saleId);
}

function paymentRef(companyId, locationId, paymentSessionId) {
  return db
    .collection("companies").doc(companyId)
    .collection("locations").doc(locationId)
    .collection("pos_payments").doc(paymentSessionId);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function cleanMoney(value, fieldName = "amount") {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError("failed-precondition", `${fieldName} er ikke gyldigt.`);
  }
  return Math.round(amount * 100) / 100;
}

function getZettleSecrets() {
  return {
    clientId: String(ZETTLE_CLIENT_ID.value() || process.env.ZETTLE_CLIENT_ID || "").trim(),
    clientSecret: String(ZETTLE_CLIENT_SECRET.value() || process.env.ZETTLE_CLIENT_SECRET || "").trim(),
    apiKey: String(ZETTLE_API_KEY.value() || process.env.ZETTLE_API_KEY || "").trim()
  };
}

function getZettleSecretStatus() {
  const secrets = getZettleSecrets();
  return {
    hasClientId: Boolean(secrets.clientId),
    hasClientSecret: Boolean(secrets.clientSecret),
    hasApiKey: Boolean(secrets.apiKey),
    hasServerCredential: Boolean(secrets.clientSecret || secrets.apiKey)
  };
}

function getFunctionBaseUrl(functionName) {
  if (functionName === "handleZettleMerchantCallback") {
    return ZETTLE_PUBLIC_CALLBACK_URL;
  }
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "madkontrollen";
  return `https://us-central1-${projectId}.cloudfunctions.net/${functionName}`;
}

function sanitizeReturnUrl(value) {
  const fallback = "https://madkontrollen.dk/modules/pos/index.html?zettle=callback";
  const raw = sanitizeString(value || fallback, 1200);
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
    const allowedHosts = new Set([
      "madkontrollen.dk",
      "www.madkontrollen.dk",
      "madkontrollen.web.app",
      "localhost",
      "127.0.0.1"
    ]);
    if (!allowedHosts.has(url.hostname)) return fallback;
    return url.toString();
  } catch (_) {
    return fallback;
  }
}

function safeMerchantStatus(integration = {}) {
  const status = sanitizeString(integration.status || "not_connected", 80) || "not_connected";
  const mode = sanitizeString(integration.mode || "production", 40) || "production";
  const connected = status === "connected";
  return {
    ok: true,
    connected,
    provider: "zettle",
    merchantId: connected ? sanitizeString(integration.merchantId || "", 160) : "",
    mode,
    status,
    scopes: Array.isArray(integration.scopes) ? integration.scopes.map((scope) => sanitizeString(scope, 120)).filter(Boolean) : [],
    safeDisplayName: connected ? sanitizeString(integration.safeDisplayName || "", 160) : "",
    lastAuthCheckAt: integration.lastAuthCheckAt || null,
    message: connected
      ? "Zettle-konto er forbundet."
      : "Zettle-konto er ikke forbundet endnu."
  };
}

async function loadMerchantStatus(companyId, locationId) {
  const snap = await integrationRef(companyId, locationId).get();
  return safeMerchantStatus(snap.exists ? snap.data() || {} : {});
}

function assertSaleBelongsToScope(sale = {}, access = {}) {
  if (sale.companyId !== access.companyId || sale.locationId !== access.locationId) {
    throw new HttpsError("permission-denied", "Salget hører ikke til den valgte virksomhed/lokation.");
  }
}

function assertSaleCanStartPayment(sale = {}) {
  const status = sanitizeString(sale.status || "", 80).toLowerCase();
  if (status === "paid") throw new HttpsError("failed-precondition", "Salget er allerede betalt.");
  if (["cancelled", "canceled", "refunded"].includes(status)) {
    throw new HttpsError("failed-precondition", "Betaling kan ikke startes for et annulleret eller refunderet salg.");
  }
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

function merchantNotConnectedResponse() {
  return {
    ok: false,
    provider: "zettle",
    status: "failed",
    paymentStatus: "failed",
    code: "ZETTLE_MERCHANT_NOT_CONNECTED",
    errorCode: "ZETTLE_MERCHANT_NOT_CONNECTED",
    technicalStatus: "merchant_not_connected",
    message: "Zettle-konto er ikke forbundet endnu. Gå til POS-indstillinger og forbind Zettle."
  };
}

function throwZettleNotReady() {
  const secretStatus = getZettleSecretStatus();
  if (!secretStatus.hasClientId || !secretStatus.hasServerCredential) {
    throw new HttpsError(
      "failed-precondition",
      "Zettle/PayPal credentials mangler ZETTLE_CLIENT_ID og ZETTLE_API_KEY eller ZETTLE_CLIENT_SECRET i Firebase Functions secrets."
    );
  }
  throw new HttpsError(
    "failed-precondition",
    "Zettle Reader Connect OAuth/linking er ikke færdigkonfigureret endnu. POS falder tilbage til manuel Zettle-reference."
  );
}

async function writeZettleAudit(companyId, locationId, payload = {}) {
  await auditRef(companyId, locationId).set({
    provider: "zettle",
    source: "zettle_onboarding",
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString(),
    ...payload
  }, { merge: true });
}

async function exchangeZettleToken(params = {}) {
  const body = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") body.set(key, String(value));
  });

  const response = await fetch(`${ZETTLE_OAUTH_BASE_URL}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const text = await response.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (_) {
    parsed = {};
  }

  if (!response.ok) {
    const message = sanitizeString(parsed.error_description || parsed.error || "Zettle token exchange fejlede.", 300);
    throw new HttpsError("failed-precondition", message);
  }

  return parsed;
}

async function fetchZettleUserInfo(accessToken) {
  if (!accessToken) return {};
  try {
    const response = await fetch("https://oauth.zettle.com/users/self", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) return {};
    return await response.json();
  } catch (_) {
    return {};
  }
}

function tokenExpiryIso(token = {}) {
  const expiresIn = Number(token.expires_in || token.expiresIn || 0);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) return "";
  return new Date(Date.now() + Math.max(30, expiresIn - 60) * 1000).toISOString();
}

function isTokenFresh(secret = {}) {
  if (!secret.accessToken || !secret.accessTokenExpiresAtIso) return false;
  const expiresAt = Date.parse(secret.accessTokenExpiresAtIso);
  return Number.isFinite(expiresAt) && expiresAt > Date.now() + 90 * 1000;
}

async function refreshZettleAccessToken(companyId, locationId, secret = {}, requestedScopes = []) {
  if (isTokenFresh(secret)) return secret;

  const secrets = getZettleSecrets();
  if (!secrets.clientId) {
    throw new HttpsError("failed-precondition", "Zettle client id mangler i Functions secrets.");
  }

  let token = null;
  if (secret.refreshToken && secrets.clientSecret) {
    token = await exchangeZettleToken({
      grant_type: "refresh_token",
      refresh_token: secret.refreshToken,
      client_id: secrets.clientId,
      client_secret: secrets.clientSecret,
      scope: requestedScopes.length ? requestedScopes.join(" ") : undefined
    });
  } else if (secrets.apiKey) {
    token = await exchangeZettleToken({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: secrets.apiKey,
      client_id: secrets.clientId,
      scope: requestedScopes.length ? requestedScopes.join(" ") : undefined
    });
  } else {
    throw new HttpsError("failed-precondition", "Zettle refresh-token eller API key mangler.");
  }

  const patch = {
    accessToken: token.access_token || token.accessToken || "",
    accessTokenExpiresAtIso: tokenExpiryIso(token),
    scopes: sanitizeString(token.scope || "", 1000).split(/\s+/).filter(Boolean),
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtIso: new Date().toISOString()
  };
  if (token.refresh_token || token.refreshToken) {
    patch.refreshToken = token.refresh_token || token.refreshToken;
  }

  await integrationSecretRef(companyId, locationId).set(patch, { merge: true });
  await writeZettleAudit(companyId, locationId, {
    action: "zettle_token_refreshed",
    scopes: patch.scopes
  });
  return { ...secret, ...patch };
}

const startZettleMerchantOnboarding = onCall(
  {
    region: "us-central1",
    secrets: ZETTLE_SECRETS
  },
  async (request) => {
    const data = request.data || {};
    const access = await assertPosLocationAccess({ data, auth: request.auth });
    const secrets = getZettleSecrets();
    if (!secrets.clientId) {
      return {
        ok: false,
        code: "ZETTLE_CLIENT_ID_MISSING",
        message: "Zettle client id mangler i Firebase Functions secrets."
      };
    }
    if (!secrets.clientSecret && !secrets.apiKey) {
      return {
        ok: false,
        code: "ZETTLE_SERVER_CREDENTIALS_MISSING",
        message: "Zettle API key eller client secret mangler i Firebase Functions secrets."
      };
    }

    const state = randomToken(32);
    const stateHash = sha256(state);
    const returnUrl = sanitizeReturnUrl(data.returnUrl);
    const redirectUri = getFunctionBaseUrl("handleZettleMerchantCallback");
    const scopes = DEFAULT_ZETTLE_SCOPES;
    await onboardingStateRef(stateHash).set({
      provider: "zettle",
      companyId: access.companyId,
      locationId: access.locationId,
      uid: access.uid,
      email: access.email || "",
      returnUrl,
      redirectUri,
      scopes,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });

    const url = new URL(`${ZETTLE_OAUTH_BASE_URL}/authorize`);
    url.searchParams.set("client_id", secrets.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    if (scopes.length) url.searchParams.set("scope", scopes.join(" "));

    await integrationRef(access.companyId, access.locationId).set({
      provider: "zettle",
      status: "not_connected",
      mode: "production",
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtIso: new Date().toISOString()
    }, { merge: true });
    await writeZettleAudit(access.companyId, access.locationId, {
      action: "zettle_onboarding_started",
      uid: access.uid,
      scopes
    });

    return {
      ok: true,
      provider: "zettle",
      mode: "production",
      url: url.toString(),
      onboardingUrl: url.toString(),
      expiresAtIso: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      message: "Åbn Zettle for at forbinde merchant-kontoen."
    };
  }
);

const handleZettleMerchantCallback = onRequest(
  {
    region: "us-central1",
    secrets: ZETTLE_SECRETS
  },
  async (req, res) => {
    const state = sanitizeString(req.query.state || "", 400);
    const code = sanitizeString(req.query.code || "", 1200);
    const error = sanitizeString(req.query.error || "", 300);
    const errorDescription = sanitizeString(req.query.error_description || "", 600);
    const stateHash = sha256(state);
    const stateSnap = state ? await onboardingStateRef(stateHash).get() : null;
    const stateData = stateSnap?.exists ? stateSnap.data() || {} : null;
    const returnUrl = sanitizeReturnUrl(stateData?.returnUrl);

    function redirect(status, message) {
      const url = new URL(returnUrl);
      url.searchParams.set("zettle", status);
      if (stateData?.companyId) url.searchParams.set("companyId", stateData.companyId);
      if (stateData?.locationId) url.searchParams.set("locationId", stateData.locationId);
      url.searchParams.set("view", "settings");
      if (message) url.searchParams.set("message", message);
      res.redirect(302, url.toString());
    }

    if (!state || !stateData) {
      return redirect("error", "Ugyldig Zettle state.");
    }

    const expiresAt = Date.parse(stateData.expiresAtIso || "");
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      await onboardingStateRef(stateHash).set({ status: "expired", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return redirect("error", "Zettle forbindelsen udløb. Prøv igen.");
    }

    if (error) {
      await onboardingStateRef(stateHash).set({
        status: "error",
        errorMessage: errorDescription || error,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return redirect("error", errorDescription || error);
    }

    if (!code) {
      return redirect("error", "Zettle callback mangler code.");
    }

    const { companyId, locationId, redirectUri, scopes = [] } = stateData;
    try {
      const secrets = getZettleSecrets();
      if (!secrets.clientId || !secrets.clientSecret) {
        throw new HttpsError("failed-precondition", "Zettle client secret mangler til OAuth code exchange.");
      }

      const token = await exchangeZettleToken({
        grant_type: "authorization_code",
        code,
        client_id: secrets.clientId,
        client_secret: secrets.clientSecret,
        redirect_uri: redirectUri || getFunctionBaseUrl("handleZettleMerchantCallback")
      });
      const accessToken = token.access_token || token.accessToken || "";
      const userInfo = await fetchZettleUserInfo(accessToken);
      const merchantId = sanitizeString(
        userInfo.merchantUuid || userInfo.merchantId || userInfo.uuid || userInfo.organizationUuid || "",
        180
      );
      const safeDisplayName = sanitizeString(
        userInfo.name || userInfo.displayName || userInfo.email || "Zettle merchant",
        180
      );
      const tokenScopes = sanitizeString(token.scope || "", 1000).split(/\s+/).filter(Boolean);
      const nowIso = new Date().toISOString();

      await integrationRef(companyId, locationId).set({
        provider: "zettle",
        status: "connected",
        mode: "production",
        merchantId,
        safeDisplayName,
        scopes: tokenScopes.length ? tokenScopes : scopes,
        connectedAt: FieldValue.serverTimestamp(),
        connectedAtIso: nowIso,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: nowIso,
        lastAuthCheckAt: FieldValue.serverTimestamp(),
        errorMessage: ""
      }, { merge: true });

      await integrationSecretRef(companyId, locationId).set({
        provider: "zettle",
        accessToken,
        refreshToken: token.refresh_token || token.refreshToken || "",
        accessTokenExpiresAtIso: tokenExpiryIso(token),
        scopes: tokenScopes.length ? tokenScopes : scopes,
        tokenType: sanitizeString(token.token_type || token.tokenType || "Bearer", 80),
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: nowIso
      }, { merge: true });

      await onboardingStateRef(stateHash).set({
        status: "completed",
        completedAt: FieldValue.serverTimestamp(),
        completedAtIso: nowIso,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      await writeZettleAudit(companyId, locationId, {
        action: "zettle_merchant_connected",
        merchantId,
        safeDisplayName
      });
      return redirect("connected", "Zettle-konto er forbundet.");
    } catch (err) {
      const message = sanitizeString(err?.message || "Zettle OAuth callback fejlede.", 600);
      await integrationRef(companyId, locationId).set({
        provider: "zettle",
        status: "error",
        errorMessage: message,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: new Date().toISOString()
      }, { merge: true });
      await onboardingStateRef(stateHash).set({
        status: "error",
        errorMessage: message,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      await writeZettleAudit(companyId, locationId, {
        action: "zettle_merchant_connect_failed",
        errorMessage: message
      });
      return redirect("error", message);
    }
  }
);

const getZettleMerchantAuthStatus = onCall(
  {
    region: "us-central1",
    secrets: ZETTLE_SECRETS
  },
  async (request) => {
    const data = request.data || {};
    const access = await assertPosLocationAccess({ data, auth: request.auth });
    const status = await loadMerchantStatus(access.companyId, access.locationId);
    await integrationRef(access.companyId, access.locationId).set({
      provider: "zettle",
      lastAuthCheckAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return status;
  }
);

const createZettleSdkSession = onCall(
  {
    region: "us-central1",
    secrets: ZETTLE_SECRETS
  },
  async (request) => {
    const data = request.data || {};
    const access = await assertPosLocationAccess({ data, auth: request.auth });
    const saleId = sanitizeString(data.saleId || "", 140);
    if (!saleId) throw new HttpsError("invalid-argument", "saleId er påkrævet.");

    const snap = await saleRef(access.companyId, access.locationId, saleId).get();
    if (!snap.exists) throw new HttpsError("not-found", "Salget blev ikke fundet.");

    const sale = { id: snap.id, ...(snap.data() || {}) };
    assertSaleBelongsToScope(sale, access);
    assertSaleCanStartPayment(sale);

    const amount = cleanMoney(data.amount || sale.totalInclVat || sale.total || sale.vatSummary?.totalIncVat, "Beløbet");
    const saleAmount = cleanMoney(sale.totalInclVat || sale.total || sale.vatSummary?.totalIncVat, "Salgets beløb");
    if (Math.abs(amount - saleAmount) > 0.01) {
      throw new HttpsError("failed-precondition", "Betalingsbeløbet matcher ikke salget.");
    }

    const currency = sanitizeString(data.currency || sale.currency || "DKK", 12).toUpperCase() || "DKK";
    if (currency !== "DKK") {
      throw new HttpsError("failed-precondition", "Zettle SDK-session understøtter kun DKK i denne opsætning.");
    }

    const merchant = await loadMerchantStatus(access.companyId, access.locationId);
    if (!merchant.connected) {
      return merchantNotConnectedResponse();
    }

    let secret = {};
    const secretSnap = await integrationSecretRef(access.companyId, access.locationId).get();
    if (secretSnap.exists) secret = secretSnap.data() || {};

    let refreshedSecret;
    try {
      refreshedSecret = await refreshZettleAccessToken(access.companyId, access.locationId, secret, merchant.scopes || DEFAULT_ZETTLE_SCOPES);
    } catch (err) {
      const message = sanitizeString(err?.message || "Zettle token refresh fejlede.", 600);
      await integrationRef(access.companyId, access.locationId).set({
        provider: "zettle",
        status: "error",
        errorMessage: message,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtIso: new Date().toISOString()
      }, { merge: true });
      await writeZettleAudit(access.companyId, access.locationId, {
        action: "zettle_token_refresh_failed",
        errorMessage: message
      });
      return {
        ok: false,
        provider: "zettle",
        status: "failed",
        paymentStatus: "failed",
        code: "ZETTLE_AUTH_REFRESH_FAILED",
        errorCode: "ZETTLE_AUTH_REFRESH_FAILED",
        technicalStatus: "auth_refresh_failed",
        message: "Zettle forbindelsen kunne ikke fornyes. Forbind Zettle igen i POS-indstillinger."
      };
    }

    const secrets = getZettleSecrets();
    const paymentSessionId = sanitizeString(data.paymentSessionId || sale.paymentSessionId || saleId, 180);
    const reference = sanitizeString(data.reference || sale.receiptLabel || sale.receiptNumber || sale.id, 180);
    const nowIso = new Date().toISOString();
    const expiresAt = Date.parse(refreshedSecret.accessTokenExpiresAtIso || "");
    const expiresInSeconds = Number.isFinite(expiresAt)
      ? Math.max(30, Math.floor((expiresAt - Date.now()) / 1000))
      : 300;
    const session = {
      ok: true,
      provider: "zettle",
      providerMode: "native_sdk",
      status: "ready",
      paymentStatus: "awaiting_payment",
      sdkSessionStatus: "ready",
      mode: merchant.mode,
      merchantId: merchant.merchantId,
      safeDisplayName: merchant.safeDisplayName,
      saleId,
      amount,
      amountMinor: Math.round(amount * 100),
      currency,
      reference,
      paymentSessionId,
      createdAtIso: nowIso,
      sdkAuth: {
        authModel: "provided_authentication",
        clientId: secrets.clientId,
        accessToken: refreshedSecret.accessToken || "",
        expiresInSeconds,
        scopes: refreshedSecret.scopes || merchant.scopes || DEFAULT_ZETTLE_SCOPES,
        tokenType: refreshedSecret.tokenType || "Bearer"
      },
      message: "Zettle SDK-session er klar."
    };

    await paymentRef(access.companyId, access.locationId, paymentSessionId).set({
      companyId: access.companyId,
      locationId: access.locationId,
      saleId,
      provider: "zettle",
      providerMode: "native_sdk",
      sdkSessionStatus: "ready",
      merchantId: merchant.merchantId,
      merchantMode: merchant.mode,
      status: "awaiting_payment",
      paymentStatus: "awaiting_payment",
      amount,
      currency,
      reference,
      createdBy: access.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtIso: nowIso
    }, { merge: true });

    return session;
  }
);

const getZettleLinkedReaders = onCall(
  {
    region: "us-central1",
    secrets: ZETTLE_SECRETS
  },
  async (request) => {
    const data = request.data || {};
    await assertPosLocationAccess({ data, auth: request.auth });
    const secretStatus = getZettleSecretStatus();
    if (!secretStatus.hasClientId || !secretStatus.hasServerCredential) {
      return zettleUnavailableResponse(
        "Zettle/PayPal credentials mangler ZETTLE_CLIENT_ID og ZETTLE_API_KEY eller ZETTLE_CLIENT_SECRET i Firebase Functions secrets.",
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
    const access = await assertPosLocationAccess({ data, auth: request.auth });
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
    secrets: ZETTLE_SECRETS
  },
  async (request) => {
    const data = request.data || {};
    const access = await assertPosLocationAccess({ data, auth: request.auth });
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
    secrets: ZETTLE_SECRETS
  },
  async (request) => {
    const data = request.data || {};
    await assertPosLocationAccess({ data, auth: request.auth });
    throwZettleNotReady();
  }
);

module.exports = {
  startZettleMerchantOnboarding,
  handleZettleMerchantCallback,
  getZettleMerchantAuthStatus,
  createZettleSdkSession,
  getZettleLinkedReaders,
  saveZettleReaderForLocation,
  createZettlePaymentRequest,
  cancelZettlePaymentRequest
};
