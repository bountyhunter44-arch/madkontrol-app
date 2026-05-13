const functions = require("firebase-functions");
const admin = require("firebase-admin");
const db = admin.firestore();

// SLET FRA HER
// Helper: Beregn relevans for et kontrolpunkt
function isRelevant(itemKey, onboardingData) {
  const relevanceMap = onboardingData?.relevanceMap || {};
  
  // Hvis relevanceMap findes, brug den
  if (relevanceMap[itemKey]) {
    return relevanceMap[itemKey].relevant === true;
  }
  
  // Fallback: beregn relevans fra onboarding-felter
  const relevanceRules = {
    // CCP
    ccp_temperatur_koel: () => (onboardingData?.antalKoeleskabe || onboardingData?.fridgeCount || 0) > 0,
    ccp_temperatur_frost: () => (onboardingData?.antalFrysere || onboardingData?.freezerCount || 0) > 0,
    ccp_varemodtagelse: () => onboardingData?.receivesChilledGoods || onboardingData?.modtagerKoelevarer,
    ccp_opvarmning: () => onboardingData?.preparesHotFood || onboardingData?.tilberederVarmMad,
    ccp_varmholdelse: () => onboardingData?.holdsHotFood || onboardingData?.varmholder,
    ccp_nedkoeling: () => onboardingData?.coolsHotFood || onboardingData?.nedkoelerMad,
    
    // GAG - Altid relevante
    gag_krydskontaminering: () => true,
    gag_personlig_hygiejne: () => true,
    gag_rengoering: () => true,
    gag_sporbarhed: () => true,
    gag_pest_control: () => true,
    gag_vandkvalitet: () => true,
    gag_affaldshåndtering: () => true,
    gag_vedligeholdelse: () => true,
    gag_personale_træning: () => true,
    gag_arbejdstøj: () => true,
    
    // GAG - Betinget relevante
    gag_allergener: () => onboardingData?.handlesAllergens || onboardingData?.haandtererAllergener,
    gag_optøning: () => (onboardingData?.antalFrysere || onboardingData?.freezerCount || 0) > 0,
    gag_emballering: () => onboardingData?.packagesFood || onboardingData?.emballererMad,
    gag_mærkning: () => onboardingData?.labelsProducts || onboardingData?.maerkerProdukter,
    gag_holdbarhed: () => onboardingData?.setsExpiryDates || onboardingData?.saetterHoldbarhed,
    gag_transport: () => onboardingData?.deliversFood || onboardingData?.transportererMad,
    gag_servering: () => onboardingData?.servesFood || onboardingData?.servererMad,
    gag_buffet: () => onboardingData?.hasBuffet || onboardingData?.harBuffet,
    gag_catering: () => onboardingData?.doesCatering || onboardingData?.laverCatering,
    gag_takeaway: () => onboardingData?.offersTakeaway || onboardingData?.tilbyderTakeaway,
    gag_levering: () => onboardingData?.deliversFood || onboardingData?.levererMad,
    gag_råvarer_animalsk: () => onboardingData?.usesMeat || onboardingData?.brugerKoed,
    gag_råvarer_vegetabilsk: () => onboardingData?.usesVegetables || onboardingData?.brugerGroentsager,
    gag_råvarer_fisk: () => onboardingData?.usesFish || onboardingData?.brugerFisk,
    gag_råvarer_æg: () => onboardingData?.usesEggs || onboardingData?.brugerAeg,
    gag_råvarer_mælk: () => onboardingData?.usesDairy || onboardingData?.brugerMaelk,
    gag_tilberedning_varme: () => onboardingData?.preparesHotFood || onboardingData?.tilberederVarmMad,
    gag_tilberedning_kolde: () => onboardingData?.preparesColdFood || onboardingData?.tilberederKoldMad,
    gag_marinering: () => onboardingData?.marinates || onboardingData?.marinerer,
    gag_stegning: () => onboardingData?.fries || onboardingData?.steger,
    gag_kogning: () => onboardingData?.boils || onboardingData?.koger,
    gag_bagning: () => onboardingData?.bakes || onboardingData?.bager,
    gag_grillning: () => onboardingData?.grills || onboardingData?.griller,
    gag_sous_vide: () => onboardingData?.usesSousVide || onboardingData?.brugerSousVide,
    gag_vacuum: () => onboardingData?.usesVacuum || onboardingData?.brugerVakuum,
    gag_fermentering: () => onboardingData?.ferments || onboardingData?.fermenterer,
    gag_røgning: () => onboardingData?.smokes || onboardingData?.roeger,
    gag_saltning: () => onboardingData?.salts || onboardingData?.salter,
    gag_tørring: () => onboardingData?.dries || onboardingData?.toerrer,
    gag_frysning: () => (onboardingData?.antalFrysere || onboardingData?.freezerCount || 0) > 0,
    gag_dybfrysning: () => onboardingData?.deepFreezes || onboardingData?.dybfryser,
    gag_blast_chilling: () => onboardingData?.usesBlastChiller || onboardingData?.brugerBlastChiller,
    gag_køling_hurtig: () => onboardingData?.coolsQuickly || onboardingData?.koelerHurtigt,
    gag_olier_fedtstoffer: () => onboardingData?.usesFats || onboardingData?.brugerFedt,
    gag_krydderier: () => onboardingData?.usesSpices || onboardingData?.brugerKrydderier,
    gag_saucer_dressinger: () => onboardingData?.makesSauces || onboardingData?.laverSaucer,
    gag_desserter: () => onboardingData?.makesDesserts || onboardingData?.laverDesserter,
    gag_bagværk: () => onboardingData?.makesPastries || onboardingData?.laverBagvaerk,
    gag_drikkevarer: () => onboardingData?.servesDrinks || onboardingData?.servererDrikkevarer,
    gag_is_sorbeter: () => onboardingData?.makesIceCream || onboardingData?.laverIs,
    gag_juice_smoothies: () => onboardingData?.makesJuices || onboardingData?.laverJuice
  };
  
  const rule = relevanceRules[itemKey];
  return rule ? rule() : false;
}

// Helper: Hent korrigerende handling
function getCorrectiveAction(itemKey, onboardingData, defaultText) {
  const answers = onboardingData?.correctiveActionAnswers || {};
  
  // Hvis brugeren har angivet et svar, brug det
  if (answers[itemKey]) {
    return answers[itemKey];
  }
  
  // Fallback til gamle felter
  const legacyFields = {
    ccp_temperatur_koel: onboardingData?.correctiveActionCooling,
    ccp_temperatur_frost: onboardingData?.correctiveActionFreezing,
    ccp_varemodtagelse: onboardingData?.correctiveActionReceiving,
    ccp_opvarmning: onboardingData?.correctiveActionHeating,
    ccp_varmholdelse: onboardingData?.correctiveActionHotHolding,
    ccp_nedkoeling: onboardingData?.correctiveActionCoolingDown,
    gag_krydskontaminering: onboardingData?.correctiveActionCrossContamination,
    gag_personlig_hygiejne: onboardingData?.correctiveActionHygiene,
    gag_rengoering: onboardingData?.correctiveActionCleaning
  };
  
  if (legacyFields[itemKey]) {
    return legacyFields[itemKey];
  }
  
  // Hvis punktet er relevant, brug standardtekst
  if (isRelevant(itemKey, onboardingData)) {
    return defaultText;
  }
  
  // Hvis punktet ikke er relevant, returner tom array
  return [];
}

// Helper: Byg ALLE 52 kontrolpunkter (6 CCP + 46 GAG)
function buildStructuredHaccpData(onboardingData) {
  const controlPoints = [];
  
  // === 6 CCP (Critical Control Points) ===
  
  controlPoints.push({
    id: "ccp_temperatur_koel",
    type: "CCP",
    title: "Temperaturkontrol - Køleskabe",
    hazard: "Bakterievækst ved utilstrækkelig køling kan føre til fødevarebårne sygdomme",
    control: "Daglig kontrol af køleskabstemperatur",
    monitoring: "Temperaturmåling minimum én gang dagligt",
    criticalLimit: "Maksimum +5°C",
    correctiveAction: getCorrectiveAction("ccp_temperatur_koel", onboardingData, "Ved temperatur over +5°C: Undersøg årsag, flyt varer til fungerende køl, kontakt tekniker hvis nødvendigt, vurdér om varer skal kasseres"),
    preventiveAction: "Regelmæssig service af køleudstyr, tjek dørtætninger, undgå overbelastning",
    documentation: "Temperaturlog",
    verification: "Ugentlig gennemgang af temperaturlog",
    relevant: isRelevant("ccp_temperatur_koel", onboardingData)
  });
  
  controlPoints.push({
    id: "ccp_temperatur_frost",
    type: "CCP",
    title: "Temperaturkontrol - Frysere",
    hazard: "Optøning og genfrosning kan føre til kvalitetstab og bakterievækst",
    control: "Daglig kontrol af frysertemperatur",
    monitoring: "Temperaturmåling minimum én gang dagligt",
    criticalLimit: "Maksimum -18°C",
    correctiveAction: getCorrectiveAction("ccp_temperatur_frost", onboardingData, "Ved temperatur over -18°C: Undersøg årsag, flyt varer til fungerende fryser, kontakt tekniker, vurdér om delvist optøede varer skal kasseres"),
    preventiveAction: "Regelmæssig service af fryseudstyr, tjek dørtætninger, undgå hyppig døråbning",
    documentation: "Temperaturlog",
    verification: "Ugentlig gennemgang af temperaturlog",
    relevant: isRelevant("ccp_temperatur_frost", onboardingData)
  });
  
  controlPoints.push({
    id: "ccp_varemodtagelse",
    type: "CCP",
    title: "Varemodtagelse af fødevarer",
    hazard: "Modtagelse af varer med forkert temperatur eller dårlig kvalitet kan kompromittere fødevaresikkerheden",
    control: "Kontrol af temperatur, emballage og holdbarhedsdato ved modtagelse",
    monitoring: "Ved hver varelevering",
    criticalLimit: "Kølevarer max +5°C, frostvarer max -12°C, intakt emballage, gyldig dato",
    correctiveAction: getCorrectiveAction("ccp_varemodtagelse", onboardingData, "Afvis varer der ikke overholder krav, dokumentér afvisning med leverandør og årsag, kontakt leverandør ved gentagne problemer"),
    preventiveAction: "Brug godkendte leverandører, kommunikér krav til leverandører, planlæg modtagelse så varer hurtigt kan lægges på køl",
    documentation: "Modtagelseslog",
    verification: "Månedlig gennemgang af modtagelseslog og afvisninger",
    relevant: isRelevant("ccp_varemodtagelse", onboardingData)
  });
  
  controlPoints.push({
    id: "ccp_opvarmning",
    type: "CCP",
    title: "Opvarmning og genopvarmning",
    hazard: "Utilstrækkelig opvarmning kan medføre overlevelse af patogene bakterier",
    control: "Måling af kernetemperatur ved opvarmning",
    monitoring: "Ved hver opvarmning af risikoprodukter (kød, fjerkræ)",
    criticalLimit: "Minimum +75°C i kernen i minimum 2 minutter",
    correctiveAction: getCorrectiveAction("ccp_opvarmning", onboardingData, "Ved temperatur under +75°C: Fortsæt opvarmning til korrekt temperatur er nået, mål igen, kassér hvis produktet har stået for længe ved lav temperatur"),
    preventiveAction: "Kalibrer termometre månedligt, træn personale i korrekt måleteknik, brug pålidelige opvarmningsmetoder",
    documentation: "Temperaturlog for tilberedning",
    verification: "Ugentlig gennemgang af opvarmningslog, månedlig kalibrering af termometre",
    relevant: isRelevant("ccp_opvarmning", onboardingData)
  });
  
  controlPoints.push({
    id: "ccp_varmholdelse",
    type: "CCP",
    title: "Varmholdelse af fødevarer",
    hazard: "Bakterievækst ved utilstrækkelig varmholdelse",
    control: "Kontrol af varmholdelsestemperatur",
    monitoring: "Minimum hver 2. time under varmholdelse",
    criticalLimit: "Minimum +65°C, maksimum 3 timer",
    correctiveAction: getCorrectiveAction("ccp_varmholdelse", onboardingData, "Ved temperatur under +65°C: Genopvarm til minimum +75°C eller kassér, dokumentér hændelse, undersøg årsag til temperaturfald"),
    preventiveAction: "Brug egnet varmholdelsesudstyr, undgå overfyldning, dæk produkter til",
    documentation: "Varmholdelseslog",
    verification: "Daglig gennemgang af varmholdelseslog",
    relevant: isRelevant("ccp_varmholdelse", onboardingData)
  });
  
  controlPoints.push({
    id: "ccp_nedkoeling",
    type: "CCP",
    title: "Nedkøling af varmbehandlede fødevarer",
    hazard: "Langsom nedkøling kan føre til vækst af sporedannende bakterier",
    control: "Kontrol af nedkølingstid og temperatur",
    monitoring: "Ved hver nedkøling",
    criticalLimit: "Fra +65°C til +10°C på maksimum 3 timer",
    correctiveAction: getCorrectiveAction("ccp_nedkoeling", onboardingData, "Ved for langsom nedkøling: Kassér produktet hvis det har været i farezonen for længe, undersøg nedkølingsmetode, brug mindre portioner eller kølebad"),
    preventiveAction: "Brug effektive nedkølingsmetoder (kølebad, blast chiller), opdel i mindre portioner, undgå tildækning under nedkøling",
    documentation: "Nedkølingslog",
    verification: "Ugentlig gennemgang af nedkølingslog",
    relevant: isRelevant("ccp_nedkoeling", onboardingData)
  });
  
  // === 46 GAG (God Arbejdsgangspraksis) ===
  
  // GAG 1-10: Grundlæggende hygiejne og sikkerhed
  controlPoints.push({
    id: "gag_krydskontaminering",
    type: "GAG",
    code: "GAG-01",
    title: "Forebyggelse af krydskontaminering",
    hazard: "Overførsel af bakterier fra råvarer til spiseklare produkter",
    control: "Adskillelse af råvarer og færdige produkter, separate redskaber",
    monitoring: "Daglig kontrol af arbejdsgange og adskillelse",
    criticalLimit: "Fuldstændig adskillelse, separate skærebrætter og knive",
    correctiveAction: getCorrectiveAction("gag_krydskontaminering", onboardingData, "Ved mistanke om krydskontaminering: Kassér berørte produkter, rengør og desinficer grundigt, gennemgå procedurer med personale"),
    preventiveAction: "Farvekodede redskaber, træning af personale, tydelig opdeling af arbejdsområder",
    documentation: "Daglig tjekliste",
    verification: "Ugentlig observation af arbejdsgange",
    relevant: isRelevant("gag_krydskontaminering", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_personlig_hygiejne",
    type: "GAG",
    code: "GAG-02",
    title: "Personlig hygiejne",
    hazard: "Overførsel af bakterier og virus fra personale til fødevarer",
    control: "Håndvask, rene uniformer, ingen smykker, sygemelding ved sygdom",
    monitoring: "Daglig observation",
    criticalLimit: "Håndvask før arbejde og efter toiletbesøg, sygemelding ved mave-tarm symptomer",
    correctiveAction: getCorrectiveAction("gag_personlig_hygiejne", onboardingData, "Ved manglende hygiejne: Påmind personale, send hjem ved sygdom, gennemgå hygiejneprocedurer"),
    preventiveAction: "Regelmæssig træning, synlige instruktioner ved håndvaske, tilgængelige håndvaskefaciliteter",
    documentation: "Sygdomslog, træningslog",
    verification: "Månedlig hygiejneaudit",
    relevant: isRelevant("gag_personlig_hygiejne", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_rengoering",
    type: "GAG",
    code: "GAG-03",
    title: "Rengøring og desinfektion",
    hazard: "Bakterievækst på urene overflader og udstyr",
    control: "Daglig rengøring efter rengøringsplan",
    monitoring: "Daglig visuel inspektion",
    criticalLimit: "Alle kontaktflader rene, ingen synlige madrester",
    correctiveAction: getCorrectiveAction("gag_rengoering", onboardingData, "Ved utilstrækkelig rengøring: Genrengør straks, gennemgå rengøringsplan, træn personale i korrekt teknik"),
    preventiveAction: "Detaljeret rengøringsplan, tilgængelige rengøringsmidler, regelmæssig træning",
    documentation: "Rengøringslog",
    verification: "Ugentlig dybdeinspektion, månedlig audit",
    relevant: isRelevant("gag_rengoering", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_allergener",
    type: "GAG",
    code: "GAG-04",
    title: "Håndtering af allergener",
    hazard: "Allergiske reaktioner hos kunder ved utilstrækkelig allergenhåndtering",
    control: "Mærkning, adskillelse og information om allergener",
    monitoring: "Ved hver produktion og servering",
    criticalLimit: "Korrekt mærkning af alle allergener, ingen krydskontaminering",
    correctiveAction: getCorrectiveAction("gag_allergener", onboardingData, "Ved fejl i allergenmærkning: Træk produkt tilbage, informér kunder, gennemgå procedurer"),
    preventiveAction: "Allergenmatrix, træning af personale, tydelig mærkning af ingredienser",
    documentation: "Allergenlog, recepter",
    verification: "Månedlig gennemgang af allergenprocedurer",
    relevant: isRelevant("gag_allergener", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_sporbarhed",
    type: "GAG",
    code: "GAG-05",
    title: "Sporbarhed af råvarer",
    hazard: "Manglende evne til at spore og tilbagekalde produkter ved fødevaresikkerhedsproblemer",
    control: "Registrering af leverandører, batchnumre og modtagelsesdatoer",
    monitoring: "Ved hver varemodtagelse",
    criticalLimit: "Fuld sporbarhed fra leverandør til færdigt produkt",
    correctiveAction: getCorrectiveAction("gag_sporbarhed", onboardingData, "Ved manglende sporbarhed: Identificér manglende information, kontakt leverandør, forbedre registreringssystem"),
    preventiveAction: "Digitalt registreringssystem, træning af personale, regelmæssig audit",
    documentation: "Modtagelseslog, leverandørliste",
    verification: "Kvartalsvis sporbarhedstest",
    relevant: isRelevant("gag_sporbarhed", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_pest_control",
    type: "GAG",
    code: "GAG-06",
    title: "Skadedyrsbekæmpelse",
    hazard: "Kontaminering af fødevarer ved skadedyr",
    control: "Regelmæssig inspektion og professionel skadedyrsbekæmpelse",
    monitoring: "Månedlig inspektion af lokaler",
    criticalLimit: "Ingen tegn på skadedyr",
    correctiveAction: getCorrectiveAction("gag_pest_control", onboardingData, "Ved tegn på skadedyr: Kontakt skadedyrsbekæmper, identificér indtrængningsveje, kassér berørte varer"),
    preventiveAction: "Tæt alle huller, opbevar affald korrekt, hold døre og vinduer lukkede",
    documentation: "Skadedyrslog, servicerapporter",
    verification: "Kvartalsvis gennemgang af skadedyrsrapporter",
    relevant: isRelevant("gag_pest_control", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_vandkvalitet",
    type: "GAG",
    code: "GAG-07",
    title: "Vandkvalitet",
    hazard: "Kontaminering af fødevarer ved forurenet vand",
    control: "Brug af drikkevand til fødevareproduktion",
    monitoring: "Årlig vandprøve",
    criticalLimit: "Vand skal overholde drikkevandskrav",
    correctiveAction: getCorrectiveAction("gag_vandkvalitet", onboardingData, "Ved dårlig vandkvalitet: Stop produktion, brug flaskevand, kontakt vandværk, få taget ny prøve"),
    preventiveAction: "Regelmæssig vedligeholdelse af vandsystem, undgå stagnerende vand",
    documentation: "Vandanalyser",
    verification: "Årlig vandanalyse",
    relevant: isRelevant("gag_vandkvalitet", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_affaldshåndtering",
    type: "GAG",
    code: "GAG-08",
    title: "Affaldshåndtering",
    hazard: "Kontaminering ved forkert affaldshåndtering",
    control: "Separate affaldsbeholdere, hyppig tømning",
    monitoring: "Daglig kontrol",
    criticalLimit: "Affald adskilt fra fødevarer, beholdere med låg",
    correctiveAction: getCorrectiveAction("gag_affaldshåndtering", onboardingData, "Ved problemer: Rengør område, gennemgå procedurer, sørg for tilstrækkelige affaldsbeholdere"),
    preventiveAction: "Tilstrækkelige affaldsbeholdere, klar opdeling, regelmæssig tømning",
    documentation: "Rengøringslog",
    verification: "Ugentlig inspektion",
    relevant: isRelevant("gag_affaldshåndtering", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_vedligeholdelse",
    type: "GAG",
    code: "GAG-09",
    title: "Vedligeholdelse af lokaler og udstyr",
    hazard: "Kontaminering ved dårligt vedligeholdt udstyr",
    control: "Regelmæssig vedligeholdelse og reparation",
    monitoring: "Månedlig inspektion",
    criticalLimit: "Alt udstyr funktionsdygtigt, ingen rust eller skader",
    correctiveAction: getCorrectiveAction("gag_vedligeholdelse", onboardingData, "Ved defekt udstyr: Tag ud af drift, reparer eller udskift, rengør grundigt"),
    preventiveAction: "Vedligeholdelsesplan, regelmæssig service, hurtig reparation",
    documentation: "Vedligeholdelseslog",
    verification: "Kvartalsvis gennemgang",
    relevant: isRelevant("gag_vedligeholdelse", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_personale_træning",
    type: "GAG",
    code: "GAG-10",
    title: "Personaletræning i fødevaresikkerhed",
    hazard: "Fejl ved manglende viden om fødevaresikkerhed",
    control: "Årlig træning af alt personale",
    monitoring: "Registrering af gennemført træning",
    criticalLimit: "Alt personale trænet inden arbejdsstart",
    correctiveAction: getCorrectiveAction("gag_personale_træning", onboardingData, "Ved manglende træning: Gennemfør træning straks, supervision indtil trænet"),
    preventiveAction: "Struktureret træningsprogram, løbende opdatering",
    documentation: "Træningslog",
    verification: "Årlig gennemgang af træningsstatus",
    relevant: isRelevant("gag_personale_træning", onboardingData)
  });
  
  // GAG 11-20: Arbejdstøj og opbevaring
  controlPoints.push({
    id: "gag_arbejdstøj",
    type: "GAG",
    code: "GAG-11",
    title: "Arbejdstøj og beskyttelsesudstyr",
    hazard: "Kontaminering via beskidt arbejdstøj",
    control: "Rent arbejdstøj dagligt, hårnet, ingen smykker",
    monitoring: "Daglig observation",
    criticalLimit: "Rent arbejdstøj, hår dækket, ingen smykker",
    correctiveAction: getCorrectiveAction("gag_arbejdstøj", onboardingData, "Ved mangler: Skift arbejdstøj, påmind om regler"),
    preventiveAction: "Tilstrækkeligt arbejdstøj, vaskefaciliteter, klare regler",
    documentation: "Hygiejneaudit",
    verification: "Ugentlig observation",
    relevant: isRelevant("gag_arbejdstøj", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_optøning",
    type: "GAG",
    code: "GAG-12",
    title: "Sikker optøning af frosne varer",
    hazard: "Bakterievækst ved forkert optøning",
    control: "Optøning i køleskab eller under koldt rindende vand",
    monitoring: "Ved hver optøning",
    criticalLimit: "Optøning ved max +5°C eller under koldt vand",
    correctiveAction: getCorrectiveAction("gag_optøning", onboardingData, "Ved forkert optøning: Vurdér produktets sikkerhed, kassér hvis nødvendigt"),
    preventiveAction: "Planlæg optøning i god tid, træn personale",
    documentation: "Optøningslog",
    verification: "Ugentlig kontrol",
    relevant: isRelevant("gag_optøning", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_emballering",
    type: "GAG",
    code: "GAG-13",
    title: "Emballering af fødevarer",
    hazard: "Kontaminering ved forkert emballering",
    control: "Brug af egnet emballage, hygiejnisk håndtering",
    monitoring: "Ved hver emballering",
    criticalLimit: "Ren emballage, korrekt lukket",
    correctiveAction: getCorrectiveAction("gag_emballering", onboardingData, "Ved fejl: Omemballér produkt, gennemgå procedure"),
    preventiveAction: "Egnet emballage, træning, rene arbejdsområder",
    documentation: "Produktionslog",
    verification: "Ugentlig kontrol",
    relevant: isRelevant("gag_emballering", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_mærkning",
    type: "GAG",
    code: "GAG-14",
    title: "Mærkning af fødevarer",
    hazard: "Forvirring og fejlbrug ved manglende mærkning",
    control: "Korrekt mærkning med dato, indhold, allergener",
    monitoring: "Ved hver mærkning",
    criticalLimit: "Alle produkter korrekt mærket",
    correctiveAction: getCorrectiveAction("gag_mærkning", onboardingData, "Ved fejl: Ret mærkning straks, gennemgå procedure"),
    preventiveAction: "Mærkningssystem, skabeloner, træning",
    documentation: "Produktionslog",
    verification: "Daglig stikprøve",
    relevant: isRelevant("gag_mærkning", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_holdbarhed",
    type: "GAG",
    code: "GAG-15",
    title: "Holdbarhedsdatoer og FIFO",
    hazard: "Brug af for gamle produkter",
    control: "FIFO-princip, kontrol af holdbarhedsdatoer",
    monitoring: "Daglig kontrol",
    criticalLimit: "Ingen produkter over holdbarhedsdato",
    correctiveAction: getCorrectiveAction("gag_holdbarhed", onboardingData, "Ved udgåede produkter: Kassér straks, gennemgå lagerstyring"),
    preventiveAction: "FIFO-system, regelmæssig gennemgang af lager",
    documentation: "Kasseringslog",
    verification: "Ugentlig lagerkontrol",
    relevant: isRelevant("gag_holdbarhed", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_transport",
    type: "GAG",
    code: "GAG-16",
    title: "Transport af fødevarer",
    hazard: "Temperaturstigninger under transport",
    control: "Køletransport, temperaturkontrol",
    monitoring: "Ved hver transport",
    criticalLimit: "Kølevarer max +5°C, frostvarer max -18°C",
    correctiveAction: getCorrectiveAction("gag_transport", onboardingData, "Ved temperaturafvigelse: Vurdér produktsikkerhed, kassér hvis nødvendigt"),
    preventiveAction: "Isolerede transportkasser, hurtig transport",
    documentation: "Transportlog",
    verification: "Ugentlig gennemgang",
    relevant: isRelevant("gag_transport", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_servering",
    type: "GAG",
    code: "GAG-17",
    title: "Servering af fødevarer",
    hazard: "Kontaminering ved servering",
    control: "Brug af rent serveringsudstyr, korrekt temperatur",
    monitoring: "Ved hver servering",
    criticalLimit: "Varme retter min +65°C, kolde max +5°C",
    correctiveAction: getCorrectiveAction("gag_servering", onboardingData, "Ved temperaturafvigelse: Genopvarm eller køl ned, kassér hvis nødvendigt"),
    preventiveAction: "Egnet serveringsudstyr, træning",
    documentation: "Serveringslog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_servering", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_buffet",
    type: "GAG",
    code: "GAG-18",
    title: "Buffet og selvbetjening",
    hazard: "Kontaminering ved selvbetjening",
    control: "Beskyttelse af mad, hyppig udskiftning",
    monitoring: "Løbende under servering",
    criticalLimit: "Varme retter min +65°C, kolde max +5°C, max 3 timer",
    correctiveAction: getCorrectiveAction("gag_buffet", onboardingData, "Ved problemer: Udskift mad, rengør område"),
    preventiveAction: "Beskyttelse, serveringsredskaber, temperaturkontrol",
    documentation: "Buffetlog",
    verification: "Ved hver buffet",
    relevant: isRelevant("gag_buffet", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_catering",
    type: "GAG",
    code: "GAG-19",
    title: "Catering og udeservering",
    hazard: "Temperaturstigninger ved catering",
    control: "Køle- og varmeudstyr, hurtig transport",
    monitoring: "Ved hver catering",
    criticalLimit: "Korrekt temperatur ved ankomst",
    correctiveAction: getCorrectiveAction("gag_catering", onboardingData, "Ved temperaturafvigelse: Vurdér sikkerhed, kassér hvis nødvendigt"),
    preventiveAction: "Egnet transportudstyr, planlægning",
    documentation: "Cateringlog",
    verification: "Ved hver catering",
    relevant: isRelevant("gag_catering", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_takeaway",
    type: "GAG",
    code: "GAG-20",
    title: "Takeaway og madpakker",
    hazard: "Kontaminering ved pakning",
    control: "Hygiejnisk pakning, korrekt emballage",
    monitoring: "Ved hver pakning",
    criticalLimit: "Ren emballage, korrekt temperatur",
    correctiveAction: getCorrectiveAction("gag_takeaway", onboardingData, "Ved fejl: Ompak produkt, gennemgå procedure"),
    preventiveAction: "Egnet emballage, træning",
    documentation: "Pakningslog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_takeaway", onboardingData)
  });
  
  // GAG 21-30: Råvarer og tilberedning
  controlPoints.push({
    id: "gag_levering",
    type: "GAG",
    code: "GAG-21",
    title: "Levering til kunder",
    hazard: "Temperaturstigninger ved levering",
    control: "Køletransport, hurtig levering",
    monitoring: "Ved hver levering",
    criticalLimit: "Korrekt temperatur ved levering",
    correctiveAction: getCorrectiveAction("gag_levering", onboardingData, "Ved temperaturafvigelse: Informér kunde, vurdér sikkerhed"),
    preventiveAction: "Isolerede kasser, ruteplanlægning",
    documentation: "Leveringslog",
    verification: "Ugentlig gennemgang",
    relevant: isRelevant("gag_levering", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_råvarer_animalsk",
    type: "GAG",
    code: "GAG-22",
    title: "Håndtering af animalske råvarer",
    hazard: "Bakteriekontaminering fra kød og fjerkræ",
    control: "Adskillelse, korrekt opbevaring, grundig tilberedning",
    monitoring: "Daglig kontrol",
    criticalLimit: "Opbevaring max +5°C, tilberedning min +75°C",
    correctiveAction: getCorrectiveAction("gag_råvarer_animalsk", onboardingData, "Ved afvigelse: Kassér hvis nødvendigt, gennemgå procedure"),
    preventiveAction: "Separate redskaber, træning",
    documentation: "Temperaturlog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_råvarer_animalsk", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_råvarer_vegetabilsk",
    type: "GAG",
    code: "GAG-23",
    title: "Håndtering af vegetabilske råvarer",
    hazard: "Kontaminering fra jord og pesticider",
    control: "Grundig vask, adskillelse fra tilberedte produkter",
    monitoring: "Ved hver tilberedning",
    criticalLimit: "Alle grøntsager vasket",
    correctiveAction: getCorrectiveAction("gag_råvarer_vegetabilsk", onboardingData, "Ved manglende vask: Vask grundigt, gennemgå procedure"),
    preventiveAction: "Vaskeprocedure, træning",
    documentation: "Tilberedningslog",
    verification: "Daglig observation",
    relevant: isRelevant("gag_råvarer_vegetabilsk", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_råvarer_fisk",
    type: "GAG",
    code: "GAG-24",
    title: "Håndtering af fisk og skaldyr",
    hazard: "Hurtig fordærvelse og histamindannelse",
    control: "Kølig opbevaring, hurtig forarbejdning",
    monitoring: "Daglig kontrol",
    criticalLimit: "Opbevaring max +2°C, hurtig brug",
    correctiveAction: getCorrectiveAction("gag_råvarer_fisk", onboardingData, "Ved temperaturafvigelse: Vurdér kvalitet, kassér hvis tvivl"),
    preventiveAction: "Kølig opbevaring, hurtig omsætning",
    documentation: "Temperaturlog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_råvarer_fisk", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_råvarer_æg",
    type: "GAG",
    code: "GAG-25",
    title: "Håndtering af æg",
    hazard: "Salmonellakontaminering",
    control: "Kølig opbevaring, grundig tilberedning",
    monitoring: "Daglig kontrol",
    criticalLimit: "Opbevaring max +5°C, tilberedning min +75°C",
    correctiveAction: getCorrectiveAction("gag_råvarer_æg", onboardingData, "Ved afvigelse: Kassér hvis nødvendigt"),
    preventiveAction: "Kølig opbevaring, træning",
    documentation: "Temperaturlog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_råvarer_æg", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_råvarer_mælk",
    type: "GAG",
    code: "GAG-26",
    title: "Håndtering af mælkeprodukter",
    hazard: "Bakterievækst i mælkeprodukter",
    control: "Kølig opbevaring, kontrol af holdbarhed",
    monitoring: "Daglig kontrol",
    criticalLimit: "Opbevaring max +5°C",
    correctiveAction: getCorrectiveAction("gag_råvarer_mælk", onboardingData, "Ved temperaturafvigelse: Vurdér kvalitet, kassér hvis tvivl"),
    preventiveAction: "Kølig opbevaring, FIFO",
    documentation: "Temperaturlog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_råvarer_mælk", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_tilberedning_varme",
    type: "GAG",
    code: "GAG-27",
    title: "Varm tilberedning",
    hazard: "Utilstrækkelig varmebehandling",
    control: "Måling af kernetemperatur",
    monitoring: "Ved hver tilberedning",
    criticalLimit: "Minimum +75°C i kernen",
    correctiveAction: getCorrectiveAction("gag_tilberedning_varme", onboardingData, "Ved for lav temperatur: Fortsæt tilberedning"),
    preventiveAction: "Kalibrerede termometre, træning",
    documentation: "Temperaturlog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_tilberedning_varme", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_tilberedning_kolde",
    type: "GAG",
    code: "GAG-28",
    title: "Kold tilberedning",
    hazard: "Bakterievækst ved kolde retter",
    control: "Kølig tilberedning, hurtig servering",
    monitoring: "Ved hver tilberedning",
    criticalLimit: "Tilberedning ved max +12°C, servering inden 2 timer",
    correctiveAction: getCorrectiveAction("gag_tilberedning_kolde", onboardingData, "Ved temperaturafvigelse: Køl ned eller kassér"),
    preventiveAction: "Kølige arbejdsområder, hurtig arbejdsgang",
    documentation: "Tilberedningslog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_tilberedning_kolde", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_marinering",
    type: "GAG",
    code: "GAG-29",
    title: "Marinering",
    hazard: "Bakterievækst under marinering",
    control: "Marinering i køleskab",
    monitoring: "Ved hver marinering",
    criticalLimit: "Marinering ved max +5°C",
    correctiveAction: getCorrectiveAction("gag_marinering", onboardingData, "Ved temperaturafvigelse: Vurdér sikkerhed, kassér hvis tvivl"),
    preventiveAction: "Marinering i køleskab, dækkede beholdere",
    documentation: "Tilberedningslog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_marinering", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_stegning",
    type: "GAG",
    code: "GAG-30",
    title: "Stegning",
    hazard: "Utilstrækkelig varmebehandling ved stegning",
    control: "Kontrol af kernetemperatur",
    monitoring: "Ved hver stegning",
    criticalLimit: "Minimum +75°C i kernen",
    correctiveAction: getCorrectiveAction("gag_stegning", onboardingData, "Ved for lav temperatur: Fortsæt stegning"),
    preventiveAction: "Kalibrerede termometre, træning",
    documentation: "Temperaturlog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_stegning", onboardingData)
  });
  
  // GAG 31-40: Specielle tilberedningsmetoder
  controlPoints.push({
    id: "gag_kogning",
    type: "GAG",
    code: "GAG-31",
    title: "Kogning",
    hazard: "Utilstrækkelig varmebehandling",
    control: "Fuld kogning, kontrol af kernetemperatur",
    monitoring: "Ved hver kogning",
    criticalLimit: "Minimum +75°C i kernen",
    correctiveAction: getCorrectiveAction("gag_kogning", onboardingData, "Ved for lav temperatur: Fortsæt kogning"),
    preventiveAction: "Tilstrækkelig kogetid, træning",
    documentation: "Temperaturlog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_kogning", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_bagning",
    type: "GAG",
    code: "GAG-32",
    title: "Bagning",
    hazard: "Utilstrækkelig varmebehandling",
    control: "Korrekt ovntemperatur og bagetid",
    monitoring: "Ved hver bagning",
    criticalLimit: "Minimum +75°C i kernen",
    correctiveAction: getCorrectiveAction("gag_bagning", onboardingData, "Ved for lav temperatur: Fortsæt bagning"),
    preventiveAction: "Kalibreret ovn, opskrifter",
    documentation: "Temperaturlog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_bagning", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_grillning",
    type: "GAG",
    code: "GAG-33",
    title: "Grillning",
    hazard: "Utilstrækkelig varmebehandling",
    control: "Kontrol af kernetemperatur",
    monitoring: "Ved hver grillning",
    criticalLimit: "Minimum +75°C i kernen",
    correctiveAction: getCorrectiveAction("gag_grillning", onboardingData, "Ved for lav temperatur: Fortsæt grillning"),
    preventiveAction: "Kalibrerede termometre, træning",
    documentation: "Temperaturlog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_grillning", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_sous_vide",
    type: "GAG",
    code: "GAG-34",
    title: "Sous vide tilberedning",
    hazard: "Bakterievækst ved lav temperatur",
    control: "Præcis temperaturkontrol, korrekt tid",
    monitoring: "Ved hver tilberedning",
    criticalLimit: "Minimum 55°C i minimum 6 timer eller tilsvarende",
    correctiveAction: getCorrectiveAction("gag_sous_vide", onboardingData, "Ved afvigelse: Kassér produkt, gennemgå procedure"),
    preventiveAction: "Kalibreret udstyr, dokumenterede opskrifter",
    documentation: "Sous vide log",
    verification: "Ved hver tilberedning",
    relevant: isRelevant("gag_sous_vide", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_vacuum",
    type: "GAG",
    code: "GAG-35",
    title: "Vakuumpakning",
    hazard: "Vækst af anaerobe bakterier",
    control: "Korrekt vakuumering, kølig opbevaring",
    monitoring: "Ved hver pakning",
    criticalLimit: "Korrekt vakuum, opbevaring max +5°C",
    correctiveAction: getCorrectiveAction("gag_vacuum", onboardingData, "Ved defekt pakning: Ompak eller kassér"),
    preventiveAction: "Vedligeholdt udstyr, træning",
    documentation: "Pakningslog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_vacuum", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_fermentering",
    type: "GAG",
    code: "GAG-36",
    title: "Fermentering",
    hazard: "Vækst af uønskede mikroorganismer",
    control: "Kontrolleret fermentering, korrekt pH",
    monitoring: "Daglig under fermentering",
    criticalLimit: "pH under 4.6 eller dokumenteret sikker proces",
    correctiveAction: getCorrectiveAction("gag_fermentering", onboardingData, "Ved afvigelse: Kassér batch, gennemgå proces"),
    preventiveAction: "Dokumenterede opskrifter, pH-måling",
    documentation: "Fermenteringslog",
    verification: "Ved hver batch",
    relevant: isRelevant("gag_fermentering", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_røgning",
    type: "GAG",
    code: "GAG-37",
    title: "Røgning",
    hazard: "Utilstrækkelig konservering",
    control: "Korrekt røgning, temperatur og tid",
    monitoring: "Ved hver røgning",
    criticalLimit: "Dokumenteret sikker proces",
    correctiveAction: getCorrectiveAction("gag_røgning", onboardingData, "Ved afvigelse: Vurdér sikkerhed, kassér hvis tvivl"),
    preventiveAction: "Dokumenterede opskrifter, kalibreret udstyr",
    documentation: "Røgningslog",
    verification: "Ved hver røgning",
    relevant: isRelevant("gag_røgning", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_saltning",
    type: "GAG",
    code: "GAG-38",
    title: "Saltning og konservering",
    hazard: "Utilstrækkelig konservering",
    control: "Korrekt saltkoncentration",
    monitoring: "Ved hver saltning",
    criticalLimit: "Dokumenteret sikker saltkoncentration",
    correctiveAction: getCorrectiveAction("gag_saltning", onboardingData, "Ved afvigelse: Tilsæt salt eller kassér"),
    preventiveAction: "Dokumenterede opskrifter, præcis afvejning",
    documentation: "Saltningslog",
    verification: "Ved hver batch",
    relevant: isRelevant("gag_saltning", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_tørring",
    type: "GAG",
    code: "GAG-39",
    title: "Tørring",
    hazard: "Utilstrækkelig tørring",
    control: "Korrekt temperatur og tid",
    monitoring: "Ved hver tørring",
    criticalLimit: "Vandaktivitet under 0.85",
    correctiveAction: getCorrectiveAction("gag_tørring", onboardingData, "Ved utilstrækkelig tørring: Fortsæt tørring"),
    preventiveAction: "Dokumenterede procedurer, kontrolleret proces",
    documentation: "Tørringslog",
    verification: "Ved hver batch",
    relevant: isRelevant("gag_tørring", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_frysning",
    type: "GAG",
    code: "GAG-40",
    title: "Frysning af fødevarer",
    hazard: "Langsom frysning giver kvalitetstab",
    control: "Hurtig frysning, korrekt emballering",
    monitoring: "Ved hver frysning",
    criticalLimit: "Frysning til -18°C inden 24 timer",
    correctiveAction: getCorrectiveAction("gag_frysning", onboardingData, "Ved langsom frysning: Vurdér kvalitet"),
    preventiveAction: "Effektivt fryseudstyr, små portioner",
    documentation: "Frysningslog",
    verification: "Ugentlig kontrol",
    relevant: isRelevant("gag_frysning", onboardingData)
  });
  
  // GAG 41-46: Specialprodukter
  controlPoints.push({
    id: "gag_dybfrysning",
    type: "GAG",
    code: "GAG-41",
    title: "Dybfrysning",
    hazard: "Utilstrækkelig frysning",
    control: "Dybfrysning til -18°C eller lavere",
    monitoring: "Ved hver dybfrysning",
    criticalLimit: "Minimum -18°C",
    correctiveAction: getCorrectiveAction("gag_dybfrysning", onboardingData, "Ved temperaturafvigelse: Fortsæt frysning"),
    preventiveAction: "Effektivt fryseudstyr, vedligeholdelse",
    documentation: "Temperaturlog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_dybfrysning", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_blast_chilling",
    type: "GAG",
    code: "GAG-42",
    title: "Blast chilling (hurtig nedkøling)",
    hazard: "Bakterievækst ved langsom nedkøling",
    control: "Blast chiller, temperaturkontrol",
    monitoring: "Ved hver nedkøling",
    criticalLimit: "Fra +65°C til +10°C på max 90 minutter",
    correctiveAction: getCorrectiveAction("gag_blast_chilling", onboardingData, "Ved for langsom nedkøling: Kassér hvis over 3 timer"),
    preventiveAction: "Vedligeholdt blast chiller, små portioner",
    documentation: "Nedkølingslog",
    verification: "Ved hver nedkøling",
    relevant: isRelevant("gag_blast_chilling", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_køling_hurtig",
    type: "GAG",
    code: "GAG-43",
    title: "Hurtig nedkøling",
    hazard: "Bakterievækst i farezonen",
    control: "Effektiv nedkøling, små portioner",
    monitoring: "Ved hver nedkøling",
    criticalLimit: "Fra +65°C til +10°C på max 3 timer",
    correctiveAction: getCorrectiveAction("gag_køling_hurtig", onboardingData, "Ved for langsom nedkøling: Kassér produkt"),
    preventiveAction: "Små portioner, kølebad, blast chiller",
    documentation: "Nedkølingslog",
    verification: "Ved hver nedkøling",
    relevant: isRelevant("gag_køling_hurtig", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_olier_fedtstoffer",
    type: "GAG",
    code: "GAG-44",
    title: "Håndtering af olier og fedtstoffer",
    hazard: "Harskhed og kontaminering",
    control: "Korrekt opbevaring, regelmæssig udskiftning",
    monitoring: "Daglig kontrol",
    criticalLimit: "Ingen harsk lugt, klar olie",
    correctiveAction: getCorrectiveAction("gag_olier_fedtstoffer", onboardingData, "Ved harskhed: Udskift olie straks"),
    preventiveAction: "Kølig mørk opbevaring, regelmæssig udskiftning",
    documentation: "Olieudskiftningslog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_olier_fedtstoffer", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_krydderier",
    type: "GAG",
    code: "GAG-45",
    title: "Håndtering af krydderier",
    hazard: "Kontaminering og tab af kvalitet",
    control: "Tør opbevaring, lukkede beholdere",
    monitoring: "Månedlig kontrol",
    criticalLimit: "Tørt, ingen klumper, ingen skimmel",
    correctiveAction: getCorrectiveAction("gag_krydderier", onboardingData, "Ved fugt eller skimmel: Kassér straks"),
    preventiveAction: "Tør opbevaring, lukkede beholdere",
    documentation: "Lagerkontrol",
    verification: "Månedlig kontrol",
    relevant: isRelevant("gag_krydderier", onboardingData)
  });
  
  controlPoints.push({
    id: "gag_saucer_dressinger",
    type: "GAG",
    code: "GAG-46",
    title: "Fremstilling af saucer og dressinger",
    hazard: "Bakterievækst i saucer",
    control: "Kølig opbevaring, hurtig brug",
    monitoring: "Daglig kontrol",
    criticalLimit: "Opbevaring max +5°C, brug inden 3 dage",
    correctiveAction: getCorrectiveAction("gag_saucer_dressinger", onboardingData, "Ved temperaturafvigelse: Kassér hvis tvivl"),
    preventiveAction: "Kølig opbevaring, små portioner",
    documentation: "Produktionslog",
    verification: "Daglig kontrol",
    relevant: isRelevant("gag_saucer_dressinger", onboardingData)
  });
  
  return controlPoints;
}

// Helper: Byg operationelle templates fra onboarding
function buildOperationalTemplatesFromOnboarding(onboardingData) {
  const templates = [];

  // Læs antal enheder fra onboarding
  const d = onboardingData || {};
  const fridgeCount        = parseInt(d.antalKoeleskabe         || d.fridgeCount        || 0, 10);
  const freezerCount       = parseInt(d.antalFrysere            || d.freezerCount       || 0, 10);
  const walkInCoolerCount  = parseInt(d.walkInCoolerCount       || (d.hasWalkInCooler  ? 1 : 0), 10);
  const walkInFreezerCount = parseInt(d.walkInFreezerCount      || (d.hasWalkInFreezer ? 1 : 0), 10);
  const iceMachineCount    = parseInt(d.antalIsterningemaskiner || 0, 10);
  const isboksCount        = parseInt(d.antalIsbokse            || 0, 10);
  const fritureCount       = parseInt(d.antalFrityreGryder      || 0, 10);
  const dishwasherCount    = parseInt(d.antalOpvaskemaskiner    || 0, 10);

  // Temperaturkontrol og rengøring for køleskabe
  for (let i = 1; i <= fridgeCount; i++) {
    templates.push({ id: `temperaturkontrol_koeleskab_${i}`, title: `Temperaturkontrol – Køleskab ${i}`, category: "temperatur", formType: "temperature" });
    templates.push({ id: `rengoering_koeleskab_${i}`,       title: `Rengøring – Køleskab ${i}`,         category: "rengoering", formType: "cleaning" });
  }
  
  // Temperaturkontrol og rengøring for frysere
  for (let i = 1; i <= freezerCount; i++) {
    templates.push({ id: `temperaturkontrol_fryser_${i}`, title: `Temperaturkontrol – Fryser ${i}`, category: "temperatur", formType: "temperature" });
    templates.push({ id: `rengoering_fryser_${i}`,        title: `Rengøring – Fryser ${i}`,         category: "rengoering", formType: "cleaning" });
  }

  // Walk-in kølere
  for (let i = 1; i <= walkInCoolerCount; i++) {
    templates.push({ id: `temperaturkontrol_koerum_${i}`, title: `Temperaturkontrol – Kølerum ${i}`, category: "temperatur", formType: "temperature" });
    templates.push({ id: `rengoering_koerum_${i}`,        title: `Rengøring – Kølerum ${i}`,         category: "rengoering", formType: "cleaning" });
  }

  // Walk-in frysere
  for (let i = 1; i <= walkInFreezerCount; i++) {
    templates.push({ id: `temperaturkontrol_fryserum_${i}`, title: `Temperaturkontrol – Fryserum ${i}`, category: "temperatur", formType: "temperature" });
    templates.push({ id: `rengoering_fryserum_${i}`,        title: `Rengøring – Fryserum ${i}`,         category: "rengoering", formType: "cleaning" });
  }

  // Isterningemaskiner
  for (let i = 1; i <= iceMachineCount; i++) {
    templates.push({ id: `rengoering_ismaskine_${i}`, title: `Rengøring – Isterningemaskine ${i}`, category: "rengoering", formType: "cleaning" });
  }

  for (let i = 1; i <= iceMachineCount; i++) {
    const templateId = `rengoering_ismaskine_${i}`;
    const templateIndex = templates.findIndex((template) => template.id === templateId);
    if (templateIndex === -1) continue;

    templates[templateIndex] = {
      ...templates[templateIndex],
      title: `Rengøring af isterningemaskine ${i}`,
      frequency: "monthly"
    };
  }

  // Isbokse
  for (let i = 1; i <= isboksCount; i++) {
    templates.push({ id: `temperaturkontrol_isboks_${i}`, title: `Temperaturkontrol – Isboks ${i}`, category: "temperatur", formType: "temperature" });
    templates.push({ id: `rengoering_isboks_${i}`,        title: `Rengøring – Isboks ${i}`,         category: "rengoering", formType: "cleaning" });
  }

  // Dishwashers
  for (let i = 1; i <= dishwasherCount; i++) {
    templates.push({ id: `temperaturkontrol_opvaskemaskine_${i}`, title: `Temperaturkontrol – Opvaskemaskine ${i}`, category: "temperatur", formType: "temperature" });
  }

  // Faste rengøringsområder - EN samlet rutine
  templates.push(
    { id: "rengoering_food_areas_daily",  title: "Daglig rengøring af fødevareområder",   category: "rengoering", formType: "cleaning" },
    { id: "rengoering_toilet_haandvask",  title: "Rengøring – Toilet og håndvask",         category: "rengoering", formType: "cleaning" }
  );

  // Operationelle driftspunkter baseret på aktiviteter
  const activities = {
    receivesChilledGoods: { id: "varemodtagelse", title: "Varemodtagelse af fødevarer", category: "modtagelse" },
    modtagerKoelevarer:   { id: "varemodtagelse", title: "Varemodtagelse af fødevarer", category: "modtagelse" },
    coolsHotFood:         { id: "nedkoeling",     title: "Nedkøling",                   category: "nedkoeling" },
    nedkoelerMad:         { id: "nedkoeling",     title: "Nedkøling",                   category: "nedkoeling" },
    preparesHotFood:      { id: "opvarmning",     title: "Genopvarmning",               category: "tilberedning" },
    tilberederVarmMad:    { id: "opvarmning",     title: "Genopvarmning",               category: "tilberedning" },
    holdsHotFood:         { id: "varmholdelse",   title: "Varmholdelse",                category: "varmholdelse" },
    varmholder:           { id: "varmholdelse",   title: "Varmholdelse",                category: "varmholdelse" }
  };

  const addedIds = new Set();

  for (const [field, template] of Object.entries(activities)) {
    if (d[field] && !addedIds.has(template.id)) {
      templates.push({ id: template.id, title: template.title, category: template.category, formType: "checklist" });
      addedIds.add(template.id);
    }
  }

  // Altid tilføj adskillelse og rengøring (grundlæggende krav)
  templates.push(
    {
      id: "adskillelse",
      title: "Opbevaring og adskillelse",
      category: "opbevaring",
      formType: "checklist"
    },
    {
      id: "rengoering_overflader",
      title: "Rengøringskontrol – Overflader",
      category: "rengoering",
      formType: "cleaning"
    },
    {
      id: "rengoering_udstyr",
      title: "Rengøringskontrol – Udstyr",
      category: "rengoering",
      formType: "cleaning"
    }
  );


  // Friture
  for (let i = 1; i <= fritureCount; i++) {
    templates.push({ id: `temperaturkontrol_friture_${i}`, title: `Temperaturkontrol – Friture ${i}`, category: "temperatur", formType: "temperature" });
    templates.push({ id: `rengoering_friture_${i}`,        title: `Rengøring – Friture ${i}`,         category: "rengoering", formType: "cleaning" });
  }

  return templates;
}
// TIL HER

// === PROVISIONING: RISIKOANALYSE ===
exports.generateRiskAnalysisProvision = functions.https.onCall(
  { region: "europe-west1" },
  async (request) => {

    const auth = request.auth;
    if (!auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
    }

    const { companyId, locationId } = request.data;

    if (!companyId || !locationId) {
      throw new functions.https.HttpsError("invalid-argument", "companyId og locationId mangler.");
    }

    // Hent onboarding
    const onboardingRef = db
      .collection("companies")
      .doc(companyId)
      .collection("locations")
      .doc(locationId)
      .collection("onboarding")
      .doc("latest");

    const onboardingSnap = await onboardingRef.get();

    if (!onboardingSnap.exists) {
      throw new functions.https.HttpsError("failed-precondition", "Ingen onboarding fundet.");
    }

    const onboardingData = onboardingSnap.data() || {};
    
    // Byg struktureret HACCP-data med korrigerende handlinger
    const controlPoints = buildStructuredHaccpData(onboardingData);

    // Opret risikoanalyse med struktureret HACCP-data
    await db
      .collection("companies")
      .doc(companyId)
      .collection("locations")
      .doc(locationId)
      .collection("risk_analysis")
      .doc("current")
      .set({
        status: "generated",
        onboardingSnapshot: onboardingData,
        controlPoints: controlPoints,
        totalControlPoints: controlPoints.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    // Opret egenkontrolprogram med samme strukturerede data
    await db
      .collection("companies")
      .doc(companyId)
      .collection("locations")
      .doc(locationId)
      .collection("egenkontrol_program")
      .doc("current")
      .set({
        status: "generated",
        controlPoints: controlPoints,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    // Sæt status
    await db
      .collection("companies")
      .doc(companyId)
      .collection("locations")
      .doc(locationId)
      .collection("system")
      .doc("provisioning")
      .set({
        riskDone: true,
        controlPointsGenerated: controlPoints.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    return { ok: true, controlPointsGenerated: controlPoints.length };
  }
);

exports.generateDailyRoutinesProvision = functions.https.onCall(
  { region: "europe-west1" },
  async (request) => {

    const auth = request.auth;
    if (!auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Du skal være logget ind.");
    }

    const { companyId, locationId } = request.data;

    if (!companyId || !locationId) {
      throw new functions.https.HttpsError("invalid-argument", "companyId og locationId mangler.");
    }

    // Check at risikoanalyse findes
    const riskSnap = await db
      .collection("companies")
      .doc(companyId)
      .collection("locations")
      .doc(locationId)
      .collection("risk_analysis")
      .doc("current")
      .get();

    if (!riskSnap.exists) {
      throw new functions.https.HttpsError("failed-precondition", "Risikoanalyse mangler.");
    }

    const riskData = riskSnap.data() || {};
    const onboardingData = riskData.onboardingSnapshot || {};

    // Byg dynamiske rutiner fra onboarding
    const templates = buildOperationalTemplatesFromOnboarding(onboardingData);
    const dateKey = new Date().toISOString().slice(0,10);

    // Opret task_templates og task_instances
    for (const template of templates) {
      await db
        .collection("companies")
        .doc(companyId)
        .collection("locations")
        .doc(locationId)
        .collection("task_templates")
        .doc(template.id)
        .set({
          title: template.title,
          category: template.category,
          formType: template.formType,
          frequency: template.frequency || null,
          type: "operational",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      if (template.frequency === "monthly") {
        continue;
      }

      await db
        .collection("companies")
        .doc(companyId)
        .collection("locations")
        .doc(locationId)
        .collection("task_instances")
        .doc(template.id + "__" + dateKey)
        .set({
          title: template.title,
          category: template.category,
          status: "pending",
          dateKey,
          type: "operational",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    await db
      .collection("companies")
      .doc(companyId)
      .collection("locations")
      .doc(locationId)
      .collection("system")
      .doc("provisioning")
      .set({
        routinesDone: true,
        templatesGenerated: templates.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    return { ok: true, templatesGenerated: templates.length };
  }
);

// Eksporter helper-funktioner
module.exports.buildStructuredHaccpData = buildStructuredHaccpData;