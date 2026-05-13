/**
 * controlLibraryProgram.js
 * Egenkontrolprogram-sektioner (SOP / beskrivelse).
 * Disse genererer IKKE task_templates eller task_instances.
 * Gemmes som vedvarende programdata per virksomhed/lokation.
 *
 * Firestore: program_sections/{companyId}_{key}
 */

/** @type {ProgramDefinition[]} */
export const controlLibraryProgram = [
  {
    key: "company_description_program",
    title: "Beskrivelse af virksomheden",
    libraryType: "program",
    sectionType: "program_section",
    sortOrder: 1,
    guide: {
      title: "Formål",
      body: "En kortfattet beskrivelse af virksomhedens aktiviteter danner grundlaget for egenkontrolprogrammet. Beskriv hvad der produceres, sælges eller serveres, og under hvilke betingelser."
    },
    fields: [
      { key: "companyActivity",    type: "textarea", label: "Hvad laver virksomheden? (Beskriv aktiviteter og produkter)",  required: true },
      { key: "customerGroups",     type: "textarea", label: "Hvem er kunderne? (Fx restaurantgæster, børn, ældre)" },
      { key: "numberOfEmployees",  type: "text",     label: "Antal medarbejdere involveret i fødevarehåndtering" },
      { key: "openingHours",       type: "textarea", label: "Åbningstider / driftstider" },
      { key: "comment",            type: "textarea", label: "Øvrige bemærkninger" }
    ],
    confirmations: [
      { key: "understood", type: "boolean", label: "Beskrivelsen er korrekt og forstået" },
      { key: "approved",   type: "boolean", label: "Godkendt af ansvarlig" }
    ]
  },

  {
    key: "program_cooling",
    title: "Egenkontrolprogram: Nedkøling",
    libraryType: "program",
    sectionType: "program_section",
    sortOrder: 2,
    guide: {
      title: "Regeltekst",
      body: "Nedkøling af opvarmet mad som kødsovs, lasagne, suppe og kebab skal ske hurtigst muligt. Maden skal køles fra +65°C til under +10°C inden for 3 timer. Brug af blast-chiller, isbad eller opdeling i små portioner. Varm mad må ikke sættes direkte i køleskabet ved store mængder."
    },
    fields: [
      { key: "description", type: "textarea", label: "Hvordan nedkøles der i denne virksomhed? (Beskriv fremgangsmåde)", required: true },
      { key: "equipment",   type: "textarea", label: "Hvilket udstyr bruges til nedkøling? (Blast-chiller, isbad, mv.)" },
      { key: "portioning",  type: "textarea", label: "Hvordan opdeles store portioner?" },
      { key: "comment",     type: "textarea", label: "Kommentar" }
    ],
    confirmations: [
      { key: "understood", type: "boolean", label: "Proceduren er forstået og vil blive fulgt" },
      { key: "approved",   type: "boolean", label: "Godkendt af ansvarlig" }
    ]
  },

  {
    key: "program_separation",
    title: "Egenkontrolprogram: Adskillelse af fødevarer",
    libraryType: "program",
    sectionType: "program_section",
    sortOrder: 3,
    guide: {
      title: "Regeltekst",
      body: "Rå animalske produkter (kød, fjerkræ, fisk, æg) skal holdes adskilt fra tilberedte og spiseklare fødevarer. Brug farvekodet udstyr. Opbevar råt kød på nederste hylde i kølet. Vask og desinficer overflader og udstyr der har rørt råt kød, inden de bruges til andet."
    },
    fields: [
      { key: "description",    type: "textarea", label: "Hvordan sikres adskillelse i denne virksomhed?", required: true },
      { key: "colorCoding",    type: "textarea", label: "Beskriv farvekodesystem for skærebrætter og knive" },
      { key: "storageOrder",   type: "textarea", label: "Beskriv opbevaringsrækkefølge i køl" },
      { key: "cleaningRoutine",type: "textarea", label: "Rengøringsrutine efter håndtering af råt kød" },
      { key: "comment",        type: "textarea", label: "Kommentar" }
    ],
    confirmations: [
      { key: "understood", type: "boolean", label: "Proceduren er forstået og vil blive fulgt" },
      { key: "approved",   type: "boolean", label: "Godkendt af ansvarlig" }
    ]
  },

  {
    key: "program_receiving",
    title: "Egenkontrolprogram: Varemodtagelse",
    libraryType: "program",
    sectionType: "program_section",
    sortOrder: 4,
    guide: {
      title: "Regeltekst",
      body: "Alle indgående varer skal kontrolleres ved modtagelse. Tjek temperatur, dato, emballage og mærkning. Kølevarer må maks. være +5°C ved levering. Frostprodukter skal holde mindst -15°C. Varer der ikke opfylder kravene skal afvises."
    },
    fields: [
      { key: "description",       type: "textarea", label: "Hvem modtager varer og hvornår?", required: true },
      { key: "temperatureCheck",  type: "textarea", label: "Beskriv temperaturkontrol ved modtagelse" },
      { key: "rejectionProcedure",type: "textarea", label: "Hvad gøres der ved afvisning af varer?" },
      { key: "storageAfterReceipt",type: "textarea", label: "Hvad sker med varerne direkte efter modtagelse?" },
      { key: "comment",           type: "textarea", label: "Kommentar" }
    ],
    confirmations: [
      { key: "understood", type: "boolean", label: "Proceduren er forstået og vil blive fulgt" },
      { key: "approved",   type: "boolean", label: "Godkendt af ansvarlig" }
    ]
  },

  {
    key: "program_storage",
    title: "Egenkontrolprogram: Opbevaring af fødevarer",
    libraryType: "program",
    sectionType: "program_section",
    sortOrder: 5,
    guide: {
      title: "Regeltekst",
      body: "Fødevarer skal opbevares korrekt for at undgå fordærvelse og krydskontaminering. Tildæk åbnede produkter. Mærk altid med åbningsdato. Anvend FIFO (first in, first out). Kassér varer over dato."
    },
    fields: [
      { key: "description",    type: "textarea", label: "Beskriv opbevaringsrutiner for køl, frys og tørlager", required: true },
      { key: "fifoDescription",type: "textarea", label: "Hvordan sikres FIFO i praksis?" },
      { key: "labelingPractice",type: "textarea", label: "Beskriv mærkningspraksis for åbnede produkter" },
      { key: "comment",        type: "textarea", label: "Kommentar" }
    ],
    confirmations: [
      { key: "understood", type: "boolean", label: "Proceduren er forstået og vil blive fulgt" },
      { key: "approved",   type: "boolean", label: "Godkendt af ansvarlig" }
    ]
  }
];

/**
 * @param {string} key
 * @returns {ProgramDefinition|undefined}
 */
export function getProgramDefinition(key) {
  return controlLibraryProgram.find((d) => d.key === key);
}
