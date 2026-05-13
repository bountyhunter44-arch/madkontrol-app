/**
 * Comprehensive HACCP Risk Analysis Generator
 * Generates complete risk analysis with all 7 KCPs per Danish Food Authority guidelines
 */

function sanitizeString(value, maxLen = 200) {
  return String(value || "").trim().slice(0, maxLen);
}

/**
 * Generate comprehensive HACCP analysis based on company profile
 */
function generateComprehensiveHaccp({ profile = {}, companyType = "" }) {
  const type = sanitizeString(companyType || profile.companyType || "", 80).toLowerCase();
  const companyName = sanitizeString(profile.companyName || "Virksomhed", 140);
  
  // Base KCPs that apply to all food businesses
  const baseKcps = generateBaseKcps({ profile, companyType: type, companyName });
  
  // Industry-specific additions
  const industryKcps = generateIndustrySpecificKcps({ profile, companyType: type });
  
  // Allergen control (mandatory for all)
  const allergenKcp = generateAllergenKcp({ profile, companyType: type });
  
  // Cleaning control (mandatory for all)
  const cleaningKcp = generateCleaningKcp({ profile, companyType: type });
  
  return {
    kcps: [
      ...baseKcps,
      allergenKcp,
      cleaningKcp,
      ...industryKcps
    ],
    summary: {
      totalKcps: baseKcps.length + industryKcps.length + 2,
      companyType: type,
      generatedAt: new Date().toISOString(),
      version: "2.0_comprehensive"
    }
  };
}

/**
 * KCP 1-5: Base critical control points for all food businesses
 */
function generateBaseKcps({ profile, companyType, companyName }) {
  const kcps = [];
  
  // Build dynamic descriptions based on user answers
  const receivingItems = [];
  if (profile.receivesChilledGoods && profile.receivesChilledGoodsDetails) {
    receivingItems.push(`Kølevarer: ${profile.receivesChilledGoodsDetails}`);
  }
  if (profile.receivesFrozenGoods && profile.receivesFrozenGoodsDetails) {
    receivingItems.push(`Frostvarer: ${profile.receivesFrozenGoodsDetails}`);
  }
  if (profile.receivesRoomTempGoods && profile.receivesRoomTempGoodsDetails) {
    receivingItems.push(`Stuetemperatur-varer: ${profile.receivesRoomTempGoodsDetails}`);
  }
  const receivingDescription = receivingItems.length > 0 
    ? `Vi modtager følgende varer: ${receivingItems.join('. ')}.`
    : "Vi modtager forskellige fødevarer.";
  
  // KCP 1: MODTAGELSE (Receiving)
  kcps.push({
    id: "kcp_1_modtagelse",
    kcpNumber: 1,
    title: "Modtagelse af varer",
    category: "modtagelse",
    userContext: receivingDescription,
    hazard: {
      biological: "Bakterievækst fra varer modtaget ved forkert temperatur (Salmonella, Listeria, Campylobacter)",
      chemical: "Forurening fra beskadiget emballage eller ukorrekt mærkning",
      physical: "Fremmedlegemer fra beskadiget emballage"
    },
    criticalLimit: {
      temperature: "Kølevarer: Max +5°C, Frostvarer: Max -12°C (ideelt -18°C)",
      packaging: "Emballage skal være intakt uden skader, hul eller fugt",
      labeling: "Datomærkning skal være synlig og inden for holdbarhed",
      organoleptic: "Lugt, farve og konsistens skal være normal"
    },
    monitoring: {
      what: "Temperatur, emballage-integritet, datomærkning og sensorisk vurdering",
      how: "Visuel inspektion og temperaturmåling med kalibreret termometer",
      frequency: "Ved hver varemodtagelse",
      responsible: "Modtagende medarbejder eller køkkenchef"
    },
    correctiveAction: {
      immediate: "Afvis varer der ikke overholder krav. Returner til leverandør.",
      documentation: "Dokumentér afvisning med leverandør, dato, årsag og temperatur",
      followUp: "Kontakt leverandør og vurder om leverandøraftale skal ændres ved gentagne problemer"
    },
    verification: {
      method: "Månedlig gennemgang af modtagelseslog og afvisninger",
      responsible: "Køkkenchef eller ansvarlig leder",
      documentation: "Log over modtagelser, afvisninger og leverandør-kommunikation"
    },
    riskLevel: profile.receivesFrozenGoodsCritical ? "high" : "medium",
    regulatoryReference: "Hygiejneforordningen (EF) Nr. 852/2004, Bilag II, Kapitel IX"
  });
  
  // Build storage description
  const storageItems = [];
  if (profile.storesChilledGoods && profile.storesChilledGoodsDetails) {
    storageItems.push(`Køl (${profile.fridgeCount || 0} køleskabe): ${profile.storesChilledGoodsDetails}`);
  }
  if (profile.storesFrozenGoods && profile.storesFrozenGoodsDetails) {
    storageItems.push(`Frost (${profile.freezerCount || 0} frysere): ${profile.storesFrozenGoodsDetails}`);
  }
  if (profile.storesRoomTempGoods && profile.storesRoomTempGoodsDetails) {
    storageItems.push(`Stuetemperatur: ${profile.storesRoomTempGoodsDetails}`);
  }
  const storageDescription = storageItems.length > 0
    ? `Vi opbevarer følgende: ${storageItems.join('. ')}.`
    : "Vi opbevarer forskellige fødevarer.";
  
  // KCP 2: LAGER/OPBEVARING (Storage)
  kcps.push({
    id: "kcp_2_opbevaring",
    kcpNumber: 2,
    title: "Lager og opbevaring",
    category: "opbevaring",
    userContext: storageDescription,
    hazard: {
      biological: "Krydskontaminering mellem råt kød/fjerkræ og tilberedte/spiseklare fødevarer. Bakterievækst ved temperaturer >5°C (Listeria, Salmonella, E. coli)",
      chemical: "Forurening fra rengøringsmidler opbevaret forkert",
      physical: "Fremmedlegemer fra beskadiget emballage eller opbevaring"
    },
    criticalLimit: {
      temperature: "Køleskab: 0-5°C, Fryser: -18°C eller koldere",
      separation: "Råt kød/fjerkræ ALTID under tilberedte/spiseklare varer. Minimum 10 cm afstand.",
      fifo: "First-In-First-Out princip. Ældste varer først.",
      coverage: "Alle varer skal være tildækket eller i lukket emballage",
      chemicals: "Rengøringsmidler og kemikalier opbevares ADSKILT fra fødevarer"
    },
    monitoring: {
      what: "Temperatur i køl/frost, adskillelse af råt/tilberedt, FIFO-princip, tildækning",
      how: "Daglig temperaturmåling og visuel inspektion af opbevaring",
      frequency: "Temperatur: Dagligt. Adskillelse: Ved hver opfyldning og daglig kontrol.",
      responsible: "Alle medarbejdere (opfyldning), køkkenchef (daglig kontrol)"
    },
    correctiveAction: {
      immediate: "Ved temperatur >5°C: Undersøg årsag (defekt køl, dør åben). Flyt varer til fungerende køl. Ved >8°C i >2 timer: Vurder kassation.",
      crossContamination: "Ved krydskontaminering: Fjern berørte varer, rengør område grundigt, genopret korrekt adskillelse.",
      documentation: "Dokumentér afvigelse, årsag, handling og opfølgning"
    },
    verification: {
      method: "Ugentlig inspektion af køl/frost-indretning og temperaturlog",
      responsible: "Køkkenchef",
      documentation: "Temperaturlog, inspektionsrapport, afvigelses-log"
    },
    riskLevel: (profile.storesChilledGoodsCritical || profile.storesFrozenGoodsCritical) ? "high" : "medium",
    regulatoryReference: "Hygiejneforordningen (EF) Nr. 852/2004, Bilag II, Kapitel IX"
  });
  
  // Build preparation description
  const preparationItems = [];
  if (profile.preparesHotFood && profile.preparesHotFoodDetails) {
    preparationItems.push(`Varm mad: ${profile.preparesHotFoodDetails}`);
  }
  if (profile.preparesColdFood && profile.preparesColdFoodDetails) {
    preparationItems.push(`Kold mad: ${profile.preparesColdFoodDetails}`);
  }
  const preparationDescription = preparationItems.length > 0
    ? `Vi tilbereder følgende: ${preparationItems.join('. ')}.`
    : "Vi tilbereder forskellige retter.";
  
  // KCP 3: TILBEREDNING (Preparation/Cooking)
  kcps.push({
    id: "kcp_3_tilberedning",
    kcpNumber: 3,
    title: "Tilberedning og opvarmning",
    category: "tilberedning",
    userContext: preparationDescription,
    hazard: {
      biological: "Overlevelse af patogene bakterier (Salmonella, Campylobacter, Listeria, E. coli) ved utilstrækkelig opvarmning. Særlig risiko ved kød, fjerkræ og hakket kød.",
      parasites: "Overlevelse af parasitter i kød og fisk ved for lav kernetemperatur",
      chemical: profile.preparesHotFood ? "Acrylamid-dannelse ved >175°C (pommes frites, chips). PAH ved for mørk stegning." : undefined,
      biological2: profile.preparesColdFood ? "Viruskontaminering fra sygt personale. Histamin i tun efter >2 dage." : undefined
    },
    criticalLimit: {
      coreTemperature: "Minimum 75°C i kernen i minimum 2 minutter",
      poultry: "Fjerkræ: Minimum 75°C (anbefalet 80°C)",
      groundMeat: "Hakket kød: Minimum 75°C",
      reheating: "Genopvarmning: Minimum 75°C i kernen",
      measurement: "Mål med kalibreret kernetermometer i tykkeste del",
      acrylamid: profile.preparesHotFood ? "Pommes frites: Max 175°C for at undgå acrylamid" : undefined,
      coldFood: profile.preparesColdFood ? "Kold mad: Max 2 timer ved stuetemperatur. Tun max 2 dage efter åbning." : undefined
    },
    monitoring: {
      what: "Kernetemperatur i tilberedte retter, især kød, fjerkræ og hakket kød",
      how: "Måling med kalibreret kernetermometer i tykkeste del af produktet",
      frequency: "Ved hver tilberedning af risikoprodukter (kød, fjerkræ, fisk, hakket kød)",
      responsible: "Kok/tilberedende medarbejder"
    },
    correctiveAction: {
      immediate: "Ved kernetemperatur <75°C: Fortsæt tilberedning til 75°C er nået. Mål igen.",
      repeated: "Ved gentagne problemer: Kalibrer termometer, tjek ovn/udstyr, instruér medarbejdere.",
      documentation: "Dokumentér alle målinger, især afvigelser og korrigerende handlinger"
    },
    verification: {
      method: "Ugentlig gennemgang af temperaturlog. Månedlig kalibrering af termometre.",
      responsible: "Køkkenchef",
      documentation: "Temperaturlog for tilberedning, kalibreringslog for termometre"
    },
    riskLevel: "critical",
    regulatoryReference: "Hygiejneforordningen (EF) Nr. 852/2004, Bilag II, Kapitel IX. Fødevarestyrelsens vejledning om varmebehandling"
  });
  
  // Build cooling description
  const coolingDescription = profile.coolsHotFood && profile.coolsHotFoodDetails
    ? `Vi nedkøler følgende: ${profile.coolsHotFoodDetails}.`
    : "Vi nedkøler tilberedte retter til senere brug.";
  
  // KCP 4: NEDKØLING (Cooling) - only if user cools food
  if (profile.coolsHotFood) {
    kcps.push({
      id: "kcp_4_nedkoeling",
      kcpNumber: 4,
      title: "Nedkøling af tilberedte retter",
      category: "nedkoeling",
      userContext: coolingDescription,
      hazard: {
        biological: "Bakterievækst (især Bacillus cereus, Clostridium perfringens, Staphylococcus aureus) i temperaturzonen 8-60°C. Sporedannende bakterier kan overleve kogning og vokse hurtigt ved langsom nedkøling.",
        toxins: "Toksinproduktion fra Staphylococcus aureus og Bacillus cereus ved langsom nedkøling"
      },
    criticalLimit: {
      coolingTime: "Fra 60°C til 10°C på maksimum 4 timer (3-timers reglen anbefales)",
      method: "Brug blast chiller, små portioner, lav dybde (<5 cm), eller isbad",
      storage: "Efter nedkøling: Opbevar ved 0-5°C",
      coverage: "Tildæk først når produktet er under 10°C (undgå kondens)"
    },
    monitoring: {
      what: "Tid og temperatur under nedkøling. Start-temperatur, slut-temperatur og varighed.",
      how: "Mål temperatur ved start (60°C) og efter max 4 timer (skal være <10°C). Notér tidspunkt.",
      frequency: "Ved hver nedkøling af tilberedte retter til senere brug",
      responsible: "Kok/tilberedende medarbejder"
    },
    correctiveAction: {
      immediate: "Ved nedkøling >4 timer eller slut-temperatur >10°C: Vurder kassation. Ved 4-6 timer OG <10°C: Brug samme dag. Ved >6 timer: Kassér.",
      prevention: "Brug mindre portioner, lavere dybde, blast chiller eller isbad",
      documentation: "Dokumentér nedkølingstid, temperaturer og eventuel kassation"
    },
    verification: {
      method: "Ugentlig gennemgang af nedkølingslog. Månedlig test af blast chiller.",
      responsible: "Køkkenchef",
      documentation: "Nedkølingslog med tid og temperaturer"
    },
      riskLevel: profile.coolsHotFoodCritical ? "critical" : "high",
      regulatoryReference: "Fødevarestyrelsens vejledning om nedkøling og opbevaring af tilberedte fødevarer"
    });
  }
  
  // Build hot holding description
  const hotHoldingDescription = profile.holdsHotFood && profile.holdsHotFoodDetails
    ? `Vi holder følgende varmt: ${profile.holdsHotFoodDetails}.`
    : "Vi holder tilberedte retter varme til servering.";
  
  // KCP 5: VARMHOLDELSE (Hot holding) - only if user holds food hot
  if (profile.holdsHotFood) {
    kcps.push({
      id: "kcp_5_varmholdelse",
      kcpNumber: 5,
      title: "Varmholdelse af tilberedte retter",
      category: "varmholdelse",
      userContext: hotHoldingDescription,
      hazard: {
        biological: "Bakterievækst ved temperaturer <60°C. Især Bacillus cereus, Clostridium perfringens og Staphylococcus aureus kan vokse hurtigt i temperaturzonen 8-60°C.",
        toxins: "Toksinproduktion ved utilstrækkelig varmholdelse"
      },
    criticalLimit: {
      temperature: "Minimum 60°C i produktet (anbefalet 65°C for sikkerhedsmargin)",
      duration: "Maksimum 3 timer ved varmholdelse. Herefter skal retten kasseres eller nedkøles korrekt.",
      equipment: "Varmholdelsesudstyr skal kunne opretholde minimum 60°C"
    },
    monitoring: {
      what: "Temperatur i varmholdte retter og varighed af varmholdelse",
      how: "Mål temperatur i produktet (ikke kun i beholderen) med termometer. Notér tidspunkt for start af varmholdelse.",
      frequency: "Minimum hver 2. time under varmholdelse",
      responsible: "Kok/serveringspersonale"
    },
    correctiveAction: {
      immediate: "Ved temperatur <60°C: Varm op til >75°C igen eller kassér hvis >2 timer ved <60°C.",
      duration: "Ved varmholdelse >3 timer: Kassér retten.",
      equipment: "Ved gentagne problemer: Tjek varmholdelsesudstyr, kalibrer termometer",
      documentation: "Dokumentér temperatur, varighed og eventuel kassation"
    },
    verification: {
      method: "Ugentlig gennemgang af varmholdelseslog. Månedlig test af varmholdelsesudstyr.",
      responsible: "Køkkenchef",
      documentation: "Varmholdelseslog med temperaturer og varighed"
    },
      riskLevel: profile.holdsHotFoodCritical ? "critical" : "high",
      regulatoryReference: "Hygiejneforordningen (EF) Nr. 852/2004. Fødevarestyrelsens vejledning om varmholdelse"
    });
  }
  
  return kcps;
}

/**
 * KCP 6: ALLERGENER (Allergens) - Mandatory for all
 */
function generateAllergenKcp({ profile, companyType }) {
  // Build allergen description
  const allergenItems = [];
  if (profile.handlesAllergens && profile.handlesAllergensDetails) {
    allergenItems.push(`Allergener vi håndterer: ${profile.handlesAllergensDetails}`);
  }
  if (profile.handlesDifferentFoods && profile.handlesDifferentFoodsDetails) {
    allergenItems.push(`Fødevarer vi håndterer: ${profile.handlesDifferentFoodsDetails}`);
  }
  const allergenDescription = allergenItems.length > 0
    ? allergenItems.join('. ') + '.'
    : "Vi håndterer forskellige allergener og fødevarer.";
  
  return {
    id: "kcp_6_allergener",
    kcpNumber: 6,
    title: "Allergenkontrol og mærkning",
    category: "allergener",
    userContext: allergenDescription,
    hazard: {
      biological: "Allergiske reaktioner hos gæster (anafylaksi, astma, eksem, mave-tarm problemer)",
      crossContamination: "Krydskontaminering mellem allergenholdige og allergenfrie retter"
    },
    allergens: [
      "Gluten (hvede, rug, byg, havre, spelt, kamut)",
      "Krebsdyr (rejer, hummer, krabbe)",
      "Æg",
      "Fisk",
      "Jordnødder",
      "Soja",
      "Mælk og laktose",
      "Nødder (mandler, hasselnødder, valnødder, cashewnødder, pekannødder, paranødder, pistacienødder, macadamianødder)",
      "Selleri",
      "Sennep",
      "Sesamfrø",
      "Svovldioxid og sulfitter (>10 mg/kg)",
      "Lupin",
      "Bløddyr (muslinger, østers, snegle)"
    ],
    criticalLimit: {
      declaration: "Alle 14 allergener skal være deklareret på menukort, buffet-skilte eller ved mundtlig information",
      separation: "Allergenfrie retter tilberedes ADSKILT fra allergenholdige retter",
      cleaning: "Redskaber, skærebrætter og arbejdsflader skal rengøres mellem tilberedning af allergenholdige og allergenfrie retter",
      storage: "Allergenholdige råvarer opbevares adskilt og tydeligt mærket"
    },
    monitoring: {
      what: "Allergenmærkning på menukort, adskillelse ved tilberedning, rengøring af redskaber",
      how: "Visuel kontrol af mærkning. Tjekliste for tilberedning af allergenfrie retter. Observation af arbejdsgange.",
      frequency: "Dagligt: Tjek af mærkning. Ved hver tilberedning af allergenfri ret: Tjekliste.",
      responsible: "Køkkenchef (mærkning), alle kokke (tilberedning)"
    },
    correctiveAction: {
      immediate: "Ved manglende mærkning: Opdater straks menukort/skilte. Ved krydskontaminering: Kassér berørt ret, rengør grundigt, tilbered ny ret.",
      training: "Instruér medarbejdere i allergenhåndtering minimum 1 gang årligt",
      documentation: "Dokumentér allergenindhold i alle retter. Log over allergenfrie bestillinger og håndtering."
    },
    verification: {
      method: "Månedlig gennemgang af menukort og allergenliste. Kvartalsvise stikprøver af tilberedning.",
      responsible: "Køkkenchef eller ansvarlig leder",
      documentation: "Allergenliste for alle retter, instruktioner for allergenfri tilberedning, log over allergenfrie bestillinger"
    },
    riskLevel: "critical",
    regulatoryReference: "Fødevareinformationsforordningen (EU) Nr. 1169/2011, Artikel 9 og 21. Fødevarestyrelsens vejledning om allergenmærkning"
  };
}

/**
 * KCP 7: RENGØRING (Cleaning) - Mandatory for all, focus on Listeria
 */
function generateCleaningKcp({ profile, companyType }) {
  return {
    id: "kcp_7_rengoering",
    kcpNumber: 7,
    title: "Rengøring og hygiejne",
    category: "rengoering",
    hazard: {
      biological: "Listeria monocytogenes i afløb, kølemaskiner og fugtige områder. Salmonella, E. coli og Campylobacter fra utilstrækkelig rengøring af kontaktflader.",
      biofilm: "Biofilm-dannelse i afløb, på pakninger og i maskiner giver beskyttelse til bakterier",
      crossContamination: "Krydskontaminering fra snavsede kontaktflader, redskaber og hænder"
    },
    criticalLimit: {
      drains: "Gulvafløb: Ingen madrester i riste eller afløbskopper. Vandlås skal indeholde vand. Daglig rengøring.",
      contactSurfaces: "Alle kontaktflader (skærebrætter, knive, arbejdsborde): Rengøres efter hver brug og mellem forskellige råvarer.",
      equipment: "Maskiner (skæremaskiner, blendere, foodprocessors): Adskilles og rengøres dagligt. Pakninger og svært tilgængelige dele rengøres grundigt.",
      refrigeration: "Køleskabe: Rengøres minimum ugentligt. Ekstra fokus på pakninger, afløb og fugtige områder (Listeria-risiko).",
      handwashing: "Hænder vaskes: Efter toiletbesøg, før arbejde med mad, efter håndtering af råt kød/fjerkræ, efter affald."
    },
    monitoring: {
      what: "Visuel inspektion af rengøring. Fokus på afløb, maskiner, køl og kontaktflader.",
      how: "Daglig tjekliste for rengøring. Ugentlig dybderengøring af køl og maskiner. Måned lig inspektion af afløb.",
      frequency: "Dagligt: Kontaktflader, afløb, maskiner. Ugentligt: Køl, dybderengøring. Månedligt: Inspektion af afløb og pakninger.",
      responsible: "Alle medarbejdere (daglig rengøring), køkkenchef (inspektion)"
    },
    correctiveAction: {
      immediate: "Ved fund af madrester i afløb: Tøm og rengør straks. Ved biofilm i maskiner: Adskil, rengør grundigt med alkalisk rengøringsmiddel, desinficer.",
      listeria: "Ved mistanke om Listeria (fugtige områder, biofilm): Intensiv rengøring og desinfektion. Overvej podning/test.",
      training: "Instruér medarbejdere i korrekt rengøringsteknik minimum 2 gange årligt",
      documentation: "Dokumentér daglig rengøring, ugentlig dybderengøring og eventuelle afvigelser"
    },
    verification: {
      method: "Ugentlig inspektion af rengøringsstandard. Månedlig dybdeinspekt ion af kritiske områder (afløb, køl, maskiner).",
      testing: "Overvej kvartalsvise podninger af kritiske områder (afløb, køl) for Listeria",
      responsible: "Køkkenchef eller ansvarlig leder",
      documentation: "Rengøringsprogram, tjeklister, inspektionsrapporter, eventuelle podningsresultater"
    },
    riskLevel: "critical",
    regulatoryReference: "Hygiejneforordningen (EF) Nr. 852/2004, Bilag II, Kapitel I og II. Fødevarestyrelsens vejledning om Listeria monocytogenes"
  };
}

/**
 * Industry-specific KCPs
 */
function generateIndustrySpecificKcps({ profile, companyType }) {
  const kcps = [];
  
  // ICE CREAM SHOP / ISKIOSK
  if (companyType.includes("is") || companyType.includes("ice") || companyType.includes("kiosk")) {
    kcps.push({
      id: "kcp_industry_ice_pasteurization",
      kcpNumber: 8,
      title: "Pasteurisering og ismaskine-hygiejne (Iskiosk)",
      category: "industry_specific",
      industryType: "ice_cream",
      hazard: {
        biological: "Salmonella, Listeria og E. coli i upasteuriseret ismix. Bakterievækst i ismaskiner ved utilstrækkelig rengøring.",
        biofilm: "Biofilm i ismaskiner giver beskyttelse til Listeria og andre bakterier"
      },
      criticalLimit: {
        pasteurization: "Ismix skal være pasteuriseret (minimum 72°C i 15 sekunder eller tilsvarende). Brug kun pasteuriseret mælk og fløde.",
        machineTemp: "Ismaskiner skal holde produktet ved -5°C til -10°C under servering",
        cleaning: "Ismaskiner skal adskilles og rengøres DAGLIGT. Alle produktberørte dele skal vaskes, skylles og desinficeres.",
        sanitization: "Efter rengøring: Desinfektion med godkendt middel. Skyl grundigt før næste brug."
      },
      monitoring: {
        what: "Pasteuriseringstemperatur (hvis egen produktion), ismaskine-temperatur, daglig rengøring",
        how: "Tjek leverandør-dokumentation for pasteurisering. Mål temperatur i ismaskine. Visuel inspektion af rengøring.",
        frequency: "Dagligt: Rengøring og temperatur. Ved modtagelse: Pasteuriseringsdokumentation.",
        responsible: "Ismester/ansvarlig medarbejder"
      },
      correctiveAction: {
        immediate: "Ved upasteuriseret mix: Afvis vare. Ved ismaskine >-5°C: Undersøg årsag, juster eller kassér produkt. Ved utilstrækkelig rengøring: Rengør grundigt igen.",
        documentation: "Dokumentér pasteurisering, temperatur og daglig rengøring"
      },
      verification: {
        method: "Ugentlig gennemgang af rengøringslog. Månedlig inspektion af ismaskiner.",
        testing: "Overvej kvartalsvise podninger af ismaskiner for Listeria",
        responsible: "Ansvarlig leder",
        documentation: "Pasteuriseringsdokumentation, temperaturlog, rengøringslog"
      },
      riskLevel: "critical",
      regulatoryReference: "Hygiejneforordningen (EF) Nr. 852/2004. Fødevarestyrelsens vejledning om is og mælkeprodukter"
    });
  }
  
  // PIZZERIA
  if (companyType.includes("pizza") || companyType.includes("italiensk")) {
    kcps.push({
      id: "kcp_industry_pizza_flour",
      kcpNumber: 8,
      title: "Melstøv-kontrol og topping ved stuetemperatur (Pizzeria)",
      category: "industry_specific",
      industryType: "pizzeria",
      hazard: {
        biological: "Bakterievækst i topping (ost, kød, grøntsager) ved stuetemperatur >2 timer. Salmonella i mel ved utilstrækkelig varmebehandling.",
        respiratory: "Melstøv kan give luftvejsproblemer og allergier hos medarbejdere",
        crossContamination: "Krydskontaminering fra rå topping til færdige pizzaer"
      },
      criticalLimit: {
        toppingTemp: "Topping (ost, kød, grøntsager) må maksimum være ved stuetemperatur i 2 timer. Herefter tilbage i køl eller kassation.",
        flourHandling: "Mel opbevares tørt og køligt. Brug støvmaske ved håndtering af store mængder mel.",
        baking: "Pizza skal bages til kernetemperatur minimum 75°C (typisk 300-400°C i ovn i 90 sekunder)",
        separation: "Rå topping (kød, fjerkræ) håndteres adskilt fra færdige pizzaer"
      },
      monitoring: {
        what: "Tid for topping ved stuetemperatur, bagetid og temperatur, adskillelse af rå/tilberedt",
        how: "Notér tidspunkt når topping tages ud af køl. Mål kernetemperatur i færdig pizza (stikprøver). Observér arbejdsgange.",
        frequency: "Dagligt: Tid for topping. Ugentligt: Stikprøver af kernetemperatur.",
        responsible: "Pizzabager/køkkenchef"
      },
      correctiveAction: {
        immediate: "Ved topping >2 timer ved stuetemperatur: Kassér eller brug straks. Ved kernetemperatur <75°C: Bag længere.",
        prevention: "Tag kun topping ud i små portioner. Opbevar resten i køl. Brug timer.",
        documentation: "Dokumentér tid for topping, kernetemperaturer og eventuel kassation"
      },
      verification: {
        method: "Ugentlig gennemgang af rutiner for topping-håndtering. Månedlig temperaturmåling af pizzaer.",
        responsible: "Køkkenchef",
        documentation: "Log over topping-tid, temperaturmålinger"
      },
      riskLevel: "high",
      regulatoryReference: "Hygiejneforordningen (EF) Nr. 852/2004. Fødevarestyrelsens vejledning om temperaturkontrol"
    });
  }
  
  // BAGEL SHOP / SANDWICH BAR
  if (companyType.includes("bagel") || companyType.includes("sandwich") || companyType.includes("deli")) {
    kcps.push({
      id: "kcp_industry_bagel_cross_contamination",
      kcpNumber: 8,
      title: "Krydskontaminering ved disken (Bagel/Sandwich)",
      category: "industry_specific",
      industryType: "bagel_deli",
      hazard: {
        biological: "Krydskontaminering mellem rå grøntsager, kød, ost og færdige sandwiches. Listeria fra pålæg. Salmonella fra rå grøntsager.",
        allergens: "Krydskontaminering af allergener (gluten, nødder, sesamfrø) ved disken",
        hands: "Bakterieoverførsel fra hænder ved direkte håndtering af fødevarer"
      },
      criticalLimit: {
        handwashing: "Hænder vaskes mellem hver kunde og efter håndtering af rå ingredienser",
        gloves: "Brug engangshandsker ved direkte håndtering af spiseklare fødevarer. Skift handsker mellem opgaver.",
        utensils: "Brug separate redskaber (knive, tænger) for hver ingrediens. Rengør mellem brug.",
        surfaces: "Skærebrætter og arbejdsflader rengøres mellem forskellige ingredienser og mellem rå/tilberedt",
        display: "Pålæg og ingredienser i disk opbevares ved max 5°C. Udskift display-ingredienser hver 4. time."
      },
      monitoring: {
        what: "Håndvask, handskebrug, rengøring af redskaber, temperatur i disk",
        how: "Observation af arbejdsgange. Temperaturmåling i disk. Tjekliste for rengøring.",
        frequency: "Løbende: Observation. Dagligt: Temperatur i disk. Efter hver vagt: Rengøring.",
        responsible: "Alle medarbejdere (håndvask/handsker), køkkenchef (inspektion)"
      },
      correctiveAction: {
        immediate: "Ved manglende håndvask/handskebrug: Kassér berørt mad, vask hænder, skift handsker. Ved temperatur >5°C i disk: Undersøg årsag, kassér varer der har været >8°C i >2 timer.",
        training: "Instruér medarbejdere i korrekt håndtering minimum 2 gange årligt",
        documentation: "Dokumentér temperatur i disk, rengøringsrutiner og eventuelle afvigelser"
      },
      verification: {
        method: "Daglig observation af arbejdsgange. Ugentlig gennemgang af temperaturlog. Månedlig inspektion af disk-hygiejne.",
        responsible: "Køkkenchef eller ansvarlig leder",
        documentation: "Temperaturlog for disk, rengøringstjekliste, observationslog"
      },
      riskLevel: "high",
      regulatoryReference: "Hygiejneforordningen (EF) Nr. 852/2004, Bilag II, Kapitel V og VIII. Fødevarestyrelsens vejledning om personlig hygiejne"
    });
  }
  
  return kcps;
}

/**
 * Generate task templates from KCPs
 */
function generateTaskTemplatesFromKcps(kcps, createdAt = new Date()) {
  const tasks = [];

  kcps.forEach(kcp => {
    // Generate monitoring task
    if (kcp.monitoring) {
      tasks.push({
        title: `${kcp.title} - Overvågning`,
        description: kcp.monitoring.what || kcp.title,
        category: kcp.category,
        frequency: parseFrequency(kcp.monitoring.frequency),
        riskLevel: kcp.riskLevel,
        controlPoint: kcp.title,
        formType: determineFormType(kcp),
        kcpNumber: kcp.kcpNumber,
        kcpId: kcp.id,
        createdAt: createdAt.toISOString(),
        dueAt: calculateDueAt(createdAt, kcp.monitoring.frequency)
      });
    }
    
    // Generate verification task
    if (kcp.verification) {
      tasks.push({
        title: `${kcp.title} - Verifikation`,
        description: kcp.verification.method || `Verifikation af ${kcp.title}`,
        category: `${kcp.category}_verification`,
        frequency: "monthly",
        riskLevel: kcp.riskLevel === "critical" ? "high" : "medium",
        controlPoint: kcp.title,
        formType: "checklist",
        kcpNumber: kcp.kcpNumber,
        kcpId: kcp.id,
        isVerification: true,
        createdAt: createdAt.toISOString(),
        dueAt: calculateDueAt(createdAt, "monthly")
      });
    }
  });
  
  return tasks;
}

function calculateDueAt(createdAt, frequency) {
  const dueDate = new Date(createdAt);
  const now = new Date();
  
  if (frequency === "daily") {
    dueDate.setDate(dueDate.getDate() + 1);
  } else if (frequency === "weekly") {
    dueDate.setDate(dueDate.getDate() + 7);
  } else if (frequency === "monthly") {
    dueDate.setDate(dueDate.getDate() + 30);
  }
  
  // Set to end of day
  dueDate.setHours(23, 59, 59, 999);
  return dueDate.toISOString();
}

function parseFrequency(frequencyText = "") {
  const text = frequencyText.toLowerCase();
  if (text.includes("daglig") || text.includes("daily") || text.includes("hver")) return "daily";
  if (text.includes("ugentlig") || text.includes("weekly") || text.includes("uge")) return "weekly";
  if (text.includes("månedlig") || text.includes("monthly") || text.includes("måned")) return "monthly";
  return "daily";
}

function determineFormType(kcp) {
  const category = (kcp.category || "").toLowerCase();
  const title = (kcp.title || "").toLowerCase();
  
  if (category.includes("temperatur") || title.includes("temperatur") || category.includes("tilberedning") || category.includes("nedkoeling") || category.includes("varmholdelse")) {
    return "temperature";
  }
  if (category.includes("modtagelse")) {
    return "receiving";
  }
  if (category.includes("rengoering") || category.includes("cleaning")) {
    return "cleaning";
  }
  return "checklist";
}

module.exports = {
  generateComprehensiveHaccp,
  generateTaskTemplatesFromKcps
};
