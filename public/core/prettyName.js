/**
 * @madkontrollen-registry-stamp
 * fileRole: "pretty-name-resolver"
 * projectArea: "core"
 * canonicalSystem: true
 * usesHelpers:
 *   - resolveOrgContext
 *   - resolveCompanyIdFromUserData
 *   - resolveLocationIdFromUserData
 * owns:
 *   - company display name resolution
 *   - location display name resolution
 *   - live_user_profiles display fallback priority
 *   - prettyName data contract
 * mustNotCreate:
 *   - duplicate company display resolvers
 *   - duplicate location display resolvers
 *   - inline live_user_profiles fallback chains
 * requiredBeforeEdit:
 *   - read docs/AI_TOOLBOX.md
 *   - inspect existing helpers
 *   - preserve prettyName priority order
 */
import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { resolveOrgContext } from "./auth.js";

function clean(value) {
  return String(value || "").trim();
}

function firstText(...values) {
  for (const value of values) {
    const normalized = clean(value);
    if (normalized) return normalized;
  }
  return "";
}

function addressFrom(data = {}) {
  // Try all address field variations
  const address = clean(
    data.address ||
    data.street ||
    data.streetAddress ||
    data.adresse
  );
  
  // Try all zip field variations
  const zip = clean(
    data.zip ||
    data.postalCode ||
    data.zipcode ||
    data.postCode ||
    data.postnummer
  );
  
  // Try all city field variations
  const city = clean(
    data.city ||
    data.town ||
    data.by
  );
  
  const zipCity = [zip, city].filter(Boolean).join(" ");

  if (address && zipCity) return `${address}, ${zipCity}`;
  if (address && city) return `${address}, ${city}`;
  if (address) return address;
  if (zipCity) return zipCity;
  return "";
}

function phoneFrom(data = {}) {
  return clean(
    data.phone ||
    data.phoneNumber ||
    data.telephone ||
    data.tel ||
    data.tlf ||
    data.contactPhone ||
    data.companyPhone
  );
}

function emailFrom(data = {}) {
  return clean(
    data.email ||
    data.accountEmail ||
    data.contactEmail ||
    data.ownerEmail ||
    data.companyEmail ||
    data.contact?.email ||
    data.company?.email
  );
}

function cvrFrom(data = {}) {
  return clean(
    data.cvr ||
    data.cvrNumber ||
    data.vat ||
    data.vatNumber ||
    data.company?.cvr
  );
}

function normalizeLocationIds(profile = {}) {
  return resolveOrgContext(profile).locationIds;
}

export function resolveCompanyIdFromUserData(userData = {}) {
  return resolveOrgContext(userData).companyId;
}

export function resolveLocationIdFromUserData(userData = {}) {
  return resolveOrgContext(userData).locationId;
}

function mergeLiveProfile(liveData = {}) {
  const profile = liveData.profile || {};
  return {
    ...liveData,
    profile
  };
}

async function readDoc(pathParts) {
  try {
    const snap = await getDoc(doc(db, ...pathParts));
    return snap.exists() ? (snap.data() || {}) : null;
  } catch (error) {
    console.warn("[pretty names] doc read failed", pathParts.join("/"), error);
    return null;
  }
}

async function readDocWithId(pathParts) {
  try {
    const snap = await getDoc(doc(db, ...pathParts));
    return snap.exists() ? { id: snap.id, data: snap.data() || {} } : null;
  } catch (error) {
    console.warn("[pretty names] doc read failed", pathParts.join("/"), error);
    return null;
  }
}

async function queryFirstDoc(collectionPath, constraints, label) {
  try {
    const snap = await getDocs(query(
      collection(db, collectionPath),
      ...constraints,
      limit(1)
    ));
    if (snap.empty) return null;

    const first = snap.docs[0];
    return { id: first.id, data: first.data() || {} };
  } catch (error) {
    console.warn("[pretty names] query failed", label || collectionPath, error);
    return null;
  }
}

function hasAddress(data = {}) {
  return Boolean(clean(data.address) || clean(data.zip) || clean(data.city));
}

function hasPhone(data = {}) {
  return Boolean(clean(data.phone) || clean(data.phoneNumber));
}

function hasEmail(data = {}) {
  return Boolean(emailFrom(data));
}

function hasCvr(data = {}) {
  return Boolean(cvrFrom(data));
}

export async function resolvePrettyCompanyInfo({
  uid = "",
  userData = {},
  companyId = "",
  locationId = ""
} = {}) {
  const resolvedCompanyId = clean(companyId) || resolveCompanyIdFromUserData(userData);
  const resolvedLocationId = clean(locationId) || resolveLocationIdFromUserData(userData);

  // Guard: Skip queries if no companyId available yet
  if (!resolvedCompanyId) {
    console.warn("[prettyName] No companyId available - returning fallback");
    return {
      companyName: "Virksomhed",
      locationName: "Lokation",
      displayCompany: "Virksomhed",
      displayLocation: "Lokation",
      address: "Ikke angivet",
      phone: "Ikke angivet",
      contactEmail: "Ikke angivet",
      cvr: "Ikke angivet",
      companyDocId: "",
      liveProfileDocId: ""
    };
  }

  let liveProfile = null;
  let company = null;
  let location = null;
  let companyDocId = resolvedCompanyId;
  let liveProfileDocId = "";

  if (resolvedCompanyId && resolvedLocationId) {
    const liveId = `${resolvedCompanyId}__${resolvedLocationId}__live_profile`;
    const liveDoc = await readDocWithId(["live_user_profiles", liveId]);
    liveProfileDocId = liveDoc?.id || "";
    liveProfile = liveDoc ? mergeLiveProfile(liveDoc.data) : null;

    if (!liveProfile) {
      const queriedLiveDoc = await queryFirstDoc("live_user_profiles", [
        where("companyId", "==", resolvedCompanyId),
        where("locationId", "==", resolvedLocationId)
      ], "live_user_profiles by companyId/locationId");
      liveProfileDocId = queriedLiveDoc?.id || "";
      liveProfile = queriedLiveDoc ? mergeLiveProfile(queriedLiveDoc.data) : null;
    }
  }

  if (resolvedCompanyId) {
    const companyDoc = await readDocWithId(["companies", resolvedCompanyId]);
    companyDocId = companyDoc?.id || resolvedCompanyId;
    company = companyDoc?.data || null;

    if (!company || (!hasAddress(company) && !hasPhone(company) && !hasEmail(company) && !hasCvr(company))) {
      const queriedCompanyDoc = await queryFirstDoc("companies", [
        where("companyId", "==", resolvedCompanyId)
      ], "companies by companyId");
      if (queriedCompanyDoc) {
        companyDocId = queriedCompanyDoc.id;
        company = {
          ...(company || {}),
          ...queriedCompanyDoc.data
        };
      }
    }

    if (!company || (!hasAddress(company) && !hasPhone(company) && !hasEmail(company) && !hasCvr(company))) {
      const queriedOrganizationDoc = await queryFirstDoc("companies", [
        where("organizationId", "==", resolvedCompanyId)
      ], "companies by organizationId");
      if (queriedOrganizationDoc) {
        companyDocId = queriedOrganizationDoc.id;
        company = {
          ...(company || {}),
          ...queriedOrganizationDoc.data
        };
      }
    }
  }

  if (companyDocId && resolvedLocationId) {
    location = await readDoc(["companies", companyDocId, "locations", resolvedLocationId]);
    if (!location) {
      console.warn("[pretty names] location doc missing", {
        companyId: companyDocId,
        locationId: resolvedLocationId
      });
    }
  }

  // Check if demo mode
  const isDemo = Boolean(
    userData?.demoMode ||
    userData?.isDemo ||
    company?.isDemo ||
    company?.demoMode ||
    liveProfile?.demoMode ||
    liveProfile?.isDemo
  );

  const companyName = firstText(
    liveProfile?.profile?.companyName,
    liveProfile?.companyName,
    liveProfile?.company?.name,
    company?.name,
    company?.prettyName,
    company?.displayName,
    userData?.companyName,
    isDemo ? "Demo Restaurant" : "Virksomhed"
  );

  const locationName = firstText(
    liveProfile?.locationName,
    liveProfile?.location?.name,
    location?.name,
    location?.prettyName,
    location?.displayName,
    location?.locationName,
    userData?.locationName,
    "Hovedlokation"
  );

  const address = firstText(
    liveProfile?.profile?.address,
    liveProfile?.profile?.companyAddress,
    liveProfile?.profile?.streetAddress,
    liveProfile?.address,
    liveProfile?.companyAddress,
    addressFrom(userData || {}),
    userData?.address,
    addressFrom(company || {}),
    company?.address,
    addressFrom(location || {}),
    location?.address,
    isDemo ? "Demovej 1, 4300 Holbæk" : "Ikke angivet"
  );

  const phone = firstText(
    liveProfile?.profile?.phone,
    liveProfile?.profile?.companyPhone,
    liveProfile?.profile?.contactPhone,
    liveProfile?.phone,
    liveProfile?.companyPhone,
    userData?.phone,
    userData?.companyPhone,
    company?.phone,
    company?.contactPhone,
    location?.phone,
    isDemo ? "12 34 56 78" : "Ikke angivet"
  );

  const contactEmail = firstText(
    liveProfile?.profile?.accountEmail,
    liveProfile?.profile?.email,
    liveProfile?.profile?.contactEmail,
    liveProfile?.accountEmail,
    liveProfile?.email,
    userData?.email,
    company?.email,
    "Ikke angivet"
  );

  const cvr = firstText(
    cvrFrom(liveProfile || {}),
    cvrFrom(userData || {}),
    cvrFrom(company || {}),
    cvrFrom(location || {}),
    "Ikke angivet"
  );

  const city = firstText(
    liveProfile?.profile?.city,
    liveProfile?.city,
    userData?.city,
    company?.city,
    location?.city,
    ""
  );

  const companyType = firstText(
    liveProfile?.profile?.companyType,
    liveProfile?.profile?.restaurantType,
    liveProfile?.companyType,
    liveProfile?.restaurantType,
    userData?.companyType,
    userData?.restaurantType,
    company?.companyType,
    company?.businessType,
    company?.type,
    location?.companyType,
    ""
  );

  const displayCompany = companyName;
  const displayLocation = address || locationName || "Lokation";

  console.log("[prettyName] source docs", {
    uid: clean(uid || userData?.uid || userData?.userId),
    companyId: resolvedCompanyId,
    locationId: resolvedLocationId,
    liveProfileDocId,
    companyDocId,
    liveProfile,
    company,
    location
  });

  console.log("[prettyName] resolved", {
    companyName,
    locationName,
    displayCompany,
    displayLocation,
    address,
    city,
    phone,
    contactEmail,
    companyType,
    cvr
  });

  return {
    uid: clean(uid || userData?.uid || userData?.userId),
    companyId: resolvedCompanyId,
    locationId: resolvedLocationId,
    companyName,
    locationName,
    displayCompany,
    displayLocation,
    address,
    city,
    phone,
    email: contactEmail,
    contactEmail,
    contact: contactEmail,
    companyType,
    cvr,
    usedCompanyIdFallback: Boolean(resolvedCompanyId && companyName === resolvedCompanyId),
    docs: {
      liveProfileFound: Boolean(liveProfile),
      companyFound: Boolean(company),
      locationFound: Boolean(location)
    }
  };
}
