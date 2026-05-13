const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const PROCESS_RULES = {
    receive_chilled_goods: {
        id: "risk_receive_chilled_goods",
        title: "For høj temperatur ved modtagelse af kølevarer",
        description: "Der er risiko for bakterievækst hvis kølevarer modtages ved for høj temperatur.",
        hazardType: "bacterial_growth",
        controlType: "temperature_check",
        processKey: "receive_chilled_goods",
        category: "microbiological",
        isCCP: true,
        limitMin: null,
        limitMax: 5,
        limitUnit: "C",
        linkedEquipmentTypes: [],
        sourceRule: "rule_receive_chilled_goods"
    },
    receive_frozen_goods: {
        id: "risk_receive_frozen_goods",
        title: "For høj temperatur ved modtagelse af frostvarer",
        description: "Der er risiko for kvalitetsforringelse og temperaturbrud hvis frostvarer modtages for varme.",
        hazardType: "temperature_failure",
        controlType: "temperature_check",
        processKey: "receive_frozen_goods",
        category: "microbiological",
        isCCP: true,
        limitMin: null,
        limitMax: -18,
        limitUnit: "C",
        linkedEquipmentTypes: [],
        sourceRule: "rule_receive_frozen_goods"
    },
    store_chilled_goods: {
        id: "risk_store_chilled_goods",
        title: "For høj temperatur ved køleopbevaring",
        description: "Der er risiko for bakterievækst hvis kølevarer opbevares ved for høj temperatur.",
        hazardType: "bacterial_growth",
        controlType: "temperature_check",
        processKey: "store_chilled_goods",
        category: "microbiological",
        isCCP: true,
        limitMin: null,
        limitMax: 5,
        limitUnit: "C",
        linkedEquipmentTypes: ["fridge", "display_fridge"],
        sourceRule: "rule_store_chilled_goods"
    },
    store_frozen_goods: {
        id: "risk_store_frozen_goods",
        title: "For høj temperatur ved frostopbevaring",
        description: "Der er risiko for kvalitetsforringelse hvis frostvarer opbevares ved for høj temperatur.",
        hazardType: "temperature_failure",
        controlType: "temperature_check",
        processKey: "store_frozen_goods",
        category: "microbiological",
        isCCP: true,
        limitMin: null,
        limitMax: -18,
        limitUnit: "C",
        linkedEquipmentTypes: ["freezer"],
        sourceRule: "rule_store_frozen_goods"
    },
    cook_food: {
        id: "risk_cook_food",
        title: "Utilstrækkelig varmebehandling",
        description: "Der er risiko for overlevelse af bakterier hvis maden ikke varmebehandles tilstrækkeligt.",
        hazardType: "insufficient_cooking",
        controlType: "temperature_check",
        processKey: "cook_food",
        category: "microbiological",
        isCCP: true,
        limitMin: 75,
        limitMax: null,
        limitUnit: "C",
        linkedEquipmentTypes: [],
        sourceRule: "rule_cook_food"
    },
    hot_hold_food: {
        id: "risk_hot_hold_food",
        title: "Utilstrækkelig varmholdelse",
        description: "Der er risiko for bakterievækst hvis varm mad ikke holdes ved korrekt temperatur.",
        hazardType: "unsafe_hot_holding",
        controlType: "temperature_check",
        processKey: "hot_hold_food",
        category: "microbiological",
        isCCP: true,
        limitMin: 65,
        limitMax: null,
        limitUnit: "C",
        linkedEquipmentTypes: ["warming_cabinet"],
        sourceRule: "rule_hot_hold_food"
    },
    cool_food: {
        id: "risk_cool_food",
        title: "Utilstrækkelig nedkøling",
        description: "Der er risiko for bakterievækst hvis varm mad ikke nedkøles korrekt.",
        hazardType: "unsafe_cooling",
        controlType: "temperature_check",
        processKey: "cool_food",
        category: "microbiological",
        isCCP: true,
        limitMin: null,
        limitMax: 10,
        limitUnit: "C",
        linkedEquipmentTypes: ["blast_chiller"],
        sourceRule: "rule_cool_food"
    },
    reheat_food: {
        id: "risk_reheat_food",
        title: "Utilstrækkelig genopvarmning",
        description: "Der er risiko for overlevelse af bakterier hvis mad ikke genopvarmes tilstrækkeligt.",
        hazardType: "insufficient_reheating",
        controlType: "temperature_check",
        processKey: "reheat_food",
        category: "microbiological",
        isCCP: true,
        limitMin: 75,
        limitMax: null,
        limitUnit: "C",
        linkedEquipmentTypes: [],
        sourceRule: "rule_reheat_food"
    },
    serve_cold_food: {
        id: "risk_serve_cold_food",
        title: "For høj temperatur ved servering af kolde fødevarer",
        description: "Der er risiko for bakterievækst hvis kolde fødevarer holdes for varmt ved servering.",
        hazardType: "temperature_failure",
        controlType: "temperature_check",
        processKey: "serve_cold_food",
        category: "microbiological",
        isCCP: false,
        limitMin: null,
        limitMax: 5,
        limitUnit: "C",
        linkedEquipmentTypes: ["display_fridge"],
        sourceRule: "rule_serve_cold_food"
    }
};

function buildAllergenRisk(onboarding) {
    return {
        id: "risk_allergen_management",
        title: "Fejl i allergenhåndtering",
        description: "Der er risiko for at allergener ikke styres korrekt ved modtagelse, opbevaring, produktion eller servering.",
        hazardType: "allergen_cross_contact",
        controlType: "checklist",
        processKey: "allergen_management",
        category: "allergen",
        isCCP: false,
        limitMin: null,
        limitMax: null,
        limitUnit: "",
        linkedEquipmentTypes: [],
        sourceRule: "rule_allergen_management",
        derivedFrom: {
            specialConditions: onboarding.specialConditions || [],
            ingredients: onboarding.ingredients || []
        }
    };
}

function buildTransportRisk() {
    return {
        id: "risk_transport_food",
        title: "Temperaturbrud under transport",
        description: "Der er risiko for temperaturbrud og forringet fødevaresikkerhed under transport af madvarer.",
        hazardType: "transport_temperature_failure",
        controlType: "checklist",
        processKey: "transport_food",
        category: "microbiological",
        isCCP: false,
        limitMin: null,
        limitMax: null,
        limitUnit: "",
        linkedEquipmentTypes: [],
        sourceRule: "rule_transport_food"
    };
}

function shouldIncludeAllergenRisk(onboarding) {
    const specialConditions = Array.isArray(onboarding.specialConditions)
        ? onboarding.specialConditions
        : [];
    return specialConditions.includes("handles_allergens");
}

function shouldIncludeTransportRisk(onboarding) {
    const specialConditions = Array.isArray(onboarding.specialConditions)
        ? onboarding.specialConditions
        : [];
    return specialConditions.includes("transport_food");
}

function makeRiskDocId(baseId, locationId) {
    return `${baseId}__${locationId}`;
}

function comparableRiskData(data) {
    return JSON.stringify({
        companyId: data.companyId || "",
        locationId: data.locationId || "",
        title: data.title || "",
        description: data.description || "",
        hazardType: data.hazardType || "",
        controlType: data.controlType || "",
        processKey: data.processKey || "",
        category: data.category || "",
        isCCP: !!data.isCCP,
        limitMin: data.limitMin ?? null,
        limitMax: data.limitMax ?? null,
        limitUnit: data.limitUnit || "",
        linkedEquipmentTypes: Array.isArray(data.linkedEquipmentTypes) ? data.linkedEquipmentTypes : [],
        sourceRule: data.sourceRule || "",
        isActive: data.isActive !== false
    });
}

function buildRiskPayload({ onboarding, rule }) {
    return {
        companyId: onboarding.companyId || "",
        locationId: onboarding.locationId || "",
        title: rule.title,
        description: rule.description,
        hazardType: rule.hazardType,
        controlType: rule.controlType,
        processKey: rule.processKey,
        category: rule.category,
        isCCP: !!rule.isCCP,
        limitMin: rule.limitMin ?? null,
        limitMax: rule.limitMax ?? null,
        limitUnit: rule.limitUnit || "",
        linkedEquipmentTypes: Array.isArray(rule.linkedEquipmentTypes) ? rule.linkedEquipmentTypes : [],
        sourceRule: rule.sourceRule || "",
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };
}

async function generateRisksForOnboardingDoc(onboardingDoc) {
    const onboarding = onboardingDoc.data();
    const locationId = onboarding.locationId || "";
    const companyId = onboarding.companyId || "";

    if (!locationId) {
        throw new Error(`onboarding_answers/${onboardingDoc.id} mangler locationId`);
    }

    if (!companyId) {
        throw new Error(`onboarding_answers/${onboardingDoc.id} mangler companyId`);
    }

    const processes = Array.isArray(onboarding.processes) ? onboarding.processes : [];
    const desiredRules = [];

    for (const processKey of processes) {
        const rule = PROCESS_RULES[processKey];
        if (rule) {
            desiredRules.push(rule);
        }
    }

    if (shouldIncludeAllergenRisk(onboarding)) {
        desiredRules.push(buildAllergenRisk(onboarding));
    }

    if (shouldIncludeTransportRisk(onboarding)) {
        desiredRules.push(buildTransportRisk());
    }

    const uniqueRules = new Map();
    for (const rule of desiredRules) {
        uniqueRules.set(rule.id, rule);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const rule of uniqueRules.values()) {
        const riskDocId = makeRiskDocId(rule.id, locationId);
        const ref = db.collection("risks").doc(riskDocId);
        const snap = await ref.get();

        const payload = buildRiskPayload({ onboarding, rule });

        if (!snap.exists) {
            await ref.set(payload);
            created++;
            continue;
        }

        const current = snap.data() || {};

        const currentComparable = comparableRiskData(current);
        const nextComparable = comparableRiskData(payload);

        if (currentComparable === nextComparable) {
            skipped++;
            continue;
        }

        await ref.set(
            {
                ...payload,
                createdAt: current.createdAt || FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            },
            { merge: true }
        );
        updated++;
    }

    return {
        onboardingId: onboardingDoc.id,
        locationId,
        companyId,
        created,
        updated,
        skipped,
        totalRules: uniqueRules.size
    };
}

async function generateRisksFromOnboardingAnswers({ locationId = null } = {}) {
    let query = db.collection("onboarding_answers");

    if (locationId) {
        query = query.where("locationId", "==", locationId);
    }

    const onboardingSnap = await query.get();

    if (onboardingSnap.empty) {
        return {
            ok: true,
            message: "Ingen onboarding_answers fundet.",
            created: 0,
            updated: 0,
            skipped: 0,
            processedOnboardings: 0
        };
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const details = [];

    for (const onboardingDoc of onboardingSnap.docs) {
        const result = await generateRisksForOnboardingDoc(onboardingDoc);
        created += result.created;
        updated += result.updated;
        skipped += result.skipped;
        details.push(result);
    }

    return {
        ok: true,
        message: "Risks genereret fra onboarding_answers.",
        created,
        updated,
        skipped,
        processedOnboardings: onboardingSnap.size,
        details
    };
}

async function run() {
    try {
        const locationId = process.argv[2] || null;
        const result = await generateRisksFromOnboardingAnswers({ locationId });
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error("Generator fejl:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    run();
}

module.exports = {
    generateRisksFromOnboardingAnswers
};