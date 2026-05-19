// ============================================================================
// CANONICAL ROUTINES - Madkontrollen Pro
// Single Source of Truth for all routine types
// ============================================================================

const CANONICAL_ROUTINES = [
  // ─── CCP - DAGLIGE ────────────────────────────────────────────────────────
  {
    routineType: "varemodtagelse",
    displayTitle: "Varemodtagelse",
    frequencyDays: 1,
    group: "CCP",
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
    frequencyDays: 1,
    group: "CCP",
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
    displayTitle: "Nedkøling af fødevarer",
    frequencyDays: 1,
    group: "CCP",
    controlType: "cooling_run",
    longDescription: "Nedkøling af varme fødevarer er et kritisk kontrolpunkt. Maden skal hurtigt gennem temperaturzonen, hvor bakterier kan vokse.",
    purpose: "At sikre at varme fødevarer nedkøles sikkert og dokumenteret.",
    controlCheckpoints: [
      "Starttemperatur er mindst 65 °C",
      "Sluttemperatur er højst 10 °C",
      "Nedkøling er afsluttet inden for 4 timer",
      "Starttid og sluttid er dokumenteret",
      "Maden er fordelt i lave beholdere eller kølet effektivt"
    ],
    howToCheck: "Start nedkølingen, når maden tages af varmekilden. Mål og registrér starttemperatur og starttid. Afslut kontrollen, når maden er højst 10 °C, og registrér sluttid og sluttemperatur.",
    acceptCriteria: "Fra mindst 65 °C til højst 10 °C på maks. 4 timer.",
    risk: {
      hazard: "For langsom nedkøling kan give vækst af sygdomsfremkaldende bakterier.",
      criticalLimit: "Starttemperatur ≥ 65 °C, sluttemperatur ≤ 10 °C, tid ≤ 4 timer (240 minutter).",
      deviationTrigger: "Nedkølingen når ikke 10 °C inden for 4 timer, eller starttemperatur under 65 °C.",
      defaultCorrectiveAction: "Hvis maden ikke er under 10 °C efter 4 timer, må den ikke gemmes. Kassér maden eller anvend den straks, hvis det er forsvarligt. Notér afvigelse og korrigerende handling.",
      prefilledDeviationText: "Nedkølingen overholdt ikke kravet om 65 °C til højst 10 °C inden for 4 timer. Maden blev kasseret eller anvendt straks. Nedkølingsmetode justeret, fx mindre portioner, bedre luftcirkulation eller brug af blæsekøler."
    }
  },
  {
    routineType: "varmholdelse",
    displayTitle: "Varmholdelse",
    frequencyDays: 1,
    group: "CCP",
    controlType: "temperature_with_timer",
    longDescription: "Varmholdelse er et kritisk kontrolpunkt, hvor tilberedt mad holdes varm før servering. Temperaturen skal være høj nok til at forhindre bakterievækst.",
    purpose: "At sikre at varme fødevarer holdes ved en temperatur, hvor bakterier ikke kan vokse.",
    controlCheckpoints: [
      "Temperaturen er mindst 65 °C",
      "Måling foretages i centrum af maden",
      "Udstyr er forvarmet",
      "Temperaturen kontrolleres løbende",
      "Maden omrøres ved behov"
    ],
    howToCheck: "Mål temperaturen med et desinficeret stiktermometer i midten af maden. Temperaturen skal altid være mindst 65 °C.",
    acceptCriteria: "Minimum temperatur: 65 °C",
    risk: {
      hazard: "Hvis temperaturen falder under 65 °C, kan bakterier begynde at vokse og gøre maden sundhedsskadelig.",
      criticalLimit: "Minimum 65 °C overalt i fødevaren.",
      deviationTrigger: "Temperatur under 65 °C.",
      defaultCorrectiveAction: "Hvis temperaturen er under 65 °C: Opvarm straks maden til mindst 75 °C (kun én gang). Hvis tiden under 65 °C er ukendt → kassér maden.",
      prefilledDeviationText: "Temperaturen i varmholdt mad var under 65 °C. Maden blev genopvarmet til mindst 75 °C eller kasseret."
    }
  },
  {
    routineType: "koeleskab_temperatur",
    displayTitle: "Køleskab temp.",
    frequencyDays: 1,
    group: "CCP",
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
    frequencyDays: 1,
    group: "CCP",
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
    displayTitle: "3-timers regel uden køl/varme",
    frequencyDays: 1,
    group: "CCP",
    controlType: "time_control",
    longDescription: "Letfordærvelige fødevarer må kun stå uden for temperaturstyring i højst 3 timer, fx ved buffet, servering eller anretning. Maden må ikke sættes tilbage på køl efter 3 timer.",
    purpose: "At sikre at fødevarer, der står uden køl under 5 °C eller varme over 65 °C, ikke står fremme for længe.",
    controlCheckpoints: [
      "Retten/fadet er registreret, når det stilles frem",
      "Opstillingstidspunkt er noteret",
      "Fjernelsestidspunkt er beregnet til maks. 3 timer efter opstilling",
      "Maden fjernes, spises straks eller kasseres senest efter 3 timer",
      "Maden sættes ikke tilbage på køl efter servering uden temperaturstyring",
      "Ved særlig risiko, fx fisk/skaldyr eller meget varmt lokale, anvendes kortere tid eller aktiv køling"
    ],
    howToCheck: "Når retten stilles frem, registreres tidspunktet. Systemet beregner automatisk seneste fjernelsestidspunkt 3 timer senere. Når tiden er gået, skal maden fjernes, anvendes straks eller kasseres. Dokumentér hvad der er gjort.",
    acceptCriteria: "Letfordærvelige fødevarer uden aktiv køl/varme må højst stå fremme i 3 timer.",
    risk: {
      hazard: "Hvis maden står for længe uden temperaturstyring, kan bakterier vokse til et sundhedsskadeligt niveau.",
      criticalLimit: "Maksimalt 3 timer uden køl under 5 °C eller varme over 65 °C.",
      deviationTrigger: "Fødevarer har stået uden køl/varme i mere end 3 timer.",
      defaultCorrectiveAction: "Hvis 3 timer er overskredet, skal maden kasseres. Den må ikke genkøles og gemmes til senere. Notér afvigelse og korrigerende handling.",
      prefilledDeviationText: "Fødevarer har stået uden køl/varme i mere end 3 timer. Maden blev fjernet og kasseret. Rutinen for mærkning, tidstagning og fjernelse blev gennemgået."
    }
  },

  // ─── CCP - WALK-IN ENHEDER ───────────────────────────────────────────────
  {
    routineType: "walkin_koeler_temperatur",
    displayTitle: "Walk-in køler temperaturmåling",
    frequencyDays: 1,
    group: "CCP",
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
    frequencyDays: 1,
    group: "CCP",
    longDescription: "Walk-in fryserens temperatur kontrolleres for at sikre korrekt opbevaring af frostvarer, normalt højst -18 °C. Ved afvigelser vurderes varerne og fejlen dokumenteres.",
    risk: {
      hazard: "Temperaturstigning eller optøning af frostvarer.",
      criticalLimit: "Normalt -18 °C eller koldere.",
      deviationTrigger: "Temperatur over fastsat grænse.",
      defaultCorrectiveAction: "Temperaturen kontrolleres igen. Varer vurderes, flyttes, anvendes straks eller kasseres efter vurdering.",
      prefilledDeviationText: "Walk-in fryseren var over temperaturgrænsen. Jeg kontrollerer temperaturen igen, vurderer varerne og flytter, anvender eller kasserer dem efter fødevaresikkerhedsmæssig vurdering."
    }
  },

  // ─── GAG - DAGLIGE ────────────────────────────────────────────────────────
  {
    routineType: "rengoering",
    displayTitle: "Rengøring",
    frequencyDays: 1,
    group: "GAG",
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
    frequencyDays: 1,
    group: "GAG",
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
    frequencyDays: 1,
    group: "GAG",
    controlType: "checklist",
    longDescription: "Adskillelse handler om at forhindre krydskontaminering, hvor bakterier, allergener eller snavs overføres fra råvarer, urene varer eller allergene ingredienser til spiseklare fødevarer.",
    purpose: "At sikre at rå og spiseklare fødevarer, rene og urene varer samt allergener holdes adskilt i opbevaring og produktion.",
    checklistItems: [
      "Er råvarer adskilt fra tilberedte/spiseklare fødevarer?",
      "Er råt kød, fisk og æg placeret, så de ikke kan dryppe på andre varer?",
      "Er jordbehæftede varer adskilt fra rene varer?",
      "Er alle varer tildækkede eller opbevaret i lukkede beholdere?",
      "Bruges separate/farvekodede redskaber eller skærebrætter ved behov?",
      "Vaskes hænder mellem råvarer og spiseklare fødevarer?",
      "Er allergener adskilt fra allergenfri varer/retter?"
    ],
    howToCheck: "Gennemgå køleskabe, lager og arbejdsstationer. Tjek at rå varer ikke står over spiseklare varer, at varer er tildækkede, og at der bruges rene eller separate redskaber mellem forskellige varetyper. Vurder også medarbejdernes arbejdsgang, især håndvask og skift mellem råt og spiseklart.",
    acceptCriteria: "Der er tydelig adskillelse mellem rå og spiseklare fødevarer, urene og rene varer samt allergener og allergenfri varer. Der er ingen risiko for krydskontaminering.",
    risk: {
      hazard: "Manglende adskillelse kan medføre krydskontaminering med bakterier som Salmonella, Campylobacter eller Listeria samt utilsigtet allergenforurening.",
      criticalLimit: "Rå og spiseklare fødevarer, allergener og rene/urene processer skal holdes adskilt.",
      deviationTrigger: "Manglende adskillelse, forkert placering eller risiko for krydsforurening.",
      defaultCorrectiveAction: "Flyt varer til korrekt placering, tildæk åbne varer, udskift eller rengør redskaber, vask hænder og kassér fødevarer, hvis de kan være blevet forurenet.",
      prefilledDeviationText: "Der er konstateret risiko for krydskontaminering på grund af manglende adskillelse. Varer blev flyttet/adskilt korrekt, åbne varer tildækket, redskaber rengjort eller udskiftet, og medarbejder instrueret i korrekt adskillelse."
    }
  },
  {
    routineType: "opvaskemaskine_skyllevand",
    displayTitle: "Opvaskemaskine skyllevandstemperatur",
    frequencyDays: 1,
    group: "GAG",
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
    frequencyDays: 1,
    group: "GAG",
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
    routineType: "opbevaring",
    displayTitle: "Opbevaring",
    frequencyDays: 1,
    group: "GAG",
    longDescription: "Fødevarer skal opbevares korrekt med adskillelse mellem rå og tilberedte varer, korrekt emballering og mærkning. FIFO-princippet skal følges.",
    risk: {
      hazard: "Krydskontaminering mellem rå og tilberedte fødevarer eller ukorrekt opbevaring.",
      criticalLimit: "Fødevarer skal opbevares adskilt, emballeret og mærket korrekt.",
      deviationTrigger: "Rå og tilberedte varer blandet, manglende emballering eller mærkning.",
      defaultCorrectiveAction: "Adskil varer, emballer og mærk korrekt, vurdér fødevarer ved risiko for kontaminering.",
      prefilledDeviationText: "Opbevaring var ikke korrekt. Jeg adskiller rå og tilberedte varer, sikrer korrekt emballering og mærkning, og vurderer fødevarer ved behov."
    }
  },
  {
    routineType: "allergener",
    displayTitle: "Allergener",
    frequencyDays: 1,
    group: "GAG",
    controlType: "checklist",
    longDescription: "Allergenkontrol handler om at sikre, at virksomheden kan give korrekte oplysninger om allergener og forebygge krydskontaminering. Forkert allergenhåndtering kan medføre alvorlige allergiske reaktioner hos gæster.",
    purpose: "At sikre at allergenoplysninger er korrekte, at personalet kan vejlede gæster, og at allergener håndteres adskilt fra allergenfri varer og retter.",
    checklistItems: [
      "Er allergenoplysninger/opskrifter opdaterede?",
      "Er personalet i stand til at oplyse gæster om allergener?",
      "Er der skiltet eller oplyst, at gæster kan spørge om allergener?",
      "Er omdosede varer mærket tydeligt med navn/indhold?",
      "Er varer med allergener opbevaret adskilt eller forsvarligt lukket?",
      "Bruges rent udstyr ved tilberedning til allergikere?",
      "Er der styr på risiko for krydskontaminering, fx friture, skærebrætter og redskaber?",
      "Er ændrede leverandørvarer/etiketter kontrolleret ved behov?"
    ],
    howToCheck: "Gennemgå menu, opskrifter, råvarer og mærkning. Tjek at allergenoplysninger er tilgængelige og opdaterede, og at personalet ved hvordan de skal svare gæster. Kontroller også at varer med allergener er tydeligt mærket og adskilt fra varer, der skal være allergenfri.",
    acceptCriteria: "Virksomheden kan give korrekte oplysninger om de 14 lovpligtige allergener, og der er styr på mærkning, opbevaring og arbejdsgange, så krydskontaminering forebygges.",
    extraInfo: "De 14 allergener: Gluten, krebsdyr, æg, fisk, jordnødder, soja, mælk, nødder, selleri, sennep, sesamfrø, svovldioxid/sulfit, lupin og bløddyr.",
    risk: {
      hazard: "Forkert allergeninformation eller krydskontaminering kan medføre alvorlige allergiske reaktioner og udgør en væsentlig fødevaresikkerhedsrisiko.",
      criticalLimit: "Allergener skal håndteres adskilt og information skal være korrekt.",
      deviationTrigger: "Krydskontaminering med allergener eller manglende allergeninformation.",
      defaultCorrectiveAction: "Ret allergenoplysninger, mærk varer korrekt, instruér personale og stop servering af retter, hvor allergenindholdet er usikkert. Opret afvigelse og dokumentér handling.",
      prefilledDeviationText: "Allergenoplysninger, mærkning eller håndtering var ikke tilstrækkelig. Allergenoplysninger blev opdateret, varer mærket korrekt, personale instrueret og risiko for krydskontaminering håndteret."
    }
  },

  // ─── GAG - UGENTLIGE ──────────────────────────────────────────────────────
  {
    routineType: "koeleskab_rengoering",
    displayTitle: "Køleskab rengøring",
    frequencyDays: 7,
    group: "GAG",
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
    frequencyDays: 7,
    group: "GAG",
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
    frequencyDays: 1,
    group: "GAG",
    controlType: "checklist",
    longDescription: "Kontrol med friture handler om både fødevaresikkerhed og brandrisiko. Olie nedbrydes ved høj varme og kan danne skadelige stoffer. Samtidig kan ophobning af fedt øge brandfaren.",
    purpose: "At sikre at fritureolie er i god kvalitet, at temperaturen er korrekt, og at udstyr er rent og sikkert.",
    checklistItems: [
      "Er olien visuelt klar (ikke mørk, tyktflydende eller harsk)?",
      "Er frituren fri for madrester og krummer?",
      "Er olien filtreret efter brug?",
      "Er temperaturen korrekt (ca. 160–180°C)?",
      "Er der ingen tegn på overophedning (røg eller kraftig lugt)?",
      "Er frituren rengjort udvendigt for fedt?",
      "Er emhætte/filtre over frituren rene?",
      "Er der styr på allergener (ingen blanding af fx gluten i samme olie)?"
    ],
    howToCheck: "Kontroller olien visuelt og lugtmæssigt. Tjek temperatur med termometer. Se efter madrester, fedtbelægninger og rene filtre. Vurder også om samme olie bruges til allergenholdige produkter.",
    acceptCriteria: "Olien er klar og uden lugt, temperaturen er korrekt, frituren er ren, og der er ingen risiko for krydskontaminering.",
    risk: {
      hazard: "Nedbrudt olie kan danne sundhedsskadelige stoffer. Fedtophobning kan medføre brand. Krydskontaminering kan give allergiske reaktioner.",
      criticalLimit: "Olien må ikke være nedbrudt. Temperatur må ikke overstige 200°C. Ingen allergenblanding.",
      deviationTrigger: "Mørk olie, forkert temperatur, snavs eller allergenrisiko.",
      defaultCorrectiveAction: "Skift olie, rengør friture og filtre, justér temperatur og kassér fødevarer ved risiko.",
      prefilledDeviationText: "Friturekontrol viste afvigelse i olie, temperatur eller rengøring. Olie blev skiftet, friture rengjort og forhold bragt i orden."
    }
  },
  {
    routineType: "koledisk_temperatur",
    displayTitle: "Køledisk temperatur",
    frequencyDays: 1,
    group: "CCP",
    longDescription: "Kølediskens temperatur kontrolleres dagligt for at sikre korrekt opbevaring af fødevarer. Temperaturen skal holdes under 5 °C.",
    risk: {
      hazard: "Bakterievækst ved for høj temperatur i køledisk.",
      criticalLimit: "Temperatur under 5 °C.",
      deviationTrigger: "Temperatur på 5 °C eller derover.",
      defaultCorrectiveAction: "Juster temperaturen, kontroller igen, vurdér fødevarer og kassér hvis nødvendigt.",
      prefilledDeviationText: "Kølediskens temperatur var for høj. Jeg justerer temperaturen og vurderer fødevarerne."
    }
  },
  {
    routineType: "koledisk_rengoering",
    displayTitle: "Køledisk rengøring",
    frequencyDays: 30,
    group: "GAG",
    longDescription: "Køledisken rengøres månedligt, herunder hylder, glas, overflader og tætningslister.",
    risk: {
      hazard: "Krydskontaminering fra snavsede overflader.",
      criticalLimit: "Køledisken skal være ren og egnet til opbevaring.",
      deviationTrigger: "Synligt snavs, spild eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Rengør køledisken grundigt før videre brug.",
      prefilledDeviationText: "Køledisken var ikke tilstrækkeligt ren. Jeg rengør den grundigt."
    }
  },
  {
    routineType: "ovn_rengoering",
    displayTitle: "Ovn rengøring",
    frequencyDays: 7,
    group: "GAG",
    longDescription: "Ovnen rengøres ugentligt for at fjerne madrester, fedt og snavs.",
    risk: {
      hazard: "Brandrisiko og kontaminering ved snavset ovn.",
      criticalLimit: "Ovnen skal være ren og fri for madrester.",
      deviationTrigger: "Synligt snavs, brændte rester eller fedt.",
      defaultCorrectiveAction: "Rengør ovnen grundigt.",
      prefilledDeviationText: "Ovnen var ikke tilstrækkeligt ren. Jeg rengør den grundigt."
    }
  },
  {
    routineType: "komfur_rengoering",
    displayTitle: "Komfur rengøring",
    frequencyDays: 7,
    group: "GAG",
    longDescription: "Komfuret rengøres ugentligt for at fjerne madrester, fedt og snavs.",
    risk: {
      hazard: "Brandrisiko og kontaminering ved snavset komfur.",
      criticalLimit: "Komfuret skal være rent og fri for madrester.",
      deviationTrigger: "Synligt snavs, brændte rester eller fedt.",
      defaultCorrectiveAction: "Rengør komfuret grundigt.",
      prefilledDeviationText: "Komfuret var ikke tilstrækkeligt rent. Jeg rengør det grundigt."
    }
  },
  {
    routineType: "paalaegsmaskine_rengoering",
    displayTitle: "Pålægsmaskine rengøring",
    frequencyDays: 7,
    group: "GAG",
    controlType: "cleaning",
    subtitle: "Rengøring af pålægsmaskine",
    longDescription: "Pålægsmaskiner kommer i direkte kontakt med spiseklare fødevarer og kan opsamle madrester, fedt, belægninger og biofilm. Rutinen sikrer, at maskinen rengøres og desinficeres korrekt, så der ikke sker krydskontaminering eller forurening af fødevarer.",
    purpose: "At sikre, at pålægsmaskinen er ren, desinficeret og samlet korrekt før brug.",
    checkItems: [
      "Kniv, slæde, afskærmning og fødevarekontaktflader er rene.",
      "Der er ikke synlige madrester, fedt, belægninger eller snavs.",
      "Aftagelige dele er rengjort og samlet korrekt.",
      "Rengørings- og desinfektionsmiddel er brugt efter anvisning.",
      "Området omkring maskinen er rent.",
      "Maskinen er sikker at bruge efter rengøring."
    ],
    checklistItems: [
      "Kniv, slæde, afskærmning og fødevarekontaktflader er rene.",
      "Der er ikke synlige madrester, fedt, belægninger eller snavs.",
      "Aftagelige dele er rengjort og samlet korrekt.",
      "Rengørings- og desinfektionsmiddel er brugt efter anvisning.",
      "Området omkring maskinen er rent.",
      "Maskinen er sikker at bruge efter rengøring."
    ],
    controlCheckpoints: [
      "Kniv, slæde, afskærmning og fødevarekontaktflader er rene.",
      "Der er ikke synlige madrester, fedt, belægninger eller snavs.",
      "Aftagelige dele er rengjort og samlet korrekt.",
      "Rengørings- og desinfektionsmiddel er brugt efter anvisning.",
      "Området omkring maskinen er rent.",
      "Maskinen er sikker at bruge efter rengøring."
    ],
    howToCheck: "1. Sluk maskinen og følg sikkerhedsproceduren.\n2. Afmonter aftagelige dele efter producentens anvisning.\n3. Fjern synlige madrester og belægninger.\n4. Rengør kniv, slæde, afskærmning og kontaktflader grundigt.\n5. Desinficér fødevarekontaktflader efter anvisning.\n6. Lad dele tørre eller aftør efter virksomhedens procedure.\n7. Saml maskinen korrekt igen.\n8. Kontrollér visuelt at maskinen er ren og klar til brug.\n9. Dokumentér kontrollen i egenkontrollen.",
    acceptCriteria: "Ingen synlige madrester, fedt, belægninger eller snavs. Alle fødevarekontaktflader er rengjorte og desinficerede. Maskinen er samlet korrekt. Rengøringen er udført efter plan og producentens anvisning.",
    documentation: "Registrér om rengøringen er udført, tidspunkt, medarbejder og eventuel bemærkning.",
    standardDeviationTexts: [
      "Pålægsmaskinen var ikke rengjort efter plan.",
      "Der blev fundet synlige madrester, fedt eller belægninger.",
      "Fødevarekontaktflader var ikke tilstrækkeligt rengjorte/desinficerede.",
      "Maskinen var ikke samlet korrekt efter rengøring.",
      "Der var risiko for forurening af spiseklare fødevarer."
    ],
    standardCorrectiveActions: [
      "Maskinen blev stoppet og rengjort/desinficeret igen.",
      "Berørte fødevarer blev kasseret.",
      "Medarbejder blev instrueret i korrekt rengøringsprocedure.",
      "Rengøringsplanen blev gennemgået og justeret.",
      "Ansvarlig leder blev informeret."
    ],
    risk: {
      hazard: "Pålægsmaskiner kan forurene spiseklare fødevarer med madrester, fedt, belægninger, biofilm eller krydskontaminering.",
      criticalLimit: "Ingen synlige madrester, fedt, belægninger eller snavs. Alle fødevarekontaktflader skal være rengjorte og desinficerede, og maskinen skal være samlet korrekt.",
      deviationTrigger: "Pålægsmaskinen er ikke rengjort efter plan, der findes synlige madrester/fedt/belægninger, eller maskinen er ikke samlet korrekt.",
      defaultCorrectiveAction: "Stop brug af maskinen. Rengør og desinficér igen. Kassér fødevarer hvis der er risiko for forurening. Kontakt ansvarlig leder ved gentagne problemer. Opret afvigelse og dokumentér korrigerende handling.",
      prefilledDeviationText: "Pålægsmaskinen var ikke rengjort efter plan, eller der blev fundet synlige madrester, fedt eller belægninger."
    }
  },
  {
    routineType: "opvaskemaskine_rengoering",
    displayTitle: "Opvaskemaskine rengøring",
    frequencyDays: 7,
    group: "GAG",
    longDescription: "Opvaskemaskinen rengøres ugentligt, herunder filtre, arme og tætninger.",
    risk: {
      hazard: "Dårlig rengøring af service ved snavset maskine.",
      criticalLimit: "Maskinen skal være ren og funktionsdygtig.",
      deviationTrigger: "Synligt snavs, tilstoppede filtre eller dårlig lugt.",
      defaultCorrectiveAction: "Rengør maskinen grundigt, herunder filtre og arme.",
      prefilledDeviationText: "Opvaskemaskinen var ikke tilstrækkeligt ren. Jeg rengør den grundigt."
    }
  },
  {
    routineType: "softice_maskine_rengoering",
    displayTitle: "Ismaskine / softicemaskine rengøring",
    frequencyDays: 7,
    group: "GAG",
    controlType: "cleaning",
    subtitle: "Rengøring af isemaskine / softicemaskine",
    longDescription: "Is- og softicemaskiner kan opbygge belægninger, mælkesten, biofilm og rester fra blandinger. Rutinen sikrer, at maskinen rengøres og desinficeres efter virksomhedens plan og producentens anvisning, så der ikke sker vækst eller forurening af fødevarer.",
    purpose: "At sikre, at is- og softicemaskiner rengøres og desinficeres korrekt efter plan og producentens anvisning.",
    checkItems: [
      "Maskinen er tømt for rester efter behov.",
      "Kontaktflader, dyser, tappetud, beholdere og aftagelige dele er rengjorte.",
      "Der er ikke synlig snavs, belægning, slim, mug eller produktrester.",
      "Rengørings- og desinfektionsmiddel er brugt efter anvisning.",
      "Dele er samlet korrekt efter rengøring.",
      "Området omkring maskinen er rent."
    ],
    checklistItems: [
      "Maskinen er tømt for rester efter behov.",
      "Kontaktflader, dyser, tappetud, beholdere og aftagelige dele er rengjorte.",
      "Der er ikke synlig snavs, belægning, slim, mug eller produktrester.",
      "Rengørings- og desinfektionsmiddel er brugt efter anvisning.",
      "Dele er samlet korrekt efter rengøring.",
      "Området omkring maskinen er rent."
    ],
    controlCheckpoints: [
      "Maskinen er tømt for rester efter behov.",
      "Kontaktflader, dyser, tappetud, beholdere og aftagelige dele er rengjorte.",
      "Der er ikke synlig snavs, belægning, slim, mug eller produktrester.",
      "Rengørings- og desinfektionsmiddel er brugt efter anvisning.",
      "Dele er samlet korrekt efter rengøring.",
      "Området omkring maskinen er rent."
    ],
    howToCheck: "1. Stop maskinen efter virksomhedens procedure.\n2. Tøm rester efter behov.\n3. Afmonter aftagelige dele efter producentens anvisning.\n4. Rengør dele og kontaktflader grundigt.\n5. Desinficér efter anvisning og lad midlet virke korrekt.\n6. Skyl kun hvis produktets brugsanvisning kræver det.\n7. Saml maskinen igen.\n8. Kontrollér visuelt at maskinen er ren og klar til brug.\n9. Dokumentér kontrollen i egenkontrollen.",
    acceptCriteria: "Ingen synlig snavs, belægning, slim, mug eller produktrester. Alle fødevarekontaktflader er rengjorte og desinficerede. Maskinen er samlet korrekt. Rengøring er udført efter plan og producentens anvisning.",
    documentation: "Registrér om rengøringen er udført, tidspunkt, medarbejder og eventuel bemærkning.",
    standardDeviationTexts: [
      "Is-/softicemaskinen var ikke rengjort efter plan.",
      "Der blev fundet synlig snavs, belægning eller produktrester.",
      "Dele var ikke korrekt samlet efter rengøring.",
      "Der var risiko for forurening af produktet."
    ],
    standardCorrectiveActions: [
      "Maskinen blev stoppet og rengjort/desinficeret igen.",
      "Berørt produkt blev kasseret.",
      "Medarbejder blev instrueret i korrekt rengøringsprocedure.",
      "Rengøringsplanen blev gennemgået og justeret.",
      "Ansvarlig leder blev informeret."
    ],
    risk: {
      hazard: "Belægninger, mælkesten, biofilm og produktrester kan give vækst og forurening af is, softice eller blanding.",
      criticalLimit: "Ingen synlig snavs, belægning, slim, mug eller produktrester. Alle fødevarekontaktflader skal være rengjorte og desinficerede, og maskinen skal være samlet korrekt.",
      deviationTrigger: "Is-/softicemaskinen er ikke rengjort efter plan, der findes synlig snavs/belægning/produktrester, eller dele er ikke samlet korrekt.",
      defaultCorrectiveAction: "Stop brug af maskinen. Rengør og desinficér igen. Kassér is/softice eller blanding hvis der er risiko for forurening. Kontakt ansvarlig leder ved gentagne problemer. Opret afvigelse og dokumentér korrigerende handling.",
      prefilledDeviationText: "Is-/softicemaskinen var ikke rengjort efter plan, eller der blev fundet synlig snavs, belægning eller produktrester."
    }
  },
  {
    routineType: "softice_temperatur_kontrol",
    displayTitle: "Softice temperaturkontrol",
    frequencyDays: 1,
    group: "CCP",
    controlType: "temperature",
    longDescription: "Softicemix er et letfordærveligt mælkeprodukt og skal holdes koldt for at begrænse vækst af bakterier, herunder Listeria. Temperaturen i maskinens mix-beholder skal derfor kontrolleres og dokumenteres dagligt.\n\nFormål: At sikre at softicemix opbevares ved korrekt temperatur, så produktet er sikkert for kunderne.\n\nKontrolpunkter:\n- Temperaturen i mix-beholderen er maks. 5 °C\n- Maskinens display virker og kan aflæses\n- Mixen opbevares tildækket/beskyttet i maskinen\n- Der er ingen tegn på urenheder, belægninger eller fejl i maskinen\n- Ved tvivl kontrolleres temperaturen med kalibreret termometer\n\nSådan udføres kontrollen: Aflæs temperaturen i softicemaskinens mix-beholder mindst én gang dagligt. Brug maskinens display, og kontrollér jævnligt med et kalibreret termometer for at sikre, at visningen er korrekt. Dokumentér den målte temperatur i °C.\n\nAcceptkriterier: Softicemix i mix-beholderen skal være maks. 5 °C.\n\nKonsekvens/risiko: Hvis softicemix opbevares over 5 °C, kan sygdomsfremkaldende bakterier vokse. Softicemix er særligt følsomt, fordi det typisk er baseret på mælk og håndteres i en maskine med mange kontaktflader.",
    risk: {
      hazard: "Bakterievækst (herunder Listeria) ved for høj temperatur i softicemix.",
      criticalLimit: "Softicemix i mix-beholderen skal være maks. 5 °C.",
      deviationTrigger: "Temperatur over 5 °C i mix-beholderen.",
      defaultCorrectiveAction: "Køling kontrolleret/justeret. Mix vurderet og kasseret hvis nødvendigt. Maskinen rengøres eller serviceres ved mistanke om fejl.",
      prefilledDeviationText: "Softice mix-beholderen var over 5 °C ved temperaturkontrol. Køling kontrolleret/justeret. Mix vurderet og kasseret hvis nødvendigt. Maskinen rengøres eller serviceres ved mistanke om fejl."
    }
  },

  // ─── GAG - MÅNEDLIGE ──────────────────────────────────────────────────────
  {
    routineType: "fryser_rengoering",
    displayTitle: "Fryser rengøring",
    frequencyDays: 30,
    group: "GAG",
    controlType: "checklist",
    longDescription: "Rengøring og visuel kontrol af fryseren handler om at sikre orden, renhed, tætte gummilister og ingen unødig isdannelse. Temperaturkontrol håndteres i en separat rutine.",
    purpose: "At sikre at fryseren er ren, ryddelig og funktionsdygtig, så frostvarer opbevares hygiejnisk og sikkert.",
    checklistItems: [
      "Er fryseren fri for spildt mad, emballagerester og snavs?",
      "Er varer tildækkede, mærkede og placeret med orden?",
      "Er gamle eller uidentificerbare varer fjernet?",
      "Er der ingen kraftig rim- eller isdannelse?",
      "Er gummilister rene og tætte?",
      "Er hylder/skuffer rene?",
      "Er afrimning planlagt eller udført ved behov?",
      "Er frostvarer flyttet forsvarligt, hvis der er udført dybderengøring?"
    ],
    howToCheck: "Gennemgå fryseren visuelt. Fjern gamle eller uidentificerbare varer. Rengør hylder, skuffer, bund og gummilister ved behov. Ved dybderengøring flyttes frostvarer til anden fryser, fryseren afrimes, vaskes med mildt rengøringsmiddel og desinficeres efter behov. Brug aldrig knive eller skarpe genstande til at fjerne is.",
    acceptCriteria: "Fryseren er ren, ryddelig og uden spild, gamle varer eller kraftig isdannelse. Gummilister er rene og slutter tæt.",
    risk: {
      hazard: "Mangelfuld rengøring og kraftig isdannelse kan give dårlig hygiejne, dårlig lukning, temperaturproblemer og risiko for at varer bliver beskadiget eller usikre.",
      criticalLimit: "Fryseren skal være ren, uden unødig isophobning og egnet til opbevaring.",
      deviationTrigger: "Snavs, spild, kraftig isophobning eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Rengør fryseren, fjern gamle varer, planlæg afrimning eller meld fejl på gummilister/udstyr til ansvarlig. Kassér varer hvis de ikke kan vurderes sikre.",
      prefilledDeviationText: "Fryseren var ikke rengjort eller i tilfredsstillende orden. Fryseren blev rengjort, gamle varer fjernet, afrimning planlagt/udført og fejl meldt til ansvarlig."
    }
  },
  {
    routineType: "walkin_fryser_rengoering",
    displayTitle: "Walk-in fryser rengøring",
    frequencyDays: 30,
    group: "GAG",
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
    routineType: "blaesekoeler_temperatur",
    displayTitle: "Blæsekøler temperatur",
    frequencyDays: 1,
    group: "CCP",
    longDescription: "Blæsekølerens temperatur kontrolleres dagligt for at sikre korrekt nedkøling. Temperaturen skal kunne køle fødevarer ned til under 5 °C inden for 90 minutter.",
    risk: {
      hazard: "Utilstrækkelig nedkøling kan føre til bakterievækst.",
      criticalLimit: "Blæsekøleren skal kunne nedkøle til under 5 °C inden for 90 minutter.",
      deviationTrigger: "Temperatur ikke opnået inden for tidsgrænse.",
      defaultCorrectiveAction: "Kontroller blæsekøleren, juster indstillinger, vurdér fødevarer.",
      prefilledDeviationText: "Blæsekølerens temperatur var ikke tilstrækkelig. Jeg kontrollerer udstyret og vurderer fødevarerne."
    }
  },
  {
    routineType: "blaesekoeler_rengoering",
    displayTitle: "Blæsekøler rengøring",
    frequencyDays: 7,
    group: "GAG",
    longDescription: "Blæsekøleren rengøres ugentligt, herunder hylder, vægge og tætninger.",
    risk: {
      hazard: "Krydskontaminering fra snavsede overflader.",
      criticalLimit: "Blæsekøleren skal være ren.",
      deviationTrigger: "Synligt snavs eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Rengør blæsekøleren grundigt.",
      prefilledDeviationText: "Blæsekøleren var ikke tilstrækkeligt ren. Jeg rengør den grundigt."
    }
  },
  {
    routineType: "varmeskab_temperatur",
    displayTitle: "Varmeskab temperatur",
    frequencyDays: 1,
    group: "CCP",
    longDescription: "Varmeskabets temperatur kontrolleres dagligt for at sikre korrekt varmholdelse. Temperaturen skal holdes over 60 °C.",
    risk: {
      hazard: "Bakterievækst ved for lav temperatur.",
      criticalLimit: "Temperatur over 60 °C.",
      deviationTrigger: "Temperatur under 60 °C.",
      defaultCorrectiveAction: "Juster temperaturen, kontroller igen, vurdér fødevarer.",
      prefilledDeviationText: "Varmeskabets temperatur var for lav. Jeg justerer temperaturen og vurderer fødevarerne."
    }
  },
  {
    routineType: "varmeskab_rengoering",
    displayTitle: "Varmeskab rengøring",
    frequencyDays: 7,
    group: "GAG",
    longDescription: "Varmeskabet rengøres ugentligt, herunder hylder, vægge og tætninger.",
    risk: {
      hazard: "Krydskontaminering fra snavsede overflader.",
      criticalLimit: "Varmeskabet skal være rent.",
      deviationTrigger: "Synligt snavs eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Rengør varmeskabet grundigt.",
      prefilledDeviationText: "Varmeskabet var ikke tilstrækkeligt rent. Jeg rengør det grundigt."
    }
  },
  {
    routineType: "roegeovn_temperatur",
    displayTitle: "Røgeovn temperatur",
    frequencyDays: 1,
    group: "CCP",
    longDescription: "Røgeovnens temperatur kontrolleres dagligt for at sikre korrekt tilberedning.",
    risk: {
      hazard: "Utilstrækkelig tilberedning ved forkert temperatur.",
      criticalLimit: "Temperatur efter producentens anvisninger.",
      deviationTrigger: "Temperatur uden for anbefalede interval.",
      defaultCorrectiveAction: "Juster temperaturen, kontroller igen, vurdér fødevarer.",
      prefilledDeviationText: "Røgeovnens temperatur var ikke korrekt. Jeg justerer temperaturen og vurderer fødevarerne."
    }
  },
  {
    routineType: "roegeovn_rengoering",
    displayTitle: "Røgeovn rengøring",
    frequencyDays: 30,
    group: "GAG",
    longDescription: "Røgeovnen rengøres månedligt, herunder riste, vægge og røgkammer.",
    risk: {
      hazard: "Kontaminering og dårlig smag ved snavset ovn.",
      criticalLimit: "Røgeovnen skal være ren.",
      deviationTrigger: "Synligt snavs, sod eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Rengør røgeovnen grundigt.",
      prefilledDeviationText: "Røgeovnen var ikke tilstrækkeligt ren. Jeg rengør den grundigt."
    }
  },
  {
    routineType: "rasteskab_rengoering",
    displayTitle: "Rasteskab rengøring",
    frequencyDays: 30,
    group: "GAG",
    longDescription: "Rasteskabet rengøres månedligt, herunder hylder, vægge og tætninger.",
    risk: {
      hazard: "Krydskontaminering fra snavsede overflader.",
      criticalLimit: "Rasteskabet skal være rent.",
      deviationTrigger: "Synligt snavs eller mangelfuld rengøring.",
      defaultCorrectiveAction: "Rengør rasteskabet grundigt.",
      prefilledDeviationText: "Rasteskabet var ikke tilstrækkeligt rent. Jeg rengør det grundigt."
    }
  },
  {
    routineType: "udstyr_vedligeholdelse",
    displayTitle: "Udstyr vedligeholdelse",
    frequencyDays: 30,
    group: "GAG",
    longDescription: "Månedlig kontrol af at alt udstyr fungerer korrekt og er i god stand.",
    risk: {
      hazard: "Defekt udstyr kan føre til fødevaresikkerhedsproblemer.",
      criticalLimit: "Alt udstyr skal fungere korrekt.",
      deviationTrigger: "Defekt eller beskadiget udstyr.",
      defaultCorrectiveAction: "Reparer eller udskift defekt udstyr, dokumentér handling.",
      prefilledDeviationText: "Udstyr fungerer ikke korrekt. Jeg tager det ud af drift og arrangerer reparation/udskiftning."
    }
  },
  {
    routineType: "sporbarhed",
    displayTitle: "Sporbarhed",
    frequencyDays: 30,
    group: "LEGAL",
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

  // ─── LEGAL - ÅRLIGE ───────────────────────────────────────────────────────
  {
    routineType: "tilbagetraekning",
    displayTitle: "Tilbagetrækning",
    frequencyDays: 365,
    group: "LEGAL",
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
    frequencyDays: 365,
    group: "LEGAL",
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

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

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
  
  // Alias mapping
  const aliases = {
    // Nedkøling variants
    "nedkoeling": "nedkoeling",
    "nedkoling": "nedkoeling",
    "cooling": "nedkoeling",
    "cooling_control": "nedkoeling",
    "minimal_nedkoeling": "nedkoeling",
    
    // Opvarmning variants
    "opvarmning": "opvarmning",
    "varmebehandling": "opvarmning",
    "heating": "opvarmning",
    "reheating": "opvarmning",
    "reheating_control": "opvarmning",
    "minimal_opvarmning": "opvarmning",
    
    // Varemodtagelse variants
    "varemodtagelse": "varemodtagelse",
    "receiving": "varemodtagelse",
    "receiving_control": "varemodtagelse",
    "varemodtagelse_transport": "varemodtagelse",
    "minimal_varemodtagelse": "varemodtagelse",
    
    // Varmholdelse variants
    "varmholdelse": "varmholdelse",
    "hot_holding": "varmholdelse",
    "hot_holding_control": "varmholdelse",
    
    // Rengøring variants
    "rengoering": "rengoering",
    "rengoering_control": "rengoering",
    "cleaning": "rengoering",
    "cleaning_control": "rengoering",
    "minimal_rengoering": "rengoering",
    
    // Køleskab temperatur variants
    "koeleskab_temperatur": "koeleskab_temperatur",
    "koeleskab_temperaturmaaling": "koeleskab_temperatur",
    "fridge_temperature": "koeleskab_temperatur",
    "fridge_temperature_control": "koeleskab_temperatur",
    "cold_storage_control": "koeleskab_temperatur",
    
    // Fryser temperatur variants
    "fryser_temperatur": "fryser_temperatur",
    "fryser_temperaturmaaling": "fryser_temperatur",
    "freezer_temperature": "fryser_temperatur",
    "freezer_temperature_control": "fryser_temperatur",
    "freezer_storage_control": "fryser_temperatur",
    
    // Køleskab rengøring variants
    "koeleskab_rengoering": "koeleskab_rengoering",
    "fridge_cleaning": "koeleskab_rengoering",
    "fridge_cleaning_control": "koeleskab_rengoering",
    
    // Fryser rengøring variants
    "fryser_rengoering": "fryser_rengoering",
    "freezer_cleaning": "fryser_rengoering",
    "freezer_cleaning_control": "fryser_rengoering",
    
    // Opvaskemaskine variants
    "opvaskemaskine_skyllevand": "opvaskemaskine_skyllevand",
    "opvaskemaskine_skyllevandstemperatur": "opvaskemaskine_skyllevand",
    "opvaskemaskine": "opvaskemaskine_skyllevand",
    "dishwasher": "opvaskemaskine_skyllevand",
    "dishwasher_control": "opvaskemaskine_skyllevand",
    "dishwasher_rinse_temperature_control": "opvaskemaskine_skyllevand",
    "water_control": "opvaskemaskine_skyllevand",
    
    // 3-timers regel variants
    "tre_timers_regel": "tre_timers_regel",
    "3_timers_regel": "tre_timers_regel",
    "3_timer_regel": "tre_timers_regel",
    "salg_udenfor_koel": "tre_timers_regel",
    
    // Adskillelse variants
    "adskillelse": "adskillelse",
    "separation": "adskillelse",
    "separation_control": "adskillelse",
    
    // Sporbarhed variants
    "sporbarhed": "sporbarhed",
    "traceability": "sporbarhed",
    "traceability_control": "sporbarhed",
    
    // Tilbagetrækning variants
    "tilbagetraekning": "tilbagetraekning",
    "tilbagetrækning": "tilbagetraekning",
    "withdrawal": "tilbagetraekning",
    "withdrawal_control": "tilbagetraekning",
    
    // Personlig hygiejne variants
    "personlig_hygiejne": "personlig_hygiejne",
    "personal_hygiene": "personlig_hygiejne",
    "personal_hygiene_control": "personlig_hygiejne",
    
    // Årlig revision variants
    "aarlig_revision": "aarlig_revision",
    "årlig_revision": "aarlig_revision",
    "annual_revision": "aarlig_revision",
    "annual_revision_control": "aarlig_revision",
    
    // Friture rengøring variants
    "friture_rengoering": "friture_rengoering",
    "fryer_cleaning": "friture_rengoering",
    "fryer_cleaning_control": "friture_rengoering",

    // Pålægsmaskine rengøring variants
    "paalaegsmaskine_rengoering": "paalaegsmaskine_rengoering",
    "paalaegsmaskine_cleaning": "paalaegsmaskine_rengoering",
    "slicer_cleaning": "paalaegsmaskine_rengoering",
    "slicing_machine_cleaning": "paalaegsmaskine_rengoering",

    // Ismaskine / softicemaskine rengøring variants
    "softice_maskine_rengoering": "softice_maskine_rengoering",
    "softice_machine_cleaning": "softice_maskine_rengoering",
    "ice_machine_cleaning": "softice_maskine_rengoering",
    "ismaskine_rengoering": "softice_maskine_rengoering",
    
    // Køkken rengøring variants
    "koekken_rengoering": "koekken_rengoering",
    "kitchen_cleaning": "koekken_rengoering",
    
    // Walk-in variants
    "walkin_koeler_temperatur": "walkin_koeler_temperatur",
    "walkin_fryser_temperatur": "walkin_fryser_temperatur",
    "walkin_koeler_rengoering": "walkin_koeler_rengoering",
    "walkin_fryser_rengoering": "walkin_fryser_rengoering"
  };
  
  return aliases[normalized] || normalized;
}

// ============================================================================
// CANONICAL FIELD BUILDERS
// ============================================================================

function buildCanonicalTaskKey(routineType, unitId) {
  const normalizedRoutineType = normalizeRoutineType(routineType);
  const normalizedUnitId = String(unitId || "default").trim();
  
  if (!normalizedRoutineType) return "";
  
  if (normalizedUnitId === "default" || !normalizedUnitId) {
    return normalizedRoutineType;
  }
  
  return `${normalizedRoutineType}__${normalizedUnitId}`;
}

function buildDisplayTitle(routineType, unitId, unitName) {
  const normalizedRoutineType = normalizeRoutineType(routineType);
  const routine = CANONICAL_ROUTINES.find(r => r.routineType === normalizedRoutineType);
  
  if (!routine) return "";
  
  const normalizedUnitName = String(unitName || "").trim();
  
  if (!normalizedUnitName || normalizedUnitName === "default") {
    return routine.displayTitle;
  }
  
  return `${routine.displayTitle} · ${normalizedUnitName}`;
}

function buildCanonicalRoutineFields(input) {
  if (!input || typeof input !== "object") return null;
  
  const routineType = input.routineType || input.controlType || input.taskKey || input.templateKey || "";
  const normalizedRoutineType = normalizeRoutineType(routineType);
  
  if (!normalizedRoutineType) return null;
  
  const routine = CANONICAL_ROUTINES.find(r => r.routineType === normalizedRoutineType);
  
  if (!routine) return null;
  
  const unitId = String(input.unitId || input.equipmentId || input.equipmentUnit || "default").trim();
  const unitName = String(input.unitName || input.equipmentName || "").trim();
  
  const canonicalTaskKey = buildCanonicalTaskKey(routine.routineType, unitId);
  const displayTitle = buildDisplayTitle(routine.routineType, unitId, unitName);
  
  return {
    routineType: routine.routineType,
    unitId,
    unitName,
    canonicalTaskKey,
    title: routine.displayTitle,
    displayTitle,
    longDescription: routine.longDescription,
    frequencyDays: routine.frequencyDays,
    group: routine.group,
    risk: {
      hazard: routine.risk.hazard,
      criticalLimit: routine.risk.criticalLimit,
      deviationTrigger: routine.risk.deviationTrigger,
      defaultCorrectiveAction: routine.risk.defaultCorrectiveAction,
      prefilledDeviationText: routine.risk.prefilledDeviationText
    },
    active: true,
    isActive: true,
    archived: false
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  CANONICAL_ROUTINES,
  normalizeRoutineType,
  buildCanonicalTaskKey,
  buildDisplayTitle,
  buildCanonicalRoutineFields
};
