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
    const equipmentSource = profile.equipment || {};
    const units = Array.isArray(equipmentSource.units) ? equipmentSource.units : [];
    const countUnitTypes = (typeMatches = []) => units.filter((unit) => {
        const typeText = [
            unit?.type,
            unit?.equipmentType,
            unit?.category,
            unit?.name,
            unit?.label
        ].join(" ").toLowerCase();
        return typeMatches.some((match) => typeText.includes(match));
    }).length;

    const countFromArray = (...values) => values.find((value) => Array.isArray(value))?.length || 0;

    // Support both English and Danish field names
    const fridgeCount = Math.max(
        0,
        Number(profile.fridgeCount || profile.antalKoeleskabe) ||
        countFromArray(equipmentSource.fridges, equipmentSource.coolingUnits) ||
        countUnitTypes(["fridge", "køl", "koel", "køleskab", "koeleskab"]) ||
        0
    );
    const freezerCount = Math.max(
        0,
        Number(profile.freezerCount || profile.antalFrysere) ||
        countFromArray(equipmentSource.freezers, equipmentSource.freezerUnits) ||
        countUnitTypes(["freezer", "frys"]) ||
        0
    );
    const iceMachineCount = Math.max(
        0,
        Number(profile.iceMachineCount || profile.antalIsterningemaskiner || profile.antalIsmaskiner) ||
        countFromArray(equipmentSource.iceMachines, equipmentSource.softiceMachines) ||
        countUnitTypes(["ice", "softice", "ismaskine", "isterning"]) ||
        (profile.hasIceMachine || profile.hasSoftIceMachine || profile.hasSofticeMachine || equipmentSource.hasIceMachine || equipmentSource.hasSoftIceMachine ? 1 : 0)
    );
    const dishwasherCount = Math.max(
        0,
        Number(profile.dishwasherCount || profile.antalOpvaskemaskiner) ||
        countFromArray(equipmentSource.dishwashers) ||
        countUnitTypes(["dishwasher", "opvask"]) ||
        (profile.hasDishwasher || profile.harOpvaskemaskine || equipmentSource.hasDishwasher ? 1 : 0)
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
            iceMachines: Array.from({ length: iceMachineCount }, (_, i) => ({ name: `Ismaskine ${i + 1}` })),
            dishwashers: Array.from({ length: dishwasherCount }, (_, i) => ({ name: `Opvaskemaskine ${i + 1}` }))
        },

        processes: {
            receivingGoods: !!(
                profile.receivesChilledGoods ||
                profile.receivesFrozenGoods ||
                profile.receivesRoomTempGoods ||
                profile.modtagerKoelevarer ||
                profile.modtagerFrostvarer ||
                profile.business?.receivesGoods
            ),
            cooking: !!(profile.preparesHotFood || profile.tilberederVarmMad || profile.business?.preparesHotFood),
            heating: !!(
                profile.preparesHotFood ||
                profile.servesHotFood ||
                profile.tilberederVarmMad ||
                profile.business?.preparesHotFood
            ),
            reheating: !!(profile.preparesHotFood || profile.tilberederVarmMad || profile.business?.reheatsFood),
            cooling: !!(profile.coolsHotFood || profile.nedkoelerMad || profile.business?.coolsHotFood || equipmentSource.hasCoolingProcess),
            hotHolding: !!(
                profile.holdsHotFood ||
                profile.hasHotHolding ||
                profile.varmholder ||
                profile.business?.holdsHotFood ||
                equipmentSource.hasHotHolding ||
                countUnitTypes(["varmhold", "hot holding", "bain marie"]) > 0
            ),
            saleWithoutCooling: false,
            allergens: true,
            traceability: true,
            withdrawal: true,
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

function normalizeOnboardingProfile(raw = {}, { companyId, locationId } = {}) {
    const profile = raw.profile && typeof raw.profile === "object" ? raw.profile : {};
    const company = raw.company && typeof raw.company === "object" ? raw.company : {};
    const business = raw.business && typeof raw.business === "object" ? raw.business : {};

    return {
        ...raw,
        ...profile,
        companyId,
        locationId,
        companyName: profile.companyName || company.name || raw.companyName || raw.name || "",
        companyType: profile.companyType || company.businessType || business.type || raw.companyType || raw.restaurantType || "",
        restaurantType: profile.restaurantType || profile.companyType || company.businessType || business.type || raw.restaurantType || "",
        address: profile.address || company.address || raw.address || "",
        equipment: raw.equipment || profile.equipment || {},
        business: {
            ...business,
            ...profile.business
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

    const directOnboardingIds = [
        `${companyId}__${locationId}`,
        `${companyId}__${locationId}__onboarding`
    ];

    for (const docId of directOnboardingIds) {
        try {
            const snap = await getDoc(doc(db, "onboarding_answers", docId));
            if (snap.exists()) {
                return normalizeOnboardingProfile(snap.data(), { companyId, locationId });
            }
        } catch {
            // try next id / query fallback
        }
    }

    for (const v of variants) {
        try {
            const q = query(
                collection(db, "onboarding_answers"),
                where(v.companyField, "==", v.companyValue),
                where("locationId", "==", v.locationValue),
                limit(1)
            );

            const snap = await getDocs(q);
            if (!snap.empty) {
                return normalizeOnboardingProfile(snap.docs[0].data(), { companyId, locationId });
            }
        } catch {
            // try next variant / collection
        }
    }

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
                    const profile = normalizeOnboardingProfile(raw.profile && typeof raw.profile === "object" ? raw.profile : raw, { companyId, locationId });

                    if (profile.companyName || profile.companyType) {
                        return profile;
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
// TEMPORARY DEBUG FUNCTION - Find HACCP data location
// ---------------------------------------------------------------------------

export async function debugFindHaccpData() {
    console.log("=== DEBUG: Searching for HACCP data ===");
    const snapshotsRef = collection(db, "haccp_snapshots");
    
    // Test 1: companyId
    try {
        console.log("\n1. Testing where('companyId', '==', 'jn6KjQctNj1dO6XzRpEW')");
        const q1 = query(snapshotsRef, where("companyId", "==", "jn6KjQctNj1dO6XzRpEW"));
        const snap1 = await getDocs(q1);
        console.log(`   Found ${snap1.docs.length} documents`);
        snap1.docs.forEach((doc, idx) => {
            const data = doc.data();
            console.log(`   [${idx}] id:`, doc.id);
            console.log(`       companyId:`, data.companyId);
            console.log(`       organizationId:`, data.organizationId);
            console.log(`       locationId:`, data.locationId);
            console.log(`       createdAt:`, data.createdAt);
            console.log(`       updatedAt:`, data.updatedAt);
            console.log(`       keys:`, Object.keys(data).join(", "));
            console.log(`       has controlPoints:`, Array.isArray(data.controlPoints));
            console.log(`       has hazards:`, Array.isArray(data.hazards));
            console.log(`       has generated:`, !!data.generated);
            console.log(`       has generated.controlPoints:`, Array.isArray(data.generated?.controlPoints));
        });
    } catch (e) {
        console.error("   Error:", e.message);
    }
    
    // Test 2: organizationId
    try {
        console.log("\n2. Testing where('organizationId', '==', 'jn6KjQctNj1dO6XzRpEW')");
        const q2 = query(snapshotsRef, where("organizationId", "==", "jn6KjQctNj1dO6XzRpEW"));
        const snap2 = await getDocs(q2);
        console.log(`   Found ${snap2.docs.length} documents`);
        snap2.docs.forEach((doc, idx) => {
            const data = doc.data();
            console.log(`   [${idx}] id:`, doc.id);
            console.log(`       companyId:`, data.companyId);
            console.log(`       organizationId:`, data.organizationId);
            console.log(`       locationId:`, data.locationId);
            console.log(`       createdAt:`, data.createdAt);
            console.log(`       updatedAt:`, data.updatedAt);
            console.log(`       keys:`, Object.keys(data).join(", "));
            console.log(`       has controlPoints:`, Array.isArray(data.controlPoints));
            console.log(`       has hazards:`, Array.isArray(data.hazards));
            console.log(`       has generated:`, !!data.generated);
            console.log(`       has generated.controlPoints:`, Array.isArray(data.generated?.controlPoints));
        });
    } catch (e) {
        console.error("   Error:", e.message);
    }
    
    // Test 3: locationId
    try {
        console.log("\n3. Testing where('locationId', '==', 'bi9Q5CKfU9CkG50M4Wai')");
        const q3 = query(snapshotsRef, where("locationId", "==", "bi9Q5CKfU9CkG50M4Wai"));
        const snap3 = await getDocs(q3);
        console.log(`   Found ${snap3.docs.length} documents`);
        snap3.docs.forEach((doc, idx) => {
            const data = doc.data();
            console.log(`   [${idx}] id:`, doc.id);
            console.log(`       companyId:`, data.companyId);
            console.log(`       organizationId:`, data.organizationId);
            console.log(`       locationId:`, data.locationId);
            console.log(`       createdAt:`, data.createdAt);
            console.log(`       updatedAt:`, data.updatedAt);
            console.log(`       keys:`, Object.keys(data).join(", "));
            console.log(`       has controlPoints:`, Array.isArray(data.controlPoints));
            console.log(`       has hazards:`, Array.isArray(data.hazards));
            console.log(`       has generated:`, !!data.generated);
            console.log(`       has generated.controlPoints:`, Array.isArray(data.generated?.controlPoints));
        });
    } catch (e) {
        console.error("   Error:", e.message);
    }
    
    // Test 4: First 10 without filter
    try {
        console.log("\n4. Testing first 10 documents without filter");
        const q4 = query(snapshotsRef, limit(10));
        const snap4 = await getDocs(q4);
        console.log(`   Found ${snap4.docs.length} documents`);
        snap4.docs.forEach((doc, idx) => {
            const data = doc.data();
            console.log(`   [${idx}] id:`, doc.id);
            console.log(`       companyId:`, data.companyId);
            console.log(`       organizationId:`, data.organizationId);
            console.log(`       locationId:`, data.locationId);
            console.log(`       createdAt:`, data.createdAt);
            console.log(`       updatedAt:`, data.updatedAt);
            console.log(`       keys:`, Object.keys(data).join(", "));
            console.log(`       has controlPoints:`, Array.isArray(data.controlPoints));
            console.log(`       has hazards:`, Array.isArray(data.hazards));
            console.log(`       has generated:`, !!data.generated);
            console.log(`       has generated.controlPoints:`, Array.isArray(data.generated?.controlPoints));
        });
    } catch (e) {
        console.error("   Error:", e.message);
    }
    
    console.log("\n=== DEBUG: Search complete ===");
}

// ---------------------------------------------------------------------------
// Helper: Compare semantic versions (e.g., "2.0.0" vs "1.0.0")
// Returns: -1 if a < b, 0 if a === b, 1 if a > b
// ---------------------------------------------------------------------------
function compareSemver(a, b) {
    const aParts = String(a || "0.0.0").split(".").map(n => parseInt(n, 10) || 0);
    const bParts = String(b || "0.0.0").split(".").map(n => parseInt(n, 10) || 0);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
    }
    return 0;
}

const CURRENT_CANONICAL_RISK_VERSION = "2.1.0";
const REQUIRED_CANONICAL_CCP_KEYS = [
    "varemodtagelse",
    "opvarmning",
    "nedkoeling",
    "varmholdelse",
    "tre_timers_regel",
    "koeleskab_temperatur",
    "fryser_temperatur"
];

function normalizeRiskRoutineKey(value = "") {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/Ã¦|æ/g, "ae")
        .replace(/Ã¸|ø/g, "oe")
        .replace(/Ã¥|å/g, "aa")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function getRiskControlPointRoutineKey(controlPoint = {}) {
    return normalizeRiskRoutineKey(
        controlPoint.routineKey ||
        controlPoint.canonicalRoutineType ||
        controlPoint.routineType ||
        controlPoint.templateKey ||
        controlPoint.taskTemplateKeys?.[0] ||
        controlPoint.key ||
        controlPoint.id ||
        controlPoint.title ||
        controlPoint.name
    );
}

function hasRequiredCanonicalCcpKeys(controlPoints = []) {
    const keys = new Set(controlPoints.map(getRiskControlPointRoutineKey).filter(Boolean));
    return REQUIRED_CANONICAL_CCP_KEYS.every((key) => keys.has(key));
}

function shouldRegenerateCanonicalRiskAnalysis(data = {}, controlPoints = []) {
    if (!Array.isArray(controlPoints) || controlPoints.length === 0) return false;

    const sourceValue = String(data.source || "");
    const generatedSource = !sourceValue || [
        "generated_from_onboarding",
        "risk_analysis_current"
    ].includes(sourceValue);
    const oldVersion = compareSemver(data.version || "0.0.0", CURRENT_CANONICAL_RISK_VERSION) < 0;
    const tooFewCanonicalPoints = controlPoints.length < REQUIRED_CANONICAL_CCP_KEYS.length;
    const missingRequiredKeys = !hasRequiredCanonicalCcpKeys(controlPoints);

    return generatedSource && (oldVersion || tooFewCanonicalPoints || missingRequiredKeys);
}

// ---------------------------------------------------------------------------
// FÆLLES LOADER: Source of truth for risk analysis data
// Prioriterer haccp_snapshots v2.0.0+ over gammel risk_analysis/current
// ---------------------------------------------------------------------------

export async function loadRiskAnalysisFromFirestore(companyId, locationId) {
    if (!companyId) {
        console.warn("[loadRiskAnalysisFromFirestore] Missing companyId");
        return null;
    }

    try {
        let riskCurrentData = null;
        let riskCurrentVersion = "0.0.0";
        
        // -------------------------------------------------------------------
        // 1) Check: locations/{locationId}/risk_analysis/current
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
                    riskCurrentData = riskSnap.data() || {};
                    riskCurrentVersion = riskCurrentData.version || "0.0.0";
                }
            } catch (error) {
                console.warn(
                    "[loadRiskAnalysisFromFirestore] Failed reading risk_analysis/current:",
                    error
                );
            }
        }

        // -------------------------------------------------------------------
        // 2) Check: haccp_snapshots for version comparison
        // -------------------------------------------------------------------
        const snapshotsRef = collection(db, "haccp_snapshots");
        let snapshots = [];

        if (locationId) {
            try {
                const locationQuery = query(
                    snapshotsRef,
                    where("companyId", "==", companyId),
                    where("locationId", "==", locationId)
                );
                const locationSnap = await getDocs(locationQuery);
                snapshots = locationSnap.docs;
            } catch (error) {
                console.warn(
                    "[loadRiskAnalysisFromFirestore] location-based haccp_snapshots query failed:",
                    error
                );
            }
        }

        if (snapshots.length === 0) {
            const companyQuery = query(
                snapshotsRef,
                where("companyId", "==", companyId)
            );
            const companySnap = await getDocs(companyQuery);
            snapshots = companySnap.docs;
        }

        // Sort snapshots by date desc
        snapshots.sort((a, b) => {
            const aData = a.data();
            const bData = b.data();
            
            const aDate = aData.createdAt?.toDate?.() || aData.updatedAt?.toDate?.() || aData.endDate?.toDate?.() || new Date(0);
            const bDate = bData.createdAt?.toDate?.() || bData.updatedAt?.toDate?.() || bData.endDate?.toDate?.() || new Date(0);
            
            return bDate - aDate;
        });

        const latestSnapshotDoc = snapshots.length > 0 ? snapshots[0] : null;
        const latestSnapshot = latestSnapshotDoc ? latestSnapshotDoc.data() : null;
        const snapshotVersion = latestSnapshot?.version || "0.0.0";
        const snapshotDocId = latestSnapshotDoc ? latestSnapshotDoc.id : "N/A";

        // -------------------------------------------------------------------
        // 3) Version comparison: Use haccp_snapshots if newer
        // -------------------------------------------------------------------
        const versionComparison = compareSemver(snapshotVersion, riskCurrentVersion);
        const useSnapshot = versionComparison > 0 || (latestSnapshot && !riskCurrentData);
        
        let selectedSource = "none";
        let selectedData = null;
        let controlPoints = [];

        if (useSnapshot && latestSnapshot) {
            // Use haccp_snapshots
            selectedSource = "haccp_snapshot";
            selectedData = latestSnapshot;
            
            controlPoints =
                Array.isArray(selectedData.controlPoints) && selectedData.controlPoints.length
                    ? selectedData.controlPoints
                    : Array.isArray(selectedData.generated?.controlPoints) && selectedData.generated.controlPoints.length
                        ? selectedData.generated.controlPoints
                        : Array.isArray(selectedData.generated?.controls) && selectedData.generated.controls.length
                            ? selectedData.generated.controls.map((item) => ({
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
                            : Array.isArray(selectedData.hazards) && selectedData.hazards.length
                                ? selectedData.hazards.map((item) => ({
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
        } else if (riskCurrentData) {
            // Use risk_analysis/current
            selectedSource = "risk_analysis_current";
            selectedData = riskCurrentData;
            controlPoints = Array.isArray(selectedData.controlPoints) ? selectedData.controlPoints : [];
        }

        if (selectedData && shouldRegenerateCanonicalRiskAnalysis(selectedData, controlPoints)) {
            console.warn("[loadRiskAnalysisFromFirestore] Existing generated risk analysis is stale; regenerating from onboarding", {
                selectedSource,
                version: selectedData.version || "0.0.0",
                controlPointsCount: controlPoints.length,
                routineKeys: controlPoints.map(getRiskControlPointRoutineKey).filter(Boolean)
            });
            return null;
        }

        console.log("[risk loader source]", {
            companyId: companyId,
            locationId: locationId,
            riskVersion: riskCurrentVersion,
            snapshotVersion: snapshotVersion,
            versionComparison: versionComparison,
            useSnapshot: useSnapshot,
            selectedSource: selectedSource,
            controlPointsCount: controlPoints.length,
            firstTitle: controlPoints[0]?.title || controlPoints[0]?.name || "N/A",
            snapshotDocId: snapshotDocId,
            riskCurrentExists: !!riskCurrentData,
            snapshotExists: !!latestSnapshot
        });

        if (!selectedData || controlPoints.length === 0) {
            console.warn(
                "[loadRiskAnalysisFromFirestore] No valid risk analysis data found for",
                companyId,
                locationId
            );
            return null;
        }

        const onboardingSnapshot =
            selectedData.onboardingSnapshot ||
            selectedData.generated?.onboardingSnapshot ||
            {};

        return {
            controlPoints,
            onboardingSnapshot,
            status: selectedData.status || null,
            source: selectedSource,
            sourceLabel: selectedSource === "haccp_snapshot" ? "Aktiv HACCP-snapshot" : "Aktiv risikoanalyse",
            totalControlPoints: Number(selectedData.totalControlPoints || controlPoints.length || 0),
            riskAnalysisReport: selectedData.riskAnalysisReport || selectedData.generated?.riskAnalysisReport || null,
            reportIntro: selectedData.reportIntro || selectedData.generated?.reportIntro || selectedData.riskAnalysisReport?.body || selectedData.generated?.riskAnalysisReport?.body || "",
            updatedAt: selectedData.updatedAt || selectedData.createdAt || new Date(),
            companyId: selectedData.companyId || companyId,
            locationId: selectedData.locationId || locationId || null,
            activeSnapshot: selectedData,
            snapshot: selectedData,
            haccpSnapshot: selectedData
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
            riskAnalysisReport: rest.riskAnalysisReport || null,
            reportIntro: rest.reportIntro || rest.riskAnalysisReport?.body || "",
            updatedAt: serverTimestamp(),
            ...(isNew ? { createdAt: serverTimestamp() } : {})
        },
        { merge: true }
    );

    // Create/update haccp_snapshots document
    const controlPoints = Array.isArray(rest.controlPoints) ? rest.controlPoints : [];
    
    if (controlPoints.length === 0) {
        console.warn("[saveRiskAnalysisDocument] No controlPoints found, skipping haccp_snapshots creation");
    } else {
        try {
            const snapshotsRef = collection(db, "haccp_snapshots");
            await addDoc(snapshotsRef, {
                companyId: rest.companyId,
                organizationId: rest.companyId,
                locationId: rest.locationId,
                version: rest.version || CURRENT_CANONICAL_RISK_VERSION,
                totalControlPoints: controlPoints.length,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                hazards: controlPoints,
                controlPoints: controlPoints,
                onboardingSnapshot: rest.onboardingSnapshot || {},
                riskAnalysisReport: rest.riskAnalysisReport || null,
                reportIntro: rest.reportIntro || rest.riskAnalysisReport?.body || "",
                source: rest.source || "risk_analysis_current"
            });
            console.log("[saveRiskAnalysisDocument] Created haccp_snapshots document with", controlPoints.length, "control points");
        } catch (error) {
            console.error("[saveRiskAnalysisDocument] Failed to create haccp_snapshots document:", error);
        }
    }

    return "current";
}

// ---------------------------------------------------------------------------
// ensureRiskAnalysisForLocation
// ---------------------------------------------------------------------------

export async function ensureRiskAnalysisForLocation({ companyId, locationId, onboardingData }) {
    if (!companyId || !locationId) {
        throw new Error("ensureRiskAnalysisForLocation kræver companyId og locationId");
    }

    const existing = await getExistingRiskAnalysis(companyId, locationId);
    if (existing) return existing;

    const profile = onboardingData || await loadOnboardingFromFirestore(companyId, locationId);
    if (!profile) {
        throw new Error("Ingen onboarding/profile fundet til risikoanalyse-generering");
    }

    const input = mapProfileToOnboardingInput(profile, { companyId, locationId });
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
// ensureHaccpSnapshotFromCurrentRiskAnalysis - Backfill function
// ---------------------------------------------------------------------------

export async function ensureHaccpSnapshotFromCurrentRiskAnalysis(companyId, locationId) {
    if (!companyId || !locationId) {
        return { created: false, reason: "missing_params" };
    }

    try {
        // 1. Read risk_analysis/current
        const riskRef = doc(db, "companies", companyId, "locations", locationId, "risk_analysis", "current");
        const riskSnap = await getDoc(riskRef);

        if (!riskSnap.exists()) {
            return { created: false, reason: "no_risk_analysis" };
        }

        const riskData = riskSnap.data();
        const controlPoints = Array.isArray(riskData.controlPoints) ? riskData.controlPoints : [];

        // 2. Check if controlPoints exist
        if (controlPoints.length === 0) {
            console.warn("[ensureHaccpSnapshotFromCurrentRiskAnalysis] No controlPoints found in risk_analysis/current");
            return { created: false, reason: "no_control_points" };
        }

        // 3. Check if haccp_snapshots already exists for this source
        const snapshotsRef = collection(db, "haccp_snapshots");
        const existingQuery = query(
            snapshotsRef,
            where("companyId", "==", companyId),
            where("locationId", "==", locationId),
            where("source", "==", "risk_analysis_current"),
            limit(1)
        );
        const existingSnap = await getDocs(existingQuery);

        if (!existingSnap.empty) {
            console.log("[ensureHaccpSnapshotFromCurrentRiskAnalysis] Snapshot already exists");
            return { created: false, reason: "exists" };
        }

        // 4. Create haccp_snapshots document
        await addDoc(snapshotsRef, {
            companyId,
            organizationId: companyId,
            locationId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            hazards: controlPoints,
            controlPoints: controlPoints,
            onboardingSnapshot: riskData.onboardingSnapshot || {},
            riskAnalysisReport: riskData.riskAnalysisReport || null,
            reportIntro: riskData.reportIntro || riskData.riskAnalysisReport?.body || "",
            source: "risk_analysis_current"
        });

        console.log("[ensureHaccpSnapshotFromCurrentRiskAnalysis] Created haccp_snapshots document with", controlPoints.length, "control points");
        return { created: true, count: controlPoints.length };

    } catch (error) {
        console.error("[ensureHaccpSnapshotFromCurrentRiskAnalysis] Error:", error);
        return { created: false, reason: "error", error: error.message };
    }
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
    name: "Pålægsmaskine rengøring",
    title: "Pålægsmaskine rengøring",
    controlRequirement: "Kontroller rengøring og desinfektion af pålægsmaskine, kniv, slæde, afskærmning og kontaktflader.",
    description: "Pålægsmaskiner kan opsamle madrester og biofilm og skal rengøres grundigt for at undgå kontaminering af spiseklare fødevarer.",
    criticalLimit: "Ingen synlige madrester, fedt, belægninger eller snavs på kniv, slæde, afskærmning eller øvrige fødevarekontaktflader.",
    frequency: "Efter brug og mindst dagligt ved anvendelse",
    correctiveAction: "Stop brug, adskil og rengør/desinficér maskinen igen, kassér fødevarer ved risiko for forurening og registrer afvigelse."
    },
    {
    name: "Ismaskine / softicemaskine rengøring",
    title: "Ismaskine / softicemaskine rengøring",
    controlRequirement: "Kontroller rengøring og desinfektion af ismaskine eller softicemaskine efter virksomhedens plan og producentens anvisning.",
    description: "Is- og softicemaskiner kan opbygge belægninger, mælkesten, biofilm og produktrester, som kan forurene fødevarer.",
    criticalLimit: "Ingen synlig snavs, belægning, slim, mug eller produktrester. Fødevarekontaktflader skal være rengjorte og desinficerede.",
    frequency: "Efter plan, ved behov og altid efter producentens anvisning",
    correctiveAction: "Stop brug, rengør og desinficér igen, kassér berørt is/softice eller blanding ved risiko for forurening og registrer afvigelse."
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
