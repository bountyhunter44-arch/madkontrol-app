
        import app, { auth } from "/core/firebase-config.js";

        import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
        import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

        const db = getFirestore(app);
        const functions = getFunctions(app, "us-central1");
        const getCloudinarySignatureCallable = httpsCallable(functions, "getCloudinarySignature");
        const analyzeCloudinaryAssetCallable = httpsCallable(functions, "analyzeCloudinaryAsset");
        const createOnboardingCheckoutSessionCallable = httpsCallable(
        functions,
         "createOnboardingCheckoutSession"
      );
        const PROFILE_KEY = "mkp_egenkontrol_company_profile_v1";
        const ONBOARDING_DRAFT_KEY = "mkp_onboarding_draft_v5";
        const ONBOARDING_CHECKOUT_SUMMARY_KEY = "mkp_onboarding_checkout_summary_v1";
        const ONBOARDING_CREDENTIALS_KEY = "mkp_onboarding_credentials_v1";

        const PRICE_EX_VAT = 149;
        const VAT_RATE = 0.25;

        const STEP_DEFS = [
            { key: "company", title: "Virksomhed", sub: "CVR, kontakt og login" },
            { key: "production", title: "Produktion", sub: "Branche, produktionstyper og produkter" },
            { key: "equipment", title: "Udstyr", sub: "Antal og auto-oprettede enheder" },
            { key: "program", title: "Egenkontrolprogram", sub: "Fagtekster, svar og billeder" },
            { key: "checks", title: "Kontrol og revision", sub: "APV, skadedyr og årlig gennemgang" },
            { key: "summary", title: "Betaling", sub: "Opsummering og Stripe checkout" }
        ];

        // UI-faser: de 6 interne STEP_DEFS-trin præsenteres som 4 faser i progress + trin-nav.
        // Payload, checkout-kontrakt og den interne 6-trins state-maskine (state.currentStep) er UÆNDRET.
        const PHASE_DEFS = [
            { title: "Virksomhed", sub: "CVR, kontakt og login", steps: ["company"] },
            { title: "Enheder og aktiviteter", sub: "Produktion, aktiviteter og udstyr", steps: ["production", "equipment"] },
            { title: "Risikoprofil", sub: "Egenkontrolprogram og revision", steps: ["program", "checks"] },
            { title: "Gennemse og betal", sub: "Opsummering og Stripe checkout", steps: ["summary"] }
        ];
        function phaseIndexForStep(stepIndex) {
            const key = (STEP_DEFS[stepIndex] || STEP_DEFS[0]).key;
            const idx = PHASE_DEFS.findIndex((p) => p.steps.includes(key));
            return idx >= 0 ? idx : 0;
        }

        const BUSINESS_TYPES = [
            "Pizzeria",
            "Grillbar",
            "Burger",
            "Asiatisk",
            "Restaurant",
            "Café",
            "Bageri",
            "Fiskebutik",
            "Institution",
            "Skole",
            "Kantine",
            "Kiosk",
            "Ishus",
            "Catering",
            "Andet"
        ];

        const PRODUCTION_TYPES = [
            "Genopvarmning af fødevarer",
            "Nedkøling af fødevarer",
            "Opvarmning - Tilberedning af fødevarer",
            "Salg af varmebehandlede fødevarer uden køl/varme (3 timers regel)",
            "Varmholdelse (+65)",
            "Rengøringskontrol/Temperaturkontrol",
            "Frysere forskellige slags",
            "Isterningemaskine",
            "Køleskabe forskellige slags",
            "Opvaskemaskine",
            "Nedkøling som vi har",
            "Vare modtagelse",
            "Adskillelse",
            "Dato kontrol af opbevarede fødevarer"
        ];

        const PRODUCT_SUGGESTIONS = {
            Pizzeria: ["Pizza", "Burger", "Kebab", "Lasagne", "Pølser", "Pizza slices", "Salater", "Dressinger"],
            Grillbar: ["Burger", "Pølser", "Pommes frites", "Frikadeller", "Pølsehorn", "Saucer"],
            Burger: ["Burger", "Bøffer", "Pommes frites", "Kylling", "Dressinger", "Salat"],
            Asiatisk: ["Ris", "Nudler", "Kylling", "Oksekød", "Saucer", "Wokretter", "Forårsruller", "Suppe"],
            Restaurant: ["Kød", "Fisk", "Grøntsager", "Saucer", "Varme retter", "Desserter"],
            "Café": ["Sandwich", "Salater", "Kage", "Brød", "Smørrebrød", "Varme drikke"],
            Bageri: ["Brød", "Kager", "Wienerbrød", "Sandwich", "Fyld", "Småkager"],
            Fiskebutik: ["Rå fisk", "Røgvarer", "Skaldyr", "Fiskefars", "Delikatesse", "Fiskefileter"],
            Institution: ["Varm mad", "Kolde retter", "Mellemmåltider", "Brød", "Frugt"],
            Skole: ["Varm mad", "Brød", "Frugt", "Salater", "Drikkevarer"],
            Kantine: ["Buffet", "Varm mad", "Kolde retter", "Salatbar", "Brød", "Dessert"],
            Kiosk: ["Pølser", "Toast", "Pizza slices", "Sandwich", "Drikkevarer"],
            Ishus: ["Kugleis", "Softice", "Toppings", "Milkshake", "Vafler", "Isdesserter"],
            Catering: ["Varme retter", "Kolde retter", "Buffet", "Salater", "Dessert", "Brød"],
            Andet: []
        };

        const EQUIPMENT_DEFS = [
            { key: "fridges", label: "Køleskabe forskellige slags", unitLabel: "Køleskab", targetTemp: "+5°C", description: "Daglig temperaturkontrol og opbevaringskontrol." },
            { key: "freezers", label: "Frysere forskellige slags", unitLabel: "Fryser", targetTemp: "-18°C", description: "Daglig temperaturkontrol og fryseopbevaring." },
            { key: "iceMachines",    label: "Isterningemaskine",   unitLabel: "Isterningemaskine",   targetTemp: "",                    description: "Daglig rengørings- og hygiejnekontrol." },
            { key: "isbokse",        label: "Isboks / Isfryser",    unitLabel: "Isboks",              targetTemp: "-18°C",               description: "Temperaturkontrol og ugentlig rengøring." },
            { key: "frityreGryder",  label: "Frituregryde",         unitLabel: "Frituregryde",        targetTemp: "Max 175°C",           description: "Daglig oliekontrol og ugentlig rengøring." },
            { key: "dishwashers",    label: "Opvaskemaskine",       unitLabel: "Opvaskemaskine",      targetTemp: "Slutskyl min. 80°C",  description: "Bruges til rengøring og desinfektion." },
            { key: "walkInCoolers",  label: "Walk-in køler",        unitLabel: "Walk-in køler",       targetTemp: "+5°C",               description: "Separat kontrolpunkt for større kølerum." },
            { key: "walkInFreezers", label: "Walk-in fryser",       unitLabel: "Walk-in fryser",      targetTemp: "-18°C",              description: "Separat kontrolpunkt for større fryserum." },
            { key: "hotHoldingUnits",label: "Varmholdelse",         unitLabel: "Varmholdelse",        targetTemp: "Min. 65°C",           description: "Bruges til varmholdelse og 3 timers regel." },
            { key: "reheatingUnits", label: "Genopvarmning",        unitLabel: "Genopvarmning",       targetTemp: "Min. 75°C",           description: "Bruges til genopvarmningskontrol." },
            { key: "coolingUnits",   label: "Nedkøling",            unitLabel: "Nedkøling",           targetTemp: "56°C → 10°C / 4 timer", description: "Bruges til nedkølingskontrol." },
            { key: "thermometers",   label: "Termometre",           unitLabel: "Termometer",          targetTemp: "",                    description: "Bruges til temperaturmåling og dokumentation." }
        ];

        const ONBOARDING_ROUTINE_MAP = {
            apv_update: { routineTarget: "apv", subType: "documentation", guideKey: "apv_update" },
            maintenance_pest: { routineTarget: "maintenance_pest_control", subType: "inspection", guideKey: "maintenance_pest_control" },
            annual_review: { routineTarget: "annual_review", subType: "annual_control", guideKey: "annual_review" },
            separation_fridge: { routineTarget: "adskillelse", subType: "fridge_storage", guideKey: "food_separation" },
            separation_production: { routineTarget: "adskillelse", subType: "production_area", guideKey: "food_separation" },
            company_description: { routineTarget: "company_description", subType: "profile", guideKey: "company_profile" },
            cooling_method: { routineTarget: "nedkoeling", subType: "cooling_process", guideKey: "cooling_food" },
            storage_foods: { routineTarget: "opbevaring", subType: "food_storage", guideKey: "storage_food" },
            heating_method: { routineTarget: "opvarmning", subType: "heat_treatment", guideKey: "heating_food" },
            personal_hygiene: { routineTarget: "personlig_hygiejne", subType: "hygiene", guideKey: "personal_hygiene" },
            cleaning_program: { routineTarget: "rengoering", subType: "cleaning_area", guideKey: "cleaning_control" },
            revision_program: { routineTarget: "revision", subType: "review", guideKey: "revision" },
            traceability_program: { routineTarget: "sporbarhed", subType: "traceability", guideKey: "traceability" },
            recall_program: { routineTarget: "tilbagetraekning", subType: "recall", guideKey: "recall" },
            receiving_control: { routineTarget: "varemodtagelse", subType: "goods_receiving", guideKey: "receiving_goods" },
            delivery_control: { routineTarget: "vareudbringning", subType: "delivery", guideKey: "delivery_goods" },
            hot_holding_method: { routineTarget: "varmholdelse", subType: "hot_holding", guideKey: "hot_holding" }
        };

        const PROGRAM_SECTIONS = [
            {
                key: "separation_fridge",
                title: "Egenkontrolprogram, adskillelse",
                description:
`Adskillelse
For at sikre der ikke sker krydssmitte med sygdomsfremkaldende bakterier mellem forskellige fødevarer, skal der ske adskillelse af grøntsager, råt kød, færdiglavede fødevarer m.m. under produktionen og oplagringen.

Dette gøres blandt andet ved:
• at rengøre knive, spækbrætter, bordplader og snittemaskiner ved skift mellem håndtering af fødevarer
• at anvende forskellige områder i køkkenet og skærebrætter til forskellige typer produkter
• at placere fødevarerne tildækket og adskilt

Ved fejl:
Vurder om varen kan anvendes ved fx efterfølgende opvarmning eller kasser varen.`,
                questions: [
                    {
                        id: "fridge_answer",
                        label: "Hvordan adskilles fødevarer i køleskabe (beskriv eller tag billede)*",
                        type: "textarea",
                        defaultAnswer: "Råt kød opbevares nederst og adskilt fra færdigvarer, grøntsager og klar-til-servering produkter. Fødevarer opbevares tildækket og i separate beholdere. Produkter med allergener holdes tydeligt adskilt fra øvrige varer."
                    },
                    {
                        id: "production_answer",
                        label: "Hvordan adskilles fødevarer under produktion (beskriv områder eller tidsmæssigt adskilt)*",
                        type: "textarea",
                        defaultAnswer: "Virksomheden anvender separate arbejdsområder og rene redskaber ved skift mellem råvarer og færdige produkter. Hvor fysisk adskillelse ikke er mulig, sker arbejdet tidsmæssigt adskilt med rengøring mellem opgaverne."
                    }
                ],
                uploadTargets: [
                    { questionId: "fridge_answer", sectionKey: "separation_fridge", label: "Kamera / billede til køleskabsadskillelse" },
                    { questionId: "production_answer", sectionKey: "separation_production", label: "Kamera / billede til adskillelse under produktion" }
                ]
            },
            {
                key: "company_description",
                title: "Egenkontrolprogram, beskrivelse af virksomheden",
                description:
`Virksomhedens navn og adresse
Virksomheden er autoriseret/registreret af fødevareregionen den
Virksomhedsleder
Import/modtagelse/afhentning af fødevarer fra udlandet
Produkter i virksomheden`,
                questions: [
                    {
                        id: "company_name_address",
                        label: "Virksomhedens navn og adresse:*",
                        type: "textarea",
                        dynamicAnswer: () => {
                            const address = [state.company.address, state.company.zip, state.company.city].filter(Boolean).join(", ");
                            return [state.company.name, address].filter(Boolean).join(" - ");
                        }
                    },
                    {
                        id: "company_registered_date",
                        label: "Virksomheden er autoriseret/registreret af fødevareregionen den:*",
                        type: "text",
                        dynamicAnswer: () => state.company.registeredDate || ""
                    },
                    {
                        id: "company_leader",
                        label: "Virksomhedsleder:*",
                        type: "text",
                        dynamicAnswer: () => state.company.leader || ""
                    },
                    {
                        id: "company_import",
                        label: "Import/modtagelse/afhentning af fødevarer fra udlandet:*",
                        type: "textarea",
                        defaultAnswer: "Virksomheden modtager som udgangspunkt fødevarer fra danske leverandører. Hvis virksomheden selv henter eller modtager fødevarer fra udlandet, beskrives transport, temperaturkrav og dokumentation særskilt."
                    },
                    {
                        id: "company_products",
                        label: "Produkter i virksomheden:*",
                        type: "textarea",
                        dynamicAnswer: () => state.business.products.join(", ")
                    }
                ]
            },
            {
                key: "cooling_method",
                title: "Egenkontrolprogram, nedkøling",
                description:
`Nedkøling
Nedkøling af opvarmet mad som fx kødsovs, lasagne, suppe, kebab og lignende produkter skal foregå så hurtig som muligt.

Ved hver nedkøling skal det sikres, at temperaturen falder fra 56°C til 10°C på max 4 timer. Derefter skal fødevarerne opbevares ved max. 5°C.

Ved fejl:
Hvis maden ikke er nedkølet til 10°C på max 4 timer, kan maden straks genopvarmes til 75°C og igen nedkøles.`,
                questions: [
                    {
                        id: "cooling_answer",
                        label: "Hvordan nedkøles der (beskriv)?*",
                        type: "textarea",
                        defaultAnswer: "Nedkøling sker i mindre portioner under løbende temperaturkontrol med indstikstermometer. Varme fødevarer fordeles i lave beholdere eller mindre portioner for at sikre hurtig nedkøling. Temperaturen kontrolleres, så produktet går fra 56°C til 10°C inden for maks. 4 timer og derefter opbevares på køl ved maks. 5°C."
                    }
                ],
                uploadTargets: [
                    { questionId: "cooling_answer", sectionKey: "cooling_method", label: "Kamera / billede af nedkølingsområde eller metode" }
                ]
            },
            {
                key: "storage_foods",
                title: "Egenkontrolprogram, opbevaring af fødevarer",
                description:
`Opbevaring af fødevarer
Fødevarer skal opbevares hygiejnisk forsvarligt.

Kontroller hver dag:
• Opbevaringstemperatur
• Holdbarhed på fødevarerne
• Placering og adskillelse
• Optøning på køl

Materialer og genstande som kommer i kontakt med fødevarer skal være egnet til formålet.`,
                questions: [
                    {
                        id: "storage_ack",
                        label: "Opbevaring af fødevarer er gennemgået*",
                        type: "choice",
                        options: ["Det er forstået"],
                        defaultChoice: "Det er forstået"
                    },
                    {
                        id: "storage_comment",
                        label: "Indtast evt. en kommentar",
                        type: "textarea",
                        defaultAnswer: ""
                    }
                ]
            },
            {
                key: "heating_method",
                title: "Egenkontrolprogram, Opvarmning/varmebehandling",
                description:
`Mad som opvarmes skal nå en temperatur på minimum 75°C alle steder i produktet, også helt inde i centrum. Temperaturen måles og kontrolleres med et indstikstermometer.

Ved fejl:
Hvis temperaturen ikke er 75°C fortsætter opvarmningen indtil temperaturen er nået.`,
                questions: [
                    {
                        id: "heating_ack",
                        label: "Opvarmning/varmebehandling*",
                        type: "choice",
                        options: ["Det er forstået"],
                        defaultChoice: "Det er forstået"
                    },
                    {
                        id: "heating_comment",
                        label: "Indtast evt. en kommentar",
                        type: "textarea",
                        defaultAnswer: ""
                    }
                ]
            },
            {
                key: "personal_hygiene",
                title: "Egenkontrolprogram, Personlig hygiejne",
                description:
`Personlig hygiejne
A. Brug rent arbejdstøj
B. Vask hænder ved relevante skift
C. Sygdom skal meldes til virksomhedsleder
D. Der må ikke ryges i fødevareområder
E. Andre regler beskrives nedenfor`,
                questions: [
                    {
                        id: "hygiene_jewelry",
                        label: "Personlig hygiejne omkring smykker*",
                        type: "textarea",
                        defaultAnswer: "Medarbejdere bærer ikke smykker på hænder og underarme under håndtering af fødevarer."
                    },
                    {
                        id: "hygiene_headwear",
                        label: "Personlig hygiejne omkring hovedbeklædning*",
                        type: "textarea",
                        defaultAnswer: "Hår holdes opsat eller dækket efter behov, så kontaminering af fødevarer undgås."
                    },
                    {
                        id: "hygiene_nonfood",
                        label: "Arbejdsfunktioner udenfor fødevaredelen. Fx plejeopgaver, benzinarbejde, udbringning af fødevarer eller rengøring (skriv).*",
                        type: "textarea",
                        defaultAnswer: "Arbejdsopgaver udenfor fødevaredelen udføres adskilt fra fødevarehåndtering. Efter sådanne opgaver vaskes hænder og arbejdstøj vurderes efter behov."
                    }
                ]
            },
            {
                key: "cleaning_program",
                title: "Egenkontrolprogram, Rengøring og desinfektion",
                description:
`Rengøring og desinfektion
En rengøringsplan kan være en nyttig ting, særligt hvis der er flere ansatte i virksomheden.

• Desinfektion kan foregå i opvaskemaskine med skyllevandstemperatur på min. 80°C
• Eller med kogende vand
• Eller med godkendt desinfektionsmiddel

Rengøring kontrolleres dagligt, inden produktionens begyndelse.`,
                questions: [
                    {
                        id: "cleaning_ack",
                        label: "Rengøring og desinfektion",
                        type: "choice",
                        options: ["Det er forstået"],
                        defaultChoice: "Det er forstået"
                    },
                    {
                        id: "cleaning_comment",
                        label: "Indtast evt. en kommentar",
                        type: "textarea",
                        defaultAnswer: ""
                    }
                ],
                uploadTargets: [
                    { questionId: "cleaning_comment", sectionKey: "cleaning_program", label: "Kamera / billede af rengøringsområde eller maskine" }
                ]
            },
            {
                key: "revision_program",
                title: "Egenkontrolprogram, Revision",
                description:
`Revision skal altid foretages hvis aktiviteterne i virksomheden ændres.
Hvis der ikke er sket ændringer, bør revisionen foretages minimum 1 gang årligt.`,
                questions: [
                    {
                        id: "revision_ack",
                        label: "Revision*",
                        type: "choice",
                        options: ["Det er forstået"],
                        defaultChoice: "Det er forstået"
                    },
                    {
                        id: "revision_comment",
                        label: "Indtast evt. en kommentar",
                        type: "textarea",
                        defaultAnswer: ""
                    }
                ]
            },
            {
                key: "traceability_program",
                title: "Egenkontrolprogram, Sporbarhed",
                description:
`Sporbarhed er muligheden for at kunne spore og følge en fødevare gennem alle produktions-, tilvirknings- og distributionsled.
Virksomheden skal kunne dokumentere hvor fødevarer er leveret fra.`,
                questions: [
                    {
                        id: "traceability_ack",
                        label: "Sporbarhed*",
                        type: "choice",
                        options: ["Det er forstået"],
                        defaultChoice: "Det er forstået"
                    },
                    {
                        id: "traceability_comment",
                        label: "Indtast evt. en kommentar",
                        type: "textarea",
                        defaultAnswer: ""
                    }
                ]
            },
            {
                key: "recall_program",
                title: "Egenkontrolprogram, Tilbagetrækning",
                description:
`Fødevarer der ikke lever op til kravene om fødevaresikkerhed og som kan gøre mennesker syge, skal trækkes tilbage fra markedet.`,
                questions: [
                    {
                        id: "recall_ack",
                        label: "Tilbagetrækning*",
                        type: "choice",
                        options: ["Det er forstået"],
                        defaultChoice: "Det er forstået"
                    },
                    {
                        id: "recall_comment",
                        label: "Indtast evt. en kommentar",
                        type: "textarea",
                        defaultAnswer: ""
                    }
                ]
            },
            {
                key: "receiving_control",
                title: "Egenkontrolprogram, varemodtagelse",
                description:
`Varemodtagelse
Fødevarer må kun modtages fra autoriserede eller registrerede virksomheder.

Kontrollér ved hver levering:
• temperatur
• emballage
• holdbarhed
• mærkning`,
                questions: [
                    {
                        id: "receiving_choice",
                        label: "Modtagelse af fødevarer",
                        type: "choice",
                        options: [
                            "Jeg modtager kun fødevarer fra danske firmaer",
                            "Jeg henter selv fødevarer i andet land"
                        ],
                        defaultChoice: "Jeg modtager kun fødevarer fra danske firmaer"
                    }
                ]
            },
            {
                key: "delivery_control",
                title: "Egenkontrolprogram, vareudbringning",
                description:
`Ved vareudbringning skal fødevaren transporteres i rene og egnede transportkasser og bil.
Ved udbringning af varm mad må temperaturen ved aflevering ikke være under 65°C.`,
                questions: [
                    {
                        id: "delivery_answer",
                        label: "Hvordan sikres temperatur ved vareudbringning (skriv):*",
                        type: "textarea",
                        defaultAnswer: "Temperaturen sikres ved brug af egnede transportkasser og hurtig levering. Varm mad holdes varm, og kolde varer transporteres så kølekæden bevares."
                    }
                ]
            },
            {
                key: "hot_holding_method",
                title: "Egenkontrolprogram, varmholdelse/salg uden køl",
                description:
`Fødevarer der varmholdes skal efter varmebehandling til 75°C, varmholdes ved minimum 65°C.
Fødevarer mellem 5°C og 65°C skal sælges inden for 3 timer.`,
                questions: [
                    {
                        id: "three_hour_rule",
                        label: "De 3 timer styres ved:*",
                        type: "choice",
                        options: ["P-skive", "Faste tidspunkter", "Andet"],
                        defaultChoice: "P-skive"
                    },
                    {
                        id: "three_hour_rule_note",
                        label: "Bemærkning",
                        type: "textarea",
                        defaultAnswer: "Virksomheden styrer 3 timers reglen ved tydelig mærkning af starttidspunkt og faste interne procedurer for kassation ved overskridelse."
                    }
                ]
            }
        ];

        const CHECK_SECTIONS = [
            {
                key: "apv_update",
                title: "Diverse - Opdatering af APV",
                items: [
                    "Kontrol og evt. opdatering af APV er udført*"
                ]
            },
            {
                key: "maintenance_pest",
                title: "Vedligeholdelse og skadedyrssikring - Vedligeholdelse og skadedyrssikring",
                items: [
                    "Viser termometre, der anvendes til temperaturmåling i fødevarer korrekt temperatur?*",
                    "Er døre og vinduer tætte?*",
                    "Er der riste på alle kloakker?*",
                    "Er der ingen skadedyr i lokalerne, som f.eks. fluer, møl, mus og rotter?*",
                    "Er inventar og maskine hele, rengøringsvenlige og uden rust?*",
                    "Er vægge, gulve, lofter og karme hele, jævne og afvaskelige?*"
                ]
            },
            {
                key: "annual_review",
                title: "Årlig kontrol og revision - Årlig kontrol og revision",
                items: [
                    "Bliver vedligeholdelsesplanen fulgt?*",
                    "Er der sikret mod skadedyr?*",
                    "Følges rengøringsplanen?*",
                    "Er rengøringsplanen tilstrækkelig?*",
                    "Er produktionen den samme som ved sidste gennemgang?*",
                    "Er termometre kontrolleret inden for det sidste år?*",
                    "Er alle medarbejdere instrueret i udførelse og dokumentation af egenkontrollen?*",
                    "Gennemgå egenkontrollen. Er der rettet op på evt. fejl?*",
                    "Passer den nuværende egenkontrol til produktionen/aktiviteterne?*"
                ]
            }
        ];

        const stepNavEl = document.getElementById("stepNav");
        const stepContentEl = document.getElementById("stepContent");
        const progressFillEl = document.getElementById("progressFill");
        const progressValueEl = document.getElementById("progressValue");
        const approvedCountEl = document.getElementById("approvedCount");
        const uploadCountEl = document.getElementById("uploadCount");
        const unitCountEl = document.getElementById("unitCount");
        const productCountEl = document.getElementById("productCount");
        const saveIndicatorEl = document.getElementById("saveIndicator");
        const prevStepBtn = document.getElementById("prevStepBtn");
        const nextStepBtn = document.getElementById("nextStepBtn");
        const saveDraftBtn = document.getElementById("saveDraftBtn");
        const submitBtn = document.getElementById("submitBtn");
        const hiddenImageInput = document.getElementById("hiddenImageInput");

        function safeJsonParse(value, fallback = null) {
            try {
                return value ? JSON.parse(value) : fallback;
            } catch (error) {
                console.warn("JSON parse fejl:", error);
                return fallback;
            }
        }

        function escapeHtml(value) {
            return String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        }

        function slugify(value) {
            return String(value ?? "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/^_+|_+$/g, "");
        }

        function getProfile() {
            return safeJsonParse(localStorage.getItem(PROFILE_KEY)) || {};
        }

        function mergeDeep(target, source) {
            if (!source || typeof source !== "object") return target;

            const output = Array.isArray(target) ? [...target] : { ...target };

            Object.keys(source).forEach((key) => {
                const sourceValue = source[key];
                const targetValue = output[key];

                if (Array.isArray(sourceValue)) {
                    output[key] = sourceValue;
                } else if (
                    sourceValue &&
                    typeof sourceValue === "object" &&
                    targetValue &&
                    typeof targetValue === "object" &&
                    !Array.isArray(targetValue)
                ) {
                    output[key] = mergeDeep(targetValue, sourceValue);
                } else {
                    output[key] = sourceValue;
                }
            });

            return output;
        }

        function getInitialState() {
            const profile = getProfile();
            const storedDraft = safeJsonParse(localStorage.getItem(ONBOARDING_DRAFT_KEY));

            const base = {
                currentStep: 0,
                company: {
                    cvr: "",
                    name: profile.companyName || "",
                    address: "",
                    zip: "",
                    city: "",
                    email: "",
                    phone: "",
                    leader: "",
                    registeredDate: new Date().toISOString().slice(0, 10),
                    businessType: profile.companyType || "",
                    accountPassword: ""
                },
                business: {
                    productionTypes: [],
                    products: [],
                    allergenHandling: "Allergener håndteres som en del af risikoanalyse og produktadskillelse. Der arbejdes med tydelig mærkning, adskilt opbevaring og korrekt information til kunder.",
                    importFromAbroad: false,
                    type: profile.companyType || ""
                },
                equipment: {
                    selected: {},
                    units: []
                },
                sections: {},
                checks: {},
                meta: {
                    lastSavedAt: null
                }
            };

            PROGRAM_SECTIONS.forEach((section) => {
                base.sections[section.key] = {
                    approved: false,
                    answers: {},
                    choices: {},
                    images: []
                };

                section.questions.forEach((question) => {
                    if (question.type === "choice") {
                        base.sections[section.key].choices[question.id] = question.defaultChoice || "";
                    } else {
                        base.sections[section.key].answers[question.id] = question.defaultAnswer ?? "";
                    }
                });
            });

            CHECK_SECTIONS.forEach((section) => {
                base.checks[section.key] = {
                    approved: false,
                    answers: section.items.map((label) => ({
                        label,
                        value: "Ja",
                        comment: ""
                    })),
                    images: []
                };
            });

            const merged = storedDraft ? mergeDeep(base, storedDraft) : base;
            return merged;
        }

        const state = getInitialState();
        let isSubmitting = false;

        // DEMO DATA FOR TESTING
        function fillDemoData() {
            state.company.cvr = "12345678";
            state.company.name = "Test Pizzeria ApS";
            state.company.leader = "Test Ejer";
            state.company.address = "Testgade 123";
            state.company.zip = "2100";
            state.company.city = "København Ø";
            state.company.phone = "12345678";
            state.company.email = `test${Date.now()}@madkontrollen.dk`;
            state.company.accountPassword = "TestPassword123";
            state.company.businessType = "Pizzeria";
            state.company.registeredDate = "2020-01-01";

            state.business.type = "Pizzeria";
            state.business.productionTypes = ["Opvarmning - Tilberedning af fødevarer", "Varmholdelse (+65)"];
            state.business.products = ["Pizza", "Pasta", "Salat", "Lasagne"];
            state.business.allergenHandling = "Vi håndterer allergener korrekt og informerer kunder.";

            state.equipment.selected.fridges  = { enabled: true, quantity: 2 };
            state.equipment.selected.freezers = { enabled: true, quantity: 1 };

            buildUnitsFromEquipment();
            ensureProductsFromType();
            syncDynamicAnswers();
            saveDraftToLocalStorage();
            render();

            alert(" Testdata udfyldt! Du kan nu gennemføre onboarding hurtigt.");
        }

        function clearTestData() {
            if (!confirm("Slet al testdata fra localStorage? Dette sletter kladde, credentials og checkout summary.")) {
                return;
            }

            try {
                localStorage.removeItem(ONBOARDING_DRAFT_KEY);
                localStorage.removeItem(ONBOARDING_CREDENTIALS_KEY);
                localStorage.removeItem(ONBOARDING_CHECKOUT_SUMMARY_KEY);
                localStorage.removeItem(PROFILE_KEY);

                alert(" Testdata slettet fra localStorage. Genindlæs siden for at starte forfra.");
                location.reload();
            } catch (error) {
                console.error("Fejl ved sletning af testdata:", error);
                alert(" Kunne ikke slette testdata. Se console.");
            }
        }

        // Expose functions to window scope for onclick handlers
        window.fillDemoData = fillDemoData;
        window.clearTestData = clearTestData;

        function syncDynamicAnswers() {
            PROGRAM_SECTIONS.forEach((section) => {
                section.questions.forEach((question) => {
                    if (typeof question.dynamicAnswer === "function") {
                        state.sections[section.key].answers[question.id] = question.dynamicAnswer() || "";
                    }
                });
            });
        }

        function ensureProductsFromType() {
            const type = state.company.businessType || state.business.type;
            const suggestions = PRODUCT_SUGGESTIONS[type] || [];
            if (!state.business.products.length && suggestions.length) {
                state.business.products = [...suggestions];
            }
        }

        function buildUnitsFromEquipment() {
            const units = [];

            EQUIPMENT_DEFS.forEach((def) => {
                const selected = state.equipment.selected[def.key] || { enabled: false, quantity: 0 };
                const qty = Number(selected.quantity || 0);

                if (!selected.enabled || qty < 1) return;

                for (let i = 1; i <= qty; i += 1) {
                    units.push({
                        id: `${slugify(def.key)}_${i}`,
                        type: def.key,
                        label: def.label,
                        name: `${def.unitLabel} ${i}`,
                        targetTemp: def.targetTemp
                    });
                }
            });

            state.equipment.units = units;
        }

        function getApprovedCount() {
            const sectionCount = Object.values(state.sections).filter((item) => item.approved).length;
            const checkCount = Object.values(state.checks).filter((item) => item.approved).length;
            return sectionCount + checkCount;
        }

        function getUploadCount() {
            const sectionUploads = Object.values(state.sections).reduce((sum, item) => sum + (item.images?.length || 0), 0);
            const checkUploads = Object.values(state.checks).reduce((sum, item) => sum + (item.images?.length || 0), 0);
            return sectionUploads + checkUploads;
        }

        function updateSidebarStats() {
            approvedCountEl.textContent = String(getApprovedCount());
            uploadCountEl.textContent = String(getUploadCount());
            unitCountEl.textContent = String(state.equipment.units.length);
            productCountEl.textContent = String(state.business.products.length);
        }

        function updateSaveIndicator(text) {
            saveIndicatorEl.textContent = text;
        }

        function saveDraftToLocalStorage() {
            state.meta.lastSavedAt = new Date().toISOString();
            localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(state));
            updateSidebarStats();
            updateSaveIndicator("Kladde gemt");
        }

        function updateProgress() {
            // Vis fase (1 af 4) i stedet for internt trin (x/6). Knap-logik følger stadig det interne trin.
            const phaseIdx = phaseIndexForStep(state.currentStep);
            progressValueEl.textContent = `Trin ${phaseIdx + 1} af ${PHASE_DEFS.length}`;
            progressFillEl.style.width = `${((phaseIdx + 1) / PHASE_DEFS.length) * 100}%`;

            prevStepBtn.disabled = state.currentStep === 0;
            nextStepBtn.style.display = state.currentStep === STEP_DEFS.length - 1 ? "none" : "inline-flex";
            submitBtn.style.display = "none";
        }

        function focusStepHeading() {
            // a11y: flyt fokus til trinnets overskrift ved trinskift (kun brugerudløst navigation).
            const heading = stepContentEl.querySelector("h1, h2");
            if (!heading) return;
            heading.setAttribute("tabindex", "-1");
            try { heading.focus({ preventScroll: false }); } catch (e) { heading.focus(); }
        }

        function renderStepNav() {
            // Vis 4 faser. Klik på en fase går til det FØRSTE interne trin i fasen (6-trins-flow uændret).
            const currentPhase = phaseIndexForStep(state.currentStep);
            stepNavEl.innerHTML = PHASE_DEFS.map((phase, index) => {
                const cls = index === currentPhase ? "active" : (index < currentPhase ? "done" : "");
                const current = index === currentPhase ? ' aria-current="step"' : "";
                return `
                <button class="step-btn ${cls}" data-phase-index="${index}" type="button"${current}>
                    <span class="no">${index + 1}</span>
                    <strong>${escapeHtml(phase.title)}</strong>
                    <span class="sub">${escapeHtml(phase.sub)}</span>
                </button>
            `;
            }).join("");

            stepNavEl.querySelectorAll("[data-phase-index]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const phaseIdx = Number(btn.dataset.phaseIndex);
                    const firstKey = PHASE_DEFS[phaseIdx].steps[0];
                    const target = STEP_DEFS.findIndex((s) => s.key === firstKey);
                    if (target >= 0) {
                        state.currentStep = target;
                        render();
                        focusStepHeading();
                    }
                });
            });
        }

        function renderCompanyStep() {
            stepContentEl.innerHTML = `
                <div class="title-row">
                    <div>
                        <h2>Virksomhed og login</h2>
                        <p>Her samler vi virksomhedsdata, branche og loginoplysninger, så checkout og tak.html kan fortsætte automatisk bagefter.</p>
                    </div>
                    <div class="badge">Trin 1 af 6</div>
                </div>

                <div class="notice info">
                    Login email og password gemmes i de lokale nøgler som tak.html allerede bruger til auto-login og provisioning.
                </div>

                <div class="grid-2">
                    <div class="field">
                        <label for="company_cvr">CVR</label>
                        <input
    id="company_cvr"
    value="${escapeHtml(state.company.cvr)}"
    placeholder="Indtast CVR"
    type="text"
    inputmode="numeric"
    maxlength="8"
    pattern="[0-9]{8}"
    autocomplete="off"
    autocapitalize="off"
    autocorrect="off"
    spellcheck="false"
    name="company_cvr_manual"
     >
                    </div>

                    <div class="field">
                        <label>&nbsp;</label>
                        <button class="btn btn-secondary" id="cvrLookupBtn" type="button">Hent CVR</button>
                    </div>

                    <div class="field">
                        <label for="company_name">Virksomhedsnavn</label>
                        <input id="company_name" value="${escapeHtml(state.company.name)}">
                    </div>

                    <div class="field">
                        <label for="company_leader">Virksomhedsleder</label>
                        <input id="company_leader" value="${escapeHtml(state.company.leader)}">
                    </div>

                    <div class="field">
                        <label for="company_address">Adresse</label>
                        <input id="company_address" value="${escapeHtml(state.company.address)}">
                    </div>

                    <div class="field">
                        <label for="company_registered">Virksomheden er autoriseret/registreret den</label>
                        <input id="company_registered" type="date" value="${escapeHtml(state.company.registeredDate)}">
                    </div>

                    <div class="field">
                        <label for="company_zip">Postnr</label>
                        <input id="company_zip" value="${escapeHtml(state.company.zip)}">
                    </div>

                    <div class="field">
                        <label for="company_city">By</label>
                        <input id="company_city" value="${escapeHtml(state.company.city)}">
                    </div>

                    <div class="field">
                        <label for="company_email">Login email</label>
                        <input id="company_email" type="email" value="${escapeHtml(state.company.email)}">
                    </div>

                    <div class="field">
                        <label for="company_password">Login password</label>
                        <input id="company_password" type="password" value="${escapeHtml(state.company.accountPassword)}">
                    </div>

                    <div class="field">
                        <label for="company_phone">Telefon</label>
                        <input id="company_phone" value="${escapeHtml(state.company.phone)}">
                    </div>

                    <div class="field">
                        <label for="company_type">Branchetype</label>
                        <select id="company_type">
                            <option value="">Vælg branche</option>
                            ${BUSINESS_TYPES.map((type) => `
                                <option value="${escapeHtml(type)}" ${state.company.businessType === type ? "selected" : ""}>${escapeHtml(type)}</option>
                            `).join("")}
                        </select>
                    </div>
                </div>

                <div class="btn-row">
                    <button class="btn btn-primary" id="saveCompanyBtn" type="button">Gem svar</button>
                </div>
            `;

            document.getElementById("cvrLookupBtn").addEventListener("click", async () => {
    try {
        const rawCvr = document.getElementById("company_cvr").value || "";
        const cleanedCvr = rawCvr.replace(/\D/g, "").trim();

        if (!/^\d{8}$/.test(cleanedCvr)) {
            alert("CVR-nummer skal være præcis 8 cifre.");
            return;
        }

        updateSaveIndicator("Henter CVR data...");

        const resp = await fetch(`https://cvrapi.dk/api?search=${cleanedCvr}&country=dk`, {
            headers: { "User-Agent": "Madkontrollen - kontakt@madkontrollen.dk" }
        });

        if (!resp.ok) throw new Error(`CVR API svarede med ${resp.status}`);
        const d = await resp.json();
        if (d.error) throw new Error(d.error);

        const name    = d.name    || "";
        const address = d.address || "";
        const zip     = String(d.zipcode || "");
        const city    = d.city    || "";

        document.getElementById("company_name").value    = name;
        document.getElementById("company_address").value = address;
        document.getElementById("company_zip").value     = zip;
        document.getElementById("company_city").value    = city;

        state.company.cvr     = cleanedCvr;
        state.company.name    = name;
        state.company.address = address;
        state.company.zip     = zip;
        state.company.city    = city;

        syncDynamicAnswers();
        saveDraftToLocalStorage();

        updateSaveIndicator("CVR hentet ✓");
    } catch (error) {
        console.error("CVR lookup fejl:", error);
        alert("Kunne ikke hente CVR data: " + error.message);
        updateSaveIndicator("CVR fejl");
    }
});

            document.getElementById("saveCompanyBtn").addEventListener("click", () => {
                state.company.cvr = (document.getElementById("company_cvr").value || "").replace(/\D/g, "");
                state.company.name = document.getElementById("company_name").value.trim();
                state.company.leader = document.getElementById("company_leader").value.trim();
                state.company.address = document.getElementById("company_address").value.trim();
                state.company.registeredDate = document.getElementById("company_registered").value.trim();
                state.company.zip = document.getElementById("company_zip").value.trim();
                state.company.city = document.getElementById("company_city").value.trim();
                state.company.email = document.getElementById("company_email").value.trim();
                state.company.accountPassword = document.getElementById("company_password").value;
                state.company.phone = document.getElementById("company_phone").value.trim();
                state.company.businessType = document.getElementById("company_type").value;
                state.business.type = state.company.businessType;

                ensureProductsFromType();
                syncDynamicAnswers();
                saveDraftToLocalStorage();
                render();
            });
        }

        function renderProductionStep() {
            ensureProductsFromType();

            stepContentEl.innerHTML = `
                <div class="title-row">
                    <div>
                        <h2>Produktion og produkter</h2>
                        <p>Vælg de processer der findes i virksomheden. Produkter foreslås automatisk ud fra branchetype, men kan redigeres manuelt.</p>
                    </div>
                    <div class="badge">Trin 2 af 6</div>
                </div>

                <div class="field">
                    <label>Produktion</label>
                    <div class="chip-row">
                        ${PRODUCTION_TYPES.map((type) => `
                            <button class="chip-btn ${state.business.productionTypes.includes(type) ? "active" : ""}" type="button" data-production="${escapeHtml(type)}">${escapeHtml(type)}</button>
                        `).join("")}
                    </div>
                </div>

                <div class="grid-2">
                    <div class="field">
                        <label for="products_text">Produkter i virksomheden</label>
                        <textarea id="products_text">${escapeHtml(state.business.products.join(", "))}</textarea>
                        <div class="helper">Eksempel: Pizza, burger, kebab, lasagne, pølser, kugleis, softice.</div>
                    </div>

                    <div class="field">
                        <label for="allergen_text">Allergener og håndtering</label>
                        <textarea id="allergen_text">${escapeHtml(state.business.allergenHandling)}</textarea>
                        <div class="helper">Allergener er en del af risikoanalysen og ikke en separat daglig checkliste.</div>
                    </div>
                </div>

                <div class="btn-row">
                    <button class="btn btn-secondary" id="useSuggestedProductsBtn" type="button">Brug brancheforslag</button>
                    <button class="btn btn-primary" id="saveProductionBtn" type="button">Gem svar</button>
                </div>
            `;

            stepContentEl.querySelectorAll("[data-production]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const value = btn.dataset.production;
                    if (state.business.productionTypes.includes(value)) {
                        state.business.productionTypes = state.business.productionTypes.filter((item) => item !== value);
                    } else {
                        state.business.productionTypes.push(value);
                    }
                    saveDraftToLocalStorage();
                    render();
                });
            });

            document.getElementById("useSuggestedProductsBtn").addEventListener("click", () => {
                state.business.products = [...(PRODUCT_SUGGESTIONS[state.company.businessType] || [])];
                syncDynamicAnswers();
                saveDraftToLocalStorage();
                render();
            });

            document.getElementById("saveProductionBtn").addEventListener("click", () => {
                state.business.products = document.getElementById("products_text").value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);

                state.business.allergenHandling = document.getElementById("allergen_text").value;
                syncDynamicAnswers();
                saveDraftToLocalStorage();
                render();
            });
        }

        function renderEquipmentStep() {
            stepContentEl.innerHTML = `
                <div class="title-row">
                    <div>
                        <h2>Udstyr</h2>
                        <p>Vælg udstyr, angiv antal, og se hvilke konkrete enheder systemet opretter til senere rutiner og dokumentation.</p>
                    </div>
                    <div class="badge">Trin 3 af 6</div>
                </div>

                <div class="section-stack">
                    ${EQUIPMENT_DEFS.map((def) => {
                        const selected = state.equipment.selected[def.key] || { enabled: false, quantity: 0 };
                        const units = state.equipment.units.filter((unit) => unit.type === def.key);

                        return `
                            <article class="equipment-card">
                                <div class="equipment-top">
                                    <div>
                                        <h4>${escapeHtml(def.label)}</h4>
                                        <p>${escapeHtml(def.description)}</p>
                                    </div>

                                    <button class="toggle-btn ${selected.enabled ? "active" : ""}" type="button" data-equip-toggle="${escapeHtml(def.key)}">
                                        ${selected.enabled ? "Valgt" : "Vælg"}
                                    </button>
                                </div>

                                <div class="quantity-wrap">
                                    <label for="qty_${escapeHtml(def.key)}">Antal</label>
                                    <input
                                        id="qty_${escapeHtml(def.key)}"
                                        type="number"
                                        min="0"
                                        value="${Number(selected.quantity || 0)}"
                                        ${selected.enabled ? "" : "disabled"}
                                        data-equip-qty="${escapeHtml(def.key)}"
                                    >
                                    <span class="helper">${def.targetTemp ? `Standard: ${escapeHtml(def.targetTemp)}` : "Opretter udstyrsenheder når feltet er valgt."}</span>
                                </div>

                                ${units.length ? `
                                    <div class="unit-list">
                                        ${units.map((unit) => `
                                            <span class="unit-chip">${escapeHtml(unit.name)}${unit.targetTemp ? ` · ${escapeHtml(unit.targetTemp)}` : ""}</span>
                                        `).join("")}
                                    </div>
                                ` : ""}
                            </article>
                        `;
                    }).join("")}
                </div>

                <div class="btn-row" style="margin-top:16px;">
                    <button class="btn btn-primary" id="saveEquipmentBtn" type="button">Gem udstyr</button>
                </div>
            `;

            stepContentEl.querySelectorAll("[data-equip-toggle]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const key = btn.dataset.equipToggle;
                    const current = state.equipment.selected[key] || { enabled: false, quantity: 1 };
                    state.equipment.selected[key] = {
                        ...current,
                        enabled: !current.enabled,
                        quantity: current.quantity || 1
                    };
                    buildUnitsFromEquipment();
                    saveDraftToLocalStorage();
                    render();
                });
            });

            stepContentEl.querySelectorAll("[data-equip-qty]").forEach((input) => {
                input.addEventListener("input", () => {
                    const key = input.dataset.equipQty;
                    const current = state.equipment.selected[key] || { enabled: true, quantity: 1 };
                    state.equipment.selected[key] = {
                        ...current,
                        quantity: Math.max(0, Number(input.value || 0))
                    };
                    buildUnitsFromEquipment();
                    updateSidebarStats();
                });
            });

            document.getElementById("saveEquipmentBtn").addEventListener("click", () => {
                buildUnitsFromEquipment();
                saveDraftToLocalStorage();
                render();
            });
        }

        function renderUploadPreview(items = []) {
            if (!items.length) {
                return `<div class="helper">Der er ikke valgt nogen fil</div>`;
            }

            return `
                <div class="upload-list">
                    ${items.map((item) => `
                        <div class="upload-item">
                            <img class="upload-thumb" src="${escapeHtml(item.secureUrl)}" alt="Upload">
                            <div class="upload-meta">
                                ${escapeHtml(item.originalFilename || "Billede")}<br>
                                Gemmes til: ${escapeHtml(item.routineTarget || item.sectionKey || "-")}
                            </div>
                        </div>
                    `).join("")}
                </div>
            `;
        }

        function getDefaultAnswer(sectionKey, questionId) {
            const section = PROGRAM_SECTIONS.find((item) => item.key === sectionKey);
            const question = section?.questions.find((item) => item.id === questionId);

            if (!question) return "";
            if (typeof question.dynamicAnswer === "function") {
                return question.dynamicAnswer() || "";
            }
            return question.defaultAnswer || "";
        }

        // ---- EGENKONTROLPROGRAM: ét af de 13 punkter ad gangen ----
        // Punkt-ID'er (section.key), rækkefølge, felter, svar og godkendelsesværdier er UÆNDREDE.
        // Totalen udledes af PROGRAM_SECTIONS (ingen hardkodet 13 i styringslogikken).
        let programCursor = 0;
        let programEditFromDone = false;

        function firstUnapprovedProgramIndex() {
            return PROGRAM_SECTIONS.findIndex((s) => !state.sections[s.key]?.approved);
        }
        function programApprovedCount() {
            return PROGRAM_SECTIONS.filter((s) => state.sections[s.key]?.approved).length;
        }
        function programFrontierIndex() {
            const u = firstUnapprovedProgramIndex();
            return u === -1 ? PROGRAM_SECTIONS.length - 1 : u;
        }
        function focusProgramHeading() {
            const h = stepContentEl.querySelector("[data-program-heading]");
            if (!h) return;
            h.setAttribute("tabindex", "-1");
            try { h.focus({ preventScroll: false }); } catch (e) { h.focus(); }
        }

        function renderProgramQuestions(section, store) {
            return section.questions.map((question) => {
                const isChoice = question.type === "choice";
                const answerValue = store.answers[question.id] ?? "";
                const choiceValue = store.choices[question.id] ?? "";
                const uploadTargets = (section.uploadTargets || []).filter((target) => target.questionId === question.id);

                return `
                    <div class="question-card">
                        <h4>${escapeHtml(question.label)}</h4>

                        ${isChoice ? `
                            <div class="chip-row">
                                ${(question.options || []).map((option) => `
                                    <button
                                        class="toggle-btn ${choiceValue === option ? "active" : ""}"
                                        type="button"
                                        data-choice-section="${escapeHtml(section.key)}"
                                        data-choice-question="${escapeHtml(question.id)}"
                                        data-choice-value="${escapeHtml(option)}"
                                    >${escapeHtml(option)}</button>
                                `).join("")}
                            </div>
                        ` : question.type === "text" ? `
                            <input data-answer-section="${escapeHtml(section.key)}" data-answer-question="${escapeHtml(question.id)}" value="${escapeHtml(answerValue)}">
                        ` : `
                            <textarea data-answer-section="${escapeHtml(section.key)}" data-answer-question="${escapeHtml(question.id)}">${escapeHtml(answerValue)}</textarea>
                        `}

                        <div class="btn-row" style="margin-top:12px;">
                            ${!isChoice ? `
                                <button class="answer-btn" type="button" data-default-section="${escapeHtml(section.key)}" data-default-question="${escapeHtml(question.id)}">Brug standardtekst</button>
                            ` : ""}
                            <button class="answer-btn" type="button" data-save-section="${escapeHtml(section.key)}">Gem svar</button>
                        </div>

                        ${uploadTargets.map((target) => `
                            <div class="upload-box">
                                <div class="helper">${escapeHtml(target.label)}</div>
                                <div class="btn-row" style="margin-top:10px;">
                                    <button class="btn btn-secondary" type="button" data-upload-section="${escapeHtml(target.sectionKey)}">Kamera</button>
                                    <button class="btn btn-soft" type="button" data-upload-section="${escapeHtml(target.sectionKey)}">Vælg fil</button>
                                </div>
                                ${renderUploadPreview(state.sections[target.sectionKey]?.images || [])}
                            </div>
                        `).join("")}
                    </div>
                `;
            }).join("");
        }

        // Entry: kaldes af render() ved hovednavigation. Åbner første ikke-godkendte punkt,
        // eller færdig-status hvis alle er godkendt.
        function renderProgramStep() {
            programEditFromDone = false;
            if (firstUnapprovedProgramIndex() === -1) {
                renderProgramDone();
            } else {
                programCursor = firstUnapprovedProgramIndex();
                renderProgramPoint();
            }
        }

        function renderProgramPoint() {
            const total = PROGRAM_SECTIONS.length;
            if (programCursor < 0) programCursor = 0;
            if (programCursor > total - 1) programCursor = total - 1;
            const idx = programCursor;
            const section = PROGRAM_SECTIONS[idx];
            const store = state.sections[section.key];
            const frontier = programFrontierIndex();
            const approvedN = programApprovedCount();

            const dots = PROGRAM_SECTIONS.map((s, i) => {
                const approved = !!state.sections[s.key]?.approved;
                const isCurrent = i === idx;
                const reachable = approved || i <= frontier;
                const sym = approved ? "✓" : (isCurrent ? "●" : "○");
                const word = approved ? "godkendt" : (isCurrent ? "aktuelt punkt" : "ikke behandlet endnu");
                const cls = `pp-dot${approved ? " done" : ""}${isCurrent ? " current" : ""}`;
                return `<button type="button" class="${cls}" data-program-goto="${i}" ${reachable ? "" : `disabled aria-disabled="true"`} aria-label="Punkt ${i + 1}: ${word}"><span aria-hidden="true">${sym}</span> ${i + 1}</button>`;
            }).join("");

            const longDesc = (section.description || "").length > 180;
            const descBlock = longDesc
                ? `<details class="pp-details"><summary>Vis forklaring</summary><p>${escapeHtml(section.description)}</p></details>`
                : `<p>${escapeHtml(section.description)}</p>`;

            const approveLabel = programEditFromDone
                ? "Gem og luk"
                : (idx === total - 1 ? "Godkend og afslut" : "Godkend og fortsæt");

            stepContentEl.innerHTML = `
                <div class="title-row">
                    <div>
                        <h2 data-program-heading tabindex="-1">${idx + 1}. ${escapeHtml(section.title)}</h2>
                        <p class="helper" aria-live="polite">Egenkontrolprogram – ${idx + 1} af ${total} · ${approvedN} af ${total} godkendt</p>
                    </div>
                    <div class="badge">Punkt ${idx + 1} / ${total}</div>
                </div>

                <div class="pp-status" role="group" aria-label="Status for de ${total} programpunkter">${dots}</div>

                <article class="program-card">
                    <div class="program-head">${descBlock}</div>
                    <div class="program-body">
                        ${renderProgramQuestions(section, store)}
                        ${store.approved ? `<div class="status-note">Dette punkt er godkendt – du kan rette og godkende igen.</div>` : ""}
                    </div>
                </article>

                <div class="pp-actions">
                    <button class="btn btn-secondary" type="button" data-program-back>${idx === 0 ? "← Til produktion" : "← Forrige punkt"}</button>
                    <button class="btn btn-primary approve-btn" type="button" data-program-approve>${approveLabel}</button>
                </div>
            `;

            nextStepBtn.style.display = "none";
            bindProgramEvents();
            bindProgramPointNav();
        }

        function renderProgramDone() {
            const total = PROGRAM_SECTIONS.length;
            const list = PROGRAM_SECTIONS.map((s, i) => `
                <li class="pp-done-item">
                    <span class="pp-done-check" aria-hidden="true">✓</span>
                    <span class="pp-done-title">${i + 1}. ${escapeHtml(s.title)}</span>
                    <button class="answer-btn" type="button" data-program-edit="${i}">Ret</button>
                </li>
            `).join("");

            stepContentEl.innerHTML = `
                <div class="title-row">
                    <div>
                        <h2 data-program-heading tabindex="-1">Egenkontrolprogram er gennemført</h2>
                        <p class="helper">Alle ${total} punkter er godkendt. Gennemse eller ret et punkt, eller fortsæt til kontrol og revision.</p>
                    </div>
                    <div class="badge">${total} / ${total} godkendt</div>
                </div>

                <ul class="pp-done-list">${list}</ul>

                <div class="pp-actions">
                    <button class="btn btn-secondary" type="button" data-program-back>← Til produktion</button>
                    <button class="btn btn-primary" type="button" data-program-continue>Fortsæt til kontrol og revision</button>
                </div>
            `;

            nextStepBtn.style.display = "none";

            stepContentEl.querySelectorAll("[data-program-edit]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    programEditFromDone = true;
                    programCursor = Number(btn.dataset.programEdit);
                    renderProgramPoint();
                    focusProgramHeading();
                });
            });
            const cont = stepContentEl.querySelector("[data-program-continue]");
            if (cont) cont.addEventListener("click", goToChecksFromProgram);
            const back = stepContentEl.querySelector("[data-program-back]");
            if (back) back.addEventListener("click", goToProductionFromProgram);

            focusProgramHeading();
        }

        function bindProgramPointNav() {
            stepContentEl.querySelectorAll("[data-program-goto]").forEach((btn) => {
                if (btn.hasAttribute("disabled")) return;
                btn.addEventListener("click", () => {
                    programEditFromDone = false;
                    programCursor = Number(btn.dataset.programGoto);
                    renderProgramPoint();
                    focusProgramHeading();
                });
            });

            const backBtn = stepContentEl.querySelector("[data-program-back]");
            if (backBtn) backBtn.addEventListener("click", () => {
                if (programEditFromDone) {
                    programEditFromDone = false;
                    renderProgramStep();
                    focusProgramHeading();
                    return;
                }
                if (programCursor > 0) {
                    programCursor -= 1;
                    renderProgramPoint();
                    focusProgramHeading();
                } else {
                    goToProductionFromProgram();
                }
            });

            const appBtn = stepContentEl.querySelector("[data-program-approve]");
            if (appBtn) appBtn.addEventListener("click", () => {
                const key = PROGRAM_SECTIONS[programCursor].key;
                state.sections[key].approved = true;
                saveDraftToLocalStorage();
                updateSaveIndicator("Punkt godkendt");
                updateSidebarStats();

                if (programEditFromDone) {
                    programEditFromDone = false;
                    renderProgramStep();
                    focusProgramHeading();
                    return;
                }
                const nextUn = firstUnapprovedProgramIndex();
                if (nextUn === -1) {
                    goToChecksFromProgram();
                } else {
                    programCursor = nextUn;
                    renderProgramPoint();
                    focusProgramHeading();
                }
            });
        }

        // Eksisterende validering: alle programpunkter skal være godkendt, før hovedflowet
        // fortsætter til det interne checks-trin.
        function goToChecksFromProgram() {
            if (firstUnapprovedProgramIndex() !== -1) {
                programEditFromDone = false;
                programCursor = firstUnapprovedProgramIndex();
                renderProgramPoint();
                updateSaveIndicator("Godkend alle punkter først");
                focusProgramHeading();
                return;
            }
            state.currentStep = STEP_DEFS.findIndex((s) => s.key === "checks");
            render();
            focusStepHeading();
        }

        function goToProductionFromProgram() {
            state.currentStep = STEP_DEFS.findIndex((s) => s.key === "production");
            render();
            focusStepHeading();
        }

        function renderChecksStep() {
            stepContentEl.innerHTML = `
                <div class="title-row">
                    <div>
                        <h2>Diverse, vedligeholdelse og årlig kontrol</h2>
                        <p>Her registreres APV, vedligeholdelse og skadedyrssikring samt den årlige kontrol og revision.</p>
                    </div>
                    <div class="badge">Trin 5 af 6</div>
                </div>

                <div class="section-stack">
                    ${CHECK_SECTIONS.map((section) => {
                        const store = state.checks[section.key];

                        return `
                            <article class="program-card">
                                <div class="program-head">
                                    <h3>${escapeHtml(section.title)}</h3>
                                    <p>Svar på hvert punkt med Ja, Nej eller Ikke relevant. Tilføj kommentar hvor det er nødvendigt.</p>
                                </div>

                                <div class="program-body">
                                    ${store.answers.map((item, index) => `
                                        <div class="question-card">
                                            <h4>${escapeHtml(item.label)}</h4>

                                            <div class="chip-row">
                                                ${["Ja", "Nej", "Ikke relevant"].map((value) => `
                                                    <button
                                                        class="toggle-btn ${item.value === value ? "active" : ""}"
                                                        type="button"
                                                        data-check-section="${escapeHtml(section.key)}"
                                                        data-check-index="${index}"
                                                        data-check-value="${escapeHtml(value)}"
                                                    >${escapeHtml(value)}</button>
                                                `).join("")}
                                            </div>

                                            <div class="field" style="margin-top:12px;">
                                                <label>Indtast evt. en kommentar</label>
                                                <textarea data-check-comment="${escapeHtml(section.key)}" data-check-index="${index}">${escapeHtml(item.comment || "")}</textarea>
                                            </div>

                                            <div class="btn-row">
                                                <button class="answer-btn" type="button" data-save-check="${escapeHtml(section.key)}">Gem svar</button>
                                            </div>
                                        </div>
                                    `).join("")}

                                    <div class="upload-box">
                                        <div class="helper">Kamera og filer kan bruges som dokumentation for sektionen.</div>
                                        <div class="btn-row" style="margin-top:10px;">
                                            <button class="btn btn-secondary" type="button" data-upload-check="${escapeHtml(section.key)}">Kamera</button>
                                            <button class="btn btn-soft" type="button" data-upload-check="${escapeHtml(section.key)}">Vælg fil</button>
                                        </div>
                                        ${renderUploadPreview(store.images || [])}
                                    </div>

                                    <div class="btn-row" style="margin-top:16px;">
                                        <button class="approve-btn ${store.approved ? "done" : ""}" type="button" data-approve-check="${escapeHtml(section.key)}">
                                            ${store.approved ? "Godkendt" : "Godkend"}
                                        </button>
                                    </div>

                                    ${store.approved ? `<div class="status-note">Sektionen er godkendt</div>` : ""}
                                </div>
                            </article>
                        `;
                    }).join("")}
                </div>
            `;

            bindCheckEvents();
        }

        function renderSummaryStep() {
            const exVat = PRICE_EX_VAT.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";
            const vat = (PRICE_EX_VAT * VAT_RATE).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";
            const inclVat = typeof getTotalInclVat === "function" ? getTotalInclVat() : "";

            stepContentEl.innerHTML = `
                <div class="title-row">
                    <div>
                        <h2>Opsummering og betaling</h2>
                        <p>Når du klikker Gem og betal, gemmes onboarding i Firestore, summary og credentials lægges i localStorage, og Stripe checkout starter med success tilbage til tak.html.</p>
                    </div>
                    <div class="badge">Trin 6 af 6</div>
                </div>

                <div class="notice ok">
                    Success URL sættes til <strong>${escapeHtml(window.location.origin)}/tak.html</strong>.
                </div>

                <div class="summary-grid">
                    <div class="summary-box">
                        <h4>Virksomhed</h4>
                        <ul class="summary-list">
                            <li>${escapeHtml(state.company.name || "-")}</li>
                            <li>${escapeHtml([state.company.address, state.company.zip, state.company.city].filter(Boolean).join(", ") || "-")}</li>
                            <li>CVR: ${escapeHtml(state.company.cvr || "-")}</li>
                            <li>Email: ${escapeHtml(state.company.email || "-")}</li>
                        </ul>
                    </div>

                    <div class="summary-box">
                        <h4>Produktion</h4>
                        <ul class="summary-list">
                            <li>Branche: ${escapeHtml(state.company.businessType || "-")}</li>
                            <li>Produktion: ${escapeHtml(state.business.productionTypes.join(", ") || "-")}</li>
                            <li>Produkter: ${escapeHtml(state.business.products.join(", ") || "-")}</li>
                        </ul>
                    </div>

                    <div class="summary-box">
                        <h4>Udstyr og enheder</h4>
                        <ul class="summary-list">
                            ${state.equipment.units.length
                                ? state.equipment.units.map((unit) => `<li>${escapeHtml(unit.name)}${unit.targetTemp ? ` · ${escapeHtml(unit.targetTemp)}` : ""}</li>`).join("")
                                : "<li>Ingen enheder valgt endnu</li>"}
                        </ul>
                    </div>

                    <div class="summary-box">
                        <h4>Dokumentation</h4>
                        <ul class="summary-list">
                            <li>Godkendte sektioner: ${getApprovedCount()}</li>
                            <li>Uploadede billeder: ${getUploadCount()}</li>
                            <li>Egenkontrolprogram-sektioner: ${PROGRAM_SECTIONS.length}</li>
                            <li>Kontrolsektioner: ${CHECK_SECTIONS.length}</li>
                        </ul>
                    </div>
                </div>

                <div class="price-panel">
                    <div class="price-row">
                        <span>Pris ekskl. moms</span>
                        <strong>${exVat}</strong>
                    </div>
                    <div class="price-row">
                        <span>Moms 25%</span>
                        <strong>${vat}</strong>
                    </div>
                    <div class="price-row total">
                        <span>I alt inkl. moms</span>
                        <strong>${inclVat}</strong>
                    </div>
                </div>

                <div class="notice info" style="margin-top: 24px;">
                    <strong>Vælg betalingsplan:</strong><br>
                    Betal månedligt eller spar 10% ved årlig betaling.
                </div>

                <div class="btn-row" style="margin-top: 20px; gap: 16px;">
                    <button class="btn btn-primary" id="payMonthlyBtn" type="button" style="flex: 1; min-height: 64px; font-size: 16px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <strong>Betal månedligt</strong>
                            <span style="font-size: 14px; opacity: 0.9;">186,25 kr/md inkl. moms</span>
                        </div>
                    </button>
                    <button class="btn btn-soft" id="payYearlyBtn" type="button" style="flex: 1; min-height: 64px; font-size: 16px; background: linear-gradient(180deg, #eaf6eb 0%, #d2ebd4 100%); border-color: #9bc8a0;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <strong>Betal årligt (Spar 10%)</strong>
                            <span style="font-size: 14px; opacity: 0.9;">2.011,50 kr/år inkl. moms</span>
                        </div>
                    </button>
                </div>
            `;

            document.getElementById("payMonthlyBtn").addEventListener("click", () => handleSubmit("monthly"));
            document.getElementById("payYearlyBtn").addEventListener("click", () => handleSubmit("yearly"));
        }

        function bindProgramEvents() {
            stepContentEl.querySelectorAll("[data-answer-section]").forEach((input) => {
                input.addEventListener("input", () => {
                    const sectionKey = input.dataset.answerSection;
                    const questionId = input.dataset.answerQuestion;
                    state.sections[sectionKey].answers[questionId] = input.value;
                });
            });

            stepContentEl.querySelectorAll("[data-choice-section]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const sectionKey = btn.dataset.choiceSection;
                    const questionId = btn.dataset.choiceQuestion;
                    state.sections[sectionKey].choices[questionId] = btn.dataset.choiceValue;
                    saveDraftToLocalStorage();
                    renderProgramPoint();
                });
            });

            stepContentEl.querySelectorAll("[data-default-section]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const sectionKey = btn.dataset.defaultSection;
                    const questionId = btn.dataset.defaultQuestion;
                    state.sections[sectionKey].answers[questionId] = getDefaultAnswer(sectionKey, questionId);
                    saveDraftToLocalStorage();
                    renderProgramPoint();
                });
            });

            stepContentEl.querySelectorAll("[data-save-section]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    saveDraftToLocalStorage();
                    updateSaveIndicator("Svar gemt");
                });
            });

            stepContentEl.querySelectorAll("[data-approve-section]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    state.sections[btn.dataset.approveSection].approved = true;
                    saveDraftToLocalStorage();
                    render();
                });
            });

            stepContentEl.querySelectorAll("[data-upload-section]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    openImagePickerForTarget({
                        type: "section",
                        sectionKey: btn.dataset.uploadSection
                    });
                });
            });
        }

        function bindCheckEvents() {
            stepContentEl.querySelectorAll("[data-check-section]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const sectionKey = btn.dataset.checkSection;
                    const index = Number(btn.dataset.checkIndex);
                    state.checks[sectionKey].answers[index].value = btn.dataset.checkValue;
                    saveDraftToLocalStorage();
                    render();
                });
            });

            stepContentEl.querySelectorAll("[data-check-comment]").forEach((textarea) => {
                textarea.addEventListener("input", () => {
                    const sectionKey = textarea.dataset.checkComment;
                    const index = Number(textarea.dataset.checkIndex);
                    state.checks[sectionKey].answers[index].comment = textarea.value;
                });
            });

            stepContentEl.querySelectorAll("[data-save-check]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    saveDraftToLocalStorage();
                    updateSaveIndicator("Kontrolsvar gemt");
                });
            });

            stepContentEl.querySelectorAll("[data-approve-check]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    state.checks[btn.dataset.approveCheck].approved = true;
                    saveDraftToLocalStorage();
                    render();
                });
            });

            stepContentEl.querySelectorAll("[data-upload-check]").forEach((btn) => {
                btn.addEventListener("click", () => {
                    openImagePickerForTarget({
                        type: "check",
                        sectionKey: btn.dataset.uploadCheck
                    });
                });
            });
        }

        let pendingUploadTarget = null;

        function openImagePickerForTarget(target) {
            pendingUploadTarget = target;
            hiddenImageInput.value = "";
            hiddenImageInput.click();
        }

        function getUploadMeta(target) {
            const map = ONBOARDING_ROUTINE_MAP[target.sectionKey] || {};
            return {
                sectionKey: target.sectionKey,
                routineTarget: map.routineTarget || target.sectionKey,
                subType: map.subType || "",
                guideKey: map.guideKey || ""
            };
        }

        hiddenImageInput.addEventListener("change", async (event) => {
            const file = event.target.files?.[0];
            if (!file || !pendingUploadTarget) return;

            try {
                updateSaveIndicator("Uploader billede...");
                await uploadImageToCloudinary(file, pendingUploadTarget);
                saveDraftToLocalStorage();
                render();
                updateSaveIndicator("Billede gemt til rutinen");
            } catch (error) {
                console.error(error);
                alert("Kunne ikke uploade billedet.");
                updateSaveIndicator("Upload fejlede");
            } finally {
                pendingUploadTarget = null;
                hiddenImageInput.value = "";
            }
        });

        async function uploadImageToCloudinary(file, target) {
            const profile = getProfile();
            const companyId = String(profile.companyId || "company_1").trim();
            const locationId = String(profile.locationId || "location_1").trim();
            const meta = getUploadMeta(target);

            const signatureResult = await getCloudinarySignatureCallable({
                companyId,
                locationId,
                moduleType: "Egenkontrol",
                itemId: meta.sectionKey
            });

            const signatureData = signatureResult?.data || {};
            if (!signatureData.cloudName || !signatureData.apiKey || !signatureData.timestamp || !signatureData.signature) {
                throw new Error("Cloudinary signaturdata mangler.");
            }

            const formData = new FormData();
            formData.append("file", file);
            formData.append("api_key", signatureData.apiKey);
            formData.append("timestamp", String(signatureData.timestamp));
            formData.append("signature", signatureData.signature);
            formData.append("folder", signatureData.folder);
            formData.append("public_id", signatureData.publicId);
            if (signatureData.tags) {
                formData.append("tags", signatureData.tags);
            }
            if (signatureData.context) {
                formData.append("context", signatureData.context);
            }

            const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`, {
                method: "POST",
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error(await uploadResponse.text());
            }

            const uploadData = await uploadResponse.json();

            let analysisData = null;
            try {
                const analysisResult = await analyzeCloudinaryAssetCallable({
                    publicId: uploadData.public_id,
                    secureUrl: uploadData.secure_url,
                    companyId,
                    locationId,
                    sectionKey: meta.sectionKey
                });
                analysisData = analysisResult?.data || null;
            } catch (error) {
                console.warn("Asset analyse fejlede:", error);
            }

            const item = {
                provider: "cloudinary",
                publicId: uploadData.public_id,
                secureUrl: uploadData.secure_url,
                originalFilename: uploadData.original_filename || file.name,
                width: uploadData.width || null,
                height: uploadData.height || null,
                bytes: uploadData.bytes || file.size || null,
                createdAt: new Date().toISOString(),
                sectionKey: meta.sectionKey,
                routineTarget: meta.routineTarget,
                subType: meta.subType,
                guideKey: meta.guideKey,
                analysis: analysisData
            };

            if (target.type === "section") {
                if (!state.sections[target.sectionKey]) {
                    state.sections[target.sectionKey] = { approved: false, answers: {}, choices: {}, images: [] };
                }
                state.sections[target.sectionKey].images.push(item);
            } else {
                state.checks[target.sectionKey].images.push(item);
            }
        }

        function buildOnboardingProfile() {
            const sel = state.equipment.selected || {};
            const qty = (key) => Number((sel[key] || {}).quantity || 0);
            const has = (key) => !!(sel[key] || {}).enabled && qty(key) > 0;
            const pt  = state.business.productionTypes || [];
            const inc = (s) => pt.some(t => t.toLowerCase().includes(s.toLowerCase()));

            return {
                // Company info
                companyName:    state.company.name     || "",
                ownerName:      state.company.leader   || "",
                phone:          state.company.phone    || "",
                cvr:            state.company.cvr      || "",
                address:        state.company.address  || "",
                zip:            state.company.zip      || "",
                city:           state.company.city     || "",
                accountEmail:   state.company.email    || "",
                companyType:    state.company.businessType || "",

                // Equipment counts
                antalKoeleskabe:    qty("fridges"),
                antalFrysere:       qty("freezers"),
                hasWalkInCooler:    has("walkInCoolers"),
                hasWalkInFreezer:   has("walkInFreezers"),
                hasIceMachine:      has("iceMachines"),
                hasIsboks:          has("isbokse"),
                hasFrituregryde:    has("frityreGryder"),
                hasDishwasher:      has("dishwashers"),
                antalIsterningemaskiner: qty("iceMachines"),
                antalIsbokse:       qty("isbokse"),
                antalFrityreGryder: qty("frityreGryder"),
                hasHotHoldingUnit:  has("hotHoldingUnits"),
                hasCoolingUnit:     has("coolingUnits"),
                hasReheatingUnit:   has("reheatingUnits"),
                walkInCoolerCount:  qty("walkInCoolers"),
                walkInFreezerCount: qty("walkInFreezers"),

                // Food process booleans derived from equipment + production types
                receivesChilledGoods:   has("fridges") || has("walkInCoolers") || inc("Vare modtagelse"),
                receivesFrozenGoods:    has("freezers") || has("walkInFreezers"),
                receivesRoomTempGoods:  true,
                storesChilledGoods:     has("fridges") || has("walkInCoolers"),
                storesFrozenGoods:      has("freezers") || has("walkInFreezers"),
                storesRoomTempGoods:    true,
                preparesHotFood:        inc("Opvarmning") || inc("Tilberedning"),
                preparesColdFood:       has("fridges") || has("walkInCoolers"),
                holdsHotFood:           has("hotHoldingUnits") || inc("Varmholdelse"),
                coolsHotFood:           has("coolingUnits") || inc("Nedkøling"),
                reheatsFood:            has("reheatingUnits") || inc("Genopvarmning"),
                handlesDifferentFoods:  inc("Adskillelse") || true,
                handlesAllergens:       true,
                sellsPackagedChilled:   has("fridges"),
                sellsUnpackagedChilled: has("fridges"),
                cleansDishwasher:       has("dishwashers"),
                hasIsterningemaskine:   has("iceMachines"),
                dateControlRequired:    inc("Dato kontrol") || true,
            };
        }

        async function isAlreadyPaid() {
            const user = auth.currentUser;
            if (!user) return false;
            try {
                const userSnap = await getDoc(doc(db, "users", user.uid));
                if (userSnap.exists()) {
                    const d = userSnap.data();
                    if (d.onboardingStatus === "completed") return true;
                    if (d.subscriptionStatus === "active") return true;
                }
                const profile = getProfile();
                const companyId = String(profile.companyId || "company_1").trim();
                const locationId = String(profile.locationId || "location_1").trim();
                const draftSnap = await getDoc(doc(db, "onboarding_answers", `${companyId}__${locationId}`));
                if (draftSnap.exists() && draftSnap.data().status === "completed") return true;
            } catch (e) {
                console.warn("isAlreadyPaid check fejl:", e);
            }
            return false;
        }

        async function saveOnboardingToFirestore() {
            console.log("[saveOnboardingToFirestore] START");

            const profile = getProfile();
            const user = auth.currentUser;

            console.log("[saveOnboardingToFirestore] user:", user?.uid || "NO USER");

            const companyId = String(profile.companyId || "company_1").trim();
            const locationId = String(profile.locationId || "location_1").trim();
            const docId = `${companyId}__${locationId}`;

            console.log("[saveOnboardingToFirestore] docId:", docId);

            const payload = {
                companyId,
                locationId,
                userId: user?.uid || "anonymous",
                company: state.company,
                profile: buildOnboardingProfile(),
                business: {
                    ...state.business,
                    type: state.company.businessType || state.business.type || ""
                },
                equipment: state.equipment,
                sections: state.sections,
                checks: state.checks,
                price: {
                    exVat: PRICE_EX_VAT,
                    vatRate: VAT_RATE,
                    inclVat: PRICE_EX_VAT * (1 + VAT_RATE)
                },
                updatedAt: serverTimestamp(),
                createdByName: user?.displayName || state.company.name || "Ukendt"
            };

            console.log("[saveOnboardingToFirestore] about to write to Firestore collection: onboarding_answers");
            console.log("[saveOnboardingToFirestore] path: onboarding_answers/" + docId);

            try {
                await setDoc(doc(db, "onboarding_answers", docId), payload, { merge: true });
                console.log("[saveOnboardingToFirestore] Firestore write SUCCESS");
                updateSaveIndicator("Onboarding gemt");
            } catch (error) {
                console.error("[saveOnboardingToFirestore] Firestore write FAILED:", error);
                console.error("[saveOnboardingToFirestore] error code:", error?.code);
                console.error("[saveOnboardingToFirestore] error message:", error?.message);
                throw error;
            }
        }

        function buildCheckoutSummary() {
            const criticalPoints = [
                ...state.business.productionTypes.slice(0, 2),
                ...(state.equipment.units.slice(0, 1).map((unit) => unit.label || unit.name))
            ].filter(Boolean).slice(0, 3);

            return {
                companyName: state.company.name || "Madkontrollen Pro kunde",
                companyType: state.company.businessType || "Restaurant",
                city: state.company.city || "Ikke angivet",
                criticalPoints: criticalPoints.length ? criticalPoints : ["Køl", "Opvarmning", "Allergener"]
            };
        }

        async function handleSubmit(billingPlan = "monthly") {
            if (isSubmitting) {
                console.log("[onboarding] handleSubmit blocked: already submitting");
                return;
            }
            isSubmitting = true;

            const submitBtn = document.getElementById("submitBtn");
            const originalBtnText = submitBtn ? submitBtn.innerHTML : "";

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = "Opretter...";
                }

                console.log("[onboarding] handleSubmit START", { billingPlan });

                // Validate email and password before proceeding
                if (!state.company.email.trim() || !state.company.accountPassword) {
                    console.error("[onboarding] ABORT: missing email or password");
                    alert("Indtast login email og password under Virksomhed før betaling.");
                    state.currentStep = 0;
                    render();
                    return;
                }

                console.log("[onboarding] email and password OK");
                console.log("[onboarding] building profile and payload...");

                const profile = getProfile();
                const companyId = String(profile.companyId || "company_1").trim();
                const locationId = String(profile.locationId || "location_1").trim();

                console.log("[onboarding] profile built", { companyId, locationId });

                const checkoutSummary = buildCheckoutSummary();

                console.log("[onboarding] saving to localStorage...");
                localStorage.setItem(
                    "mkp_onboarding_checkout_summary_v1",
                    JSON.stringify(checkoutSummary)
                );

                localStorage.setItem(
                    "mkp_onboarding_credentials_v1",
                    JSON.stringify({
                        email: state.company.email,
                        password: state.company.accountPassword
                    })
                );

                console.log("[onboarding] localStorage saved");

                // Build FULL payload for backend to save
                const payload = {
                    draftType: "egenkontrol_onboarding",
                    onboardingType: "egenkontrol",
                    selectedModules: ["egenkontrol"],
                    billingPlan: billingPlan,
                    companyId,
                    locationId,
                    company: state.company,
                    profile: buildOnboardingProfile(),
                    business: {
                        ...state.business,
                        type: state.company.businessType || state.business.type || ""
                    },
                    equipment: state.equipment,
                    sections: state.sections,
                    checks: state.checks,
                    price: {
                        exVat: PRICE_EX_VAT,
                        vatRate: VAT_RATE,
                        inclVat: PRICE_EX_VAT * (1 + VAT_RATE)
                    },
                    checkoutSummary,
                    customer: {
                        email: state.company.email.trim(),
                        name: state.company.name || ""
                    },
                    successUrl: `${window.location.origin}/tak.html`,
                    cancelUrl: window.location.href
                };

                console.log("[onboarding] payload built with full onboarding data");

                localStorage.removeItem(ONBOARDING_DRAFT_KEY);
                console.log("[onboarding] draft removed from localStorage");

                updateSaveIndicator("Starter betaling...");

                // Backend will save all data to onboarding_checkout_drafts
                // Always proceed to checkout - no early return based on alreadyPaid
                console.log("[onboarding] calling saveOnboardingAndStartCheckout (backend will save data)");
                const result = await createOnboardingCheckoutSessionCallable(payload);

if (!result?.data?.url) {
    throw new Error("Checkout URL mangler fra backend");
}

window.location.href = result.data.url;

                console.log("[onboarding] saveOnboardingAndStartCheckout completed (should redirect)");

            } catch (error) {
                console.error("[onboarding] handleSubmit FAILED:", error);
                console.error("[onboarding] error code:", error?.code);
                console.error("[onboarding] error message:", error?.message);
                console.error("[onboarding] error stack:", error?.stack);

                const errorMsg = error?.message || "Der opstod en fejl under oprettelsen.";
                alert(`Fejl: ${errorMsg}\n\nSe console for detaljer.`);
                updateSaveIndicator("Betaling kunne ikke startes");
            } finally {
                isSubmitting = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
                console.log("[onboarding] handleSubmit END");
            }
        }

        async function updateSubmitBtnLabel() {
            const paid = await isAlreadyPaid();
            submitBtn.textContent = paid ? "Gem ændringer" : "Gem og betal";
        }

        function render() {
            renderStepNav();
            updateProgress();
            updateSidebarStats();

            switch (STEP_DEFS[state.currentStep].key) {
                case "company":
                    renderCompanyStep();
                    break;
                case "production":
                    renderProductionStep();
                    break;
                case "equipment":
                    renderEquipmentStep();
                    break;
                case "program":
                    renderProgramStep();
                    break;
                case "checks":
                    renderChecksStep();
                    break;
                case "summary":
                    renderSummaryStep();
                    break;
                default:
                    renderCompanyStep();
                    break;
            }
        }

        prevStepBtn.addEventListener("click", () => {
            if (state.currentStep > 0) {
                state.currentStep -= 1;
                render();
                focusStepHeading();
            }
        });

        nextStepBtn.addEventListener("click", () => {
            if (state.currentStep < STEP_DEFS.length - 1) {
                state.currentStep += 1;
                render();
                focusStepHeading();
            }
        });

        saveDraftBtn.addEventListener("click", () => {
            console.log("[Gem kladde] Saving draft to localStorage only...");
            saveDraftToLocalStorage();
            alert("Kladde gemt! Du kan lukke siden og vende tilbage senere.");
            console.log("[Gem kladde] Draft saved successfully");
        });

        submitBtn.addEventListener("click", handleSubmit);

        updateSubmitBtnLabel();

        buildUnitsFromEquipment();
        ensureProductsFromType();
        syncDynamicAnswers();
        render();
