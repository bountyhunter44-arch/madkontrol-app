import { getAppByKey } from "../../../platform/app-registry.js";
import { getAppAccess } from "../../../platform/entitlement-client.js";
import { buildAppUrl } from "../../../platform/app-launcher.js";
import { getPlatformFirebaseClient, waitForPlatformAuth } from "../../../platform/firebase-client.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CATEGORIES_COLLECTION = "menu_categories";
const ITEMS_COLLECTION = "menu_items";
const ADDON_GROUPS_COLLECTION = "menu_addon_groups";
const ADDONS_COLLECTION = "menu_addons";
const PORTAL_ENROLLMENTS_COLLECTION = "portal_enrollments";
export const PORTAL_RESTAURANTS_COLLECTION = "portal_restaurants";
export const PORTAL_MENU_ITEMS_COLLECTION = "portal_menu_items";
export const DELEFRAGT_PORTAL_KEY = "delefragt";

export async function loadMenuAppConfig() {
  const response = await fetch("./app.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Could not load menu app.json");
  return response.json();
}

export function getRelatedAppViewModels(context, relatedAppKeys = []) {
  return relatedAppKeys
    .map((appKey) => {
      const app = getAppByKey(appKey);
      if (!app) return null;
      const access = getAppAccess(app, context);
      return {
        app,
        access,
        url: access.ok ? buildAppUrl(app.appKey, context, { sourceApp: "menu", navigate: false }) : ""
      };
    })
    .filter(Boolean);
}

export function createBlankCategory(context = {}) {
  return {
    id: "",
    companyId: context.companyId || "",
    locationId: context.locationId || "",
    name: "",
    description: "",
    sortOrder: 0,
    active: true
  };
}

export function createBlankMenuItem(context = {}, categoryId = "") {
  return {
    id: "",
    companyId: context.companyId || "",
    locationId: context.locationId || "",
    categoryId,
    name: "",
    description: "",
    imageUrl: "",
    price: "",
    allergens: [],
    tags: [],
    addonGroupIds: [],
    availableForOrdering: true,
    active: true
  };
}

export function createBlankAddonGroup(context = {}) {
  return {
    id: "",
    companyId: context.companyId || "",
    locationId: context.locationId || "",
    name: "",
    required: false,
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 0,
    active: true
  };
}

export function createBlankAddon(context = {}, groupId = "") {
  return {
    id: "",
    companyId: context.companyId || "",
    locationId: context.locationId || "",
    groupId,
    name: "",
    price: "",
    sortOrder: 0,
    active: true
  };
}

export function createBlankPortalEnrollment(context = {}) {
  return {
    id: "",
    companyId: context.companyId || "",
    locationId: context.locationId || "",
    portalKey: DELEFRAGT_PORTAL_KEY,
    status: "draft",
    publicName: "",
    cuisineTypes: [],
    deliveryModes: ["pickup"],
    orderingEnabled: false,
    deliveryEnabled: false,
    menuPublished: false
  };
}

export async function listMenuCategories(context) {
  assertCompanyLocation(context);
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const snap = await getDocs(query(
    collection(db, CATEGORIES_COLLECTION),
    where("companyId", "==", context.companyId),
    where("locationId", "==", context.locationId)
  ));
  return snap.docs
    .map((entry) => normalizeCategory(entry.id, entry.data()))
    .sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || String(a.name).localeCompare(String(b.name), "da"));
}

export async function saveMenuCategory(context, draft = {}) {
  assertCompanyLocation(context);
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const payload = normalizeCategoryPayload(context, draft);
  if (!payload.name) throw new Error("Kategorinavn mangler");

  if (draft.id) {
    await updateDoc(doc(db, CATEGORIES_COLLECTION, draft.id), {
      ...payload,
      updatedAt: serverTimestamp()
    });
    return { ...payload, id: draft.id };
  }

  const ref = await addDoc(collection(db, CATEGORIES_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { ...payload, id: ref.id };
}

export async function deleteMenuCategory(context, categoryId) {
  assertCompanyLocation(context);
  if (!categoryId) return;
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const items = await listMenuItems(context);
  const affectedItems = items.filter((item) => item.categoryId === categoryId);
  await Promise.all(affectedItems.map((item) => updateDoc(doc(db, ITEMS_COLLECTION, item.id), {
    categoryId: "",
    updatedAt: serverTimestamp()
  })));
  await deleteDoc(doc(db, CATEGORIES_COLLECTION, categoryId));
}

export async function listMenuItems(context) {
  assertCompanyLocation(context);
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const snap = await getDocs(query(
    collection(db, ITEMS_COLLECTION),
    where("companyId", "==", context.companyId),
    where("locationId", "==", context.locationId)
  ));
  return snap.docs
    .map((entry) => normalizeMenuItem(entry.id, entry.data()))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "da"));
}

export async function listAddonGroups(context) {
  assertCompanyLocation(context);
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const snap = await getDocs(query(
    collection(db, ADDON_GROUPS_COLLECTION),
    where("companyId", "==", context.companyId),
    where("locationId", "==", context.locationId)
  ));
  return snap.docs
    .map((entry) => normalizeAddonGroup(entry.id, entry.data()))
    .sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || String(a.name).localeCompare(String(b.name), "da"));
}

export async function saveAddonGroup(context, draft = {}) {
  assertCompanyLocation(context);
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const payload = normalizeAddonGroupPayload(context, draft);
  if (!payload.name) throw new Error("Navn på tilvalgsgruppe mangler");

  if (draft.id) {
    await updateDoc(doc(db, ADDON_GROUPS_COLLECTION, draft.id), {
      ...payload,
      updatedAt: serverTimestamp()
    });
    return { ...payload, id: draft.id };
  }

  const ref = await addDoc(collection(db, ADDON_GROUPS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { ...payload, id: ref.id };
}

export async function deleteAddonGroup(context, groupId) {
  assertCompanyLocation(context);
  if (!groupId) return;
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const [items, addons] = await Promise.all([
    listMenuItems(context),
    listAddons(context)
  ]);
  await Promise.all(items
    .filter((item) => item.addonGroupIds.includes(groupId))
    .map((item) => updateDoc(doc(db, ITEMS_COLLECTION, item.id), {
      addonGroupIds: item.addonGroupIds.filter((id) => id !== groupId),
      updatedAt: serverTimestamp()
    })));
  await Promise.all(addons
    .filter((addon) => addon.groupId === groupId)
    .map((addon) => deleteDoc(doc(db, ADDONS_COLLECTION, addon.id))));
  await deleteDoc(doc(db, ADDON_GROUPS_COLLECTION, groupId));
}

export async function toggleAddonGroupActive(group) {
  if (!group?.id) return null;
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const active = group.active === false;
  await updateDoc(doc(db, ADDON_GROUPS_COLLECTION, group.id), {
    active,
    updatedAt: serverTimestamp()
  });
  return { ...group, active };
}

export async function listAddons(context) {
  assertCompanyLocation(context);
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const snap = await getDocs(query(
    collection(db, ADDONS_COLLECTION),
    where("companyId", "==", context.companyId),
    where("locationId", "==", context.locationId)
  ));
  return snap.docs
    .map((entry) => normalizeAddon(entry.id, entry.data()))
    .sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) || String(a.name).localeCompare(String(b.name), "da"));
}

export async function saveAddon(context, draft = {}) {
  assertCompanyLocation(context);
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const payload = normalizeAddonPayload(context, draft);
  if (!payload.groupId) throw new Error("Vælg en tilvalgsgruppe");
  if (!payload.name) throw new Error("Navn på tilvalg mangler");

  if (draft.id) {
    await updateDoc(doc(db, ADDONS_COLLECTION, draft.id), {
      ...payload,
      updatedAt: serverTimestamp()
    });
    return { ...payload, id: draft.id };
  }

  const ref = await addDoc(collection(db, ADDONS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { ...payload, id: ref.id };
}

export async function deleteAddon(addonId) {
  if (!addonId) return;
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  await deleteDoc(doc(db, ADDONS_COLLECTION, addonId));
}

export async function toggleAddonActive(addon) {
  if (!addon?.id) return null;
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const active = addon.active === false;
  await updateDoc(doc(db, ADDONS_COLLECTION, addon.id), {
    active,
    updatedAt: serverTimestamp()
  });
  return { ...addon, active };
}

export async function loadPortalEnrollment(context, portalKey = DELEFRAGT_PORTAL_KEY) {
  assertCompanyLocation(context);
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const snap = await getDocs(query(
    collection(db, PORTAL_ENROLLMENTS_COLLECTION),
    where("companyId", "==", context.companyId),
    where("locationId", "==", context.locationId),
    where("portalKey", "==", portalKey)
  ));
  if (snap.empty) return createBlankPortalEnrollment(context);
  const entry = snap.docs[0];
  return normalizePortalEnrollment(entry.id, entry.data(), context);
}

export async function savePortalEnrollment(context, draft = {}) {
  assertCompanyLocation(context);
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const payload = normalizePortalEnrollmentPayload(context, draft);

  if (draft.id) {
    await updateDoc(doc(db, PORTAL_ENROLLMENTS_COLLECTION, draft.id), {
      ...payload,
      updatedAt: serverTimestamp()
    });
    return { ...payload, id: draft.id };
  }

  const ref = await addDoc(collection(db, PORTAL_ENROLLMENTS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { ...payload, id: ref.id };
}

export async function saveMenuItem(context, draft = {}) {
  assertCompanyLocation(context);
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const payload = normalizeMenuItemPayload(context, draft);
  if (!payload.name) throw new Error("Rettens navn mangler");

  if (draft.id) {
    await updateDoc(doc(db, ITEMS_COLLECTION, draft.id), {
      ...payload,
      updatedAt: serverTimestamp()
    });
    return { ...payload, id: draft.id };
  }

  const ref = await addDoc(collection(db, ITEMS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { ...payload, id: ref.id };
}

export async function deleteMenuItem(itemId) {
  if (!itemId) return;
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  await deleteDoc(doc(db, ITEMS_COLLECTION, itemId));
}

export async function toggleMenuItemActive(item) {
  if (!item?.id) return null;
  const { db } = await getPlatformFirebaseClient();
  await waitForPlatformAuth();
  const active = item.active === false;
  await updateDoc(doc(db, ITEMS_COLLECTION, item.id), {
    active,
    updatedAt: serverTimestamp()
  });
  return { ...item, active };
}

function assertCompanyLocation(context = {}) {
  if (!context.companyId || !context.locationId) {
    throw new Error("Vælg virksomhed/lokation for at bruge Menu & Retter");
  }
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true" || String(value).toLowerCase() === "on";
}

function normalizeCategory(id, data = {}) {
  return {
    id,
    companyId: data.companyId || "",
    locationId: data.locationId || "",
    name: data.name || "",
    description: data.description || "",
    sortOrder: Number(data.sortOrder || 0),
    active: data.active !== false,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

function normalizeCategoryPayload(context, draft = {}) {
  return {
    companyId: context.companyId,
    locationId: context.locationId,
    name: String(draft.name || "").trim(),
    description: String(draft.description || "").trim(),
    sortOrder: Number(draft.sortOrder || 0),
    active: draft.active !== false
  };
}

function normalizeMenuItem(id, data = {}) {
  return {
    id,
    companyId: data.companyId || "",
    locationId: data.locationId || "",
    categoryId: data.categoryId || "",
    name: data.name || "",
    description: data.description || "",
    imageUrl: data.imageUrl || data.image || "",
    price: Number(data.price || 0),
    allergens: normalizeList(data.allergens),
    tags: normalizeList(data.tags),
    addonGroupIds: normalizeList(data.addonGroupIds),
    availableForOrdering: data.availableForOrdering !== false,
    active: data.active !== false,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

function normalizeMenuItemPayload(context, draft = {}) {
  return {
    companyId: context.companyId,
    locationId: context.locationId,
    categoryId: String(draft.categoryId || "").trim(),
    name: String(draft.name || "").trim(),
    description: String(draft.description || "").trim(),
    imageUrl: String(draft.imageUrl || "").trim(),
    price: Number(draft.price || 0),
    allergens: normalizeList(draft.allergens),
    tags: normalizeList(draft.tags),
    addonGroupIds: normalizeList(draft.addonGroupIds),
    availableForOrdering: draft.availableForOrdering !== false,
    active: draft.active !== false
  };
}

function normalizeAddonGroup(id, data = {}) {
  return {
    id,
    companyId: data.companyId || "",
    locationId: data.locationId || "",
    name: data.name || "",
    required: Boolean(data.required),
    minSelect: Number(data.minSelect || 0),
    maxSelect: Number(data.maxSelect || 1),
    sortOrder: Number(data.sortOrder || 0),
    active: data.active !== false,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

function normalizeAddonGroupPayload(context, draft = {}) {
  return {
    companyId: context.companyId,
    locationId: context.locationId,
    name: String(draft.name || "").trim(),
    required: normalizeBoolean(draft.required, false),
    minSelect: Number(draft.minSelect || 0),
    maxSelect: Number(draft.maxSelect || 1),
    sortOrder: Number(draft.sortOrder || 0),
    active: draft.active !== false
  };
}

function normalizeAddon(id, data = {}) {
  return {
    id,
    companyId: data.companyId || "",
    locationId: data.locationId || "",
    groupId: data.groupId || "",
    name: data.name || "",
    price: Number(data.price || 0),
    sortOrder: Number(data.sortOrder || 0),
    active: data.active !== false,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

function normalizeAddonPayload(context, draft = {}) {
  return {
    companyId: context.companyId,
    locationId: context.locationId,
    groupId: String(draft.groupId || "").trim(),
    name: String(draft.name || "").trim(),
    price: Number(draft.price || 0),
    sortOrder: Number(draft.sortOrder || 0),
    active: draft.active !== false
  };
}

function normalizePortalEnrollment(id, data = {}, context = {}) {
  return {
    id,
    companyId: data.companyId || context.companyId || "",
    locationId: data.locationId || context.locationId || "",
    portalKey: data.portalKey || DELEFRAGT_PORTAL_KEY,
    status: data.status || "draft",
    publicName: data.publicName || "",
    cuisineTypes: normalizeList(data.cuisineTypes),
    deliveryModes: normalizeList(data.deliveryModes).length ? normalizeList(data.deliveryModes) : ["pickup"],
    orderingEnabled: Boolean(data.orderingEnabled),
    deliveryEnabled: Boolean(data.deliveryEnabled),
    menuPublished: Boolean(data.menuPublished),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}

function normalizePortalEnrollmentPayload(context, draft = {}) {
  return {
    companyId: context.companyId,
    locationId: context.locationId,
    portalKey: DELEFRAGT_PORTAL_KEY,
    status: String(draft.status || "draft"),
    publicName: String(draft.publicName || "").trim(),
    cuisineTypes: normalizeList(draft.cuisineTypes),
    deliveryModes: normalizeList(draft.deliveryModes).length ? normalizeList(draft.deliveryModes) : ["pickup"],
    orderingEnabled: normalizeBoolean(draft.orderingEnabled, false),
    deliveryEnabled: normalizeBoolean(draft.deliveryEnabled, false),
    menuPublished: normalizeBoolean(draft.menuPublished, false)
  };
}
