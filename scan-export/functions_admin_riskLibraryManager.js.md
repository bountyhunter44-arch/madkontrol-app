# FILE: functions/admin/riskLibraryManager.js

```javascript
const { getFirestore } = require("firebase-admin/firestore");

/**
 * Generate risk analysis from onboarding data
 * @param {Object} onboarding - Onboarding data
 * @returns {Object} Risk analysis object
 */
async function generateRiskAnalysisFromOnboarding(onboarding) {
    const db = getFirestore();
    const { companyId, locationId, cuisineType = [], processes = [], equipment = [] } = onboarding;

    const riskLibrarySnapshot = await db.collection("risk_library").get();
    const allRisks = riskLibrarySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    const matchedRisks = allRisks.filter(risk => {
        const processMatch = risk.processKeys?.some(pk => processes.includes(pk));
        if (!processMatch) return false;

        const hasCuisineAll = risk.cuisineTags?.includes("alle");
        const cuisineMatch = risk.cuisineTags?.some(ct => cuisineType.includes(ct));
        const equipmentMatch = risk.equipmentTags?.some(et => equipment.includes(et));
        const noEquipmentTags = !risk.equipmentTags || risk.equipmentTags.length === 0;

        return hasCuisineAll || cuisineMatch || equipmentMatch || noEquipmentTags;
    });

    const analysisId = `ra_${companyId}_${locationId}`;
    
    console.log(`[Risk Analysis] Generated for ${companyId}/${locationId}`);
    console.log(`[Risk Analysis] Matched ${matchedRisks.length} risks`);
    console.log(`[Risk Analysis] Analysis ID: ${analysisId}`);

    return {
        analysisId,
        createdAt: new Date().toISOString(),
        basedOn: onboarding,
        risks: matchedRisks.map(risk => ({
            riskId: risk.riskId,
            guideKey: risk.guideKey,
            isActive: true
        })),
        status: "draft"
    };
}

/**
 * Save risk analysis to Firestore
 * @param {Object} analysis - Risk analysis object
 */
async function saveRiskAnalysis(analysis) {
    const db = getFirestore();
    await db.collection("risk_analyses").doc(analysis.analysisId).set(analysis, { merge: true });
}

/**
 * Get guide by guideKey from risk_library
 * @param {string} guideKey - Guide key to lookup
 * @returns {Object|null} Guide object or null
 */
async function getGuideByGuideKey(guideKey) {
    const db = getFirestore();
    const snapshot = await db.collection("risk_library")
        .where("guideKey", "==", guideKey)
        .limit(1)
        .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return {
        id: doc.id,
        ...doc.data()
    };
}

module.exports = {
    generateRiskAnalysisFromOnboarding,
    saveRiskAnalysis,
    getGuideByGuideKey
};

```
