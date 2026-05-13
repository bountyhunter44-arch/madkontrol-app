/**
 * Cafe Branch Configuration
 * Defines cafe-specific customizations and risks
 */

export default {
    key: "cafe",
    nameKey: "branch.cafe.name",
    
    productExamples: [
        "branch.cafe.products.sandwiches",
        "branch.cafe.products.salads",
        "branch.cafe.products.pastries",
        "branch.cafe.products.coffee",
        "branch.cafe.products.smoothies"
    ],
    
    ingredientFocus: [
        "branch.cafe.ingredients.fresh_bread",
        "branch.cafe.ingredients.dairy_products",
        "branch.cafe.ingredients.fresh_vegetables",
        "branch.cafe.ingredients.cold_cuts",
        "branch.cafe.ingredients.eggs"
    ],
    
    specificRisks: {
        sandwich_storage: {
            riskKey: "branch.cafe.risk.sandwich_storage",
            severity: "high",
            controlMeasure: "schema.koel_frost"
        },
        milk_storage: {
            riskKey: "branch.cafe.risk.milk_storage",
            severity: "high",
            controlMeasure: "schema.koel_frost"
        },
        egg_handling: {
            riskKey: "branch.cafe.risk.egg_handling",
            severity: "medium",
            controlMeasure: "procedure.personlig_hygiejne"
        },
        display_temperature: {
            riskKey: "branch.cafe.risk.display_temperature",
            severity: "medium",
            controlMeasure: "schema.koel_frost"
        }
    },
    
    typicalHotDishes: [
        "branch.cafe.dishes.soup",
        "branch.cafe.dishes.quiche",
        "branch.cafe.dishes.panini"
    ],
    
    schemaOverrides: {
        koel_frost: {
            additionalNoteKey: "branch.cafe.display_note"
        },
        varemodtagelse: {
            additionalNoteKey: "branch.cafe.dairy_note"
        }
    }
};
