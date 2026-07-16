const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

function calculateActivityScore(profile) {
    let score = 0;

    if (profile.usesRawFish) score += 20;
    if (profile.usesFreshFish) score += 10;
    if (profile.usesRawMeat) score += 10;
    if (profile.usesMincedMeat) score += 10;
    if (profile.usesPoultry) score += 10;
    if (profile.doesCooling) score += 15;
    if (profile.doesReheating) score += 10;
    if (profile.doesHotHolding) score += 10;
    if (profile.doesFreezeFishForParasites) score += 10;
    if (profile.hasWalkInCooler) score += 5;
    if (profile.hasWalkInFreezer) score += 5;
    if (profile.hasVegetablePrep) score += 5;
    if (profile.hasOpenProduction) score += 10;
    if (profile.mobileUnit) score += 10;
    if (profile.servesHighRiskGroups) score += 20;

    return score;
}

function getRiskGroup(totalScore) {
    if (totalScore >= 80) return "saerlig_hoj";
    if (totalScore >= 60) return "hoj";
    if (totalScore >= 40) return "middel";
    if (totalScore >= 25) return "lav";
    return "ultralav";
}

function getStandardControlFrequency(riskGroup) {
    switch (riskGroup) {
        case "saerlig_hoj":
            return 3;
        case "hoj":
            return 2;
        case "middel":
            return 1;
        case "lav":
            return 0.5;
        case "ultralav":
            return 0.25;
        default:
            return 1;
    }
}

function getReducedControlFrequency(standardFrequency) {
    if (standardFrequency >= 3) return 2;
    if (standardFrequency >= 2) return 1;
    if (standardFrequency >= 1) return 0.5;
    if (standardFrequency >= 0.5) return 0.25;
    return 0.25;
}

async function getDeviationStats(companyId, unitId, locationId) {
    const snapshot = await db
        .collection("deviations")
        .where("companyId", "==", companyId)
        .where("unitId", "==", unitId)
        .where("locationId", "==", locationId)
        .get();

    let openCount = 0;
    let totalCount = 0;
    let highSeverityCount = 0;

    snapshot.forEach((doc) => {
        const data = doc.data();
        totalCount++;

        if (data.status && data.status !== "resolved" && data.status !== "closed") {
            openCount++;
        }

        if (data.severity === "high") {
            highSeverityCount++;
        }
    });

    return {
        totalCount,
        openCount,
        highSeverityCount
    };
}

function calculateComplianceScore(deviationStats) {
    let score = 0;

    score += deviationStats.openCount * 5;
    score += deviationStats.highSeverityCount * 8;

    return score;
}

async function run() {
    try {
        console.log("Genererer risk profiles...");

        const profilesSnapshot = await db.collection("activity_profiles").get();

        if (profilesSnapshot.empty) {
            console.log("Ingen activity_profiles fundet.");
            return;
        }

        let generatedCount = 0;

        for (const doc of profilesSnapshot.docs) {
            const profile = doc.data();
            const profileId = doc.id;

            const companyId = profile.companyId;
            const unitId = profile.unitId;
            const locationId = profile.locationId;

            const activityScore = calculateActivityScore(profile);
            const deviationStats = await getDeviationStats(companyId, unitId, locationId);
            const complianceScore = calculateComplianceScore(deviationStats);

            const structuralScore = 0;
            const hygieneScore = 0;

            const totalRiskScore =
                activityScore +
                complianceScore +
                structuralScore +
                hygieneScore;

            const riskGroup = getRiskGroup(totalRiskScore);
            const standardControlFrequency = getStandardControlFrequency(riskGroup);
            const reducedControlFrequency = getReducedControlFrequency(standardControlFrequency);

            const riskProfileId = `risk_profile__${companyId}__${unitId}__${locationId}`;

            await db.collection("risk_profiles").doc(riskProfileId).set(
                {
                    companyId,
                    unitId,
                    locationId,
                    sourceActivityProfileId: profileId,

                    activityScore,
                    complianceScore,
                    structuralScore,
                    hygieneScore,
                    totalRiskScore,

                    riskGroup,
                    standardControlFrequency,
                    reducedControlFrequency,

                    openDeviationCount: deviationStats.openCount,
                    totalDeviationCount: deviationStats.totalCount,
                    highSeverityDeviationCount: deviationStats.highSeverityCount,

                    last4ReportsWithoutRemarks: false,
                    last12MonthsWithoutRemarks: false,
                    canQualifyForReducedFrequency: false,

                    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                },
                { merge: true }
            );

            console.log(`Oprettet risk profile: ${riskProfileId}`);
            generatedCount++;
        }

        console.log("Risk profiles færdig ✅");
        console.log(`Antal oprettet/opdateret: ${generatedCount}`);
    } catch (error) {
        console.error("Fejl i generateRiskProfile:", error);
        process.exitCode = 1;
    }
}

run();