import {
  mapSaveSeoGeneratorConfigPayload,
  saveSeoGeneratorConfigDraft
} from "./save-seo-generator-config-mapper.js";

function trimString(value) {
  return String(value ?? "").trim();
}

function unwrapCallablePayload(data) {
  return data?.data && typeof data.data === "object" ? data.data : data;
}

function createError(code, message, createHttpsError) {
  if (typeof createHttpsError === "function") {
    return createHttpsError(code, message);
  }
  const error = new Error(message);
  error.code = code;
  return error;
}

function createSaveSeoGeneratorConfigRuntimeWrapper(options = {}) {
  const {
    db,
    assertSeoGeneratorAccess,
    baseDomain,
    defaultLanguage,
    defaultCountry,
    createHttpsError
  } = options;

  if (!db || typeof db.collection !== "function") {
    throw new TypeError("saveSeoGeneratorConfig runtime wrapper requires injected db.");
  }

  return async function saveSeoGeneratorConfigRuntime(data, context = {}) {
    const payload = unwrapCallablePayload(data);
    const companyId = trimString(payload?.companyId);
    const locationId = trimString(payload?.locationId);
    const isOnboarding = companyId.toLowerCase().startsWith("onboarding_");

    if (!companyId || !locationId) {
      throw createError("invalid-argument", "companyId og locationId er paakraevet.", createHttpsError);
    }

    if (!isOnboarding && !context.auth?.uid) {
      throw createError("unauthenticated", "Log ind for at gemme generator-data.", createHttpsError);
    }

    if (!isOnboarding && typeof assertSeoGeneratorAccess === "function") {
      await assertSeoGeneratorAccess({
        uid: context.auth.uid,
        email: context.auth.token?.email || "",
        companyId,
        locationId
      });
    }

    const mapped = mapSaveSeoGeneratorConfigPayload(payload, {
      baseDomain,
      defaultLanguage,
      defaultCountry
    });
    const saved = await saveSeoGeneratorConfigDraft(db, payload, {
      baseDomain,
      defaultLanguage,
      defaultCountry
    });

    return {
      ok: true,
      configId: saved.configId,
      subdomain: mapped.subdomain
    };
  };
}

export { createSaveSeoGeneratorConfigRuntimeWrapper };
