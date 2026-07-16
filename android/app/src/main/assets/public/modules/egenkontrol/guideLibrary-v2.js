/**
 * Frontend Guide Library v2
 * Mirrors backend guide definitions for client-side guide lookup
 */

const GUIDE_LIBRARY_V2 = {
  guide_cold_storage_temperature: {
    guideKey: "guide_cold_storage_temperature",
    title: "Temperaturkontrol af køl",
    steps: [
      "Mål temperaturen i køleenheden.",
      "Kontrollér at temperaturen er højst 5°C.",
      "Vurder om varer er opbevaret korrekt.",
      "Registrér afvigelse hvis grænsen overskrides."
    ]
  },

  guide_walk_in_cooler_temperature: {
    guideKey: "guide_walk_in_cooler_temperature",
    title: "Temperaturkontrol af walk-in køler",
    steps: [
      "Mål temperatur i top, midte og ved gulv.",
      "Kontrollér at alle målinger er inden for grænsen.",
      "Kontrollér luftcirkulation og vareplacering.",
      "Registrér afvigelse hvis en zone er for varm."
    ]
  },

  guide_frozen_storage_temperature: {
    guideKey: "guide_frozen_storage_temperature",
    title: "Temperaturkontrol af fryser",
    steps: [
      "Mål temperaturen i fryseren.",
      "Kontrollér at temperaturen er højst -18°C.",
      "Registrér afvigelse hvis grænsen overskrides."
    ]
  },

  guide_cold_storage_placement: {
    guideKey: "guide_cold_storage_placement",
    title: "Placering og adskillelse i køl",
    steps: [
      "Sørg for adskillelse mellem rå og spiseklare varer.",
      "Opbevar varer tildækket og korrekt mærket.",
      "Undgå dryp og krydskontaminering mellem hylder."
    ]
  },

  guide_cutting_area_hygiene: {
    guideKey: "guide_cutting_area_hygiene",
    title: "Hygiejne i opskæringsområde",
    steps: [
      "Kontrollér at arbejdsflader er rene før brug.",
      "Sørg for at redskaber er rene og egnede.",
      "Hold rå og spiseklare produkter adskilt."
    ]
  },

  guide_board_change_control: {
    guideKey: "guide_board_change_control",
    title: "Skift af skærebræt mellem opgaver",
    steps: [
      "Brug korrekt skærebræt til opgaven.",
      "Skift skærebræt ved skift mellem råt og spiseklart.",
      "Rengør eller udskift udstyr mellem opgaver."
    ]
  },

  guide_raw_to_ready_separation: {
    guideKey: "guide_raw_to_ready_separation",
    title: "Adskillelse mellem råt og spiseklart",
    steps: [
      "Hold rå og spiseklare varer fysisk adskilt.",
      "Brug separate redskaber og kontaktflader.",
      "Undgå krydskontaminering i hele arbejdsgangen."
    ]
  },

  guide_cleaning_between_workflows: {
    guideKey: "guide_cleaning_between_workflows",
    title: "Rengøring mellem arbejdsgange",
    steps: [
      "Rengør kontaktflader mellem arbejdsgange.",
      "Desinficér relevante overflader ved behov.",
      "Sørg for at næste opgave starter på rent udstyr."
    ]
  },

  guide_fish_hygiene_workflow: {
    guideKey: "guide_fish_hygiene_workflow",
    title: "Fiskehygiejne og arbejdsgang",
    steps: [
      "Hold fisk koldt under hele håndteringen.",
      "Undgå kontakt mellem fisk og andre varetyper.",
      "Rengør kontaktflader og redskaber efter brug.",
      "Registrér afvigelse ved temperatur- eller hygiejnefejl."
    ]
  },

  guide_ice_machine_hygiene: {
    guideKey: "guide_ice_machine_hygiene",
    title: "Hygiejnekontrol af ismaskine",
    steps: [
      "Kontrollér at maskinen er ren indvendigt og udvendigt.",
      "Se efter belægninger, slam eller urenheder.",
      "Følg rengøringsproceduren ved behov."
    ]
  },

  guide_soft_ice_hygiene: {
    guideKey: "guide_soft_ice_hygiene",
    title: "Hygiejnekontrol af softicemaskine",
    steps: [
      "Kontrollér rengøring og daglig hygiejne.",
      "Kontrollér temperatur og korrekt håndtering.",
      "Følg fast rengørings- og skyllerutine."
    ]
  }
};

function getGuideByKeyV2(guideKey) {
  return GUIDE_LIBRARY_V2[guideKey] || null;
}

export { GUIDE_LIBRARY_V2, getGuideByKeyV2 };
