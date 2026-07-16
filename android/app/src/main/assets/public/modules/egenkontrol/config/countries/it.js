/**
 * Italy Country Configuration
 * Defines Italian food safety requirements and routine templates
 */

export default {
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
    
    requiredProcedures: [
        "adskillelse",
        "personlig_hygiejne",
        "rengoering"
    ],
    
    schemaTemplates: {
        varemodtagelse: {
            key: "varemodtagelse",
            titleKey: "schema.varemodtagelse.title",
            descriptionKey: "schema.varemodtagelse.description",
            type: "receiving",
            enabled: true,
            isCCP: true,
            ccpNumber: 1,
            criticalLimits: {
                coldGoodsMax: 4,
                frozenGoodsMax: -18,
                packagingIntact: true,
                labelingCorrect: true
            },
            frequencyKey: "schema.varemodtagelse.frequency",
            controlPointKey: "schema.varemodtagelse.control_point",
            actionKey: "schema.varemodtagelse.corrective_action"
        },
        
        koel_frost: {
            key: "koel_frost",
            titleKey: "schema.koel_frost.title",
            descriptionKey: "schema.koel_frost.description",
            type: "temperature",
            enabled: true,
            isCCP: true,
            ccpNumber: 2,
            criticalLimits: {
                fridgeMin: 0,
                fridgeMax: 4,
                freezerMax: -18
            },
            frequencyKey: "schema.koel_frost.frequency",
            controlPointKey: "schema.koel_frost.control_point",
            actionKey: "schema.koel_frost.corrective_action",
            requiresUnits: true,
            unitTypes: ["koeleskab", "fryser"]
        },
        
        opvarmning: {
            key: "opvarmning",
            titleKey: "schema.opvarmning.title",
            descriptionKey: "schema.opvarmning.description",
            type: "heating",
            enabled: true,
            isCCP: true,
            ccpNumber: 3,
            criticalLimits: {
                coreTemperatureMin: 75,
                holdTimeMin: 2
            },
            frequencyKey: "schema.opvarmning.frequency",
            controlPointKey: "schema.opvarmning.control_point",
            actionKey: "schema.opvarmning.corrective_action"
        },
        
        varmholdelse: {
            key: "varmholdelse",
            titleKey: "schema.varmholdelse.title",
            descriptionKey: "schema.varmholdelse.description",
            type: "hot_holding",
            enabled: true,
            isCCP: true,
            ccpNumber: 4,
            criticalLimits: {
                temperatureMin: 60,
                maxHoldingTime: 180
            },
            frequencyKey: "schema.varmholdelse.frequency",
            controlPointKey: "schema.varmholdelse.control_point",
            actionKey: "schema.varmholdelse.corrective_action"
        },
        
        rengoering: {
            key: "rengoering",
            titleKey: "schema.rengoering.title",
            descriptionKey: "schema.rengoering.description",
            type: "cleaning",
            enabled: true,
            isCCP: false,
            isGAG: true,
            frequencyKey: "schema.rengoering.frequency",
            controlPointKey: "schema.rengoering.control_point",
            actionKey: "schema.rengoering.corrective_action"
        }
    },
    
    procedureTemplates: {
        adskillelse: {
            key: "adskillelse",
            titleKey: "procedure.adskillelse.title",
            descriptionKey: "procedure.adskillelse.description",
            type: "separation",
            isGAG: true,
            criticalPoints: [
                "procedure.adskillelse.raw_cooked",
                "procedure.adskillelse.storage",
                "procedure.adskillelse.utensils"
            ]
        },
        
        personlig_hygiejne: {
            key: "personlig_hygiejne",
            titleKey: "procedure.personlig_hygiejne.title",
            descriptionKey: "procedure.personlig_hygiejne.description",
            type: "hygiene",
            isGAG: true,
            criticalPoints: [
                "procedure.personlig_hygiejne.handwashing",
                "procedure.personlig_hygiejne.clothing",
                "procedure.personlig_hygiejne.illness"
            ]
        },
        
        rengoering: {
            key: "rengoering",
            titleKey: "procedure.rengoering.title",
            descriptionKey: "procedure.rengoering.description",
            type: "cleaning",
            isGAG: true,
            criticalPoints: [
                "procedure.rengoering.daily",
                "procedure.rengoering.weekly",
                "procedure.rengoering.equipment"
            ]
        }
    }
};
