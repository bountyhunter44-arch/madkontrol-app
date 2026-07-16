(function () {
    "use strict";

    const STORAGE_KEY = "madkontrollen_drift_data_v1";

    const defaultData = {
        menus: [
            {
                id: "menu_restaurant_main",
                name: "Signatur menu",
                type: "restaurant",
                priceFrom: 129,
                averageCost: 46,
                margin: 83,
                reusableIngredients: 9,
                description:
                    "Husets hovedmenu til almindelige gæster med fokus på fortjeneste og hurtig produktion.",
                channels: ["restaurant", "seo"],
                dishes: [
                    {
                        id: "dish_bbq_burger",
                        name: "BBQ Burger",
                        description: "Oksekød, brioche, cheddar, tomat og hjemmelavet BBQ sauce.",
                        cost: 32,
                        sales: 95
                    },
                    {
                        id: "dish_loaded_fries",
                        name: "Loaded Fries",
                        description: "Kartofler, cheddarcreme, syltede løg og urter.",
                        cost: 14,
                        sales: 39
                    },
                    {
                        id: "dish_choko_mousse",
                        name: "Chokolademousse",
                        description: "Luftig mousse med bær og sprød topping.",
                        cost: 8,
                        sales: 35
                    }
                ]
            },
            {
                id: "menu_selskab_okse",
                name: "Selskabsmenu Okse",
                type: "selskab",
                priceFrom: 298,
                averageCost: 102,
                margin: 196,
                reusableIngredients: 12,
                description:
                    "Tre-retters selskabsmenu med oksekød som hovedsalgspunkt og råvarer der kan genbruges i andre koncepter.",
                channels: ["selskab", "seo"],
                dishes: [
                    {
                        id: "dish_tomatforret",
                        name: "Tomatforret",
                        description: "Friske tomater, urter, olie og sprøde chips.",
                        cost: 18,
                        sales: 79
                    },
                    {
                        id: "dish_oksecuvette",
                        name: "Oksecuvette med kartoffel",
                        description: "Langtidsstegt okse, kartoffel, sauce og sæsongrønt.",
                        cost: 61,
                        sales: 159
                    },
                    {
                        id: "dish_cheesecake_glas",
                        name: "Cheesecake glas",
                        description: "Cremet dessert med bær og crumble.",
                        cost: 23,
                        sales: 60
                    }
                ]
            },
            {
                id: "menu_takeaway_combo",
                name: "Takeaway Combo",
                type: "takeaway",
                priceFrom: 149,
                averageCost: 49,
                margin: 100,
                reusableIngredients: 8,
                description:
                    "Klikvenlig takeaway menu med retter der også fungerer godt på hjemmeside og som SEO-indhold.",
                channels: ["takeaway", "seo", "restaurant"],
                dishes: [
                    {
                        id: "dish_cheeseburger_menu",
                        name: "Cheeseburger Menu",
                        description: "Burger, fritter og dip til online bestilling.",
                        cost: 37,
                        sales: 109
                    },
                    {
                        id: "dish_vegetar_menu",
                        name: "Vegetar Burger Menu",
                        description: "Grøntsagsbøf, sprød salat og fritter.",
                        cost: 29,
                        sales: 99
                    },
                    {
                        id: "dish_family_addon",
                        name: "Family Add-on",
                        description: "Ekstra fritter, dip og dessert til deling.",
                        cost: 12,
                        sales: 40
                    }
                ]
            }
        ],

        recipes: [
            {
                id: "recipe_signatur_burger",
                name: "Signatur Burger",
                category: "Hovedret",
                status: "Aktiv",
                costPrice: 34.8,
                salePrice: 109,
                grossMargin: 68.1,
                portion: "1 stk.",
                ingredients: [
                    "Briochebolle",
                    "Oksekød",
                    "Cheddar",
                    "Tomat",
                    "Salat",
                    "Dressing"
                ],
                description:
                    "Klassisk premium burger med briochebolle, 180 g oksebøf, cheddar og signaturdressing."
            },
            {
                id: "recipe_caesar",
                name: "Cæsarsalat med kylling",
                category: "Frokost",
                status: "Aktiv",
                costPrice: 27.2,
                salePrice: 95,
                grossMargin: 71.4,
                portion: "1 skål",
                ingredients: ["Kylling", "Romaine", "Parmesan", "Croutoner", "Citron"],
                description:
                    "Sprød romainesalat med grillet kylling, croutoner, parmesan og hjemmelavet dressing."
            },
            {
                id: "recipe_truffle_fries",
                name: "Pommes frites trøffel-style",
                category: "Tilbehør",
                status: "Mangler priser",
                costPrice: 12.4,
                salePrice: 39,
                grossMargin: 68.2,
                portion: "180 g",
                ingredients: ["Pommes", "Trøffelolie", "Parmesan", "Persille", "Salt"],
                description:
                    "Sprøde pommes vendt med trøffelolie, fintrevet parmesan og urter."
            }
        ],

        ingredients: [
            {
                id: "ingredient_beef_patty",
                name: "Oksekød 180 g bøffer",
                sku: "KØD-1024",
                category: "Kød",
                supplier: "Danish Crown",
                unit: "kg",
                price: 89,
                stock: "24 kg",
                allergens: ["Ingen"],
                status: "Aktiv"
            },
            {
                id: "ingredient_brioche",
                name: "Briocheboller",
                sku: "BAG-2031",
                category: "Bageri",
                supplier: "Inco",
                unit: "stk",
                price: 4.2,
                stock: "86 stk",
                allergens: ["Gluten", "Æg"],
                status: "Aktiv"
            },
            {
                id: "ingredient_cheddar",
                name: "Cheddar skiver",
                sku: "MEJ-4410",
                category: "Mejeri",
                supplier: "Hørkram",
                unit: "pakke",
                price: 32,
                stock: "7 pakker",
                allergens: ["Mælk"],
                status: "Lav lager"
            }
        ],

        suppliers: [
            {
                id: "supplier_inco",
                name: "Inco",
                category: "Kolonial, frost, grønt og storkøkkenvarer",
                contactPerson: "Mette Sørensen",
                phone: "+45 70 12 34 56",
                email: "ordre@inco.dk",
                deliveryDays: "Mandag, onsdag og fredag",
                tags: ["Grønt", "Frost", "Tørvarer", "Engangsartikler"],
                status: "Aktiv",
                linkedIngredients: 63,
                openOrders: 5
            },
            {
                id: "supplier_horkram",
                name: "Hørkram",
                category: "Mejeri, kolonial og dessertvarer",
                contactPerson: "Lars Holm",
                phone: "+45 70 22 44 88",
                email: "bestilling@horkram.dk",
                deliveryDays: "Tirsdag og torsdag",
                tags: ["Mejeri", "Kolonial", "Dessert"],
                status: "Aktiv",
                linkedIngredients: 41,
                openOrders: 2
            },
            {
                id: "supplier_dc",
                name: "Danish Crown",
                category: "Oksekød, hakket kød og specialudskæringer",
                contactPerson: "Jesper Knudsen",
                phone: "+45 70 44 11 22",
                email: "foodservice@danishcrown.dk",
                deliveryDays: "Mandag til fredag",
                tags: ["Kød", "Premium", "Burger"],
                status: "Primær",
                linkedIngredients: 19,
                openOrders: 1
            }
        ],

        purchases: [
            {
                id: "PO-2026-0184",
                title: "Køkkenbasis til weekendservice",
                supplier: "Inco",
                date: "2026-03-14",
                delivery: "2026-03-15 07:00",
                lineCount: 18,
                amount: 4280,
                status: "Bestilt"
            },
            {
                id: "PO-2026-0183",
                title: "Mejeri og dessertvarer",
                supplier: "Hørkram",
                date: "2026-03-13",
                delivery: "2026-03-16 08:30",
                lineCount: 11,
                amount: 2960,
                status: "Afventer"
            },
            {
                id: "PO-2026-0182",
                title: "Kød til burger og selskab",
                supplier: "Danish Crown",
                date: "2026-03-13",
                delivery: "2026-03-14 06:15",
                lineCount: 7,
                amount: 5740,
                status: "Modtaget"
            }
        ],

        events: [
            {
                id: "event_nordtek",
                title: "Firmafrokost · Nordtek ApS",
                status: "Bekræftet",
                type: "Firmaevent",
                guests: 42,
                menu: "Buffet + dessert",
                time: "11:30 – 14:00",
                revenue: 8900,
                date: "2026-03-18"
            },
            {
                id: "event_bryllup_hl",
                title: "Bryllupsmiddag · Hansen & Lund",
                status: "I planlægning",
                type: "Bryllup",
                guests: 76,
                menu: "3 retter + natmad",
                time: "17:00 – 01:00",
                revenue: 34500,
                date: "2026-03-21"
            },
            {
                id: "event_bygpartner",
                title: "Catering · BygPartner kickoff",
                status: "Bekræftet",
                type: "Catering",
                guests: 28,
                menu: "Sandwich + salat",
                time: "10:45 levering",
                revenue: 5600,
                date: "2026-03-24"
            }
        ],

        suggestions: [
            {
                id: "suggestion_beef",
                title: "Sælg mere oksekød i morgen",
                text: "Du har både selskabsmenu og signaturmenu med okseretter. Brug samme råvarer og drej dialogen over på en menu med højere avance.",
                status: "active"
            },
            {
                id: "suggestion_seo",
                title: "Menuen kan bruges i SEO",
                text: "BBQ Burger, takeaway og selskabsmenu kan automatisk blive til sider som 'burger i Aarhus', 'takeaway Aarhus' og 'selskabsmenu Aarhus'.",
                status: "preview"
            },
            {
                id: "suggestion_reuse",
                title: "Genbrug råvarer i tre retter",
                text: "Tomat, kartoffel og oksekød går igen på tværs af menuerne. Det gør indkøb nemmere og reducerer spild.",
                status: "active"
            }
        ]
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function safeParse(json) {
        try {
            return JSON.parse(json);
        } catch (error) {
            console.warn("Kunne ikke læse drift-data. Bruger standarddata i stedet.", error);
            return null;
        }
    }

    function mergeStoredData(stored) {
        if (!stored || typeof stored !== "object") {
            return clone(defaultData);
        }

        return {
            menus: Array.isArray(stored.menus) ? stored.menus : clone(defaultData.menus),
            recipes: Array.isArray(stored.recipes) ? stored.recipes : clone(defaultData.recipes),
            ingredients: Array.isArray(stored.ingredients) ? stored.ingredients : clone(defaultData.ingredients),
            suppliers: Array.isArray(stored.suppliers) ? stored.suppliers : clone(defaultData.suppliers),
            purchases: Array.isArray(stored.purchases) ? stored.purchases : clone(defaultData.purchases),
            events: Array.isArray(stored.events) ? stored.events : clone(defaultData.events),
            suggestions: Array.isArray(stored.suggestions) ? stored.suggestions : clone(defaultData.suggestions)
        };
    }

    function read() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return clone(defaultData);
        }
        return mergeStoredData(safeParse(raw));
    }

    function write(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return clone(data);
    }

    function ensureInitialized() {
        if (!localStorage.getItem(STORAGE_KEY)) {
            write(defaultData);
        }
    }

    function makeId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function numberOrZero(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatCurrency(value) {
        return `${numberOrZero(value).toLocaleString("da-DK")},-`;
    }

    function formatPrice(value) {
        return `${numberOrZero(value).toLocaleString("da-DK", {
            minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2,
            maximumFractionDigits: 2
        })} kr.`;
    }

    function average(list, field) {
        if (!Array.isArray(list) || list.length === 0) return 0;
        return Math.round(
            list.reduce((sum, item) => sum + numberOrZero(item[field]), 0) / list.length
        );
    }

    function getState() {
        return read();
    }

    function setState(nextState) {
        return write(nextState);
    }

    function reset() {
        return write(defaultData);
    }

    function getMenus() {
        return read().menus;
    }

    function getRecipes() {
        return read().recipes;
    }

    function getIngredients() {
        return read().ingredients;
    }

    function getSuppliers() {
        return read().suppliers;
    }

    function getPurchases() {
        return read().purchases;
    }

    function getEvents() {
        return read().events;
    }

    function getSuggestions() {
        return read().suggestions;
    }

    function saveCollection(key, items) {
        const data = read();
        data[key] = Array.isArray(items) ? items : [];
        write(data);
        return clone(data[key]);
    }

    function addMenu(menu) {
        const data = read();
        const next = {
            id: menu.id || makeId("menu"),
            name: menu.name || "Ny menu",
            type: menu.type || "restaurant",
            priceFrom: numberOrZero(menu.priceFrom),
            averageCost: numberOrZero(menu.averageCost),
            margin: numberOrZero(menu.margin),
            reusableIngredients: numberOrZero(menu.reusableIngredients),
            description: menu.description || "",
            channels: Array.isArray(menu.channels) && menu.channels.length ? menu.channels : ["restaurant"],
            dishes: Array.isArray(menu.dishes) ? menu.dishes : []
        };

        data.menus.unshift(next);
        write(data);
        return clone(next);
    }

    function addRecipe(recipe) {
        const data = read();
        const next = {
            id: recipe.id || makeId("recipe"),
            name: recipe.name || "Ny opskrift",
            category: recipe.category || "Ukendt",
            status: recipe.status || "Aktiv",
            costPrice: numberOrZero(recipe.costPrice),
            salePrice: numberOrZero(recipe.salePrice),
            grossMargin: numberOrZero(recipe.grossMargin),
            portion: recipe.portion || "",
            ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
            description: recipe.description || ""
        };

        data.recipes.unshift(next);
        write(data);
        return clone(next);
    }

    function updateById(collectionName, id, updates) {
        const data = read();
        const collection = Array.isArray(data[collectionName]) ? data[collectionName] : [];
        const index = collection.findIndex((item) => item.id === id);

        if (index === -1) {
            return null;
        }

        collection[index] = {
            ...collection[index],
            ...updates
        };

        data[collectionName] = collection;
        write(data);
        return clone(collection[index]);
    }

    function removeById(collectionName, id) {
        const data = read();
        const collection = Array.isArray(data[collectionName]) ? data[collectionName] : [];
        const nextCollection = collection.filter((item) => item.id !== id);

        data[collectionName] = nextCollection;
        write(data);

        return nextCollection.length !== collection.length;
    }

    function getDashboardStats() {
        const data = read();

        return {
            menuCount: data.menus.length,
            recipeCount: data.recipes.length,
            ingredientCount: data.ingredients.length,
            supplierCount: data.suppliers.length,
            purchaseCount: data.purchases.length,
            eventCount: data.events.length,
            averageRecipeCost: average(data.recipes, "costPrice"),
            averageMenuCost: average(data.menus, "averageCost"),
            totalPurchaseAmount: data.purchases.reduce(
                (sum, item) => sum + numberOrZero(item.amount),
                0
            )
        };
    }

    function searchMenus(search = "", channel = "all") {
        const query = String(search).toLowerCase().trim();

        return getMenus().filter((menu) => {
            const channelMatch = channel === "all" || (menu.channels || []).includes(channel);
            const text = [
                menu.name,
                menu.description,
                ...(menu.dishes || []).map((dish) => `${dish.name} ${dish.description}`)
            ]
                .join(" ")
                .toLowerCase();

            const searchMatch = !query || text.includes(query);
            return channelMatch && searchMatch;
        });
    }

    function getLowStockIngredients() {
        return getIngredients().filter((item) =>
            String(item.status).toLowerCase().includes("lav lager")
        );
    }

    function getPendingPurchases() {
        return getPurchases().filter((item) => {
            const status = String(item.status).toLowerCase();
            return status === "afventer" || status === "bestilt" || status === "forsinket";
        });
    }

    function getUpcomingEvents() {
        return getEvents()
            .slice()
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    }

    ensureInitialized();

    window.DriftStore = {
        storageKey: STORAGE_KEY,

        getState,
        setState,
        reset,

        getMenus,
        getRecipes,
        getIngredients,
        getSuppliers,
        getPurchases,
        getEvents,
        getSuggestions,

        saveCollection,
        addMenu,
        addRecipe,
        updateById,
        removeById,

        getDashboardStats,
        searchMenus,
        getLowStockIngredients,
        getPendingPurchases,
        getUpcomingEvents,

        helpers: {
            clone,
            formatCurrency,
            formatPrice,
            numberOrZero,
            makeId
        }
    };
})();