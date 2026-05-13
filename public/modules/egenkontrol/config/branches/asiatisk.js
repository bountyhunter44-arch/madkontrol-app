/**
 * Asian Restaurant Branch Configuration
 * Defines Asian restaurant-specific customizations and risks
 */

export default {
    key: "asiatisk_restaurant",
    nameKey: "branch.asiatisk.name",
    
    productExamples: [
        "branch.asiatisk.products.fried_rice",
        "branch.asiatisk.products.noodles",
        "branch.asiatisk.products.spring_rolls",
        "branch.asiatisk.products.stir_fry",
        "branch.asiatisk.products.soup"
    ],
    
    ingredientFocus: [
        "branch.asiatisk.ingredients.rice",
        "branch.asiatisk.ingredients.noodles",
        "branch.asiatisk.ingredients.soy_sauce",
        "branch.asiatisk.ingredients.fresh_vegetables",
        "branch.asiatisk.ingredients.meat_poultry"
    ],
    
    specificRisks: {
        rice_cooling: {
            riskKey: "branch.asiatisk.risk.rice_cooling",
            severity: "high",
            controlMeasure: "schema.opvarmning"
        },
        wok_temperature: {
            riskKey: "branch.asiatisk.risk.wok_temperature",
            severity: "high",
            controlMeasure: "schema.opvarmning"
        },
        spring_roll_storage: {
            riskKey: "branch.asiatisk.risk.spring_roll_storage",
            severity: "medium",
            controlMeasure: "schema.koel_frost"
        },
        cross_contamination_raw: {
            riskKey: "branch.asiatisk.risk.cross_contamination",
            severity: "high",
            controlMeasure: "procedure.adskillelse"
        }
    },
    
    typicalHotDishes: [
        "branch.asiatisk.dishes.fried_rice",
        "branch.asiatisk.dishes.stir_fry",
        "branch.asiatisk.dishes.noodle_soup"
    ],
    
    schemaOverrides: {
        opvarmning: {
            additionalNoteKey: "branch.asiatisk.rice_note"
        },
        varmholdelse: {
            additionalNoteKey: "branch.asiatisk.buffet_note"
        }
    }
};
