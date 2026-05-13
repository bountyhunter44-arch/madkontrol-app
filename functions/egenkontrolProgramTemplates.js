"use strict";

const GLOBAL_EGENKONTROL_PROGRAM_TEMPLATES = [
  {
    key: "adskillelse",
    title: "Egenkontrolprogram, adskillelse",
    sortOrder: 10,
    introText: `Adskillelse

For at sikre, at der ikke sker krydssmitte med sygdomsfremkaldende bakterier mellem forskellige fødevarer, skal der ske adskillelse af grøntsager, råt kød, færdiglavede fødevarer m.m. under produktionen og oplagringen.

Dette gøres blandt andet ved:
• at rengøre knive, skærebrætter, bordplader og snittemaskiner ved skift mellem håndtering af fødevarer.
• at anvende forskellige områder i køkkenet og skærebrætter til de forskellige typer af produkter.
• at placere fødevarerne tildækket og adskilt.

Kontroller løbende, at fødevarerne holdes adskilte under produktion og opbevaring.

Ved fejl:
Vurder om varen kan anvendes ved fx efterfølgende opvarmning, eller kasser varen.`,
    fields: [
      {
        key: "separation_storage",
        label: "Hvordan adskilles fødevarer i køleskabe (beskriv eller tag billede)*",
        type: "textarea",
        required: true
      },
      {
        key: "separation_storage_image",
        label: "Billede",
        type: "image",
        required: false,
        allowUpload: true,
        allowCamera: true,
        accept: ["image/*"]
      },
      {
        key: "separation_production",
        label: "Hvordan adskilles fødevarer under produktion (beskriv områder eller tidsmæssigt adskilt)*",
        type: "textarea",
        required: true
      }
    ]
  },

  {
    key: "allergener",
    title: "Egenkontrolprogram, allergener",
    sortOrder: 20,
    introText: `Allergener

STOFFER ELLER PRODUKTER, DER FORÅRSAGER ALLERGIER ELLER INTOLERANS, der skal oplyses om

1. Glutenholdige kornprodukter, dvs. hvede, rug, byg, havre, spelt, kamut eller hybridiserede stammer heraf, og produkter på basis heraf, undtagen:
a) glucosesirup på basis af hvede, herunder dextrose, maltodextriner på basis af hvede, glucosesirup på basis af byg, kornprodukter, der anvendes til fremstilling af alkoholholdige destillater, herunder landbrugsethanol.

2. Krebsdyr og produkter på basis af krebsdyr.

3. Æg og produkter på basis af æg.

4. Fisk og produkter på basis af fisk.
Undtagen:
a) fiskegelatine anvendt som bærestof for vitamin- eller carotenoidpræparater
b) fiskegelatine eller ægte husblas, der anvendes som klaringsmiddel i øl og vin.

5. Jordnødder og produkter på basis af jordnødder.

6. Soja og produkter på basis af soja.
Undtagen:
a) fuldstændig raffineret sojaolie og -fedt
b) naturlige blandede tocopheroler (E 306), naturligt D-alpha-tocopherol, naturligt D-alpha-tocopherylacetat, naturligt D-alphatocopherylsuccinat hidrørende fra soja
c) plantesteroler og plantesterolestere fremstillet af vegetabilske olier hidrørende fra soja
d) plantestanolestere fremstillet af vegetabilske steroler hidrørende fra soja.

7. Mælk og produkter på basis af mælk (herunder laktose).
Undtagen:
a) valle, der anvendes til fremstilling af alkoholholdige destillater, herunder landbrugsethanol
b) lactitol.

8. Nødder, dvs. mandler (Amygdalus communis L.), hasselnødder (Corylus avellana), valnødder (Juglans regia), cashewnødder (Anacardium occidentale), pekannødder (Carya illinoiesis (Wangenh.) K. Koch), paranødder (Bertholletia excelsa), pistacienødder (Pistacia vera), queenslandnødder (Macadamia ternifolia) og produkter på basis heraf.
Undtagen:
nødder, der anvendes til fremstilling af alkoholholdige destillater, herunder landbrugsethanol.

9. Selleri og produkter på basis af selleri.

10. Sennep og produkter på basis af sennep.

11. Sesamfrø og produkter på basis af sesamfrø.

12. Svovldioxid og sulfitter i koncentrationer på over 10 mg/kg eller 10 mg/liter som samlet SO2 skal beregnes for produkter, som de udbydes klar til brug, eller som de er rekonstitueret efter fabrikanternes instrukser.

13. Lupin og produkter på basis af lupin.

14. Bløddyr og produkter på basis af bløddyr.`,
    fields: [
      {
        key: "allergener_status",
        label: "Allergener*",
        type: "button_group",
        required: true,
        options: [
          { value: "forstaaet", label: "Det er forstået" }
        ]
      },
      {
        key: "comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      }
    ]
  },

  {
    key: "nedkoeling",
    title: "Egenkontrolprogram, nedkøling",
    sortOrder: 30,
    introText: `Nedkøling

Nedkøling af opvarmet mad som fx kødsovs, lasagne, suppe, kebab og lignende produkter skal foregå så hurtigt som muligt.
Nedkølingen måles og kontrolleres med et indstikstermometer.

Ved hver nedkøling skal det sikres, at temperaturen falder fra 56°C til 10°C på maks. 4 timer. Derefter skal fødevarerne opbevares ved maks. 5°C.

Ved fejl:
Hvis maden ikke er nedkølet til 10°C på maks. 4 timer, kan maden straks genopvarmes til 75°C og igen nedkøles. Eventuelt nedkøles i mindre portioner.
Hvis maden ikke straks opvarmes til 75°C, skal den kasseres.

Dokumentation:
Beskriv hvor ofte kontrollen skal dokumenteres. Frekvensen indtastes i kontrolpunktet nedkøling af fødevarer.
Eksempelvis 1 x pr. uge.
Fejl skal altid dokumenteres.`,
    fields: [
      {
        key: "cooling_method",
        label: "Hvordan nedkøles der (beskriv)?*",
        type: "textarea",
        required: true
      }
    ]
  },

  {
    key: "opbevaring_af_foedevarer",
    title: "Egenkontrolprogram, opbevaring af fødevarer",
    sortOrder: 40,
    introText: `Opbevaring af fødevarer

Fødevarer skal opbevares hygiejnisk forsvarligt.

Kontroller hver dag:
• Opbevaringstemperatur (køl maks. +5°C, dybfrost –18°C. Afhængig af temperaturkrav på varen).
• Holdbarhed på fødevarerne. Vurder om fødevarerne kan anvendes/sælges. Færdigpakkede fødevarer må ikke sælges med overskreden holdbarhedsdato.
• Placering af fødevarerne. Er der adskillelse mellem råt kød, tilberedte fødevarer, grøntsager m.m.?
• Optøning af fødevarer skal ske på køl.

Ved fejl:
• Hvis køle- og fryseskabe ikke kan holde de temperaturer, som fødevarerne kræver, skal virksomheden tage stilling til, om varen kan anvendes, eller om varen skal kasseres. For eksempel må færdigpakkede fødevarer, som har været opbevaret ved for høj temperatur, ikke sælges.

Dokumentation:
Beskriv hvor ofte kontrollen skal dokumenteres. Frekvensen indtastes i kontrolpunkterne for opbevaring.
Fejl skal altid dokumenteres.

Materialer og genstande bestemt til at komme i kontakt med fødevarer.

Materialer og genstande som fx emballage, produktionsudstyr og redskaber m.m., som er beregnet til at komme i kontakt med fødevarer eller med rimelighed må antages at komme i kontakt med fødevarer, skal være egnet til formålet.

Få en erklæring fra leverandør af materialer og genstande om, at de er egnet til formålet. Vær opmærksom på kun at bruge materialer og genstande i overensstemmelse med formålet. Fx er det ikke sikkert, at plastbeholdere, der er egnet til opbevaring af kolde fødevarer, er egnet til varme fødevarer.`,
    fields: [
      {
        key: "opbevaring_status",
        label: "Opbevaring af fødevarer er gennemgået*",
        type: "button_group",
        required: true,
        options: [
          { value: "forstaaet", label: "Det er forstået" }
        ]
      },
      {
        key: "comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      }
    ]
  },

  {
    key: "opvarmning_varmebehandling",
    title: "Egenkontrolprogram, opvarmning/varmebehandling",
    sortOrder: 50,
    introText: `Opvarmning/varmebehandling

Mad som opvarmes skal nå en temperatur på minimum 75°C alle steder i produktet, også helt inde i centrum. Temperaturen måles og kontrolleres med et indstikstermometer.

Ved hver opvarmning skal det sikres, at temperaturen er minimum 75°C.

Ved fejl:
Hvis temperaturen ikke er 75°C, fortsætter opvarmningen, indtil temperaturen er nået.

Dokumentation:
Beskriv hvor ofte kontrollen skal dokumenteres. Frekvensen indtastes i kontrolpunktet opvarmning af fødevarer.
Eksempelvis 1 x pr. uge.`,
    fields: [
      {
        key: "opvarmning_status",
        label: "Opvarmning/varmebehandling*",
        type: "button_group",
        required: true,
        options: [
          { value: "forstaaet", label: "Det er forstået" }
        ]
      },
      {
        key: "comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      }
    ]
  },

  {
    key: "personlig_hygiejne",
    title: "Egenkontrolprogram, personlig hygiejne",
    sortOrder: 60,
    introText: `Personlig hygiejne

A. Brug rent arbejdstøj
• Når der skiftes arbejdsopgaver, kan det være nødvendigt at skifte tøj.

B. Vask hænder:
• Inden du begynder at arbejde med fødevarer
• Når du skifter arbejdsproces
• Når du kommer fra pause
• Når det er nødvendigt (efter nys mv.)
• Når du har været på toilettet

C. Sygdom:
• Har du væskende sår, diarré eller andre infektionssygdomme, skal du henvende dig til virksomhedslederen, og det er efterfølgende virksomhedslederens ansvar, hvornår du kan genoptage arbejdet.

D. Rygning:
• Der må ikke ryges, hvor der produceres/opbevares fødevarer.

E. Andre regler beskrives nedenstående`,
    fields: [
      {
        key: "hygiene_jewelry",
        label: "Personlig hygiejne omkring smykker*",
        type: "textarea",
        required: true
      },
      {
        key: "hygiene_headwear",
        label: "Personlig hygiejne omkring hovedbeklædning*",
        type: "textarea",
        required: true
      },
      {
        key: "hygiene_external_tasks",
        label: "Arbejdsfunktioner udenfor fødevaredelen. Fx plejeopgaver, benzinarbejde, udbringning af fødevarer (fx pizza) eller rengøring (skriv).*",
        type: "textarea",
        required: true
      }
    ]
  },

  {
    key: "rengoering_og_desinfektion",
    title: "Egenkontrolprogram, rengøring og desinfektion",
    sortOrder: 70,
    introText: `Rengøring og desinfektion

En rengøringsplan kan være en nyttig ting, særligt hvis der er flere ansatte i virksomheden. Rengøringsplanen vil da have karakter af en arbejdsbeskrivelse. Hvis ikke der forefindes en skriftlig rengøringsplan, må virksomheden mundtligt kunne redegøre for, hvordan der gøres rent. Anvendes der kontrolpunkter, skal disse repræsentere de områder, der skal gøres rent. Vær opmærksom på, at alle maskiner og lokaler bliver beskrevet i rengøringsplanen. Udpeg de maskiner og områder, der skal desinficeres, og opret disse som desinfektionskontrolpunkter.

• Desinfektion kan foregå i opvaskemaskine med skyllevandstemperatur på min. 80°C.
• Eller desinfektion kan foregå ved overhældning med kogende vand.
• Eller med et godkendt desinfektionsmiddel (HUSK! at skylle med koldt vand efter desinfektion).

Rengøring kontrolleres dagligt, inden produktionens begyndelse.

Ved fejl:
Er rengøring ikke i orden, gøres der rent inden opstart.

Husk at der altid skal være sæbe og papir ved håndvaskene også på toilettet.`,
    fields: [
      {
        key: "rengoering_status",
        label: "Rengøring og desinfektion",
        type: "button_group",
        required: true,
        options: [
          { value: "forstaaet", label: "Det er forstået" }
        ]
      },
      {
        key: "comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      }
    ]
  },

  {
    key: "revision",
    title: "Egenkontrolprogram, revision",
    sortOrder: 80,
    introText: `Revision

Revision skal altid foretages, hvis aktiviteterne (fx ændringer i produktion eller vareudvalg) i virksomheden ændres.

Hvis der ikke er sket ændringer, bør revisionen foretages minimum 1 gang årligt. Anvend eventuelt kontrolpunktet ”Årlig kontrol og revision”.`,
    fields: [
      {
        key: "revision_status",
        label: "Revision*",
        type: "button_group",
        required: true,
        options: [
          { value: "forstaaet", label: "Det er forstået" }
        ]
      },
      {
        key: "comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      }
    ]
  },

  {
    key: "sporbarhed",
    title: "Egenkontrolprogram, sporbarhed",
    sortOrder: 90,
    introText: `Sporbarhed

Sporbarhed er muligheden for at kunne spore og følge en fødevare gennem alle produktions-, tilvirknings- og distributionsled.
En fødevarevirksomhed skal således kunne dokumentere, hvor de har fået leveret en fødevare fra.
Dette gøres for eksempel ved opbevaring af faktura fra virksomheden. Faktura skal være specificeret, så man kan identificere varerne.
Ved salg af fødevarer til andre virksomheder skal dette salg også kunne dokumenteres.

Yderligere oplysninger kan findes på Fødevarestyrelsens hjemmeside www.fvst.dk.`,
    fields: [
      {
        key: "sporbarhed_status",
        label: "Sporbarhed*",
        type: "button_group",
        required: true,
        options: [
          { value: "forstaaet", label: "Det er forstået" }
        ]
      },
      {
        key: "comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      }
    ]
  },

  {
    key: "tilbagetraekning",
    title: "Egenkontrolprogram, tilbagetrækning",
    sortOrder: 100,
    introText: `Tilbagetrækning

Fødevarer, der ikke lever op til kravene om fødevaresikkerhed, og som eventuelt kan gøre mennesker syge, skal trækkes tilbage fra markedet.

Hvis virksomheden modtager en skrivelse fra leverandør vedrørende tilbagetrækning af en fødevare
• skal denne skrivelse gemmes som dokumentation i egenkontrolprogrammet
• sammen med et notat om, hvad virksomheden har gjort. For eksempel hvor mange stk. eller kg der er returneret eller kasseret.

Registreringen kan foretages i logbog under tilbagetrækning.

Yderligere oplysninger om tilbagetrækning kan findes på Fødevarestyrelsens hjemmeside www.fvst.dk.`,
    fields: [
      {
        key: "tilbagetraekning_status",
        label: "Tilbagetrækning*",
        type: "button_group",
        required: true,
        options: [
          { value: "forstaaet", label: "Det er forstået" }
        ]
      },
      {
        key: "comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      }
    ]
  },

  {
    key: "varemodtagelse",
    title: "Egenkontrolprogram, varemodtagelse",
    sortOrder: 110,
    introText: `Varemodtagelse

Fødevarer må kun modtages fra autoriserede eller registrerede virksomheder.

Kontrollér ved hver levering af varer følgende:

• Er leveringstemperaturen korrekt. Ved afhentning af fødevarer skrives temperatur ned ved hjemkomst. Foretag altid målinger ved mistanke om fejl. Vær opmærksom på, at der kan være forskellige temperaturkrav til de forskellige varer, og beskriv hvilke grænser der er gældende for varer i din virksomhed. Oftest er temperaturgrænsen maks. 5°C ved kølevarer og –18°C ved frostvarer.
• Er emballagen hel og intakt.
• Er holdbarheden i orden.
• Er mærkningen korrekt.

Afhentning af fødevarer
Henter din virksomhed selv fødevarer ved eksempelvis engrosvirksomheder, skal transporten hjem til din virksomhed ske hygiejnisk forsvarligt, og man skal sikre sig, at kølekæden ikke afbrydes. Man skal kunne transportere fødevarerne ved de temperaturer, som er skrevet på produkterne.

Ved afhentning af fødevarer skal man sikre, at kølekæden ikke afbrydes, og at man kan transportere fødevarerne hygiejnisk forsvarligt (anvend evt. kølekasser, kølebil, plastkasser eller andet).

Ved fejl:
Beskriv hvad der foretages, når der konstateres fejl. Det kan for eksempel være:
• Varerne returneres.
• Varerne vurderes og anvendes straks, hvis dette ikke udgør nogen risiko.
• Varerne vurderes og kasseres.
• Leverandøren kontaktes.

Fejl skal altid dokumenteres i skema om ”varemodtagelse”.

Dokumentation:
Beskriv hvor ofte kontrollen skal dokumenteres - intervallet indsættes i varemodtagelseskontrolpunktet.
For eksempel en gang ugentlig.
Fejl skal altid dokumenteres.`,
    fields: [
      {
        key: "varemodtagelse_type",
        label: "Modtagelse af fødevarer",
        type: "button_group",
        required: true,
        options: [
          {
            value: "danske_virksomheder",
            label: "Jeg modtager fødevarer fra danske virksomheder"
          },
          {
            value: "udlandet",
            label: "Jeg henter selv fødevarer fra udlandet"
          }
        ]
      }
    ]
  },

  {
    key: "vareudbringning",
    title: "Egenkontrolprogram, vareudbringning",
    sortOrder: 120,
    introText: `Vareudbringning

Ved vareudbringning skal fødevaren transporteres i rene og egnede transportkasser og bil. Transportkasser og bil skal have overflader, som er rengøringsvenlige.

Ved udbringning af varm mad må temperaturen ved afleveringen af maden ikke være under 65°C. Ved udbringning af kølet mad må der ikke ske stigning i temperaturen. Transporttiden til den endelige forbruger må ikke overstige én time.`,
    fields: [
      {
        key: "vareudbringning_temperature_method",
        label: "Hvordan sikres temperatur ved vareudbringning (skriv):*",
        type: "textarea",
        required: true
      }
    ]
  },

  {
    key: "varmholdelse_salg_uden_koel",
    title: "Egenkontrolprogram, varmholdelse/salg uden køl",
    sortOrder: 130,
    introText: `Varmholdelse/Salg uden køl

Fødevarer der varmholdes som for eksempel kebab og sovs, skal efter varmebehandling til 75°C varmholdes ved en temperatur på minimum 65°C. Temperaturen måles og kontrolleres med et indstikstermometer.

Ved hver varmholdelse skal det sikres, at temperaturen er minimum 65°C.

Fødevarer som opbevares ved temperatur mellem 5°C – 65°C skal sælges inden for 3 timer.
(For eksempel frikadeller, pølsehorn, pizza slices, pizza topping og sandwich)

Ved fejl:
Hvis temperaturen er mindre end 65°C i mere end 3 timer, skal fødevaren kasseres.

Dokumentation
Beskriv hvor ofte kontrollen skal dokumenteres. Frekvensen indtastes i kontrolpunktet varmholdelse.
Fejl skal altid dokumenteres.`,
    fields: [
      {
        key: "varmholdelse_time_control",
        label: "De 3 timer styres ved:*",
        type: "button_group",
        required: true,
        options: [
          { value: "p_skive", label: "P skive" },
          { value: "faste_tidspunkter", label: "Faste tidspunkter" },
          { value: "andet", label: "Andet" }
        ]
      },
      {
        key: "comment",
        label: "Indtast bemærkning",
        type: "textarea",
        required: false
      }
    ]
  },

  {
    key: "vedligeholdelse_og_skadedyrssikring",
    title: "Egenkontrolprogram, vedligeholdelse og skadedyrssikring",
    sortOrder: 140,
    introText: `Vedligeholdelse og skadedyrssikring

Virksomhedens vedligeholdelsesstandard og skadedyrsovervågning skal kontrolleres.
Det anbefales, at vedligeholdelseslogbogen benyttes. Hvis ikke, skal der mundtligt kunne redegøres for vedligeholdelse og skadedyrssikring.

Alle lokaler gennemgås. Husk også udenomsarealer, lagre og toiletter.

Kontrol af lokaler og inventar kan for eksempel være følgende:
o At vægge, gulve, lofter og karme er hele, jævne og afvaskelige.
o At inventar og maskiner er hele, rengøringsvenlige og uden rust.
o At der ikke er skadedyr i lokalerne, som for eksempel fluer, møl, mus og rotter.
o At der ligger riste på kloakker.
o At døre og vinduer er tætte.
o At termometre, der anvendes til temperaturmålinger i fødevarer, viser korrekte temperaturer.

Ved tilstedeværelse af rotter skal kommunen og den lokale Fødevareregion kontaktes.

Kontrol af termometre kan ske med kogende vand (100°C) og i isvand (0°C).`,
    fields: [
      {
        key: "vedligeholdelse_status",
        label: "Vedligeholdelse og skadedyrssikring*",
        type: "button_group",
        required: true,
        options: [
          { value: "forstaaet", label: "Det er forstået" }
        ]
      },
      {
        key: "comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      }
    ]
  },

  {
    key: "opdatering_af_apv",
    title: "Opdatering af APV",
    sortOrder: 150,
    groupKey: "diverse",
    introText: `Opdatering af APV`,
    fields: [
      {
        key: "apv_status",
        label: "Kontrol og evt. opdatering af APV er udført*",
        type: "button_group",
        required: true,
        options: [
          { value: "udfort", label: "Opgaven er udført" },
          { value: "ikke_udfort", label: "Opgaven er ikke udført" }
        ]
      },
      {
        key: "comment",
        label: "Bemærkningsfelt",
        type: "textarea",
        required: false
      },
      {
        key: "image",
        label: "Billede",
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
      recurrenceValue: 1095
    }
  },

  {
    key: "vedligeholdelse_og_skadedyrssikring_diverse",
    title: "Vedligeholdelse og skadedyrssikring",
    sortOrder: 160,
    groupKey: "diverse",
    introText: `Vedligeholdelse og skadedyrssikring`,
    fields: [
      {
        key: "thermometer_status",
        label: "Viser termometre, der anvendes til temperaturmåling i fødevarer korrekt temperatur?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Termometer viser korrekt" }
        ]
      },
      {
        key: "thermometer_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "doors_windows_status",
        label: "Er døre og vinduer tætte?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Døre og vinduer er tætte" }
        ]
      },
      {
        key: "doors_windows_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "drains_status",
        label: "Er der riste på alle kloakker?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Der er riste på alle kloakker" }
        ]
      },
      {
        key: "drains_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "pests_status",
        label: "Er der ingen skadedyr i lokalerne, som f.eks. fluer, møl, mus og rotter?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Der er ingen skadedyr" }
        ]
      },
      {
        key: "pests_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "inventory_status",
        label: "Er inventar og maskine hele, rengøringsvenlige og uden rust?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Inventar er hele og rengøringsvenlige uden rust" }
        ]
      },
      {
        key: "inventory_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "surfaces_status",
        label: "Er vægge, gulve, lofter og karme hele, jævne og afvaskelige?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Vægge, gulve, lofter og karme er jævne og afvaskelige" }
        ]
      },
      {
        key: "surfaces_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      }
    ],
    scheduleConfig: {
      scheduleType: "recurring",
      recurrenceMode: "days",
      recurrenceValue: 365
    }
  },

  {
    key: "aarlig_kontrol_og_revision",
    title: "Årlig kontrol og revision",
    sortOrder: 170,
    groupKey: "diverse",
    introText: `Årlig kontrol og revision`,
    fields: [
      {
        key: "maintenance_plan_status",
        label: "Bliver vedligeholdelsesplanen fulgt?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Vedligeholdelsesplanen bliver fulgt" }
        ]
      },
      {
        key: "maintenance_plan_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "pest_protection_status",
        label: "Er der sikret mod skadedyr? Døre og vinduer, gulve og vægge skal være tætte og uden huller. Der skal være insektnet for åbne vinduer og døre.*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Der er sikret mod skadedyr" }
        ]
      },
      {
        key: "pest_protection_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "cleaning_plan_followed_status",
        label: "Følges rengøringsplanen?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Rengøringsplanen følges" }
        ]
      },
      {
        key: "cleaning_plan_followed_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "cleaning_plan_sufficient_status",
        label: "Er rengøringsplanen tilstrækkelig? Husk nyt udstyr.*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Rengøringsplanen er tilstrækkelig" }
        ]
      },
      {
        key: "cleaning_plan_sufficient_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "production_same_status",
        label: "Er produktionen den samme som ved sidste gennemgang?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Produktionen er den samme" }
        ]
      },
      {
        key: "production_same_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "thermometers_checked_status",
        label: "Er termometre kontrolleret inden for det sidste år?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Termometre er kontrolleret" }
        ]
      },
      {
        key: "thermometers_checked_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "employees_instructed_status",
        label: "Er alle medarbejdere instrueret i udførelse og dokumentation af egenkontrollen?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Alle medarbejdere er instrueret i kontrollen" }
        ]
      },
      {
        key: "employees_instructed_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "egenkontrol_reviewed_status",
        label: "Gennemgå egenkontrollen. Er der rettet op på evt. fejl?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Egenkontrollen er gennemgået, og der er rettet op på fejl" }
        ]
      },
      {
        key: "egenkontrol_reviewed_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      },
      {
        key: "current_program_fits_status",
        label: "Passer den nuværende egenkontrol til produktionen/aktiviteterne?*",
        type: "button_group",
        required: true,
        options: [
          { value: "ok", label: "Nuværende egenkontrol passer" }
        ]
      },
      {
        key: "current_program_fits_comment",
        label: "Indtast evt. en kommentar",
        type: "textarea",
        required: false
      }
    ],
    scheduleConfig: {
      scheduleType: "recurring",
      recurrenceMode: "days",
      recurrenceValue: 365
    }
  }
];

module.exports = {
  GLOBAL_EGENKONTROL_PROGRAM_TEMPLATES
};