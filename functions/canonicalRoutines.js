/**
 * CANONICAL ROUTINE MODEL
 * 
 * Source of truth for alle rutinetyper i Madkontrollen Pro.
 * Bruges af både backend og frontend til at sikre konsistens.
 * 
 * Hver rutine identificeres unikt ved:
 * - companyId
 * - locationId
 * - routineType
 * - unitId (eller "default" hvis ikke enhedsspecifik)
 * - dateKey (for instances)
 */

const CANONICAL_ROUTINE_TYPES = {
  varemodtagelse: {
    routineType: "varemodtagelse",
    title: "Varemodtagelse",
    group: "CCP",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Ved varemodtagelse kontrolleres temperatur, emballage, holdbarhed og mærkning. Kølevarer skal som udgangspunkt være højst 5 °C og frostvarer højst -18 °C. Ved fejl vurderes varen, returneres eller kasseres, og fejlen dokumenteres.",
    risk: {
      hazard: "Modtagelse af fødevarer med for høj temperatur, beskadiget emballage, overskredet holdbarhed eller fejl i mærkning.",
      criticalLimit: "Kølevarer højst 5 °C, frostvarer højst -18 °C, emballage hel, holdbarhed og mærkning i orden.",
      deviationTrigger: "Temperatur over grænse, beskadiget emballage, udløbet holdbarhed eller mangelfuld mærkning.",
      defaultCorrectiveAction: "Varen vurderes straks. Hvis fødevaresikkerheden ikke kan dokumenteres, returneres eller kasseres varen. Leverandøren kontaktes, og fejlen dokumenteres.",
      prefilledDeviationText: "Varemodtagelsen afveg fra kravene. Jeg har vurderet varen ud fra temperatur, emballage, holdbarhed og mærkning. Varen returneres eller kasseres, hvis den ikke kan anvendes sikkert. Leverandøren kontaktes ved behov."
    }
  },

  opvarmning: {
    routineType: "opvarmning",
    title: "Opvarmning",
    group: "CCP",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Ved opvarmning skal fødevaren som udgangspunkt opvarmes til mindst 75 °C i centrum eller tykkeste punkt. Hvis temperaturen ikke er opnået, fortsættes opvarmningen indtil kravet er opfyldt.",
    risk: {
      hazard: "Overlevelse af sygdomsfremkaldende bakterier ved utilstrækkelig opvarmning.",
      criticalLimit: "Minimum 75 °C i centrum eller tykkeste punkt, medmindre anden dokumenteret sikker tid/temperatur anvendes.",
      deviationTrigger: "Målt temperatur under 75 °C.",
      defaultCorrectiveAction: "Fortsæt opvarmningen indtil mindst 75 °C er opnået. Mål igen og dokumentér resultatet.",
      prefilledDeviationText: "Opvarmningen nåede ikke den krævede temperatur. Jeg fortsætter opvarmningen, indtil fødevaren er mindst 75 °C i centrum/tykkeste punkt. Temperaturen måles igen og dokumenteres."
    }
  },

  nedkoeling: {
    routineType: "nedkoeling",
    title: "Nedkøling",
    group: "CCP",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Ved nedkøling skal varmebehandlede fødevarer hurtigst muligt nedkøles. Temperaturen skal falde fra 65 °C til 10 °C på højst 4 timer. Hvis kravet ikke overholdes, skal fødevaren straks genopvarmes til 75 °C og nedkøles igen, eller kasseres.",
    risk: {
      hazard: "Vækst af bakterier og toksindannelse ved for langsom nedkøling.",
      criticalLimit: "Fra 65 °C til 10 °C på højst 4 timer.",
      deviationTrigger: "Nedkølingen når ikke 10 °C inden for 4 timer.",
      defaultCorrectiveAction: "Fødevaren genopvarmes straks til 75 °C og nedkøles igen, eller kasseres.",
      prefilledDeviationText: "Nedkølingen overholdt ikke kravet om 65 °C til 10 °C på højst 4 timer. Fødevaren genopvarmes straks til 75 °C og nedkøles igen, eller kasseres hvis sikkerheden ikke kan dokumenteres."
    }
  },

  varmholdelse: {
    routineType: "varmholdelse",
    title: "Varmholdelse",
    group: "CCP",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Ved varmholdelse skal fødevaren holdes ved mindst 65 °C. Hvis temperaturen kommer under 65 °C, skal fødevaren vurderes og som udgangspunkt kasseres, medmindre fødevaresikkerheden kan dokumenteres.",
    risk: {
      hazard: "Vækst af sygdomsfremkaldende bakterier ved for lav varmholdelsestemperatur.",
      criticalLimit: "Minimum 65 °C overalt i fødevaren.",
      deviationTrigger: "Temperatur under 65 °C.",
      defaultCorrectiveAction: "Fødevaren vurderes. Hvis sikkerheden ikke kan dokumenteres, kasseres fødevaren.",
      prefilledDeviationText: "Varmholdelsen var under 65 °C. Jeg vurderer fødevaren og kasserer den, hvis fødevaresikkerheden ikke kan dokumenteres. Fejlen dokumenteres."
    }
  },

  koeleskab_temperatur: {
    routineType: "koeleskab_temperatur",
    title: "Køleskab temperaturmåling",
    group: "CCP",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Køleskabets temperatur kontrolleres for at sikre, at kølekrævende fødevarer opbevares forsvarligt, normalt ved højst 5 °C. Ved for høj temperatur vurderes fødevarerne og fejl dokumenteres.",
    risk: {
      hazard: "Vækst af bakterier ved for høj køletemperatur.",
      criticalLimit: "Normalt højst 5 °C for kølekrævende fødevarer.",
      deviationTrigger: "Køleskabstemperatur over fastsat grænse.",
      defaultCorrectiveAction: "Temperaturen kontrolleres igen. Fødevarer vurderes og kasseres hvis sikkerheden ikke kan dokumenteres. Køleskabets funktion kontrolleres.",
      prefilledDeviationText: "Køleskabstemperaturen var over grænsen. Jeg kontrollerer temperaturen igen, vurderer fødevarerne og kasserer dem, hvis sikkerheden ikke kan dokumenteres. Køleskabets funktion kontrolleres."
    }
  },

  fryser_temperatur: {
    routineType: "fryser_temperatur",
    title: "Fryser temperaturmåling",
    group: "CCP",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Fryserens temperatur kontrolleres for at sikre, at frostvarer opbevares forsvarligt, normalt ved højst -18 °C. Ved for høj temperatur vurderes varerne og fejl dokumenteres.",
    risk: {
      hazard: "Optøning eller temperaturstigning, som kan påvirke fødevarernes kvalitet og sikkerhed.",
      criticalLimit: "Normalt -18 °C eller koldere for frostvarer.",
      deviationTrigger: "Frysertemperatur over fastsat grænse.",
      defaultCorrectiveAction: "Temperaturen kontrolleres igen. Varerne vurderes og flyttes, anvendes straks eller kasseres efter vurdering.",
      prefilledDeviationText: "Frysertemperaturen var over grænsen. Jeg kontrollerer temperaturen igen, vurderer varerne og flytter, anvender eller kasserer dem efter fødevaresikkerhedsmæssig vurdering."
    }
  },

  koeleskab_rengoering: {
    routineType: "koeleskab_rengoering",
    title: "Køleskab rengøring",
    group: "GAG",
    frequencyDays: 7,
    defaultUnitId: "default",
    longDescription: "Køleskabet rengøres efter fastlagt frekvens, så hylder, vægge, tætningslister og overflader holdes rene. Ved mangelfuld rengøring rengøres køleskabet før videre brug.",
    risk: {
      hazard: "Krydskontaminering fra snavsede overflader, hylder eller tætningslister.",
      criticalLimit: "Køleskabet skal fremstå rent og egnet til opbevaring af fødevarer.",
      deviationTrigger: "Synligt snavs, spild, mug, dårlig lugt eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Køleskabet tømmes efter behov, rengøres og desinficeres hvis relevant, før videre brug.",
      prefilledDeviationText: "Køleskabet var ikke tilstrækkeligt rent. Jeg rengør køleskabet, herunder hylder, overflader og tætningslister, før videre brug. Fødevarer vurderes ved behov."
    }
  },

  fryser_rengoering: {
    routineType: "fryser_rengoering",
    title: "Fryser rengøring",
    group: "GAG",
    frequencyDays: 30,
    defaultUnitId: "default",
    longDescription: "Fryseren rengøres og afrimes efter behov og fastlagt frekvens, så overflader, hylder og tætningslister holdes rene. Ved mangler udbedres rengøringen.",
    risk: {
      hazard: "Kontaminering fra snavs, isophobning eller beskadigede overflader.",
      criticalLimit: "Fryseren skal være ren, uden unødig isophobning og egnet til opbevaring.",
      deviationTrigger: "Snavs, spild, kraftig isophobning eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Fryseren rengøres og afrimes efter behov. Varer vurderes og flyttes midlertidigt hvis nødvendigt.",
      prefilledDeviationText: "Fryseren var ikke tilstrækkeligt ren eller havde behov for afrimning. Jeg rengør og afrimer efter behov og vurderer varerne, hvis opbevaringen har været påvirket."
    }
  },

  walkin_koeler_temperatur: {
    routineType: "walkin_koeler_temperatur",
    title: "Walk-in køler temperaturmåling",
    group: "CCP",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Walk-in kølerens temperatur kontrolleres for at sikre korrekt opbevaring af kølevarer, normalt højst 5 °C. Ved afvigelser vurderes fødevarerne og fejlen dokumenteres.",
    risk: {
      hazard: "Vækst af bakterier ved for høj temperatur i walk-in køler.",
      criticalLimit: "Normalt højst 5 °C.",
      deviationTrigger: "Temperatur over fastsat grænse.",
      defaultCorrectiveAction: "Temperaturen kontrolleres igen. Fødevarer vurderes, flyttes eller kasseres hvis sikkerheden ikke kan dokumenteres.",
      prefilledDeviationText: "Walk-in køleren var over temperaturgrænsen. Jeg kontrollerer temperaturen igen, vurderer fødevarerne og flytter eller kasserer dem, hvis sikkerheden ikke kan dokumenteres."
    }
  },

  walkin_fryser_temperatur: {
    routineType: "walkin_fryser_temperatur",
    title: "Walk-in fryser temperaturmåling",
    group: "CCP",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Walk-in fryserens temperatur kontrolleres for at sikre korrekt opbevaring af frostvarer, normalt højst -18 °C. Ved afvigelser vurderes varerne og fejlen dokumenteres.",
    risk: {
      hazard: "Temperaturstigning eller optøning af frostvarer.",
      criticalLimit: "Normalt -18 °C eller koldere.",
      deviationTrigger: "Temperatur over fastsat grænse.",
      defaultCorrectiveAction: "Temperaturen kontrolleres igen. Varer vurderes, flyttes, anvendes straks eller kasseres efter vurdering.",
      prefilledDeviationText: "Walk-in fryseren var over temperaturgrænsen. Jeg kontrollerer temperaturen igen, vurderer varerne og flytter, anvender eller kasserer dem efter fødevaresikkerhedsmæssig vurdering."
    }
  },

  walkin_koeler_rengoering: {
    routineType: "walkin_koeler_rengoering",
    title: "Walk-in køler rengøring",
    group: "GAG",
    frequencyDays: 7,
    defaultUnitId: "default",
    longDescription: "Walk-in køleren rengøres efter fastlagt frekvens, herunder gulv, hylder, vægge, døre og tætningslister. Ved mangler rengøres området før videre brug.",
    risk: {
      hazard: "Kontaminering fra snavsede gulve, hylder, vægge eller tætningslister.",
      criticalLimit: "Walk-in køleren skal være ren og egnet til opbevaring.",
      deviationTrigger: "Synligt snavs, spild, dårlig lugt eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Walk-in køleren rengøres, og fødevarer vurderes hvis de kan være påvirket.",
      prefilledDeviationText: "Walk-in køleren var ikke tilstrækkeligt ren. Jeg rengør gulv, hylder, vægge, døre og tætningslister og vurderer fødevarer ved behov."
    }
  },

  walkin_fryser_rengoering: {
    routineType: "walkin_fryser_rengoering",
    title: "Walk-in fryser rengøring",
    group: "GAG",
    frequencyDays: 30,
    defaultUnitId: "default",
    longDescription: "Walk-in fryseren rengøres og afrimes efter behov og fastlagt frekvens, herunder gulv, hylder, vægge, døre og tætningslister.",
    risk: {
      hazard: "Kontaminering eller driftsproblemer på grund af snavs eller isophobning.",
      criticalLimit: "Walk-in fryseren skal være ren, uden unødig isophobning og egnet til opbevaring.",
      deviationTrigger: "Snavs, spild, kraftig isophobning eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Walk-in fryseren rengøres og afrimes efter behov. Varer vurderes/flyttes hvis nødvendigt.",
      prefilledDeviationText: "Walk-in fryseren var ikke tilstrækkeligt ren eller havde behov for afrimning. Jeg rengør og afrimer efter behov og vurderer/flytter varer hvis nødvendigt."
    }
  },

  opvaskemaskine_skyllevand: {
    routineType: "opvaskemaskine_skyllevand",
    title: "Opvaskemaskine skyllevandstemperatur",
    group: "GAG",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Opvaskemaskinens skyllevand skal sikre tilstrækkelig desinfektion. Skyllevandstemperaturen skal kontrolleres efter virksomhedens fastsatte krav, typisk mindst 80 °C ved slutskyl.",
    risk: {
      hazard: "Utilstrækkelig desinfektion af udstyr og redskaber.",
      criticalLimit: "Skyllevandstemperatur efter virksomhedens fastsatte krav, typisk mindst 80 °C ved slutskyl.",
      deviationTrigger: "Skyllevandstemperatur under fastsat grænse.",
      defaultCorrectiveAction: "Opvaskemaskinen kontrolleres. Udstyr vaskes igen, når korrekt temperatur er opnået, eller desinficeres på anden sikker måde.",
      prefilledDeviationText: "Opvaskemaskinens skyllevandstemperatur var under grænsen. Jeg kontrollerer maskinen og vasker udstyr igen, når korrekt temperatur er opnået, eller desinficerer på anden sikker måde."
    }
  },

  tre_timers_regel: {
    routineType: "tre_timers_regel",
    title: "3-timers regel",
    group: "CCP",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Fødevarer udenfor køl må højst opbevares i 3 timer, når temperaturen er mellem 5 °C og 65 °C. Efter 3 timer skal fødevaren som udgangspunkt kasseres.",
    risk: {
      hazard: "Vækst af bakterier ved opbevaring udenfor køl eller uden korrekt varmholdelse.",
      criticalLimit: "Maksimalt 3 timer mellem 5 °C og 65 °C.",
      deviationTrigger: "Fødevaren har stået udenfor køl/varmholdelse i mere end 3 timer.",
      defaultCorrectiveAction: "Fødevaren kasseres som udgangspunkt, medmindre fødevaresikkerheden kan dokumenteres.",
      prefilledDeviationText: "3-timers reglen blev overskredet. Fødevaren kasseres som udgangspunkt, medmindre fødevaresikkerheden kan dokumenteres. Fejlen dokumenteres."
    }
  },

  adskillelse: {
    routineType: "adskillelse",
    title: "Adskillelse",
    group: "GAG",
    frequencyDays: 7,
    defaultUnitId: "default",
    longDescription: "Adskillelse skal forhindre krydsforurening mellem råvarer, færdigvarer, allergener og urene/rene processer. Ved fejl vurderes varen, området rengøres, og fødevaren kasseres eller varmebehandles hvis nødvendigt.",
    risk: {
      hazard: "Krydskontaminering mellem råvarer, spiseklare fødevarer, allergener eller urene/rene processer.",
      criticalLimit: "Rå og spiseklare fødevarer, allergener og rene/urene processer skal holdes adskilt.",
      deviationTrigger: "Manglende adskillelse, forkert placering eller risiko for krydsforurening.",
      defaultCorrectiveAction: "Fødevaren vurderes. Området rengøres/desinficeres. Fødevaren kasseres eller varmebehandles hvis det er sikkert og relevant.",
      prefilledDeviationText: "Der var risiko for krydsforurening på grund af manglende adskillelse. Jeg vurderer fødevaren, rengør/desinficerer området og kasserer eller varmebehandler varen hvis nødvendigt."
    }
  },

  rengoering: {
    routineType: "rengoering",
    title: "Rengøring",
    group: "GAG",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Rengøring skal sikre, at lokaler, inventar, maskiner og redskaber er rene før brug. Hvis rengøring ikke er i orden, skal der rengøres inden produktion eller brug.",
    risk: {
      hazard: "Kontaminering af fødevarer fra snavsede lokaler, inventar, maskiner eller redskaber.",
      criticalLimit: "Områder og udstyr skal være rene før produktion eller brug.",
      deviationTrigger: "Synligt snavs, mangelfuld rengøring eller udstyr ikke egnet til brug.",
      defaultCorrectiveAction: "Der rengøres inden produktion eller brug. Fødevarer vurderes hvis de kan være påvirket.",
      prefilledDeviationText: "Rengøringen var ikke i orden. Jeg rengør området/udstyret inden produktion eller brug og vurderer fødevarer, hvis de kan være påvirket."
    }
  },

  koekken_rengoering: {
    routineType: "koekken_rengoering",
    title: "Køkken rengøring",
    group: "GAG",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Køkkenet rengøres dagligt og efter behov, herunder borde, gulve, udstyr, redskaber og kontaktflader. Hvis rengøring ikke er i orden, rengøres der inden produktion.",
    risk: {
      hazard: "Kontaminering fra snavsede overflader, gulve, udstyr, redskaber eller kontaktflader.",
      criticalLimit: "Køkkenet skal være rent før og under produktion efter behov.",
      deviationTrigger: "Synligt snavs, spild eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Køkkenet rengøres før produktion fortsætter. Berørte fødevarer vurderes.",
      prefilledDeviationText: "Køkkenrengøringen var ikke i orden. Jeg rengør berørte områder, udstyr og kontaktflader før produktion fortsætter og vurderer fødevarer ved behov."
    }
  },

  sporbarhed: {
    routineType: "sporbarhed",
    title: "Sporbarhed",
    group: "GAG",
    frequencyDays: 7,
    defaultUnitId: "default",
    longDescription: "Sporbarhed sikrer, at fødevarer kan spores tilbage til leverandør og frem til kunde. Ved manglende sporbarhed skal dokumentation etableres eller forbedres.",
    risk: {
      hazard: "Manglende evne til at spore fødevarer ved tilbagekaldelse eller fødevaresikkerhedshændelse.",
      criticalLimit: "Alle fødevarer skal kunne spores fra leverandør til kunde.",
      deviationTrigger: "Manglende eller ufuldstændig dokumentation af sporbarhed.",
      defaultCorrectiveAction: "Dokumentation etableres eller forbedres. Berørte partier identificeres og dokumenteres.",
      prefilledDeviationText: "Sporbarheden var ikke tilstrækkelig dokumenteret. Jeg etablerer eller forbedrer dokumentationen og sikrer, at berørte partier kan identificeres."
    }
  },

  tilbagetraekning: {
    routineType: "tilbagetraekning",
    title: "Tilbagetrækning",
    group: "GAG",
    frequencyDays: 365,
    defaultUnitId: "default",
    longDescription: "Tilbagetrækningsprocedure sikrer, at virksomheden kan tilbagekalde usikre fødevarer hurtigt og effektivt. Proceduren testes årligt.",
    risk: {
      hazard: "Manglende evne til at tilbagekalde usikre fødevarer fra markedet.",
      criticalLimit: "Virksomheden skal have en fungerende tilbagetrækningsprocedure.",
      deviationTrigger: "Proceduren mangler, er utestet eller ikke fungerer tilfredsstillende.",
      defaultCorrectiveAction: "Proceduren opdateres og testes. Ansvarlige instrueres.",
      prefilledDeviationText: "Tilbagetrækningsproceduren var ikke tilstrækkelig. Jeg opdaterer og tester proceduren og sikrer, at ansvarlige er instrueret."
    }
  },

  personlig_hygiejne: {
    routineType: "personlig_hygiejne",
    title: "Personlig hygiejne",
    group: "GAG",
    frequencyDays: 7,
    defaultUnitId: "default",
    longDescription: "Personlig hygiejne sikrer, at medarbejdere overholder krav til håndvask, arbejdstøj, smykker, sår og sygdom. Ved mangler instrueres medarbejdere, og området rengøres ved behov.",
    risk: {
      hazard: "Kontaminering af fødevarer fra dårlig personlig hygiejne.",
      criticalLimit: "Medarbejdere skal overholde krav til håndvask, arbejdstøj, smykker og sygdom.",
      deviationTrigger: "Manglende håndvask, uegnet tøj, smykker, synlige sår eller sygdom.",
      defaultCorrectiveAction: "Medarbejderen instrueres og retter fejlen. Berørte fødevarer vurderes.",
      prefilledDeviationText: "Den personlige hygiejne var ikke i orden. Medarbejderen instrueres og retter fejlen. Berørte fødevarer vurderes og kasseres ved behov."
    }
  },

  aarlig_revision: {
    routineType: "aarlig_revision",
    title: "Årlig revision",
    group: "GAG",
    frequencyDays: 365,
    defaultUnitId: "default",
    longDescription: "Årlig revision af egenkontrolprogrammet sikrer, at alle procedurer, risikovurderinger og dokumentation er opdateret og fungerer efter hensigten.",
    risk: {
      hazard: "Forældede procedurer eller manglende opdatering af egenkontrol.",
      criticalLimit: "Egenkontrolprogrammet skal revideres mindst årligt.",
      deviationTrigger: "Revision ikke gennemført eller mangler opdateret.",
      defaultCorrectiveAction: "Revision gennemføres. Procedurer og dokumentation opdateres.",
      prefilledDeviationText: "Den årlige revision var ikke gennemført eller opdateret. Jeg gennemfører revisionen og opdaterer procedurer og dokumentation."
    }
  },

  friture_rengoering: {
    routineType: "friture_rengoering",
    title: "Friture rengøring",
    group: "GAG",
    frequencyDays: 7,
    defaultUnitId: "default",
    longDescription: "Frituren rengøres og olien skiftes efter fastlagt frekvens eller ved tegn på nedbrydning. Ved mangler rengøres frituren og olien skiftes før videre brug.",
    risk: {
      hazard: "Kontaminering eller dannelse af sundhedsskadelige stoffer fra nedbrudt olie eller snavset friture.",
      criticalLimit: "Frituren skal være ren og olien skal skiftes efter fastlagt frekvens.",
      deviationTrigger: "Synligt snavs, mørk olie, dårlig lugt eller tegn på nedbrydning.",
      defaultCorrectiveAction: "Frituren rengøres og olien skiftes før videre brug.",
      prefilledDeviationText: "Frituren var ikke tilstrækkeligt ren eller olien viste tegn på nedbrydning. Jeg rengør frituren og skifter olien før videre brug."
    }
  },

  paalaegsmaskine_rengoering: {
    routineType: "paalaegsmaskine_rengoering",
    title: "Pålægsmaskine rengøring",
    group: "GAG",
    frequencyDays: 7,
    defaultUnitId: "default",
    longDescription: "Pålægsmaskiner kommer i direkte kontakt med spiseklare fødevarer og kan opsamle madrester, fedt, belægninger og biofilm. Rutinen sikrer, at maskinen rengøres og desinficeres korrekt, så der ikke sker krydskontaminering eller forurening af fødevarer.",
    risk: {
      hazard: "Pålægsmaskiner kan forurene spiseklare fødevarer med madrester, fedt, belægninger, biofilm eller krydskontaminering.",
      criticalLimit: "Ingen synlige madrester, fedt, belægninger eller snavs. Alle fødevarekontaktflader skal være rengjorte og desinficerede, og maskinen skal være samlet korrekt.",
      deviationTrigger: "Pålægsmaskinen er ikke rengjort efter plan, der findes synlige madrester/fedt/belægninger, eller maskinen er ikke samlet korrekt.",
      defaultCorrectiveAction: "Stop brug af maskinen. Rengør og desinficér igen. Kassér fødevarer hvis der er risiko for forurening. Kontakt ansvarlig leder ved gentagne problemer. Opret afvigelse og dokumentér korrigerende handling.",
      prefilledDeviationText: "Pålægsmaskinen var ikke rengjort efter plan, eller der blev fundet synlige madrester, fedt eller belægninger."
    }
  },

  ismaskine_temperatur: {
    routineType: "ismaskine_temperatur",
    title: "Ismaskine temperaturkontrol",
    group: "GAG",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Kontrollér at ismaskinen fungerer korrekt, og at isen opbevares under forhold der hindrer smeltning og forurening.",
    risk: {
      hazard: "Optøet eller forurenet is kan give øget risiko for bakterievækst og krydskontaminering.",
      criticalLimit: "Isen må ikke vise tegn på optøning eller forurening.",
      deviationTrigger: "Tegn på optøning, forurening eller fejl i ismaskinens drift.",
      defaultCorrectiveAction: "Kasser berørt is ved tegn på optøning eller forurening. Undersøg årsagen og opret afvigelse.",
      prefilledDeviationText: "Ismaskinen eller isens tilstand afveg fra kravene."
    }
  },

  ismaskine_rengoering: {
    routineType: "ismaskine_rengoering",
    title: "Ismaskine rengøring",
    group: "GAG",
    frequencyDays: 7,
    defaultUnitId: "default",
    longDescription: "Rengør ismaskinen efter producentens anvisninger. Områder med kontakt til is og vand skal holdes rene.",
    risk: {
      hazard: "Is betragtes som en fødevare og kan forurene drikkevarer eller fødevarer, hvis maskinen ikke holdes ren.",
      criticalLimit: "Ingen synlig forurening på kontaktflader, isbakke eller indvendige flader.",
      deviationTrigger: "Synlig forurening eller utilstrækkelig rengøring af ismaskinen.",
      defaultCorrectiveAction: "Stop brug af isen ved synlig forurening. Rengør og desinficér maskinen. Kasser berørt is og opret afvigelse.",
      prefilledDeviationText: "Ismaskinen var ikke tilstrækkeligt rengjort."
    }
  },

  softicemaskine_temperatur: {
    routineType: "softicemaskine_temperatur",
    title: "Softicemaskine temperaturkontrol",
    group: "GAG",
    frequencyDays: 1,
    defaultUnitId: "default",
    longDescription: "Kontrollér at softicemaskinens temperatur er inden for producentens anbefalede område.",
    risk: {
      hazard: "Forkert temperatur kan øge risikoen for bakterievækst i ismix og færdig softice.",
      criticalLimit: "Temperaturen skal være inden for producentens anbefalede område.",
      deviationTrigger: "Temperaturen er uden for grænserne.",
      defaultCorrectiveAction: "Stop servering fra maskinen, hvis temperaturen er uden for grænserne. Vurder produktet, korrigér fejlen og opret afvigelse.",
      prefilledDeviationText: "Softicemaskinens temperatur var uden for grænserne."
    }
  },

  softicemaskine_rengoering: {
    routineType: "softicemaskine_rengoering",
    title: "Softicemaskine rengøring",
    group: "GAG",
    frequencyDays: 7,
    defaultUnitId: "default",
    longDescription: "Rengør softicemaskinen efter producentens anvisninger. Alle dele, der kommer i kontakt med ismix eller færdig softice, skal være rene og fri for rester.",
    risk: {
      hazard: "Belægninger, mælkesten, biofilm og produktrester kan give vækst og forurening af is, softice eller blanding.",
      criticalLimit: "Ingen synlig snavs, belægning, slim, mug eller produktrester. Alle fødevarekontaktflader skal være rengjorte og desinficerede, og maskinen skal være samlet korrekt.",
      deviationTrigger: "Is-/softicemaskinen er ikke rengjort efter plan, der findes synlig snavs/belægning/produktrester, eller dele er ikke samlet korrekt.",
      defaultCorrectiveAction: "Stop brug af maskinen. Rengør og desinficér igen. Kassér is/softice eller blanding hvis der er risiko for forurening. Kontakt ansvarlig leder ved gentagne problemer. Opret afvigelse og dokumentér korrigerende handling.",
      prefilledDeviationText: "Is-/softicemaskinen var ikke rengjort efter plan, eller der blev fundet synlig snavs, belægning eller produktrester."
    }
  }
};

/**
 * HELPER FUNCTIONS
 */

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRoutineType(input) {
  if (!input) return null;
  const key = normalizeText(input);

  const aliases = {
    nedkoeling: "nedkoeling",
    cooling: "nedkoeling",
    minimal_nedkoeling: "nedkoeling",

    opvarmning: "opvarmning",
    varmebehandling: "opvarmning",
    heating: "opvarmning",
    opvarmning_varmebehandling: "opvarmning",

    varemodtagelse: "varemodtagelse",
    receiving: "varemodtagelse",
    varemodtagelse_transport: "varemodtagelse",
    minimal_varemodtagelse: "varemodtagelse",

    varmholdelse: "varmholdelse",
    hot_holding: "varmholdelse",

    rengoring: "rengoering",
    rengoering: "rengoering",
    cleaning: "rengoering",
    minimal_rengoering: "rengoering",

    koeleskab_temperatur: "koeleskab_temperatur",
    koleskab_temperatur: "koeleskab_temperatur",
    fridge_temperature_control: "koeleskab_temperatur",
    fridge_temperature: "koeleskab_temperatur",

    fryser_temperatur: "fryser_temperatur",
    freezer_temperature_control: "fryser_temperatur",
    freezer_temperature: "fryser_temperatur",

    koeleskab_rengoering: "koeleskab_rengoering",
    koleskab_rengoring: "koeleskab_rengoering",
    fridge_cleaning_control: "koeleskab_rengoering",
    fridge_cleaning: "koeleskab_rengoering",

    fryser_rengoering: "fryser_rengoering",
    freezer_cleaning_control: "fryser_rengoering",
    freezer_cleaning: "fryser_rengoering",

    walkin_koeler_temperatur: "walkin_koeler_temperatur",
    walk_in_koeler_temperatur: "walkin_koeler_temperatur",
    walkin_cooler_temperature: "walkin_koeler_temperatur",

    walkin_fryser_temperatur: "walkin_fryser_temperatur",
    walk_in_fryser_temperatur: "walkin_fryser_temperatur",
    walkin_freezer_temperature: "walkin_fryser_temperatur",

    walkin_koeler_rengoering: "walkin_koeler_rengoering",
    walk_in_koeler_rengoering: "walkin_koeler_rengoering",
    walkin_cooler_cleaning: "walkin_koeler_rengoering",

    walkin_fryser_rengoering: "walkin_fryser_rengoering",
    walk_in_fryser_rengoering: "walkin_fryser_rengoering",
    walkin_freezer_cleaning: "walkin_fryser_rengoering",

    opvaskemaskine: "opvaskemaskine_skyllevand",
    opvaskemaskine_skyllevand: "opvaskemaskine_skyllevand",
    opvaskemaskine_skyllevandstemperatur: "opvaskemaskine_skyllevand",
    opvaskemaskine_skyllevandskontrol: "opvaskemaskine_skyllevand",
    dishwasher: "opvaskemaskine_skyllevand",
    water_control: "opvaskemaskine_skyllevand",

    tre_timers_regel: "tre_timers_regel",
    salg_udenfor_koel: "tre_timers_regel",
    salg_udenfor_kol: "tre_timers_regel",
    three_hour_rule: "tre_timers_regel",

    adskillelse: "adskillelse",
    separation: "adskillelse",

    koekken_rengoering: "koekken_rengoering",
    kitchen_cleaning: "koekken_rengoering",

    sporbarhed: "sporbarhed",
    traceability: "sporbarhed",

    tilbagetraekning: "tilbagetraekning",
    tilbagekaldelse: "tilbagetraekning",
    recall: "tilbagetraekning",

    personlig_hygiejne: "personlig_hygiejne",
    personal_hygiene: "personlig_hygiejne",

    aarlig_revision: "aarlig_revision",
    annual_review: "aarlig_revision",
    opdatering_af_apv: "aarlig_revision",

    friture_rengoering: "friture_rengoering",
    fryer_cleaning: "friture_rengoering",

    paalaegsmaskine_rengoering: "paalaegsmaskine_rengoering",
    paalaegsmaskine_cleaning: "paalaegsmaskine_rengoering",
    slicer_cleaning: "paalaegsmaskine_rengoering",
    slicing_machine_cleaning: "paalaegsmaskine_rengoering",

    softice_maskine_rengoering: "softicemaskine_rengoering",
    softice_machine_cleaning: "softicemaskine_rengoering",
    softice_temperatur_kontrol: "softicemaskine_temperatur",
    softice_temperature_control: "softicemaskine_temperatur",
    ice_machine_cleaning: "ismaskine_rengoering",
    ice_machine_temperature: "ismaskine_temperatur",
    ice_machine_temperature_control: "ismaskine_temperatur",
    ismaskine_rengoering: "ismaskine_rengoering",
    ismaskine_temperatur: "ismaskine_temperatur",
    ismaskine_temperatur_kontrol: "ismaskine_temperatur"
  };

  const normalized = aliases[key] || null;
  
  // STRICT: Only return if it exists in CANONICAL_ROUTINE_TYPES
  if (normalized && CANONICAL_ROUTINE_TYPES[normalized]) {
    return normalized;
  }
  
  return null;
}

function resolveUnitId(data) {
  return (
    data?.unitId ||
    data?.equipmentId ||
    data?.assetId ||
    data?.deviceId ||
    "default"
  );
}

function resolveUnitName(data) {
  return (
    data?.unitName ||
    data?.equipmentName ||
    data?.assetName ||
    data?.deviceName ||
    ""
  );
}

function buildCanonicalTaskKey(routineType, unitId) {
  return `${routineType}__${unitId || "default"}`;
}

function getRoutineDefinition(routineType) {
  return CANONICAL_ROUTINE_TYPES[normalizeRoutineType(routineType)] || null;
}

function buildDisplayTitle(routineType, unitId, unitName) {
  const def = getRoutineDefinition(routineType);
  const baseTitle = def?.title || "Rutine";
  if (!unitId || unitId === "default") return baseTitle;
  return `${baseTitle} · ${unitName || unitId}`;
}

function buildCanonicalRoutineFields(input) {
  const routineType = normalizeRoutineType(
    input?.routineType ||
    input?.canonicalTaskKey ||
    input?.templateKey ||
    input?.taskKey ||
    input?.controlType ||
    input?.sourceTaskId ||
    input?.title
  );

  // STRICT: If routineType is null, return null
  if (!routineType) {
    return null;
  }

  const unitId = resolveUnitId(input);
  const unitName = resolveUnitName(input);
  const def = getRoutineDefinition(routineType);

  // STRICT: If no definition found, return null
  if (!def) {
    return null;
  }

  return {
    routineType,
    unitId,
    unitName,
    canonicalTaskKey: buildCanonicalTaskKey(routineType, unitId),
    title: def.title,
    displayTitle: buildDisplayTitle(routineType, unitId, unitName),
    longDescription: def.longDescription,
    group: def.group,
    frequencyDays: def.frequencyDays,
    risk: def.risk
  };
}

module.exports = {
  CANONICAL_ROUTINE_TYPES,
  normalizeText,
  normalizeRoutineType,
  resolveUnitId,
  resolveUnitName,
  buildCanonicalTaskKey,
  getRoutineDefinition,
  buildDisplayTitle,
  buildCanonicalRoutineFields
};
