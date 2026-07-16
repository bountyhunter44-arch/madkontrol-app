/**
 * Build Personalisering - Extracts personalization data from profile
 * Returns language-neutral personalization object
 */

export function buildPersonalisering(profile = {}) {
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

export function extractActivities(profile = {}) {
    const activities = {};
    
    // Receiving activities
    activities.modtagerKoelevarer = !!(
        profile.modtagerKoelevarer ||
        profile.receivesColdGoods ||
        profile.antalKoeleskabe > 0
    );
    
    activities.modtagerFrostvarer = !!(
        profile.modtagerFrostvarer ||
        profile.receivesFrozenGoods ||
        profile.antalFrysere > 0
    );
    
    // Preparation activities
    activities.tilberederVarmMad = !!(
        profile.tilberederVarmMad ||
        profile.preparesHotFood ||
        profile.madkoncept?.toLowerCase().includes('varm') ||
        profile.foodConcept?.toLowerCase().includes('hot')
    );
    
    activities.nedkoelerMad = !!(
        profile.nedkoelerMad ||
        profile.coolsFood ||
        profile.tilberederVarmMad
    );
    
    activities.varmholder = !!(
        profile.varmholder ||
        profile.holdsHotFood ||
        profile.tilberederVarmMad
    );
    
    activities.servererKoldMad = !!(
        profile.servererKoldMad ||
        profile.servesColdFood ||
        profile.madkoncept?.toLowerCase().includes('salat') ||
        profile.madkoncept?.toLowerCase().includes('sandwich')
    );
    
    activities.takeaway = !!(
        profile.takeaway ||
        profile.offersTakeaway ||
        profile.companyType?.toLowerCase().includes('takeaway')
    );
    
    activities.buffet = !!(
        profile.buffet ||
        profile.offersBuffet ||
        profile.madkoncept?.toLowerCase().includes('buffet')
    );
    
    return activities;
}

export function shouldEnableSchema(schemaKey, activities) {
    const rules = {
        varemodtagelse: () => activities.modtagerKoelevarer || activities.modtagerFrostvarer,
        koel_frost: () => activities.modtagerKoelevarer || activities.modtagerFrostvarer,
        opvarmning: () => activities.tilberederVarmMad,
        varmholdelse: () => activities.varmholder,
        rengoering: () => true
    };
    
    const rule = rules[schemaKey];
    return rule ? rule() : true;
}
