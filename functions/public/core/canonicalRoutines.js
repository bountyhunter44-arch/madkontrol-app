/**
 * CANONICAL ROUTINE MODEL - FRONTEND
 * Synkroniseret med backend functions/js/canonicalRoutines.js
 * 22 rutinetyper med komplet risikostyring
 */

// Fuld canonical model med longDescription og risk for alle 22 rutiner
const CANONICAL_ROUTINES = [
  {
    routineType: "varemodtagelse",
    displayTitle: "Varemodtagelse",
    group: "CCP",
    frequencyDays: 1,
    longDescription: "Ved varemodtagelse kontrolleres temperatur, emballage, holdbarhed og mærkning. Kølevarer skal som udgangspunkt være højst 5 °C og frostvarer højst -18 °C. Ved fejl vurderes varen, returneres eller kasseres, og fejlen dokumenteres.",
    risk: {
      hazard: "Modtagelse af fødevarer med for høj temperatur, beskadiget emballage, overskredet holdbarhed eller fejl i mærkning.",
      criticalLimit: "Kølevarer højst 5 °C, frostvarer højst -18 °C, emballage hel, holdbarhed og mærkning i orden.",
      deviationTrigger: "Temperatur over grænse, beskadiget emballage, udløbet holdbarhed eller mangelfuld mærkning.",
      defaultCorrectiveAction: "Varen vurderes straks. Hvis fødevaresikkerheden ikke kan dokumenteres, returneres eller kasseres varen. Leverandøren kontaktes, og fejlen dokumenteres.",
      prefilledDeviationText: "Varemodtagelsen afveg fra kravene. Jeg har vurderet varen ud fra temperatur, emballage, holdbarhed og mærkning. Varen returneres eller kasseres, hvis den ikke kan anvendes sikkert. Leverandøren kontaktes ved behov."
    }
  },
  {
    routineType: "opvarmning",
    displayTitle: "Opvarmning",
    group: "CCP",
    frequencyDays: 1,
    longDescription: "Ved opvarmning skal fødevaren som udgangspunkt opvarmes til mindst 75 °C i centrum eller tykkeste punkt. Hvis temperaturen ikke er opnået, fortsættes opvarmningen indtil kravet er opfyldt.",
    risk: {
      hazard: "Overlevelse af sygdomsfremkaldende bakterier ved utilstrækkelig opvarmning.",
      criticalLimit: "Minimum 75 °C i centrum eller tykkeste punkt, medmindre anden dokumenteret sikker tid/temperatur anvendes.",
      deviationTrigger: "Målt temperatur under 75 °C.",
      defaultCorrectiveAction: "Fortsæt opvarmningen indtil mindst 75 °C er opnået. Mål igen og dokumentér resultatet.",
      prefilledDeviationText: "Opvarmningen nåede ikke den krævede temperatur. Jeg fortsætter opvarmningen, indtil fødevaren er mindst 75 °C i centrum/tykkeste punkt. Temperaturen måles igen og dokumenteres."
    }
  },
  {
    routineType: "nedkoeling",
    displayTitle: "Nedkøling",
    group: "CCP",
    frequencyDays: 1,
    longDescription: "Ved nedkøling skal varmebehandlede fødevarer hurtigst muligt nedkøles. Temperaturen skal falde fra 65 °C til 10 °C på højst 4 timer. Hvis kravet ikke overholdes, skal fødevaren straks genopvarmes til 75 °C og nedkøles igen, eller kasseres.",
    risk: {
      hazard: "Vækst af bakterier og toksindannelse ved for langsom nedkøling.",
      criticalLimit: "Fra 65 °C til 10 °C på højst 4 timer.",
      deviationTrigger: "Nedkølingen når ikke 10 °C inden for 4 timer.",
      defaultCorrectiveAction: "Fødevaren genopvarmes straks til 75 °C og nedkøles igen, eller kasseres.",
      prefilledDeviationText: "Nedkølingen overholdt ikke kravet om 65 °C til 10 °C på højst 4 timer. Fødevaren genopvarmes straks til 75 °C og nedkøles igen, eller kasseres hvis sikkerheden ikke kan dokumenteres."
    }
  },
  {
    routineType: "varmholdelse",
    displayTitle: "Varmholdelse",
    group: "CCP",
    frequencyDays: 1,
    longDescription: "Ved varmholdelse skal fødevaren holdes ved mindst 65 °C. Hvis temperaturen kommer under 65 °C, skal fødevaren vurderes og som udgangspunkt kasseres, medmindre fødevaresikkerheden kan dokumenteres.",
    risk: {
      hazard: "Vækst af sygdomsfremkaldende bakterier ved for lav varmholdelsestemperatur.",
      criticalLimit: "Minimum 65 °C overalt i fødevaren.",
      deviationTrigger: "Temperatur under 65 °C.",
      defaultCorrectiveAction: "Fødevaren vurderes. Hvis sikkerheden ikke kan dokumenteres, kasseres fødevaren.",
      prefilledDeviationText: "Varmholdelsen var under 65 °C. Jeg vurderer fødevaren og kasserer den, hvis fødevaresikkerheden ikke kan dokumenteres. Fejlen dokumenteres."
    }
  },
  {
    routineType: "koeleskab_temperatur",
    displayTitle: "Køleskab temp.",
    group: "CCP",
    frequencyDays: 1,
    subtitle: "Kontrol af køleskabstemperatur",
    longDescription: "Kontrol af at kølevarer opbevares ved korrekt temperatur, så vækst af sygdomsfremkaldende bakterier begrænses.",
    purpose: "At sikre at kølevarer opbevares forsvarligt og ikke udgør en fødevaresikkerhedsrisiko.",
    checkItems: [
      "Køleskabets temperatur er maks. 5°C eller under virksomhedens fastsatte grænse",
      "Varer er placeret korrekt og ikke overfyldt",
      "Luft kan cirkulere frit i køleskabet",
      "Døren slutter tæt",
      "Termometer eller temperaturmåler fungerer korrekt"
    ],
    howToCheck: "Aflæs temperaturen på køleskabets termometer eller mål med et kalibreret termometer. Kontrollér samtidig at varer er placeret korrekt, og at døren lukker tæt.",
    acceptCriteria: "Kølevarer opbevares ved maks. 5°C eller efter virksomhedens fastsatte grænse.",
    risk: {
      hazard: "For høj køletemperatur kan medføre vækst af sygdomsfremkaldende bakterier og gøre fødevarer usikre.",
      criticalLimit: "Maks. 5°C for kølevarer, medmindre produktet eller virksomhedens egenkontrolprogram kræver en anden grænse.",
      deviationTrigger: "Køleskabets temperatur er over grænseværdien, eller køleskabet fungerer ikke korrekt.",
      defaultCorrectiveAction: "Flyt fødevarer til fungerende køl. Justér temperaturen eller kontakt service. Mål temperaturen igen. Vurder hvor længe varerne har været for varme, og om de kan anvendes forsvarligt eller skal kasseres. Notér årsag og handling.",
      prefilledDeviationText: "Køleskabets temperatur var over den fastsatte grænse ved kontrollen."
    }
  },
  {
    routineType: "fryser_temperatur",
    displayTitle: "Fryser temp.",
    group: "CCP",
    frequencyDays: 1,
    subtitle: "Kontrol af frysetemperatur",
    longDescription: "Kontrol af at frostvarer opbevares forsvarligt frosne, så kvalitet, holdbarhed og fødevaresikkerhed bevares.",
    purpose: "At sikre at frostvarer ikke optør utilsigtet og fortsat kan anvendes forsvarligt.",
    checkItems: [
      "Fryserens temperatur er inden for virksomhedens fastsatte grænse",
      "Varer er fortsat frosne",
      "Dør eller låg slutter tæt",
      "Der er ikke unormal isdannelse",
      "Termometer eller temperaturmåler fungerer korrekt"
    ],
    howToCheck: "Aflæs fryserens temperatur og kontrollér varernes tilstand. Kontrollér samtidig at dør eller låg lukker tæt, og at der ikke er unormal isdannelse.",
    acceptCriteria: "Frostvarer skal opbevares forsvarligt frosne, normalt ved -18°C eller koldere, medmindre produktet kræver andet.",
    risk: {
      hazard: "For høj frysetemperatur eller optøning kan forringe varernes kvalitet, holdbarhed og fødevaresikkerhed.",
      criticalLimit: "Frostvarer skal holdes frosne, normalt ved -18°C eller koldere.",
      deviationTrigger: "Fryserens temperatur er for høj, varer er delvist optøede, eller fryseren fungerer ikke korrekt.",
      defaultCorrectiveAction: "Kontrollér fryserens funktion. Flyt varer til fungerende fryser ved behov. Vurder om varer har været optøet, og om de kan anvendes forsvarligt eller skal kasseres. Notér årsag og handling.",
      prefilledDeviationText: "Fryserens temperatur eller varernes tilstand var ikke i orden ved kontrollen."
    }
  },
  {
    routineType: "tre_timers_regel",
    displayTitle: "3-timers regel",
    group: "CCP",
    frequencyDays: 1,
    longDescription: "Fødevarer udenfor køl må højst opbevares i 3 timer, når temperaturen er mellem 5 °C og 65 °C. Efter 3 timer skal fødevaren som udgangspunkt kasseres.",
    risk: {
      hazard: "Vækst af bakterier ved opbevaring udenfor køl eller uden korrekt varmholdelse.",
      criticalLimit: "Maksimalt 3 timer mellem 5 °C og 65 °C.",
      deviationTrigger: "Fødevaren har stået udenfor køl/varmholdelse i mere end 3 timer.",
      defaultCorrectiveAction: "Fødevaren kasseres som udgangspunkt, medmindre fødevaresikkerheden kan dokumenteres.",
      prefilledDeviationText: "3-timers reglen blev overskredet. Fødevaren kasseres som udgangspunkt, medmindre fødevaresikkerheden kan dokumenteres. Fejlen dokumenteres."
    }
  },
  {
    routineType: "walkin_koeler_temperatur",
    displayTitle: "Walk-in køler temperaturmåling",
    group: "CCP",
    frequencyDays: 1,
    longDescription: "Walk-in kølerens temperatur kontrolleres for at sikre korrekt opbevaring af kølevarer, normalt højst 5 °C. Ved afvigelser vurderes fødevarerne og fejlen dokumenteres.",
    risk: {
      hazard: "Vækst af bakterier ved for høj temperatur i walk-in køler.",
      criticalLimit: "Normalt højst 5 °C.",
      deviationTrigger: "Temperatur over fastsat grænse.",
      defaultCorrectiveAction: "Temperaturen kontrolleres igen. Fødevarer vurderes, flyttes eller kasseres hvis sikkerheden ikke kan dokumenteres.",
      prefilledDeviationText: "Walk-in køleren var over temperaturgrænsen. Jeg kontrollerer temperaturen igen, vurderer fødevarerne og flytter eller kasserer dem, hvis sikkerheden ikke kan dokumenteres."
    }
  },
  {
    routineType: "walkin_fryser_temperatur",
    displayTitle: "Walk-in fryser temperaturmåling",
    group: "CCP",
    frequencyDays: 1,
    longDescription: "Walk-in fryserens temperatur kontrolleres for at sikre korrekt opbevaring af frostvarer, normalt højst -18 °C. Ved afvigelser vurderes varerne og fejlen dokumenteres.",
    risk: {
      hazard: "Temperaturstigning eller optøning af frostvarer.",
      criticalLimit: "Normalt -18 °C eller koldere.",
      deviationTrigger: "Temperatur over fastsat grænse.",
      defaultCorrectiveAction: "Temperaturen kontrolleres igen. Varer vurderes, flyttes, anvendes straks eller kasseres efter vurdering.",
      prefilledDeviationText: "Walk-in fryseren var over temperaturgrænsen. Jeg kontrollerer temperaturen igen, vurderer varerne og flytter, anvender eller kasserer dem efter fødevaresikkerhedsmæssig vurdering."
    }
  },
  {
    routineType: "rengoering",
    displayTitle: "Rengøring",
    group: "GAG",
    frequencyDays: 1,
    longDescription: "Rengøring skal sikre, at lokaler, inventar, maskiner og redskaber er rene før brug. Hvis rengøring ikke er i orden, skal der rengøres inden produktion eller brug.",
    risk: {
      hazard: "Kontaminering af fødevarer fra snavsede lokaler, inventar, maskiner eller redskaber.",
      criticalLimit: "Områder og udstyr skal være rene før produktion eller brug.",
      deviationTrigger: "Synligt snavs, mangelfuld rengøring eller udstyr ikke egnet til brug.",
      defaultCorrectiveAction: "Der rengøres inden produktion eller brug. Fødevarer vurderes hvis de kan være påvirket.",
      prefilledDeviationText: "Rengøringen var ikke i orden. Jeg rengør området/udstyret inden produktion eller brug og vurderer fødevarer, hvis de kan være påvirket."
    }
  },
  {
    routineType: "koekken_rengoering",
    displayTitle: "Køkken rengøring",
    group: "GAG",
    frequencyDays: 1,
    longDescription: "Køkkenet rengøres dagligt og efter behov, herunder borde, gulve, udstyr, redskaber og kontaktflader. Hvis rengøring ikke er i orden, rengøres der inden produktion.",
    risk: {
      hazard: "Kontaminering fra snavsede overflader, gulve, udstyr, redskaber eller kontaktflader.",
      criticalLimit: "Køkkenet skal være rent før og under produktion efter behov.",
      deviationTrigger: "Synligt snavs, spild eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Køkkenet rengøres før produktion fortsætter. Berørte fødevarer vurderes.",
      prefilledDeviationText: "Køkkenrengøringen var ikke i orden. Jeg rengør berørte områder, udstyr og kontaktflader før produktion fortsætter og vurderer fødevarer ved behov."
    }
  },
  {
    routineType: "adskillelse",
    displayTitle: "Adskillelse",
    group: "GAG",
    frequencyDays: 1,
    longDescription: "Adskillelse skal forhindre krydsforurening mellem råvarer, færdigvarer, allergener og urene/rene processer. Ved fejl vurderes varen, området rengøres, og fødevaren kasseres eller varmebehandles hvis nødvendigt.",
    risk: {
      hazard: "Krydskontaminering mellem råvarer, spiseklare fødevarer, allergener eller urene/rene processer.",
      criticalLimit: "Rå og spiseklare fødevarer, allergener og rene/urene processer skal holdes adskilt.",
      deviationTrigger: "Manglende adskillelse, forkert placering eller risiko for krydsforurening.",
      defaultCorrectiveAction: "Fødevaren vurderes. Området rengøres/desinficeres. Fødevaren kasseres eller varmebehandles hvis det er sikkert og relevant.",
      prefilledDeviationText: "Der var risiko for krydsforurening på grund af manglende adskillelse. Jeg vurderer fødevaren, rengør/desinficerer området og kasserer eller varmebehandler varen hvis nødvendigt."
    }
  },
  {
    routineType: "opvaskemaskine_skyllevand",
    displayTitle: "Opvaskemaskine skyllevandstemperatur",
    group: "GAG",
    frequencyDays: 1,
    longDescription: "Opvaskemaskinens skyllevand skal sikre tilstrækkelig desinfektion. Skyllevandstemperaturen skal kontrolleres efter virksomhedens fastsatte krav, typisk mindst 80 °C ved slutskyl.",
    risk: {
      hazard: "Utilstrækkelig desinfektion af udstyr og redskaber.",
      criticalLimit: "Skyllevandstemperatur efter virksomhedens fastsatte krav, typisk mindst 80 °C ved slutskyl.",
      deviationTrigger: "Skyllevandstemperatur under fastsat grænse.",
      defaultCorrectiveAction: "Opvaskemaskinen kontrolleres. Udstyr vaskes igen, når korrekt temperatur er opnået, eller desinficeres på anden sikker måde.",
      prefilledDeviationText: "Opvaskemaskinens skyllevandstemperatur var under grænsen. Jeg kontrollerer maskinen og vasker udstyr igen, når korrekt temperatur er opnået, eller desinficerer på anden sikker måde."
    }
  },
  {
    routineType: "personlig_hygiejne",
    displayTitle: "Personlig hygiejne",
    group: "GAG",
    frequencyDays: 1,
    longDescription: "Medarbejdere skal følge regler for håndvask, arbejdstøj, sygdom, sår og hygiejne. Der skal være adgang til håndvask, sæbe og papir, og fødevarer må ikke håndteres ved risiko for smitte.",
    risk: {
      hazard: "Forurening af fødevarer fra hænder, sygdom, arbejdstøj eller dårlig hygiejne.",
      criticalLimit: "Håndhygiejne, rent arbejdstøj og sygdomsregler skal følges.",
      deviationTrigger: "Manglende håndvask, sygdom ved fødevarehåndtering, snavset arbejdstøj eller manglende sæbe/papir.",
      defaultCorrectiveAction: "Stop håndtering af fødevarer, vask hænder, skift tøj, fyld sæbe/papir op eller fjern syg medarbejder fra fødevarearbejde.",
      prefilledDeviationText: "Personlig hygiejne var ikke i orden. Jeg stopper relevant fødevarehåndtering, retter forholdet og sikrer korrekt håndvask, arbejdstøj eller sygdomshåndtering."
    }
  },
  {
    routineType: "koeleskab_rengoering",
    displayTitle: "Køleskab rengøring",
    group: "GAG",
    frequencyDays: 7,
    longDescription: "Køleskabet rengøres efter fastlagt frekvens, så hylder, vægge, tætningslister og overflader holdes rene. Ved mangelfuld rengøring rengøres køleskabet før videre brug.",
    risk: {
      hazard: "Krydskontaminering fra snavsede overflader, hylder eller tætningslister.",
      criticalLimit: "Køleskabet skal fremstå rent og egnet til opbevaring af fødevarer.",
      deviationTrigger: "Synligt snavs, spild, mug, dårlig lugt eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Køleskabet tømmes efter behov, rengøres og desinficeres hvis relevant, før videre brug.",
      prefilledDeviationText: "Køleskabet var ikke tilstrækkeligt rent. Jeg rengør køleskabet, herunder hylder, overflader og tætningslister, før videre brug. Fødevarer vurderes ved behov."
    }
  },
  {
    routineType: "walkin_koeler_rengoering",
    displayTitle: "Walk-in køler rengøring",
    group: "GAG",
    frequencyDays: 7,
    longDescription: "Walk-in køleren rengøres efter fastlagt frekvens, herunder gulv, hylder, vægge, døre og tætningslister. Ved mangler rengøres området før videre brug.",
    risk: {
      hazard: "Kontaminering fra snavsede gulve, hylder, vægge eller tætningslister.",
      criticalLimit: "Walk-in køleren skal være ren og egnet til opbevaring.",
      deviationTrigger: "Synligt snavs, spild, dårlig lugt eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Walk-in køleren rengøres, og fødevarer vurderes hvis de kan være påvirket.",
      prefilledDeviationText: "Walk-in køleren var ikke tilstrækkeligt ren. Jeg rengør gulv, hylder, vægge, døre og tætningslister og vurderer fødevarer ved behov."
    }
  },
  {
    routineType: "friture_rengoering",
    displayTitle: "Friture rengøring",
    group: "GAG",
    frequencyDays: 7,
    longDescription: "Frituren rengøres efter fastlagt frekvens og efter behov, så olie, kurve, varmelegemer og overflader holdes rene. Olie vurderes og skiftes efter behov.",
    risk: {
      hazard: "Kontaminering, dårlig produktkvalitet eller brand-/driftsrisiko ved snavset friture eller nedbrudt olie.",
      criticalLimit: "Frituren skal være ren, og olie skal være egnet til brug.",
      deviationTrigger: "Snavs, brændte rester, dårlig lugt, mørk/nedbrudt olie eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Rengør frituren og skift olie ved behov. Fødevarer vurderes hvis de kan være påvirket.",
      prefilledDeviationText: "Frituren var ikke tilstrækkeligt ren eller olien var ikke egnet. Jeg rengør frituren, skifter olie ved behov og vurderer fødevarer, hvis de kan være påvirket."
    }
  },
  {
    routineType: "fryser_rengoering",
    displayTitle: "Fryser rengøring",
    group: "GAG",
    frequencyDays: 30,
    longDescription: "Fryseren rengøres og afrimes efter behov og fastlagt frekvens, så overflader, hylder og tætningslister holdes rene. Ved mangler udbedres rengøringen.",
    risk: {
      hazard: "Kontaminering fra snavs, isophobning eller beskadigede overflader.",
      criticalLimit: "Fryseren skal være ren, uden unødig isophobning og egnet til opbevaring.",
      deviationTrigger: "Snavs, spild, kraftig isophobning eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Fryseren rengøres og afrimes efter behov. Varer vurderes og flyttes midlertidigt hvis nødvendigt.",
      prefilledDeviationText: "Fryseren var ikke tilstrækkeligt ren eller havde behov for afrimning. Jeg rengør og afrimer efter behov og vurderer varerne, hvis opbevaringen har været påvirket."
    }
  },
  {
    routineType: "walkin_fryser_rengoering",
    displayTitle: "Walk-in fryser rengøring",
    group: "GAG",
    frequencyDays: 30,
    longDescription: "Walk-in fryseren rengøres og afrimes efter behov og fastlagt frekvens, herunder gulv, hylder, vægge, døre og tætningslister.",
    risk: {
      hazard: "Kontaminering eller driftsproblemer på grund af snavs eller isophobning.",
      criticalLimit: "Walk-in fryseren skal være ren, uden unødig isophobning og egnet til opbevaring.",
      deviationTrigger: "Snavs, spild, kraftig isophobning eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Walk-in fryseren rengøres og afrimes efter behov. Varer vurderes/flyttes hvis nødvendigt.",
      prefilledDeviationText: "Walk-in fryseren var ikke tilstrækkeligt ren eller havde behov for afrimning. Jeg rengør og afrimer efter behov og vurderer/flytter varer hvis nødvendigt."
    }
  },
  {
    routineType: "sporbarhed",
    displayTitle: "Sporbarhed",
    group: "LEGAL",
    frequencyDays: 30,
    subtitle: "Kontrol af sporbarhed og dokumentation",
    longDescription: "Kontrol af at virksomheden kan dokumentere hvor fødevarer kommer fra, og hvor de afsættes til. Alle relevante leverandør- og kundedata skal være tilgængelige og opdaterede.",
    purpose: "At sikre fuld sporbarhed i hele fødevarekæden.",
    legalBasis: "EU Forordning 178/2002 (EF) – artikel 18",
    checkItems: [
      "Der foreligger oplysninger om leverandører på alle modtagne varer",
      "Der foreligger oplysninger om kunder eller modtagere ved levering",
      "Virksomheden kan identificere ét skridt tilbage i kæden",
      "Virksomheden kan identificere ét skridt frem i kæden",
      "Sporbarhedsdokumentation kan fremvises ved kontrolbesøg"
    ],
    howToCheck: "Gennemgå fakturaer, følgesedler, leverandørdata, kundedata og systemregistreringer. Kontrollér at oplysningerne kan bruges til at spore fødevarer ét skridt tilbage og ét skridt frem.",
    acceptCriteria: "Alle relevante fødevarer kan spores ét skridt tilbage og ét skridt frem uden huller i dokumentationen.",
    risk: {
      hazard: "Manglende sporbarhed kan betyde, at farlige fødevarer ikke hurtigt kan lokaliseres, tilbagekaldes eller trækkes tilbage.",
      criticalLimit: "Sporbarhedsdokumentation skal være korrekt, opdateret og tilgængelig.",
      deviationTrigger: "Sporbarhed eller dokumentation er mangelfuld, ukorrekt eller kan ikke fremvises.",
      defaultCorrectiveAction: "Indhent manglende oplysninger straks. Opdater dokumentation og systemregistreringer. Vurder om berørte varer skal tilbageholdes, trækkes tilbage eller tilbagekaldes. Notér årsag og handling.",
      prefilledDeviationText: "Der er konstateret mangelfuld eller utilstrækkelig sporbarhed ved kontrollen."
    }
  },
  {
    routineType: "tilbagetraekning",
    displayTitle: "Tilbagetrækning",
    group: "LEGAL",
    frequencyDays: 365,
    longDescription: "Ved tilbagetrækning skal virksomheden kunne reagere på besked fra leverandør eller myndigheder. Berørte varer identificeres, fjernes fra salg/produktion og returneres eller kasseres efter instruks.",
    risk: {
      hazard: "Farlige eller fejlbehæftede fødevarer forbliver i brug eller salg.",
      criticalLimit: "Berørte varer skal straks identificeres og fjernes fra brug/salg.",
      deviationTrigger: "Tilbagetrækningsbesked ikke håndteret eller dokumentation mangler.",
      defaultCorrectiveAction: "Find berørte varer, stop brug/salg, følg leverandør/myndighedens instruks og dokumentér handlingen.",
      prefilledDeviationText: "Tilbagetrækning er modtaget eller mistænkt. Jeg identificerer berørte varer, stopper brug/salg, følger instruks og dokumenterer hvad der er gjort."
    }
  },
  {
    routineType: "aarlig_revision",
    displayTitle: "Årlig kontrol og revision",
    group: "LEGAL",
    frequencyDays: 365,
    longDescription: "Egenkontrollen skal gennemgås mindst én gang årligt og ved ændringer i aktiviteter, produktion eller vareudvalg. Revisionen skal sikre, at programmet passer til virksomheden.",
    risk: {
      hazard: "Egenkontrolprogrammet passer ikke længere til virksomhedens aktiviteter.",
      criticalLimit: "Egenkontrollen skal være aktuel og dækkende.",
      deviationTrigger: "Årlig revision mangler, eller ændringer i drift er ikke indarbejdet.",
      defaultCorrectiveAction: "Gennemgå egenkontrolprogrammet, opdater risikoanalyse, rutiner og dokumentation, og registrér revisionen.",
      prefilledDeviationText: "Årlig revision eller opdatering mangler. Jeg gennemgår egenkontrollen, opdaterer relevante rutiner og risikoanalyse og dokumenterer revisionen."
    }
  }
];

function normalizeText(value) {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function normalizeRoutineType(input) {
  if (!input) return "";
  
  const normalized = normalizeText(input);
  
  const aliases = {
    nedkoeling: "nedkoeling",
    nedkoling: "nedkoeling",
    cooling: "nedkoeling",
    cooling_control: "nedkoeling",
    minimal_nedkoeling: "nedkoeling",
    
    opvarmning: "opvarmning",
    varmebehandling: "opvarmning",
    heating: "opvarmning",
    reheating: "opvarmning",
    reheating_control: "opvarmning",
    minimal_opvarmning: "opvarmning",
    
    varemodtagelse: "varemodtagelse",
    receiving: "varemodtagelse",
    receiving_control: "varemodtagelse",
    varemodtagelse_transport: "varemodtagelse",
    minimal_varemodtagelse: "varemodtagelse",
    
    varmholdelse: "varmholdelse",
    hot_holding: "varmholdelse",
    hot_holding_control: "varmholdelse",
    
    rengoering: "rengoering",
    rengoering_control: "rengoering",
    cleaning: "rengoering",
    cleaning_control: "rengoering",
    minimal_rengoering: "rengoering",
    
    koeleskab_temperatur: "koeleskab_temperatur",
    koeleskab_temperaturmaaling: "koeleskab_temperatur",
    fridge_temperature: "koeleskab_temperatur",
    fridge_temperature_control: "koeleskab_temperatur",
    cold_storage_control: "koeleskab_temperatur",
    
    fryser_temperatur: "fryser_temperatur",
    fryser_temperaturmaaling: "fryser_temperatur",
    freezer_temperature: "fryser_temperatur",
    freezer_temperature_control: "fryser_temperatur",
    freezer_storage_control: "fryser_temperatur",
    
    koeleskab_rengoering: "koeleskab_rengoering",
    fridge_cleaning: "koeleskab_rengoering",
    fridge_cleaning_control: "koeleskab_rengoering",
    
    fryser_rengoering: "fryser_rengoering",
    freezer_cleaning: "fryser_rengoering",
    freezer_cleaning_control: "fryser_rengoering",
    
    opvaskemaskine_skyllevand: "opvaskemaskine_skyllevand",
    opvaskemaskine_skyllevandstemperatur: "opvaskemaskine_skyllevand",
    opvaskemaskine: "opvaskemaskine_skyllevand",
    dishwasher: "opvaskemaskine_skyllevand",
    dishwasher_control: "opvaskemaskine_skyllevand",
    dishwasher_rinse_temperature_control: "opvaskemaskine_skyllevand",
    water_control: "opvaskemaskine_skyllevand",
    
    tre_timers_regel: "tre_timers_regel",
    "3_timers_regel": "tre_timers_regel",
    "3_timer_regel": "tre_timers_regel",
    salg_udenfor_koel: "tre_timers_regel",
    
    adskillelse: "adskillelse",
    separation: "adskillelse",
    separation_control: "adskillelse",
    
    sporbarhed: "sporbarhed",
    traceability: "sporbarhed",
    traceability_control: "sporbarhed",
    
    tilbagetraekning: "tilbagetraekning",
    tilbagetrakning: "tilbagetraekning",
    withdrawal: "tilbagetraekning",
    withdrawal_control: "tilbagetraekning",
    
    personlig_hygiejne: "personlig_hygiejne",
    personal_hygiene: "personlig_hygiejne",
    personal_hygiene_control: "personlig_hygiejne",
    
    aarlig_revision: "aarlig_revision",
    arlig_revision: "aarlig_revision",
    annual_revision: "aarlig_revision",
    annual_revision_control: "aarlig_revision",
    
    friture_rengoering: "friture_rengoering",
    fryer_cleaning: "friture_rengoering",
    fryer_cleaning_control: "friture_rengoering",
    
    koekken_rengoering: "koekken_rengoering",
    kitchen_cleaning: "koekken_rengoering",
    
    walkin_koeler_temperatur: "walkin_koeler_temperatur",
    walkin_fryser_temperatur: "walkin_fryser_temperatur",
    walkin_koeler_rengoering: "walkin_koeler_rengoering",
    walkin_fryser_rengoering: "walkin_fryser_rengoering"
  };
  
  return aliases[normalized] || normalized;
}

function buildCanonicalTaskKey(routineType, unitId) {
  const normalizedRoutineType = normalizeRoutineType(routineType);
  const normalizedUnitId = String(unitId || "default").trim();
  
  if (!normalizedRoutineType) return "";
  
  if (normalizedUnitId === "default" || !normalizedUnitId) {
    return normalizedRoutineType;
  }
  
  return `${normalizedRoutineType}__${normalizedUnitId}`;
}

function buildDisplayTitle(definitionOrTask, unitOrName = null) {
  const item = definitionOrTask || {};

  const safe = (value, fallback = "") => {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    if (!text || text === "undefined" || text === "null") return fallback;
    return text;
  };

  const labels = {
    varemodtagelse: "Varemodtagelse",
    opvarmning: "Opvarmning",
    nedkoeling: "Nedkøling",
    varmholdelse: "Varmholdelse",
    koeleskab_temperatur: "Køleskab temperatur",
    fryser_temperatur: "Fryser temperatur",
    tre_timers_regel: "3-timers regel",
    walkin_koeler_temperatur: "Walk-in køler temperatur",
    walkin_fryser_temperatur: "Walk-in fryser temperatur",
    rengoering: "Rengøring",
    koekken_rengoering: "Køkken rengøring",
    adskillelse: "Adskillelse",
    opvaskemaskine_skyllevand: "Opvaskemaskine skyllevand",
    personlig_hygiejne: "Personlig hygiejne",
    koeleskab_rengoering: "Køleskab rengøring",
    walkin_koeler_rengoering: "Walk-in køler rengøring",
    friture_rengoering: "Friture rengøring",
    fryser_rengoering: "Fryser rengøring",
    walkin_fryser_rengoering: "Walk-in fryser rengøring",
    sporbarhed: "Sporbarhed",
    tilbagetraekning: "Tilbagetrækning",
    aarlig_revision: "Årlig revision"
  };

  const routineType = safe(
    item.routineType ||
    item.canonicalRoutineType ||
    item.templateKey ||
    item.type ||
    item.taskType,
    ""
  );

  let baseTitle = safe(
    item.displayTitle ||
    item.title ||
    item.templateTitle ||
    item.name,
    ""
  );

  if (!baseTitle || baseTitle.includes("undefined")) {
    baseTitle = labels[routineType] || safe(routineType, "Rutine");
  }

  const unitName = typeof unitOrName === "string"
    ? safe(unitOrName, "")
    : safe(
        unitOrName?.name ||
        unitOrName?.displayName ||
        item.unitName ||
        item.equipmentName ||
        item.unit?.name ||
        item.equipment?.name,
        ""
      );

  baseTitle = baseTitle.replace(/^undefined\s*[·-]\s*/i, "").trim();
  baseTitle = baseTitle.replace(/\s*[·-]\s*undefined$/i, "").trim();

  if (!baseTitle) baseTitle = "Rutine";

  if (unitName && !baseTitle.toLowerCase().includes(unitName.toLowerCase())) {
    return `${baseTitle} · ${unitName}`;
  }

  return baseTitle;
}

function getRoutineDefinition(routineType) {
  const normalizedRoutineType = normalizeRoutineType(routineType);
  return CANONICAL_ROUTINES.find(r => r.routineType === normalizedRoutineType) || null;
}

// Export for use in rutiner.html and rapporter.html
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CANONICAL_ROUTINES,
    normalizeRoutineType,
    buildCanonicalTaskKey,
    buildDisplayTitle,
    getRoutineDefinition
  };
}

// Browser window exports
if (typeof window !== 'undefined') {
  window.CANONICAL_ROUTINES = CANONICAL_ROUTINES;
  window.normalizeRoutineType = normalizeRoutineType;
  window.buildCanonicalTaskKey = buildCanonicalTaskKey;
  window.buildDisplayTitle = buildDisplayTitle;
  window.getRoutineDefinition = getRoutineDefinition;
}
