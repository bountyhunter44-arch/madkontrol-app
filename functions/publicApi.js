const crypto = require("crypto");

const PUBLIC_INTEGRATIONS_COLLECTION = "public_integrations";
const DEFAULT_ALLOWED_METHODS = "GET, OPTIONS";

function sanitizeString(value, maxLen = 200) {
  return String(value || "").trim().slice(0, maxLen);
}

function normalizeDomain(value) {
  const raw = sanitizeString(value, 300).toLowerCase();
  if (!raw) return "";

  const candidate = raw.includes("://") ? raw : `https://${raw}`;

  try {
    const parsed = new URL(candidate);
    return String(parsed.hostname || "")
      .trim()
      .toLowerCase()
      .replace(/\.$/, "");
  } catch (error) {
    return raw
      .split("/")[0]
      .split(":")[0]
      .trim()
      .toLowerCase()
      .replace(/\.$/, "");
  }
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((item) => sanitizeString(item, 120))
        .filter(Boolean)
    )
  ];
}

function normalizeDomainList(value) {
  return normalizeList(value)
    .map(normalizeDomain)
    .filter(Boolean);
}

function hashSiteToken(siteToken) {
  return crypto
    .createHash("sha256")
    .update(String(siteToken || ""), "utf8")
    .digest("hex");
}

function publicApiError(status, code, message) {
  const error = new Error(message);
  error.publicApi = { status, code, message };
  return error;
}

function sendJson(res, status, payload) {
  res.set("Cache-Control", "no-store");
  res.set("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
}

function sendError(res, status, code, message) {
  return sendJson(res, status, {
    ok: false,
    error: {
      code,
      message
    }
  });
}

function getRequestPath(req) {
  const host = req.get("host") || "madkontrollen.dk";
  const url = new URL(req.originalUrl || req.url || "/", `https://${host}`);
  return url.pathname.replace(/\/+$/, "") || "/";
}

function resolvePublicRoute(pathname) {
  const withoutApiPrefix = pathname.replace(/^\/api(?=\/|$)/, "");
  const path = withoutApiPrefix.replace(/^\/public(?=\/|$)/, "") || "/";

  if (path === "/" || path === "/health") {
    return {
      key: "health",
      moduleKey: "core"
    };
  }

  if (path === "/egenkontrol/status") {
    return {
      key: "egenkontrolStatus",
      moduleKey: "egenkontrol"
    };
  }

  return null;
}

function getOriginDomains(req) {
  return [
    normalizeDomain(req.get("origin") || ""),
    normalizeDomain(req.get("referer") || "")
  ].filter(Boolean);
}

function setCorsHeaders(req, res) {
  const origin = req.get("origin") || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", DEFAULT_ALLOWED_METHODS);
  res.set("Access-Control-Allow-Headers", "Content-Type, Accept");
}

function hasModule(modules, moduleKey) {
  const normalized = normalizeList(modules).map((item) => item.toLowerCase());
  return normalized.includes(moduleKey);
}

function extractCompanyModules(companyData) {
  const candidates = [
    companyData?.activeModules,
    companyData?.modules,
    companyData?.selectedModules,
    companyData?.enabledModules
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      return normalizeList(candidate).map((item) => item.toLowerCase());
    }
  }

  return [];
}

async function findLocationSnapshot(db, companyId, locationId) {
  const companyLocationSnap = await db
    .collection("companies")
    .doc(companyId)
    .collection("locations")
    .doc(locationId)
    .get();

  if (companyLocationSnap.exists) {
    return {
      source: "company-location",
      snap: companyLocationSnap
    };
  }

  const locationSnap = await db.collection("locations").doc(locationId).get();
  if (!locationSnap.exists) {
    return null;
  }

  const data = locationSnap.data() || {};
  const locationCompanyId = sanitizeString(data.companyId || data.organizationId || "", 160);

  if (locationCompanyId && locationCompanyId !== companyId) {
    return null;
  }

  return {
    source: "location",
    snap: locationSnap
  };
}

async function validateIntegration({ db, query, req, moduleKey }) {
  const siteToken = sanitizeString(query.siteToken || "", 500);
  const companyId = sanitizeString(query.companyId || "", 160);
  const locationId = sanitizeString(query.locationId || "", 160);
  const domain = normalizeDomain(query.domain || query.allowedDomain || "");

  if (!siteToken) {
    throw publicApiError(401, "missing-site-token", "Site token mangler.");
  }

  if (!companyId || !locationId) {
    throw publicApiError(400, "missing-scope", "companyId og locationId er påkrævet.");
  }

  if (!domain) {
    throw publicApiError(400, "missing-domain", "Domæne mangler.");
  }

  const siteTokenHash = hashSiteToken(siteToken);
  const integrationSnap = await db
    .collection(PUBLIC_INTEGRATIONS_COLLECTION)
    .where("type", "==", "wordpress")
    .where("siteTokenHash", "==", siteTokenHash)
    .where("active", "==", true)
    .limit(10)
    .get();

  if (integrationSnap.empty) {
    throw publicApiError(401, "invalid-site-token", "Site token er ugyldigt.");
  }

  const integrations = integrationSnap.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() || {}
  }));

  const scopedIntegration = integrations.find(({ data }) => (
    sanitizeString(data.companyId || "", 160) === companyId &&
    sanitizeString(data.locationId || "", 160) === locationId
  ));

  if (!scopedIntegration) {
    throw publicApiError(403, "scope-mismatch", "Site token matcher ikke firma og lokation.");
  }

  const allowedDomains = normalizeDomainList(scopedIntegration.data.allowedDomains);
  if (!allowedDomains.includes(domain)) {
    throw publicApiError(403, "domain-not-allowed", "Domænet er ikke tilladt for dette site token.");
  }

  const originDomains = getOriginDomains(req);
  const blockedOrigin = originDomains.find((originDomain) => !allowedDomains.includes(originDomain));
  if (blockedOrigin) {
    throw publicApiError(403, "origin-not-allowed", "Request origin matcher ikke tilladte domæner.");
  }

  const integrationModules = normalizeList(scopedIntegration.data.modules).map((item) => item.toLowerCase());
  if (!hasModule(integrationModules, moduleKey)) {
    throw publicApiError(403, "module-not-enabled", "Modulet er ikke aktivt for dette site token.");
  }

  const companySnap = await db.collection("companies").doc(companyId).get();
  if (!companySnap.exists) {
    throw publicApiError(404, "company-not-found", "Firmaet findes ikke.");
  }

  const locationResult = await findLocationSnapshot(db, companyId, locationId);
  if (!locationResult) {
    throw publicApiError(404, "location-not-found", "Lokationen findes ikke.");
  }

  const companyModules = extractCompanyModules(companySnap.data() || {});
  if (companyModules.length && moduleKey !== "core" && !companyModules.includes(moduleKey)) {
    throw publicApiError(403, "module-not-active", "Modulet er ikke aktivt for firmaet.");
  }

  return {
    integrationId: scopedIntegration.id,
    integration: scopedIntegration.data,
    companySnap,
    locationSnap: locationResult.snap,
    companyId,
    locationId,
    domain,
    modules: integrationModules
  };
}

function buildConnectionPayload(context) {
  const companyData = context.companySnap.data() || {};
  const locationData = context.locationSnap.data() || {};

  return {
    ok: true,
    service: "madkontrollen-public-api",
    version: "2026-06-08",
    message: "Forbindelse til Madkontrollen virker",
    companyId: context.companyId,
    locationId: context.locationId,
    domain: context.domain,
    companyName: sanitizeString(companyData.displayName || companyData.name || "", 200),
    locationName: sanitizeString(locationData.displayName || locationData.name || "", 200),
    modules: context.modules,
    updatedAt: new Date().toISOString()
  };
}

function createPublicApiHandler({ db }) {
  return async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "GET") {
      return sendError(res, 405, "method-not-allowed", "Brug GET til dette endpoint.");
    }

    const route = resolvePublicRoute(getRequestPath(req));
    if (!route) {
      return sendError(res, 404, "not-found", "Endpointet findes ikke.");
    }

    try {
      const context = await validateIntegration({
        db,
        query: req.query || {},
        req,
        moduleKey: route.moduleKey
      });

      const payload = buildConnectionPayload(context);

      if (route.key === "egenkontrolStatus") {
        return sendJson(res, 200, {
          ...payload,
          label: "Status for egenkontrol",
          status: "Forbundet"
        });
      }

      return sendJson(res, 200, payload);
    } catch (error) {
      if (error?.publicApi) {
        const { status, code, message } = error.publicApi;
        return sendError(res, status, code, message);
      }

      console.error("Public API fejl", {
        path: getRequestPath(req),
        error: error?.message || error
      });

      return sendError(res, 500, "internal", "Public API kunne ikke behandle forespørgslen.");
    }
  };
}

module.exports = {
  PUBLIC_INTEGRATIONS_COLLECTION,
  createPublicApiHandler,
  hashSiteToken,
  normalizeDomain,
  resolvePublicRoute,
  validateIntegration
};
