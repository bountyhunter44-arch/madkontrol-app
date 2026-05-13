# FILE: functions/guideResolver.js

```javascript
/**
 * Deterministic Guide Resolver
 * Maps templates to correct guideKey and taskType based on precedence rules
 */

/**
 * Resolve guideKey and taskType for a template
 * Uses explicit precedence: controlType > title keywords > aggregatedCategory > category
 */
function resolveGuideMapping(template) {
    const title = String(template.title || template.name || "").toLowerCase();
    const controlType = String(template.controlType || "").toLowerCase();
    const aggregatedCategory = String(template.aggregatedCategory || "").toLowerCase();
    const category = String(template.category || "").toLowerCase();
    const processKey = String(template.processKey || "").toLowerCase();
    const equipmentType = String(template.equipmentType || "").toLowerCase();
    const description = String(template.description || "").toLowerCase();

    const combined = `${title} ${controlType} ${aggregatedCategory} ${category} ${processKey} ${equipmentType} ${description}`;

    // PRECEDENCE 1: Explicit controlType
    if (controlType === "temperature" || controlType === "temperature_with_checklist") {
        // Determine which temperature type
        if (combined.includes("frys") || combined.includes("freezer") || combined.includes("frost")) {
            return {
                guideKey: "freezer_temperature",
                taskType: "freezer_temperature",
                reason: "controlType=temperature + freezer keywords"
            };
        }
        if (combined.includes("køl") || combined.includes("koel") || combined.includes("fridge") || 
            combined.includes("chilled") || combined.includes("cooler") || combined.includes("køleskab")) {
            return {
                guideKey: "fridge_temperature",
                taskType: "fridge_temperature",
                reason: "controlType=temperature + fridge keywords"
            };
        }
        if (combined.includes("varm") || combined.includes("hot") || combined.includes("holding") ||
            combined.includes("bain marie") || combined.includes("varmeskab")) {
            return {
                guideKey: "hot_holding",
                taskType: "hot_holding",
                reason: "controlType=temperature + hot holding keywords"
            };
        }
        if (combined.includes("ovn") || combined.includes("oven")) {
            return {
                guideKey: "oven_control",
                taskType: "oven_control",
                reason: "controlType=temperature + oven keywords"
            };
        }
        // Default for temperature without specific type
        return {
            guideKey: "fridge_temperature",
            taskType: "fridge_temperature",
            reason: "controlType=temperature (default to fridge)"
        };
    }

    if (controlType === "cooling_process") {
        return {
            guideKey: "cooling_process",
            taskType: "cooling_process",
            reason: "controlType=cooling_process"
        };
    }

    if (controlType === "reheating_process") {
        return {
            guideKey: "reheating",
            taskType: "reheating",
            reason: "controlType=reheating_process"
        };
    }

    // PRECEDENCE 2: Specific title/description keywords (high confidence)
    // Order matters: Check more specific patterns first to avoid false positives
    
    // Receiving / Modtagelse (check BEFORE temperature keywords to avoid conflicts)
    if (combined.includes("modtag") || combined.includes("receiving") || 
        combined.includes("levering") || combined.includes("delivery") || combined.includes("varemodtag")) {
        return {
            guideKey: "receiving_goods",
            taskType: "receiving_goods",
            reason: "receiving keywords in title/description"
        };
    }

    // Reheating / Genopvarmning (specific before general temperature)
    if (combined.includes("genopvarm") || combined.includes("reheat")) {
        return {
            guideKey: "reheating",
            taskType: "reheating",
            reason: "reheating keywords in title/description"
        };
    }

    // Cooling process / Nedkøling (specific before general køl)
    if (combined.includes("nedkøl") || combined.includes("nedkoel")) {
        return {
            guideKey: "cooling_process",
            taskType: "cooling_process",
            reason: "cooling keywords in title/description"
        };
    }

    // Hot holding / Varmholdelse
    if (combined.includes("varmhold") || combined.includes("hot hold") || 
        combined.includes("bain marie") || combined.includes("varmeskab")) {
        return {
            guideKey: "hot_holding",
            taskType: "hot_holding",
            reason: "hot holding keywords in title/description"
        };
    }

    // Freezer/Frost (before general temperature)
    if (combined.includes("fryser") || combined.includes("freezer") || combined.includes("frost")) {
        return {
            guideKey: "freezer_temperature",
            taskType: "freezer_temperature",
            reason: "freezer keywords in title/description"
        };
    }

    // Fridge/Køl (after nedkøling check to avoid false positive)
    if (combined.includes("køleskab") || combined.includes("køleskabe") ||
        combined.includes("fridge") || combined.includes("chilled") || combined.includes("cooler") ||
        (combined.includes("køl") && !combined.includes("nedkøl"))) {
        return {
            guideKey: "fridge_temperature",
            taskType: "fridge_temperature",
            reason: "fridge keywords in title/description"
        };
    }

    // Allergen
    if (combined.includes("allergen") || combined.includes("allergener")) {
        return {
            guideKey: "allergen_control",
            taskType: "allergen_control",
            reason: "allergen keywords in title/description"
        };
    }

    // Drain / Afløb
    if (combined.includes("afløb") || combined.includes("aflob") || combined.includes("drain") ||
        combined.includes("kloakrist") || combined.includes("rist")) {
        return {
            guideKey: "drain_maintenance",
            taskType: "drain_maintenance",
            reason: "drain keywords in title/description"
        };
    }

    // Personal hygiene / Personlig hygiejne
    if (combined.includes("håndvask") || combined.includes("handvask") || 
        combined.includes("personale") || combined.includes("personal") || 
        combined.includes("hygiejne") || combined.includes("hygiene") ||
        combined.includes("uniform") || combined.includes("staff")) {
        return {
            guideKey: "personal_hygiene_check",
            taskType: "personal_hygiene",
            reason: "personal hygiene keywords in title/description"
        };
    }

    // Closing routine / Lukkerutine
    if (combined.includes("lukke") || combined.includes("closing") || 
        combined.includes("slut") || combined.includes("end of day")) {
        return {
            guideKey: "closing_routine",
            taskType: "closing_routine",
            reason: "closing keywords in title/description"
        };
    }

    // Ice equipment / Ismaskine / Softice
    if (combined.includes("ismaskine") || combined.includes("ice machine") || 
        combined.includes("softice") || combined.includes("soft ice")) {
        return {
            guideKey: "ice_equipment",
            taskType: "ice_equipment",
            reason: "ice equipment keywords in title/description"
        };
    }

    // Fryer / Friture
    if (combined.includes("friture") || combined.includes("fryer") || combined.includes("frityr")) {
        return {
            guideKey: "fryer_control",
            taskType: "fryer_control",
            reason: "fryer keywords in title/description"
        };
    }

    // Oven / Ovn
    if (combined.includes("ovn") || combined.includes("oven")) {
        return {
            guideKey: "oven_control",
            taskType: "oven_control",
            reason: "oven keywords in title/description"
        };
    }

    // Dishwasher / Opvaskemaskine
    if (combined.includes("opvask") || combined.includes("dishwash") || combined.includes("industriopvask")) {
        return {
            guideKey: "dishwasher_control",
            taskType: "dishwasher_control",
            reason: "dishwasher keywords in title/description"
        };
    }

    // Equipment cleaning
    if ((combined.includes("rengør") || combined.includes("rengoer") || combined.includes("clean")) &&
        (combined.includes("udstyr") || combined.includes("equipment") || combined.includes("maskine"))) {
        return {
            guideKey: "equipment_cleaning",
            taskType: "equipment_cleaning",
            reason: "equipment cleaning keywords in title/description"
        };
    }

    // PRECEDENCE 3: aggregatedCategory
    if (aggregatedCategory) {
        const categoryMapping = {
            "temperature_cooling": { guideKey: "fridge_temperature", taskType: "fridge_temperature", reason: "aggregatedCategory=temperature_cooling" },
            "temperature_freezing": { guideKey: "freezer_temperature", taskType: "freezer_temperature", reason: "aggregatedCategory=temperature_freezing" },
            "temperature_heating": { guideKey: "hot_holding", taskType: "hot_holding", reason: "aggregatedCategory=temperature_heating" },
            "hot_holding": { guideKey: "hot_holding", taskType: "hot_holding", reason: "aggregatedCategory=hot_holding" },
            "reheating_process": { guideKey: "reheating", taskType: "reheating", reason: "aggregatedCategory=reheating_process" },
            "cooling_process": { guideKey: "cooling_process", taskType: "cooling_process", reason: "aggregatedCategory=cooling_process" },
            "receiving_control": { guideKey: "receiving_goods", taskType: "receiving_goods", reason: "aggregatedCategory=receiving_control" },
            "allergen_control": { guideKey: "allergen_control", taskType: "allergen_control", reason: "aggregatedCategory=allergen_control" },
            "drain_maintenance": { guideKey: "drain_maintenance", taskType: "drain_maintenance", reason: "aggregatedCategory=drain_maintenance" },
            "staff_hygiene": { guideKey: "personal_hygiene_check", taskType: "personal_hygiene", reason: "aggregatedCategory=staff_hygiene" },
            "closing_routine": { guideKey: "closing_routine", taskType: "closing_routine", reason: "aggregatedCategory=closing_routine" },
            "ice_equipment_critical": { guideKey: "ice_equipment", taskType: "ice_equipment", reason: "aggregatedCategory=ice_equipment_critical" },
            "fryer_critical": { guideKey: "fryer_control", taskType: "fryer_control", reason: "aggregatedCategory=fryer_critical" },
            "equipment_cleaning": { guideKey: "equipment_cleaning", taskType: "equipment_cleaning", reason: "aggregatedCategory=equipment_cleaning" },
            "area_cleaning": { guideKey: "cleaning_control", taskType: "cleaning_control", reason: "aggregatedCategory=area_cleaning" }
        };

        if (categoryMapping[aggregatedCategory]) {
            return categoryMapping[aggregatedCategory];
        }
    }

    // PRECEDENCE 4: category (backward compatibility)
    if (category) {
        const categoryMapping = {
            "opbevaring": { guideKey: "fridge_temperature", taskType: "fridge_temperature", reason: "category=opbevaring (storage default to fridge)" },
            "modtagelse": { guideKey: "receiving_goods", taskType: "receiving_goods", reason: "category=modtagelse" },
            "allergener": { guideKey: "allergen_control", taskType: "allergen_control", reason: "category=allergener" },
            "temperatur": { guideKey: "fridge_temperature", taskType: "fridge_temperature", reason: "category=temperatur (default to fridge temp)" },
            "transport": { guideKey: "fridge_temperature", taskType: "fridge_temperature", reason: "category=transport (default to temp control)" },
            "tilberedning": { guideKey: "hot_holding", taskType: "hot_holding", reason: "category=tilberedning (preparation default to hot holding)" },
            "lukkerutine": { guideKey: "closing_routine", taskType: "closing_routine", reason: "category=lukkerutine" }
        };

        if (categoryMapping[category]) {
            return categoryMapping[category];
        }
    }

    // PRECEDENCE 5: Temperature keyword fallback (if contains temperatur/temperature but no specific type)
    if (combined.includes("temperatur") || combined.includes("temperature") || combined.includes("temp ")) {
        return {
            guideKey: "fridge_temperature",
            taskType: "fridge_temperature",
            reason: "temperature keyword fallback (default to fridge)"
        };
    }

    // PRECEDENCE 6: Cleaning (broad fallback)
    if (combined.includes("rengør") || combined.includes("rengoer") || combined.includes("clean") ||
        combined.includes("hygiejne") || combined.includes("hygiene")) {
        return {
            guideKey: "cleaning_control",
            taskType: "cleaning_control",
            reason: "cleaning keywords (fallback)"
        };
    }

    // FINAL FALLBACK
    return {
        guideKey: "cleaning_control",
        taskType: "general_check",
        reason: "no specific match (final fallback)"
    };
}

/**
 * Detect suspicious mappings
 */
function isSuspiciousMapping(template, mapping) {
    const title = String(template.title || template.name || "").toLowerCase();
    const controlType = String(template.controlType || "").toLowerCase();
    const combined = `${title} ${controlType}`;

    const suspiciousPatterns = [
        // Temperature tasks mapped to cleaning
        {
            pattern: /(køl|koel|fridge|frys|freezer|frost|temperatur|temperature)/,
            wrongGuideKey: "cleaning_control",
            message: "Temperature task mapped to cleaning_control"
        },
        // Hot holding mapped to cleaning
        {
            pattern: /(varmhold|hot.?hold|varm|hot)/,
            wrongGuideKey: "cleaning_control",
            message: "Hot holding task mapped to cleaning_control"
        },
        // Allergen not mapped to allergen_control
        {
            pattern: /(allergen)/,
            wrongGuideKey: /^(?!allergen_control)/,
            message: "Allergen task not mapped to allergen_control"
        },
        // Receiving not mapped to receiving_goods
        {
            pattern: /(modtag|receiving|levering|delivery)/,
            wrongGuideKey: /^(?!receiving_goods)/,
            message: "Receiving task not mapped to receiving_goods"
        }
    ];

    for (const check of suspiciousPatterns) {
        if (check.pattern.test(combined)) {
            if (typeof check.wrongGuideKey === 'string') {
                if (mapping.guideKey === check.wrongGuideKey) {
                    return { suspicious: true, reason: check.message };
                }
            } else if (check.wrongGuideKey instanceof RegExp) {
                if (check.wrongGuideKey.test(mapping.guideKey)) {
                    return { suspicious: true, reason: check.message };
                }
            }
        }
    }

    return { suspicious: false };
}

module.exports = {
    resolveGuideMapping,
    isSuspiciousMapping
};

```
