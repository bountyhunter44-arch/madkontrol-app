const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function run() {
    console.log("Seeder requirement templates...");

    const templates = [
        {
            id: "req_no_open_cans",
            code: "no_open_cans",
            title: "Åbnede dåser må ikke opbevares i køleskab",
            areaType: "walk_in_cooler",
            category: "storage",
            severity: "medium",
            requirementType: "storage_rule",
            description: "Indhold fra åbne dåser skal overføres til fødevareegnet beholder.",
            explanation: "Åbnede dåser er ikke egnet til videre opbevaring.",
            whyItMatters: "Reducerer risiko for forurening og dårlig opbevaring.",
            authorityLabel: "Fødevarestyrelsen",
            authorityUrl: "",
            canUseAlternativeJustification: false,
            isActive: true,
            sortOrder: 10,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "req_no_utensils",
            code: "no_utensils_left_in_food",
            title: "Redskaber må ikke efterlades i fødevarer under opbevaring",
            areaType: "walk_in_cooler",
            category: "storage",
            severity: "medium",
            requirementType: "storage_rule",
            description: "Skeer, tænger og redskaber skal opbevares separat.",
            explanation: "Redskaber i maden øger risikoen for krydskontaminering.",
            whyItMatters: "Håndtag kan overføre bakterier til fødevaren.",
            authorityLabel: "Fødevarestyrelsen",
            authorityUrl: "",
            canUseAlternativeJustification: false,
            isActive: true,
            sortOrder: 20,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "req_food_covered",
            code: "food_must_be_covered",
            title: "Fødevarer skal være tildækkede under opbevaring",
            areaType: "walk_in_cooler",
            category: "storage",
            severity: "medium",
            requirementType: "storage_rule",
            description: "Mad skal stå i lukkede beholdere eller være tildækket.",
            explanation: "Beskytter mod dryp og forurening.",
            whyItMatters: "Reducerer risiko for krydskontaminering.",
            authorityLabel: "Fødevarestyrelsen",
            authorityUrl: "",
            canUseAlternativeJustification: false,
            isActive: true,
            sortOrder: 30,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "req_date_label",
            code: "date_label_required",
            title: "Åbnede og klargjorte fødevarer skal datomærkes",
            areaType: "walk_in_cooler",
            category: "labeling",
            severity: "medium",
            requirementType: "label_rule",
            description: "Mad og råvarer skal kunne identificeres med dato.",
            explanation: "Datomærkning gør det muligt at styre holdbarhed.",
            whyItMatters: "Reducerer risiko for brug af for gamle varer.",
            authorityLabel: "Fødevarestyrelsen",
            authorityUrl: "",
            canUseAlternativeJustification: false,
            isActive: true,
            sortOrder: 40,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "req_raw_ready_sep",
            code: "raw_and_ready_separated",
            title: "Rå og spiseklare varer skal holdes adskilt",
            areaType: "walk_in_cooler",
            category: "workflow",
            severity: "high",
            requirementType: "separation_rule",
            description: "Rå kød- og fiskevarer må ikke forurene færdige varer.",
            explanation: "Placering og adskillelse er afgørende i køl.",
            whyItMatters: "Forebygger krydskontaminering.",
            authorityLabel: "Fødevarestyrelsen",
            authorityUrl: "",
            canUseAlternativeJustification: false,
            isActive: true,
            sortOrder: 50,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "req_cleanable_surfaces",
            code: "cleanable_surfaces",
            title: "Lofter, vægge og overflader skal være lette at rengøre",
            areaType: "hot_production",
            category: "structure",
            severity: "high",
            requirementType: "surface_material",
            description: "Overflader i fødevareområder skal være i god stand og rengøringsvenlige.",
            explanation: "Beskadigede eller uhensigtsmæssige flader giver hygiejneproblemer.",
            whyItMatters: "Snavs og fugt kan samle sig og forurene fødevarer.",
            authorityLabel: "Fødevarestyrelsen",
            authorityUrl: "",
            canUseAlternativeJustification: true,
            isActive: true,
            sortOrder: 60,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "req_no_rust",
            code: "no_rust_on_equipment",
            title: "Maskiner og redskaber må ikke være rustne eller beskadigede",
            areaType: "hot_production",
            category: "equipment",
            severity: "high",
            requirementType: "equipment_condition",
            description: "Udstyr skal være i god stand og let at rengøre.",
            explanation: "Rust og skader gør udstyr svært at holde hygiejnisk.",
            whyItMatters: "Kan føre til bakteriesamling eller fremmedlegemer.",
            authorityLabel: "Fødevarestyrelsen",
            authorityUrl: "",
            canUseAlternativeJustification: false,
            isActive: true,
            sortOrder: 70,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "req_not_on_floor",
            code: "food_not_on_floor",
            title: "Fødevarer må ikke stå direkte på gulvet",
            areaType: "dry_storage",
            category: "storage",
            severity: "medium",
            requirementType: "storage_rule",
            description: "Varer skal opbevares hævet fra gulvet.",
            explanation: "Gulvet er et forurenet område.",
            whyItMatters: "Forebygger snavs, fugt og skadedyrspåvirkning.",
            authorityLabel: "Fødevarestyrelsen",
            authorityUrl: "",
            canUseAlternativeJustification: false,
            isActive: true,
            sortOrder: 80,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "req_handwash_equipped",
            code: "handwash_station_equipped",
            title: "Håndvask skal have varmt vand, sæbe og papir",
            areaType: "handwash_station",
            category: "hygiene",
            severity: "high",
            requirementType: "hygiene_station",
            description: "Håndvask skal være funktionsdygtig og korrekt udstyret.",
            explanation: "Personlig hygiejne kræver adgang til korrekt håndvask.",
            whyItMatters: "Reducerer risiko for smitte og forurening via hænder.",
            authorityLabel: "Fødevarestyrelsen",
            authorityUrl: "",
            canUseAlternativeJustification: false,
            isActive: true,
            sortOrder: 90,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "req_toilet_access",
            code: "no_direct_toilet_access",
            title: "Der må ikke være direkte adgang fra toilet til produktionsområde",
            areaType: "toilet",
            category: "structure",
            severity: "high",
            requirementType: "structural",
            description: "Toilet må ikke åbne direkte ind til lokale med fødevarer.",
            explanation: "Toiletområde skal være adskilt fra fødevarehåndtering.",
            whyItMatters: "Reducerer risiko for forurening fra toiletområde.",
            authorityLabel: "Fødevarestyrelsen",
            authorityUrl: "",
            canUseAlternativeJustification: true,
            isActive: true,
            sortOrder: 100,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    for (const template of templates) {
        const { id, ...data } = template;

        await db.collection("requirement_templates")
            .doc(id)
            .set(data);

        console.log(`Oprettet requirement template: ${id}`);
    }

    console.log("Requirement templates seed færdig ✅");
}

run().catch((error) => {
    console.error("Fejl i importRequirementTemplates:", error);
});