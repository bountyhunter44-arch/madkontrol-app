// ROUTINE_TEXTS: Central source of truth for routine guide texts
// longGuide bruges KUN i rutiner.html fold-ud, haccpShort bruges KUN i rapporter.html HACCP-listen

export const ROUTINE_TEXTS = {
    nedkoeling: {
        longGuide: `Formål:\nNedkøling kontrolleres for at sikre, at varmebehandlede fødevarer hurtigt kommer gennem temperaturzonen, hvor bakterier kan vokse.\n\nRisiko:\nLangsom nedkøling kan give vækst af sygdomsfremkaldende bakterier.\n\nKontrol:\nMål starttemperatur og starttid. Mål sluttemperatur og sluttid. Brug egnet metode som blæsekøler, isbad, flade kantiner, små portioner eller omrøring.\n\nAcceptkriterie:\nFødevaren skal nedkøles fra ca. +65 °C til under +10 °C på højst 4 timer.\n\nUndervejs:\nHvis systemet viser gul risiko, bør temperaturen kontrolleres og der bør handles med det samme.\n\nKorrigerende handling:\nDel maden i mindre portioner, brug flade kantiner, isbad eller blæsekøler. Kassér maden hvis sikker nedkøling ikke kan dokumenteres.\n\nDokumentation:\nStarttemperatur, sluttemperatur, starttid, sluttid, metode, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Nedkøling af fødevarer\nRisiko: Bakterievækst ved langsom nedkøling.\nGrænse: Fra ca. +65 °C til under +10 °C på højst 4 timer.\nHandling: Del i mindre portioner, brug effektiv køling eller kassér hvis sikkerhed ikke kan dokumenteres.`
    },
    opvarmning: {
        longGuide: `Formål:\nOpvarmning kontrolleres for at sikre, at fødevaren bliver tilstrækkeligt varmebehandlet.\n\nRisiko:\nFor lav opvarmning kan betyde, at bakterier overlever.\n\nKontrol:\nMål kernetemperatur i det tykkeste eller koldeste punkt.\n\nAcceptkriterie:\nFødevaren skal opvarmes til mindst +75 °C i centrum, medmindre virksomheden har dokumenteret en anden sikker proces.\n\nKorrigerende handling:\nFortsæt opvarmning til grænsen er nået. Hvis fødevaren ikke kan opvarmes sikkert, kassér den.\n\nDokumentation:\nTemperatur, vare, tidspunkt, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Opvarmning\nRisiko: Overlevende bakterier ved utilstrækkelig opvarmning.\nGrænse: Mindst +75 °C i centrum, medmindre anden sikker proces er dokumenteret.\nHandling: Fortsæt opvarmning eller kassér ved usikkerhed.`
    },
    varmholdelse: {
        longGuide: `Formål:\nVarmholdelse kontrolleres for at sikre, at færdigtilberedte fødevarer holdes varme nok indtil servering.\n\nRisiko:\nFor lav temperatur kan give bakterievækst.\n\nKontrol:\nMål temperaturen i fødevaren eller i varmholdelsesudstyret efter virksomhedens procedure.\n\nAcceptkriterie:\nVarmholdte fødevarer skal holdes ved mindst +65 °C.\n\nKorrigerende handling:\nGenopvarm til sikker temperatur, justér udstyr eller kassér hvis fødevaren har været for længe under grænsen.\n\nDokumentation:\nTemperatur, tidspunkt, vare, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Varmholdelse\nRisiko: Bakterievækst ved for lav temperatur.\nGrænse: Mindst +65 °C.\nHandling: Genopvarm, justér udstyr eller kassér ved usikkerhed.`
    },
    tre_timers_regel: {
        longGuide: `Formål:\n3-timers-reglen bruges ved fødevarer, der kortvarigt står uden aktiv køl eller varme.\n\nRisiko:\nLetfordærvelige fødevarer kan blive usikre, hvis de står for længe ved stuetemperatur.\n\nKontrol:\nRegistrér hvornår fødevaren stilles frem, hvornår den senest skal fjernes, og hvornår den faktisk fjernes.\n\nAcceptkriterie:\nFødevarer må højst stå uden temperaturstyring i 3 timer.\n\nKorrigerende handling:\nFjern fødevaren straks når tiden er udløbet. Fødevaren må ikke sættes tilbage på køl til senere brug.\n\nDokumentation:\nVare, starttid, fjernestid, faktisk fjernet tid, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: 3-timers regel\nRisiko: Bakterievækst uden temperaturstyring.\nGrænse: Højst 3 timer uden køl/varme.\nHandling: Fjern og kassér/brug straks. Må ikke sættes tilbage på køl.`
    },
    varemodtagelse: {
        longGuide: `Formål:\nVaremodtagelse kontrolleres for at sikre, at varer modtages i korrekt stand og temperatur.\n\nRisiko:\nVarer kan være for varme, beskadigede, for gamle eller forurenede.\n\nKontrol:\nTjek temperatur på køle- og frostvarer, emballage, holdbarhed, renhed og leverandørforhold.\n\nAcceptkriterie:\nKølevarer skal modtages kolde og frostvarer frosne. Emballage skal være intakt og varen må ikke være overskredet.\n\nKorrigerende handling:\nAfvis varen, kontakt leverandør eller registrér afvigelse.\n\nDokumentation:\nVaretype, temperatur ved behov, leverandør, kommentar, foto og ansvarlig.`,
        haccpShort: `Kontrolpunkt: Varemodtagelse\nRisiko: Modtagelse af usikre eller for varme varer.\nGrænse: Varer skal modtages i korrekt temperatur og stand.\nHandling: Afvis vare eller registrér afvigelse.`
    },
    koeleskab_temperatur: {
        longGuide: `Formål:\nKøleskabstemperatur kontrolleres for at sikre korrekt opbevaring af kølevarer.\n\nRisiko:\nFor høj temperatur kan give vækst af bakterier og forkorte holdbarhed.\n\nKontrol:\nMål eller aflæs temperaturen i køleskabet.\n\nAcceptkriterie:\nKøleskab skal normalt holdes ved højst +5 °C, medmindre varen eller proceduren kræver andet.\n\nKorrigerende handling:\nJustér termostat, flyt varer til andet køl, kontroller dør/pakning og opret afvigelse hvis grænsen er overskredet.\n\nDokumentation:\nTemperatur, udstyr, tidspunkt, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Køleskabstemperatur\nRisiko: Bakterievækst ved for høj køletemperatur.\nGrænse: Normalt højst +5 °C.\nHandling: Justér køl, flyt varer og registrér afvigelse.`
    },
    fryser_temperatur: {
        longGuide: `Formål:\nFrysertemperatur kontrolleres for at sikre, at frostvarer opbevares korrekt.\n\nRisiko:\nFor høj temperatur kan give optøning, kvalitetsforringelse og risiko ved senere brug.\n\nKontrol:\nMål eller aflæs temperaturen i fryseren.\n\nAcceptkriterie:\nFrostvarer bør opbevares ved ca. -18 °C eller koldere.\n\nKorrigerende handling:\nKontroller dør, pakning, isdannelse og belastning. Flyt varer ved behov og registrér afvigelse.\n\nDokumentation:\nTemperatur, udstyr, tidspunkt, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Frysertemperatur\nRisiko: Optøning og kvalitetsforringelse.\nGrænse: Ca. -18 °C eller koldere.\nHandling: Kontroller udstyr, flyt varer og registrér afvigelse.`
    },
    walkin_koeler_temperatur: {
        longGuide: `Formål:\nWalk-in kølerum kontrolleres separat, fordi der ofte opbevares store mængder fødevarer.\n\nRisiko:\nFor høj rumtemperatur kan påvirke mange varer på én gang.\n\nKontrol:\nAflæs rumtemperatur og kontroller dør, pakninger, luftcirkulation og om varer spærrer for kølingen.\n\nAcceptkriterie:\nWalk-in køl skal normalt holdes ved højst +5 °C.\n\nKorrigerende handling:\nLuk dør, fjern blokering, justér køling, flyt varer og opret afvigelse.\n\nDokumentation:\nTemperatur, rum/navn, tidspunkt, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Walk-in køl\nRisiko: Mange varer påvirkes ved for høj temperatur.\nGrænse: Normalt højst +5 °C.\nHandling: Justér køling, flyt varer og registrér afvigelse.`
    },
    walkin_fryser_temperatur: {
        longGuide: `Formål:\nWalk-in fryserum kontrolleres separat, fordi der ofte opbevares store mængder frostvarer.\n\nRisiko:\nFor høj temperatur eller isdannelse kan påvirke fødevaresikkerhed og kvalitet.\n\nKontrol:\nAflæs temperatur, kontroller dør, pakninger, isdannelse og luftcirkulation.\n\nAcceptkriterie:\nWalk-in frys bør holdes ved ca. -18 °C eller koldere.\n\nKorrigerende handling:\nLuk dør, fjern isproblemer, kontroller udstyr, flyt varer og opret afvigelse.\n\nDokumentation:\nTemperatur, rum/navn, tidspunkt, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Walk-in frys\nRisiko: Optøning og kvalitetsforringelse.\nGrænse: Ca. -18 °C eller koldere.\nHandling: Kontroller udstyr, flyt varer og registrér afvigelse.`
    },
    opvaskemaskine_skyllevand: {
        longGuide: `Formål:\nSkyllevandstemperatur kontrolleres for at sikre effektiv hygiejne ved maskinopvask.\n\nRisiko:\nFor lav skylletemperatur kan give utilstrækkelig rengøring og desinfektion.\n\nKontrol:\nAflæs skyllevandstemperatur eller brug egnet målemetode efter virksomhedens procedure.\n\nAcceptkriterie:\nSkyllevand skal være tilstrækkeligt varmt til effektiv opvask efter maskinens og virksomhedens procedure.\n\nKorrigerende handling:\nStop brug, tjek kemi, temperatur, servicebehov og vask om nødvendigt op igen.\n\nDokumentation:\nTemperatur, maskine, tidspunkt, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Opvaskemaskine skyllevand\nRisiko: Utilstrækkelig rengøring/desinfektion.\nGrænse: Skal følge maskinens og virksomhedens procedure.\nHandling: Stop brug, korrigér og vask om nødvendigt om.`
    },
    blaesekoeler_temperatur: {
        longGuide: `Formål:\nBlæsekølerens funktion kontrolleres, når udstyret anvendes, for at sikre effektiv nedkøling.\n\nRisiko:\nHvis blæsekøleren ikke fungerer korrekt, kan nedkølingen blive for langsom.\n\nKontrol:\nKontroller display, program, lufttemperatur, spydfunktion og eventuelt verificering med eget termometer.\n\nVigtigt:\nUnder +5 °C inden for 90 minutter er en intern skærpet standard. Det er ikke et lovkrav.\n\nLovkrav/generel regel:\nNedkøling skal kunne dokumenteres fra ca. +65 °C til under +10 °C på højst 4 timer.\n\nIntern skærpet standard:\nVed Cook-Chill eller længere holdbarhed kan virksomheden vælge mål om under +5 °C inden for 90 minutter.\n\nKorrigerende handling:\nTjek overfyldning, lagtykkelse, filter/kondensator, spyd og program. Registrér afvigelse ved fejl.\n\nDokumentation:\nVaretype/test, starttemperatur, sluttid/sluttemperatur, metode, spyd/verificering og ansvarlig.`,
        haccpShort: `Kontrolpunkt: Blæsekøler\nRisiko: For langsom nedkøling ved udstyrsfejl.\nGrænse: Intern: ≤5 °C på 90 min. Generel nedkøling: ≤10 °C på 4 timer.\nHandling: Tjek fyldning, udstyr, spyd og registrér afvigelse.`
    },
    blaesekoeler_rengoering: {
        longGuide: `Formål:\nBlæsekøleren rengøres for at undgå forurening, biofilm og nedsat køleevne.\n\nRisiko:\nSnavs, madrester og biofilm kan sprede bakterier med luftstrømmen. Tilstoppede filtre kan gøre nedkølingen langsommere.\n\nKontrol:\nRengør indvendige flader, hylder, skinner, dræn, bund, pakninger og luftfilter/kondensator.\n\nSpyd:\nKernetemperatur-spyd skal rengøres/desinficeres før og efter brug og kontrolleres visuelt for skader.\n\nKorrigerende handling:\nRengør igen, fjern ophobning, tjek filter/kondensator og opret afvigelse hvis udstyret ikke kan bruges sikkert.\n\nDokumentation:\nKommentar, foto ved behov, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Blæsekøler rengøring\nRisiko: Forurening, biofilm og nedsat køleevne.\nGrænse: Udstyret skal være rent og funktionsdygtigt.\nHandling: Rengør igen, tjek filter/spyd og registrér afvigelse.`
    },
    walkin_koeler_rengoering: {
        longGuide: `Formål:\nWalk-in kølerum rengøres for at sikre hygiejnisk opbevaring af store mængder kølevarer.\n\nRisiko:\nSnavs, kondens, spild og biofilm kan forurene varer og overflader.\n\nKontrol:\nKontroller gulv, hylder, vægge, dørpakninger, håndtag, afløb og kondens.\n\nAcceptkriterie:\nRummet skal være rent, uden spild, lugt, biofilm eller ophobning.\n\nKorrigerende handling:\nRengør igen, fjern spild, kontroller afløb/kondens og registrér afvigelse.\n\nDokumentation:\nKommentar, foto ved behov, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Walk-in køl rengøring\nRisiko: Forurening af varer og overflader.\nGrænse: Rummet skal være rent og uden ophobning.\nHandling: Rengør igen og registrér afvigelse.`
    },
    walkin_fryser_rengoering: {
        longGuide: `Formål:\nWalk-in fryserum rengøres for at sikre orden, renhed og stabil drift.\n\nRisiko:\nSpild, emballagerester og isdannelse kan påvirke hygiejne, adgang og drift.\n\nKontrol:\nKontroller gulv, hylder, vægge, dørpakninger, isdannelse og orden.\n\nAcceptkriterie:\nRummet skal være rent, ryddeligt og uden unormal isdannelse.\n\nKorrigerende handling:\nRengør igen, fjern is/spild, kontroller dør/pakning og registrér afvigelse.\n\nDokumentation:\nKommentar, foto ved behov, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Walk-in frys rengøring\nRisiko: Forurening, isdannelse og driftsproblemer.\nGrænse: Rummet skal være rent og uden unormal isdannelse.\nHandling: Rengør/fjern is og registrér afvigelse.`
    },
    allergener: {
        longGuide: `Formål:\nAllergenkontrol sikrer, at gæster ikke udsættes for allergener ved fejl.\n\nRisiko:\nForkert information eller krydskontaminering kan give alvorlige allergiske reaktioner.\n\nKontrol:\nTjek mærkning, opskrifter, råvarer, adskillelse, redskaber og personalets kendskab.\n\nAcceptkriterie:\nAllergenoplysninger skal være korrekte og tilgængelige. Allergener skal håndteres uden krydskontaminering.\n\nKorrigerende handling:\nStop servering/salg ved usikkerhed, ret information, adskil råvarer og opret afvigelse.\n\nDokumentation:\nKontrol, kommentar, foto ved behov, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Allergener\nRisiko: Allergisk reaktion pga. fejl eller krydskontaminering.\nGrænse: Oplysninger og håndtering skal være korrekte.\nHandling: Stop salg/servering ved usikkerhed og ret forholdet.`
    },
    adskillelse: {
        longGuide: `Formål:\nAdskillelse kontrolleres for at undgå krydskontaminering mellem rå og spiseklare fødevarer.\n\nRisiko:\nBakterier fra råvarer kan overføres til færdige fødevarer.\n\nKontrol:\nTjek opbevaring, arbejdsområder, redskaber, skærebrætter og arbejdsgange.\n\nAcceptkriterie:\nRå og spiseklare fødevarer skal holdes adskilt i opbevaring og produktion.\n\nKorrigerende handling:\nFlyt varer, rengør/desinficér, kassér forurenede varer og opret afvigelse.\n\nDokumentation:\nKommentar, foto ved behov, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Adskillelse\nRisiko: Krydskontaminering.\nGrænse: Rå og spiseklare varer skal holdes adskilt.\nHandling: Flyt, rengør/desinficér eller kassér ved forurening.`
    },
    sporbarhed: {
        longGuide: `Formål:\nSporbarhed sikrer, at virksomheden kan finde leverandør, vare og parti ved problemer.\n\nRisiko:\nManglende sporbarhed gør det svært at tilbagekalde usikre varer.\n\nKontrol:\nTjek faktura, følgeseddel, batch/lot, leverandør og datomærkning.\n\nAcceptkriterie:\nVirksomheden skal kunne spore varer ét led tilbage og ét led frem hvor relevant.\n\nKorrigerende handling:\nFremskaf dokumentation, mærk varer korrekt eller tag varer ud af brug ved usikkerhed.\n\nDokumentation:\nLeverandør, vare, parti/batch, dato, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Sporbarhed\nRisiko: Manglende mulighed for tilbagekaldelse.\nGrænse: Varer skal kunne spores.\nHandling: Fremskaf dokumentation eller tag varen ud af brug.`
    },
    tilbagetraekning: {
        longGuide: `Formål:\nTilbagetrækning kontrolleres for at sikre, at virksomheden kan reagere hurtigt ved usikre varer.\n\nRisiko:\nUsikre fødevarer kan nå kunder eller blive brugt i produktionen.\n\nKontrol:\nTjek procedure, kontaktliste, leverandørinformation og intern håndtering.\n\nAcceptkriterie:\nVirksomheden skal kunne identificere, stoppe og fjerne berørte varer.\n\nKorrigerende handling:\nStop brug/salg, isolér varer, kontakt leverandør/myndighed ved behov og dokumentér handlingen.\n\nDokumentation:\nVare, parti, årsag, handling, ansvarlig og tidspunkt.`,
        haccpShort: `Kontrolpunkt: Tilbagetrækning\nRisiko: Usikre varer bruges eller sælges.\nGrænse: Berørte varer skal kunne stoppes og fjernes.\nHandling: Stop brug/salg, isolér og dokumentér.`
    },
    aarlig_revision: {
        longGuide: `Formål:\nÅrlig revision sikrer, at egenkontrolprogrammet stadig passer til virksomhedens drift.\n\nRisiko:\nÆndringer i drift, udstyr, varer eller medarbejdere kan gøre programmet forældet.\n\nKontrol:\nGennemgå rutiner, risici, udstyr, varetyper, rengøringsplan, afvigelser og dokumentation.\n\nAcceptkriterie:\nProgrammet skal være opdateret og dækkende for den aktuelle drift.\n\nKorrigerende handling:\nOpdater procedurer, frekvenser, ansvar og instruktioner.\n\nDokumentation:\nDato, ændringer, ansvarlig og konklusion.`,
        haccpShort: `Kontrolpunkt: Årlig revision\nRisiko: Forældet egenkontrolprogram.\nGrænse: Programmet skal passe til aktuel drift.\nHandling: Opdater program, rutiner og ansvar.`
    },
    opbevaring: {
        longGuide: `Formål:\nOpbevaring kontrolleres for at sikre orden, korrekt adskillelse og passende temperatur.\n\nRisiko:\nForkert opbevaring kan give forurening, fejltemperatur eller brug af for gamle varer.\n\nKontrol:\nTjek datomærkning, adskillelse, emballage, orden, FIFO og temperaturforhold.\n\nAcceptkriterie:\nVarer skal være korrekt mærket, beskyttet og opbevaret efter krav.\n\nKorrigerende handling:\nFlyt varer, kassér for gamle eller usikre varer og opret afvigelse.\n\nDokumentation:\nKommentar, foto ved behov, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Opbevaring\nRisiko: Forurening, fejltemperatur eller for gamle varer.\nGrænse: Varer skal opbevares korrekt og være beskyttede.\nHandling: Flyt, mærk eller kassér varer ved fejl.`
    },
    personlig_hygiejne: {
        longGuide: `Formål:\nPersonlig hygiejne kontrolleres for at mindske risiko for forurening fra medarbejdere.\n\nRisiko:\nDårlig håndhygiejne, sygdom eller forkert beklædning kan forurene fødevarer.\n\nKontrol:\nTjek håndvask, arbejdsbeklædning, sårbeskyttelse, sygdomsprocedure og smykker.\n\nAcceptkriterie:\nMedarbejdere skal følge virksomhedens hygiejneprocedure.\n\nKorrigerende handling:\nInstruktér medarbejder, skift beklædning, vask hænder eller fjern medarbejder fra fødevarearbejde ved sygdom.\n\nDokumentation:\nKommentar, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Personlig hygiejne\nRisiko: Forurening fra medarbejdere.\nGrænse: Hygiejneprocedure skal følges.\nHandling: Korrigér adfærd og dokumentér afvigelse.`
    },
    paalaegsmaskine_rengoering: {
        longGuide: `Om rutinen:\nPålægsmaskiner kommer i direkte kontakt med spiseklare fødevarer og kan opsamle madrester, fedt, belægninger og biofilm. Rutinen sikrer, at maskinen rengøres og desinficeres korrekt, så der ikke sker krydskontaminering eller forurening af fødevarer.\n\nHvad skal kontrolleres:\n- Kniv, slæde, afskærmning og fødevarekontaktflader er rene.\n- Der er ikke synlige madrester, fedt, belægninger eller snavs.\n- Aftagelige dele er rengjort og samlet korrekt.\n- Rengørings- og desinfektionsmiddel er brugt efter anvisning.\n- Området omkring maskinen er rent.\n- Maskinen er sikker at bruge efter rengøring.\n\nSådan udføres kontrollen:\n1. Sluk maskinen og følg sikkerhedsproceduren.\n2. Afmonter aftagelige dele efter producentens anvisning.\n3. Fjern synlige madrester og belægninger.\n4. Rengør kniv, slæde, afskærmning og kontaktflader grundigt.\n5. Desinficér fødevarekontaktflader efter anvisning.\n6. Lad dele tørre eller aftør efter virksomhedens procedure.\n7. Saml maskinen korrekt igen.\n8. Kontrollér visuelt at maskinen er ren og klar til brug.\n9. Dokumentér kontrollen i egenkontrollen.\n\nAcceptkriterier:\n- Ingen synlige madrester, fedt, belægninger eller snavs.\n- Alle fødevarekontaktflader er rengjorte og desinficerede.\n- Maskinen er samlet korrekt.\n- Rengøringen er udført efter plan og producentens anvisning.\n\nDokumentation:\nRegistrér om rengøringen er udført, tidspunkt, medarbejder og eventuel bemærkning.\n\nHvis noget ikke er i orden:\n- Stop brug af maskinen.\n- Rengør og desinficér igen.\n- Kassér fødevarer hvis der er risiko for forurening.\n- Kontakt ansvarlig leder ved gentagne problemer.\n- Opret afvigelse og dokumentér korrigerende handling.\n\nStandard afvigelsestekster:\n- Pålægsmaskinen var ikke rengjort efter plan.\n- Der blev fundet synlige madrester, fedt eller belægninger.\n- Fødevarekontaktflader var ikke tilstrækkeligt rengjorte/desinficerede.\n- Maskinen var ikke samlet korrekt efter rengøring.\n- Der var risiko for forurening af spiseklare fødevarer.\n\nStandard korrigerende handlinger:\n- Maskinen blev stoppet og rengjort/desinficeret igen.\n- Berørte fødevarer blev kasseret.\n- Medarbejder blev instrueret i korrekt rengøringsprocedure.\n- Rengøringsplanen blev gennemgået og justeret.\n- Ansvarlig leder blev informeret.`,
        haccpShort: `Kontrolpunkt: Pålægsmaskine rengøring\nRisiko: Krydskontaminering og forurening af spiseklare fødevarer ved madrester, fedt, belægninger eller biofilm.\nGrænse: Maskinen skal være ren, desinficeret og samlet korrekt.\nHandling: Stop brug, rengør/desinficér igen, kassér fødevarer ved risiko og dokumentér afvigelse.`
    },
    softice_maskine_rengoering: {
        longGuide: `Om rutinen:\nIs- og softicemaskiner kan opbygge belægninger, mælkesten, biofilm og rester fra blandinger. Rutinen sikrer, at maskinen rengøres og desinficeres efter virksomhedens plan og producentens anvisning, så der ikke sker vækst eller forurening af fødevarer.\n\nHvad skal kontrolleres:\n- Maskinen er tømt for rester efter behov.\n- Kontaktflader, dyser, tappetud, beholdere og aftagelige dele er rengjorte.\n- Der er ikke synlig snavs, belægning, slim, mug eller produktrester.\n- Rengørings- og desinfektionsmiddel er brugt efter anvisning.\n- Dele er samlet korrekt efter rengøring.\n- Området omkring maskinen er rent.\n\nSådan udføres kontrollen:\n1. Stop maskinen efter virksomhedens procedure.\n2. Tøm rester efter behov.\n3. Afmonter aftagelige dele efter producentens anvisning.\n4. Rengør dele og kontaktflader grundigt.\n5. Desinficér efter anvisning og lad midlet virke korrekt.\n6. Skyl kun hvis produktets brugsanvisning kræver det.\n7. Saml maskinen igen.\n8. Kontrollér visuelt at maskinen er ren og klar til brug.\n9. Dokumentér kontrollen i egenkontrollen.\n\nAcceptkriterier:\n- Ingen synlig snavs, belægning, slim, mug eller produktrester.\n- Alle fødevarekontaktflader er rengjorte og desinficerede.\n- Maskinen er samlet korrekt.\n- Rengøring er udført efter plan og producentens anvisning.\n\nDokumentation:\nRegistrér om rengøringen er udført, tidspunkt, medarbejder og eventuel bemærkning.\n\nHvis noget ikke er i orden:\n- Stop brug af maskinen.\n- Rengør og desinficér igen.\n- Kassér is/softice eller blanding hvis der er risiko for forurening.\n- Kontakt ansvarlig leder ved gentagne problemer.\n- Opret afvigelse og dokumentér korrigerende handling.\n\nStandard afvigelsestekster:\n- Is-/softicemaskinen var ikke rengjort efter plan.\n- Der blev fundet synlig snavs, belægning eller produktrester.\n- Dele var ikke korrekt samlet efter rengøring.\n- Der var risiko for forurening af produktet.\n\nStandard korrigerende handlinger:\n- Maskinen blev stoppet og rengjort/desinficeret igen.\n- Berørt produkt blev kasseret.\n- Medarbejder blev instrueret i korrekt rengøringsprocedure.\n- Rengøringsplanen blev gennemgået og justeret.\n- Ansvarlig leder blev informeret.`,
        haccpShort: `Kontrolpunkt: Ismaskine / softicemaskine rengøring\nRisiko: Vækst og forurening fra belægninger, mælkesten, biofilm eller produktrester.\nGrænse: Maskinen skal være ren, desinficeret og samlet korrekt.\nHandling: Stop brug, rengør/desinficér igen, kassér produkt ved risiko og dokumentér afvigelse.`
    },
    // Generisk fallback for rengøring (alle templateKey der indeholder "rengoering")
    _generic_rengoering: {
        longGuide: `Formål:\nRengøring kontrolleres for at sikre, at udstyr og områder ikke forurener fødevarer.\n\nRisiko:\nMangelfuld rengøring kan give bakterievækst, krydskontaminering, biofilm og skadedyrsrisiko.\n\nKontrol:\nKontroller synlig renhed, kontaktflader, hjørner, kanter, pakninger, håndtag og områder hvor snavs kan samle sig.\n\nAcceptkriterie:\nOmrådet eller udstyret skal fremstå rent og klar til brug.\n\nKorrigerende handling:\nRengør igen, desinficér ved behov, tag udstyr ud af brug og opret afvigelse ved gentagne problemer.\n\nDokumentation:\nKommentar, foto ved behov, ansvarlig og eventuel afvigelse.`,
        haccpShort: `Kontrolpunkt: Rengøring\nRisiko: Forurening og krydskontaminering.\nGrænse: Udstyr/område skal være rent før brug.\nHandling: Rengør igen, desinficér og registrér afvigelse.`
    },
    // Fælles fallback for alle andre
    _fallback: {
        longGuide: `Formål:\nDenne kontrol hjælper virksomheden med at dokumentere, at egenkontrollen udføres korrekt.\n\nKontrol:\nFølg virksomhedens procedure og noter afvigelser.\n\nAfvigelse:\nHvis noget ikke er i orden, opret afvigelse og beskriv korrigerende handling.\n\nDokumentation:\nGem kommentar, foto eller måling hvor relevant.`,
        haccpShort: `Kontrolpunkt: Egenkontrol\nRisiko: Manglende dokumentation eller manglende kontrol.\nGrænse: Virksomhedens procedure skal følges.\nHandling: Opret afvigelse og korriger forholdet.`
    }
};

/**
 * Get routine text by task and type
 * @param {Object} task - Task object with templateKey or routineType
 * @param {string} type - 'longGuide' or 'haccpShort'
 * @returns {string} The routine text
 */
export function getRoutineText(task, type = 'longGuide') {
    const templateKey = task?.templateKey || task?.routineType || '';
    
    // Check for exact match
    if (ROUTINE_TEXTS[templateKey]) {
        return ROUTINE_TEXTS[templateKey][type];
    }
    
    // Check for generic cleaning fallback
    if (templateKey.includes('rengoering')) {
        return ROUTINE_TEXTS._generic_rengoering[type];
    }
    
    // Return fallback
    return ROUTINE_TEXTS._fallback[type];
}

/**
 * Humanize template key for display
 * @param {string} key - Template key like "koeleskab_temperatur"
 * @returns {string} Human readable name like "Køleskab temperatur"
 */
export function humanizeTemplateKey(key) {
    if (!key) return '';
    
    const humanNames = {
        nedkoeling: 'Nedkøling',
        opvarmning: 'Opvarmning',
        varmholdelse: 'Varmholdelse',
        tre_timers_regel: '3-timers regel',
        varemodtagelse: 'Varemodtagelse',
        koeleskab_temperatur: 'Køleskab temperatur',
        fryser_temperatur: 'Fryser temperatur',
        walkin_koeler_temperatur: 'Walk-in køl temperatur',
        walkin_fryser_temperatur: 'Walk-in frys temperatur',
        opvaskemaskine_skyllevand: 'Opvaskemaskine skyllevand',
        blaesekoeler_temperatur: 'Blæsekøler temperatur',
        blaesekoeler_rengoering: 'Blæsekøler rengøring',
        paalaegsmaskine_rengoering: 'Pålægsmaskine rengøring',
        softice_maskine_rengoering: 'Ismaskine / softicemaskine rengøring',
        walkin_koeler_rengoering: 'Walk-in køl rengøring',
        walkin_fryser_rengoering: 'Walk-in frys rengøring',
        allergener: 'Allergener',
        adskillelse: 'Adskillelse',
        sporbarhed: 'Sporbarhed',
        tilbagetraekning: 'Tilbagetrækning',
        aarlig_revision: 'Årlig revision',
        opbevaring: 'Opbevaring',
        personlig_hygiejne: 'Personlig hygiejne'
    };
    
    if (humanNames[key]) {
        return humanNames[key];
    }
    
    // Fallback: capitalize and replace underscores
    return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
