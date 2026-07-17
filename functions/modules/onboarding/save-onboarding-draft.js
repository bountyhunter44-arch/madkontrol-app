"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {
  calculatePlatformPricingSnapshot,
  normalizeSelectedModules
} = require("../../platform/module-pricing");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

function sanitizeString(value, maxLen = 500) {
  return String(value || "").trim().slice(0, maxLen);
}

function normalizeUrl(value) {
  const raw = sanitizeString(value || "", 500);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
}

function firstText(...values) {
  for (const value of values) {
    const text = sanitizeString(value || "", 500);
    if (text) return text;
  }
  return "";
}

function normalizeCvrValue(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function hasOnboardingPayloadFields(value = {}) {
  return Boolean(
    value.companyName ||
    value.name ||
    value.businessName ||
    value.legalName ||
    value.cvr ||
    value.cvrNumber ||
    value.companyCvr ||
    value.businessCvr ||
    value.vatNumber ||
    value.company ||
    value.profile
  );
}

function unwrapCallableData(data = {}) {
  const input = data && typeof data === "object" ? data : {};
  const nestedData = input.data && typeof input.data === "object" ? input.data : {};
  if (input.data && Object.keys(nestedData).length && !hasOnboardingPayloadFields(input)) {
    return nestedData;
  }
  return input;
}

function normalizeOnboardingDraftInput(data = {}) {
  const sourceData = unwrapCallableData(data);
  const company = sourceData.company && typeof sourceData.company === "object" ? sourceData.company : {};
  const profile = sourceData.profile && typeof sourceData.profile === "object" ? sourceData.profile : {};
  const setup = sourceData.setup && typeof sourceData.setup === "object" ? sourceData.setup : {};

  const companyName = firstText(
    sourceData.companyName,
    sourceData.name,
    sourceData.businessName,
    sourceData.legalName,
    sourceData.virksomhed,
    sourceData.navn,
    company.companyName,
    company.name,
    company.businessName,
    company.legalName,
    company.virksomhed,
    company.navn,
    profile.companyName,
    profile.name,
    profile.businessName,
    profile.legalName
  );

  const cvr = normalizeCvrValue(firstText(
    sourceData.cvr,
    sourceData.cvrNumber,
    sourceData.companyCvr,
    sourceData.businessCvr,
    sourceData.vatNumber,
    company.cvr,
    company.cvrNumber,
    company.companyCvr,
    company.businessCvr,
    company.vatNumber,
    profile.cvr,
    profile.cvrNumber,
    profile.companyCvr,
    profile.businessCvr,
    profile.vatNumber
  ));

  const selectedModules = Array.isArray(sourceData.selectedModules)
    ? normalizeSelectedModules(sourceData.selectedModules).slice(0, 30)
    : [];
  const billingInterval = sanitizeString(sourceData.billingInterval || "monthly", 40) === "yearly" ? "yearly" : "monthly";
  const address = firstText(sourceData.address, company.address, profile.address);
  const postalCode = firstText(sourceData.postalCode, sourceData.zip, company.postalCode, company.zip, profile.postalCode, profile.zip);
  const city = firstText(sourceData.city, company.city, profile.city);
  const phone = firstText(sourceData.phone, sourceData.phoneNumber, company.phone, company.phoneNumber, profile.phone, profile.phoneNumber);
  const email = firstText(sourceData.email, sourceData.accountEmail, company.email, company.accountEmail, profile.email, profile.accountEmail).toLowerCase();
  const industryCode = firstText(sourceData.industryCode, company.industryCode, profile.industryCode);
  const industryText = firstText(sourceData.industryText, sourceData.industry, company.industryText, company.industry, profile.industryText, profile.industry);
  const smileyUrl = normalizeUrl(firstText(sourceData.smileyUrl, sourceData.controlReportUrl, company.smileyUrl, company.controlReportUrl, profile.smileyUrl, profile.controlReportUrl));
  const controlReportUrl = normalizeUrl(firstText(sourceData.controlReportUrl, sourceData.smileyUrl, company.controlReportUrl, company.smileyUrl, profile.controlReportUrl, profile.smileyUrl));

  return {
    ...sourceData,
    source: sanitizeString(sourceData.source || "quick_onboarding", 80),
    crmLeadId: sanitizeString(sourceData.crmLeadId || "", 120),
    companyName,
    name: companyName,
    cvr,
    cvrNumber: cvr,
    address,
    postalCode,
    zip: postalCode,
    city,
    phone,
    email,
    accountEmail: email,
    website: normalizeUrl(firstText(sourceData.website, sourceData.websiteUrl, company.website, profile.website)),
    smileyUrl,
    controlReportUrl,
    industry: sanitizeString(sourceData.industry || profile.industry || "", 80),
    industryCode,
    industryText,
    selectedModules,
    plan: sanitizeString(sourceData.plan || "pro", 80),
    billingInterval,
    pricingSnapshot: calculatePlatformPricingSnapshot(selectedModules, billingInterval),
    status: sanitizeString(sourceData.status || "draft", 40) || "draft",
    company: {
      ...company,
      name: companyName,
      companyName,
      cvr,
      cvrNumber: cvr,
      address,
      postalCode,
      zip: postalCode,
      city,
      phone,
      email,
      industryCode,
      industryText
    },
    setup
  };
}

const saveOnboardingDraft = functions.https.onCall(async (data, context) => {
  const rawData = unwrapCallableData(data || {});
  const payload = normalizeOnboardingDraftInput(rawData);
  const draftId = sanitizeString(rawData?.draftId || "", 120);
  const callableAuth = context?.auth || data?.auth || {};
  const createdBy = sanitizeString(callableAuth?.uid || rawData?.createdBy || "", 160);

  if (!payload.companyName && !payload.cvr) {
    console.warn("[saveOnboardingDraft] missing companyName/cvr", {
      rawKeys: Object.keys(rawData || {}),
      wrappedKeys: data && typeof data === "object" ? Object.keys(data) : [],
      hasNestedData: Boolean(data?.data),
      normalizedCompanyName: payload.companyName,
      normalizedCvr: payload.cvr
    });
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Firmanavn eller CVR er påkrævet."
    );
  }

  try {
    if (draftId) {
      await db.collection("onboarding_drafts").doc(draftId).set({
        ...payload,
        updatedBy: createdBy,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      console.log("[quick onboarding] quick_onboarding_draft_saved", draftId);
      return { ok: true, draftId };
    }

    const ref = await db.collection("onboarding_drafts").add({
      ...payload,
      createdBy,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log("[quick onboarding] quick_onboarding_draft_saved", ref.id);
    return { ok: true, draftId: ref.id };
  } catch (error) {
    console.error("saveOnboardingDraft fejl:", error);
    throw new functions.https.HttpsError(
      "internal",
      error?.message || "Kunne ikke gemme onboarding draft."
    );
  }
});

module.exports = {
  saveOnboardingDraft,
  normalizeOnboardingDraftInput
};

