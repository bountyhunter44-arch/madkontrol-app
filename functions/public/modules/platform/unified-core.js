const STORAGE_KEY = "mk_unified_core_v1";

const contextFeatureMatrix = {
  plejehjem: {
    "commercial.seo": false,
    "commercial.tableBooking": false,
    "institutional.dysphagia": true,
    "institutional.patientData": true,
    "finance.scanning": true,
    "finance.vat": true,
    "finance.taxForecast": true,
    "lexiVoice.legalAdvisor": true
  },
  skole: {
    "commercial.seo": false,
    "commercial.tableBooking": false,
    "institutional.dysphagia": true,
    "institutional.patientData": true,
    "finance.scanning": true,
    "finance.vat": true,
    "finance.taxForecast": true,
    "lexiVoice.legalAdvisor": true
  },
  kantine: {
    "commercial.seo": false,
    "commercial.tableBooking": false,
    "institutional.dysphagia": false,
    "institutional.patientData": true,
    "finance.scanning": true,
    "finance.vat": true,
    "finance.taxForecast": true,
    "lexiVoice.legalAdvisor": true
  },
  pizzeria: {
    "commercial.seo": true,
    "commercial.tableBooking": true,
    "institutional.dysphagia": false,
    "institutional.patientData": false,
    "finance.scanning": true,
    "finance.vat": true,
    "finance.taxForecast": true,
    "lexiVoice.legalAdvisor": true
  },
  restaurant: {
    "commercial.seo": true,
    "commercial.tableBooking": true,
    "institutional.dysphagia": false,
    "institutional.patientData": false,
    "finance.scanning": true,
    "finance.vat": true,
    "finance.taxForecast": true,
    "lexiVoice.legalAdvisor": true
  }
};

const state = loadState();
const subscriptions = new Map();

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {}

  return {
    tenant: {
      companyId: "company_demo",
      name: "Madkontrollen Demo",
      segment: "hybrid",
      context: "restaurant"
    },
    featureFlags: { ...contextFeatureMatrix.restaurant },
    modules: {
      core: {
        temperatureLogs: [],
        cleaningTasks: [],
        goodsReceipts: []
      },
      institutional: {
        citizens: [],
        mealPlans: [],
        nutritionLedger: []
      },
      commercial: {
        tableBookings: [],
        menuItems: [
          {
            menuId: "menu_1",
            name: "Margherita",
            allergens: ["gluten", "laktose"]
          },
          {
            menuId: "menu_2",
            name: "Pepperoni",
            allergens: ["gluten", "laktose"]
          },
          {
            menuId: "menu_3",
            name: "Vegansk Bowl",
            allergens: ["soja", "sesam"]
          }
        ],
        seoPages: []
      },
      kalkulation: {
        recipes: [
          {
            recipeId: "recipe_margherita",
            name: "Margherita",
            salesPrice: 95,
            ingredients: [
              { sku: "tomat", name: "Tomat", qty: 0.2, unitCost: 26 },
              { sku: "mozzarella", name: "Mozzarella", qty: 0.12, unitCost: 55 },
              { sku: "dej", name: "Pizzadej", qty: 0.3, unitCost: 18 }
            ]
          }
        ],
        inventory: []
      },
      financeTax: {
        receipts: [],
        vatReports: [],
        taxEstimates: []
      },
      lexiVoice: {
        legalRequests: []
      }
    },
    events: []
  };
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function emit(type, payload) {
  const event = {
    eventId: uid("evt"),
    type,
    timestamp: nowIso(),
    tenantId: state.tenant.companyId,
    payload
  };
  state.events.unshift(event);
  persistState();

  const handlers = subscriptions.get(type) || [];
  handlers.forEach((handler) => handler(event));
  renderAll();
}

function on(type, handler) {
  const existing = subscriptions.get(type) || [];
  existing.push(handler);
  subscriptions.set(type, existing);
}

function computeRecipeCost(recipe) {
  return recipe.ingredients.reduce((sum, item) => sum + item.qty * item.unitCost, 0);
}

function computeMargin(recipe) {
  const cost = computeRecipeCost(recipe);
  const marginValue = recipe.salesPrice - cost;
  const marginPct = recipe.salesPrice > 0 ? (marginValue / recipe.salesPrice) * 100 : 0;
  return {
    cost,
    marginValue,
    marginPct
  };
}

function applyContext(context) {
  const flags = contextFeatureMatrix[context] || contextFeatureMatrix.restaurant;
  state.tenant.context = context;
  state.featureFlags = { ...flags };
  persistState();
  renderAll();
}

function quickLog(type, payload) {
  if (type === "temperature") {
    state.modules.core.temperatureLogs.unshift({
      id: uid("temp"),
      at: nowIso(),
      ...payload
    });
    persistState();
    renderAll();
    return;
  }

  if (type === "receipt") {
    emit("finance.purchase.logged", {
      supplier: payload.supplier,
      sku: payload.sku,
      ingredientName: payload.ingredientName,
      qty: payload.qty,
      unitCost: payload.unitCost,
      imageUrl: payload.imageUrl || ""
    });
  }
}

function addCitizenProfile(input) {
  const profile = {
    citizenId: uid("cit"),
    name: input.name,
    diet: input.diet,
    dysphagiaLevel: input.dysphagiaLevel,
    proteinTarget: Number(input.proteinTarget || 0),
    allergens: input.allergens
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
    intake: {
      protein: 0,
      calories: 0,
      meals: 0
    },
    createdAt: nowIso()
  };

  state.modules.institutional.citizens.unshift(profile);
  persistState();
  renderAll();
}

function addRecipe(input) {
  const recipe = {
    recipeId: uid("recipe"),
    name: input.name,
    salesPrice: Number(input.salesPrice || 0),
    ingredients: input.ingredients.map((row) => ({
      sku: row.sku,
      name: row.name,
      qty: Number(row.qty || 0),
      unitCost: Number(row.unitCost || 0)
    }))
  };

  state.modules.kalkulation.recipes.unshift(recipe);
  persistState();
  renderAll();
}

function registerEventFlows() {
  on("finance.purchase.logged", (event) => {
    const goodsReceipt = {
      receiptId: uid("gr"),
      at: event.timestamp,
      supplier: event.payload.supplier,
      sku: event.payload.sku,
      ingredientName: event.payload.ingredientName,
      qty: event.payload.qty,
      unitCost: event.payload.unitCost,
      source: "finance"
    };

    state.modules.core.goodsReceipts.unshift(goodsReceipt);
    state.modules.financeTax.receipts.unshift({
      id: uid("bill"),
      ...event.payload,
      timestamp: event.timestamp
    });

    state.modules.kalkulation.recipes = state.modules.kalkulation.recipes.map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.map((ingredient) => {
        if (ingredient.sku !== event.payload.sku) {
          return ingredient;
        }
        return {
          ...ingredient,
          unitCost: Number(event.payload.unitCost)
        };
      })
    }));

    persistState();

    emit("core.goods-receipt.created", {
      receiptId: goodsReceipt.receiptId,
      sku: goodsReceipt.sku,
      qty: goodsReceipt.qty
    });

    emit("kalkulation.margin.recalculated", {
      sku: event.payload.sku,
      affectedRecipes: state.modules.kalkulation.recipes
        .filter((recipe) => recipe.ingredients.some((ingredient) => ingredient.sku === event.payload.sku))
        .map((recipe) => recipe.recipeId)
    });
  });

  on("commercial.booking.received", (event) => {
    const allergens = (event.payload.guestAllergens || []).map((x) => x.toLowerCase());
    const menu = state.modules.commercial.menuItems.find((item) => item.menuId === event.payload.menuId);
    if (!menu) return;

    const risky = menu.allergens.filter((a) => allergens.includes(a));
    if (risky.length) {
      emit("commercial.booking.allergy-alert", {
        bookingId: event.payload.bookingId,
        menuId: menu.menuId,
        menuName: menu.name,
        allergens: risky
      });
    }
  });

  on("institution.meal.served", (event) => {
    const citizen = state.modules.institutional.citizens.find((entry) => entry.citizenId === event.payload.citizenId);
    if (!citizen) return;

    citizen.intake.protein += Number(event.payload.protein || 0);
    citizen.intake.calories += Number(event.payload.calories || 0);
    citizen.intake.meals += 1;

    state.modules.institutional.nutritionLedger.unshift({
      id: uid("intake"),
      citizenId: citizen.citizenId,
      at: event.timestamp,
      protein: Number(event.payload.protein || 0),
      calories: Number(event.payload.calories || 0)
    });

    persistState();

    emit("institution.intake.updated", {
      citizenId: citizen.citizenId,
      totalProtein: citizen.intake.protein,
      totalCalories: citizen.intake.calories,
      meals: citizen.intake.meals
    });
  });
}

function renderFeatureFlags() {
  const el = document.getElementById("featureFlags");
  const flags = Object.entries(state.featureFlags)
    .map(([key, enabled]) => `<div class="flag ${enabled ? "on" : "off"}"><span>${key}</span><strong>${enabled ? "ON" : "OFF"}</strong></div>`)
    .join("");
  el.innerHTML = flags;
}

function renderModuleVisibility() {
  const seo = state.featureFlags["commercial.seo"];
  const booking = state.featureFlags["commercial.tableBooking"];
  const dys = state.featureFlags["institutional.dysphagia"];
  const patient = state.featureFlags["institutional.patientData"];

  document.getElementById("commercialSection").classList.toggle("hidden", !seo && !booking);
  document.getElementById("institutionSection").classList.toggle("hidden", !dys && !patient);
}

function renderCitizenProfiles() {
  const list = document.getElementById("citizenList");
  list.innerHTML = state.modules.institutional.citizens
    .map((citizen) => `
      <article class="item-card">
        <h4>${citizen.name}</h4>
        <p>Kost: ${citizen.diet} · Dysfagi: ${citizen.dysphagiaLevel}</p>
        <p>Protein mål: ${citizen.proteinTarget}g · Allergener: ${citizen.allergens.join(", ") || "-"}</p>
        <p>Indtag i dag: ${citizen.intake.protein.toFixed(1)}g protein / ${citizen.intake.calories.toFixed(0)} kcal (${citizen.intake.meals} måltider)</p>
      </article>
    `)
    .join("");
}

function renderRecipes() {
  const list = document.getElementById("recipeList");
  list.innerHTML = state.modules.kalkulation.recipes
    .map((recipe) => {
      const margin = computeMargin(recipe);
      return `
        <article class="item-card">
          <h4>${recipe.name}</h4>
          <p>Salgspris: ${recipe.salesPrice.toFixed(2)} kr · Kostpris: ${margin.cost.toFixed(2)} kr</p>
          <p>Avance: ${margin.marginValue.toFixed(2)} kr (${margin.marginPct.toFixed(1)}%)</p>
          <p>Ingredienser: ${recipe.ingredients.map((x) => `${x.name} (${x.qty} * ${x.unitCost} kr)`).join(" · ")}</p>
        </article>
      `;
    })
    .join("");
}

function renderQuickLogs() {
  const temps = state.modules.core.temperatureLogs.slice(0, 4);
  const receipts = state.modules.core.goodsReceipts.slice(0, 4);

  document.getElementById("tempLogList").innerHTML = temps
    .map((entry) => `<li>${new Date(entry.at).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })} · ${entry.zone}: ${entry.temperature}°C</li>`)
    .join("");

  document.getElementById("goodsReceiptList").innerHTML = receipts
    .map((entry) => `<li>${entry.ingredientName} (${entry.qty}) fra ${entry.supplier} · ${entry.unitCost} kr</li>`)
    .join("");
}

function renderEvents() {
  document.getElementById("eventFeed").innerHTML = state.events
    .slice(0, 12)
    .map((event) => `<li><strong>${event.type}</strong> · ${new Date(event.timestamp).toLocaleString("da-DK")}</li>`)
    .join("");
}

function renderAll() {
  document.getElementById("activeContextLabel").textContent = state.tenant.context;
  renderFeatureFlags();
  renderModuleVisibility();
  renderCitizenProfiles();
  renderRecipes();
  renderQuickLogs();
  renderEvents();
}

function parseIngredientRows(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sku, name, qty, unitCost] = line.split(";").map((x) => x.trim());
      return { sku, name, qty: Number(qty || 0), unitCost: Number(unitCost || 0) };
    })
    .filter((entry) => entry.sku && entry.name);
}

function bindUi() {
  document.getElementById("contextSwitcher").addEventListener("change", (event) => {
    applyContext(event.target.value);
  });

  document.getElementById("quickTempForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    quickLog("temperature", {
      zone: String(form.get("zone") || "Køl"),
      temperature: Number(form.get("temperature") || 0)
    });
    event.currentTarget.reset();
  });

  document.getElementById("quickReceiptForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    quickLog("receipt", {
      supplier: String(form.get("supplier") || "Ukendt"),
      sku: String(form.get("sku") || ""),
      ingredientName: String(form.get("ingredientName") || "Ingrediens"),
      qty: Number(form.get("qty") || 0),
      unitCost: Number(form.get("unitCost") || 0),
      imageUrl: String(form.get("imageUrl") || "")
    });
    event.currentTarget.reset();
  });

  document.getElementById("citizenForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addCitizenProfile({
      name: String(form.get("name") || ""),
      diet: String(form.get("diet") || "Standard"),
      dysphagiaLevel: String(form.get("dysphagiaLevel") || "none"),
      proteinTarget: Number(form.get("proteinTarget") || 0),
      allergens: String(form.get("allergens") || "")
    });
    event.currentTarget.reset();
  });

  document.getElementById("recipeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    addRecipe({
      name: String(form.get("name") || ""),
      salesPrice: Number(form.get("salesPrice") || 0),
      ingredients: parseIngredientRows(String(form.get("ingredients") || ""))
    });
    event.currentTarget.reset();
  });

  document.getElementById("bookingTestForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    emit("commercial.booking.received", {
      bookingId: uid("booking"),
      menuId: String(form.get("menuId") || "menu_1"),
      guestAllergens: String(form.get("guestAllergens") || "")
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
    });
    event.currentTarget.reset();
  });

  document.getElementById("mealServedForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    emit("institution.meal.served", {
      citizenId: String(form.get("citizenId") || ""),
      protein: Number(form.get("protein") || 0),
      calories: Number(form.get("calories") || 0)
    });
    event.currentTarget.reset();
  });
}

registerEventFlows();
bindUi();
renderAll();
