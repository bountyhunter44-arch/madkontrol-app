/**
 * Egenkontrol Generator
 * Auto-generates egenkontrol program from HACCP snapshot with branch-specific texts
 */

// Branch texts from risk analysis (CCP = Critical Control Points, GAG = Good Practice)
const BRANCH_TEXTS = {
    // CCP 1: Varemodtagelse
    varemodtagelse: {
        ccp: true,
        title: "Varemodtagelse",
        description: "Ved modtagelse af kølevarer skal temperaturen være korrekt. Virksomheden sikrer at temperaturer ved modtagelse af fødevarer skrives temperatur ned ved hjemkomst.",
        criticalLimits: {
            kolevarer: "Max +5°C (med mindre lavere temperaturer er angivet i holdbarhedsmærkning)",
            frostvarer: "Max -18°C",
            emballage: "Emballage skal være intakt",
            maerkning: "Mærkning skal være korrekt"
        },
        controls: "Varemodtagelse",
        products: "Forudproduceret mad, rester, varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign., Kolde retter, forretter, salater o.lign., varme retter, suppe, grydesteg o.lign., Forudproduceret mad, rester, Grønt tilbehør, forudproduktion",
        ingredients: "Pasteuriserede æg; Varmebehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Pasteuriserede mælkeprodukter; Frosne råvarer; Rå kød; Frosne bær",
        howOften: "Ved hver varemodtagelse",
        whatToDo: "Beskriv hvad du gør, når du konstaterer fejl. Det kan for eksempel være:\n- Varerne returneres\n- Varerne vurderes og anvendes straks, hvis dette ikke udgør nogen risiko\n- Varerne vurderes og kasseres\n- Leverandøren kontaktes"
    },

    // CCP 2: Opbevaring køl og frost
    opbevaringKoelFrost: {
        ccp: true,
        title: "Opbevaring køl og frost",
        description: "Når fødevarer bliver opbevaret koldt, hæmmes bakteriers vækst. Virksomheden sikrer at temperaturer ved opbevaring i køle- og fryserum, samt andet er opbevaret ved den lovpligtige temperatur.",
        criticalLimits: {
            koeleskab: "0-5°C",
            fryser: "-18°C eller koldere",
            holdbarhed: "Holdbarhed på varer. Varer med 'sidst anvendelsesdato' må ikke anvendes eller sælges efter udløb. Fødevarer mærket med 'bedst før' kan anvendes eller sælges efter udløb, at fødevaren stadig er egnet til konsum",
            placering: "Placering af fødevarerne. Er der adskillelse mellem råt kød, tilberedte fødevarer, grøntsager m.m.?",
            optaening: "Optæning af fødevarer skal ske på køl, og man skal også sørge for, at varer under optæning ikke kontaminerer andre fødevarer, f.eks. med dryp af kødssaft fra den optøede vare til andre varer"
        },
        controls: "Køleskab 1 (+5), Køleskab 2 (+5), Køleskab 3 (+5), Lille displaykøleskab (+5)",
        products: "Forudproduceret mad, rester, varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign., Kolde retter, forretter, salater o.lign., varme retter, suppe, grydesteg o.lign., Forudproduceret mad, rester",
        ingredients: "Pasteuriserede æg; Varmebehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Pasteuriserede mælkeprodukter; Frosne råvarer; Rå kød; Frosne bær",
        howOften: "1 gang pr. uge eller andet",
        whatToDo: "Hvis køle- og fryseskabe ikke kan holde de temperaturer, som fødevarerne kræver, skal virksomheden tage stilling til, om varerne kan anvendes eller om varerne skal kasseres. For eksempel må færdigpakkede fødevarer, som har været opbevaret ved for høj temperatur ikke sælges."
    },

    // CCP 3: Opvarmning/varmebehandling
    opvarmning: {
        ccp: true,
        title: "Opvarmning/varmebehandling og nedkøling",
        description: "Risiko for tilstedeværelse af sygdomsfremkaldende bakterier pga. utilstrækkelig opvarmning. Det er også risiko for overlevelse af Bacillus cereus og Campylobacter der kan give risiko for fødevarebårne sygdomme. Bakterierne bliver dræbt eller begrænset mest muligt ved at opvarme fødevarer til minimum 75°C.",
        criticalLimits: {
            kernetemperatur: "Minimum 75°C i kernen i minimum 2 minutter",
            fjerkrae: "Fjerkræ: Minimum 75°C (anbefalet 80°C)",
            hakketkoed: "Hakket kød: Minimum 75°C",
            genopvarmning: "Genopvarmning: Minimum 75°C i kernen",
            maaling: "Mål med kalibreret kernetermometer i tykkeste del"
        },
        controls: "Varmebehandling af fødevarer, Genopvarmning af fødevarer",
        products: "Forudproduceret mad, rester, varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign., varme retter, suppe, grydesteg o.lign., Forudproduceret mad, rester, Grønt tilbehør, forudproduktion",
        ingredients: "Rå fisk og skaldyr; Varmebehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og frø; Ris, pasta og tørrede bønner; Mel, korn og kornprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Rå æg; Råt kød; Frosne bær",
        howOften: "1 gang om ugen eller andet",
        nedkoeling: {
            description: "Varmebehandlede fødevarer, der skal opbevares eller serveres ved lave temperaturer, skal hurtigst muligt nedkøles. Hvis temperaturen falder fra 65 °C til 10 °C på højest fire timer, er nedkølingen sikker.",
            criticalLimits: "Nedkølingen fra 65°C til 10°C må ikke vare mere end 4 timer. Derefter skal fødevarerne opbevares ved max. 5°C",
            whatToDo: "Hvis maden ikke er nedkølet til 10 °C på max 4 timer, kan maden straks genopvarmes til 75 °C og igen nedkøles. Hvis maden ikke straks genopvarmes til 75 °C, skal den kasseres."
        }
    },

    // CCP 4: Varmholdelse
    varmholdelse: {
        ccp: true,
        title: "Varmholdelse/Salg af fødevarer uden køl",
        description: "Der er risiko for vækst af sygdomsfremkaldende bakterier i varmebehandlede produkter efter opvarmning, hvis ikke varmebehandlede fødevarer køles effektivt. Det kan især være tilfældet, hvis ikke varmebehandlede fødevarer opbevares ved 5°C eller under.",
        criticalLimits: {
            temperatur: "Minimum 65°C overalt i fødevaren",
            tid: "Fødevarer må ikke opbevares i mere end 3 timer ved temperaturer mellem 5°C og 65°C"
        },
        controls: "Varmholdelse (+65)",
        products: "varme retter, suppe, grydesteg o.lign.",
        ingredients: "Rå æg; Pasteuriserede æg; Rå fisk og skaldyr; Varmebehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Frosne bær; Nødder og frø; Ris, pasta og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer",
        howOften: "1 gang om ugen eller andet",
        whatToDo: "Hvis temperaturen i fødevarerne er mindre end 65 °C, skal fødevaren som udgangspunkt kasseres. Fejl skal altid dokumenteres på skemaet."
    },

    // GAG: Adskillelse
    adskillelse: {
        ccp: false,
        gag: true,
        title: "Adskillelse",
        description: "For at sikre der ikke sker krydsforurening med sygdomsfremkaldende bakterier mellem forskellige fødevarer, skal der ske adskillelse af råt kød, tilberedte fødevarer m.m. og opbevaring.",
        controls: "Løbende, at fødevarerne holdes adskilte under produktion og opbevaring",
        howToDo: "I køleskabe (beskriv eller vedlæg tegning):\n- At rengøre knive, spækbrætter, bordplader, snittemaski ved skift mellem håndtering af fødevarer\n- At anvende forskellige områder i køkkenet og skærebrætter til de forskellige typer af fødevarer\n- At der udføres tidsforskudt produktion og rengøring efter skift mellem håndtering af fødevarer\n- At placere fødevarerne tildækket og adskilt",
        whatToDo: "Vurder om varen kan anvendes ved f.eks. efterfølgende opvarmning eller kassér varen.\n\nHvordan adskilles fødevarer:\n- I køleskabe (beskriv eller vedlæg tegning)\n- Under produktion (beskriv områder eller tidsforskudt adskilt)"
    },

    // GAG: Personlig hygiejne
    personligHygiejne: {
        ccp: false,
        gag: true,
        title: "Personlig hygiejne",
        description: "En håndvask til vask af hænder er normalt selvstændigt placeret vask med blandingsbatteri, der ikke er identisk med vaske til fødevarer eller til opvask. Der skal være et tilstrækkeligt antal håndvaske og altid håndvaske i toiletområder. Håndvaske skal have rindende varm og koldt vand af drikkevandskvalitet.",
        rules: {
            arbejdstoj: "Brug rent arbejdstøj: Når der skiftes arbejdsopgaver kan det være nødvendigt at skifte tøj",
            vaskHaender: "Vask hænder:\n- Inden du begynder at arbejde med fødevarer\n- Når du skifter arbejdsproces\n- Når du har været på toilettet\n- Når du kommer fra pause\n- Når det er nødvendigt f.eks. efter nys",
            sygdom: "Sygdom: Har du væskende sår, diarré eller andre infektionssygdomme, som kan smitte via fødevarer, skal du henvende dig til virksomhedslederen. Det er efterfølgende virksomhedslederens ansvar at vurdere, hvordan du kan genoptage arbejdet. For medarbejdere med norovirus-infektion, også kendt som roskildesyge anbefales det, at man er sygemeldt indtil 48 timer efter, at symptomerne er stoppet. De nærmere regler for arbejde og sygdom kan findes i hygiejneforordningens bilag II, kap. 8, stk. 2",
            rygning: "Rygning: Der må ikke ryges, hvor der produceres/opbevares fødevarer",
            andreRegler: "Andre regler:\n- Smykker (skriv)\n- Hovedbeklædning (skriv)\n- Arbejdsfunktioner udenfor fødevaredelen f.eks. plejeopgaver og rengøring (skriv)"
        }
    },

    // GAG: Rengøring og desinfektion
    rengoering: {
        ccp: false,
        gag: true,
        title: "Rengøring og desinfektion",
        description: "Rengøring og desinfektion af produktionslokaler og redskaber skal sikre, at alle maskiner, arbejdsredskaber, inventar og lokaler bliver beskrevet i rengøringsplanen. Udpeg de maskiner og områder mv., der skal desinficeres og mærk dette i rengøringsplanen med D.",
        methods: {
            opvaskemaskine: "Desinfektion kan foregå i opvaskemaskine med skyllevandtemperatur på min. 80 °C",
            kogning: "Eller desinfektion kan foregå ved overhældning med kogende vand",
            kemisk: "Eller med et desinfektionsmiddel egnet til brug i fødevarevirksomheder. Et desinfektionsmiddel til brug i fødevarevirksomheder kan enten være godkendt af Fødevarestyrelsen eller Miljøstyrelsen. Produkter godkendt af Fødevarestyrelsen er opført på denne liste, og produkter godkendt af Miljøstyrelsen kan findes i ECHA's database over godkendte produkter"
        },
        controls: "Skyllevand opvaskemaskine (+80)",
        howOften: "Rengøring kontrolleres dagligt, inden produktionens begyndelse",
        whatToDo: "Er rengøring ikke i orden, gøres der rent inden opstart"
    }
};

/**
 * Generate egenkontrol program from HACCP snapshot
 */
export function generateEgenkontrolProgram(haccpSnapshot) {
    const profile = haccpSnapshot.profile || {};
    const haccp = haccpSnapshot.haccp || {};
    const kcps = haccp.kcps || [];
    
    const program = {
        virksomhedsoplysninger: {
            navn: profile.companyName || '',
            adresse: profile.address || '',
            postnr: profile.zip || '',
            by: profile.city || '',
            cvr: profile.cvr || '',
            autoriseret: profile.autorisationNumber || '',
            leder: '',
            importModtagelse: profile.receivesChilledGoods || profile.receivesFrozenGoods ? 'ja' : 'nej',
            produkter: profile.products || []
        },
        
        aktiviteter: generateAktiviteter(profile, kcps),
        
        skemaer: {
            skema1_varemodtagelse: generateSkema1(profile, kcps),
            skema2_koelFrost: generateSkema2(profile, kcps),
            skema3_opvarmningNedkoeling: generateSkema3(profile, kcps),
            skema4_varmholdelse: generateSkema4(profile, kcps),
            skema5_rengoeringsplan: generateSkema5(profile, kcps),
            skema6_vedligeholdelse: generateSkema6(profile),
            skema7_aarligRevision: generateSkema7()
        },
        
        procedurer: generateProcedurer(profile, kcps)
    };
    
    return program;
}

/**
 * Generate aktiviteter checklist from profile
 */
function generateAktiviteter(profile, kcps) {
    return {
        varemodtagelse: {
            aktiv: !!(profile.receivesChilledGoods || profile.receivesFrozenGoods || profile.receivesRoomTempGoods),
            kontrolleres: 'Ved hver varemodtagelse',
            skrivesNed: '1 gang pr. uge andet'
        },
        opbevaringKoelFrost: {
            aktiv: !!(profile.fridgeCount > 0 || profile.freezerCount > 0),
            kontrolleres: 'Dagligt',
            skrivesNed: '1 gang pr. uge eller andet'
        },
        opvarmningVarmebehandling: {
            aktiv: !!profile.preparesHotFood,
            kontrolleres: 'Hver gang',
            skrivesNed: '1 gang pr. uge andet'
        },
        nedkoeling: {
            aktiv: !!profile.coolsHotFood,
            kontrolleres: 'Hver gang',
            skrivesNed: '1 gang pr. uge andet'
        },
        varmholdelse: {
            aktiv: !!(profile.holdsHotFood || profile.hasHotHolding),
            kontrolleres: 'Hver gang',
            skrivesNed: '1 gang pr. uge andet'
        },
        salgUdenKoel: {
            aktiv: false,
            kontrolleres: 'Løbende',
            skrivesNed: 'Kun ved fejl'
        },
        adskillelse: {
            aktiv: !!profile.handlesDifferentFoods,
            kontrolleres: 'Dagligt',
            skrivesNed: 'Kun ved fejl'
        },
        vareudbringning: {
            aktiv: false,
            kontrolleres: 'Hver gang',
            skrivesNed: 'Kun ved fejl'
        },
        rengoering: {
            aktiv: true,
            kontrolleres: 'Dagligt',
            skrivesNed: '-'
        },
        personligHygiejne: {
            aktiv: true,
            kontrolleres: 'Dagligt',
            skrivesNed: '-'
        },
        vedligeholdelse: {
            aktiv: true,
            kontrolleres: 'Løbende',
            skrivesNed: 'Løbende og ved mangler/skadedyr. Min. 1 gang pr. år'
        },
        sporbarhed: {
            aktiv: true,
            kontrolleres: '-',
            skrivesNed: 'Fakturaer skal kunne fremsættes'
        },
        tilbagetraekning: {
            aktiv: true,
            kontrolleres: '-',
            skrivesNed: 'Ved tilbagetræ kninger'
        },
        aarligKontrol: {
            aktiv: true,
            kontrolleres: 'Årligt og ved ændringer',
            skrivesNed: 'Årligt. Noter hvilken måned'
        }
    };
}

/**
 * Generate Skema 1: Varemodtagelse
 */
function generateSkema1(profile, kcps) {
    const branchText = BRANCH_TEXTS.varemodtagelse;
    
    return {
        enabled: !!(profile.receivesChilledGoods || profile.receivesFrozenGoods || profile.receivesRoomTempGoods),
        title: branchText.title,
        description: branchText.description,
        criticalLimits: branchText.criticalLimits,
        controls: branchText.controls,
        products: branchText.products,
        ingredients: branchText.ingredients,
        howOften: branchText.howOften,
        whatToDo: branchText.whatToDo,
        importOptions: [
            { value: 'danske', label: 'Jeg modtager kun fødevarer fra danske virksomheder' },
            { value: 'eu', label: 'Jeg modtager fødevarer fra andre EU-lande (samhandel)' },
            { value: 'import', label: 'Jeg importerer fødevarer fra 3. lande (import) (Bemærk særlige regler herfor)' }
        ]
    };
}

/**
 * Generate Skema 2: Køl/frost temperatur
 */
function generateSkema2(profile, kcps) {
    const branchText = BRANCH_TEXTS.opbevaringKoelFrost;
    const fridgeCount = parseInt(profile.fridgeCount) || 0;
    const freezerCount = parseInt(profile.freezerCount) || 0;
    
    const units = [];
    
    // Add fridges
    for (let i = 1; i <= fridgeCount; i++) {
        units.push({
            type: 'koeleskab',
            name: `Køleskab ${i}`,
            maxTemp: 5,
            minTemp: 0,
            unit: '°C'
        });
    }
    
    // Add freezers
    for (let i = 1; i <= freezerCount; i++) {
        units.push({
            type: 'fryser',
            name: `Fryser ${i}`,
            maxTemp: -18,
            minTemp: null,
            unit: '°C'
        });
    }
    
    return {
        enabled: units.length > 0,
        title: branchText.title,
        description: branchText.description,
        criticalLimits: branchText.criticalLimits,
        controls: branchText.controls,
        products: branchText.products,
        ingredients: branchText.ingredients,
        howOften: branchText.howOften,
        whatToDo: branchText.whatToDo,
        units: units
    };
}

/**
 * Generate Skema 3: Opvarmning og nedkøling
 */
function generateSkema3(profile, kcps) {
    const branchText = BRANCH_TEXTS.opvarmning;
    
    return {
        enabled: !!(profile.preparesHotFood || profile.coolsHotFood),
        title: branchText.title,
        description: branchText.description,
        criticalLimits: branchText.criticalLimits,
        controls: branchText.controls,
        products: branchText.products,
        ingredients: branchText.ingredients,
        howOften: branchText.howOften,
        nedkoeling: branchText.nedkoeling,
        sections: {
            opvarmning: {
                enabled: !!profile.preparesHotFood,
                minTemp: 75,
                description: "Temperaturen skal være minimum 75 °C i midten af fødevaren."
            },
            nedkoeling: {
                enabled: !!profile.coolsHotFood,
                startTemp: 65,
                endTemp: 10,
                maxTime: 4,
                description: "Nedkølingen fra 65°C til 10°C må ikke vare mere end 4 timer."
            }
        }
    };
}

/**
 * Generate Skema 4: Varmholdelse
 */
function generateSkema4(profile, kcps) {
    const branchText = BRANCH_TEXTS.varmholdelse;
    
    return {
        enabled: !!(profile.holdsHotFood || profile.hasHotHolding),
        title: branchText.title,
        description: branchText.description,
        criticalLimits: branchText.criticalLimits,
        controls: branchText.controls,
        products: branchText.products,
        ingredients: branchText.ingredients,
        howOften: branchText.howOften,
        whatToDo: branchText.whatToDo,
        minTemp: 65
    };
}

/**
 * Generate Skema 5: Rengøringsplan
 */
function generateSkema5(profile, kcps) {
    const branchText = BRANCH_TEXTS.rengoering;
    
    return {
        enabled: true,
        title: branchText.title,
        description: branchText.description,
        methods: branchText.methods,
        controls: branchText.controls,
        howOften: branchText.howOften,
        whatToDo: branchText.whatToDo,
        areas: {
            koekken: [
                { name: 'Vægge/vinduer', dagligt: false, ugentligt: false, maanedligt: false, treeMaaned: false },
                { name: 'Gulve', dagligt: true, ugentligt: false, maanedligt: false, treeMaaned: false },
                { name: 'Lofter', dagligt: false, ugentligt: false, maanedligt: false, treeMaaned: false },
                { name: 'Køleskabe', dagligt: false, ugentligt: true, maanedligt: false, treeMaaned: false },
                { name: 'Frysere', dagligt: false, ugentligt: false, maanedligt: true, treeMaaned: false },
                { name: 'Ventilation', dagligt: false, ugentligt: false, maanedligt: false, treeMaaned: true },
                { name: 'Hylder', dagligt: false, ugentligt: true, maanedligt: false, treeMaaned: false },
                { name: 'Skabe', dagligt: false, ugentligt: true, maanedligt: false, treeMaaned: false },
                { name: 'Borde', dagligt: true, ugentligt: false, maanedligt: false, treeMaaned: false }
            ],
            maskiner: [],
            toiletter: [
                { name: 'Toilet', dagligt: true, ugentligt: false, maanedligt: false, treeMaaned: false },
                { name: 'Håndvask', dagligt: true, ugentligt: false, maanedligt: false, treeMaaned: false },
                { name: 'Vægge/vinduer', dagligt: false, ugentligt: true, maanedligt: false, treeMaaned: false },
                { name: 'Gulv', dagligt: true, ugentligt: false, maanedligt: false, treeMaaned: false },
                { name: 'Loft', dagligt: false, ugentligt: false, maanedligt: true, treeMaaned: false }
            ],
            lager: [
                { name: 'Gulv', dagligt: false, ugentligt: true, maanedligt: false, treeMaaned: false },
                { name: 'Loft', dagligt: false, ugentligt: false, maanedligt: true, treeMaaned: false },
                { name: 'Vægge/vinduer', dagligt: false, ugentligt: false, maanedligt: true, treeMaaned: false },
                { name: 'Køleskabe/frysere', dagligt: false, ugentligt: true, maanedligt: false, treeMaaned: false },
                { name: 'Hylder', dagligt: false, ugentligt: true, maanedligt: false, treeMaaned: false }
            ],
            udenoms: [
                { name: 'Affald', dagligt: true, ugentligt: false, maanedligt: false, treeMaaned: false }
            ]
        }
    };
}

/**
 * Generate Skema 6: Vedligeholdelsesplan
 */
function generateSkema6(profile) {
    return {
        enabled: true,
        title: "Vedligeholdelsesplan",
        description: "Virksomhedens vedligeholdelsesstandard og skadedyrsovervågning skal kontrolleres. Eventuelt kan skema 6 'Vedligeholdelsesplan' anvendes. Hvis ikke, skal der mundtligt kunne redegøres for vedligeholdelse og skadedyrssikring.",
        categories: {
            bygninger: [],
            inventarUdstyr: [],
            udenomsAreal: [],
            skadedyr: []
        }
    };
}

/**
 * Generate Skema 7: Årlig kontrol og revision
 */
function generateSkema7() {
    return {
        enabled: true,
        title: "Årlig kontrol og revision",
        description: "Revision af virksomhedens egenkontrolprogram skal altid foretages, hvis der sker ændringer i aktiviteterne f.eks. ændringer i produktion eller vareudvalg. Hvis der ikke er sket ændringer, bør revisionen foretages minimum 1 gang årligt. Anvend eventuelt skema 7 om 'Årlig kontrol og revision'.",
        checkpoints: [
            { area: 'Vedligeholdelse', question: 'Bliver vedligeholdelsesplanen fulgt?', ja: false, nej: false, notes: '' },
            { area: 'Skadedyr', question: 'Er der sikret mod skadedyr? Døre og vinduer, gulve og vægge skal være tætte og uden huller. Der skal være insektnet for åbne vinduer og døre.', ja: false, nej: false, notes: '' },
            { area: 'Rengøring', question: 'Følges rengøringsplanen?', ja: false, nej: false, notes: '' },
            { area: 'Rengøring', question: 'Er rengøringsplanen tilstrækkelig? Husk nyt udstyr.', ja: false, nej: false, notes: '' },
            { area: 'Produktion', question: 'Er produktionen den samme som ved sidste gennemgang?', ja: false, nej: false, notes: '' },
            { area: 'Produktion', question: 'Er termometre kontrolleret inden for det sidste år?', ja: false, nej: false, notes: '' },
            { area: 'Medarbejdere', question: 'Er alle medarbejdere instrueret i udførelse og dokumentation af egenkontrollen?', ja: false, nej: false, notes: '' },
            { area: 'Egenkontrollen', question: 'Gennemgå egenkontrollen. Er der rettet op på evt. fejl?', ja: false, nej: false, notes: '' },
            { area: 'Egenkontrollen', question: 'Passer den nuværende egenkontrol til produktionen/aktiviteterne?', ja: false, nej: false, notes: '' }
        ]
    };
}

/**
 * Generate procedure texts from GAG
 */
function generateProcedurer(profile, kcps) {
    return {
        adskillelse: BRANCH_TEXTS.adskillelse,
        personligHygiejne: BRANCH_TEXTS.personligHygiejne,
        rengoering: BRANCH_TEXTS.rengoering
    };
}
