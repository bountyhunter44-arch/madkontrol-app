function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function listToText(value) {
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

function money(value) {
  return Number(value || 0).toLocaleString("da-DK", {
    style: "currency",
    currency: "DKK"
  });
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function filterItems(state, options = {}) {
  const search = normalizeSearch(state.searchTerm);
  return (state.items || []).filter((item) => {
    const categoryMatch = !state.selectedCategoryId || item.categoryId === state.selectedCategoryId;
    const statusMatch = !state.selectedStatus ||
      (state.selectedStatus === "active" && item.active !== false) ||
      (state.selectedStatus === "inactive" && item.active === false);
    const orderingMatch = !options.orderingOnly || (item.active !== false && item.availableForOrdering !== false);
    const haystack = [
      item.name,
      item.description,
      ...(item.allergens || []),
      ...(item.tags || [])
    ].join(" ").toLowerCase();
    return categoryMatch && statusMatch && orderingMatch && (!search || haystack.includes(search));
  });
}

function getStats(state) {
  const categories = state.categories || [];
  const items = state.items || [];
  const activeItems = items.filter((item) => item.active !== false);
  const orderItems = activeItems.filter((item) => item.availableForOrdering !== false);
  const prices = items.map((item) => Number(item.price || 0)).filter((price) => price > 0);
  const avgPrice = prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
  return { categories, items, activeItems, orderItems, avgPrice };
}

function getCartTotal(cart = []) {
  return cart.reduce((sum, line) => sum + Number(line.subtotal || 0), 0);
}

function getGroupAddons(state, groupId) {
  return (state.addons || []).filter((addon) => addon.groupId === groupId);
}

function getItemAddonGroups(state, item) {
  const ids = Array.isArray(item?.addonGroupIds) ? item.addonGroupIds : [];
  return (state.addonGroups || []).filter((group) => ids.includes(group.id));
}

function renderAppTopbar(state) {
  const adminActive = state.mode !== "order" ? " active" : "";
  const orderActive = state.mode === "order" ? " active" : "";
  return `
    <nav class="module-topbar" aria-label="Menu navigation">
      <div>
        <strong>Menu & Retter</strong>
        <span>${escapeHtml(state.portalMode ? "DeleFragt visning" : "Standalone menu app")}</span>
      </div>
      <div class="module-tabs">
        <button class="module-tab${adminActive}" type="button" data-action="switch-mode" data-mode="admin">Admin</button>
        <button class="module-tab${orderActive}" type="button" data-action="switch-mode" data-mode="order">Bestilling</button>
      </div>
    </nav>
  `;
}

function renderCategoryButton(category, selectedCategoryId) {
  const active = category.id === selectedCategoryId ? " active" : "";
  return `
    <button class="menu-category${active}" type="button" data-action="select-category" data-category-id="${escapeAttribute(category.id)}">
      <span>${escapeHtml(category.name || "Kategori")}</span>
      ${category.active === false ? "<small>Inaktiv</small>" : ""}
    </button>
  `;
}

function renderCategoryList(state) {
  const categories = state.categories || [];
  if (!categories.length) {
    return `<p class="menu-muted">Ingen kategorier endnu. Opret den første kategori til menukortet.</p>`;
  }

  return categories.map((category) => `
    <article class="category-row ${category.active === false ? "inactive" : ""}">
      <button type="button" data-action="select-category" data-category-id="${escapeAttribute(category.id)}">
        <strong>${escapeHtml(category.name || "Kategori")}</strong>
        <span>${escapeHtml(category.description || "Ingen beskrivelse")}</span>
      </button>
      <button class="btn btn-secondary btn-small" type="button" data-action="edit-category" data-category-id="${escapeAttribute(category.id)}">Rediger</button>
    </article>
  `).join("");
}

function renderItemCard(item, state) {
  const category = (state.categories || []).find((entry) => entry.id === item.categoryId);
  const badges = [...(item.allergens || []), ...(item.tags || [])];
  const image = item.imageUrl
    ? `<img src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.name || "Ret")}" loading="lazy">`
    : `<span>${escapeHtml((item.name || "M").slice(0, 1).toUpperCase())}</span>`;
  const addonGroups = getItemAddonGroups(state, item);

  return `
    <article class="dish-card ${item.active === false ? "inactive" : ""}">
      <div class="dish-image">${image}</div>
      <div class="dish-body">
        <div class="dish-title-row">
          <div>
            <span class="dish-category">${escapeHtml(category?.name || "Uden kategori")}</span>
            <h3>${escapeHtml(item.name || "Ret")}</h3>
          </div>
          <strong class="dish-price">${money(item.price)}</strong>
        </div>
        <p>${escapeHtml(item.description || "Ingen beskrivelse endnu.")}</p>
        <div class="dish-tags">
          <span class="${item.active === false ? "badge badge-yellow" : "badge badge-green"}">${escapeHtml(item.active === false ? "Inaktiv" : "Aktiv")}</span>
          <span class="${item.availableForOrdering === false ? "badge badge-yellow" : "badge badge-green"}">${escapeHtml(item.availableForOrdering === false ? "Ikke til bestilling" : "Bestilling aktiv")}</span>
          ${addonGroups.map((group) => `<span class="tag">${escapeHtml(group.name)}</span>`).join("")}
          ${badges.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="dish-actions">
          <button class="btn btn-secondary btn-small" type="button" data-action="edit-item" data-item-id="${escapeAttribute(item.id)}">Rediger</button>
          <button class="btn btn-secondary btn-small" type="button" data-action="toggle-item" data-item-id="${escapeAttribute(item.id)}">${item.active === false ? "Aktiver" : "Deaktiver"}</button>
          <button class="btn btn-danger btn-small" type="button" data-action="delete-item" data-item-id="${escapeAttribute(item.id)}">Slet</button>
        </div>
      </div>
    </article>
  `;
}

function renderCategoryForm(state) {
  const draft = state.categoryDraft || {};
  return `
    <form id="categoryForm" class="menu-form">
      <input type="hidden" name="id" value="${escapeAttribute(draft.id || "")}">
      <label>
        <span>Kategorinavn</span>
        <input class="field" name="name" value="${escapeAttribute(draft.name || "")}" placeholder="Forretter, Pizza, Drikkevarer" required>
      </label>
      <label>
        <span>Beskrivelse</span>
        <textarea class="field" name="description" placeholder="Kort intern beskrivelse">${escapeHtml(draft.description || "")}</textarea>
      </label>
      <div class="menu-form-row">
        <label>
          <span>Sortering</span>
          <input class="field" name="sortOrder" type="number" value="${escapeAttribute(draft.sortOrder || 0)}">
        </label>
        <label>
          <span>Status</span>
          <select class="select" name="active">
            <option value="true"${draft.active !== false ? " selected" : ""}>Aktiv</option>
            <option value="false"${draft.active === false ? " selected" : ""}>Inaktiv</option>
          </select>
        </label>
      </div>
      <div class="menu-actions">
        <button class="btn btn-primary" type="submit">${draft.id ? "Gem kategori" : "Opret kategori"}</button>
        ${draft.id ? `<button class="btn btn-danger" id="deleteCategoryBtn" type="button">Slet kategori</button>` : ""}
      </div>
    </form>
  `;
}

function renderItemForm(state) {
  const draft = state.itemDraft || {};
  const selectedGroupIds = Array.isArray(draft.addonGroupIds) ? draft.addonGroupIds : [];
  return `
    <form id="menuItemForm" class="menu-form">
      <input type="hidden" name="id" value="${escapeAttribute(draft.id || "")}">
      <label>
        <span>Rettens navn</span>
        <input class="field" name="name" value="${escapeAttribute(draft.name || "")}" placeholder="Margherita, Pad Thai, Caesar salad" required>
      </label>
      <label>
        <span>Beskrivelse</span>
        <textarea class="field" name="description" placeholder="Kort salgsbeskrivelse">${escapeHtml(draft.description || "")}</textarea>
      </label>
      <label>
        <span>Billede URL</span>
        <input class="field" name="imageUrl" value="${escapeAttribute(draft.imageUrl || "")}" placeholder="https://...">
      </label>
      <div class="menu-form-row">
        <label>
          <span>Kategori</span>
          <select class="select" name="categoryId">
            <option value="">Uden kategori</option>
            ${(state.categories || []).map((category) => `
              <option value="${escapeAttribute(category.id)}"${category.id === draft.categoryId ? " selected" : ""}>${escapeHtml(category.name)}</option>
            `).join("")}
          </select>
        </label>
        <label>
          <span>Pris</span>
          <input class="field" name="price" type="number" min="0" step="0.01" value="${escapeAttribute(draft.price || "")}" placeholder="0.00">
        </label>
      </div>
      <div class="menu-form-row">
        <label>
          <span>Allergener</span>
          <input class="field" name="allergens" value="${escapeAttribute(listToText(draft.allergens))}" placeholder="gluten, mælk, nødder">
        </label>
        <label>
          <span>Tags</span>
          <input class="field" name="tags" value="${escapeAttribute(listToText(draft.tags))}" placeholder="vegetar, stærk, populær">
        </label>
      </div>
      <div class="checkbox-grid">
        <label class="checkbox-line">
          <input type="checkbox" name="availableForOrdering" value="true"${draft.availableForOrdering !== false ? " checked" : ""}>
          <span>Kan bestilles online</span>
        </label>
      </div>
      <div class="form-section">
        <strong>Knyt tilvalgsgrupper til retten</strong>
        <div class="checkbox-grid">
          ${(state.addonGroups || []).map((group) => `
            <label class="checkbox-line">
              <input type="checkbox" name="addonGroupIds" value="${escapeAttribute(group.id)}"${selectedGroupIds.includes(group.id) ? " checked" : ""}>
              <span>${escapeHtml(group.name)} ${group.active === false ? "(inaktiv)" : ""}</span>
            </label>
          `).join("") || `<p class="menu-muted">Opret tilvalgsgrupper under Add-ons først.</p>`}
        </div>
      </div>
      <label>
        <span>Status</span>
        <select class="select" name="active">
          <option value="true"${draft.active !== false ? " selected" : ""}>Aktiv</option>
          <option value="false"${draft.active === false ? " selected" : ""}>Inaktiv</option>
        </select>
      </label>
      <div class="menu-actions">
        <button class="btn btn-primary" type="submit">${draft.id ? "Gem ret" : "Opret ret"}</button>
      </div>
    </form>
  `;
}

function renderAddonGroupForm(state) {
  const draft = state.addonGroupDraft || {};
  return `
    <form id="addonGroupForm" class="menu-form">
      <input type="hidden" name="id" value="${escapeAttribute(draft.id || "")}">
      <label>
        <span>Gruppenavn</span>
        <input class="field" name="name" value="${escapeAttribute(draft.name || "")}" placeholder="Ekstra, Sauce, Tilbehør" required>
      </label>
      <div class="menu-form-row">
        <label>
          <span>Min. valg</span>
          <input class="field" name="minSelect" type="number" min="0" value="${escapeAttribute(draft.minSelect || 0)}">
        </label>
        <label>
          <span>Max. valg</span>
          <input class="field" name="maxSelect" type="number" min="1" value="${escapeAttribute(draft.maxSelect || 1)}">
        </label>
      </div>
      <div class="menu-form-row">
        <label>
          <span>Sortering</span>
          <input class="field" name="sortOrder" type="number" value="${escapeAttribute(draft.sortOrder || 0)}">
        </label>
        <label>
          <span>Status</span>
          <select class="select" name="active">
            <option value="true"${draft.active !== false ? " selected" : ""}>Aktiv</option>
            <option value="false"${draft.active === false ? " selected" : ""}>Inaktiv</option>
          </select>
        </label>
      </div>
      <label class="checkbox-line">
        <input type="checkbox" name="required" value="true"${draft.required ? " checked" : ""}>
        <span>Gruppen er obligatorisk</span>
      </label>
      <div class="menu-actions">
        <button class="btn btn-primary" type="submit">${draft.id ? "Gem gruppe" : "Opret gruppe"}</button>
      </div>
    </form>
  `;
}

function renderAddonForm(state) {
  const draft = state.addonDraft || {};
  return `
    <form id="addonForm" class="menu-form">
      <input type="hidden" name="id" value="${escapeAttribute(draft.id || "")}">
      <label>
        <span>Tilvalgsgruppe</span>
        <select class="select" name="groupId" required>
          <option value="">Vælg gruppe</option>
          ${(state.addonGroups || []).map((group) => `
            <option value="${escapeAttribute(group.id)}"${group.id === draft.groupId ? " selected" : ""}>${escapeHtml(group.name)}</option>
          `).join("")}
        </select>
      </label>
      <label>
        <span>Tilvalg</span>
        <input class="field" name="name" value="${escapeAttribute(draft.name || "")}" placeholder="Ekstra ost, glutenfri, stærk sauce" required>
      </label>
      <div class="menu-form-row">
        <label>
          <span>Pris</span>
          <input class="field" name="price" type="number" min="0" step="0.01" value="${escapeAttribute(draft.price || "")}">
        </label>
        <label>
          <span>Sortering</span>
          <input class="field" name="sortOrder" type="number" value="${escapeAttribute(draft.sortOrder || 0)}">
        </label>
      </div>
      <label>
        <span>Status</span>
        <select class="select" name="active">
          <option value="true"${draft.active !== false ? " selected" : ""}>Aktiv</option>
          <option value="false"${draft.active === false ? " selected" : ""}>Inaktiv</option>
        </select>
      </label>
      <div class="menu-actions">
        <button class="btn btn-primary" type="submit">${draft.id ? "Gem tilvalg" : "Opret tilvalg"}</button>
      </div>
    </form>
  `;
}

function renderAddonAdmin(state) {
  return `
    <section class="menu-layout">
      <div class="left-column">
        <section class="menu-card">
          <div class="card-header">
            <h2>Add-ons</h2>
            <span class="quick-pill">${(state.addonGroups || []).length} grupper</span>
          </div>
          <div class="addon-list">
            ${(state.addonGroups || []).map((group) => {
              const addons = getGroupAddons(state, group.id);
              return `
                <article class="addon-group-card ${group.active === false ? "inactive" : ""}">
                  <div class="addon-group-head">
                    <div>
                      <h3>${escapeHtml(group.name)}</h3>
                      <p>${group.required ? "Obligatorisk" : "Valgfri"} · ${group.minSelect}-${group.maxSelect} valg · ${addons.length} tilvalg</p>
                    </div>
                    <span class="${group.active === false ? "badge badge-yellow" : "badge badge-green"}">${group.active === false ? "Inaktiv" : "Aktiv"}</span>
                  </div>
                  <div class="addon-options">
                    ${addons.map((addon) => `
                      <div class="addon-row ${addon.active === false ? "inactive" : ""}">
                        <span>${escapeHtml(addon.name)}</span>
                        <strong>${money(addon.price)}</strong>
                        <button class="btn btn-secondary btn-small" type="button" data-action="edit-addon" data-addon-id="${escapeAttribute(addon.id)}">Rediger</button>
                        <button class="btn btn-secondary btn-small" type="button" data-action="toggle-addon" data-addon-id="${escapeAttribute(addon.id)}">${addon.active === false ? "Aktiver" : "Deaktiver"}</button>
                        <button class="btn btn-danger btn-small" type="button" data-action="delete-addon" data-addon-id="${escapeAttribute(addon.id)}">Slet</button>
                      </div>
                    `).join("") || `<p class="menu-muted">Ingen tilvalg i gruppen endnu.</p>`}
                  </div>
                  <div class="dish-actions">
                    <button class="btn btn-secondary btn-small" type="button" data-action="edit-addon-group" data-group-id="${escapeAttribute(group.id)}">Rediger gruppe</button>
                    <button class="btn btn-secondary btn-small" type="button" data-action="toggle-addon-group" data-group-id="${escapeAttribute(group.id)}">${group.active === false ? "Aktiver" : "Deaktiver"}</button>
                    <button class="btn btn-danger btn-small" type="button" data-action="delete-addon-group" data-group-id="${escapeAttribute(group.id)}">Slet gruppe</button>
                  </div>
                </article>
              `;
            }).join("") || `<article class="menu-empty-state compact"><h2>Ingen add-ons endnu</h2><p>Opret en gruppe og derefter tilvalg som ekstra ost, tilbehør eller drikkevarer.</p></article>`}
          </div>
        </section>
      </div>
      <aside class="menu-editor">
        <article class="menu-card">
          <h2>${state.addonGroupDraft?.id ? "Rediger tilvalgsgruppe" : "Ny tilvalgsgruppe"}</h2>
          ${renderAddonGroupForm(state)}
        </article>
        <article class="menu-card">
          <h2>${state.addonDraft?.id ? "Rediger tilvalg" : "Nyt tilvalg"}</h2>
          ${renderAddonForm(state)}
        </article>
      </aside>
    </section>
  `;
}

function renderPortalAdmin(state) {
  const enrollment = state.portalEnrollment || {};
  const activeOrderingItems = (state.items || []).filter((item) => item.active !== false && item.availableForOrdering !== false);
  const deliveryModes = Array.isArray(enrollment.deliveryModes) ? enrollment.deliveryModes : [];
  return `
    <section class="menu-layout">
      <div class="left-column">
        <section class="menu-card portal-card">
          <div class="card-header">
            <h2>Synlig på DeleFragt</h2>
            <span class="badge ${enrollment.status === "active" ? "badge-green" : "badge-yellow"}">${escapeHtml(enrollment.status || "draft")}</span>
          </div>
          <p class="menu-muted">Restauranten ejer menu og data. DeleFragt fungerer som distribution, discovery, bestilling og levering.</p>
          <div class="portal-publish-list">
            <div><strong>Restaurantnavn</strong><span>${escapeHtml(enrollment.publicName || "Udfyldes i formularen")}</span></div>
            <div><strong>Menu</strong><span>${activeOrderingItems.length} aktive retter klar til bestilling</span></div>
            <div><strong>Billeder</strong><span>${(state.items || []).filter((item) => item.imageUrl).length} retter med billede</span></div>
            <div><strong>Åbningstider</strong><span>Kommer fra senere portalprofil</span></div>
          </div>
          <div class="menu-alert notice">Portal public data er forberedt til portal_restaurants og portal_menu_items. I v1 er public sync stadig stub/admin-flow.</div>
        </section>
      </div>
      <aside class="menu-editor">
        <article class="menu-card">
          <h2>Portal enrollment</h2>
          <form id="portalEnrollmentForm" class="menu-form">
            <input type="hidden" name="id" value="${escapeAttribute(enrollment.id || "")}">
            <label>
              <span>Offentligt navn</span>
              <input class="field" name="publicName" value="${escapeAttribute(enrollment.publicName || "")}" placeholder="Restaurantens navn i portalen">
            </label>
            <label>
              <span>Status</span>
              <select class="select" name="status">
                ${["draft", "pending_review", "active", "paused"].map((status) => `<option value="${status}"${enrollment.status === status ? " selected" : ""}>${status}</option>`).join("")}
              </select>
            </label>
            <label>
              <span>Køkkentyper</span>
              <input class="field" name="cuisineTypes" value="${escapeAttribute(listToText(enrollment.cuisineTypes))}" placeholder="thai, pizza, cafe">
            </label>
            <div class="checkbox-grid">
              <label class="checkbox-line"><input type="checkbox" name="deliveryModes" value="pickup"${deliveryModes.includes("pickup") ? " checked" : ""}> <span>Pickup</span></label>
              <label class="checkbox-line"><input type="checkbox" name="deliveryModes" value="delivery"${deliveryModes.includes("delivery") ? " checked" : ""}> <span>Levering</span></label>
              <label class="checkbox-line"><input type="checkbox" name="orderingEnabled" value="true"${enrollment.orderingEnabled ? " checked" : ""}> <span>Bestilling aktiv</span></label>
              <label class="checkbox-line"><input type="checkbox" name="deliveryEnabled" value="true"${enrollment.deliveryEnabled ? " checked" : ""}> <span>Levering aktiv</span></label>
              <label class="checkbox-line"><input type="checkbox" name="menuPublished" value="true"${enrollment.menuPublished ? " checked" : ""}> <span>Menu publiceret til portal</span></label>
            </div>
            <div class="menu-actions">
              <button class="btn btn-primary" type="submit">Gem portalstatus</button>
            </div>
          </form>
        </article>
      </aside>
    </section>
  `;
}

function renderItemsAdmin(state, items, stats) {
  return `
    <section class="toolbar-card">
      <input class="field" id="menuSearchInput" value="${escapeAttribute(state.searchTerm || "")}" placeholder="Søg efter ret, beskrivelse, allergen eller tag">
      <select class="select" id="menuStatusFilter">
        <option value=""${!state.selectedStatus ? " selected" : ""}>Alle statusser</option>
        <option value="active"${state.selectedStatus === "active" ? " selected" : ""}>Aktive</option>
        <option value="inactive"${state.selectedStatus === "inactive" ? " selected" : ""}>Inaktive</option>
      </select>
      <button class="btn btn-secondary" type="button" data-action="select-category" data-category-id="">Vis alle</button>
    </section>

    <section class="menu-categories">
      <button class="menu-category${state.selectedCategoryId ? "" : " active"}" type="button" data-action="select-category" data-category-id="">Alle retter</button>
      ${(state.categories || []).map((category) => renderCategoryButton(category, state.selectedCategoryId)).join("")}
    </section>

    <section class="menu-layout">
      <div class="left-column">
        <section class="menu-card">
          <div class="card-header">
            <h2>Retter</h2>
            <span class="quick-pill">${items.length} vist</span>
          </div>
          <div class="dish-list">
            ${state.loading ? `<p class="menu-muted">Henter menukort...</p>` : items.map((item) => renderItemCard(item, state)).join("") || `
              <article class="menu-empty-state compact">
                <h2>Ingen retter matcher filteret</h2>
                <p>Opret en ny ret, eller vælg en anden kategori/status.</p>
              </article>
            `}
          </div>
        </section>

        <section class="menu-card">
          <div class="card-header">
            <h2>Kategorier</h2>
            <span class="quick-pill">${stats.categories.length} stk.</span>
          </div>
          <div class="category-list">
            ${renderCategoryList(state)}
          </div>
        </section>
      </div>

      <aside class="menu-editor">
        <article class="menu-card">
          <h2>${escapeHtml(state.itemDraft?.id ? "Rediger ret" : "Ny ret")}</h2>
          ${renderItemForm(state)}
        </article>
        <article class="menu-card">
          <h2>${escapeHtml(state.categoryDraft?.id ? "Rediger kategori" : "Ny kategori")}</h2>
          ${renderCategoryForm(state)}
        </article>
      </aside>
    </section>
  `;
}

function renderAdminMode(state) {
  const items = filterItems(state);
  const stats = getStats(state);
  const section = state.adminSection || "items";

  return `
    <section class="stats-grid">
      <article class="stat-card"><div class="stat-label">Kategorier</div><div class="stat-value">${stats.categories.length}</div><div class="stat-meta">Aktive og inaktive grupper</div></article>
      <article class="stat-card"><div class="stat-label">Retter</div><div class="stat-value">${stats.items.length}</div><div class="stat-meta">Gemmes pr. lokation</div></article>
      <article class="stat-card"><div class="stat-label">Tilvalgsgrupper</div><div class="stat-value">${(state.addonGroups || []).length}</div><div class="stat-meta">Ekstra, sauce, tilbehør</div></article>
      <article class="stat-card"><div class="stat-label">Portalstatus</div><div class="stat-value">${escapeHtml(state.portalEnrollment?.status || "draft")}</div><div class="stat-meta">DeleFragt enrollment</div></article>
    </section>

    <section class="admin-tabs">
      <button class="module-tab${section === "items" ? " active" : ""}" type="button" data-action="set-admin-section" data-section="items">Retter</button>
      <button class="module-tab${section === "addons" ? " active" : ""}" type="button" data-action="set-admin-section" data-section="addons">Add-ons</button>
      <button class="module-tab${section === "portal" ? " active" : ""}" type="button" data-action="set-admin-section" data-section="portal">DeleFragt</button>
    </section>

    ${section === "addons" ? renderAddonAdmin(state) : section === "portal" ? renderPortalAdmin(state) : renderItemsAdmin(state, items, stats)}
  `;
}

function renderOrderItem(item, state) {
  const addonGroups = getItemAddonGroups(state, item).filter((group) => group.active !== false);
  return `
    <article class="order-item">
      <div class="order-item-main">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description || "Ingen beskrivelse endnu.")}</p>
        <div class="dish-tags">
          ${addonGroups.length ? `<span class="tag">${addonGroups.length} tilvalgsgruppe${addonGroups.length === 1 ? "" : "r"}</span>` : ""}
          ${(item.allergens || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </div>
      <div class="order-item-side">
        <strong>${money(item.price)}</strong>
        <button class="btn btn-primary btn-small" type="button" data-action="open-order-item" data-item-id="${escapeAttribute(item.id)}">+</button>
      </div>
    </article>
  `;
}

function renderCart(state) {
  const cart = state.cart || [];
  return `
    <aside class="cart-card">
      <h2>Kurv</h2>
      <div class="cart-lines">
        ${cart.map((line) => `
          <article class="cart-line">
            <div>
              <strong>${line.quantity} x ${escapeHtml(line.itemName)}</strong>
              ${line.addons?.length ? `<span>${line.addons.map((addon) => escapeHtml(addon.name)).join(", ")}</span>` : ""}
              ${line.note ? `<small>${escapeHtml(line.note)}</small>` : ""}
            </div>
            <div>
              <strong>${money(line.subtotal)}</strong>
              <button class="cart-remove" type="button" data-action="remove-cart-line" data-line-id="${escapeAttribute(line.id)}">Fjern</button>
            </div>
          </article>
        `).join("") || `<p class="menu-muted">Kurven er tom.</p>`}
      </div>
      <div class="cart-total">
        <span>Total</span>
        <strong>${money(getCartTotal(cart))}</strong>
      </div>
      <button class="btn btn-primary" type="button" disabled>Fortsæt til bestilling senere</button>
    </aside>
  `;
}

function renderOrderDrawer(state) {
  if (!state.orderDrawerOpen) return "";
  const item = (state.items || []).find((entry) => entry.id === state.selectedOrderItemId);
  if (!item) return "";
  const groups = getItemAddonGroups(state, item).filter((group) => group.active !== false);

  return `
    <div class="drawer-backdrop">
      <section class="order-drawer" role="dialog" aria-modal="true" aria-label="Vælg tilvalg">
        <div class="card-header">
          <div>
            <h2>${escapeHtml(item.name)}</h2>
            <p class="menu-muted">${escapeHtml(item.description || "")}</p>
          </div>
          <button class="btn btn-secondary btn-small" type="button" data-action="close-order-drawer">Luk</button>
        </div>
        <form id="orderItemForm" class="menu-form">
          <input type="hidden" name="itemId" value="${escapeAttribute(item.id)}">
          ${groups.map((group) => {
            const addons = getGroupAddons(state, group.id).filter((addon) => addon.active !== false);
            return `
              <div class="form-section">
                <strong>${escapeHtml(group.name)}</strong>
                <p class="menu-muted">${group.required ? "Obligatorisk" : "Valgfri"} · vælg ${group.minSelect}-${group.maxSelect}</p>
                <div class="addon-choice-list">
                  ${addons.map((addon) => `
                    <label class="addon-choice">
                      <input type="checkbox" name="addonIds" value="${escapeAttribute(addon.id)}">
                      <span>${escapeHtml(addon.name)}</span>
                      <strong>${money(addon.price)}</strong>
                    </label>
                  `).join("") || `<p class="menu-muted">Ingen aktive tilvalg.</p>`}
                </div>
              </div>
            `;
          }).join("")}
          <div class="menu-form-row">
            <label>
              <span>Antal</span>
              <input class="field" type="number" min="1" name="quantity" value="1">
            </label>
            <label>
              <span>Note til køkkenet</span>
              <input class="field" name="note" placeholder="Fx uden løg">
            </label>
          </div>
          <button class="btn btn-primary" type="submit">Læg i kurv</button>
        </form>
      </section>
    </div>
  `;
}

function renderOrderMode(state) {
  const enrollment = state.portalEnrollment || {};
  const portalAllowed = !state.portalMode || (enrollment.status === "active" && enrollment.orderingEnabled === true);
  const items = portalAllowed ? filterItems(state, { orderingOnly: true }) : [];
  return `
    <section class="order-shell">
      <div class="order-list-card">
        <div class="card-header">
          <div>
            <h2>${state.portalMode ? "DeleFragt menu" : "Bestillingsmenu"}</h2>
            <p class="menu-muted">${state.portalMode ? "Viser kun aktive retter fra aktive portaltilmeldinger." : "Restaurantens egen bestillingsside. Ingen betaling endnu."}</p>
          </div>
          ${state.portalMode ? `<span class="badge ${portalAllowed ? "badge-green" : "badge-yellow"}">${portalAllowed ? "Portal aktiv" : "Ikke aktiv på portal"}</span>` : ""}
        </div>
        <section class="toolbar-card order-toolbar">
          <input class="field" id="menuSearchInput" value="${escapeAttribute(state.searchTerm || "")}" placeholder="Søg i menuen">
          <button class="btn btn-secondary" type="button" data-action="select-category" data-category-id="">Alle</button>
        </section>
        <section class="menu-categories">
          <button class="menu-category${state.selectedCategoryId ? "" : " active"}" type="button" data-action="select-category" data-category-id="">Alle</button>
          ${(state.categories || []).map((category) => renderCategoryButton(category, state.selectedCategoryId)).join("")}
        </section>
        <div class="order-list">
          ${items.map((item) => renderOrderItem(item, state)).join("") || `<article class="menu-empty-state compact"><h2>Ingen retter til bestilling</h2><p>Aktivér retter til online bestilling i admin.</p></article>`}
        </div>
      </div>
      ${renderCart(state)}
    </section>
    ${renderOrderDrawer(state)}
  `;
}

function renderDebug(state) {
  if (!state.debug) return "";
  return `
    <section class="menu-debug-grid">
      <article class="menu-card">
        <h2>Debug context</h2>
        <pre>${escapeHtml(JSON.stringify(state.context || {}, null, 2))}</pre>
      </article>
      <article class="menu-card">
        <h2>Debug events</h2>
        <pre>${escapeHtml(JSON.stringify(state.events || [], null, 2))}</pre>
      </article>
    </section>
  `;
}

export function renderMenuApp(root, state) {
  const hasContext = Boolean(state.context?.companyId && state.context?.locationId);

  root.innerHTML = `
    <div class="menu-page">
      ${renderAppTopbar(state)}
      <section class="hero-menu">
        <div>
          <span class="hero-kicker">${state.mode === "order" ? "Bestilling uden betaling endnu" : "Restaurantens menu-ejerskab"}</span>
          <h1>${state.mode === "order" ? "Bestil fra menuen" : "Menu & Retter"}</h1>
          <p>${state.mode === "order" ? "Vælg retter, add-ons, antal og note. Kurven er lokal i v1 og bliver senere til order draft." : "Administrer menu, add-ons og DeleFragt portaltilmelding fra én standalone Menu app."}</p>
          <div class="hero-actions">
            <button class="btn btn-primary" id="newItemBtn" type="button"${hasContext && state.mode !== "order" ? "" : " disabled"}>Ny ret</button>
            <button class="btn btn-secondary" id="newAddonGroupBtn" type="button"${hasContext && state.mode !== "order" ? "" : " disabled"}>Ny add-on gruppe</button>
          </div>
        </div>
      </section>

      ${!hasContext ? `
        <section class="menu-card menu-empty-state">
          <h2>Vælg virksomhed/lokation for at bruge Menu & Retter</h2>
          <p>Menu appen er standalone, men kræver platform context med companyId og locationId.</p>
        </section>
      ` : `
        ${state.error ? `<p class="menu-alert error">${escapeHtml(state.error)}</p>` : ""}
        ${state.notice ? `<p class="menu-alert notice">${escapeHtml(state.notice)}</p>` : ""}
        ${state.mode === "order" ? renderOrderMode(state) : renderAdminMode(state)}
      `}

      ${renderDebug(state)}
    </div>
  `;
}
