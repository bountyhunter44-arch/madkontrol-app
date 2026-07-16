import { platformEmit, platformOn } from "../../../platform/event-bus.js";
import { renderMenuApp } from "./render.js";
import {
  createBlankCategory,
  createBlankAddon,
  createBlankAddonGroup,
  createBlankMenuItem,
  createBlankPortalEnrollment,
  deleteAddon,
  deleteAddonGroup,
  deleteMenuCategory,
  deleteMenuItem,
  listAddonGroups,
  listAddons,
  listMenuCategories,
  listMenuItems,
  loadPortalEnrollment,
  saveAddon,
  saveAddonGroup,
  saveMenuCategory,
  saveMenuItem,
  savePortalEnrollment,
  toggleAddonActive,
  toggleAddonGroupActive,
  toggleMenuItemActive
} from "./service.js";
import { addMenuEvent, menuAppState, setMenuState } from "./state.js";

export function mountMenuApp(root) {
  renderAndBind(root);
}

export function connectMenuEventListeners(root) {
  if (!menuAppState.debug) return () => {};
  const offReady = platformOn("app:ready", (payload) => {
    addMenuEvent("app:ready", payload);
    renderAndBind(root);
  });
  const offNavigate = platformOn("app:navigate", (payload) => {
    addMenuEvent("app:navigate", payload);
    renderAndBind(root);
  });
  return () => {
    offReady();
    offNavigate();
  };
}

export function updateMenuAppState(patch) {
  return setMenuState(patch);
}

export async function reloadMenuData(root) {
  const context = menuAppState.context;
  if (!context?.companyId || !context?.locationId) {
    renderAndBind(root);
    return;
  }

  try {
    setMenuState({ loading: true, error: "", notice: "" });
    renderAndBind(root);
    const [categories, items, addonGroups, addons, portalEnrollment] = await Promise.all([
      listMenuCategories(context),
      listMenuItems(context),
      listAddonGroups(context),
      listAddons(context),
      loadPortalEnrollment(context)
    ]);
    setMenuState({
      categories,
      items,
      addonGroups,
      addons,
      portalEnrollment,
      categoryDraft: menuAppState.categoryDraft || createBlankCategory(context),
      itemDraft: menuAppState.itemDraft || createBlankMenuItem(context, menuAppState.selectedCategoryId),
      addonGroupDraft: menuAppState.addonGroupDraft || createBlankAddonGroup(context),
      addonDraft: menuAppState.addonDraft || createBlankAddon(context),
      loading: false
    });
  } catch (error) {
    setMenuState({ error: String(error?.message || error), loading: false });
  }
  renderAndBind(root);
}

function renderAndBind(root) {
  renderMenuApp(root, menuAppState);
  bindMenuActions(root);
}

function bindMenuActions(root) {
  root.querySelectorAll("[data-action='switch-mode']").forEach((button) => {
    button.addEventListener("click", () => {
      setMenuState({ mode: button.getAttribute("data-mode") || "admin", orderDrawerOpen: false });
      renderAndBind(root);
    });
  });

  root.querySelectorAll("[data-action='set-admin-section']").forEach((button) => {
    button.addEventListener("click", () => {
      setMenuState({ adminSection: button.getAttribute("data-section") || "items" });
      renderAndBind(root);
    });
  });

  root.querySelector("#newCategoryBtn")?.addEventListener("click", () => {
    setMenuState({ categoryDraft: createBlankCategory(menuAppState.context || {}) });
    renderAndBind(root);
  });

  root.querySelector("#newItemBtn")?.addEventListener("click", () => {
    setMenuState({
      itemDraft: createBlankMenuItem(menuAppState.context || {}, menuAppState.selectedCategoryId)
    });
    renderAndBind(root);
  });

  root.querySelector("#newAddonGroupBtn")?.addEventListener("click", () => {
    setMenuState({ addonGroupDraft: createBlankAddonGroup(menuAppState.context || {}), adminSection: "addons" });
    renderAndBind(root);
  });

  root.querySelector("#newAddonBtn")?.addEventListener("click", () => {
    const groupId = menuAppState.addonGroupDraft?.id || menuAppState.addonGroups[0]?.id || "";
    setMenuState({ addonDraft: createBlankAddon(menuAppState.context || {}, groupId), adminSection: "addons" });
    renderAndBind(root);
  });

  root.querySelector("#menuSearchInput")?.addEventListener("input", (event) => {
    setMenuState({ searchTerm: event.currentTarget.value || "" });
    renderAndBind(root);
  });

  root.querySelector("#menuStatusFilter")?.addEventListener("change", (event) => {
    setMenuState({ selectedStatus: event.currentTarget.value || "" });
    renderAndBind(root);
  });

  root.querySelectorAll("[data-action='select-category']").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedCategoryId = button.getAttribute("data-category-id") || "";
      const categoryDraft = menuAppState.categories.find((entry) => entry.id === selectedCategoryId) ||
        createBlankCategory(menuAppState.context || {});
      setMenuState({
        selectedCategoryId,
        categoryDraft,
        itemDraft: createBlankMenuItem(menuAppState.context || {}, selectedCategoryId)
      });
      renderAndBind(root);
    });
  });

  root.querySelector("#categoryForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const draft = {
      id: String(form.get("id") || ""),
      name: String(form.get("name") || ""),
      description: String(form.get("description") || ""),
      sortOrder: Number(form.get("sortOrder") || 0),
      active: String(form.get("active") || "true") === "true"
    };
    await saveCategoryFromForm(root, draft);
  });

  root.querySelector("#deleteCategoryBtn")?.addEventListener("click", async () => {
    const categoryId = menuAppState.categoryDraft?.id || "";
    if (!categoryId) return;
    try {
      await deleteMenuCategory(menuAppState.context, categoryId);
      setMenuState({
        selectedCategoryId: menuAppState.selectedCategoryId === categoryId ? "" : menuAppState.selectedCategoryId,
        categoryDraft: createBlankCategory(menuAppState.context || {}),
        notice: "Kategori slettet"
      });
      emitMenuChanged("category_deleted", { categoryId });
      await reloadMenuData(root);
    } catch (error) {
      setMenuState({ error: String(error?.message || error) });
      renderAndBind(root);
    }
  });

  root.querySelector("#menuItemForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const draft = {
      id: String(form.get("id") || ""),
      categoryId: String(form.get("categoryId") || ""),
      name: String(form.get("name") || ""),
      description: String(form.get("description") || ""),
      price: Number(form.get("price") || 0),
      imageUrl: String(form.get("imageUrl") || ""),
      allergens: String(form.get("allergens") || ""),
      tags: String(form.get("tags") || ""),
      addonGroupIds: form.getAll("addonGroupIds").map(String),
      availableForOrdering: String(form.get("availableForOrdering") || "false") === "true",
      active: String(form.get("active") || "true") === "true"
    };
    await saveItemFromForm(root, draft);
  });

  root.querySelector("#addonGroupForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const draft = {
      id: String(form.get("id") || ""),
      name: String(form.get("name") || ""),
      required: String(form.get("required") || "false") === "true",
      minSelect: Number(form.get("minSelect") || 0),
      maxSelect: Number(form.get("maxSelect") || 1),
      sortOrder: Number(form.get("sortOrder") || 0),
      active: String(form.get("active") || "true") === "true"
    };
    await saveAddonGroupFromForm(root, draft);
  });

  root.querySelector("#addonForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const draft = {
      id: String(form.get("id") || ""),
      groupId: String(form.get("groupId") || ""),
      name: String(form.get("name") || ""),
      price: Number(form.get("price") || 0),
      sortOrder: Number(form.get("sortOrder") || 0),
      active: String(form.get("active") || "true") === "true"
    };
    await saveAddonFromForm(root, draft);
  });

  root.querySelector("#portalEnrollmentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const draft = {
      id: String(form.get("id") || ""),
      publicName: String(form.get("publicName") || ""),
      status: String(form.get("status") || "draft"),
      cuisineTypes: String(form.get("cuisineTypes") || ""),
      deliveryModes: form.getAll("deliveryModes").map(String),
      orderingEnabled: String(form.get("orderingEnabled") || "false") === "true",
      deliveryEnabled: String(form.get("deliveryEnabled") || "false") === "true",
      menuPublished: String(form.get("menuPublished") || "false") === "true"
    };
    await savePortalFromForm(root, draft);
  });

  root.querySelectorAll("[data-action='edit-item']").forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.getAttribute("data-item-id") || "";
      const item = menuAppState.items.find((entry) => entry.id === itemId);
      if (item) setMenuState({ itemDraft: item });
      renderAndBind(root);
    });
  });

  root.querySelectorAll("[data-action='edit-addon-group']").forEach((button) => {
    button.addEventListener("click", () => {
      const groupId = button.getAttribute("data-group-id") || "";
      const group = menuAppState.addonGroups.find((entry) => entry.id === groupId);
      if (group) setMenuState({ addonGroupDraft: group, addonDraft: createBlankAddon(menuAppState.context || {}, group.id), adminSection: "addons" });
      renderAndBind(root);
    });
  });

  root.querySelectorAll("[data-action='toggle-addon-group']").forEach((button) => {
    button.addEventListener("click", async () => {
      const groupId = button.getAttribute("data-group-id") || "";
      const group = menuAppState.addonGroups.find((entry) => entry.id === groupId);
      if (!group) return;
      try {
        const saved = await toggleAddonGroupActive(group);
        setMenuState({ notice: saved.active ? "Tilvalgsgruppe aktiveret" : "Tilvalgsgruppe deaktiveret" });
        emitMenuChanged("addon_group_toggled", { groupId, active: saved.active });
        await reloadMenuData(root);
      } catch (error) {
        setMenuState({ error: String(error?.message || error) });
        renderAndBind(root);
      }
    });
  });

  root.querySelectorAll("[data-action='delete-addon-group']").forEach((button) => {
    button.addEventListener("click", async () => {
      const groupId = button.getAttribute("data-group-id") || "";
      try {
        await deleteAddonGroup(menuAppState.context, groupId);
        setMenuState({ addonGroupDraft: createBlankAddonGroup(menuAppState.context || {}), notice: "Tilvalgsgruppe slettet" });
        emitMenuChanged("addon_group_deleted", { groupId });
        await reloadMenuData(root);
      } catch (error) {
        setMenuState({ error: String(error?.message || error) });
        renderAndBind(root);
      }
    });
  });

  root.querySelectorAll("[data-action='edit-addon']").forEach((button) => {
    button.addEventListener("click", () => {
      const addonId = button.getAttribute("data-addon-id") || "";
      const addon = menuAppState.addons.find((entry) => entry.id === addonId);
      if (addon) setMenuState({ addonDraft: addon, adminSection: "addons" });
      renderAndBind(root);
    });
  });

  root.querySelectorAll("[data-action='toggle-addon']").forEach((button) => {
    button.addEventListener("click", async () => {
      const addonId = button.getAttribute("data-addon-id") || "";
      const addon = menuAppState.addons.find((entry) => entry.id === addonId);
      if (!addon) return;
      try {
        const saved = await toggleAddonActive(addon);
        setMenuState({ notice: saved.active ? "Tilvalg aktiveret" : "Tilvalg deaktiveret" });
        emitMenuChanged("addon_toggled", { addonId, active: saved.active });
        await reloadMenuData(root);
      } catch (error) {
        setMenuState({ error: String(error?.message || error) });
        renderAndBind(root);
      }
    });
  });

  root.querySelectorAll("[data-action='delete-addon']").forEach((button) => {
    button.addEventListener("click", async () => {
      const addonId = button.getAttribute("data-addon-id") || "";
      try {
        await deleteAddon(addonId);
        setMenuState({ addonDraft: createBlankAddon(menuAppState.context || {}, menuAppState.addonGroupDraft?.id || ""), notice: "Tilvalg slettet" });
        emitMenuChanged("addon_deleted", { addonId });
        await reloadMenuData(root);
      } catch (error) {
        setMenuState({ error: String(error?.message || error) });
        renderAndBind(root);
      }
    });
  });

  root.querySelectorAll("[data-action='open-order-item']").forEach((button) => {
    button.addEventListener("click", () => {
      const itemId = button.getAttribute("data-item-id") || "";
      setMenuState({
        selectedOrderItemId: itemId,
        orderDrawerOpen: true,
        orderQuantity: 1,
        orderNote: "",
        orderAddonSelections: {}
      });
      renderAndBind(root);
    });
  });

  root.querySelectorAll("[data-action='close-order-drawer']").forEach((button) => {
    button.addEventListener("click", () => {
      setMenuState({ orderDrawerOpen: false, selectedOrderItemId: "" });
      renderAndBind(root);
    });
  });

  root.querySelector("#orderItemForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addCartLine(root, {
      itemId: String(form.get("itemId") || ""),
      quantity: Math.max(1, Number(form.get("quantity") || 1)),
      note: String(form.get("note") || ""),
      addonIds: form.getAll("addonIds").map(String)
    });
  });

  root.querySelectorAll("[data-action='remove-cart-line']").forEach((button) => {
    button.addEventListener("click", () => {
      const lineId = button.getAttribute("data-line-id") || "";
      setMenuState({ cart: menuAppState.cart.filter((line) => line.id !== lineId) });
      renderAndBind(root);
    });
  });

  root.querySelectorAll("[data-action='toggle-item']").forEach((button) => {
    button.addEventListener("click", async () => {
      const itemId = button.getAttribute("data-item-id") || "";
      const item = menuAppState.items.find((entry) => entry.id === itemId);
      if (!item) return;
      try {
        const saved = await toggleMenuItemActive(item);
        setMenuState({ notice: saved.active ? "Ret aktiveret" : "Ret deaktiveret" });
        emitMenuChanged("item_toggled", { menuItemId: itemId, active: saved.active });
        await reloadMenuData(root);
      } catch (error) {
        setMenuState({ error: String(error?.message || error) });
        renderAndBind(root);
      }
    });
  });

  root.querySelectorAll("[data-action='delete-item']").forEach((button) => {
    button.addEventListener("click", async () => {
      const itemId = button.getAttribute("data-item-id") || "";
      try {
        await deleteMenuItem(itemId);
        setMenuState({
          itemDraft: createBlankMenuItem(menuAppState.context || {}, menuAppState.selectedCategoryId),
          notice: "Ret slettet"
        });
        emitMenuChanged("item_deleted", { menuItemId: itemId });
        await reloadMenuData(root);
      } catch (error) {
        setMenuState({ error: String(error?.message || error) });
        renderAndBind(root);
      }
    });
  });

  root.querySelectorAll("[data-action='edit-category']").forEach((button) => {
    button.addEventListener("click", () => {
      const categoryId = button.getAttribute("data-category-id") || "";
      const category = menuAppState.categories.find((entry) => entry.id === categoryId);
      if (category) setMenuState({ categoryDraft: category });
      renderAndBind(root);
    });
  });
}

async function saveCategoryFromForm(root, draft) {
  try {
    const saved = await saveMenuCategory(menuAppState.context, draft);
    setMenuState({
      selectedCategoryId: saved.id,
      categoryDraft: saved,
      itemDraft: createBlankMenuItem(menuAppState.context || {}, saved.id),
      notice: "Kategori gemt",
      error: ""
    });
    emitMenuChanged(draft.id ? "category_updated" : "category_created", { categoryId: saved.id });
    await reloadMenuData(root);
  } catch (error) {
    setMenuState({ error: String(error?.message || error) });
    renderAndBind(root);
  }
}

async function saveItemFromForm(root, draft) {
  try {
    const saved = await saveMenuItem(menuAppState.context, draft);
    setMenuState({
      itemDraft: saved,
      selectedCategoryId: saved.categoryId || menuAppState.selectedCategoryId,
      notice: "Ret gemt",
      error: ""
    });
    emitMenuChanged(draft.id ? "item_updated" : "item_created", { menuItemId: saved.id });
    await reloadMenuData(root);
  } catch (error) {
    setMenuState({ error: String(error?.message || error) });
    renderAndBind(root);
  }
}

async function saveAddonGroupFromForm(root, draft) {
  try {
    const saved = await saveAddonGroup(menuAppState.context, draft);
    setMenuState({
      addonGroupDraft: saved,
      addonDraft: createBlankAddon(menuAppState.context || {}, saved.id),
      adminSection: "addons",
      notice: "Tilvalgsgruppe gemt",
      error: ""
    });
    emitMenuChanged(draft.id ? "addon_group_updated" : "addon_group_created", { groupId: saved.id });
    await reloadMenuData(root);
  } catch (error) {
    setMenuState({ error: String(error?.message || error) });
    renderAndBind(root);
  }
}

async function saveAddonFromForm(root, draft) {
  try {
    const saved = await saveAddon(menuAppState.context, draft);
    setMenuState({
      addonDraft: saved,
      adminSection: "addons",
      notice: "Tilvalg gemt",
      error: ""
    });
    emitMenuChanged(draft.id ? "addon_updated" : "addon_created", { addonId: saved.id });
    await reloadMenuData(root);
  } catch (error) {
    setMenuState({ error: String(error?.message || error) });
    renderAndBind(root);
  }
}

async function savePortalFromForm(root, draft) {
  try {
    const saved = await savePortalEnrollment(menuAppState.context, draft);
    setMenuState({
      portalEnrollment: saved,
      adminSection: "portal",
      notice: saved.status === "pending_review" ? "Tilmelding sendt til review" : "Portalstatus gemt",
      error: ""
    });
    emitMenuChanged("portal_enrollment_updated", { portalKey: saved.portalKey, status: saved.status });
    await reloadMenuData(root);
  } catch (error) {
    setMenuState({ error: String(error?.message || error) });
    renderAndBind(root);
  }
}

function addCartLine(root, draft) {
  const item = menuAppState.items.find((entry) => entry.id === draft.itemId);
  if (!item) return;
  const addons = menuAppState.addons.filter((addon) => draft.addonIds.includes(addon.id));
  const lineSubtotal = (Number(item.price || 0) + addons.reduce((sum, addon) => sum + Number(addon.price || 0), 0)) * draft.quantity;
  const line = {
    id: `${draft.itemId}-${Date.now()}`,
    itemId: draft.itemId,
    itemName: item.name,
    quantity: draft.quantity,
    note: draft.note,
    addons: addons.map((addon) => ({ id: addon.id, name: addon.name, price: Number(addon.price || 0) })),
    subtotal: lineSubtotal
  };
  setMenuState({
    cart: [...menuAppState.cart, line],
    orderDrawerOpen: false,
    selectedOrderItemId: "",
    notice: "Lagt i kurv"
  });
  emitMenuChanged("cart_line_added", { menuItemId: draft.itemId });
  renderAndBind(root);
}

function emitMenuChanged(changeType, payload = {}) {
  const eventPayload = {
    sourceApp: "menu",
    changeType,
    companyId: menuAppState.context?.companyId || "",
    locationId: menuAppState.context?.locationId || "",
    ...payload
  };
  addMenuEvent("menu:item:changed", eventPayload);
  platformEmit("menu:item:changed", eventPayload);
}
