/**
 * Build Units - Generates personalized equipment units from profile
 * Returns language-neutral unit definitions
 */

export function buildUnits(profile = {}) {
    const units = [];
    
    // Extract counts from profile
    const antalKoeleskabe = parseInt(profile.antalKoeleskabe || profile.numberOfFridges || 0, 10);
    const antalFrysere = parseInt(profile.antalFrysere || profile.numberOfFreezers || 0, 10);
    
    // Generate fridges
    for (let i = 1; i <= antalKoeleskabe; i++) {
        units.push({
            id: `koeleskab_${i}`,
            type: "koeleskab",
            nameKey: i === 1 ? "unit.fridge.primary" : `unit.fridge.number`,
            fallbackName: i === 1 ? "Hovedkøleskab" : `Køleskab ${i}`,
            displayNumber: i,
            category: "cold_storage",
            measurementType: "temperature",
            limits: {
                min: 0,
                max: 5,
                unit: "celsius"
            },
            enabled: true,
            sortOrder: i
        });
    }
    
    // Generate freezers
    for (let i = 1; i <= antalFrysere; i++) {
        units.push({
            id: `fryser_${i}`,
            type: "fryser",
            nameKey: i === 1 ? "unit.freezer.primary" : `unit.freezer.number`,
            fallbackName: i === 1 ? "Hovedfryser" : `Fryser ${i}`,
            displayNumber: i,
            category: "frozen_storage",
            measurementType: "temperature",
            limits: {
                min: null,
                max: -18,
                unit: "celsius"
            },
            enabled: true,
            sortOrder: antalKoeleskabe + i
        });
    }
    
    // Add display fridge if mentioned in profile
    if (profile.harDisplayKoeleskab || profile.hasDisplayFridge) {
        units.push({
            id: "display_koeleskab",
            type: "koeleskab",
            nameKey: "unit.fridge.display",
            fallbackName: "Displaykøleskab",
            category: "cold_storage",
            measurementType: "temperature",
            limits: {
                min: 0,
                max: 5,
                unit: "celsius"
            },
            enabled: true,
            sortOrder: 1000
        });
    }
    
    return units;
}

export function getUnitsByType(units, type) {
    return units.filter(u => u.type === type);
}

export function getEnabledUnits(units) {
    return units.filter(u => u.enabled === true);
}
