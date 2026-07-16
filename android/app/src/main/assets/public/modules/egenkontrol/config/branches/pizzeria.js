/**
 * Pizzeria Branch Configuration
 * Defines pizzeria-specific customizations and risks
 */

export default {
    key: "pizzeria",
    nameKey: "branch.pizzeria.name",
    
    productExamples: [
        "branch.pizzeria.products.pizza_margherita",
        "branch.pizzeria.products.pizza_speciale",
        "branch.pizzeria.products.calzone",
        "branch.pizzeria.products.pasta",
        "branch.pizzeria.products.salads"
    ],
    
    ingredientFocus: [
        "branch.pizzeria.ingredients.mozzarella",
        "branch.pizzeria.ingredients.tomato_sauce",
        "branch.pizzeria.ingredients.fresh_vegetables",
        "branch.pizzeria.ingredients.cured_meats",
        "branch.pizzeria.ingredients.dough"
    ],
    
    specificRisks: {
        mozzarella_storage: {
            riskKey: "branch.pizzeria.risk.mozzarella_storage",
            severity: "high",
            controlMeasure: "schema.koel_frost"
        },
        dough_fermentation: {
            riskKey: "branch.pizzeria.risk.dough_fermentation",
            severity: "medium",
            controlMeasure: "procedure.temperature_control"
        },
        oven_temperature: {
            riskKey: "branch.pizzeria.risk.oven_temperature",
            severity: "high",
            controlMeasure: "schema.opvarmning"
        },
        cross_contamination: {
            riskKey: "branch.pizzeria.risk.cross_contamination",
            severity: "high",
            controlMeasure: "procedure.adskillelse"
        }
    },
    
    typicalHotDishes: [
        "branch.pizzeria.dishes.baked_pizza",
        "branch.pizzeria.dishes.pasta_dishes",
        "branch.pizzeria.dishes.lasagna"
    ],
    
    schemaOverrides: {
        opvarmning: {
            additionalNoteKey: "branch.pizzeria.heating_note"
        },
        koel_frost: {
            additionalNoteKey: "branch.pizzeria.cheese_storage_note"
        }
    }
};
