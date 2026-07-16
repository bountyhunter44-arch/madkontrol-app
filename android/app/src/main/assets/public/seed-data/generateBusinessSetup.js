const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

/*
    MADKONTROLLEN PRO
    Automatisk generator:
    - company
    - location
    - user
    - onboarding_answers
    - equipment
    - risks
    - tasks

    Kør:
    node generateBusinessSetup.js
*/

const SETUP = {
    company: {
        id: "company_1",
        name: "Michaels Foodtruck ApS",
        ownerName: "Michael Nielsen",
        plan: "pro"
    },

    location: {
        id: "location_1",
        companyId: "company_1",
        name: "Foodtruck Aarhus",
        type: "foodtruck",
        city: "Aarhus"
    },

    user: {
        id: "user_michael",
        companyId: "company_1",
        locationIds: ["location_1"],
        name: "Michael Nielsen",
        role: "owner"
    },

    onboarding: {
        id: "onboarding_location_1",
        companyId: "company_1",
        locationId: "location_1",

        businessTypes: ["foodtruck", "takeaway"],

        processes: [
            "receive_chilled_goods",
            "receive_frozen_goods",
            "store_chilled_goods",
            "store_frozen_goods",
            "cook_food",
            "hot_hold_food",
            "cool_food",
            "reheat_food",
            "serve_cold_food"
        ],

        ingredients: [
            "raw_meat",
            "dairy",
            "vegetables",
            "frozen_goods",
            "pasteurized_eggs"
        ],

        serviceTypes: [
            "takeaway",
            "direct_serving"
        ],

        specialConditions: [
            "handles_allergens",
            "transport_food"
        ],

        equipmentCounts: {
            fridge: 2,
            freezer: 1,
            dishwasher: 1,
            warming_cabinet: 1
        },

        createdBy: "user_michael"
    }
};

const EQUIPMENT_TEMPLATES = {
    fridge: {
        label: "Køleskab",
        requiresTemperatureControl: true,
        requiresCleaning: true,
        requiresMaintenance: false
    },
    freezer: {
        label: "Fryser",
        requiresTemperatureControl: true,
        requiresCleaning: true,
        requiresMaintenance: false
    },
    display_fridge: {
        label: "Displaykøleskab",
        requiresTemperatureControl: true,
        requiresCleaning: true,
        requiresMaintenance: false
    },
    dishwasher: {
        label: "Opvaskemaskine",
        requiresTemperatureControl: false,
        requiresCleaning: true,
        requiresMaintenance: true
    },
    softice_machine: {
        label: "Softice maskine",
        requiresTemperatureControl: true,
        requiresCleaning: true,
        requiresMaintenance: true
    },
    slicer: {
        label: "Slicer",
        requiresTemperatureControl: false,
        requiresCleaning: true,
        requiresMaintenance: true
    },
    fryer: {
        label: "Friture",
        requiresTemperatureControl: false,
        requiresCleaning: true,
        requiresMaintenance: true
    },
    warming_cabinet: {
        label: "Varmeskab",
        requiresTemperatureControl: true,
        requiresCleaning: true,
        requiresMaintenance: false
    },
    blast_chiller: {
        label: "Nedkølingsskab",
        requiresTemperatureControl: true,
        requiresCleaning: true,
        requiresMaintenance: true
    }
};

const RISK_RULES = [
    {
        key: "rule_store_chilled_goods",
        processKey: "store_chilled_goods",
        riskId: "risk_store_chilled_goods",
        data: {
            category: "microbiological",
            hazardType: "bacterial_growth",
            title: "For høj temperatur ved køleopbevaring",
            description: "Der er risiko for bakterievækst hvis kølevarer opbevares ved for høj temperatur.",
            processKey: "store_chilled_goods",
            linkedEquipmentTypes: ["fridge", "display_fridge"],
            controlType: "temperature_check",
            isCCP: true,
            limitMin: null,
            limitMax: 5,
            limitUnit: "C"
        }
    },
    {
        key: "rule_store_frozen_goods",
        processKey: "store_frozen_goods",
        riskId: "risk_store_frozen_goods",
        data: {
            category: "microbiological",
            hazardType: "temperature_failure",
            title: "For høj temperatur ved frostopbevaring",
            description: "Der er risiko for kvalitetsforringelse hvis frostvarer opbevares ved for høj temperatur.",
            processKey: "store_frozen_goods",
            linkedEquipmentTypes: ["freezer"],
            controlType: "temperature_check",
            isCCP: true,
            limitMin: null,
            limitMax: -18,
            limitUnit: "C"
        }
    },
    {
        key: "rule_reheat_food",
        processKey: "reheat_food",
        riskId: "risk_reheat_food",
        data: {
            category: "microbiological",
            hazardType: "insufficient_reheating",
            title: "Utilstrækkelig genopvarmning",
            description: "Der er risiko for overlevelse af bakterier hvis mad ikke genopvarmes tilstrækkeligt.",
            processKey: "reheat_food",
            linkedEquipmentTypes: [],
            controlType: "temperature_check",
            isCCP: true,
            limitMin: 75,
            limitMax: null,
            limitUnit: "C"
        }
    },
    {
        key: "rule_hot_hold_food",
        processKey: "hot_hold_food",
        riskId: "risk_hot_hold_food",
        data: {
            category: "microbiological",
            hazardType: "unsafe_hot_holding",
            title: "Utilstrækkelig varmholdelse",
            description: "Der er risiko for bakterievækst hvis varm mad ikke holdes ved korrekt temperatur.",
            processKey: "hot_hold_food",
            linkedEquipmentTypes: ["warming_cabinet"],
            controlType: "temperature_check",
            isCCP: true,
            limitMin: 65,
            limitMax: null,
            limitUnit: "C"
        }
    },
    {
        key: "rule_cool_food",
        processKey: "cool_food",
        riskId: "risk_cool_food",
        data: {
            category: "microbiological",
            hazardType: "unsafe_cooling",
            title: "Utilstrækkelig nedkøling",
            description: "Der er risiko for bakterievækst hvis varm mad ikke nedkøles korrekt.",
            processKey: "cool_food",
            linkedEquipmentTypes: ["blast_chiller"],
            controlType: "temperature_check",
            isCCP: true,
            limitMin: null,
            limitMax: 10,
            limitUnit: "C"
        }
    }
];

function nowFields() {
    return {
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };
}

function buildCompanyDoc(company) {
    return {
        id: company.id,
        data: {
            name: company.name,
            ownerName: company.ownerName,
            plan: company.plan,
            isActive: true,
            ...nowFields()
        }
    };
}

function buildLocationDoc(location) {
    return {
        id: location.id,
        data: {
            companyId: location.companyId,
            name: location.name,
            type: location.type,
            city: location.city || "",
            isActive: true,
            ...nowFields()
        }
    };
}

function buildUserDoc(user) {
    return {
        id: user.id,
        data: {
            companyId: user.companyId,
            locationIds: user.locationIds || [],
            name: user.name,
            role: user.role || "owner",
            isActive: true,
            ...nowFields()
        }
    };
}

function buildOnboardingDoc(onboarding) {
    return {
        id: onboarding.id,
        data: {
            companyId: onboarding.companyId,
            locationId: onboarding.locationId,
            businessTypes: onboarding.businessTypes || [],
            processes: onboarding.processes || [],
            ingredients: onboarding.ingredients || [],
            serviceTypes: onboarding.serviceTypes || [],
            specialConditions: onboarding.specialConditions || [],
            equipmentCounts: onboarding.equipmentCounts || {},
            createdBy: onboarding.createdBy || "",
            ...nowFields()
        }
    };
}

function buildEquipmentFromCounts({ companyId, locationId, equipmentCounts }) {
    const docs = [];

    Object.entries(equipmentCounts || {}).forEach(([type, count]) => {
        const template = EQUIPMENT_TEMPLATES[type];
        if (!template || !count || count < 1) return;

        for (let i = 1; i <= count; i += 1) {
            const id = `eq_${type}_${i}`;

            docs.push({
                id,
                data: {
                    companyId,
                    locationId,
                    type,
                    name: `${template.label} ${i}`,
                    displayName: `${template.label} ${i}`,
                    zone: "",
                    sortOrder: i,
                    requiresTemperatureControl: template.requiresTemperatureControl,
                    requiresCleaning: template.requiresCleaning,
                    requiresMaintenance: template.requiresMaintenance,
                    isActive: true,
                    createdFromOnboarding: true,
                    ...nowFields()
                }
            });
        }
    });

    return docs;
}

function buildRisksFromOnboarding({ companyId, locationId, processes }) {
    return RISK_RULES
        .filter((rule) => (processes || []).includes(rule.processKey))
        .map((rule) => ({
            id: rule.riskId,
            data: {
                companyId,
                locationId,
                category: rule.data.category,
                hazardType: rule.data.hazardType,
                title: rule.data.title,
                description: rule.data.description,
                processKey: rule.data.processKey,
                linkedEquipmentTypes: rule.data.linkedEquipmentTypes,
                controlType: rule.data.controlType,
                isCCP: rule.data.isCCP,
                limitMin: rule.data.limitMin,
                limitMax: rule.data.limitMax,
                limitUnit: rule.data.limitUnit,
                sourceRule: rule.key,
                isActive: true,
                ...nowFields()
            }
        }));
}

function buildTasksFromRisksAndEquipment({ companyId, locationId, risks, equipment }) {
    const tasks = [];

    risks.forEach((risk) => {
        const riskId = risk.id;
        const riskData = risk.data;

        if (riskData.controlType === "temperature_check" && Array.isArray(riskData.linkedEquipmentTypes) && riskData.linkedEquipmentTypes.length > 0) {
            const matchingEquipment = equipment.filter((item) =>
                riskData.linkedEquipmentTypes.includes(item.data.type)
            );

            matchingEquipment.forEach((item) => {
                const isFreezer = item.data.type === "freezer";
                const isWarmHolding = item.data.type === "warming_cabinet";

                const taskId = `task_${item.id}_temperature_daily`;

                tasks.push({
                    id: taskId,
                    data: {
                        companyId,
                        locationId,
                        type: "temperature_check",
                        category: "egenkontrol",
                        title: isFreezer
                            ? "Frysertemperatur"
                            : isWarmHolding
                                ? "Varmholdelse"
                                : "Temperaturkontrol",
                        description: "Kontroller at temperaturen er inden for grænseværdien.",
                        equipmentId: item.id,
                        equipmentType: item.data.type,
                        equipmentName: item.data.displayName || item.data.name,
                        frequency: "daily",
                        requiresMeasurement: true,
                        measurementUnit: riskData.limitUnit || "C",
                        minValue: riskData.limitMin ?? null,
                        maxValue: riskData.limitMax ?? null,
                        linkedRiskIds: [riskId],
                        createsAlertOnFailure: true,
                        alertTypeOnFailure: isFreezer
                            ? "freezer_temperature_out_of_range"
                            : isWarmHolding
                                ? "hot_holding_temperature_out_of_range"
                                : "temperature_out_of_range",
                        alertSeverityOnFailure: "high",
                        isActive: true,
                        ...nowFields()
                    }
                });
            });
        }

        if (riskId === "risk_reheat_food") {
            tasks.push({
                id: "task_reheat_food_daily",
                data: {
                    companyId,
                    locationId,
                    type: "process_temperature_check",
                    category: "egenkontrol",
                    title: "Genopvarmning",
                    description: "Kontroller at genopvarmet mad når korrekt kernetemperatur.",
                    equipmentId: "",
                    equipmentType: "",
                    equipmentName: "",
                    frequency: "daily",
                    requiresMeasurement: true,
                    measurementUnit: "C",
                    minValue: 75,
                    maxValue: null,
                    linkedRiskIds: [riskId],
                    createsAlertOnFailure: true,
                    alertTypeOnFailure: "reheat_temperature_too_low",
                    alertSeverityOnFailure: "high",
                    isActive: true,
                    ...nowFields()
                }
            });
        }

        if (riskId === "risk_cool_food") {
            tasks.push({
                id: "task_cool_food_daily",
                data: {
                    companyId,
                    locationId,
                    type: "process_temperature_check",
                    category: "egenkontrol",
                    title: "Nedkøling",
                    description: "Kontroller at nedkøling udføres korrekt efter proceduren.",
                    equipmentId: "",
                    equipmentType: "",
                    equipmentName: "",
                    frequency: "daily",
                    requiresMeasurement: true,
                    measurementUnit: "C",
                    minValue: null,
                    maxValue: 10,
                    linkedRiskIds: [riskId],
                    createsAlertOnFailure: true,
                    alertTypeOnFailure: "cooling_not_completed_correctly",
                    alertSeverityOnFailure: "high",
                    isActive: true,
                    ...nowFields()
                }
            });
        }
    });

    equipment.forEach((item) => {
        if (item.data.requiresCleaning) {
            const cleaningTaskId = `task_${item.id}_cleaning_weekly`;

            const alreadyExists = tasks.some((task) => task.id === cleaningTaskId);
            if (!alreadyExists) {
                tasks.push({
                    id: cleaningTaskId,
                    data: {
                        companyId,
                        locationId,
                        type: "cleaning_check",
                        category: "rengøring",
                        title: `Rengøring af ${item.data.displayName || item.data.name}`,
                        description: "Kontroller og udfør rengøring efter gældende procedure.",
                        equipmentId: item.id,
                        equipmentType: item.data.type,
                        equipmentName: item.data.displayName || item.data.name,
                        frequency: "weekly",
                        requiresMeasurement: false,
                        measurementUnit: "",
                        minValue: null,
                        maxValue: null,
                        linkedRiskIds: [],
                        createsAlertOnFailure: true,
                        alertTypeOnFailure: "cleaning_required",
                        alertSeverityOnFailure: "medium",
                        isActive: true,
                        ...nowFields()
                    }
                });
            }
        }
    });

    return tasks;
}

async function deleteCollectionDocsByField(collectionName, field, value) {
    const snapshot = await db.collection(collectionName).where(field, "==", value).get();
    if (snapshot.empty) return 0;

    let batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((docSnap, index) => {
        batch.delete(docSnap.ref);
        count += 1;

        if ((index + 1) % 400 === 0) {
            batch.commit();
            batch = db.batch();
        }
    });

    await batch.commit();
    return count;
}

async function upsertDoc(collectionName, docConfig) {
    await db.collection(collectionName).doc(docConfig.id).set(docConfig.data, { merge: true });
}

async function generateBusinessSetup() {
    const companyDoc = buildCompanyDoc(SETUP.company);
    const locationDoc = buildLocationDoc(SETUP.location);
    const userDoc = buildUserDoc(SETUP.user);
    const onboardingDoc = buildOnboardingDoc(SETUP.onboarding);

    const equipmentDocs = buildEquipmentFromCounts({
        companyId: SETUP.onboarding.companyId,
        locationId: SETUP.onboarding.locationId,
        equipmentCounts: SETUP.onboarding.equipmentCounts
    });

    const riskDocs = buildRisksFromOnboarding({
        companyId: SETUP.onboarding.companyId,
        locationId: SETUP.onboarding.locationId,
        processes: SETUP.onboarding.processes
    });

    const taskDocs = buildTasksFromRisksAndEquipment({
        companyId: SETUP.onboarding.companyId,
        locationId: SETUP.onboarding.locationId,
        risks: riskDocs,
        equipment: equipmentDocs
    });

    console.log("Starter automatisk opsætning...");
    console.log("");

    console.log("Opretter grunddata...");
    await upsertDoc("companies", companyDoc);
    await upsertDoc("locations", locationDoc);
    await upsertDoc("users", userDoc);
    await upsertDoc("onboarding_answers", onboardingDoc);

    console.log("Rydder gamle auto-genererede docs for location...");
    const deletedEquipment = await deleteCollectionDocsByField("equipment", "locationId", SETUP.location.id);
    const deletedRisks = await deleteCollectionDocsByField("risks", "locationId", SETUP.location.id);
    const deletedTasks = await deleteCollectionDocsByField("tasks", "locationId", SETUP.location.id);

    console.log(`Slettet equipment: ${deletedEquipment}`);
    console.log(`Slettet risks: ${deletedRisks}`);
    console.log(`Slettet tasks: ${deletedTasks}`);
    console.log("");

    console.log("Opretter equipment...");
    for (const item of equipmentDocs) {
        await upsertDoc("equipment", item);
        console.log(`Oprettet equipment: ${item.id}`);
    }

    console.log("");
    console.log("Opretter risks...");
    for (const item of riskDocs) {
        await upsertDoc("risks", item);
        console.log(`Oprettet risk: ${item.id}`);
    }

    console.log("");
    console.log("Opretter tasks...");
    for (const item of taskDocs) {
        await upsertDoc("tasks", item);
        console.log(`Oprettet task: ${item.id}`);
    }

    console.log("");
    console.log("FÆRDIG");
    console.log(`Company: ${companyDoc.id}`);
    console.log(`Location: ${locationDoc.id}`);
    console.log(`User: ${userDoc.id}`);
    console.log(`Onboarding: ${onboardingDoc.id}`);
    console.log(`Equipment oprettet: ${equipmentDocs.length}`);
    console.log(`Risks oprettet: ${riskDocs.length}`);
    console.log(`Tasks oprettet: ${taskDocs.length}`);
}

generateBusinessSetup().catch((error) => {
    console.error("Fejl i generateBusinessSetup:", error);
    process.exit(1);
});