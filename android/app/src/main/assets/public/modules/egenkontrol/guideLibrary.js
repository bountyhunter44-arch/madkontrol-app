/**
 * Frontend Guide Library
 * Canonical guide definitions matching backend guideLibrary.js
 */

const GUIDE_LIBRARY = {
    fridge_temperature: {
        key: "fridge_temperature",
        title: "Temperaturkontrol af køleskab",
        intro: "Sikre at køleskabe holder korrekt temperatur for at forhindre bakterievækst",
        areas: [
            "Åbn køleskabet og placer termometer på midterste hylde",
            "Vent 2-3 minutter for stabil aflæsning",
            "Kontrollér at temperatur er max 5°C",
            "Tjek at døre lukker tæt og pakninger er intakte"
        ],
        steps: [
            "Placer kalibreret termometer i køleskabet",
            "Vent 2-3 minutter",
            "Aflæs og registrér temperatur",
            "Dokumentér i systemet"
        ],
        approval: [
            "Temperatur er max 5°C",
            "Døre lukker korrekt",
            "Ingen synlige defekter"
        ],
        ifNotOk: [
            "Ved temperatur over 5°C: Undersøg årsag",
            "Flyt kritiske varer til fungerende køl hvis over 8°C",
            "Juster termostat eller kontakt tekniker",
            "Dokumentér afvigelse"
        ]
    },

    walkin_cooler_temperature: {
        key: "walkin_cooler_temperature",
        title: "Temperaturkontrol af walk-in køler",
        intro: "Sikre at walk-in kølere holder korrekt temperatur for sikker opbevaring",
        areas: [
            "Aflæs temperatur på fast display eller placer termometer centralt",
            "Kontrollér at temperatur er max 5°C",
            "Tjek at døre lukker korrekt, ingen is-ophobning",
            "Verificér korrekt vareplacering med luftcirkulation"
        ],
        steps: [
            "Aflæs display eller placer termometer centralt i rummet",
            "Vent 2-3 minutter hvis manuel måling",
            "Registrér temperatur",
            "Tjek dørfunktion og luftcirkulation"
        ],
        approval: [
            "Temperatur er max 5°C",
            "Døre lukker korrekt",
            "Ingen is-ophobning på fordamper",
            "Varer placeret med god luftcirkulation"
        ],
        ifNotOk: [
            "Ved temperatur over 5°C: Undersøg årsag (dør åben, defekt aggregat)",
            "Flyt kritiske varer hvis over 8°C",
            "Kontakt kølemontør ved vedvarende problemer",
            "Dokumentér afvigelse"
        ]
    },

    cold_storage_placement: {
        key: "cold_storage_placement",
        title: "Kontrol af korrekt placering i køl",
        intro: "Sikre korrekt placering og opbevaring af varer i køleenheder",
        areas: [
            "Råvarer adskilt fra færdige produkter",
            "FIFO-princip følges (først ind, først ud)",
            "Varer korrekt mærket med dato",
            "Luftcirkulation ikke blokeret"
        ],
        steps: [
            "Kontrollér adskillelse af råvarer og færdige produkter",
            "Verificér FIFO-princip",
            "Tjek datoer og mærkning",
            "Kontrollér at intet står på gulv eller blokerer luften"
        ],
        approval: [
            "Råvarer og færdige produkter adskilt",
            "FIFO-princip overholdt",
            "Korrekt mærkning",
            "God luftcirkulation"
        ],
        ifNotOk: [
            "Ret forkert placering straks",
            "Fjern udgåede varer",
            "Instruer personale i korrekt praksis",
            "Dokumentér afvigelse"
        ]
    },

    freezer_temperature: {
        key: "freezer_temperature",
        title: "Temperaturkontrol af frost",
        intro: "Sikre at frysere holder korrekt temperatur for langtidsopbevaring",
        areas: [
            "Åbn fryser og placer termometer mellem varerne",
            "Vent 2-3 minutter for stabil aflæsning",
            "Kontrollér at temperatur er max -18°C",
            "Tjek for is-ophobning og at døre lukker korrekt"
        ],
        steps: [
            "Placer termometer i fryser",
            "Vent 2-3 minutter",
            "Aflæs temperatur",
            "Registrér måling"
        ],
        approval: [
            "Temperatur er max -18°C",
            "Ingen unormal is-ophobning",
            "Døre fungerer korrekt"
        ],
        ifNotOk: [
            "Ved temperatur over -18°C: Undersøg årsag",
            "Flyt varer til fungerende fryser hvis over -12°C",
            "Kontakt tekniker",
            "Dokumentér afvigelse"
        ]
    },

    hot_holding: {
        key: "hot_holding",
        title: "Temperaturkontrol ved varmholdelse",
        intro: "Sikre at varme retter holdes ved sikker temperatur",
        areas: [
            "Stik termometer ind i centrum af retten",
            "Vent til temperatur er stabil",
            "Kontrollér at temperatur er minimum 56°C",
            "Tjek at varmholdelsesudstyr fungerer korrekt"
        ],
        steps: [
            "Brug kalibreret kernetermometer",
            "Mål i centrum af retten",
            "Aflæs temperatur",
            "Registrér måling"
        ],
        approval: [
            "Temperatur er minimum 56°C",
            "Varmholdelsesudstyr fungerer",
            "Ret ser appetitlig ud"
        ],
        ifNotOk: [
            "Ved temperatur under 56°C: Øg varme øjeblikkeligt",
            "Hvis temperatur ikke kan nås: Kassér varen",
            "Dokumentér afvigelse"
        ]
    },

    reheating: {
        key: "reheating",
        title: "Genopvarmning af retter",
        intro: "Sikre at genopvarmede retter når sikker kernetemperatur",
        areas: [
            "Opvarm ret til minimum 75°C i hele fødevaren",
            "Stik termometer ind i den koldeste del (centrum)",
            "Kontrollér at 75°C er nået"
        ],
        steps: [
            "Opvarm ret grundigt",
            "Mål kernetemperatur i centrum",
            "Verificér minimum 75°C",
            "Servér straks eller hold varm ved min. 56°C"
        ],
        approval: [
            "Kernetemperatur minimum 75°C",
            "Ret er gennemvarmet",
            "Klar til servering"
        ],
        ifNotOk: [
            "Ved temperatur under 75°C: Fortsæt opvarmning",
            "Hvis 75°C ikke kan nås: Kassér varen",
            "Dokumentér afvigelse"
        ]
    },

    hot_preparation_core_temperature: {
        key: "hot_preparation_core_temperature",
        title: "Kernetemperaturkontrol ved tilberedning",
        intro: "Sikre at kød, fjerkræ og andre kritiske fødevarer når sikker kernetemperatur ved tilberedning",
        areas: [
            "Stik termometer ind i den tykkeste del af kødet",
            "Undgå knogler og fedtlommer",
            "Kontrollér minimum 75°C i hele fødevaren",
            "For fjerkræ: min 75°C, hakket kød: min 70°C"
        ],
        steps: [
            "Brug kalibreret kernetermometer",
            "Mål i centrum af den tykkeste del",
            "Vent til temperatur er stabil",
            "Registrér kernetemperatur og ret"
        ],
        approval: [
            "Minimum 75°C nået i hele fødevaren",
            "Ingen røde områder i kød",
            "Klar til servering"
        ],
        ifNotOk: [
            "Ved temperatur under 75°C: Fortsæt tilberedning",
            "Mål igen efter yderligere tilberedning",
            "Hvis korrekt temperatur ikke kan nås: Kassér varen",
            "Dokumentér afvigelse"
        ]
    },

    cold_preparation_hygiene: {
        key: "cold_preparation_hygiene",
        title: "Hygiejnekontrol ved kold tilberedning",
        intro: "Forebygge krydskontaminering ved tilberedning af kolde retter",
        areas: [
            "Separate skærebrætter for råvarer og færdige produkter",
            "Råvarer adskilt fra færdige produkter",
            "Alle ingredienser friske og inden for holdbarhed",
            "Kolde retter ved max 5°C indtil servering"
        ],
        steps: [
            "Vask hænder grundigt før start",
            "Brug separate redskaber for råvarer og færdige produkter",
            "Hold adskillelse under hele processen",
            "Rengør kontaktflader løbende"
        ],
        approval: [
            "Ingen krydskontaminering observeret",
            "Korrekt adskillelse overholdt",
            "Alle ingredienser friske",
            "Temperatur max 5°C"
        ],
        ifNotOk: [
            "Ved mistanke om krydskontaminering: Kassér berørte produkter",
            "Rengør og desinficér alle kontaktflader grundigt",
            "Instruer personale i korrekt praksis",
            "Dokumentér hændelse"
        ]
    },

    receiving_goods: {
        key: "receiving_goods",
        title: "Modtagekontrol af varer",
        intro: "Sikre at modtagne varer opfylder kvalitets- og sikkerhedskrav",
        areas: [
            "Tjek leveringstidspunkt og transportforhold",
            "Kontrollér temperatur på køle-/fryservarer",
            "Tjek emballage for skader",
            "Kontrollér holdbarhedsdatoer og mærkning",
            "Verificér at bestilling matcher levering"
        ],
        steps: [
            "Mål temperatur (køl max 5°C, frost max -18°C)",
            "Inspicér emballage",
            "Tjek holdbarhedsdatoer",
            "Placer varer korrekt i køl/frost straks"
        ],
        approval: [
            "Korrekt temperatur ved levering",
            "Emballage intakt",
            "Holdbarhedsdatoer acceptable",
            "Varer korrekt opbevaret"
        ],
        ifNotOk: [
            "Afvis varer med forkert temperatur eller beskadiget emballage",
            "Dokumentér afvigelse med foto",
            "Kontakt leverandør",
            "Returner eller kassér afviste varer"
        ]
    },

    allergen_control: {
        key: "allergen_control",
        title: "Kontrol af allergenhåndtering",
        intro: "Forebygge krydskontaminering og sikre korrekt allergenmærkning",
        areas: [
            "Kontrollér at allergenholdige ingredienser er mærket og adskilt",
            "Tjek at separate redskaber bruges til allergenfrie produkter",
            "Verificér at menukort og mærkning er opdateret",
            "Kontrollér at personale kender allergenrutiner"
        ],
        steps: [
            "Inspicér opbevaring af allergener",
            "Tjek mærkning og adskillelse",
            "Verificér menukort",
            "Tjek rengøring mellem produktioner"
        ],
        approval: [
            "Allergener korrekt mærket og adskilt",
            "Separate redskaber anvendes",
            "Menukort opdateret",
            "Personale instrueret"
        ],
        ifNotOk: [
            "Ret fejl i mærkning eller opbevaring straks",
            "Kassér produkter ved mistanke om krydskontaminering",
            "Instruer personale",
            "Dokumentér hændelse"
        ]
    },

    cleaning_control: {
        key: "cleaning_control",
        title: "Rengøringskontrol",
        intro: "Sikre at rengøring er udført korrekt i alle områder",
        areas: [
            "Kontrollér alle arbejdsflader for synlig renhed",
            "Tjek gulve, vægge og lofter i produktionsområder",
            "Kontrollér rengøring af udstyr og maskiner",
            "Verificér korrekt opbevaring af rengøringsmidler",
            "Tjek afløb og sanitære faciliteter"
        ],
        steps: [
            "Visuel inspektion af alle områder",
            "Tjek arbejdsflader",
            "Inspicér udstyr",
            "Verificér afløb"
        ],
        approval: [
            "Alle områder visuelt rene",
            "Ingen synlige rester",
            "Udstyr rengjort",
            "Afløb rene"
        ],
        ifNotOk: [
            "Udfør rengøring igen ved mangler",
            "Dokumentér område og handling",
            "Instruer ansvarlig medarbejder",
            "Følg op ved gentagne problemer"
        ]
    },

    date_check: {
        key: "date_check",
        title: "Holdbarhedskontrol",
        intro: "Sikre at udgåede varer fjernes og FIFO-princip følges",
        areas: [
            "Gennemgå alle køle- og frostenheder",
            "Tjek holdbarhedsdatoer på alle varer",
            "Fjern udgåede produkter",
            "Kontrollér FIFO-princip",
            "Verificér mærkning af åbnede produkter"
        ],
        steps: [
            "Systematisk gennemgang af alle enheder",
            "Tjek datoer",
            "Fjern udgåede varer",
            "Ret FIFO-rækkefølge"
        ],
        approval: [
            "Ingen udgåede varer",
            "FIFO-princip følges",
            "Åbnede produkter korrekt mærket"
        ],
        ifNotOk: [
            "Kassér alle udgåede varer straks",
            "Dokumentér kasserede varer",
            "Ret FIFO-rækkefølge",
            "Instruer personale"
        ]
    },

    personal_hygiene_check: {
        key: "personal_hygiene_check",
        title: "Kontrol af personlig hygiejne",
        intro: "Sikre at personale følger hygiejneregler",
        areas: [
            "Kontrollér håndvask ved relevante tidspunkter",
            "Tjek arbejdstøj er rent og korrekt anvendt",
            "Verificér ingen smykker, ure eller neglelak",
            "Kontrollér hår er dækket/bundet tilbage",
            "Tjek at syge medarbejdere ikke håndterer fødevarer"
        ],
        steps: [
            "Observer personale under arbejde",
            "Tjek håndvask",
            "Inspicér arbejdstøj",
            "Verificér ingen smykker"
        ],
        approval: [
            "Korrekt håndvask",
            "Rent arbejdstøj",
            "Ingen smykker/ure",
            "Hår dækket"
        ],
        ifNotOk: [
            "Instruer medarbejder straks",
            "Dokumentér hændelse",
            "Gentag instruktion ved gentagne problemer",
            "Informer ansvarlig ved alvorlige overtrædelser"
        ]
    },

    closing_routine: {
        key: "closing_routine",
        title: "Lukkerutine",
        intro: "Sikre at alle kritiske kontroller er udført før lukning",
        areas: [
            "Kontrollér at alle temperaturer er registreret",
            "Tjek at rengøringsopgaver er udført",
            "Verificér korrekt opbevaring af varer",
            "Kontrollér udstyr er slukket/sat korrekt",
            "Tjek døre og vinduer er låst",
            "Verificér affald er fjernet"
        ],
        steps: [
            "Gennemgå tjekliste systematisk",
            "Verificér alle punkter",
            "Dokumentér eventuelle mangler",
            "Lås og sikr lokationen"
        ],
        approval: [
            "Alle temperaturer registreret",
            "Rengøring udført",
            "Varer korrekt opbevaret",
            "Lokation sikret"
        ],
        ifNotOk: [
            "Fuldfør manglende opgaver",
            "Dokumentér afvigelser",
            "Informer ansvarlig ved kritiske mangler",
            "Følg op næste dag"
        ]
    },

    drain_maintenance: {
        key: "drain_maintenance",
        title: "Kontrol og rengøring af afløb",
        intro: "Forebygge tilstopning, lugt og skadedyr via korrekt afløbsvedligehold",
        areas: [
            "Kontrollér risten: Ingen madrester eller synligt snavs",
            "Kontrollér vandlåsen: Der skal være vand i vandlåsen",
            "Kontrollér rist-placering: Risten skal sidde korrekt"
        ],
        steps: [
            "Løft rist op og inspicér afløbskoppe",
            "Fjern madrester og snavs",
            "Rengør rist og koppe grundigt",
            "Kontrollér vandlås indeholder vand",
            "Placer rist korrekt tilbage"
        ],
        approval: [
            "Ingen synlige madrester",
            "Vandlås indeholder vand",
            "Rist korrekt placeret",
            "Gulvområde rent"
        ],
        ifNotOk: [
            "Ved madrester: Rengør straks og tag foto",
            "Ved tom vandlås: Fyld ca. 1 dl vand i",
            "Ved tilstopning: Kontakt VVS-tekniker",
            "Ved gentagne problemer: Undersøg årsag"
        ]
    },

    equipment_cleaning: {
        key: "equipment_cleaning",
        title: "Rengøring af udstyr",
        intro: "Sikre korrekt rengøring af produktionsudstyr",
        areas: [
            "Adskil udstyr i dele der skal håndvaskes",
            "Rengør alle dele grundigt",
            "Skyl for at fjerne rengøringsmiddel",
            "Lad dele lufttørre eller tør med rent håndklæde",
            "Saml udstyr korrekt igen"
        ],
        steps: [
            "Adskil udstyr",
            "Rengør med godkendt middel",
            "Skyl grundigt",
            "Tør og saml"
        ],
        approval: [
            "Alle dele rengjorte",
            "Ingen rester af rengøringsmiddel",
            "Udstyr korrekt samlet",
            "Udstyr fungerer"
        ],
        ifNotOk: [
            "Ved synlige rester: Rengør igen",
            "Ved defekt: Tag ud af drift og marker",
            "Dokumentér problem",
            "Kontakt ansvarlig/tekniker"
        ]
    },

    ice_equipment: {
        key: "ice_equipment",
        title: "Kontrol af ismaskiner og softice",
        intro: "Sikre korrekt temperatur og hygiejne i iskritisk udstyr",
        areas: [
            "Kontrollér temperatur (max -18°C)",
            "Tjek produktberørte dele for renhed",
            "Kontrollér pakninger, slanger og doseringsdele",
            "Verificér at desinfektion er skyllet væk"
        ],
        steps: [
            "Mål temperatur",
            "Inspicér produktberørte dele",
            "Tjek pakninger og slanger",
            "Verificér korrekt rengøring"
        ],
        approval: [
            "Temperatur max -18°C",
            "Alle dele rene",
            "Pakninger intakte",
            "Maskine fungerer optimalt"
        ],
        ifNotOk: [
            "Ved temperatur over grænse: Tjek udstyr, flyt produkter",
            "Ved rengøringsproblemer: Rengør grundigt igen",
            "Ved defekt: Tag ud af drift, kontakt tekniker",
            "Dokumentér afvigelse"
        ]
    },

    fryer_control: {
        key: "fryer_control",
        title: "Kontrol af friture",
        intro: "Sikre korrekt temperatur og oliekvalitet",
        areas: [
            "Kontrollér temperatur (max 175°C for pommes frites)",
            "Tjek olie farve, lugt og renhed",
            "Fjern madrester og partikler",
            "Verificér friture er rengjort korrekt"
        ],
        steps: [
            "Mål temperatur",
            "Inspicér oliekvalitet",
            "Fjern partikler",
            "Planlæg olieskift ved behov"
        ],
        approval: [
            "Temperatur max 175°C",
            "Olie ser ren ud",
            "Ingen dårlig lugt",
            "Friture rengjort"
        ],
        ifNotOk: [
            "Ved temperatur over 175°C: Reducer varme øjeblikkeligt",
            "Ved dårlig oliekvalitet: Skift olie og rengør",
            "Dokumentér afvigelse",
            "Juster rutiner ved gentagne problemer"
        ]
    },

    cooling_process: {
        key: "cooling_process",
        title: "Nedkøling af varme retter",
        intro: "Sikre hurtig og sikker nedkøling for at forebygge bakterievækst",
        areas: [
            "Start nedkøling fra minimum 56°C",
            "Mål starttemperatur og noter tidspunkt",
            "Placer i nedkølingsudstyr",
            "Mål temperatur efter max 4 timer",
            "Kontrollér at 10°C er nået inden for 4 timer"
        ],
        steps: [
            "Mål starttemperatur (min. 56°C)",
            "Noter tidspunkt",
            "Placer i blast chiller eller køl",
            "Mål efter max 4 timer",
            "Verificér max 10°C"
        ],
        approval: [
            "Starttemperatur min. 56°C",
            "10°C nået inden for 4 timer",
            "Korrekt opbevaring efter nedkøling"
        ],
        ifNotOk: [
            "Ved overskridelse: Genopvarm til 75°C og start ny nedkøling, ELLER kassér",
            "Dokumentér afvigelse, handling og årsag"
        ]
    },

    oven_control: {
        key: "oven_control",
        title: "Ovn - rengøring og temperaturkontrol",
        intro: "Sikre korrekt ovntemperatur og hygiejne",
        areas: [
            "Rengør ovnkammer, riste og plader",
            "Fjern fastbrændte rester",
            "Forvarm ovn til referencepunkt",
            "Mål faktisk temperatur",
            "Tjek ventilation og luftcirkulation"
        ],
        steps: [
            "Rengør ovn grundigt",
            "Forvarm til referencepunkt",
            "Mål temperatur med kalibreret termometer",
            "Verificér inden for tolerance"
        ],
        approval: [
            "Ovn rengjort",
            "Temperatur inden for tolerance",
            "Ventilation fungerer"
        ],
        ifNotOk: [
            "Ved temperaturafvigelse: Registrér målt vs. forventet",
            "Ved kritisk afvigelse: Tag ovn ud af drift",
            "Bestil service/kalibrering"
        ]
    },

    dishwasher_control: {
        key: "dishwasher_control",
        title: "Industriopvaskemaskine - kontrol",
        intro: "Sikre korrekt vaske- og skylletemperatur",
        areas: [
            "Rengør filtre, skyllearme og tank",
            "Kontrollér sæbe- og afspændingsniveau",
            "Kør testprogram",
            "Aflæs vaske- og skylletemperatur",
            "Tjek at opvask bliver ren og tør"
        ],
        steps: [
            "Rengør maskine",
            "Tjek kemikalieniveau",
            "Kør testprogram",
            "Aflæs temperaturer"
        ],
        approval: [
            "Maskine rengjort",
            "Temperaturer inden for krav",
            "Opvask bliver ren og tør"
        ],
        ifNotOk: [
            "Ved temperatur under krav: Stop brug til kritiske emner",
            "Kontakt service ved fejl",
            "Dokumentér afvigelse",
            "Brug alternativ metode indtil reparation"
        ]
    }
};

/**
 * DEPRECATED: Category-based fallback removed
 * All tasks must have explicit guideKey
 * This function is kept only for legacy migration purposes
 */
function mapCategoryToGuideKey(category) {
    console.warn("DEPRECATED: mapCategoryToGuideKey called - tasks should have explicit guideKey", { category });
    return null;
}

/**
 * Get guide by key
 */
function getGuideByKey(guideKey) {
    return GUIDE_LIBRARY[guideKey] || null;
}

/**
 * Get guide by task - STRICTLY guideKey-driven
 * NO fallbacks from category, aggregatedCategory, or title
 * Returns null and logs error if guideKey is missing or invalid
 */
function getGuideForTask(task) {
    if (!task) {
        console.error("getGuideForTask: task is null or undefined");
        return null;
    }
    
    if (!task.guideKey) {
        console.error("❌ Missing guideKey on task", {
            title: task.title || task.taskTitle || null,
            taskId: task.id || task.taskInstanceId || null,
            category: task.category || null,
            aggregatedCategory: task.aggregatedCategory || null,
            templateId: task.templateId || null
        });
        return null;
    }

    const guide = getGuideByKey(task.guideKey);

    if (!guide) {
        console.error("❌ Invalid guideKey on task", {
            guideKey: task.guideKey,
            title: task.title || task.taskTitle || null,
            taskId: task.id || task.taskInstanceId || null,
            templateId: task.templateId || null
        });
        return null;
    }

    return guide;
}

export { getGuideForTask, getGuideByKey, mapCategoryToGuideKey };
