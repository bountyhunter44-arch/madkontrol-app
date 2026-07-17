"use strict";

const { sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt } = require("./util");

// Rene hjælpefunktioner udtrukket fra index.js (ingen eksterne afhængigheder).

function sanitizeOnboardingProfile(profile = {}) {
  return {
    companyName: sanitizeString(profile.companyName || profile.name, 140),
    cvr: sanitizeString(profile.cvr, 30),
    address: sanitizeString(profile.address, 180),
    city: sanitizeString(profile.city, 80),
    zip: sanitizeString(profile.zip, 20),
    companyType: sanitizeString(profile.companyType || profile.businessType, 80),
    ownerName: sanitizeString(profile.ownerName || profile.contactName || profile.leader, 120),
    phone: sanitizeString(profile.phone || profile.phoneNumber, 40),
    accountEmail: sanitizeString(profile.accountEmail, 160),
    accountPassword: sanitizeString(profile.accountPassword, 200),
    registrationDate: sanitizeString(profile.registrationDate, 40),
    cleaningNotes: sanitizeString(profile.cleaningNotes, 2000),
    supplierInput: sanitizeString(profile.supplierInput, 2000),
    // Step 1: Modtagelse
    receivesChilledGoods: sanitizeBoolean(profile.receivesChilledGoods),
    receivesChilledGoodsDetails: sanitizeString(profile.receivesChilledGoodsDetails, 2000),
    receivesFrozenGoods: sanitizeBoolean(profile.receivesFrozenGoods),
    receivesFrozenGoodsDetails: sanitizeString(profile.receivesFrozenGoodsDetails, 2000),
    receivesFrozenGoodsCritical: sanitizeBoolean(profile.receivesFrozenGoodsCritical),
    receivesRoomTempGoods: sanitizeBoolean(profile.receivesRoomTempGoods),
    receivesRoomTempGoodsDetails: sanitizeString(profile.receivesRoomTempGoodsDetails, 2000),
    // Step 2: Opbevaring
    storesChilledGoods: sanitizeBoolean(profile.storesChilledGoods),
    storesChilledGoodsDetails: sanitizeString(profile.storesChilledGoodsDetails, 2000),
    storesChilledGoodsCritical: sanitizeBoolean(profile.storesChilledGoodsCritical),
    storesFrozenGoods: sanitizeBoolean(profile.storesFrozenGoods),
    storesFrozenGoodsDetails: sanitizeString(profile.storesFrozenGoodsDetails, 2000),
    storesFrozenGoodsCritical: sanitizeBoolean(profile.storesFrozenGoodsCritical),
    storesRoomTempGoods: sanitizeBoolean(profile.storesRoomTempGoods),
    storesRoomTempGoodsDetails: sanitizeString(profile.storesRoomTempGoodsDetails, 2000),
    // Step 3: Tilberedning
    preparesHotFood: sanitizeBoolean(profile.preparesHotFood),
    preparesHotFoodDetails: sanitizeString(profile.preparesHotFoodDetails, 2000),
    preparesHotFoodCritical: sanitizeBoolean(profile.preparesHotFoodCritical),
    preparesColdFood: sanitizeBoolean(profile.preparesColdFood),
    preparesColdFoodDetails: sanitizeString(profile.preparesColdFoodDetails, 2000),
    preparesColdFoodCritical: sanitizeBoolean(profile.preparesColdFoodCritical),
    // Step 4: Varmholdelse/NedkÃ¸ling
    holdsHotFood: sanitizeBoolean(profile.holdsHotFood),
    holdsHotFoodDetails: sanitizeString(profile.holdsHotFoodDetails, 2000),
    holdsHotFoodCritical: sanitizeBoolean(profile.holdsHotFoodCritical),
    coolsHotFood: sanitizeBoolean(profile.coolsHotFood),
    coolsHotFoodDetails: sanitizeString(profile.coolsHotFoodDetails, 2000),
    coolsHotFoodCritical: sanitizeBoolean(profile.coolsHotFoodCritical),
    // Step 5: HÃ¥ndtering/Allergener
    handlesDifferentFoods: sanitizeBoolean(profile.handlesDifferentFoods),
    handlesDifferentFoodsDetails: sanitizeString(profile.handlesDifferentFoodsDetails, 2000),
    handlesAllergens: sanitizeBoolean(profile.handlesAllergens),
    handlesAllergensDetails: sanitizeString(profile.handlesAllergensDetails, 2000),
    handlesAllergensCritical: sanitizeBoolean(profile.handlesAllergensCritical),
    // Step 6: Salg og servering
    sellsPackagedChilled: sanitizeBoolean(profile.sellsPackagedChilled),
    sellsPackagedFrozen: sanitizeBoolean(profile.sellsPackagedFrozen),
    sellsPackagedRoomTemp: sanitizeBoolean(profile.sellsPackagedRoomTemp),
    sellsUnpackagedChilled: sanitizeBoolean(profile.sellsUnpackagedChilled),
    sellsUnpackagedRoomTemp: sanitizeBoolean(profile.sellsUnpackagedRoomTemp),
    sellsFoodWithAllergens: sanitizeBoolean(profile.sellsFoodWithAllergens),
    sellsFoodWithAllergensDetails: sanitizeString(profile.sellsFoodWithAllergensDetails, 2000),
    packagesOwnFood: sanitizeBoolean(profile.packagesOwnFood),
    packagesOwnFoodDetails: sanitizeString(profile.packagesOwnFoodDetails, 2000),
    // Step 7: Transport
    transportsChilledGoods: sanitizeBoolean(profile.transportsChilledGoods),
    transportsFrozenGoods: sanitizeBoolean(profile.transportsFrozenGoods),
    transportsRoomTempGoods: sanitizeBoolean(profile.transportsRoomTempGoods),
    transportsHotTakeaway: sanitizeBoolean(profile.transportsHotTakeaway),
    transportsHotTakeawayDetails: sanitizeString(profile.transportsHotTakeawayDetails, 2000),
    // Legacy fields
    servesHotFood: sanitizeBoolean(profile.servesHotFood),
    servesColdFood: sanitizeBoolean(profile.servesColdFood),
    sellsRawFish: sanitizeBoolean(profile.sellsRawFish),
    makesDesserts: sanitizeBoolean(profile.makesDesserts),
    packsTakeaway: sanitizeBoolean(profile.packsTakeaway),
    hasHotHolding: sanitizeBoolean(profile.hasHotHolding),
    hasDryStorage: sanitizeBoolean(profile.hasDryStorage),
    hasProductionKitchen: sanitizeBoolean(profile.hasProductionKitchen),
    hasServingArea: sanitizeBoolean(profile.hasServingArea),
    hasToilet: sanitizeBoolean(profile.hasToilet),
    hasDishwashing: sanitizeBoolean(profile.hasDishwashing),
    hasWarmKitchen: sanitizeBoolean(profile.hasWarmKitchen),
    hasColdKitchen: sanitizeBoolean(profile.hasColdKitchen),
    hasHandwash: sanitizeBoolean(profile.hasHandwash),
    hasWashingRoom: sanitizeBoolean(profile.hasWashingRoom),
    hasVegetableRoom: sanitizeBoolean(profile.hasVegetableRoom),
    hasWalkInFreezer: sanitizeBoolean(profile.hasWalkInFreezer),
    hasWalkInCooler: sanitizeBoolean(profile.hasWalkInCooler),
    hasSofticeachine: sanitizeBoolean(profile.hasSofticeachine),
    hasOvens: sanitizeBoolean(profile.hasOvens),
    fridgeCount: toPositiveInt(profile.fridgeCount),
    freezerCount: toPositiveInt(profile.freezerCount),
    suppliers: sanitizeStringList(profile.suppliers, 80, 140),
    // Activity fields from onboarding (Danish names)
    tilberederVarmMad: sanitizeBoolean(profile.tilberederVarmMad),
    modtagerKoelevarer: sanitizeBoolean(profile.modtagerKoelevarer),
    modtagerFrostvarer: sanitizeBoolean(profile.modtagerFrostvarer),
    varmholder: sanitizeBoolean(profile.varmholder),
    nedkoelerMad: sanitizeBoolean(profile.nedkoelerMad),
    servererKoldMad: sanitizeBoolean(profile.servererKoldMad),
    antalKoeleskabe: toPositiveInt(profile.antalKoeleskabe),
    antalFrysere: toPositiveInt(profile.antalFrysere),
    walkInCoolerCount: toPositiveInt(profile.walkInCoolerCount),
    walkInFreezerCount: toPositiveInt(profile.walkInFreezerCount),
    antalIsterningemaskiner: toPositiveInt(profile.antalIsterningemaskiner),
    antalIsbokse: toPositiveInt(profile.antalIsbokse),
    antalFrityreGryder: toPositiveInt(profile.antalFrityreGryder),
    hasIceMachine: sanitizeBoolean(profile.hasIceMachine || profile.hasIsterningemaskine),
    hasIsboks: sanitizeBoolean(profile.hasIsboks),
    hasFrituregryde: sanitizeBoolean(profile.hasFrituregryde),
    madkoncept: sanitizeString(profile.madkoncept, 500),
    produkter: sanitizeString(profile.produkter, 1000)
  };
}

function sanitizeRiskModelInput(riskModel = {}) {
  return {
    hazards: toArray(riskModel.hazards).slice(0, 100).map((hazard) => ({
      name: sanitizeString(hazard?.name, 180),
      riskLevel: sanitizeString(hazard?.riskLevel, 40),
      control: sanitizeString(hazard?.control, 220),
      frequency: sanitizeString(hazard?.frequency, 80)
    })),
    controls: sanitizeStringList(riskModel.controls, 100, 180),
    tasks: sanitizeStringList(riskModel.tasks, 200, 180),
    suppliers: sanitizeStringList(riskModel.suppliers, 100, 140),
    companyType: sanitizeString(riskModel.companyType, 80),
    organizationName: sanitizeString(riskModel.organizationName, 140),
    generatedAt: sanitizeString(riskModel.generatedAt, 80)
  };
}

module.exports = {
  sanitizeOnboardingProfile,
  sanitizeRiskModelInput
};
