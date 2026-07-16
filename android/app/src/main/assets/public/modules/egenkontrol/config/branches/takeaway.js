/**
 * Takeaway Branch Configuration
 * Defines takeaway-specific customizations and risks
 */

export default {
    key: "takeaway",
    nameKey: "branch.takeaway.name",
    
    productExamples: [
        "branch.takeaway.products.hot_meals",
        "branch.takeaway.products.cold_sandwiches",
        "branch.takeaway.products.salads",
        "branch.takeaway.products.packaged_food",
        "branch.takeaway.products.beverages"
    ],
    
    ingredientFocus: [
        "branch.takeaway.ingredients.precooked_meals",
        "branch.takeaway.ingredients.fresh_ingredients",
        "branch.takeaway.ingredients.packaging_materials",
        "branch.takeaway.ingredients.sauces",
        "branch.takeaway.ingredients.ready_to_eat"
    ],
    
    specificRisks: {
        hot_holding_transport: {
            riskKey: "branch.takeaway.risk.hot_holding",
            severity: "high",
            controlMeasure: "schema.varmholdelse"
        },
        cold_chain_packaging: {
            riskKey: "branch.takeaway.risk.cold_chain",
            severity: "high",
            controlMeasure: "schema.koel_frost"
        },
        reheating_safety: {
            riskKey: "branch.takeaway.risk.reheating",
            severity: "high",
            controlMeasure: "schema.opvarmning"
        },
        packaging_contamination: {
            riskKey: "branch.takeaway.risk.packaging",
            severity: "medium",
            controlMeasure: "procedure.personlig_hygiejne"
        }
    },
    
    typicalHotDishes: [
        "branch.takeaway.dishes.hot_meals",
        "branch.takeaway.dishes.reheated_food",
        "branch.takeaway.dishes.grilled_items"
    ],
    
    schemaOverrides: {
        varmholdelse: {
            additionalNoteKey: "branch.takeaway.holding_note"
        },
        varemodtagelse: {
            additionalNoteKey: "branch.takeaway.packaging_note"
        }
    }
};
