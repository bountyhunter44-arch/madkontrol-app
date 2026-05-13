const admin = require("firebase-admin");
const path = require("path");
const { mapCategoryToGuideKey, mapCategoryToTaskType } = require("../guideLibrary");

if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .trim();
}

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/æ/g, "ae")
        .replace(/ø/g, "oe")
        .replace(/å/g, "aa")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function dedupeKey(locationId, sourceRiskAnalysisId, category, name) {
    return `${locationId}__${sourceRiskAnalysisId}__${category}__${slugify(name)}`;
}

function inferAggregatedCategory(risk) {
    // Direkte processKey-routing før tekst-matching (deterministisk, fejlsikker)
    const processKey = normalizeText(risk.processKey || risk.process || "");
    if (processKey === "cool_food")              return "cooling_process";
    if (processKey === "reheat_food")            return "reheating_process";
    if (processKey === "hot_hold_food")          return "hot_holding";
    if (processKey === "cook_food")              return "cooking_control";
    if (processKey === "receive_chilled_goods" || processKey === "receive_frozen_goods" || processKey === "receive_room_temp_goods") return "receiving_control";
    if (processKey === "store_chilled_goods" || processKey === "serve_cold_food")  return "temperature_cooling";
    if (processKey === "store_frozen_goods")     return "temperature_freezing";
    if (processKey === "allergen_management")    return "allergen_control";
    if (processKey === "transport_food")         return "receiving_control";

    // Fallback: tekst-baseret matching på de korrekte feltnavne
    const process = normalizeText(risk.processKey || risk.process || "");
    const hazard = normalizeText(risk.hazardType || risk.hazard || "");
    const controlType = normalizeText(risk.controlType || "");
    const name = normalizeText(risk.title || risk.name || "");

    const combined = `${process} ${hazard} ${controlType} ${name}`;

    // Ismaskiner og softice (kritisk, separat kategori)
    if (
        combined.includes("ismaskine") ||
        combined.includes("ice machine") ||
        combined.includes("softice") ||
        combined.includes("soft ice")
    ) {
        return "ice_equipment_critical";
    }

    // Friture (kritisk, separat kategori)
    if (
        combined.includes("friture") ||
        combined.includes("fryer") ||
        combined.includes("frityr")
    ) {
        return "fryer_critical";
    }

    // Temperaturkontrol - Køl
    if (
        (controlType.includes("temperature") || combined.includes("temperatur")) &&
        (combined.includes("køl") || combined.includes("koel") || combined.includes("fridge") || combined.includes("cooler"))
    ) {
        return "temperature_cooling";
    }

    // Temperaturkontrol - Frost
    if (
        (controlType.includes("temperature") || combined.includes("temperatur")) &&
        (combined.includes("frys") || combined.includes("freezer") || combined.includes("frost"))
    ) {
        return "temperature_freezing";
    }

    // Temperaturkontrol - Varmholdelse
    if (
        (controlType.includes("temperature") || combined.includes("temperatur")) &&
        (combined.includes("varm") || combined.includes("hot") || combined.includes("ovn") || combined.includes("oven") || combined.includes("warmer"))
    ) {
        return "temperature_heating";
    }

    // Modtagekontrol (aggregeret)
    if (
        combined.includes("modtag") ||
        combined.includes("varemodtag") ||
        combined.includes("levering") ||
        combined.includes("delivery") ||
        combined.includes("receiving")
    ) {
        return "receiving_control";
    }

    // Afløb (separat fra rengøring)
    if (
        combined.includes("afløb") ||
        combined.includes("aflob") ||
        combined.includes("drain") ||
        combined.includes("kloakrist")
    ) {
        return "drain_maintenance";
    }

    // Udstyrsvedligeholdelse (equipment maintenance and hygiene)
    if (
        (combined.includes("udstyr") || combined.includes("equipment")) &&
        (combined.includes("vedligeholdelse") || combined.includes("maintenance") || 
         combined.includes("forurening") || combined.includes("contamination") ||
         combined.includes("defekt") || combined.includes("slitage"))
    ) {
        return "equipment_maintenance";
    }

    // REMOVED: equipment_cleaning aggregation
    // Equipment-specific cleaning templates are created per physical unit
    // by syncEquipmentCleaningTemplates() in functions/index.js
    // This prevents duplicate cleaning routines for the same equipment

    // Rengøringskontrol af områder
    if (
        combined.includes("rengøring") ||
        combined.includes("rengoering") ||
        combined.includes("renhold") ||
        combined.includes("hygiejne") ||
        combined.includes("clean")
    ) {
        return "area_cleaning";
    }

    // Allergenkontrol (aggregeret)
    if (
        combined.includes("allergen") ||
        combined.includes("allergener") ||
        combined.includes("allergy")
    ) {
        return "allergen_control";
    }

    // Personale hygiejne (aggregeret)
    if (
        combined.includes("håndvask") ||
        combined.includes("handvask") ||
        combined.includes("personale") ||
        combined.includes("uniform") ||
        combined.includes("staff")
    ) {
        return "staff_hygiene";
    }

    // Lukkerutine (aggregeret)
    if (
        combined.includes("luk") ||
        combined.includes("slut") ||
        combined.includes("closing") ||
        combined.includes("end of day")
    ) {
        return "closing_routine";
    }

    // Bygningsmæssig tilstand (periodisk)
    if (
        combined.includes("gulv") ||
        combined.includes("væg") ||
        combined.includes("loft") ||
        combined.includes("floor") ||
        combined.includes("wall") ||
        combined.includes("ceiling") ||
        (combined.includes("bygning") && combined.includes("tilstand"))
    ) {
        return "building_condition";
    }

    // Skadedyrssikring (periodisk)
    if (
        combined.includes("skadedyr") ||
        combined.includes("pest") ||
        combined.includes("insekt") ||
        combined.includes("flue") ||
        combined.includes("mus") ||
        combined.includes("rotte")
    ) {
        return "pest_control";
    }

    // Verification tasks (ikke daglige)
    if (
        combined.includes("verifi") ||
        combined.includes("dokument") ||
        combined.includes("leverandør") ||
        combined.includes("supplier") ||
        combined.includes("registrering") ||
        combined.includes("plan")
    ) {
        return "verification";
    }

    return "general_checklist";
}

function inferTemplateType(aggregatedCategory) {
    // Verification tasks er ikke daglige rutiner
    if (aggregatedCategory === "verification" || 
        aggregatedCategory === "building_condition" || 
        aggregatedCategory === "pest_control") {
        return "verification";
    }
    
    // Process tasks (per_batch/continuous) - vises kun når aktive
    if (aggregatedCategory === "cooling_process" || 
        aggregatedCategory === "reheating_process" || 
        aggregatedCategory === "cooking_control" ||
        aggregatedCategory === "hot_holding") {
        return "process";
    }
    
    // Alle andre er operational (daglige)
    return "operational";
}

function inferAggregatedTemplateName(aggregatedCategory) {
    switch (aggregatedCategory) {
        case "temperature_cooling":
            return "Temperaturkontrol af køl";
        case "temperature_freezing":
            return "Temperaturkontrol af frost";
        case "temperature_heating":
            return "Kontrol af varmholdelse og varmeudstyr";
        case "fryer_critical":
            return "Kontrol af friture";
        case "ice_equipment_critical":
            return "Kontrol af ismaskiner og softice";
        case "receiving_control":
            return "Modtagekontrol af varer";
        case "equipment_maintenance":
            return "Kontrol af udstyrsvedligeholdelse";
        case "equipment_cleaning":
            return "Rengøring og vedligehold af udstyr";
        case "area_cleaning":
            return "Rengøringskontrol af områder";
        case "drain_maintenance":
            return "Kontrol og rengøring af afløb";
        case "allergen_control":
            return "Kontrol af allergenhåndtering";
        case "staff_hygiene":
            return "Personale hygiejne";
        case "closing_routine":
            return "Lukkerutine";
        case "building_condition":
            return "Kontrol af bygningsmæssig tilstand";
        case "pest_control":
            return "Kontrol af skadedyrssikring";
        case "verification":
            return "Verifikation og dokumentation";
        case "cooling_process":
            return "Nedkøling af varme retter";
        case "reheating_process":
            return "Genopvarmning af retter";
        case "hot_holding":
            return "Varmholdelse af retter";
        case "cooking_control":
            return "Varmebehandling af retter";
        case "general_checklist":
            return "Generel egenkontrol";
        default:
            return "Egenkontrol opgave";
    }
}

function inferAggregatedDescription(aggregatedCategory, risks) {
    switch (aggregatedCategory) {
        case "temperature_cooling":
            return "Kontroller temperatur for alle køleenheder. Inkluderer køleskabe, kølediske og walk-in kølere.";
        case "temperature_freezing":
            return "Kontroller temperatur for alle fryseenheder. Inkluderer frysere og walk-in frysere.";
        case "temperature_heating":
            return "Kontroller temperatur for varmholdelse og varmeudstyr. Inkluderer ovne, varmeskabe og bain marie.";
        case "fryer_critical":
            return "Daglig kontrol af friture temperatur og olie kvalitet. Max temperatur 175°C for pommes frites. Tjek olie farve, lugt og renhed.";
        case "ice_equipment_critical":
            return "Kontrol af ismaskiner og softice udstyr. Kritisk temperaturkontrol og rengøring.";
        case "receiving_control":
            return "Kontroller alle modtagne varer ved levering. Tjek temperatur, emballage, holdbarhed, kvalitet og dokumentation.";
        case "equipment_maintenance":
            return "Ugentlig kontrol af udstyrsvedligeholdelse og hygiejne. Inspicer udstyr for skader, defekter og forurening. Sikrer korrekt vedligeholdelse for at forhindre bakterievækst.";
        case "equipment_cleaning":
            return "Rengøring og vedligehold af udstyr. Tjek at udstyr er rengjort korrekt og fungerer optimalt.";
        case "area_cleaning":
            return "Bekræft at rengøring er udført korrekt i alle områder. Tjek køkkener, produktionsområder, opbevaringsrum og sanitære faciliteter.";
        case "drain_maintenance":
            return "Daglig kontrol og rengøring af afløb. Sikrer hygiejne og forebygger lugt og tilstopning.";
        case "allergen_control":
            return "Kontroller korrekt håndtering og mærkning af allergener. Tjek opbevaring, krydskontaminering og information til gæster.";
        case "staff_hygiene":
            return "Kontroller personale hygiejne og arbejdspraksis. Inkluderer håndvask, uniformer, smykker og generel hygiejneadfærd.";
        case "closing_routine":
            return "Gennemfør lukkerutine for lokationen. Tjek at alle kritiske kontroller er udført, udstyr er slukket og området er sikret.";
        case "building_condition":
            return "Månedlig kontrol af bygningsmæssig tilstand. Tjek at gulve, vægge og lofter er intakte, vaskbare og tætte mod skadedyr.";
        case "pest_control":
            return "Ugentlig kontrol af skadedyrssikring. Tjek døre, vinduer, åbninger og affaldsområder for at forebygge skadedyr.";
        case "verification":
            return "Verifikation af dokumentation, registreringer og procedurer. Gennemgås periodisk af ansvarlig.";
        case "cooling_process":
            return "Nedkøling af varme retter fra min. 56°C til 10°C inden for max 4 timer. Ved fejl: genopvarm til 75°C og start ny nedkøling, eller kassér.";
        case "reheating_process":
            return "Genopvarmning af retter til min. 75°C i hele fødevaren. Mål temperatur i centrum. Efter genopvarmning kan ny nedkøling startes.";
        case "hot_holding":
            return "Varmholdelse af retter ved min. 56°C. Ingen fast tidsgrænse i standardreglen.";        case "cooking_control":
            return "Varmebehandling af retter til min. 75\u00b0C i centret. M\u00e5l temperatur i centrum af den tykkeste del. For fjerkr\u00e6 skal hele retten n\u00e5 75\u00b0C.";        case "general_checklist":
            return "Generel egenkontrol af arbejdsgange og procedurer.";
        default:
            return "Udfør kontrol af relevante arbejdsgange.";
    }
}

function inferAggregatedFrequency(aggregatedCategory) {
    switch (aggregatedCategory) {
        case "temperature_cooling":
        case "temperature_freezing":
        case "ice_equipment_critical":
            return "twice_daily";
        case "temperature_heating":
        case "fryer_critical":
        case "equipment_cleaning":
        case "area_cleaning":
        case "drain_maintenance":
        case "allergen_control":
        case "staff_hygiene":
        case "general_checklist":
            return "daily";
        case "equipment_maintenance":
            return "weekly";
        case "receiving_control":
            return "per_delivery";
        case "closing_routine":
            return "closing";
        case "building_condition":
            return "monthly";
        case "pest_control":
        case "verification":
            return "weekly";
        case "cooling_process":
        case "reheating_process":
            return "per_batch";
        case "cooking_control":
            return "per_batch";
        case "hot_holding":
            return "continuous";
        default:
            return "daily";
    }
}

function inferAggregatedControlType(aggregatedCategory) {
    switch (aggregatedCategory) {
        case "temperature_cooling":
        case "temperature_freezing":
        case "temperature_heating":
        case "hot_holding":
            return "temperature";
        case "fryer_critical":
            return "temperature_with_checklist";
        case "ice_equipment_critical":
            return "temperature_with_checklist";
        case "cooling_process":
            return "cooling_process";
        case "reheating_process":
            return "reheating_process";
        case "cooking_control":
            return "cooking_process";
        default:
            return "checklist";
    }
}

function inferAggregatedUnit(aggregatedCategory) {
    if (aggregatedCategory.includes("temperature") || 
        aggregatedCategory === "fryer_critical" || 
        aggregatedCategory === "ice_equipment_critical" ||
        aggregatedCategory === "hot_holding" ||
        aggregatedCategory === "cooling_process" ||
        aggregatedCategory === "reheating_process" ||
        aggregatedCategory === "cooking_control") {
        return "°C";
    }
    return "";
}

function inferAggregatedLimits(aggregatedCategory) {
    switch (aggregatedCategory) {
        case "temperature_cooling":
            return { limitMin: null, limitMax: 5 };
        case "temperature_freezing":
        case "ice_equipment_critical":
            return { limitMin: null, limitMax: -18 };
        case "temperature_heating":
        case "hot_holding":
            return { limitMin: 56, limitMax: null };
        case "fryer_critical":
            return { limitMin: null, limitMax: 175 };
        case "cooling_process":
            return { limitMin: null, limitMax: 10, startTempMin: 56, maxDurationHours: 4 };
        case "reheating_process":
            return { limitMin: 75, limitMax: null };
        case "cooking_control":
            return { limitMin: 75, limitMax: null };
        default:
            return { limitMin: null, limitMax: null };
    }
}

function inferAggregatedCorrectiveAction(aggregatedCategory) {
    switch (aggregatedCategory) {
        case "temperature_cooling":
        case "temperature_freezing":
        case "temperature_heating":
            return "Undersøg årsag, flyt varer ved behov, juster udstyr og kontakt ansvarlig hvis grænse overskrides.";
        case "fryer_critical":
            return "Ved temperatur over 175°C: reducer varme øjeblikkeligt, dokumenter afvigelse. Ved dårlig olie kvalitet: skift olie og rengør friture.";
        case "ice_equipment_critical":
            return "Ved temperatur over -18°C: tjek udstyr, flyt varer ved behov. Ved rengøringsproblemer: rengør grundigt og dokumenter.";
        case "receiving_control":
            return "Afvis varer der ikke opfylder krav, noter afvigelse og kontakt leverandør.";
        case "equipment_maintenance":
            return "Ved defekt eller forurening: tag udstyr ud af drift, rengør grundigt eller bestil service. Dokumenter handling og informer ansvarlig.";
        case "equipment_cleaning":
        case "area_cleaning":
            return "Udfør rengøring igen, dokumenter handling og informer ansvarlig.";
        case "drain_maintenance":
            return "Rens afløb grundigt, fjern affald og kontakt VVS ved vedvarende problemer.";
        case "allergen_control":
            return "Ret fejl i mærkning/opbevaring, informer personale og dokumenter handling.";
        case "staff_hygiene":
            return "Instruer personale i korrekt praksis, dokumenter handling og følg op.";
        case "closing_routine":
            return "Fuldfør manglende lukkeopgaver og dokumenter afvigelsen før stedet forlades.";
        case "building_condition":
            return "Dokumenter skader, planlæg reparation og informer ansvarlig. Ved alvorlige skader: iværksæt øjeblikkelig handling.";
        case "pest_control":
            return "Ved tegn på skadedyr: kontakt skadedyrsbekæmpelse, dokumenter fund og iværksæt øjeblikkelige tiltag.";
        case "verification":
            return "Ret mangler i dokumentation og informer ansvarlig.";
        case "cooling_process":
            return "Ved overskridelse: 1) Genopvarm straks til 75°C og start ny nedkøling, eller 2) Kassér varen.";
        case "reheating_process":
            return "Ved temperatur under 75°C: fortsæt opvarmning til 75°C nås, eller kassér varen.";
        case "hot_holding":
            return "Ved temperatur under 56°C: øg varme eller kassér varen.";
        case "general_checklist":
        default:
            return "Følg virksomhedens korrigerende handling og dokumenter resultatet.";
    }
}

function inferAggregatedRequirements(aggregatedCategory) {
    switch (aggregatedCategory) {
        case "receiving_control":
        case "allergen_control":
            return { requiresPhoto: false, requiresNote: true };
        default:
            return { requiresPhoto: false, requiresNote: false };
    }
}

function buildAggregatedTemplate({ companyId, locationId, aggregatedCategory, risks }) {
    // Byg ÉT aggregeret template fra flere risk control points
    const name = inferAggregatedTemplateName(aggregatedCategory);
    const description = inferAggregatedDescription(aggregatedCategory, risks);
    const frequency = inferAggregatedFrequency(aggregatedCategory);
    const controlType = inferAggregatedControlType(aggregatedCategory);
    const unit = inferAggregatedUnit(aggregatedCategory);
    const { limitMin, limitMax } = inferAggregatedLimits(aggregatedCategory);
    const correctiveAction = inferAggregatedCorrectiveAction(aggregatedCategory);
    const { requiresPhoto, requiresNote } = inferAggregatedRequirements(aggregatedCategory);
    const templateType = inferTemplateType(aggregatedCategory);
    
    // NEW: Map to stable taskType and guideKey
    const taskType = mapCategoryToTaskType(aggregatedCategory);
    const guideKey = mapCategoryToGuideKey(aggregatedCategory);
    const guideVersion = "1.0";
    
    // Validate guideKey exists
    if (!guideKey) {
        console.error("❌ Cannot map category to guideKey", {
            aggregatedCategory,
            locationId,
            riskCount: risks.length,
            sourceProcesses: [...new Set(risks.map(r => r.data.process || "").filter(Boolean))].join("; ")
        });
    }

    // Deterministic mapping: controlType = guideKey
    const controlTypeMapped = guideKey;

    // Samlet source info fra alle risks i gruppen
    const sourceRiskIds = risks.map(r => r.id).join(",");
    const sourceProcesses = [...new Set(risks.map(r => r.data.process || "").filter(Boolean))].join("; ");
    const sourceHazards = [...new Set(risks.map(r => r.data.hazard || "").filter(Boolean))].join("; ");

    const TEMP_CONTROL_TYPES = new Set([
        "temperature", "cooking_process", "cooling_process", "reheating_process",
        "hot_holding_control", "freezer_temperature", "cooking_control"
    ]);
    const requiresMeasurement = TEMP_CONTROL_TYPES.has(controlType) || TEMP_CONTROL_TYPES.has(guideKey);
    const formType = requiresMeasurement ? "temperature" : "check";
    const measurementUnit = unit || (requiresMeasurement ? "°C" : "");

    return {
        dedupeKey: `${locationId}__aggregated__${aggregatedCategory}`,
        payload: {
            companyId,
            locationId,
            sourceRiskIds,
            aggregatedCategory,
            category: aggregatedCategory,
            taskType,
            guideKey,
            guideVersion,
            name,
            title: name,
            description,
            controlType,
            frequency,
            limitMin,
            limitMax,
            unit,
            measurementUnit,
            requiresMeasurement,
            formType,
            correctiveAction,
            requiresPhoto,
            requiresNote,
            templateType: "operational",
            type: "operational",
            templateSource: "risk_analysis",
            isAggregated: true,
            isActive: true,
            active: true,
            sourceProcesses,
            sourceHazards,
            riskCount: risks.length,
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp()
        }
    };
}

async function getExistingTemplatesByKeys(keys, dbRef = db) {
    const found = new Map();

    if (!keys.length) return found;

    const chunks = [];
    for (let i = 0; i < keys.length; i += 10) {
        chunks.push(keys.slice(i, i + 10));
    }

    for (const chunk of chunks) {
        const snap = await dbRef
            .collection("task_templates")
            .where("dedupeKey", "in", chunk)
            .get();

        snap.forEach((doc) => {
            found.set(doc.get("dedupeKey"), {
                id: doc.id,
                data: doc.data()
            });
        });
    }

    return found;
}

async function generateEgenkontrolFromRiskAnalysis({ companyId = null, locationId = null, db: dbOverride = null } = {}) {
    const dbRef = dbOverride || db;
    let query = dbRef.collection("risks");

    if (companyId) {
    query = query.where("companyId", "==", companyId);
}

if (locationId) {
    query = query.where("locationId", "==", locationId);
}

    const riskSnap = await query.get();

    console.log("Antal fundne risks i collection:", riskSnap.size);

    if (riskSnap.empty) {
        return {
            ok: true,
            message: "Ingen risks fundet. Kør generateRisksForLocation først.",
            created: 0,
            updated: 0,
            skipped: 0,
            totalFound: 0,
            totalActive: 0
        };
    }

    riskSnap.forEach((doc) => {
        console.log(`\n--- Risikoanalyse ${doc.id} ---`);
        console.log(JSON.stringify(doc.data(), null, 2));
    });

    const activeDocs = riskSnap.docs.filter((doc) => {
        const data = doc.data() || {};
        return data.isActive !== false;
    });

    console.log("Antal aktive risikoanalyser efter filter:", activeDocs.length);

    if (!activeDocs.length) {
        return {
            ok: true,
            message: "Risikoanalyser blev fundet, men alle har isActive=false.",
            created: 0,
            updated: 0,
            skipped: 0,
            totalFound: riskSnap.size,
            totalActive: 0
        };
    }

    // Gruppér risks efter locationId og aggregatedCategory
    const risksByLocationAndCategory = new Map();
    
    for (const doc of activeDocs) {
        try {
            const risk = doc.data();
            const riskId = doc.id;
            const locationId = risk.locationId;

            if (!locationId) {
                console.error(`risk_analyses/${riskId} mangler locationId`);
                continue;
            }

            const aggregatedCategory = inferAggregatedCategory(risk);
            // Brug ||| som separator så locationId med __ ikke splittes forkert
            const groupKey = `${locationId}|||${aggregatedCategory}`;

            if (!risksByLocationAndCategory.has(groupKey)) {
                risksByLocationAndCategory.set(groupKey, []);
            }

            risksByLocationAndCategory.get(groupKey).push({
                id: riskId,
                data: risk
            });
        } catch (error) {
            console.error(`Fejl i risk_analyses/${doc.id}:`, error.message);
        }
    }

    if (risksByLocationAndCategory.size === 0) {
        return {
            ok: false,
            message: "Ingen templates kunne bygges. Tjek især om locationId mangler på dokumenterne.",
            created: 0,
            updated: 0,
            skipped: 0,
            totalFound: riskSnap.size,
            totalActive: activeDocs.length
        };
    }

    // Byg aggregerede templates
    const templates = [];
    for (const [groupKey, risks] of risksByLocationAndCategory.entries()) {
        // Split på ||| så locationIds med __ ikke brydes forkert
        const pipeIdx = groupKey.indexOf("|||");
        const locId = groupKey.slice(0, pipeIdx);
        const aggregatedCategory = groupKey.slice(pipeIdx + 3);
       const effectiveCompanyId =
    companyId ||
    risks[0]?.data?.companyId ||
    risks[0]?.data?.organizationId ||
    null;

templates.push(buildAggregatedTemplate({
    companyId: effectiveCompanyId,
    locationId: locId,
    aggregatedCategory,
    risks
}));

    console.log(`\n🎯 AGGREGERING: ${activeDocs.length} risk control points → ${templates.length} aggregerede templates`);
    templates.forEach(t => {
        console.log(`  - ${t.payload.name} (${t.payload.riskCount} kontrolpunkter, ${t.payload.templateType})`);
    });

    const uniqueTemplates = new Map();
    for (const template of templates) {
        uniqueTemplates.set(template.dedupeKey, template);
    }

    const templateList = Array.from(uniqueTemplates.values());
    const keys = templateList.map((item) => item.dedupeKey);
    const existing = await getExistingTemplatesByKeys(keys, dbRef);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    const batch = dbRef.batch();

    for (const item of templateList) {
        const current = existing.get(item.dedupeKey);

        if (!current) {
            const ref = dbRef.collection("task_templates").doc();
            batch.set(ref, {
                ...item.payload,
                dedupeKey: item.dedupeKey
            });
            created++;
            continue;
        }

        const currentData = current.data || {};
        const nextData = {
            ...item.payload,
            dedupeKey: item.dedupeKey,
            createdAt: currentData.createdAt || FieldValue.serverTimestamp()
        };

        const comparableCurrent = JSON.stringify({
            locationId: currentData.locationId || null,
            sourceRiskAnalysisId: currentData.sourceRiskAnalysisId || null,
            category: currentData.category || "",
            name: currentData.name || "",
            description: currentData.description || "",
            controlType: currentData.controlType || "",
            frequency: currentData.frequency || "",
            limitMin: currentData.limitMin ?? null,
            limitMax: currentData.limitMax ?? null,
            unit: currentData.unit || "",
            correctiveAction: currentData.correctiveAction || "",
            requiresPhoto: !!currentData.requiresPhoto,
            requiresNote: !!currentData.requiresNote,
            isActive: currentData.isActive !== false,
            sourceProcess: currentData.sourceProcess || "",
            sourceHazard: currentData.sourceHazard || "",
            sourceControlType: currentData.sourceControlType || "",
            dedupeKey: currentData.dedupeKey || ""
        });

        const comparableNext = JSON.stringify({
            locationId: nextData.locationId || null,
            sourceRiskAnalysisId: nextData.sourceRiskAnalysisId || null,
            category: nextData.category || "",
            name: nextData.name || "",
            description: nextData.description || "",
            controlType: nextData.controlType || "",
            frequency: nextData.frequency || "",
            limitMin: nextData.limitMin ?? null,
            limitMax: nextData.limitMax ?? null,
            unit: nextData.unit || "",
            correctiveAction: nextData.correctiveAction || "",
            requiresPhoto: !!nextData.requiresPhoto,
            requiresNote: !!nextData.requiresNote,
            isActive: nextData.isActive !== false,
            sourceProcess: nextData.sourceProcess || "",
            sourceHazard: nextData.sourceHazard || "",
            sourceControlType: nextData.sourceControlType || "",
            dedupeKey: nextData.dedupeKey || ""
        });

        if (comparableCurrent === comparableNext) {
            skipped++;
            continue;
        }

        batch.set(
            dbRef.collection("task_templates").doc(current.id),
            nextData,
            { merge: true }
        );
        updated++;
    }

    if (created || updated) {
        await batch.commit();
    }

    return {
        ok: true,
        message: "Egenkontrolgenerator kørt.",
        created,
        updated,
        skipped,
        totalFound: riskSnap.size,
        totalActive: activeDocs.length,
        totalTemplates: templateList.length
    };
}

async function run() {
    try {
        const locationId = process.argv[2] || null;
        const result = await generateEgenkontrolFromRiskAnalysis({ locationId });
        console.log("\nResultat:");
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
    generateEgenkontrolFromRiskAnalysis
};}