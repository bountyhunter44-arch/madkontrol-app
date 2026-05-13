// ═══════════════════════════════════════════════════════════════════════════
// RISK ANALYSIS LIBRARY
// Central library for automatic HACCP snapshot generation
// Single source of truth for all control point texts (canonical)
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// CANONICAL_CONTROL_POINTS
// Single source of truth for all HACCP control points.
// Texts are aligned with routine-texts.js (haccpShort) on the frontend.
// Output format: key, title, type, hazard, control, limit, monitoring,
//                correctiveAction, routineKey, frequency, description
// ---------------------------------------------------------------------------
const CANONICAL_CONTROL_POINTS = {
    varemodtagelse: {
        key: "varemodtagelse",
        title: "Varemodtagelse",
        type: "CCP",
        hazard: "Modtagelse af usikre eller for varme varer.",
        description: "Modtagelse af usikre eller for varme varer kan medføre spredning af bakterier og forurening.",
        control: "Tjek temperatur på køle- og frostvarer, emballage, holdbarhed, renhed og leverandørforhold.",
        controlRequirement: "Tjek temperatur på køle- og frostvarer, emballage, holdbarhed, renhed og leverandørforhold.",
        limit: "Varer skal modtages i korrekt temperatur og stand. Kølevarer kolde, frostvarer frosne.",
        criticalLimit: "Varer skal modtages i korrekt temperatur og stand. Kølevarer kolde, frostvarer frosne.",
        monitoring: "Temperatur kontrolleres og dokumenteres ved hver varemodtagelse. Emballage og kvalitet vurderes visuelt.",
        frequency: "Ved hver varemodtagelse",
        correctiveAction: "Afvis vare eller registrér afvigelse.",
        routineKey: "varemodtagelse",
        templateKey: "varemodtagelse"
    },
    opvarmning: {
        key: "opvarmning",
        title: "Opvarmning",
        type: "CCP",
        hazard: "Overlevende bakterier ved utilstrækkelig opvarmning.",
        description: "For lav opvarmning kan betyde, at sygdomsfremkaldende bakterier overlever.",
        control: "Mål kernetemperatur i det tykkeste eller koldeste punkt.",
        controlRequirement: "Mål kernetemperatur i det tykkeste eller koldeste punkt.",
        limit: "Mindst +75 °C i centrum, medmindre anden sikker proces er dokumenteret.",
        criticalLimit: "Mindst +75 °C i centrum, medmindre anden sikker proces er dokumenteret.",
        monitoring: "Kerntemperatur måles og dokumenteres ved hver opvarmning.",
        frequency: "Ved hver opvarmning",
        correctiveAction: "Fortsæt opvarmning eller kassér ved usikkerhed.",
        routineKey: "opvarmning",
        templateKey: "opvarmning"
    },
    nedkoeling: {
        key: "nedkoeling",
        title: "Nedkøling af fødevarer",
        type: "CCP",
        hazard: "Bakterievækst ved langsom nedkøling.",
        description: "Langsom nedkøling kan give vækst af sygdomsfremkaldende bakterier.",
        control: "Mål starttemperatur og starttid. Mål sluttemperatur og sluttid. Brug egnet metode som blæsekøler, isbad, flade kantiner, små portioner eller omrøring.",
        controlRequirement: "Mål starttemperatur og starttid. Mål sluttemperatur og sluttid. Brug egnet metode som blæsekøler, isbad, flade kantiner, små portioner eller omrøring.",
        limit: "Fra ca. +65 °C til under +10 °C på højst 4 timer.",
        criticalLimit: "Fra ca. +65 °C til under +10 °C på højst 4 timer.",
        monitoring: "Temperatur og tid dokumenteres ved start og afslutning af nedkøling.",
        frequency: "Ved hver nedkøling",
        correctiveAction: "Del i mindre portioner, brug effektiv køling eller kassér hvis sikkerhed ikke kan dokumenteres.",
        routineKey: "nedkoeling",
        templateKey: "nedkoeling"
    },
    varmholdelse: {
        key: "varmholdelse",
        title: "Varmholdelse",
        type: "CCP",
        hazard: "Bakterievækst ved for lav varmholdelsestemperatur.",
        description: "For lav varmholdelsestemperatur kan give vækst af sygdomsfremkaldende bakterier.",
        control: "Mål temperaturen i fødevaren eller i varmholdelsesudstyret efter virksomhedens procedure.",
        controlRequirement: "Mål temperaturen i fødevaren eller i varmholdelsesudstyret efter virksomhedens procedure.",
        limit: "Mindst +65 °C.",
        criticalLimit: "Mindst +65 °C.",
        monitoring: "Temperatur kontrolleres og dokumenteres mindst hver time.",
        frequency: "Mindst hver time under varmholdelse",
        correctiveAction: "Genopvarm, justér udstyr eller kassér ved usikkerhed.",
        routineKey: "varmholdelse",
        templateKey: "varmholdelse"
    },
    koeleskab_temperatur: {
        key: "koeleskab_temperatur",
        title: "Køleskabstemperatur",
        type: "CCP",
        hazard: "Bakterievækst ved for høj køletemperatur.",
        description: "For høj temperatur kan give vækst af sygdomsfremkaldende bakterier og forkorte holdbarhed.",
        control: "Mål eller aflæs temperaturen i køleskabet.",
        controlRequirement: "Mål eller aflæs temperaturen i køleskabet.",
        limit: "Normalt højst +5 °C.",
        criticalLimit: "Normalt højst +5 °C.",
        monitoring: "Temperatur kontrolleres og dokumenteres dagligt.",
        frequency: "Dagligt",
        correctiveAction: "Justér køl, flyt varer og registrér afvigelse.",
        routineKey: "koeleskab_temperatur",
        templateKey: "koeleskab_temperatur"
    },
    fryser_temperatur: {
        key: "fryser_temperatur",
        title: "Frysertemperatur",
        type: "CCP",
        hazard: "Optøning og kvalitetsforringelse.",
        description: "For høj frysetemperatur kan give optøning, kvalitetsforringelse og risiko ved senere brug.",
        control: "Mål eller aflæs temperaturen i fryseren.",
        controlRequirement: "Mål eller aflæs temperaturen i fryseren.",
        limit: "Ca. -18 °C eller koldere.",
        criticalLimit: "Ca. -18 °C eller koldere.",
        monitoring: "Temperatur kontrolleres og dokumenteres dagligt.",
        frequency: "Dagligt",
        correctiveAction: "Kontroller udstyr, flyt varer og registrér afvigelse.",
        routineKey: "fryser_temperatur",
        templateKey: "fryser_temperatur"
    },
    walkin_koeler_temperatur: {
        key: "walkin_koeler_temperatur",
        title: "Walk-in køl temperatur",
        type: "CCP",
        hazard: "Mange varer påvirkes ved for høj rumtemperatur.",
        description: "For høj rumtemperatur i walk-in køl kan påvirke mange varer på én gang.",
        control: "Aflæs rumtemperatur og kontroller dør, pakninger, luftcirkulation og om varer spærrer for kølingen.",
        controlRequirement: "Aflæs rumtemperatur og kontroller dør, pakninger, luftcirkulation og om varer spærrer for kølingen.",
        limit: "Normalt højst +5 °C.",
        criticalLimit: "Normalt højst +5 °C.",
        monitoring: "Temperatur kontrolleres og dokumenteres dagligt.",
        frequency: "Dagligt",
        correctiveAction: "Justér køling, flyt varer og registrér afvigelse.",
        routineKey: "walkin_koeler_temperatur",
        templateKey: "walkin_koeler_temperatur"
    },
    walkin_fryser_temperatur: {
        key: "walkin_fryser_temperatur",
        title: "Walk-in frys temperatur",
        type: "CCP",
        hazard: "Optøning og kvalitetsforringelse af store mængder frostvarer.",
        description: "For høj temperatur eller isdannelse i walk-in frys kan påvirke fødevaresikkerhed og kvalitet.",
        control: "Aflæs temperatur, kontroller dør, pakninger, isdannelse og luftcirkulation.",
        controlRequirement: "Aflæs temperatur, kontroller dør, pakninger, isdannelse og luftcirkulation.",
        limit: "Ca. -18 °C eller koldere.",
        criticalLimit: "Ca. -18 °C eller koldere.",
        monitoring: "Temperatur kontrolleres og dokumenteres dagligt.",
        frequency: "Dagligt",
        correctiveAction: "Kontroller udstyr, flyt varer og registrér afvigelse.",
        routineKey: "walkin_fryser_temperatur",
        templateKey: "walkin_fryser_temperatur"
    },
    opvaskemaskine_skyllevand: {
        key: "opvaskemaskine_skyllevand",
        title: "Opvaskemaskine skyllevand",
        type: "GAG",
        hazard: "Utilstrækkelig rengøring og desinfektion ved for lav skylletemperatur.",
        description: "For lav skylletemperatur kan give utilstrækkelig rengøring og overføre bakterier til rent service.",
        control: "Aflæs skyllevandstemperatur eller brug egnet målemetode efter virksomhedens procedure.",
        controlRequirement: "Aflæs skyllevandstemperatur eller brug egnet målemetode efter virksomhedens procedure.",
        limit: "Skal følge maskinens og virksomhedens procedure.",
        criticalLimit: "Skal følge maskinens og virksomhedens procedure.",
        monitoring: "Skyllevandstemperatur og vaskeresultat kontrolleres dagligt.",
        frequency: "Dagligt",
        correctiveAction: "Stop brug, korrigér og vask om nødvendigt om.",
        routineKey: "opvaskemaskine_skyllevand",
        templateKey: "opvaskemaskine_skyllevand"
    },
    blaesekoeler_temperatur: {
        key: "blaesekoeler_temperatur",
        title: "Blæsekøler (intern kontrol)",
        type: "CCP",
        hazard: "For langsom nedkøling ved udstyrsfejl.",
        description: "Hvis blæsekøleren ikke fungerer korrekt, kan nedkølingen blive for langsom og usikker.",
        control: "Kontroller display, program, lufttemperatur, spydfunktion og eventuelt verificering med eget termometer.",
        controlRequirement: "Kontroller display, program, lufttemperatur, spydfunktion og eventuelt verificering med eget termometer.",
        limit: "Intern skærpet standard: ≤+5 °C på 90 min. Generel nedkøling: fra +65 °C til under +10 °C på højst 4 timer. Intern standard er IKKE lovkrav.",
        criticalLimit: "Intern skærpet standard: ≤+5 °C på 90 min. Generel nedkøling: fra +65 °C til under +10 °C på højst 4 timer. Intern standard er IKKE lovkrav.",
        monitoring: "Temperatur og tid dokumenteres ved brug af blæsekøleren.",
        frequency: "Ved brug",
        correctiveAction: "Tjek fyldning, udstyr, spyd og registrér afvigelse.",
        routineKey: "blaesekoeler_temperatur",
        templateKey: "blaesekoeler_temperatur"
    },
    tre_timers_regel: {
        key: "tre_timers_regel",
        title: "3-timers regel",
        type: "CCP",
        hazard: "Bakterievækst ved letfordærvelige fødevarer uden temperaturstyring.",
        description: "Letfordærvelige fødevarer kan blive usikre, hvis de står for længe ved stuetemperatur.",
        control: "Registrér hvornår fødevaren stilles frem, hvornår den senest skal fjernes, og hvornår den faktisk fjernes.",
        controlRequirement: "Registrér hvornår fødevaren stilles frem, hvornår den senest skal fjernes, og hvornår den faktisk fjernes.",
        limit: "Højst 3 timer uden køl/varme.",
        criticalLimit: "Højst 3 timer uden køl/varme.",
        monitoring: "Starttid og fjernelsetid dokumenteres.",
        frequency: "Ved brug",
        correctiveAction: "Fjern og kassér/brug straks. Må ikke sættes tilbage på køl.",
        routineKey: "tre_timers_regel",
        templateKey: "tre_timers_regel"
    },
    allergener: {
        key: "allergener",
        title: "Allergener",
        type: "CCP",
        hazard: "Allergisk reaktion pga. fejl eller krydskontaminering.",
        description: "Forkert allergeninformation eller krydskontaminering kan give alvorlige allergiske reaktioner.",
        control: "Tjek mærkning, opskrifter, råvarer, adskillelse, redskaber og personalets kendskab.",
        controlRequirement: "Tjek mærkning, opskrifter, råvarer, adskillelse, redskaber og personalets kendskab.",
        limit: "Oplysninger og håndtering skal være korrekte.",
        criticalLimit: "Oplysninger og håndtering skal være korrekte.",
        monitoring: "Allergenkontrol dokumenteres regelmæssigt og ved ændringer i opskrifter.",
        frequency: "Løbende og ved ændringer",
        correctiveAction: "Stop salg/servering ved usikkerhed og ret forholdet.",
        routineKey: "allergener",
        templateKey: "allergener"
    },
    adskillelse: {
        key: "adskillelse",
        title: "Adskillelse",
        type: "GAG",
        hazard: "Krydskontaminering mellem rå og spiseklare fødevarer.",
        description: "Bakterier fra råvarer kan overføres til færdige fødevarer ved manglende adskillelse.",
        control: "Tjek opbevaring, arbejdsområder, redskaber, skærebrætter og arbejdsgange.",
        controlRequirement: "Tjek opbevaring, arbejdsområder, redskaber, skærebrætter og arbejdsgange.",
        limit: "Rå og spiseklare varer skal holdes adskilt.",
        criticalLimit: "Rå og spiseklare varer skal holdes adskilt.",
        monitoring: "Adskillelse kontrolleres dagligt.",
        frequency: "Dagligt",
        correctiveAction: "Flyt, rengør/desinficér eller kassér ved forurening.",
        routineKey: "adskillelse",
        templateKey: "adskillelse"
    },
    rengoering: {
        key: "rengoering",
        title: "Rengøring",
        type: "GAG",
        hazard: "Forurening og krydskontaminering ved mangelfuld rengøring.",
        description: "Mangelfuld rengøring kan give bakterievækst, krydskontaminering, biofilm og skadedyrsrisiko.",
        control: "Kontroller synlig renhed, kontaktflader, hjørner, kanter, pakninger, håndtag og områder hvor snavs kan samle sig.",
        controlRequirement: "Kontroller synlig renhed, kontaktflader, hjørner, kanter, pakninger, håndtag og områder hvor snavs kan samle sig.",
        limit: "Udstyr/område skal være rent før brug.",
        criticalLimit: "Udstyr/område skal være rent før brug.",
        monitoring: "Rengøring udføres og dokumenteres efter fast plan.",
        frequency: "Efter rengøringsplan",
        correctiveAction: "Rengør igen, desinficér og registrér afvigelse.",
        routineKey: "rengoering",
        templateKey: "rengoering"
    },
    sporbarhed: {
        key: "sporbarhed",
        title: "Sporbarhed",
        type: "GAG",
        hazard: "Manglende mulighed for tilbagekaldelse af usikre varer.",
        description: "Manglende sporbarhed gør det svært at tilbagekalde usikre fødevarer hurtigt.",
        control: "Tjek faktura, følgeseddel, batch/lot, leverandør og datomærkning.",
        controlRequirement: "Tjek faktura, følgeseddel, batch/lot, leverandør og datomærkning.",
        limit: "Varer skal kunne spores ét led tilbage og ét led frem.",
        criticalLimit: "Varer skal kunne spores ét led tilbage og ét led frem.",
        monitoring: "Sporbarhed kontrolleres regelmæssigt og ved kontrolbesøg.",
        frequency: "Løbende",
        correctiveAction: "Fremskaf dokumentation eller tag varen ud af brug.",
        routineKey: "sporbarhed",
        templateKey: "sporbarhed"
    },
    tilbagetraekning: {
        key: "tilbagetraekning",
        title: "Tilbagetrækning",
        type: "GAG",
        hazard: "Usikre varer bruges eller sælges ved manglende procedure.",
        description: "Manglende procedure for tilbagetrækning kan forsinke fjernelse af farlige fødevarer.",
        control: "Tjek procedure, kontaktliste, leverandørinformation og intern håndtering.",
        controlRequirement: "Tjek procedure, kontaktliste, leverandørinformation og intern håndtering.",
        limit: "Berørte varer skal kunne stoppes og fjernes.",
        criticalLimit: "Berørte varer skal kunne stoppes og fjernes.",
        monitoring: "Procedure gennemgås og testes årligt.",
        frequency: "Årligt",
        correctiveAction: "Stop brug/salg, isolér og dokumentér.",
        routineKey: "tilbagetraekning",
        templateKey: "tilbagetraekning"
    },
    aarlig_revision: {
        key: "aarlig_revision",
        title: "Årlig revision af egenkontrolprogram",
        type: "GAG",
        hazard: "Forældet egenkontrolprogram dækker ikke aktuel drift.",
        description: "Ændringer i drift, udstyr, varer eller medarbejdere kan gøre programmet forældet.",
        control: "Gennemgå rutiner, risici, udstyr, varetyper, rengøringsplan, afvigelser og dokumentation.",
        controlRequirement: "Gennemgå rutiner, risici, udstyr, varetyper, rengøringsplan, afvigelser og dokumentation.",
        limit: "Programmet skal passe til aktuel drift.",
        criticalLimit: "Programmet skal passe til aktuel drift.",
        monitoring: "Revision gennemføres og dokumenteres mindst én gang årligt.",
        frequency: "Mindst årligt",
        correctiveAction: "Opdater program, rutiner og ansvar.",
        routineKey: "aarlig_revision",
        templateKey: "aarlig_revision"
    },
    personlig_hygiejne: {
        key: "personlig_hygiejne",
        title: "Personlig hygiejne",
        type: "GAG",
        hazard: "Forurening fra medarbejdere ved dårlig håndhygiejne eller sygdom.",
        description: "Dårlig håndhygiejne, sygdom eller forkert beklædning kan forurene fødevarer.",
        control: "Tjek håndvask, arbejdsbeklædning, sårbeskyttelse, sygdomsprocedure og smykker.",
        controlRequirement: "Tjek håndvask, arbejdsbeklædning, sårbeskyttelse, sygdomsprocedure og smykker.",
        limit: "Hygiejneprocedure skal følges.",
        criticalLimit: "Hygiejneprocedure skal følges.",
        monitoring: "Hygiejne kontrolleres løbende.",
        frequency: "Løbende",
        correctiveAction: "Korrigér adfærd og dokumentér afvigelse.",
        routineKey: "personlig_hygiejne",
        templateKey: "personlig_hygiejne"
    },
    opbevaring: {
        key: "opbevaring",
        title: "Opbevaring",
        type: "GAG",
        hazard: "Forurening, fejltemperatur eller for gamle varer ved forkert opbevaring.",
        description: "Forkert opbevaring kan give forurening, fejltemperatur eller brug af for gamle varer.",
        control: "Tjek datomærkning, adskillelse, emballage, orden, FIFO og temperaturforhold.",
        controlRequirement: "Tjek datomærkning, adskillelse, emballage, orden, FIFO og temperaturforhold.",
        limit: "Varer skal opbevares korrekt og være beskyttede.",
        criticalLimit: "Varer skal opbevares korrekt og være beskyttede.",
        monitoring: "Opbevaring kontrolleres dagligt.",
        frequency: "Dagligt",
        correctiveAction: "Flyt, mærk eller kassér varer ved fejl.",
        routineKey: "opbevaring",
        templateKey: "opbevaring"
    }
};

// ---------------------------------------------------------------------------
// INDUSTRY PROFILES
// Defines which control points are relevant per industry type.
// Equipment-conditional points (walkin, blaesekoeler) are added dynamically.
// ---------------------------------------------------------------------------
const INDUSTRY_PROFILES = {
    restaurant: {
        displayName: "Restaurant",
        baseKeys: [
            "varemodtagelse",
            "opvarmning",
            "nedkoeling",
            "varmholdelse",
            "tre_timers_regel",
            "koeleskab_temperatur",
            "fryser_temperatur",
            "rengoering",
            "adskillelse",
            "allergener",
            "sporbarhed",
            "tilbagetraekning",
            "aarlig_revision"
        ]
    },
    cafe: {
        displayName: "Café",
        baseKeys: [
            "varemodtagelse",
            "koeleskab_temperatur",
            "fryser_temperatur",
            "rengoering",
            "adskillelse",
            "allergener",
            "sporbarhed",
            "tilbagetraekning",
            "aarlig_revision"
        ]
    },
    market: {
        displayName: "Købmand / Butik",
        baseKeys: [
            "varemodtagelse",
            "koeleskab_temperatur",
            "fryser_temperatur",
            "rengoering",
            "sporbarhed",
            "tilbagetraekning",
            "aarlig_revision"
        ]
    }
};

// Fallback profile used when industry is not recognized
const DEFAULT_PROFILE = INDUSTRY_PROFILES.restaurant;

// Backward-compat: keep RISK_LIBRARY populated from canonical data
const RISK_LIBRARY = (() => {
    const result = {};
    for (const [industry, profile] of Object.entries(INDUSTRY_PROFILES)) {
        result[industry] = {
            industry,
            displayName: profile.displayName,
            controlPoints: profile.baseKeys
                .filter(k => CANONICAL_CONTROL_POINTS[k])
                .map(k => {
                    const cp = CANONICAL_CONTROL_POINTS[k];
                    return {
                        key: cp.key,
                        title: cp.title,
                        hazard: cp.hazard,
                        limit: cp.limit,
                        monitoring: cp.monitoring,
                        correctiveAction: cp.correctiveAction,
                        routineKey: cp.routineKey,
                        type: cp.type
                    };
                })
        };
    }
    return result;
})();

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function normalizeIndustry(industry) {
    if (!industry) return "restaurant";

    const normalized = String(industry).toLowerCase().trim();

    const mapping = {
        restaurant: "restaurant",
        cafe: "cafe",
        café: "cafe",
        coffee: "cafe",
        kaffebar: "cafe",
        market: "market",
        købmand: "market",
        supermarket: "market",
        butik: "market",
        shop: "market",
        store: "market"
    };

    return mapping[normalized] || "restaurant";
}

// ---------------------------------------------------------------------------
// selectControlPointKeys
// Selects which canonical control point keys apply based on industry profile
// and onboarding profile (equipment, processes).
// ---------------------------------------------------------------------------
function selectControlPointKeys(normalizedIndustry, profile) {
    const industryProfile = INDUSTRY_PROFILES[normalizedIndustry] || DEFAULT_PROFILE;
    const keys = [...industryProfile.baseKeys];

    const equipment = profile.equipment || {};
    const units = Array.isArray(equipment.units) ? equipment.units : [];
    const selected = Array.isArray(equipment.selected) ? equipment.selected : [];

    const hasWalkinKoeler = units.some(u =>
        String(u.type || u.unitType || "").toLowerCase().includes("walk") &&
        (String(u.type || u.unitType || "").toLowerCase().includes("cool") ||
         String(u.type || u.unitType || "").toLowerCase().includes("koel") ||
         String(u.type || u.unitType || "").toLowerCase().includes("koeler"))
    ) || selected.includes("walk_in_cooler") || selected.includes("walkin_koeler");

    const hasWalkinFryser = units.some(u =>
        String(u.type || u.unitType || "").toLowerCase().includes("walk") &&
        (String(u.type || u.unitType || "").toLowerCase().includes("freez") ||
         String(u.type || u.unitType || "").toLowerCase().includes("frys"))
    ) || selected.includes("walk_in_freezer") || selected.includes("walkin_fryser");

    const hasBlaesekoeler = units.some(u =>
        String(u.type || u.unitType || "").toLowerCase().includes("blast") ||
        String(u.type || u.unitType || "").toLowerCase().includes("blase") ||
        String(u.type || u.unitType || "").toLowerCase().includes("blaese")
    ) || selected.includes("blast_chiller") || selected.includes("blaesekoeler");

    const hasDishwasher = units.some(u =>
        String(u.type || u.unitType || "").toLowerCase().includes("dish") ||
        String(u.type || u.unitType || "").toLowerCase().includes("opvask")
    ) || selected.includes("dishwasher") || selected.includes("opvaskemaskine");

    if (hasWalkinKoeler && !keys.includes("walkin_koeler_temperatur")) {
        keys.push("walkin_koeler_temperatur");
    }
    if (hasWalkinFryser && !keys.includes("walkin_fryser_temperatur")) {
        keys.push("walkin_fryser_temperatur");
    }
    if (hasBlaesekoeler && !keys.includes("blaesekoeler_temperatur")) {
        keys.push("blaesekoeler_temperatur");
    }
    if (hasDishwasher && !keys.includes("opvaskemaskine_skyllevand")) {
        keys.push("opvaskemaskine_skyllevand");
    }

    return keys.filter(k => CANONICAL_CONTROL_POINTS[k]);
}

// ---------------------------------------------------------------------------
// generateRiskAnalysisSnapshot
// Builds a HACCP snapshot from CANONICAL_CONTROL_POINTS.
// profile: optional onboarding profile object (equipment, processes, etc.)
// ---------------------------------------------------------------------------
function generateRiskAnalysisSnapshot({ companyId, locationId, organizationId, industry, companyName, profile }) {
    const normalizedIndustry = normalizeIndustry(industry);
    const safeProfile = profile || {};

    const keys = selectControlPointKeys(normalizedIndustry, safeProfile);

    const controlPoints = keys.map(k => {
        const cp = CANONICAL_CONTROL_POINTS[k];
        return {
            id: cp.key,
            key: cp.key,
            templateKey: cp.templateKey,
            title: cp.title,
            type: cp.type,
            hazard: cp.hazard,
            description: cp.description,
            control: cp.control,
            controlRequirement: cp.controlRequirement,
            limit: cp.limit,
            criticalLimit: cp.criticalLimit,
            monitoring: cp.monitoring,
            frequency: cp.frequency,
            correctiveAction: cp.correctiveAction,
            routineKey: cp.routineKey
        };
    });

    const routineKeys = controlPoints.map(cp => cp.routineKey);
    const industryProfile = INDUSTRY_PROFILES[normalizedIndustry] || DEFAULT_PROFILE;

    return {
        companyId: companyId,
        locationId: locationId,
        organizationId: organizationId || companyId,
        industry: normalizedIndustry,
        industryDisplayName: industryProfile.displayName,
        autoGenerated: true,
        version: "2.0.0",
        controlPoints: controlPoints,
        hazards: controlPoints.map(cp => ({
            name: cp.title,
            description: cp.hazard,
            type: cp.type
        })),
        limits: controlPoints.map(cp => ({
            controlPointKey: cp.key,
            limit: cp.limit
        })),
        monitoring: controlPoints.map(cp => ({
            controlPointKey: cp.key,
            procedure: cp.monitoring
        })),
        correctiveActions: controlPoints.map(cp => ({
            controlPointKey: cp.key,
            action: cp.correctiveAction
        })),
        routineKeys: routineKeys,
        onboardingSnapshot: {
            companyName: companyName || "",
            companyType: normalizedIndustry,
            restaurantType: normalizedIndustry
        },
        totalControlPoints: controlPoints.length,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
    CANONICAL_CONTROL_POINTS,
    INDUSTRY_PROFILES,
    RISK_LIBRARY,
    normalizeIndustry,
    generateRiskAnalysisSnapshot
};
