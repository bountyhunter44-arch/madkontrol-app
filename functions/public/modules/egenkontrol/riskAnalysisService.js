import app, { db } from "/core/firebase-config.js";
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    getDoc,
    doc,
    setDoc,
    addDoc,
    serverTimestamp,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { buildRiskAnalysisFromOnboarding } from "./buildRiskAnalysisFromOnboarding.js";

// ---------------------------------------------------------------------------
// Internal: normalize onboarding state.data → buildRiskAnalysisFromOnboarding input
// ---------------------------------------------------------------------------

function mapProfileToOnboardingInput(profile = {}, { companyId, locationId } = {}) {
    // Support both English and Danish field names
    const fridgeCount = Math.max(
        0,
        Number(profile.fridgeCount || profile.antalKoeleskabe) || 0
    );
    const freezerCount = Math.max(
        0,
        Number(profile.freezerCount || profile.antalFrysere) || 0
    );

    return {
        companyId: companyId || profile.companyId || "",
        locationId: locationId || profile.locationId || "",
        companyName: profile.companyName || "",
        address: [profile.address, profile.zip, profile.city].filter(Boolean).join(", "),
        restaurantType: profile.companyType || profile.restaurantType || "restaurant",

        equipment: {
            fridges: Array.from({ length: fridgeCount }, (_, i) => ({ name: `Køleskab ${i + 1}` })),
            freezers: Array.from({ length: freezerCount }, (_, i) => ({ name: `Fryser ${i + 1}` })),
            iceMachines: [],
            dishwashers: []
        },

        processes: {
            receivingGoods: !!(
                profile.receivesChilledGoods ||
                profile.receivesFrozenGoods ||
                profile.receivesRoomTempGoods ||
                profile.modtagerKoelevarer ||
                profile.modtagerFrostvarer
            ),
            cooking: !!(profile.preparesHotFood || profile.tilberederVarmMad),
            heating: !!(
                profile.preparesHotFood ||
                profile.servesHotFood ||
                profile.tilberederVarmMad
            ),
            reheating: !!(profile.preparesHotFood || profile.tilberederVarmMad),
            cooling: !!(profile.coolsHotFood || profile.nedkoelerMad),
            hotHolding: !!(
                profile.holdsHotFood ||
                profile.hasHotHolding ||
                profile.varmholder
            ),
            saleWithoutCooling: false,
            separation: !!(profile.handlesDifferentFoods || fridgeCount > 0),
            dateControl: true,
            cleaningControl: true,
            coldPreparation: !!(
                profile.preparesColdFood ||
                profile.servesColdFood ||
                profile.servererKoldMad
            )
        }
    };
}

// ---------------------------------------------------------------------------
// Internal: Firestore scoped query variants
// ---------------------------------------------------------------------------

function buildScopeVariants(companyId, locationId) {
    const legacyCompany = companyId.replace(/_/g, "-");
    const legacyLocation = locationId.replace(/_/g, "-");

    return [
        { companyField: "companyId", companyValue: companyId, locationValue: locationId },
        { companyField: "companyId", companyValue: companyId, locationValue: legacyLocation },
        { companyField: "companyId", companyValue: legacyCompany, locationValue: locationId },
        { companyField: "organizationId", companyValue: companyId, locationValue: locationId },
        { companyField: "organizationId", companyValue: legacyCompany, locationValue: legacyLocation }
    ];
}

// ---------------------------------------------------------------------------
// loadOnboardingFromFirestore
// Queries haccp_snapshots and live_user_profiles for the stored onboarding profile.
// ---------------------------------------------------------------------------

export async function loadOnboardingFromFirestore(companyId, locationId) {
    if (!companyId || !locationId) return null;

    const variants = buildScopeVariants(companyId, locationId);
    const colNames = ["haccp_snapshots", "live_user_profiles"];

    for (const colName of colNames) {
        for (const v of variants) {
            try {
                const q = query(
                    collection(db, colName),
                    where(v.companyField, "==", v.companyValue),
                    where("locationId", "==", v.locationValue),
                    limit(1)
                );

                const snap = await getDocs(q);

                if (!snap.empty) {
                    const raw = snap.docs[0].data();
                    const profile = raw.profile && typeof raw.profile === "object" ? raw.profile : raw;

                    if (profile.companyName || profile.companyType) {
                        return { ...profile, companyId, locationId };
                    }
                }
            } catch {
                // try next variant / collection
            }
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// Helper function to convert new provisioning format to frontend format
// ---------------------------------------------------------------------------

function convertProvisioningRiskAnalysisToFrontend(data, companyId, locationId) {
    const controlPoints = data.controlPoints || [];
    const onboarding = data.onboardingSnapshot || {};

    console.log("DEBUG: Converting provisioning risk analysis to frontend format");
    console.log("DEBUG: Control points:", controlPoints.length);

    // Extract products and ingredients from onboarding snapshot
    const productsList = onboarding.produkter
        ? String(onboarding.produkter).split(",").map(s => s.trim()).filter(Boolean)
        : [];
    const ingredientsList = onboarding.ingredients
        ? (Array.isArray(onboarding.ingredients) ? onboarding.ingredients : String(onboarding.ingredients).split(",").map(s => s.trim()).filter(Boolean))
        : [];

    // Group control points by type
    const ccpPoints = controlPoints.filter((cp) => cp.type === "CCP");
    const gagPoints = controlPoints.filter((cp) => cp.type === "GAG");

    console.log("DEBUG: CCP points:", ccpPoints.length);
    console.log("DEBUG: GAG points:", gagPoints.length);

    // Convert control points to sections format
    const buildSection = (cp, pageGroup) => ({
        key: cp.id,
        pageGroup,
        classification: cp.type,
        title: cp.title,
        body: cp.hazard || "",
        products: productsList,
        ingredients: ingredientsList,
        controls: [cp.control].filter(Boolean),
        controlKeys: [],
        programSectionKeys: [],
        taskTemplateKeys: []
    });

    const microSections = controlPoints
        .filter((cp) => cp.hazard && cp.hazard.toLowerCase().includes("mikrobiolog"))
        .map((cp) => buildSection(cp, "microbiological"));

    const chemSections = controlPoints
        .filter((cp) => cp.hazard && cp.hazard.toLowerCase().includes("kemisk"))
        .map((cp) => buildSection(cp, "chemical"));

    const physSections = controlPoints
        .filter((cp) => cp.hazard && cp.hazard.toLowerCase().includes("fysisk"))
        .map((cp) => buildSection(cp, "physical"));

    // If no sections were categorized by hazard type, use all as microbiological
    const allSections = [...microSections, ...chemSections, ...physSections];
    if (allSections.length === 0 && controlPoints.length > 0) {
        console.log("DEBUG: No sections categorized by hazard type, using all as microbiological");
        controlPoints.forEach((cp) => microSections.push(buildSection(cp, "microbiological")));
    }

    const finalSections = [...microSections, ...chemSections, ...physSections];

    const pages = [
        {
            pageType: "cover",
            title: "Risikoanalyse",
            intro: "I skemaet nedenfor er beskrevet de forhold der kan udgøre en sundhedsrisiko, og hvilke forholdsregler virksomheden skal tage for at modgå de forskellige risici.",
            company: {
                companyName: onboarding.companyName || "",
                address: onboarding.address || "",
                restaurantType: onboarding.companyType || onboarding.restaurantType || "",
                createdAt: data.updatedAt || new Date().toISOString()
            }
        },
        {
            pageType: "hazard_group",
            pageGroup: "microbiological",
            title: "Mikrobiologiske sundhedsfarer",
            sections: microSections
        },
        {
            pageType: "hazard_group",
            pageGroup: "chemical",
            title: "Kemiske sundhedsfarer",
            sections: chemSections
        },
        {
            pageType: "hazard_group",
            pageGroup: "physical",
            title: "Fysiske sundhedsfarer",
            sections: physSections
        },
        {
            pageType: "summary",
            title: "Oversigt over kontrolpunkter",
            items: finalSections.map((s) => ({
                key: s.key,
                title: s.title,
                classification: s.classification,
                controls: s.controls
            }))
        }
    ];

    const meta = {
        totalSections: finalSections.length,
        microbiologicalCount: microSections.length,
        chemicalCount: chemSections.length,
        physicalCount: physSections.length
    };

    console.log("DEBUG: Converted provisioning data - sections:", finalSections.length);
    console.log("DEBUG: Meta:", meta);

    return {
        docId: "current",
        companyId,
        locationId,
        companyName: onboarding.companyName || "",
        restaurantType: onboarding.companyType || onboarding.restaurantType || "",
        pages,
        meta,
        createdAt: data.updatedAt,
        updatedAt: data.updatedAt
    };
}

// ---------------------------------------------------------------------------
// getActiveContext – single source of truth for companyId/locationId
// ---------------------------------------------------------------------------

export function getActiveContext(profile) {
    if (!profile) {
        throw new Error("Missing profile for context resolution");
    }

    const companyId = String(profile.companyId || profile.organizationId || "").trim();
    const locationId = String(
        profile.primaryLocationId ||
        profile.locationId ||
        (Array.isArray(profile.locationIds) ? profile.locationIds[0] : "") ||
        ""
    ).trim();

    if (!companyId || !locationId) {
        console.error("❌ Context invalid", { companyId, locationId });
        throw new Error("companyId/locationId mangler i profile");
    }

    console.log("🧭 Active context:", { companyId, locationId });
    return { companyId, locationId };
}

// ---------------------------------------------------------------------------
// FÆLLES LOADER: Source of truth for risk analysis data
// Læser KUN fra companies/{companyId}/locations/{locationId}/risk_analysis/current
// ---------------------------------------------------------------------------

export async function loadRiskAnalysisFromFirestore(companyId, locationId) {
    if (!companyId) {
        console.warn("[loadRiskAnalysisFromFirestore] Missing companyId");
        return null;
    }

    try {
        // -------------------------------------------------------------------
        // 1) Primær kilde: locations/{locationId}/risk_analysis/current
        // -------------------------------------------------------------------
        if (locationId) {
            try {
                const riskRef = doc(
                    db,
                    "companies",
                    companyId,
                    "locations",
                    locationId,
                    "risk_analysis",
                    "current"
                );

                const riskSnap = await getDoc(riskRef);

                if (riskSnap.exists()) {
                    const data = riskSnap.data() || {};

                    const controlPoints = Array.isArray(data.controlPoints)
                        ? data.controlPoints
                        : [];

                    console.log(
                        "[loadRiskAnalysisFromFirestore] Loaded location risk_analysis/current control points:",
                        controlPoints.length
                    );

                    if (controlPoints.length > 0) {
                        return {
                            controlPoints,
                            onboardingSnapshot: data.onboardingSnapshot || {},
                            status: data.status || null,
                            totalControlPoints: Number(data.totalControlPoints || controlPoints.length || 0),
                            updatedAt: data.updatedAt || data.createdAt || new Date(),
                            companyId,
                            locationId,
                            activeSnapshot: data,
                            snapshot: data,
                            haccpSnapshot: data
                        };
                    }

                    console.warn(
                        "[loadRiskAnalysisFromFirestore] risk_analysis/current exists but has 0 control points, falling back to haccp_snapshots"
                    );
                }
            } catch (error) {
                console.warn(
                    "[loadRiskAnalysisFromFirestore] Failed reading risk_analysis/current, falling back to haccp_snapshots:",
                    error
                );
            }
        }

        // -------------------------------------------------------------------
        // 2) Fallback: haccp_snapshots med companyId + locationId
        // -------------------------------------------------------------------
        const snapshotsRef = collection(db, "haccp_snapshots");
        let snapshot = null;

        if (locationId) {
            try {
                const locationQuery = query(
                    snapshotsRef,
                    where("companyId", "==", companyId),
                    where("locationId", "==", locationId),
                    orderBy("createdAt", "desc"),
                    limit(1)
                );
                snapshot = await getDocs(locationQuery);
            } catch (error) {
                console.warn(
                    "[loadRiskAnalysisFromFirestore] location-based haccp_snapshots query failed, falling back to company-only:",
                    error
                );
            }
        }

        // -------------------------------------------------------------------
        // 3) Fallback: haccp_snapshots med kun companyId
        // -------------------------------------------------------------------
        if (!snapshot || snapshot.empty) {
            const companyQuery = query(
                snapshotsRef,
                where("companyId", "==", companyId),
                orderBy("createdAt", "desc"),
                limit(1)
            );
            snapshot = await getDocs(companyQuery);
        }

        if (!snapshot || snapshot.empty) {
            console.warn(
                "[loadRiskAnalysisFromFirestore] Ingen risk_analysis eller haccp_snapshots fundet for",
                companyId,
                locationId
            );
            return null;
        }

        const docSnap = snapshot.docs[0];
        const data = docSnap.data() || {};

        const controlPoints =
            Array.isArray(data.controlPoints) && data.controlPoints.length
                ? data.controlPoints
                : Array.isArray(data.generated?.controlPoints) && data.generated.controlPoints.length
                    ? data.generated.controlPoints
                    : Array.isArray(data.generated?.controls) && data.generated.controls.length
                        ? data.generated.controls.map((item) => ({
                            name: typeof item === "string" ? item : (item?.name || item?.title || "Kontrolpunkt"),
                            title: typeof item === "string" ? item : (item?.title || item?.name || "Kontrolpunkt"),
                            controlRequirement: typeof item === "string"
                                ? item
                                : (
                                    item?.controlRequirement ||
                                    item?.description ||
                                    item?.requirement ||
                                    item?.control ||
                                    ""
                                )
                        }))
                        : Array.isArray(data.hazards) && data.hazards.length
                            ? data.hazards.map((item) => ({
                                name: item?.name || item?.title || item?.label || item?.hazard || "Kontrolpunkt",
                                title: item?.title || item?.name || item?.label || item?.hazard || "Kontrolpunkt",
                                controlRequirement:
                                    item?.control ||
                                    item?.description ||
                                    item?.requirement ||
                                    item?.action ||
                                    ""
                            }))
                            : [];

        const onboardingSnapshot =
            data.onboardingSnapshot ||
            data.generated?.onboardingSnapshot ||
            {};

        console.log(
            "[loadRiskAnalysisFromFirestore] Loaded haccp_snapshots control points:",
            controlPoints.length
        );

        if (controlPoints.length === 0) {
            console.warn(
                "[loadRiskAnalysisFromFirestore] Snapshot found but has 0 mapped control points"
            );
            return {
                controlPoints: [],
                onboardingSnapshot,
                status: data.status || null,
                totalControlPoints: Number(data.totalControlPoints || 0),
                updatedAt: data.updatedAt || data.createdAt || new Date(),
                companyId: data.companyId || companyId,
                locationId: data.locationId || locationId || null,
                activeSnapshot: data,
                snapshot: data,
                haccpSnapshot: data
            };
        }

        return {
            controlPoints,
            onboardingSnapshot,
            status: data.status || null,
            totalControlPoints: Number(data.totalControlPoints || controlPoints.length || 0),
            updatedAt: data.updatedAt || data.createdAt || new Date(),
            companyId: data.companyId || companyId,
            locationId: data.locationId || locationId || null,
            activeSnapshot: data,
            snapshot: data,
            haccpSnapshot: data
        };
    } catch (error) {
        console.error("[loadRiskAnalysisFromFirestore] Error loading risk analysis:", error);
        return null;
    }
}

// Backward compatibility - converts to old page-based format
export async function getExistingRiskAnalysis(companyId, locationId) {
    const riskData = await loadRiskAnalysisFromFirestore(companyId, locationId);
    if (!riskData) return null;

    // Convert to old format for backward compatibility
    return convertProvisioningRiskAnalysisToFrontend(riskData, companyId, locationId);
}

// ---------------------------------------------------------------------------
// Helper function to convert haccp_snapshots format to risk_analyses format
// ---------------------------------------------------------------------------

function convertHaccpSnapshotToRiskAnalysis(snapshot) {
    const haccp = snapshot.haccp || {};
    const profile = snapshot.profile || {};
    const hazards = haccp.hazards || [];

    console.log("DEBUG: Converting HACCP snapshot to risk analysis");
    console.log("DEBUG: Hazards from backend:", hazards.length);

    // Build pages from backend-generated hazards
    const microbiologicalHazards = hazards.filter((h) => h.hazardType === "biological");
    const chemicalHazards = hazards.filter((h) => h.hazardType === "chemical");
    const physicalHazards = hazards.filter((h) => h.hazardType === "physical");

    console.log("DEBUG: Microbiological hazards:", microbiologicalHazards.length);
    console.log("DEBUG: Chemical hazards:", chemicalHazards.length);
    console.log("DEBUG: Physical hazards:", physicalHazards.length);

    // Convert hazards to sections format
    const microSections = microbiologicalHazards.map((h) => ({
        key: h.processKey || h.id,
        pageGroup: "microbiological",
        classification: h.isCCP ? "CCP" : "GAG",
        title: h.title,
        body: h.description,
        controls: [h.controlMeasure].filter(Boolean),
        controlKeys: [],
        programSectionKeys: [],
        taskTemplateKeys: []
    }));

    const chemSections = chemicalHazards.map((h) => ({
        key: h.processKey || h.id,
        pageGroup: "chemical",
        classification: h.isCCP ? "CCP" : "GAG",
        title: h.title,
        body: h.description,
        controls: [h.controlMeasure].filter(Boolean),
        controlKeys: [],
        programSectionKeys: [],
        taskTemplateKeys: []
    }));

    const physSections = physicalHazards.map((h) => ({
        key: h.processKey || h.id,
        pageGroup: "physical",
        classification: h.isCCP ? "CCP" : "GAG",
        title: h.title,
        body: h.description,
        controls: [h.controlMeasure].filter(Boolean),
        controlKeys: [],
        programSectionKeys: [],
        taskTemplateKeys: []
    }));

    const allSections = [...microSections, ...chemSections, ...physSections];

    const pages = [
        {
            pageType: "cover",
            title: "Risikoanalyse",
            intro: "I skemaet nedenfor er beskrevet de forhold der kan udgøre en sundhedsrisiko, og hvilke forholdsregler virksomheden skal tage for at modgå de forskellige risici.",
            company: {
                companyName: profile.companyName || snapshot.companyName,
                address: snapshot.address || "",
                restaurantType: profile.companyType || snapshot.companyType,
                createdAt: snapshot.createdAt || new Date().toISOString()
            }
        },
        {
            pageType: "hazard_group",
            pageGroup: "microbiological",
            title: "Mikrobiologiske sundhedsfarer",
            sections: microSections
        },
        {
            pageType: "hazard_group",
            pageGroup: "chemical",
            title: "Kemiske sundhedsfarer",
            sections: chemSections
        },
        {
            pageType: "hazard_group",
            pageGroup: "physical",
            title: "Fysiske sundhedsfarer",
            sections: physSections
        },
        {
            pageType: "summary",
            title: "Oversigt over kontrolpunkter",
            items: allSections.map((s) => ({
                key: s.key,
                title: s.title,
                classification: s.classification,
                controls: s.controls
            }))
        }
    ];

    const meta = {
        totalSections: allSections.length,
        microbiologicalCount: microSections.length,
        chemicalCount: chemSections.length,
        physicalCount: physSections.length
    };

    const result = {
        docId: snapshot.id,
        companyId: snapshot.companyId,
        organizationId: snapshot.organizationId || snapshot.companyId,
        locationId: snapshot.locationId,
        companyName: profile.companyName || snapshot.companyName,
        restaurantType: profile.companyType || snapshot.companyType,
        pages,
        meta,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt || snapshot.createdAt
    };

    console.log("DEBUG: Converted result pages length:", result.pages.length);
    console.log("DEBUG: Converted result meta:", result.meta);

    return result;
}

// Helper to build pages from HACCP data structure
function buildPagesFromHaccpData(haccpData) {
    const pages = [];
    const hazards = haccpData.hazards || [];
    const scenarios = haccpData.scenarios || [];
    const kcps = haccpData.kcps || [];
    const processes = haccpData.processes || [];

    console.log("DEBUG: buildPagesFromHaccpData - hazards length:", hazards.length);
    console.log("DEBUG: buildPagesFromHaccpData - scenarios length:", scenarios.length);
    console.log("DEBUG: buildPagesFromHaccpData - kcps length:", kcps.length);
    console.log("DEBUG: buildPagesFromHaccpData - processes length:", processes.length);

    if (kcps.length > 0) {
        console.log("DEBUG: First KCP:", kcps[0]);
        console.log("DEBUG: First KCP keys:", Object.keys(kcps[0]));
    }

    if (processes.length > 0) {
        console.log("DEBUG: First process:", processes[0]);
        console.log("DEBUG: First process keys:", Object.keys(processes[0]));
    }

    // If hazards/scenarios are empty, build pages from KCPs
    if (hazards.length === 0 && scenarios.length === 0 && kcps.length > 0) {
        console.log("DEBUG: Building pages from KCPs");

        // Create a summary page with all KCPs
        const kcpSections = kcps.map((kcp, index) => {
            console.log(`DEBUG: Processing KCP ${index}:`, kcp.title);
            console.log("DEBUG: kcp.hazard:", kcp.hazard);
            console.log("DEBUG: kcp.monitoring:", kcp.monitoring);
            console.log("DEBUG: kcp.criticalLimit:", kcp.criticalLimit);
            console.log("DEBUG: kcp.verification:", kcp.verification);
            console.log("DEBUG: kcp.correctiveAction:", kcp.correctiveAction);

            // Extract hazard descriptions (biological, chemical, physical)
            let hazardDesc = "";
            if (typeof kcp.hazard === "object") {
                const hazardParts = [];
                if (kcp.hazard.biological) hazardParts.push(`Biologisk: ${kcp.hazard.biological}`);
                if (kcp.hazard.chemical) hazardParts.push(`Kemisk: ${kcp.hazard.chemical}`);
                if (kcp.hazard.physical) hazardParts.push(`Fysisk: ${kcp.hazard.physical}`);
                if (kcp.hazard.parasites) hazardParts.push(`Parasitter: ${kcp.hazard.parasites}`);
                if (kcp.hazard.crossContamination) hazardParts.push(`Krydskontaminering: ${kcp.hazard.crossContamination}`);
                if (kcp.hazard.biofilm) hazardParts.push(`Biofilm: ${kcp.hazard.biofilm}`);
                hazardDesc = hazardParts.join("\n\n");
            } else {
                hazardDesc = kcp.hazard || "";
            }

            // Extract monitoring description
            let monitoringDesc = "";
            if (typeof kcp.monitoring === "object") {
                const monParts = [];
                if (kcp.monitoring.what) monParts.push(`Hvad: ${kcp.monitoring.what}`);
                if (kcp.monitoring.how) monParts.push(`Hvordan: ${kcp.monitoring.how}`);
                if (kcp.monitoring.frequency) monParts.push(`Frekvens: ${kcp.monitoring.frequency}`);
                if (kcp.monitoring.responsible) monParts.push(`Ansvarlig: ${kcp.monitoring.responsible}`);
                monitoringDesc = monParts.join("\n");
            } else {
                monitoringDesc = kcp.monitoring || "";
            }

            // Extract critical limit description
            let criticalLimitDesc = "";
            if (typeof kcp.criticalLimit === "object") {
                const critParts = [];
                Object.keys(kcp.criticalLimit).forEach((key) => {
                    critParts.push(`${kcp.criticalLimit[key]}`);
                });
                criticalLimitDesc = critParts.join("\n");
            } else {
                criticalLimitDesc = kcp.criticalLimit || "";
            }

            // Extract verification description
            let verificationDesc = "";
            if (typeof kcp.verification === "object") {
                const verParts = [];
                if (kcp.verification.method) verParts.push(`Metode: ${kcp.verification.method}`);
                if (kcp.verification.responsible) verParts.push(`Ansvarlig: ${kcp.verification.responsible}`);
                if (kcp.verification.documentation) verParts.push(`Dokumentation: ${kcp.verification.documentation}`);
                verificationDesc = verParts.join("\n");
            } else {
                verificationDesc = kcp.verification || "";
            }

            // Extract corrective action description
            let correctiveActionDesc = "";
            if (typeof kcp.correctiveAction === "object") {
                const corrParts = [];
                if (kcp.correctiveAction.immediate) corrParts.push(`Øjeblikkelig: ${kcp.correctiveAction.immediate}`);
                if (kcp.correctiveAction.followUp) corrParts.push(`Opfølgning: ${kcp.correctiveAction.followUp}`);
                if (kcp.correctiveAction.documentation) corrParts.push(`Dokumentation: ${kcp.correctiveAction.documentation}`);
                correctiveActionDesc = corrParts.join("\n");
            } else {
                correctiveActionDesc = kcp.correctiveAction || "";
            }

            // Build body text
            let bodyText = "";
            if (hazardDesc) bodyText += `${hazardDesc}\n\n`;
            if (kcp.userContext) bodyText += `**Kontekst:** ${kcp.userContext}\n\n`;
            if (criticalLimitDesc) bodyText += `**Kritiske grænser:**\n${criticalLimitDesc}`;

            // Build controls array
            const controls = [];
            if (monitoringDesc) controls.push(monitoringDesc);
            if (verificationDesc) controls.push(verificationDesc);
            if (correctiveActionDesc) controls.push(correctiveActionDesc);

            return {
                title: kcp.title || kcp.name || "Kritisk Kontrolpunkt",
                classification: kcp.category || "kontrolpunkt",
                body: bodyText,
                products: [],
                ingredients: [],
                controls
            };
        });

        pages.push({
            title: "Oversigt over kontrolpunkter",
            sections: kcpSections
        });

        return pages;
    }

    // Otherwise use hazards or scenarios
    const dataSource = hazards.length > 0 ? hazards : scenarios;

    if (dataSource.length > 0) {
        console.log("DEBUG: Using data source:", hazards.length > 0 ? "hazards" : "scenarios");
        console.log("DEBUG: First item:", dataSource[0]);
        console.log("DEBUG: First item keys:", Object.keys(dataSource[0]));
    }

    // Group by type/category
    const microbiological = dataSource.filter(
        (h) =>
            h.type === "microbiological" ||
            h.classification === "microbiological" ||
            h.category === "microbiological" ||
            h.hazardType === "microbiological"
    );
    const chemical = dataSource.filter(
        (h) =>
            h.type === "chemical" ||
            h.classification === "chemical" ||
            h.category === "chemical" ||
            h.hazardType === "chemical"
    );
    const physical = dataSource.filter(
        (h) =>
            h.type === "physical" ||
            h.classification === "physical" ||
            h.category === "physical" ||
            h.hazardType === "physical"
    );

    console.log(
        "DEBUG: Grouped - micro:",
        microbiological.length,
        "chemical:",
        chemical.length,
        "physical:",
        physical.length
    );

    if (microbiological.length > 0) {
        pages.push({
            title: "Mikrobiologiske sundhedsfarer",
            sections: microbiological.map((h) => ({
                title: h.name || h.title || "Ukendt fare",
                classification: "microbiological",
                description: h.description || "",
                controlMeasures: h.controlMeasures || []
            }))
        });
    }

    if (chemical.length > 0) {
        pages.push({
            title: "Kemiske sundhedsfarer",
            sections: chemical.map((h) => ({
                title: h.name || h.title || "Ukendt fare",
                classification: "chemical",
                description: h.description || "",
                controlMeasures: h.controlMeasures || []
            }))
        });
    }

    if (physical.length > 0) {
        pages.push({
            title: "Fysiske sundhedsfarer",
            sections: physical.map((h) => ({
                title: h.name || h.title || "Ukendt fare",
                classification: "physical",
                description: h.description || "",
                controlMeasures: h.controlMeasures || []
            }))
        });
    }

    return pages;
}

// Helper to build meta from HACCP data
function buildMetaFromHaccpData(snapshot) {
    const hazards = snapshot.hazards || [];
    const kcps = snapshot.kcps || [];

    return {
        totalSections: hazards.length,
        microbiological: hazards.filter(
            (h) => h.type === "microbiological" || h.classification === "microbiological"
        ).length,
        chemical: hazards.filter(
            (h) => h.type === "chemical" || h.classification === "chemical"
        ).length,
        physical: hazards.filter(
            (h) => h.type === "physical" || h.classification === "physical"
        ).length,
        controlPoints: kcps.length
    };
}

// ---------------------------------------------------------------------------
// saveRiskAnalysisDocument
// ---------------------------------------------------------------------------

export async function saveRiskAnalysisDocument(riskAnalysis) {
    const { id: _id, createdAt: existingCreatedAt, ...rest } = riskAnalysis;

    if (!rest.companyId || !rest.locationId) {
        throw new Error("saveRiskAnalysisDocument kræver companyId og locationId");
    }

    const ref = doc(
        db,
        "companies",
        rest.companyId,
        "locations",
        rest.locationId,
        "risk_analysis",
        "current"
    );

    const isNew = !existingCreatedAt;

    await setDoc(
        ref,
        {
            ...rest,
            id: "current",
            updatedAt: serverTimestamp(),
            ...(isNew ? { createdAt: serverTimestamp() } : {})
        },
        { merge: true }
    );

    return "current";
}

// ---------------------------------------------------------------------------
// ensureRiskAnalysisForLocation
// ---------------------------------------------------------------------------

export async function ensureRiskAnalysisForLocation({ companyId, locationId, onboardingData }) {
    const existing = await getExistingRiskAnalysis(companyId, locationId);
    if (existing) return existing;

    const input = mapProfileToOnboardingInput(onboardingData, { companyId, locationId });
    const riskAnalysis = buildRiskAnalysisFromOnboarding(input);

    await saveRiskAnalysisDocument({
        ...riskAnalysis,
        companyId,
        locationId,
        source: "generated_from_onboarding"
    });

    return riskAnalysis;
}

// ---------------------------------------------------------------------------
// TEMPORARY ADMIN/DEBUG: Create default HACCP snapshot for a location
// ---------------------------------------------------------------------------

const DEFAULT_HACCP_CONTROL_POINTS = [
    {
        name: "Varemodtagelse",
        title: "Varemodtagelse",
        controlRequirement: "Kontroller temperatur, emballage, holdbarhed og sporbarhed ved modtagelse.",
        description: "Modtagne varer skal være intakte, korrekt mærket og leveret ved passende temperatur.",
        criticalLimit: "Kølevarer maks. 5 °C, frostvarer maks. -18 °C, ingen beskadiget emballage.",
        frequency: "Ved hver varemodtagelse",
        correctiveAction: "Afvis varen, kontakt leverandør, registrer afvigelse og vurder allerede modtagne varer."
    },
    {
        name: "Køleskab temperatur",
        title: "Køleskab temperatur",
        controlRequirement: "Kontroller og dokumenter temperatur i køleskabe.",
        description: "Køleskabe skal holde fødevarer ved sikker temperatur.",
        criticalLimit: "Maks. 5 °C.",
        frequency: "Dagligt",
        correctiveAction: "Juster eller reparer køl, flyt varer til fungerende køl og vurder kassation."
    },
    {
        name: "Fryser temperatur",
        title: "Fryser temperatur",
        controlRequirement: "Kontroller og dokumenter temperatur i frysere.",
        description: "Frysere skal holde frostvarer gennemfrosne.",
        criticalLimit: "Maks. -18 °C.",
        frequency: "Dagligt",
        correctiveAction: "Juster eller reparer fryser, flyt varer til fungerende fryser og vurder optøning/kassation."
    },
    {
        name: "Walk-in køl temperatur",
        title: "Walk-in køl temperatur",
        controlRequirement: "Kontroller og dokumenter temperatur i walk-in køl.",
        description: "Walk-in køl skal holde kølepligtige varer ved sikker temperatur.",
        criticalLimit: "Maks. 5 °C.",
        frequency: "Dagligt",
        correctiveAction: "Juster anlæg, flyt varer til fungerende køl og registrer afvigelse."
    },
    {
        name: "Walk-in frys temperatur",
        title: "Walk-in frys temperatur",
        controlRequirement: "Kontroller og dokumenter temperatur i walk-in frys.",
        description: "Walk-in frys skal holde frostvarer gennemfrosne.",
        criticalLimit: "Maks. -18 °C.",
        frequency: "Dagligt",
        correctiveAction: "Juster anlæg, flyt varer til fungerende frys og vurder optøning/kassation."
    },
    {
        name: "Opvarmning",
        title: "Opvarmning",
        controlRequirement: "Kontroller kernetemperatur ved opvarmning af fødevarer.",
        description: "Varmebehandlede fødevarer skal opnå tilstrækkelig temperatur.",
        criticalLimit: "Min. 75 °C i centrum.",
        frequency: "Ved hver relevant produktion",
        correctiveAction: "Fortsæt opvarmning til kritisk grænse er nået og registrer afvigelse."
    },
    {
        name: "Nedkøling",
        title: "Nedkøling",
        controlRequirement: "Kontroller tid og temperatur ved nedkøling.",
        description: "Varme fødevarer skal nedkøles hurtigt for at begrænse bakterievækst.",
        criticalLimit: "Fra 65 °C til 10 °C inden for 4 timer.",
        frequency: "Ved hver nedkøling",
        correctiveAction: "Fordel i mindre portioner, brug hurtig nedkøling eller kassér ved overskredet grænse."
    },
    {
        name: "Varmholdelse",
        title: "Varmholdelse",
        controlRequirement: "Kontroller temperatur ved varmholdelse.",
        description: "Varmholdte fødevarer skal holdes ved sikker temperatur indtil servering.",
        criticalLimit: "Min. 65 °C.",
        frequency: "Ved varmholdelse",
        correctiveAction: "Genopvarm til min. 75 °C eller kassér, hvis sikkerheden ikke kan dokumenteres."
    },
    {
        name: "Opvaskemaskine skyllevand",
        title: "Opvaskemaskine skyllevand",
        controlRequirement: "Kontroller skyllevandstemperatur eller desinfektionseffekt.",
        description: "Opvaskemaskinen skal sikre tilstrækkelig rengøring og desinfektion.",
        criticalLimit: "Skyllevand min. 80 °C eller dokumenteret kemisk desinfektion.",
        frequency: "Dagligt",
        correctiveAction: "Stop brug, ret fejl, vask service om og registrer afvigelse."
    },
    {
        name: "Rengøring køkken",
        title: "Rengøring køkken",
        controlRequirement: "Kontroller rengøring af køkkenområder og kontaktflader.",
        description: "Køkkenet skal være rent og fri for synlige madrester og snavs.",
        criticalLimit: "Ingen synlig forurening på kontaktflader eller arbejdsområder.",
        frequency: "Dagligt",
        correctiveAction: "Rengør igen, desinficer relevante flader og registrer afvigelse."
    },
    {
        name: "Rengøring køleskab",
        title: "Rengøring køleskab",
        controlRequirement: "Kontroller rengøring af køleskabe.",
        description: "Køleskabe skal holdes rene for at undgå kontaminering.",
        criticalLimit: "Ingen synligt snavs, spild eller gamle fødevarer.",
        frequency: "Ugentligt",
        correctiveAction: "Rengør køleskab, fjern gamle varer og registrer afvigelse."
    },
    {
        name: "Rengøring fryser",
        title: "Rengøring fryser",
        controlRequirement: "Kontroller rengøring og orden i frysere.",
        description: "Frysere skal holdes rene og ryddelige.",
        criticalLimit: "Ingen synligt snavs, kraftig rimdannelse eller beskadigede varer.",
        frequency: "Månedligt",
        correctiveAction: "Rengør/afrimis fryser, fjern beskadigede varer og registrer afvigelse."
    },
    {
        name: "Friture rengøring",
        title: "Friture rengøring",
        controlRequirement: "Kontroller rengøring og oliekvalitet i friture.",
        description: "Fritureolie og udstyr skal holdes i forsvarlig stand.",
        criticalLimit: "Ingen brændt lugt, synlig forurening eller overskredet oliekvalitet.",
        frequency: "Efter behov og mindst ugentligt",
        correctiveAction: "Filtrer eller udskift olie, rengør friture og registrer afvigelse."
    },
    {
        name: "Datokontrol",
        title: "Datokontrol",
        controlRequirement: "Kontroller holdbarhed og mærkning på fødevarer.",
        description: "Fødevarer skal være korrekt datomærket og anvendes inden holdbarhedsfrist.",
        criticalLimit: "Ingen varer med overskredet holdbarhed eller manglende intern dato.",
        frequency: "Dagligt",
        correctiveAction: "Kassér udløbne varer, mærk manglende datoer hvis sikkert, og registrer afvigelse."
    },
    {
        name: "Adskillelse/krydskontaminering",
        title: "Adskillelse/krydskontaminering",
        controlRequirement: "Kontroller adskillelse mellem rå, spiseklare og allergene fødevarer.",
        description: "Fødevarer skal håndteres og opbevares så krydskontaminering undgås.",
        criticalLimit: "Rå og spiseklare varer holdes adskilt; allergener håndteres kontrolleret.",
        frequency: "Dagligt og løbende under produktion",
        correctiveAction: "Adskil varer, rengør/desinficer udstyr, kassér kontaminerede fødevarer ved behov."
    },
    {
        name: "Sporbarhed",
        title: "Sporbarhed",
        controlRequirement: "Kontroller at leverandør- og produktoplysninger kan dokumenteres.",
        description: "Fødevarer skal kunne spores ét led tilbage og relevante oplysninger gemmes.",
        criticalLimit: "Leverandør, produkt og dato skal kunne dokumenteres.",
        frequency: "Ved varemodtagelse og stikprøvevis",
        correctiveAction: "Fremskaf manglende dokumentation eller stop brug af varen."
    },
    {
        name: "Tilbagetrækning",
        title: "Tilbagetrækning",
        controlRequirement: "Kontroller at procedure for tilbagetrækning kan iværksættes.",
        description: "Virksomheden skal kunne identificere og håndtere berørte varer ved tilbagetrækning.",
        criticalLimit: "Berørte varer identificeres, isoleres og håndteres efter myndigheds-/leverandørbesked.",
        frequency: "Ved hændelse og årlig test",
        correctiveAction: "Isoler varer, informer relevante parter, dokumenter handlinger og følg myndighedsanvisninger."
    },
    {
        name: "Årlig revision",
        title: "Årlig revision",
        controlRequirement: "Gennemfør årlig revision af egenkontrolprogram og HACCP.",
        description: "Programmet skal vurderes og opdateres ved ændringer eller mindst én gang årligt.",
        criticalLimit: "Revision gennemført og dokumenteret inden for seneste 12 måneder.",
        frequency: "Årligt",
        correctiveAction: "Gennemfør manglende revision, opdater programmet og dokumenter ændringer."
    }
];

export async function createDefaultHaccpSnapshotForLocation(companyId, locationId) {
    if (!companyId || !locationId) {
        return { created: false, reason: "missing_params" };
    }

    const snapshotsRef = collection(db, "haccp_snapshots");
    const existingQuery = query(
        snapshotsRef,
        where("companyId", "==", companyId),
        where("locationId", "==", locationId),
        limit(1)
    );
    const existingSnap = await getDocs(existingQuery);

    if (!existingSnap.empty) {
        return { created: false, reason: "exists" };
    }

    const controlPoints = DEFAULT_HACCP_CONTROL_POINTS.map((point) => ({ ...point }));

    await addDoc(snapshotsRef, {
        companyId,
        organizationId: companyId,
        locationId,
        isDemo: false,
        isActive: true,
        version: 1,
        totalControlPoints: controlPoints.length,
        controlPoints,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return { created: true, count: controlPoints.length };
}

// ---------------------------------------------------------------------------
// Backward-compat aliases
// ---------------------------------------------------------------------------

export { saveRiskAnalysisDocument as saveRiskAnalysisToFirestore };
