"use strict";

const GLOBAL_RECALL_AUTO_TEMPLATES = [
  {
    key: "tilbagetraekning_auto_fvst",
    title: "Automatisk tilbagetrækning (Fødevarestyrelsen)",
    sortOrder: 10,
    source: "fvst",
    introText: `Automatisk tilbagetrækning

Systemet overvåger automatisk Fødevarestyrelsens tilbagekaldelser af fødevarer.

Hvis der findes relevante tilbagekaldelser:
• vises de i systemet
• virksomheden skal tage stilling til, om produktet findes i virksomheden
• der skal dokumenteres handling

Ved fejl:
Hvis en relevant fødevare findes i virksomheden, skal den:
• fjernes fra salg
• returneres eller kasseres
• dokumenteres

Denne funktion sikrer, at virksomheden altid er opdateret på aktuelle tilbagekaldelser.`,
    
    fields: [
      {
        key: "recall_checked",
        label: "Er tilbagekaldelser gennemgået?*",
        type: "button_group",
        required: true,
        options: [
          {
            value: "ok",
            label: "Ingen relevante produkter fundet"
          },
          {
            value: "found",
            label: "Relevante produkter fundet"
          }
        ]
      },
      {
        key: "action_taken",
        label: "Hvad er der gjort?",
        type: "textarea",
        required: false
      },
      {
        key: "documentation",
        label: "Dokumentation (billede)",
        type: "image",
        required: false,
        allowUpload: true,
        allowCamera: true,
        accept: ["image/*"]
      }
    ],

    scheduleConfig: {
      scheduleType: "recurring",
      recurrenceMode: "days",
      recurrenceValue: 1 // daglig check
    }
  }
];

module.exports = {
  GLOBAL_RECALL_AUTO_TEMPLATES
};