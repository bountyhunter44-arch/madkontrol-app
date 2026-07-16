export const menuAppState = {
  appKey: "menu",
  appConfig: null,
  context: null,
  access: null,
  debug: false,
  relatedApps: [],
  categories: [],
  items: [],
  addonGroups: [],
  addons: [],
  portalEnrollment: null,
  cart: [],
  selectedOrderItemId: "",
  orderDrawerOpen: false,
  orderQuantity: 1,
  orderNote: "",
  orderAddonSelections: {},
  mode: "admin",
  portalMode: false,
  selectedCategoryId: "",
  selectedStatus: "",
  categoryDraft: null,
  itemDraft: null,
  addonGroupDraft: null,
  addonDraft: null,
  adminSection: "items",
  searchTerm: "",
  loading: false,
  saving: false,
  error: "",
  notice: "",
  events: []
};

export function setMenuState(patch = {}) {
  Object.assign(menuAppState, patch);
  return menuAppState;
}

export function addMenuEvent(eventName, payload = {}) {
  menuAppState.events = [
    {
      eventName,
      payload,
      at: new Date().toISOString()
    },
    ...menuAppState.events
  ].slice(0, 8);
  return menuAppState.events;
}
