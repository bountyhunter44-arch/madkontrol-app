# FILE: functions/guideLibrary.js

```javascript
/**
 * Guide Library - Canonical guide definitions
 * Each guide has a stable key and complete content
 */

const GUIDE_LIBRARY = {
    fridge_temperature: {
        key: "fridge_temperature",
        version: "1.0",
        title: "Temperaturkontrol af køleskab",
        purpose: "Sikre at køleskabe holder korrekt temperatur for at forhindre bakterievækst",
        whenToUse: "Daglig kontrol af køleskabe og kølediske",
        equipment: "Kalibreret termometer",
        steps: [
            "Åbn køleskabet og placer termometer på midterste hylde",
            "Vent 2-3 minutter for stabil aflæsning",
            "Aflæs og registrér temperatur",
            "Kontrollér at temperatur er max 5°C",
            "Tjek at døre lukker tæt og pakninger er intakte"
        ],
        deviationSteps: [
            "Ved temperatur over 5°C: Undersøg årsag (døre åbne, defekt udstyr)",
            "Flyt kritiske varer til fungerende køl hvis temperatur over 8°C",
            "Juster termostat eller kontakt tekniker",
            "Dokumentér afvigelse og handling"
        ],
        documentation: "Registrér temperatur, tidspunkt og evt. afvigelser i systemet"
    },

    walkin_cooler_temperature: {
        key: "walkin_cooler_temperature",
        version: "1.0",
        title: "Temperaturkontrol af walk-in køler",
        purpose: "Sikre at walk-in kølere holder korrekt temperatur for sikker opbevaring",
        whenToUse: "Daglig kontrol af walk-in kølerum",
        equipment: "Kalibreret termometer, evt. fast monteret display",
        steps: [
            "Aflæs temperatur på fast display eller placer termometer centralt i rummet",
            "Vent 2-3 minutter for stabil aflæsning hvis manuel måling",
            "Aflæs og registrér temperatur",
            "Kontrollér at temperatur er max 5°C",
            "Tjek at døre lukker korrekt, ingen is-ophobning på fordamper",
            "Verificér at varer er korrekt placeret med luftcirkulation"
        ],
        deviationSteps: [
            "Ved temperatur over 5°C: Undersøg årsag (dør åben for længe, defekt køleaggregat)",
            "Flyt kritiske varer til fungerende køl hvis temperatur over 8°C",
            "Kontakt kølemontør ved vedvarende problemer",
            "Dokumentér afvigelse og handling"
        ],
        documentation: "Registrér temperatur, tidspunkt og evt. afvigelser"
    },

    cold_storage_placement: {
        key: "cold_storage_placement",
        version: "1.0",
        title: "Kontrol af korrekt placering i køl",
        purpose: "Sikre korrekt placering og opbevaring af varer i køleenheder",
        whenToUse: "Daglig kontrol af vareplacering og FIFO-princip",
        equipment: "Visuel inspektion",
        steps: [
            "Kontrollér at råvarer er adskilt fra færdige produkter",
            "Verificér at FIFO-princippet følges (først ind, først ud)",
            "Tjek at varer er korrekt mærket med dato",
            "Kontrollér at varer ikke blokerer luftcirkulation",
            "Verificér at intet opbevares direkte på gulv"
        ],
        deviationSteps: [
            "Ret forkert placering straks",
            "Fjern udgåede varer",
            "Instruer personale i korrekt praksis",
            "Dokumentér afvigelse"
        ],
        documentation: "Registrér kontrol og evt. korrigerende handlinger"
    },

    freezer_temperature: {
        key: "freezer_temperature",
        version: "1.0",
        title: "Temperaturkontrol af frost",
        purpose: "Sikre at frysere holder korrekt temperatur for langtidsopbevaring",
        whenToUse: "Daglig kontrol af alle fryseenheder",
        equipment: "Kalibreret termometer egnet til lave temperaturer",
        steps: [
            "Åbn fryser og placer termometer mellem varerne",
            "Vent 2-3 minutter for stabil aflæsning",
            "Aflæs og registrér temperatur",
            "Kontrollér at temperatur er max -18°C",
            "Tjek for is-ophobning og at døre lukker korrekt"
        ],
        deviationSteps: [
            "Ved temperatur over -18°C: Undersøg årsag",
            "Flyt varer til fungerende fryser hvis temperatur over -12°C",
            "Kontakt tekniker ved vedvarende problemer",
            "Dokumentér afvigelse og handling"
        ],
        documentation: "Registrér temperatur, tidspunkt og evt. afvigelser"
    },

    hot_holding: {
        key: "hot_holding",
        version: "1.0",
        title: "Temperaturkontrol ved varmholdelse",
        purpose: "Sikre at varme retter holdes ved sikker temperatur",
        whenToUse: "Løbende kontrol af varmholdelse (bain marie, varmeskabe)",
        equipment: "Kalibreret kernetermometer",
        steps: [
            "Stik termometer ind i centrum af retten",
            "Vent til temperatur er stabil",
            "Aflæs og registrér temperatur",
            "Kontrollér at temperatur er minimum 56°C",
            "Tjek at varmholdelsesudstyr fungerer korrekt"
        ],
        deviationSteps: [
            "Ved temperatur under 56°C: Øg varme øjeblikkeligt",
            "Hvis temperatur ikke kan nås: Kassér varen",
            "Dokumentér afvigelse og handling"
        ],
        documentation: "Registrér temperatur, ret, tidspunkt og evt. afvigelser"
    },

    reheating: {
        key: "reheating",
        version: "1.0",
        title: "Genopvarmning af retter",
        purpose: "Sikre at genopvarmede retter når sikker kernetemperatur",
        whenToUse: "Ved genopvarmning af tidligere tilberedte retter",
        equipment: "Kalibreret kernetermometer",
        steps: [
            "Opvarm ret til minimum 75°C i hele fødevaren",
            "Stik termometer ind i den koldeste del (centrum)",
            "Vent til temperatur er stabil",
            "Kontrollér at 75°C er nået",
            "Servér straks eller hold varm ved min. 56°C"
        ],
        deviationSteps: [
            "Ved temperatur under 75°C: Fortsæt opvarmning",
            "Hvis 75°C ikke kan nås: Kassér varen",
            "Dokumentér afvigelse"
        ],
        documentation: "Registrér temperatur, ret og tidspunkt"
    },

    hot_preparation_core_temperature: {
        key: "hot_preparation_core_temperature",
        version: "1.0",
        title: "Kernetemperaturkontrol ved tilberedning",
        purpose: "Sikre at kød, fjerkræ og andre kritiske fødevarer når sikker kernetemperatur ved tilberedning",
        whenToUse: "Ved tilberedning af kød, fjerkræ, fisk og andre kritiske råvarer",
        equipment: "Kalibreret kernetermometer",
        steps: [
            "Stik termometer ind i den tykkeste del af kødet (centrum)",
            "Undgå at ramme knogler eller fedtlommer",
            "Vent til temperatur er stabil",
            "Kontrollér at minimum 75°C er nået i hele fødevaren",
            "For fjerkræ: minimum 75°C, for hakket kød: minimum 70°C"
        ],
        deviationSteps: [
            "Ved temperatur under 75°C: Fortsæt tilberedning",
            "Mål igen efter yderligere tilberedning",
            "Hvis korrekt temperatur ikke kan nås: Kassér varen",
            "Dokumentér afvigelse og handling"
        ],
        documentation: "Registrér kernetemperatur, ret, tilberedningstid og tidspunkt"
    },

    cold_preparation_hygiene: {
        key: "cold_preparation_hygiene",
        version: "1.0",
        title: "Hygiejnekontrol ved kold tilberedning",
        purpose: "Forebygge krydskontaminering ved tilberedning af kolde retter",
        whenToUse: "Ved tilberedning af salater, kolde forretter og andre retter uden opvarmning",
        equipment: "Separate skærebrætter, knive, håndvask",
        steps: [
            "Vask hænder grundigt før start",
            "Brug separate skærebrætter for råvarer og færdige produkter",
            "Hold råvarer adskilt fra færdige produkter",
            "Kontrollér at alle ingredienser er friske og inden for holdbarhed",
            "Opbevar kolde retter ved max 5°C indtil servering",
            "Rengør og desinficér alle kontaktflader løbende"
        ],
        deviationSteps: [
            "Ved mistanke om krydskontaminering: Kassér berørte produkter",
            "Rengør og desinficér alle kontaktflader grundigt",
            "Instruer personale i korrekt praksis",
            "Dokumentér hændelse og korrigerende handling"
        ],
        documentation: "Registrér kontrol, eventuelle afvigelser og korrigerende handlinger"
    },

    receiving_goods: {
        key: "receiving_goods",
        version: "1.0",
        title: "Modtagekontrol af varer",
        purpose: "Sikre at modtagne varer opfylder kvalitets- og sikkerhedskrav",
        whenToUse: "Ved hver varelevering",
        equipment: "Termometer, notesbog/tablet",
        steps: [
            "Tjek leveringstidspunkt og transportforhold",
            "Kontrollér temperatur på køle-/fryservarer (køl max 5°C, frost max -18°C)",
            "Tjek emballage for skader, fugt eller snavs",
            "Kontrollér holdbarhedsdatoer og mærkning",
            "Verificér at bestilling matcher levering",
            "Placer varer korrekt i køl/frost straks"
        ],
        deviationSteps: [
            "Afvis varer med forkert temperatur, beskadiget emballage eller overskredet holdbarhed",
            "Dokumentér afvigelse med foto og noter",
            "Kontakt leverandør og informer ansvarlig",
            "Returner eller kassér afviste varer"
        ],
        documentation: "Registrér leveringstidspunkt, temperaturer, leverandør og evt. afvigelser"
    },

    allergen_control: {
        key: "allergen_control",
        version: "1.0",
        title: "Kontrol af allergenhåndtering",
        purpose: "Forebygge krydskontaminering og sikre korrekt allergenmærkning",
        whenToUse: "Daglig kontrol af allergenrutiner",
        equipment: "Tjekliste, mærkningsudstyr",
        steps: [
            "Kontrollér at allergenholdige ingredienser er mærket og adskilt",
            "Tjek at separate redskaber bruges til allergenfrie produkter",
            "Verificér at menukort og mærkning er opdateret og korrekt",
            "Kontrollér at personale kender allergenrutiner",
            "Tjek rengøring mellem allergenholdige og allergenfrie produktioner"
        ],
        deviationSteps: [
            "Ret fejl i mærkning eller opbevaring straks",
            "Kassér produkter ved mistanke om krydskontaminering",
            "Instruer personale i korrekt praksis",
            "Dokumentér hændelse og korrigerende handling"
        ],
        documentation: "Registrér kontrol, fund og evt. korrigerende handlinger"
    },

    cleaning_control: {
        key: "cleaning_control",
        version: "1.0",
        title: "Rengøringskontrol",
        purpose: "Sikre at rengøring er udført korrekt i alle områder",
        whenToUse: "Daglig kontrol efter rengøring",
        equipment: "Visuel inspektion, evt. ATP-måler",
        steps: [
            "Kontrollér alle arbejdsflader for synlig renhed",
            "Tjek gulve, vægge og lofter i produktionsområder",
            "Kontrollér rengøring af udstyr og maskiner",
            "Verificér at rengøringsmidler er korrekt opbevaret",
            "Tjek afløb og sanitære faciliteter"
        ],
        deviationSteps: [
            "Udfør rengøring igen ved mangler",
            "Dokumentér område og handling",
            "Instruer ansvarlig medarbejder",
            "Følg op ved gentagne problemer"
        ],
        documentation: "Registrér kontrol, områder tjekket og evt. mangler"
    },

    equipment_maintenance: {
        key: "equipment_maintenance",
        version: "1.0",
        title: "Kontrol af udstyrsvedligeholdelse",
        purpose: "Sikre korrekt vedligeholdelse og hygiejne af køkkenudstyr for at forhindre forurening",
        whenToUse: "Ugentlig kontrol af udstyr og maskiner",
        equipment: "Visuel inspektion, vedligeholdelseslog",
        steps: [
            "Inspicer udstyr for synlige skader, slitage eller defekter",
            "Kontrollér at udstyr er korrekt rengjort og vedligeholdt",
            "Tjek at alle dele fungerer korrekt (døre, pakninger, termostater)",
            "Verificér at vedligeholdelsesplan følges",
            "Dokumentér inspektion og eventuelle fund"
        ],
        deviationSteps: [
            "Rengør udstyr omgående hvis mangelfuld rengøring konstateres",
            "Tag defekt udstyr ud af drift og mærk tydeligt",
            "Bestil service eller reparation ved tekniske problemer",
            "Dokumentér afvigelse og korrigerende handling"
        ],
        documentation: "Registrér inspektion, udstyrsstatus og evt. vedligeholdelseshandlinger"
    },

    date_check: {
        key: "date_check",
        version: "1.0",
        title: "Holdbarhedskontrol",
        purpose: "Sikre at udgåede varer fjernes og FIFO-princip følges",
        whenToUse: "Daglig kontrol af alle opbevarede varer",
        equipment: "Notesbog/tablet",
        steps: [
            "Gennemgå alle køle- og frostenheder",
            "Tjek holdbarhedsdatoer på alle varer",
            "Fjern udgåede produkter",
            "Kontrollér at FIFO-princip følges (først ind, først ud)",
            "Verificér korrekt mærkning af åbnede produkter"
        ],
        deviationSteps: [
            "Kassér alle udgåede varer straks",
            "Dokumentér kasserede varer",
            "Ret FIFO-rækkefølge hvis nødvendigt",
            "Instruer personale i korrekt praksis"
        ],
        documentation: "Registrér kontrol og evt. kasserede varer"
    },

    personal_hygiene_check: {
        key: "personal_hygiene_check",
        version: "1.0",
        title: "Kontrol af personlig hygiejne",
        purpose: "Sikre at personale følger hygiejneregler",
        whenToUse: "Daglig observation af personale",
        equipment: "Visuel observation, tjekliste",
        steps: [
            "Kontrollér at personale vasker hænder korrekt og ved relevante tidspunkter",
            "Tjek at arbejdstøj er rent og korrekt anvendt",
            "Verificér at smykker, ure og neglelak ikke bæres",
            "Kontrollér at hår er dækket/bundet tilbage",
            "Tjek at syge medarbejdere ikke håndterer fødevarer"
        ],
        deviationSteps: [
            "Instruer medarbejder i korrekt praksis straks",
            "Dokumentér hændelse",
            "Gentag instruktion ved gentagne problemer",
            "Informer ansvarlig ved alvorlige overtrædelser"
        ],
        documentation: "Registrér kontrol og evt. instruktioner givet"
    },

    closing_routine: {
        key: "closing_routine",
        version: "1.0",
        title: "Lukkerutine",
        purpose: "Sikre at alle kritiske kontroller er udført før lukning",
        whenToUse: "Ved dagens afslutning",
        equipment: "Tjekliste",
        steps: [
            "Kontrollér at alle temperaturer er registreret",
            "Tjek at alle rengøringsopgaver er udført",
            "Verificér at alle varer er korrekt opbevaret",
            "Kontrollér at udstyr er slukket/sat korrekt",
            "Tjek at døre og vinduer er låst",
            "Verificér at affald er fjernet"
        ],
        deviationSteps: [
            "Fuldfør manglende opgaver før lukning",
            "Dokumentér afvigelser",
            "Informer ansvarlig ved kritiske mangler",
            "Følg op næste dag"
        ],
        documentation: "Registrér at lukkerutine er gennemført og evt. mangler"
    },

    drain_maintenance: {
        key: "drain_maintenance",
        version: "1.0",
        title: "Kontrol og rengøring af afløb",
        purpose: "Forebygge tilstopning, lugt og skadedyr via korrekt afløbsvedligehold",
        whenToUse: "Daglig kontrol og rengøring af gulvafløb",
        equipment: "Handsker, rengøringsmiddel, børste",
        steps: [
            "Løft rist op og inspicér afløbskoppe",
            "Fjern madrester og snavs fra koppe og rist",
            "Rengør rist og koppe grundigt med varmt vand og rengøringsmiddel",
            "Kontrollér at vandlås indeholder vand (forebygger lugt)",
            "Placer rist korrekt tilbage",
            "Tjek gulvområde omkring afløb for renhed"
        ],
        deviationSteps: [
            "Ved madrester: Rengør straks og tag dokumentationsfoto",
            "Ved tom vandlås: Fyld ca. 1 dl vand i",
            "Ved tilstopning: Kontakt VVS-tekniker",
            "Ved gentagne problemer: Undersøg årsag og juster rutiner"
        ],
        documentation: "Registrér kontrol, rengøring og evt. fund"
    },

    equipment_cleaning: {
        key: "equipment_cleaning",
        version: "1.0",
        title: "Rengøring og vedligehold af udstyr",
        purpose: "Sikre korrekt rengøring af produktionsudstyr",
        whenToUse: "Daglig efter brug, eller iht. rengøringsplan",
        equipment: "Godkendte rengøringsmidler, børster, klud",
        steps: [
            "Adskil udstyr i dele der skal håndvaskes",
            "Rengør alle dele grundigt med godkendt middel",
            "Skyl grundigt for at fjerne rengøringsmiddel",
            "Lad dele lufttørre eller tør med rent håndklæde",
            "Saml udstyr korrekt igen",
            "Kontrollér at udstyr fungerer efter rengøring"
        ],
        deviationSteps: [
            "Ved synlige rester: Rengør igen",
            "Ved defekt udstyr: Tag ud af drift og marker tydeligt",
            "Dokumentér problem og kontakt ansvarlig/tekniker",
            "Brug alternativt udstyr indtil reparation"
        ],
        documentation: "Registrér udstyr rengjort og evt. problemer"
    },

    ice_equipment: {
        key: "ice_equipment",
        version: "1.0",
        title: "Kontrol af ismaskiner og softice",
        purpose: "Sikre korrekt temperatur og hygiejne i iskritisk udstyr",
        whenToUse: "Daglig kontrol og rengøring iht. producentanvisning",
        equipment: "Termometer, godkendte rengøringsmidler",
        steps: [
            "Kontrollér temperatur (max -18°C for is, produktspecifikt for softice)",
            "Tjek produktberørte dele for renhed",
            "Kontrollér pakninger, slanger og doseringsdele",
            "Verificér at desinfektion er skyllet korrekt væk",
            "Tjek at maskine fungerer optimalt"
        ],
        deviationSteps: [
            "Ved temperatur over grænse: Tjek udstyr, flyt produkter ved behov",
            "Ved rengøringsproblemer: Rengør grundigt igen",
            "Ved defekt: Tag ud af drift, kontakt tekniker",
            "Dokumentér afvigelse og handling"
        ],
        documentation: "Registrér temperatur, rengøring og evt. afvigelser"
    },

    fryer_control: {
        key: "fryer_control",
        version: "1.0",
        title: "Kontrol af friture",
        purpose: "Sikre korrekt temperatur og oliekvalitet i friture",
        whenToUse: "Daglig kontrol før og under brug",
        equipment: "Termometer, visuel inspektion",
        steps: [
            "Kontrollér temperatur (max 175°C for pommes frites)",
            "Tjek olie farve, lugt og renhed",
            "Fjern madrester og partikler",
            "Verificér at friture er rengjort korrekt",
            "Planlæg olieskift ved behov"
        ],
        deviationSteps: [
            "Ved temperatur over 175°C: Reducer varme øjeblikkeligt",
            "Ved dårlig oliekvalitet: Skift olie og rengør friture",
            "Dokumentér afvigelse og handling",
            "Juster rutiner ved gentagne problemer"
        ],
        documentation: "Registrér temperatur, oliekvalitet og evt. olieskift"
    },

    cooling_process: {
        key: "cooling_process",
        version: "1.0",
        title: "Nedkøling af varme retter",
        purpose: "Sikre hurtig og sikker nedkøling for at forebygge bakterievækst",
        whenToUse: "Ved nedkøling af tilberedte retter til senere brug",
        equipment: "Termometer, timer, nedkølingsudstyr",
        steps: [
            "Start nedkøling fra minimum 56°C",
            "Mål starttemperatur og noter tidspunkt",
            "Placer i nedkølingsudstyr (blast chiller eller køl)",
            "Mål temperatur efter max 4 timer",
            "Kontrollér at 10°C er nået inden for 4 timer",
            "Overfør til korrekt opbevaring"
        ],
        deviationSteps: [
            "Ved overskridelse af 4 timer eller temperatur over 10°C:",
            "1) Genopvarm straks til 75°C og start ny nedkøling, ELLER",
            "2) Kassér varen",
            "Dokumentér afvigelse, handling og årsag"
        ],
        documentation: "Registrér start-/slut-temperatur, tidspunkter og ret"
    },

    oven_control: {
        key: "oven_control",
        version: "1.0",
        title: "Ovn - rengøring og temperaturkontrol",
        purpose: "Sikre korrekt ovntemperatur og hygiejne",
        whenToUse: "Daglig rengøring og temperaturverifikation",
        equipment: "Kalibreret termometer, rengøringsmidler",
        steps: [
            "Rengør ovnkammer, riste og plader",
            "Fjern fastbrændte rester",
            "Forvarm ovn til referencepunkt",
            "Mål faktisk temperatur med kalibreret termometer",
            "Kontrollér at temperatur er inden for tolerance",
            "Tjek ventilation og luftcirkulation"
        ],
        deviationSteps: [
            "Ved temperaturafvigelse: Registrér målt vs. forventet",
            "Ved kritisk afvigelse: Tag ovn ud af drift",
            "Bestil service/kalibrering",
            "Brug alternativ ovn indtil reparation"
        ],
        documentation: "Registrér temperaturmåling og evt. afvigelser"
    },

    dishwasher_control: {
        key: "dishwasher_control",
        version: "1.0",
        title: "Industriopvaskemaskine - kontrol",
        purpose: "Sikre korrekt vaske- og skylletemperatur for hygiejnisk opvask",
        whenToUse: "Daglig kontrol og rengøring",
        equipment: "Termometer (hvis ikke indbygget display)",
        steps: [
            "Rengør filtre, skyllearme og tank",
            "Kontrollér sæbe- og afspændingsniveau",
            "Kør testprogram",
            "Aflæs vasketemperatur og slutskylletemperatur",
            "Kontrollér at temperaturer er inden for krav",
            "Tjek at opvask bliver ren og tør"
        ],
        deviationSteps: [
            "Ved temperatur under krav: Stop brug til kritiske emner",
            "Kontakt service ved temperatur- eller pumpefejl",
            "Dokumentér afvigelse med temperaturmåling",
            "Brug alternativ opvaskmetode indtil reparation"
        ],
        documentation: "Registrér vaske- og skylletemperatur"
    }
};

/**
 * Map aggregatedCategory to guideKey
 */
function mapCategoryToGuideKey(aggregatedCategory) {
    const mapping = {
        "temperature_cooling": "fridge_temperature",
        "temperature_freezing": "freezer_temperature",
        "temperature_heating": "hot_holding",
        "hot_holding": "hot_holding",
        "reheating_process": "reheating",
        "receiving_control": "receiving_goods",
        "allergen_control": "allergen_control",
        "area_cleaning": "cleaning_control",
        "equipment_cleaning": "equipment_cleaning",
        "equipment_maintenance": "equipment_maintenance",
        "drain_maintenance": "drain_maintenance",
        "staff_hygiene": "personal_hygiene_check",
        "closing_routine": "closing_routine",
        "ice_equipment_critical": "ice_equipment",
        "fryer_critical": "fryer_control",
        "cooling_process": "cooling_process",
        "verification": "cleaning_control",
        "building_condition": "cleaning_control",
        "pest_control": "cleaning_control",
        "general_checklist": "cleaning_control"
    };

    return mapping[aggregatedCategory] || null;
}

/**
 * Map aggregatedCategory to taskType
 */
function mapCategoryToTaskType(aggregatedCategory) {
    const mapping = {
        "temperature_cooling": "fridge_temperature",
        "temperature_freezing": "freezer_temperature",
        "temperature_heating": "hot_holding",
        "hot_holding": "hot_holding",
        "reheating_process": "reheating",
        "receiving_control": "receiving_goods",
        "allergen_control": "allergen_control",
        "area_cleaning": "cleaning_control",
        "equipment_cleaning": "equipment_cleaning",
        "drain_maintenance": "drain_maintenance",
        "staff_hygiene": "personal_hygiene",
        "closing_routine": "closing_routine",
        "ice_equipment_critical": "ice_equipment",
        "fryer_critical": "fryer_control",
        "cooling_process": "cooling_process",
        "verification": "verification",
        "building_condition": "building_inspection",
        "pest_control": "pest_inspection",
        "general_checklist": "general_check"
    };

    return mapping[aggregatedCategory] || "general_check";
}

/**
 * Get guide by key
 */
function getGuideByKey(guideKey) {
    return GUIDE_LIBRARY[guideKey] || null;
}

module.exports = {
    GUIDE_LIBRARY,
    mapCategoryToGuideKey,
    mapCategoryToTaskType,
    getGuideByKey
};

```
