/**
 * controlLibraryVerification.js
 * Periodiske compliance- og revisionsopgaver.
 * Genererer instanser baseret på interval_days — IKKE daglige rutiner.
 *
 * Firestore: verification_instances/{companyId}_{key}_{dateKey}
 */

/** @type {VerificationDefinition[]} */
export const controlLibraryVerification = [
  {
    key: "annual_revision",
    title: "Årlig kontrol og revision af egenkontrolprogram",
    libraryType: "verification",
    controlType: "verification_review",
    frequency: {
      mode: "interval_days",
      intervalDays: 365
    },
    riskLevel: "high",
    guide: {
      title: "Formål: Årlig revision",
      body: "Egenkontrolprogrammet skal gennemgås mindst én gang om året. Formålet er at sikre at programmet stadig passer til virksomhedens aktiviteter, at fejl er rettet op, og at medarbejdere er instrueret korrekt."
    },
    fields: [
      {
        key: "checklist",
        type: "checkbox_group",
        label: "Kontrolspørgsmål",
        required: true,
        options: [
          "Bliver vedligeholdelsesplanen fulgt?",
          "Følges rengøringsplanen?",
          "Er rengøringsplanen tilstrækkelig?",
          "Er produktionen den samme som ved sidste gennemgang?",
          "Er termometre kontrolleret inden for det sidste år?",
          "Er medarbejdere instrueret i egenkontrollen?",
          "Er der rettet op på fejl fra seneste revision?",
          "Passer egenkontrollen til de aktuelle aktiviteter?"
        ]
      },
      { key: "changesNeeded",   type: "radio_group", label: "Er der ændringer nødvendige?", options: ["Ja", "Nej"] },
      { key: "changesDescription", type: "textarea", label: "Beskriv nødvendige ændringer", showWhen: { field: "changesNeeded", value: "Ja" } },
      { key: "reviewedBy",      type: "text",        label: "Gennemgået af",             required: true },
      { key: "comment",         type: "textarea",    label: "Kommentar" }
    ],
    actions: {
      allowApprove: true
    }
  },

  {
    key: "pest_maintenance_review",
    title: "Skadedyrssikring og vedligeholdelse",
    libraryType: "verification",
    controlType: "verification_review",
    frequency: {
      mode: "interval_days",
      intervalDays: 90
    },
    riskLevel: "medium",
    guide: {
      title: "Formål: Skadedyr og vedligeholdelse",
      body: "Virksomheden skal forebygge skadedyr (mus, rotter, fluer, kakerlakker). Insekts- og gnaverfælder skal efterses regelmæssigt. Vedligeholdelse af lokaler og udstyr skal sikre at der ikke er huller, utætheder eller beskadigede flader der kan tiltrække skadedyr."
    },
    fields: [
      {
        key: "pestChecklist",
        type: "checkbox_group",
        label: "Kontrollér følgende",
        options: [
          "Ingen tegn på skadedyr observeret",
          "Fælder efterset og tømt/skiftet",
          "Ingen åbne indgange til bygningen",
          "Affaldscontainere med tætsluttende låg",
          "Ingen ophobet affald indendørs"
        ]
      },
      { key: "pestFound",       type: "radio_group", label: "Skadedyr observeret?",      options: ["Ja", "Nej"], required: true },
      { key: "pestDescription", type: "textarea",    label: "Beskriv observerede skadedyr", showWhen: { field: "pestFound", value: "Ja" } },
      {
        key: "maintenanceChecklist",
        type: "checkbox_group",
        label: "Vedligeholdelse",
        options: [
          "Ingen beskadigede overflader (vægge, gulve, lofter)",
          "Udstyr og maskiner vedligeholdt og rent",
          "Belysning fungerer korrekt",
          "Ventilation fungerer og er ren"
        ]
      },
      { key: "maintenanceIssues",   type: "textarea",    label: "Beskriv vedligeholdelsesproblemer" },
      { key: "actionsTaken",        type: "textarea",    label: "Iværksatte handlinger" },
      { key: "reviewedBy",          type: "text",        label: "Kontrolleret af",          required: true },
      { key: "comment",             type: "textarea",    label: "Kommentar" }
    ],
    actions: {
      allowApprove: true
    }
  },

  {
    key: "apv_review",
    title: "APV — Arbejdspladsvurdering",
    libraryType: "verification",
    controlType: "verification_review",
    frequency: {
      mode: "interval_days",
      intervalDays: 1095
    },
    riskLevel: "medium",
    guide: {
      title: "Formål: APV",
      body: "Alle arbejdspladser med ansatte skal udføre APV mindst hvert 3. år, eller ved væsentlige ændringer i arbejdet. APV skal kortlægge arbejdsmiljøproblemer og opstille en handlingsplan."
    },
    fields: [
      {
        key: "physicalEnvironment",
        type: "checkbox_group",
        label: "Fysisk arbejdsmiljø",
        options: [
          "Belysning er tilstrækkelig",
          "Temperatur og luftkvalitet er acceptabel",
          "Støjniveau er acceptabelt",
          "Ergonomi ved arbejdsstationer er ok",
          "Risici for fald, snublen og glid er minimerede"
        ]
      },
      {
        key: "psychologicalEnvironment",
        type: "checkbox_group",
        label: "Psykisk arbejdsmiljø",
        options: [
          "Arbejdspres og tempo er håndterbart",
          "Klare ansvarsfordelinger",
          "God kommunikation i teamet",
          "Ingen mobning eller chikane"
        ]
      },
      { key: "issuesIdentified",  type: "radio_group", label: "Problemer identificeret?",  options: ["Ja", "Nej"], required: true },
      { key: "issueDescription",  type: "textarea",    label: "Beskriv problemer",          showWhen: { field: "issuesIdentified", value: "Ja" } },
      { key: "actionPlan",        type: "textarea",    label: "Handlingsplan" },
      { key: "deadline",          type: "text",        label: "Frist for løsning (ÅÅÅÅ-MM-DD)" },
      { key: "reviewedBy",        type: "text",        label: "Udarbejdet af",              required: true },
      { key: "comment",           type: "textarea",    label: "Kommentar" }
    ],
    actions: {
      allowApprove: true
    }
  },

  {
    key: "thermometer_calibration",
    title: "Termometerkontrol og kalibrering",
    libraryType: "verification",
    controlType: "equipment_verification",
    frequency: {
      mode: "interval_days",
      intervalDays: 365
    },
    riskLevel: "medium",
    guide: {
      title: "Formål: Termometerkontrol",
      body: "Termometre der bruges til at kontrollere temperaturer i egenkontrolprogrammet skal efterses og verificeres mindst én gang om året. Brug isvandstest (0°C) eller kogende vand (100°C) til at verificere nøjagtighed. Dokumentér afvigelse og udskift om nødvendigt."
    },
    fields: [
      {
        key: "thermometerList",
        type: "textarea",
        label: "Angiv de termometre der kontrolleres (navn/ID)",
        required: true
      },
      { key: "testMethod",   type: "radio_group", label: "Testmetode",                    options: ["Isvand (0°C)", "Kogepunkt (100°C)", "Ekstern kalibrering"] },
      { key: "iceWaterTemp", type: "number",      label: "Aflæst temperatur i isvand (°C)", unit: "C" },
      { key: "deviationOk",  type: "radio_group", label: "Afvigelse acceptabel (±1°C)?",   options: ["Ja", "Nej"], required: true },
      { key: "actionNeeded", type: "textarea",    label: "Beskriv handling ved uacceptabel afvigelse", showWhen: { field: "deviationOk", value: "Nej" } },
      { key: "reviewedBy",   type: "text",        label: "Kontrolleret af",                required: true },
      { key: "comment",      type: "textarea",    label: "Kommentar" }
    ],
    actions: {
      allowApprove: true
    }
  }
];

/**
 * @param {string} key
 * @returns {VerificationDefinition|undefined}
 */
export function getVerificationDefinition(key) {
  return controlLibraryVerification.find((d) => d.key === key);
}
