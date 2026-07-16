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
    console.log("Seeder risk templates...");

    const templates = [
        {
            id: "risk_temp_cooler",
            code: "temperature_abuse_cooler",
            title: "For høj temperatur i køl",
            areaType: "walk_in_cooler",
            activityType: "storage",
            hazardType: "biological",
            severity: "high",
            isCritical: true,
            description: "For høj temperatur kan give vækst af bakterier.",
            riskReason: "Kølekrævende varer kan blive sundhedsskadelige ved for høj temperatur.",
            exampleScenario: "Kølerum målt til 8 °C.",
            recommendedControl: "Daglig temperaturkontrol og hurtig handling ved afvigelse.",
            isActive: true,
            sortOrder: 10,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "risk_temp_freezer",
            code: "temperature_abuse_freezer",
            title: "For høj temperatur i fryser",
            areaType: "walk_in_freezer",
            activityType: "storage",
            hazardType: "biological",
            severity: "high",
            isCritical: true,
            description: "Frostvarer kan tage skade ved utilstrækkelig frysetemperatur.",
            riskReason: "Optøning og genfrysning kan give kvalitetstab og risiko.",
            exampleScenario: "Fryserum målt til -12 °C.",
            recommendedControl: "Kontrol af frysetemperatur og handling ved fejl.",
            isActive: true,
            sortOrder: 20,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "risk_cross_contam",
            code: "cross_contamination_raw_ready",
            title: "Krydskontaminering mellem rå og færdige varer",
            areaType: "walk_in_cooler",
            activityType: "storage",
            hazardType: "biological",
            severity: "high",
            isCritical: true,
            description: "Rå varer kan forurene spiseklare varer.",
            riskReason: "Dryp og kontakt kan sprede bakterier.",
            exampleScenario: "Rå kylling opbevaret over salat.",
            recommendedControl: "Adskillelse og fast placering i køl.",
            isActive: true,
            sortOrder: 30,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "risk_poor_cleaning",
            code: "poor_cleaning",
            title: "Utilstrækkelig rengøring",
            areaType: "hot_production",
            activityType: "cleaning",
            hazardType: "biological",
            severity: "high",
            isCritical: false,
            description: "Snavs og madrester kan give bakterievækst.",
            riskReason: "Manglende rengøring øger risiko for forurening.",
            exampleScenario: "Beskidte skærebrætter og madrester på arbejdsborde.",
            recommendedControl: "Fast rengøringsplan og visuel kontrol.",
            isActive: true,
            sortOrder: 40,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "risk_pests",
            code: "pest_contamination",
            title: "Forurening fra skadedyr",
            areaType: "dry_storage",
            activityType: "storage",
            hazardType: "biological",
            severity: "high",
            isCritical: false,
            description: "Skadedyr kan forurene fødevarer og emballage.",
            riskReason: "Mus, insekter og spor giver hygiejneproblemer.",
            exampleScenario: "Spor af skadedyr i lagerområde.",
            recommendedControl: "Visuel kontrol, tæt indretning og hurtig reaktion.",
            isActive: true,
            sortOrder: 50,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "risk_parasites_fish",
            code: "parasites_raw_fish",
            title: "Parasitter i fisk til rå servering",
            areaType: "cold_production",
            activityType: "fish_handling",
            hazardType: "biological",
            severity: "high",
            isCritical: true,
            description: "Rå fisk kan indeholde parasitter uden korrekt behandling.",
            riskReason: "Rå servering kræver særlig kontrol og evt. indfrysning.",
            exampleScenario: "Fisk bruges til rå retter uden dokumentation.",
            recommendedControl: "Kontrol af dokumentation eller korrekt indfrysning.",
            isActive: true,
            sortOrder: 60,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "risk_damaged_equipment",
            code: "foreign_objects_from_damaged_equipment",
            title: "Fremmedlegemer fra beskadiget udstyr",
            areaType: "hot_production",
            activityType: "production",
            hazardType: "physical",
            severity: "medium",
            isCritical: false,
            description: "Skadet udstyr kan afgive metal, plast eller andre partikler.",
            riskReason: "Rust og slid kan påvirke fødevaresikkerheden.",
            exampleScenario: "Rustent piskeris eller revnet plastredskab.",
            recommendedControl: "Løbende kontrol og udskiftning af beskadiget udstyr.",
            isActive: true,
            sortOrder: 70,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            id: "risk_allergen_cross",
            code: "allergen_cross_contact",
            title: "Krydskontakt med allergener",
            areaType: "cold_production",
            activityType: "production",
            hazardType: "allergen",
            severity: "high",
            isCritical: false,
            description: "Allergener kan overføres mellem retter ved forkert håndtering.",
            riskReason: "Manglende adskillelse og rengøring kan give fejl til gæster.",
            exampleScenario: "Nødder håndteres på samme bord uden rengøring imellem.",
            recommendedControl: "Adskillelse, rengøring og tydelige arbejdsgange.",
            isActive: true,
            sortOrder: 80,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];

    for (const template of templates) {
        const { id, ...data } = template;

        await db.collection("risk_templates")
            .doc(id)
            .set(data);

        console.log(`Oprettet risk template: ${id}`);
    }

    console.log("Risk templates seed færdig ✅");
}

run().catch((error) => {
    console.error("Fejl i importRiskTemplates:", error);
});