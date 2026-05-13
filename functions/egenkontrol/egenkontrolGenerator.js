/**
 * Egenkontrol Generator for Firebase Cloud Functions (Node.js)
 * Production-ready generator following strict architecture
 */

const {
    MIKROBIOLOGISKE_FARER_CCP,
    MIKROBIOLOGISKE_FARER_GAG,
    KEMISKE_FARER,
    KEMISKE_FARER_GAG_FORTSAET,
    FYSISKE_FARER
} = require('./risikoanalyseData');

const {
    OFFICIELLE_ALLERGENER,
    ALLERGEN_HAANDTERING_TEKST,
    ALLERGEN_OPLYSNINGSPLIGT,
    getAllergenicProductsForBranch
} = require('./allergenData');

// === AI RULES ===
// Read functions/egenkontrol/operationalTemplateReference.js first
// Use it as source of truth
// Only generate operational templates
// Never use schema.titleKey or descriptionKey
// No GAG / CCP / compliance logic
// Always use guideKey
// =================

// Country Configurations
const COUNTRY_CONFIG = {
    DK: {
        country: "DK",
        routineSet: "dk_food_service_v1",
        temperatureLimits: {
            fridgeMax: 5,
            fridgeMin: 0,
            freezerMax: -18,
            heatingMin: 75,
            hotHoldingMin: 65,
            coolingMaxTime: 90,
            receivingColdMax: 5,
            receivingFrozenMax: -18
        },
        requiredProcedures: ["adskillelse", "personlig_hygiejne", "rengoering"],
        schemaTemplates: {
            varemodtagelse: {
                key: "varemodtagelse",
                title: "Varemodtagelse af køle- og frostvarer",
                description: "Kontroller temperatur, emballage og kvalitet ved modtagelse af køle- og frostvarer. Registrer temperatur og eventuelle afvigelser.",
                type: "receiving",
                enabled: true,
                isCCP: true,
                ccpNumber: 1,
                criticalLimits: { coldGoodsMax: 5, frozenGoodsMax: -18, packagingIntact: true, labelingCorrect: true },
                frequencyKey: "schema.varemodtagelse.frequency",
                controlPointKey: "schema.varemodtagelse.control_point",
                actionKey: "schema.varemodtagelse.corrective_action"
            },
            koel_frost: {
                key: "koel_frost",
                title: "Temperaturkontrol af køle- og frostudstyr",
                description: "Daglig temperaturkontrol af køleskabe og frysere. Temperaturen skal være max 5°C for køl og max -18°C for frost.",
                type: "temperature",
                enabled: true,
                isCCP: true,
                ccpNumber: 2,
                criticalLimits: { fridgeMin: 0, fridgeMax: 5, freezerMax: -18 },
                frequencyKey: "schema.koel_frost.frequency",
                controlPointKey: "schema.koel_frost.control_point",
                actionKey: "schema.koel_frost.corrective_action",
                requiresUnits: true,
                unitTypes: ["fridge", "freezer", "ice_machine"]
            },
            opvarmning: {
                key: "opvarmning",
                title: "Opvarmning og genopvarmning",
                description: "Kontroller at kernetemperaturen når minimum 75°C i mindst 2 minutter ved opvarmning og genopvarmning af fødevarer.",
                type: "heating",
                enabled: true,
                isCCP: true,
                ccpNumber: 3,
                criticalLimits: { coreTemperatureMin: 75, holdTimeMin: 2 },
                frequencyKey: "schema.opvarmning.frequency",
                controlPointKey: "schema.opvarmning.control_point",
                actionKey: "schema.opvarmning.corrective_action"
            },
            varmholdelse: {
                key: "varmholdelse",
                title: "Varmholdelse af tilberedte retter",
                description: "Varmholdte retter skal holdes ved minimum 65°C. Kontroller temperaturen regelmæssigt.",
                type: "hot_holding",
                enabled: true,
                isCCP: true,
                ccpNumber: 4,
                criticalLimits: { temperatureMin: 65, maxHoldingTime: 240 },
                frequencyKey: "schema.varmholdelse.frequency",
                controlPointKey: "schema.varmholdelse.control_point",
                actionKey: "schema.varmholdelse.corrective_action"
            },
            rengoering: {
                key: "rengoering",
                title: "Rengøring og hygiejne",
                description: "Daglig rengøring og hygiejnekontrol af arbejdsflader, udstyr og lokaler. Følg rengøringsplanen.",
                type: "cleaning",
                enabled: true,
                isCCP: false,
                isGAG: true,
                frequencyKey: "schema.rengoering.frequency",
                controlPointKey: "schema.rengoering.control_point",
                actionKey: "schema.rengoering.corrective_action"
            },
            adskillelse: {
                key: "adskillelse",
                title: "Adskillelse og krydskontaminering",
                description: "Kontroller adskillelse mellem råvarer og færdige produkter. Brug separate redskaber og skærebrætter.",
                type: "checklist",
                enabled: true,
                isCCP: false,
                isGAG: true,
                frequencyKey: "schema.adskillelse.frequency",
                controlPointKey: "schema.adskillelse.control_point",
                actionKey: "schema.adskillelse.corrective_action"
            },
            opvaskemaskine: {
                key: "opvaskemaskine",
                title: "Opvaskemaskine - kontrol og rengøring",
                description: "Kontroller opvaskemaskinens temperatur og rengøring. Skylletemperatur skal være minimum 82°C.",
                type: "checklist",
                enabled: true,
                isCCP: false,
                isGAG: true,
                frequencyKey: "schema.opvaskemaskine.frequency",
                controlPointKey: "schema.opvaskemaskine.control_point",
                actionKey: "schema.opvaskemaskine.corrective_action"
            },
            nedkoeling: {
                key: "nedkoeling",
                title: "Nedkøling af varmbehandlede fødevarer",
                description: "Nedkøl varmbehandlede fødevarer fra 65°C til 10°C på maksimalt 90 minutter. Registrer start- og sluttidspunkt samt temperaturer.",
                type: "cooling",
                enabled: true,
                isCCP: true,
                ccpNumber: 5,
                criticalLimits: { coolingMaxTime: 90, targetTemperature: 5 },
                frequencyKey: "schema.nedkoeling.frequency",
                controlPointKey: "schema.nedkoeling.control_point",
                actionKey: "schema.nedkoeling.corrective_action"
            }
        },
        procedureTemplates: {
            adskillelse: {
                key: "adskillelse",
                titleKey: "procedure.adskillelse.title",
                descriptionKey: "procedure.adskillelse.description",
                type: "separation",
                isGAG: true,
                criticalPoints: ["procedure.adskillelse.raw_cooked", "procedure.adskillelse.storage", "procedure.adskillelse.utensils"]
            },
            personlig_hygiejne: {
                key: "personlig_hygiejne",
                titleKey: "procedure.personlig_hygiejne.title",
                descriptionKey: "procedure.personlig_hygiejne.description",
                type: "hygiene",
                isGAG: true,
                criticalPoints: ["procedure.personlig_hygiejne.handwashing", "procedure.personlig_hygiejne.clothing", "procedure.personlig_hygiejne.illness"]
            },
            rengoering: {
                key: "rengoering",
                titleKey: "procedure.rengoering.title",
                descriptionKey: "procedure.rengoering.description",
                type: "cleaning",
                isGAG: true,
                criticalPoints: ["procedure.rengoering.daily", "procedure.rengoering.weekly", "procedure.rengoering.equipment"]
            }
        }
    },
    IT: {
        country: "IT",
        routineSet: "it_food_service_v1",
        temperatureLimits: {
            fridgeMax: 4,
            fridgeMin: 0,
            freezerMax: -18,
            heatingMin: 75,
            hotHoldingMin: 60,
            coolingMaxTime: 120,
            receivingColdMax: 4,
            receivingFrozenMax: -18
        },
        requiredProcedures: ["adskillelse", "personlig_hygiejne", "rengoering"],
        schemaTemplates: {
            varemodtagelse: {
                key: "varemodtagelse",
                title: "Varemodtagelse af køle- og frostvarer",
                description: "Kontroller temperatur, emballage og kvalitet ved modtagelse af køle- og frostvarer. Registrer temperatur og eventuelle afvigelser.",
                type: "receiving",
                enabled: true,
                isCCP: true,
                ccpNumber: 1,
                criticalLimits: { coldGoodsMax: 4, frozenGoodsMax: -18, packagingIntact: true, labelingCorrect: true },
                frequencyKey: "schema.varemodtagelse.frequency",
                controlPointKey: "schema.varemodtagelse.control_point",
                actionKey: "schema.varemodtagelse.corrective_action"
            },
            koel_frost: {
                key: "koel_frost",
                title: "Temperaturkontrol af køle- og frostudstyr",
                description: "Daglig temperaturkontrol af køleskabe og frysere. Temperaturen skal være max 5°C for køl og max -18°C for frost.",
                type: "temperature",
                enabled: true,
                isCCP: true,
                ccpNumber: 2,
                criticalLimits: { fridgeMin: 0, fridgeMax: 4, freezerMax: -18 },
                frequencyKey: "schema.koel_frost.frequency",
                controlPointKey: "schema.koel_frost.control_point",
                actionKey: "schema.koel_frost.corrective_action",
                requiresUnits: true,
                unitTypes: ["fridge", "freezer", "ice_machine"]
            },
            opvarmning: {
                key: "opvarmning",
                title: "Opvarmning og genopvarmning",
                description: "Kontroller at kernetemperaturen når minimum 75°C i mindst 2 minutter ved opvarmning og genopvarmning af fødevarer.",
                type: "heating",
                enabled: true,
                isCCP: true,
                ccpNumber: 3,
                criticalLimits: { coreTemperatureMin: 75, holdTimeMin: 2 },
                frequencyKey: "schema.opvarmning.frequency",
                controlPointKey: "schema.opvarmning.control_point",
                actionKey: "schema.opvarmning.corrective_action"
            },
            varmholdelse: {
                key: "varmholdelse",
                title: "Varmholdelse af tilberedte retter",
                description: "Varmholdte retter skal holdes ved minimum 65°C. Kontroller temperaturen regelmæssigt.",
                type: "hot_holding",
                enabled: true,
                isCCP: true,
                ccpNumber: 4,
                criticalLimits: { temperatureMin: 60, maxHoldingTime: 180 },
                frequencyKey: "schema.varmholdelse.frequency",
                controlPointKey: "schema.varmholdelse.control_point",
                actionKey: "schema.varmholdelse.corrective_action"
            },
            rengoering: {
                key: "rengoering",
                title: "Rengøring og hygiejne",
                description: "Daglig rengøring og hygiejnekontrol af arbejdsflader, udstyr og lokaler. Følg rengøringsplanen.",
                type: "cleaning",
                enabled: true,
                isCCP: false,
                isGAG: true,
                frequencyKey: "schema.rengoering.frequency",
                controlPointKey: "schema.rengoering.control_point",
                actionKey: "schema.rengoering.corrective_action"
            },
            nedkoeling: {
                key: "nedkoeling",
                title: "Nedkøling af varmbehandlede fødevarer",
                description: "Nedkøl varmbehandlede fødevarer fra 65°C til 10°C på maksimalt 90 minutter. Registrer start- og sluttidspunkt samt temperaturer.",
                type: "temperature",
                enabled: true,
                isCCP: true,
                ccpNumber: 5,
                criticalLimits: { startTempMin: 56, endTempMax: 10, maxTimeMinutes: 240 },
                frequencyKey: "schema.nedkoeling.frequency",
                controlPointKey: "schema.nedkoeling.control_point",
                actionKey: "schema.nedkoeling.corrective_action"
            },
            opvaskemaskine: {
                key: "opvaskemaskine",
                title: "Opvaskemaskine - kontrol og rengøring",
                description: "Kontroller opvaskemaskinens temperatur og rengøring. Skylletemperatur skal være minimum 82°C.",
                type: "temperature",
                enabled: true,
                isCCP: false,
                isGAG: true,
                criticalLimits: { rinseWaterMin: 80 },
                frequencyKey: "schema.opvaskemaskine.frequency",
                controlPointKey: "schema.opvaskemaskine.control_point",
                actionKey: "schema.opvaskemaskine.corrective_action"
            }
        },
        procedureTemplates: {
            adskillelse: {
                key: "adskillelse",
                titleKey: "procedure.adskillelse.title",
                descriptionKey: "procedure.adskillelse.description",
                type: "separation",
                isGAG: true,
                criticalPoints: ["procedure.adskillelse.raw_cooked", "procedure.adskillelse.storage", "procedure.adskillelse.utensils"]
            },
            personlig_hygiejne: {
                key: "personlig_hygiejne",
                titleKey: "procedure.personlig_hygiejne.title",
                descriptionKey: "procedure.personlig_hygiejne.description",
                type: "hygiene",
                isGAG: true,
                criticalPoints: ["procedure.personlig_hygiejne.handwashing", "procedure.personlig_hygiejne.clothing", "procedure.personlig_hygiejne.illness"]
            },
            rengoering: {
                key: "rengoering",
                titleKey: "procedure.rengoering.title",
                descriptionKey: "procedure.rengoering.description",
                type: "cleaning",
                isGAG: true,
                criticalPoints: ["procedure.rengoering.daily", "procedure.rengoering.weekly", "procedure.rengoering.equipment"]
            }
        }
    }
};

// Branch Configurations
const BRANCH_CONFIG = {
    pizzeria: {
        key: "pizzeria",
        nameKey: "branch.pizzeria.name",
        productExamples: ["branch.pizzeria.products.pizza_margherita", "branch.pizzeria.products.pizza_speciale", "branch.pizzeria.products.calzone", "branch.pizzeria.products.pasta", "branch.pizzeria.products.salads"],
        ingredientFocus: ["branch.pizzeria.ingredients.mozzarella", "branch.pizzeria.ingredients.tomato_sauce", "branch.pizzeria.ingredients.fresh_vegetables", "branch.pizzeria.ingredients.cured_meats", "branch.pizzeria.ingredients.dough"],
        specificRisks: {
            mozzarella_storage: { riskKey: "branch.pizzeria.risk.mozzarella_storage", severity: "high", controlMeasure: "schema.koel_frost" },
            dough_fermentation: { riskKey: "branch.pizzeria.risk.dough_fermentation", severity: "medium", controlMeasure: "procedure.temperature_control" },
            oven_temperature: { riskKey: "branch.pizzeria.risk.oven_temperature", severity: "high", controlMeasure: "schema.opvarmning" },
            cross_contamination: { riskKey: "branch.pizzeria.risk.cross_contamination", severity: "high", controlMeasure: "procedure.adskillelse" }
        },
        typicalHotDishes: ["branch.pizzeria.dishes.baked_pizza", "branch.pizzeria.dishes.pasta_dishes", "branch.pizzeria.dishes.lasagna"],
        schemaOverrides: {
            opvarmning: { additionalNoteKey: "branch.pizzeria.heating_note" },
            koel_frost: { additionalNoteKey: "branch.pizzeria.cheese_storage_note" }
        }
    },
    asiatisk_restaurant: {
        key: "asiatisk_restaurant",
        nameKey: "branch.asiatisk.name",
        productExamples: ["branch.asiatisk.products.fried_rice", "branch.asiatisk.products.noodles", "branch.asiatisk.products.spring_rolls", "branch.asiatisk.products.stir_fry", "branch.asiatisk.products.soup"],
        ingredientFocus: ["branch.asiatisk.ingredients.rice", "branch.asiatisk.ingredients.noodles", "branch.asiatisk.ingredients.soy_sauce", "branch.asiatisk.ingredients.fresh_vegetables", "branch.asiatisk.ingredients.meat_poultry"],
        specificRisks: {
            rice_cooling: { riskKey: "branch.asiatisk.risk.rice_cooling", severity: "high", controlMeasure: "schema.opvarmning" },
            wok_temperature: { riskKey: "branch.asiatisk.risk.wok_temperature", severity: "high", controlMeasure: "schema.opvarmning" },
            spring_roll_storage: { riskKey: "branch.asiatisk.risk.spring_roll_storage", severity: "medium", controlMeasure: "schema.koel_frost" },
            cross_contamination_raw: { riskKey: "branch.asiatisk.risk.cross_contamination", severity: "high", controlMeasure: "procedure.adskillelse" }
        },
        typicalHotDishes: ["branch.asiatisk.dishes.fried_rice", "branch.asiatisk.dishes.stir_fry", "branch.asiatisk.dishes.noodle_soup"],
        schemaOverrides: {
            opvarmning: { additionalNoteKey: "branch.asiatisk.rice_note" },
            varmholdelse: { additionalNoteKey: "branch.asiatisk.buffet_note" }
        }
    },
    cafe: {
        key: "cafe",
        nameKey: "branch.cafe.name",
        productExamples: ["branch.cafe.products.sandwiches", "branch.cafe.products.salads", "branch.cafe.products.pastries", "branch.cafe.products.coffee", "branch.cafe.products.smoothies"],
        ingredientFocus: ["branch.cafe.ingredients.fresh_bread", "branch.cafe.ingredients.dairy_products", "branch.cafe.ingredients.fresh_vegetables", "branch.cafe.ingredients.cold_cuts", "branch.cafe.ingredients.eggs"],
        specificRisks: {
            sandwich_storage: { riskKey: "branch.cafe.risk.sandwich_storage", severity: "high", controlMeasure: "schema.koel_frost" },
            milk_storage: { riskKey: "branch.cafe.risk.milk_storage", severity: "high", controlMeasure: "schema.koel_frost" },
            egg_handling: { riskKey: "branch.cafe.risk.egg_handling", severity: "medium", controlMeasure: "procedure.personlig_hygiejne" },
            display_temperature: { riskKey: "branch.cafe.risk.display_temperature", severity: "medium", controlMeasure: "schema.koel_frost" }
        },
        typicalHotDishes: ["branch.cafe.dishes.soup", "branch.cafe.dishes.quiche", "branch.cafe.dishes.panini"],
        schemaOverrides: {
            koel_frost: { additionalNoteKey: "branch.cafe.display_note" },
            varemodtagelse: { additionalNoteKey: "branch.cafe.dairy_note" }
        }
    },
    takeaway: {
        key: "takeaway",
        nameKey: "branch.takeaway.name",
        productExamples: ["branch.takeaway.products.hot_meals", "branch.takeaway.products.cold_sandwiches", "branch.takeaway.products.salads", "branch.takeaway.products.packaged_food", "branch.takeaway.products.beverages"],
        ingredientFocus: ["branch.takeaway.ingredients.precooked_meals", "branch.takeaway.ingredients.fresh_ingredients", "branch.takeaway.ingredients.packaging_materials", "branch.takeaway.ingredients.sauces", "branch.takeaway.ingredients.ready_to_eat"],
        specificRisks: {
            hot_holding_transport: { riskKey: "branch.takeaway.risk.hot_holding", severity: "high", controlMeasure: "schema.varmholdelse" },
            cold_chain_packaging: { riskKey: "branch.takeaway.risk.cold_chain", severity: "high", controlMeasure: "schema.koel_frost" },
            reheating_safety: { riskKey: "branch.takeaway.risk.reheating", severity: "high", controlMeasure: "schema.opvarmning" },
            packaging_contamination: { riskKey: "branch.takeaway.risk.packaging", severity: "medium", controlMeasure: "procedure.personlig_hygiejne" }
        },
        typicalHotDishes: ["branch.takeaway.dishes.hot_meals", "branch.takeaway.dishes.reheated_food", "branch.takeaway.dishes.grilled_items"],
        schemaOverrides: {
            varmholdelse: { additionalNoteKey: "branch.takeaway.holding_note" },
            varemodtagelse: { additionalNoteKey: "branch.takeaway.packaging_note" }
        }
    }
};

function normalizeCompanyType(companyType) {
    if (!companyType) return 'takeaway';
    const normalized = String(companyType).toLowerCase().trim();
    if (normalized.includes('pizza')) return 'pizzeria';
    if (normalized.includes('asiat') || normalized.includes('kines') || normalized.includes('thai')) return 'asiatisk_restaurant';
    if (normalized.includes('cafe') || normalized.includes('café')) return 'cafe';
    if (normalized.includes('takeaway') || normalized.includes('take away')) return 'takeaway';
    return 'takeaway';
}

function buildUnits(profile = {}) {
    const units = [];
    const antalKoeleskabe = parseInt(profile.antalKoeleskabe || profile.numberOfFridges || profile.fridgeCount || 0, 10);
    const antalFrysere = parseInt(profile.antalFrysere || profile.numberOfFreezers || profile.freezerCount || 0, 10);
    const antalIsterningemaskiner = parseInt(profile.antalIsterningemaskiner || profile.iceMachineCount || profile.numberOfIceMachines || 0, 10);
    
    for (let i = 1; i <= antalKoeleskabe; i++) {
        units.push({
            id: `fridge_${i}`,
            type: "fridge",
            nameKey: i === 1 ? "unit.fridge.primary" : `unit.fridge.number`,
            fallbackName: `Køleskab ${i}`,
            displayName: `Køleskab ${i}`,
            displayNumber: i,
            category: "cold_storage",
            measurementType: "temperature",
            limits: { min: 0, max: 5, unit: "celsius" },
            enabled: true,
            sortOrder: i
        });
    }
    
    for (let i = 1; i <= antalFrysere; i++) {
        units.push({
            id: `freezer_${i}`,
            type: "freezer",
            nameKey: i === 1 ? "unit.freezer.primary" : `unit.freezer.number`,
            fallbackName: `Fryser ${i}`,
            displayName: `Fryser ${i}`,
            displayNumber: i,
            category: "frozen_storage",
            measurementType: "temperature",
            limits: { min: null, max: -18, unit: "celsius" },
            enabled: true,
            sortOrder: antalKoeleskabe + i
        });
    }
    
    for (let i = 1; i <= antalIsterningemaskiner; i++) {
        units.push({
            id: `ice_machine_${i}`,
            type: "ice_machine",
            nameKey: "unit.ice_machine",
            fallbackName: `Isterningemaskine ${i}`,
            displayName: `Isterningemaskine ${i}`,
            displayNumber: i,
            category: "cold_storage",
            measurementType: "temperature",
            limits: { min: 0, max: 5, unit: "celsius" },
            enabled: true,
            sortOrder: antalKoeleskabe + antalFrysere + i
        });
    }
    
    if (profile.harDisplayKoeleskab || profile.hasDisplayFridge) {
        units.push({
            id: "display_fridge",
            type: "fridge",
            nameKey: "unit.fridge.display",
            fallbackName: "Displaykøleskab",
            displayName: "Displaykøleskab",
            category: "cold_storage",
            measurementType: "temperature",
            limits: { min: 0, max: 5, unit: "celsius" },
            enabled: true,
            sortOrder: 1000
        });
    }
    
    console.log(`[egenkontrol] buildUnits: total=${units.length}, fridges=${antalKoeleskabe}, freezers=${antalFrysere}, ice_machines=${antalIsterningemaskiner}`);
    return units;
}

function extractActivities(profile = {}) {
    const activities = {};
    activities.modtagerKoelevarer = !!(profile.modtagerKoelevarer || profile.receivesChilledGoods || profile.storesChilledGoods || profile.antalKoeleskabe > 0);
    activities.modtagerFrostvarer = !!(profile.modtagerFrostvarer || profile.receivesFrozenGoods || profile.storesFrozenGoods || profile.antalFrysere > 0);
    activities.tilberederVarmMad = !!(profile.tilberederVarmMad || profile.preparesHotFood || profile.madkoncept?.toLowerCase().includes('varm') || profile.foodConcept?.toLowerCase().includes('hot'));
    activities.nedkoelerMad = !!(profile.nedkoelerMad || profile.coolsHotFood || profile.tilberederVarmMad);
    activities.varmholder = !!(profile.varmholder || profile.holdsHotFood || profile.tilberederVarmMad);
    activities.servererKoldMad = !!(profile.servererKoldMad || profile.preparesColdFood || profile.servesColdFood || profile.madkoncept?.toLowerCase().includes('salat') || profile.madkoncept?.toLowerCase().includes('sandwich'));
    activities.takeaway = !!(profile.takeaway || profile.offersTakeaway || profile.companyType?.toLowerCase().includes('takeaway'));
    activities.buffet = !!(profile.buffet || profile.offersBuffet || profile.madkoncept?.toLowerCase().includes('buffet'));
    return activities;
}

function buildPersonalisering(profile = {}) {
    return {
        madkoncept: profile.madkoncept || profile.foodConcept || "",
        antalKoeleskabe: parseInt(profile.antalKoeleskabe || profile.numberOfFridges || 0, 10),
        antalFrysere: parseInt(profile.antalFrysere || profile.numberOfFreezers || 0, 10),
        aktiviteter: extractActivities(profile),
        specialeRetter: profile.specialeRetter || profile.specialtyDishes || "",
        hovedIngredienser: profile.hovedIngredienser || profile.mainIngredients || "",
        antalMedarbejdere: parseInt(profile.antalMedarbejdere || profile.numberOfEmployees || 0, 10),
        aarligOmsaetning: profile.aarligOmsaetning || profile.annualRevenue || ""
    };
}

function shouldEnableSchema(schemaKey, activities) {
    const rules = {
        varemodtagelse: () => activities.modtagerKoelevarer || activities.modtagerFrostvarer,
        koel_frost: () => activities.modtagerKoelevarer || activities.modtagerFrostvarer,
        opvarmning: () => activities.tilberederVarmMad,
        varmholdelse: () => activities.varmholder,
        rengoering: () => true,
        nedkoeling: () => activities.tilberederVarmMad,
        opvaskemaskine: () => true,
        adskillelse: () => true
    };
    const rule = rules[schemaKey];
    return rule ? rule() : true;
}

function generateKontrollerForSchema(schemaKey, units, personalisering, activities) {
    // Generate equipment-based kontroller
    const koeleskabe = units.filter(u => u.type === 'koeleskab')
        .map(u => `${u.fallbackName} (${u.limits.max > 0 ? '+' : ''}${u.limits.max})`);
    const frysere = units.filter(u => u.type === 'fryser')
        .map(u => `${u.fallbackName} (${u.limits.max})`);
    const alleColdUnits = [...koeleskabe, ...frysere].join(', ');
    
    const kontrollerMap = {
        // CCP kontroller
        varemodtagelse: 'Varemodtagelse',
        koel_frost: alleColdUnits || 'Køleskab (+5), Fryser (-18)',
        opvarmning: 'Varmbehandling af fødevarer, Genopvarmning af fødevarer',
        varmholdelse: 'Varmholdelse (+65)',
        nedkoeling: 'Nedkøling af fødevarer',
        opvaskemaskine: 'Skyllevand opvaskemaskine (+80)',
        raa_fisk: 'Varemodtagelse',
        
        // GAG kontroller - baseret på aktiviteter
        personlig_hygiejne: 'Personale med mavetarm-infektion skal være hjemme i 48 timer efter symptomerne er ophørt',
        krydskontaminering: 'Adskillelse af råvarer og færdige produkter, separate redskaber og arbejdsflader',
        rengoering: 'Skyllevand opvaskemaskine (+80)',
        display_fryser: 'Display fryser (-18), Starfryser (-18), Kummefryser (-18), Varemodtagelse',
        frugt_groent: '',
        opbevaring_bakterier: '',
        lufttaet_emballage: '',
        opbevaring_koeleskab: alleColdUnits || 'Køleskab (+5)',
        optoening: 'Optøning i køleskab ved maks 5 grader (fisk maks 2 grader)',
        vibrio: 'Opbevaring af fisk og skaldyr ved korrekt temperatur',
        
        // Kemiske farer
        stegning_pah: '',
        akrylamid: '',
        escolar: '',
        mykotoksiner: '',
        bitter_mandler: '',
        solanin: '',
        phenylhydrazin: '',
        squash: '',
        bønner: '',
        svampe: '',
        redskaber_udstyr: 'Adskillelse af råvarer og færdige produkter, separate redskaber',
        rengøring_desinfektionsmidler: 'Korrekt anvendelse og opbevaring af rengøringsmidler',
        fødevarekontaktmaterialer: '',
        allergener: 'Oplysning om allergener, krydskontaminering minimeres',
        tilsætningsstoffer: '',
        
        // Fysiske farer
        fysiske_materialer: '',
        fysiske_emballage: '',
        fremmedlegemer: '',
        sygdomsoverførsel: 'Skadedyrskontrol, sikring af døre og vinduer'
    };
    
    return kontrollerMap[schemaKey] || '';
}

function getRisikoanalyseDataForSchema(schemaKey) {
    const allData = {
        ...MIKROBIOLOGISKE_FARER_CCP,
        ...MIKROBIOLOGISKE_FARER_GAG,
        ...KEMISKE_FARER,
        ...KEMISKE_FARER_GAG_FORTSAET,
        ...FYSISKE_FARER
    };
    
    const keyMap = {
        varemodtagelse: 'ccp1_varemodtagelse_koelekraevende',
        koel_frost: 'ccp2_opbevaring_koel_frost',
        opvarmning: 'ccp3_opvarmning',
        varmholdelse: 'ccp4_varmholdelse',
        nedkoeling: 'ccp5_nedkoeling',
        rengoering: 'gag_rengøring_desinfektionsmidler'
    };
    
    const dataKey = keyMap[schemaKey];
    return dataKey ? allData[dataKey] : null;
}

function buildSkemaer(countryConfig, branchConfig, personalisering, units) {
    const skemaer = {};
    const activities = personalisering.aktiviteter || {};
    const schemaTemplates = countryConfig.schemaTemplates || {};
    const branchOverrides = branchConfig?.schemaOverrides || {};
    
    Object.keys(schemaTemplates).forEach(schemaKey => {
        const template = schemaTemplates[schemaKey];
        const override = branchOverrides[schemaKey] || {};
        const enabled = shouldEnableSchema(schemaKey, activities);
        const risikoData = getRisikoanalyseDataForSchema(schemaKey);
        
        const schema = {
            key: template.key,
            titleKey: template.titleKey,
            descriptionKey: template.descriptionKey,
            type: template.type,
            enabled: enabled,
            isCCP: template.isCCP || false,
            isGAG: template.isGAG || false,
            ccpNumber: template.ccpNumber || null,
            criticalLimits: { ...template.criticalLimits },
            frequencyKey: template.frequencyKey,
            controlPointKey: template.controlPointKey,
            actionKey: template.actionKey,
            kontroller: generateKontrollerForSchema(schemaKey, units, personalisering, activities)
        };
        
        if (risikoData) {
            schema.forklaring = risikoData.forklaring || '';
            schema.produkter = risikoData.produkter || '';
            schema.ingredienser = risikoData.ingredienser || '';
            if (risikoData.kontroller) {
                schema.kontroller = risikoData.kontroller;
            }
        }
        
        if (template.requiresUnits && template.unitTypes) {
            schema.units = units.filter(u => template.unitTypes.includes(u.type));
        }
        
        if (override.additionalNoteKey) {
            schema.additionalNoteKey = override.additionalNoteKey;
        }
        
        const legacyKey = `skema${template.ccpNumber || 5}_${schemaKey}`;
        skemaer[legacyKey] = schema;
    });
    
    return skemaer;
}

function buildProcedurer(countryConfig) {
    const procedurer = {};
    const procedureTemplates = countryConfig.procedureTemplates || {};
    
    Object.keys(procedureTemplates).forEach(procedureKey => {
        const template = procedureTemplates[procedureKey];
        procedurer[procedureKey] = {
            key: template.key,
            titleKey: template.titleKey,
            descriptionKey: template.descriptionKey,
            type: template.type,
            isGAG: template.isGAG || false,
            criticalPoints: [...(template.criticalPoints || [])],
            enabled: true
        };
    });
    
    return procedurer;
}

function buildEgenkontrolProgram(snapshot = {}) {
    const profile = snapshot.profile || {};
    const country = (profile.country || 'DK').toUpperCase();
    const countryConfig = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.DK;
    const companyType = normalizeCompanyType(profile.companyType);
    const branchConfig = BRANCH_CONFIG[companyType] || BRANCH_CONFIG.takeaway;
    const units = buildUnits(profile);
    const personalisering = buildPersonalisering(profile);
    const skemaer = buildSkemaer(countryConfig, branchConfig, personalisering, units);
    const procedurer = buildProcedurer(countryConfig);
    
    // Get allergenic products for this branch
    const allergenData = getAllergenicProductsForBranch(companyType);
    
    return {
        virksomhedsoplysninger: {
            navn: profile.companyName || profile.virksomhedsnavn || "",
            adresse: profile.address || profile.adresse || "",
            postnr: profile.postalCode || profile.postnr || "",
            by: profile.city || profile.by || "",
            cvr: profile.cvr || "",
            branche: companyType,
            country: country,
            language: profile.language || profile.defaultStaffLanguage || "da",
            produkter: allergenData.produktkategorier,
            produktEksempler: allergenData.eksempler,
            allergener: allergenData.allergener,
            allergenHaandtering: allergenData.allergenHaandtering,
            allergenOplysningspligt: allergenData.allergenOplysningspligt
        },
        personalisering: personalisering,
        skemaer: skemaer,
        procedurer: procedurer,
        brancheSpecifikkeRisici: branchConfig.specificRisks || {},
        regulatoryProfile: {
            country: country,
            routineSet: countryConfig.routineSet,
            schemaVersion: 1
        },
        units: units,
        metadata: {
            generatedAt: new Date().toISOString(),
            generatorVersion: "1.0.0",
            countryConfigVersion: countryConfig.routineSet,
            branchKey: branchConfig.key
        }
    };
}

async function generateAndSaveEgenkontrolProgram(db, companyId, locationId, snapshotId = null) {
    if (!db || !companyId || !locationId) {
        throw new Error('Missing required parameters: db, companyId, locationId');
    }
    
    // Try provided snapshotId first, then fallback to deterministic ID
    let snapshotDoc = null;
    
    if (snapshotId) {
        snapshotDoc = await db.collection('haccp_snapshots').doc(snapshotId).get();
    }
    
    if (!snapshotDoc || !snapshotDoc.exists) {
        const fallbackId = `${companyId}__${locationId}`;
        snapshotDoc = await db.collection('haccp_snapshots').doc(fallbackId).get();
    }
    
    if (!snapshotDoc || !snapshotDoc.exists) {
        console.log(`⚠️ HACCP snapshot not found for ${companyId}__${locationId}, skipping egenkontrol generation`);
        return null;
    }
    
    const snapshot = snapshotDoc.data();
    const program = buildEgenkontrolProgram(snapshot);
    const programId = `${companyId}__${locationId}`;
    const programRef = db.collection('egenkontrol_programs').doc(programId);
    const existingDoc = await programRef.get();
    const now = new Date().toISOString();
    
    const firestoreDoc = {
        ...program,
        companyId: companyId,
        locationId: locationId,
        updatedAt: now
    };
    
    if (!existingDoc.exists) {
        firestoreDoc.createdAt = now;
    }
    
    await programRef.set(firestoreDoc, { merge: true });
    console.log(`✅ Egenkontrol program saved: ${programId}`);
    
    return { programId, program };
}

module.exports = {
    buildEgenkontrolProgram,
    generateAndSaveEgenkontrolProgram
};
