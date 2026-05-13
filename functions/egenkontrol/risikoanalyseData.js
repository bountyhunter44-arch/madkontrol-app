/**
 * Komplet risikoanalyse data fra edokumentation.dk
 * Alle tekster er 1:1 fra den officielle risikoanalyse
 */

const MIKROBIOLOGISKE_FARER_CCP = {
    ccp1_varemodtagelse_koelekraevende: {
        type: 'CCP',
        ccpNumber: 1,
        title: 'Varemodtagelse af kølekrævende fødevarer',
        forklaring: 'Ved modtagelse af kølekrævende fødevarer skal temperaturen ikke blive brudt. Som udgangspunkt skal kølekrævende fødevarer opbevares ved maksimalt 5°C (med mindre lavere temperaturer er angivet i fødevarens mærkning). Virksomheden sikrer, at temperaturen for kølekrævende fødevarer bliver overholdt ved varemodtagelsen.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion',
        ingredienser: 'Pasteuriserede æg; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Pasteuriserede mælkeprodukter; Frosne råvarer; Rå æg; Råt kød; Frosne bær',
        kontroller: 'Varemodtagelse',
        criticalLimits: {
            coldGoodsMax: 5,
            frozenGoodsMax: -18,
            packagingIntact: true,
            labelingCorrect: true
        }
    },
    ccp2_opbevaring_koel_frost: {
        type: 'CCP',
        ccpNumber: 2,
        title: 'Opbevaring af kølekrævende fødevarer',
        forklaring: 'Når fødevarer bliver opbevaret koldt, hæmmes bakteriers vækst. Det skal sikres at temperaturen i køleskabet eller fryser er lav nok til at temperaturen, der er oplyst i fødevarens mærkning eller som gælder i fødevarelovgivningen. Som udgangspunkt er kølekrævende fødevarer opbevares ved 5°C eller lavere (med mindre lavere temperaturer er angivet i fødevarens mærkning).',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion',
        ingredienser: 'Pasteuriserede æg; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Pasteuriserede mælkeprodukter; Rå æg; Råt kød; Frosne bær',
        kontroller: 'Køleskab 1 (+5), Køleskab 2 (+5), Køleskab 3 (+5), Lille displaykøleskab (+5)',
        criticalLimits: {
            fridgeMin: 0,
            fridgeMax: 5,
            freezerMax: -18
        }
    },
    ccp3_opvarmning: {
        type: 'CCP',
        ccpNumber: 3,
        title: 'Opvarmning og genopvarmning af fødevarer',
        forklaring: 'Risiko for tilstedeværelse af sygdomsfremkaldende bakterier pga. utilstrækkelig opvarmning. Det er især Clostridium perfringens, Bacillus cereus og Campylobacter der kan være risiko for. Disse bakterier bliver enten dræbt eller begrænset mest muligt ved at opvarme fødevarer til minimum 75°C. Det sikres derfor, at fødevarer ved opvarmning opnår en kernetemperatur på minimum 75°C.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Rå æg; Råt kød; Frosne bær',
        kontroller: 'Varmbehandling af fødevarer, Genopvarmning af fødevarer',
        criticalLimits: {
            coreTemperatureMin: 75,
            holdTimeMin: 2
        }
    },
    ccp4_varmholdelse: {
        type: 'CCP',
        ccpNumber: 4,
        title: 'Varmholdelse af fødevarer',
        forklaring: 'Der er risiko for vækst af sygdomsfremkaldende bakterier i varmbehandlede produkter efter varmbehandlingen, hvis temperaturen falder til under 65°C. Det skal sikres, at varmbehandlede produkter, der sikres at alle dele af produktet er opvarmet til minimum 65°C, og at fødevaren er serveret, genopvarmet, kasseret eller lignende, afkøles inden 3 timer serveret. Hvis temperaturen falder til under 65°C, sikres det at fødevaren er serveret, genopvarmet, kasseret eller lignende, afkøles inden 3 timer.',
        produkter: 'varme retter, suppe, grydesteg o.lign.',
        ingredienser: 'Rå æg; Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Frosne bær; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer',
        kontroller: 'Varmholdelse (+65)',
        criticalLimits: {
            temperatureMin: 65,
            maxHoldingTime: 240
        }
    },
    ccp5_nedkoeling: {
        type: 'CCP',
        ccpNumber: 5,
        title: 'Nedkøling af varmbehandlede fødevarer',
        forklaring: 'Der er risiko for vækst af varmbehandlede bakterier hvis ikke varmbehandlede fødevarer køles effektivt. Det kan især være Clostridium perfringens, Clostridium botulinum og Bacillus cereus, da spoerne kan overleve almindelig varmbehandlingen. Derfor skal det sikres, at varmbehandlede produkter nedkøles fra 65°C til 10°C på maksimalt 3 timer. Fødevarerne skal opbevares i køl eller frost.',
        produkter: 'Forudproduceret mad, rester; Forudproduceret mad, rester',
        ingredienser: 'Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Pasteuriserede mælkeprodukter; Frosne råvarer',
        kontroller: 'Nedkøling af fødevarer',
        criticalLimits: {
            startTemp: 65,
            endTemp: 10,
            maxTimeMinutes: 180
        }
    },
    ccp6_allergener: {
        type: 'CCP',
        ccpNumber: 6,
        title: 'Håndtering og mærkning af allergener',
        forklaring: 'Allergener kan forårsage alvorlige allergiske reaktioner hos følsomme personer. Det er kritisk vigtigt at undgå krydskontaminering mellem allergenholdige og allergenfrie fødevarer, samt at sikre korrekt mærkning og information til kunder. Virksomheden skal have procedurer for adskillelse af allergener, rengøring af udstyr og arbejdsflader, samt træning af personale i allergenhåndtering.',
        produkter: 'Alle fødevarer der indeholder eller kan indeholde allergener',
        ingredienser: 'Gluten; Skaldyr; Æg; Fisk; Jordnødder; Soja; Mælk; Nødder; Selleri; Sennep; Sesamfrø; Svovldioxid og sulfitter; Lupin; Bløddyr',
        kontroller: 'Adskillelse af allergener, rengøring af udstyr, korrekt mærkning, personaletræning',
        criticalLimits: {
            separationRequired: true,
            labelingRequired: true,
            cleaningRequired: true,
            staffTrainingRequired: true
        }
    }
};

const MIKROBIOLOGISKE_FARER_GAG = {
    gag_varemodtagelse_kvalitet: {
        type: 'GAG',
        title: 'Varemodtagelse - kvalitetskontrol',
        forklaring: 'Når der modtages varer er der risiko for at varerne er af dårlig kvalitet, har overskredet holdbarheds-datoen eller er beskadigt. Personalet er opmærksomt på at kontrollere de varer, der modtages.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion',
        ingredienser: 'Pasteuriserede æg; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Pasteuriserede mælkeprodukter; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: 'Varemodtagelse'
    },
    gag_personlig_hygiejne: {
        type: 'GAG',
        title: 'Personlig hygiejne - sygdomsfremkaldende bakterier',
        forklaring: 'En god personlig hygiejne er vigtig i en virksomhed der håndterer fødevarer. Personalet skal kunne håndtere sygdomsfremkaldende bakterier og virus kan forurenere fødevarer, hvis personalet ikke overholder personalet personlige hygiejne ikke er i orden. Personalet skal vaske hænder ved skift mellem forskellige typer af fødevarer. Virksomheden har anbefalere, at personale med mavetarm-infektion (f.eks. opkastning) skal være hjemme i 48 timer efter, at symptomerne er ophørt. For personale, der passer syge børn eller andre personer med mavetarm-infektion, anbefales det, at man er særlig omhyggelig med hygiejnen.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: 'Personale med mavetarm-infektion skal være hjemme i 48 timer efter symptomerne er ophørt'
    },
    gag_krydskontaminering: {
        type: 'GAG',
        title: 'Krydskontaminering - adskillelse',
        forklaring: 'Fødevarer kan blive forurenet med bakterier, hvis de kommer i kontakt med råvarer og mellem til og færdige produkter. Det er derfor vigtigt, at der er tilstrækkelig adskillelse mellem fødevarer til spiseklare produkter. Virksomheden sikrer og holder dem adskilt fra spiseklare produkter. Virksomheden sikrer, at kaffe, maskiner og redskaber, der er relevant, og holde dem adskilt fra spiseklare produkter. Arbejdsplader, knive, vaskestykker, forkæder og lignende kan sprede bakterier. Derfor sikres det, at de er rene og skiltes ud.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Rå æg; Råt kød; Frosne bær',
        kontroller: 'Adskillelse af råvarer og færdige produkter, separate redskaber og arbejdsflader'
    },
    gag_vibrio_fisk_skaldyr: {
        type: 'GAG',
        title: 'Vibrio i fisk, skaldyr og bløddyr',
        forklaring: 'Vibrio findes i fisk, skaldyr og bløddyr (f.eks. østers, muslinger) og kan give diarré, hvis ikke varmbehandlingen eller køle-/fryseevne, hvis køle-/fryseskabet overflades. Virksomheden sikrer, at fisken og skaldyr opbevares tilstrækkeligt køl og servering.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester',
        ingredienser: 'Rå fisk og skaldyr',
        kontroller: 'Opbevaring af fisk og skaldyr ved korrekt temperatur'
    },
    gag_koel_frost_opbevaring: {
        type: 'GAG',
        title: 'Opbevaring af køle- og frostbevarende fødevarer',
        forklaring: 'Ved opbevaring af køle- og frostbevarende fødevarer er der risiko for nedsat luftcirkulation og køle-/fryseevne, hvis køle-/fryseevne, hvis køle-/fryseskabet overflades. Dette er der opmærksomt på.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Pasteuriserede mælkeprodukter',
        kontroller: ''
    },
    gag_display_fryser: {
        type: 'GAG',
        title: 'Display fryser og kummefryser',
        forklaring: 'Når frostvarer bliver opbevaret eller modtaget sikres virksomheden, at produkterne er frosne og overholder temperaturkrav i relevant lovgivning.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; Forudproduceret mad, rester',
        ingredienser: 'Frosne råvarer; Frosne bær',
        kontroller: 'Display fryser (-18), Starfryser (-18), Kummefryser (-18), Varemodtagelse'
    },
    gag_frugt_groent: {
        type: 'GAG',
        title: 'Frugt og grønt - behandling',
        forklaring: 'Der er lovmæssigt ikke et køleskab på udarbejdet frugt og grønt. Disse fødevarer sælges, så kvaliteten bibeholdes bedst muligt. Personalet er opmærksomt på, at såart der sker behandling (såsom udskæring) af frugt og grønt, at skal det opbevares ved maks. 5 grader.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Frugt; Grøntsager; Kartofler; Svampe',
        kontroller: ''
    },
    gag_opvarmning_bakterier: {
        type: 'GAG',
        title: 'Opvarmning - sygdomsfremkaldende bakterier',
        forklaring: 'Der er risiko for vækst af sygdomsfremkaldende bakterier eller virus, hvis fødevarer ikke opvarmes korrekt (f.eks. på kål) og at dato for anvendelse sikres, at fødevarer opvarmes korrekt. Dette gælder også, hvis varen overføres til en anden emballage. Varer produceret virksomheden til senere brug ved også at mærkes med fremstillingsdato.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Rå æg; Råt kød; Frosne bær',
        kontroller: ''
    },
    gag_lufttaet_emballage: {
        type: 'GAG',
        title: 'Lufttæt emballage - servering',
        forklaring: 'Der er risiko for vækst af sygdomsfremkaldende bakterier, hvis ikke lufttæt emballage fødevarer bliver opbevaret koldt eller varmt. Det sikres derfor, at alle lufttæt emballage fødevarer, der i servering eller lignende, opbevares uden køl eller varmholdelse, er serveret, nedkølet, genopvarmet eller kasseret inden 3 timer.',
        produkter: 'varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.',
        ingredienser: 'Rå æg; Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Frosne bær; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: ''
    },
    gag_opbevaring_koeleskab: {
        type: 'GAG',
        title: 'Opbevaring i køleskab - holdbarhed',
        forklaring: 'Når produkter optøs vækkes evt. tilstedeværende bakterier til dvale, og der er risiko for opformering. Optøning skal derfor i køleskab ved maks 5 grader (for fisk maks 2 grader) for at sikre at opformering af bakterier minimeres, og produktet opbevares tilstrækkeligt på ilt. Produktet opbevares tilstrækkeligt på ilt.',
        produkter: 'Forudproduceret mad, rester; Forudproduceret mad, rester',
        ingredienser: 'Frosne råvarer',
        kontroller: ''
    },
    gag_optøning: {
        type: 'GAG',
        title: 'Optøning af fødevarer',
        forklaring: 'Fødevarer kan blive forurenet med bakterier, hvis de kommer i kontakt med råvarer og mellen til og færdige produkter. Det er derfor vigtigt, at der er tilstrækkelig adskillelse mellem fødevarer til spiseklare produkter. Virksomheden sikrer og holder dem adskilt fra spiseklare produkter. Virksomheden sikrer, at kaffe, maskiner og redskaber, der er relevant, og holde dem adskilt fra spiseklare produkter. Arbejdsplader, knive, vaskestykker, forkæder og lignende kan sprede bakterier. Derfor sikres det, at de er rene og skiltes ud. Virksomheden sikrer, at fødevaren er tilstrækkeligt til senere brug og også at mærkes med fremstillingsdato.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Rå æg; Råt kød; Frosne bær',
        kontroller: ''
    }
};

const KEMISKE_FARER = {
    ccp_raa_fisk: {
        type: 'CCP',
        ccpNumber: 6,
        title: 'Modtagelse og opbevaring af rå fisk',
        forklaring: 'Ved modtagelse og opbevaring af rå fisk, skal det sikres at fisken er 2 °C eller koldere, da for høje temperaturer kan medføre, at der dannes store mængder af histamin i fisken. Histamin kan give alvorlige',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion',
        ingredienser: 'Rå fisk og skaldyr',
        kontroller: 'Varemodtagelse',
        criticalLimits: {
            maxTemp: 2
        }
    },
    gag_stegning_pah: {
        type: 'GAG',
        title: 'Stegning, grillning eller røgning - PAH',
        forklaring: 'Ved stegning, grillning eller røgning af fisk og kød kan der dannes kræftfremkaldende stoffer (PAH). Virksomheden er opmærksomt på at undgå at brænde kødet og undgå for høje temperaturer. Virksomheden er opmærksomt på at vælge egnet brændsel, at tilpasse indholdet af fedt i fødevaren, at styrke ved at vælge egnet brændsel, at optimere afstanden mellem brændsel og fødevarer, samt ved korrekt røgning af røgkammeret.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Rå æg; Råt kød',
        kontroller: ''
    },
    gag_akrylamid: {
        type: 'GAG',
        title: 'Akrylamid - dannelse ved høje temperaturer',
        forklaring: 'Der er risiko for dannelse af akrylamid ved kulhydratholdige produkter, hvis de bliver stegt, bagt friturestegt, ristede brød, kiks og knækbrød. Virksomheden er opmærksomt på at minimere dannelsen af akrylamid ved at opbevare kartofler og stege til gylden i stedet for mørk farve. Fødevarestyrelsen anbefaler, at temperaturen ved fritering af pommes frites ikke overstiger 175°C.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester',
        ingredienser: 'Kartofler; Mel, korn og kornprodukter; Brød og brødprodukter; Frosne råvarer',
        kontroller: ''
    },
    gag_escolar: {
        type: 'GAG',
        title: 'Fiskene Escolar og oliefisk/smørmakrel',
        forklaring: 'Fiskene Escolar (Lepidocybium flavobrunneum) og oliefisk/smørmakrel (Ruvettus pretiosus) har et naturligt indhold af voksarter. Disse fisk kan give diarré, hvis de ikke tilberedes korrekt. Det skyldes, voksarterne (voks-estere/dioledige fedt), og effekten kan sammenlignes med virkningen af amerikansk olie. Hvis virksomheden',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester',
        ingredienser: 'Rå fisk og skaldyr',
        kontroller: ''
    }
};

const KEMISKE_FARER_GAG_FORTSAET = {
    gag_mykotoksiner: {
        type: 'GAG',
        title: 'Mykotoksiner i nødder og tørrede frugter',
        forklaring: 'Der er risiko for indhold af mykotoksiner i blandt andet nødder, frø og tørrede frugter pga. grund af skimmelsvækst under produktion. Mykotoksiner er giftige ved længere tids påvirkning. Virksomheden er opmærksomt på, at der kan modtages varer fra registrerede myndigheds-kontrol. Nødder, frø og tørrede frugter produceret i f.eks. Danmark indeholder ikke mykotoksiner.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Nødder og frø',
        kontroller: ''
    },
    gag_bitter_mandler: {
        type: 'GAG',
        title: 'Bitre mandler - cyanid',
        forklaring: 'Bitre mandler indeholder store mængder cyanid, som er giftigt. Bitre mandler kan dog anvendes i meget begrænsede mængder. Virksomheden er opmærksomt på, at der kan anvendes bitre mandler, men kun i små mængder. Solsikkefri og hørfrø indeholder desuden tungmetallet cadmium, der lagres i kroppen og kan på længere sigt skade nyre og knogler. Man skal derfor ikke spise for store mængder i for store mængder.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Nødder og frø',
        kontroller: ''
    },
    gag_solanin: {
        type: 'GAG',
        title: 'Solanin i grønne kartofler',
        forklaring: 'Der er risiko for indhold af solanin i grønne kartofler. Virksomheden sikrer derfor, at evt. spirede og grønne kartofler smides ud. Grønne pletter på mindre pletter, sikrer virksomheden at kartoflen smides ud. Virksomheden har kendskab til, at de rå kartofler kan opbevares under 2 °C, og at der kan opbevares mørkt for at undgå, at kartoflen bliver grøn.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Kartofler',
        kontroller: ''
    },
    gag_phenylhydrazin: {
        type: 'GAG',
        title: 'Phenylhydrazin i champignon',
        forklaring: 'Phenylhydrazin findes i champignon. Virksomheden er opmærksomt på at Fødevarestyrelsen anbefaler, at champignon da tilberedning nedbringer indholdet af phenylhydrazin.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Svampe',
        kontroller: ''
    },
    gag_squash: {
        type: 'GAG',
        title: 'Squash/courgette/zucchini - bitter smag',
        forklaring: 'Squash/courgette/zucchini har normalt en neutral smag, men cucurbitaciner fra squash eller nogle af de mest bitersmagende stoffer, der kendes. Man vil derfor kunne smage, hvis de findes i grøntsagen. Selv små mængder af disse bitersmagende stoffer kan give sygdom inden for få timer - uanset om squashen er rå eller tilberedt. Der smages på squashen og den smides ud, hvis den smager bittert.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Grøntsager',
        kontroller: ''
    },
    gag_bønner: {
        type: 'GAG',
        title: 'Forgiftning med bønner',
        forklaring: 'Der er risiko for forgiftning med lektiner hvis bønner ikke behandles korrekt. Der er risiko for at de tørrede bønner skal koges i minimum 15 min. Bemærk at grønne bønner (haricot verts) også skal koges i minimum 15 min. Bemærk at grønne bønner (haricot verts) også skal blancheres.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Frugt; Ris, pasta og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: ''
    },
    gag_svampe: {
        type: 'GAG',
        title: 'Svampegiftige svampe',
        forklaring: 'Svampegiftige kan findes i giftige svampe og planter. Der er risiko for at tilberede giftige svampe, hvis ikke kun helt sikkert kender, og kun de anerkendte spisesv ampe.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Svampe',
        kontroller: ''
    },
    gag_redskaber_udstyr: {
        type: 'GAG',
        title: 'Redskaber og udstyr - afsmitning',
        forklaring: 'Stoffer fra redskaber og udstyr kan overføres til virksomhedens fødevarer. Fødevarerne sikres mod afsmitning fra forskellige fødevarer og udstyr ved korrekt anvendelse af redskaber til de forskellige fødevarer. Krydskontaminering med allergener under produktion, salg, servering skal desuden minimeres ved tilstrækkelig rengøring mv.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: ''
    },
    gag_rengøring_desinfektionsmidler: {
        type: 'GAG',
        title: 'Rengørings- og desinfektionsmidler',
        forklaring: 'Stoffer fra virksomhedens rengørings- og desinfektionsmidler kan overføres til virksomhedens fødevarer, og de kan være farligt for kunderne. Personalet er instrueret i anvendelse af rengørings- og desinfektionsmidler. Der sikres at rengøringsmidler opbevares adskilt fra fødevarer.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: ''
    },
    gag_fødevarekontaktmaterialer: {
        type: 'GAG',
        title: 'Fødevarekontaktmaterialer - minimering',
        forklaring: 'Når fødevarer kommer i kontakt med emballage eller produktionsdusty o.lign. er der risiko for, at stoffer fra emballagen overføres til fødevaren. Virksomheden skal minimeres ved kun at benytte fødevarekontaktmaterialer, der er beregnet til formålet.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: ''
    },
    gag_allergener: {
        type: 'GAG',
        title: 'Allergener - oplysning om indhold',
        forklaring: 'Der er risiko for, at tilsætte eller utilsigtet indhold af allergene ingredienser i virksomhedens fødevarer, hvis ikke personer med allergi spiser disse fødevarer, kan de blive syge. Virksomheden modtager løbevarer, sikrer virksomheden at der kan gives oplysning om indhold af allergene ingredienser. Når virksomheden modtager løbevarer, sikrer virksomheden at der kan gives oplysning om indhold af allergene ingredienser. Krydskontaminering med allergener under produktion, salg, servering skal desuden minimeres ved tilstrækkelig rengøring mv.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: ''
    },
    gag_tilsætningsstoffer: {
        type: 'GAG',
        title: 'Tilsætningsstoffer - korrekt anvendelse',
        forklaring: 'Tilsætningsstoffer skal anvendes korrekt. Ved anvendelse af tilsætningsstoffer sikres det at de anvendes tilsætningsstoffer må anvendes i den pågældende fødevare. Virksomheden sikrer også at doseringen er korrekt.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: ''
    }
};

const FYSISKE_FARER = {
    gag_fysiske_materialer: {
        type: 'GAG',
        title: 'Fysiske materialer - glas, metal, hårdt plastik',
        forklaring: 'Der er risiko for, at materialer (metal, hård plastik, træ, glas mv.) fra emballage kan ende i det færdige produkt, og de kan være farligt for kunderne. Derfor sikres det, at virksomheden modtager eller anvender, ikke forurenede emballage.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: ''
    },
    gag_fysiske_emballage: {
        type: 'GAG',
        title: 'Fysiske materialer fra emballage',
        forklaring: 'Der er risiko for, at materialer fra emballage vildledt eller farligt for kunderne. Derfor sikres det, at virksomheden er hensigtsmæssigt indrettet, og at inventar og udstyr bliver kontrolleret og vedligeholdt løbende.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: ''
    },
    gag_fremmedlegemer: {
        type: 'GAG',
        title: 'Fremmedlegemer - metal, sten, glas, træ',
        forklaring: 'Der er risiko for forurening med fremmedlegemer (metal, sten, glas, træ, hårdt plastik mv.) hvis ikke korrekt opbevaring, håndtering og emballering af fødevarer. Virksomheden sikrer korrekt opbevaring, håndtering og emballering af fødevarer. Alle varer skal således opbevares på en måde, så de ikke forurenede med blandingen og aldrig direkte på gulvet.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: ''
    },
    gag_sygdomsoverførsel: {
        type: 'GAG',
        title: 'Sygdomsoverførsel via insekter',
        forklaring: 'Der er risiko for sygdomsoverførsel, hvis insekter (fluer, møl, insekter) kommer i kontakt med fødevarer. Derfor sikres det, at døre og vinduer er sikret mod indtrængning, og der tjekkes løbende for tegn på skadedyr.',
        produkter: 'Forudproduceret mad, rester; varme retter, grydesteg, forårsruller, nudler, risretter, supper, fisk, kylling, oske- og svinekød o.lign.; Kolde retter, forretter, salater o.lign.; kaffe; varme retter, suppe, grydesteg o.lign.; Forudproduceret mad, rester; Grønt tilbehør, forudproduktion; grøntsager, urter',
        ingredienser: 'Pasteuriserede æg; Rå fisk og skaldyr; Varmbehandlet kød, fisk, pølæg o.lign.; Frugt; Grøntsager; Kartofler; Svampe; Nødder og tørrede bønner; Mel, korn og kornprodukter; Brød og brødprodukter; Pasteuriserede mælkeprodukter; Vegetabilske fedtstoffer; Frosne råvarer; Rå æg; Råt kød; Frosne bær; Isterninger',
        kontroller: ''
    },
    gag_udstyr_slitage: {
        type: 'GAG',
        title: 'Udstyr og maskiner - slitage og vedligehold',
        forklaring: 'Der er risiko for fysiske fremmedlegemer fra slidte maskiner og udstyr (metalstykker, plastikdele, skruer). Virksomheden sikrer løbende vedligehold og kontrol af alt produktionsudstyr. Slidte dele udskiftes omgående.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Vedligehold af udstyr, visuel kontrol af maskiner'
    }
};

const SPORBARHED_OG_LEVERANDØRER = {
    gag_leverandørkontrol: {
        type: 'GAG',
        title: 'Leverandørkontrol og godkendelse',
        forklaring: 'Virksomheden skal sikre at leverandører er godkendte og overholder fødevaresikkerhedskrav. Der føres liste over godkendte leverandører. Ved modtagelse kontrolleres at varer kommer fra godkendte leverandører.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Leverandørliste, varemodtagelse'
    },
    gag_sporbarhed: {
        type: 'GAG',
        title: 'Sporbarhed - batch og lot håndtering',
        forklaring: 'Virksomheden skal kunne spore alle fødevarer ét trin tilbage (leverandør) og ét trin frem (kunde). Der registreres batch/lot numre ved varemodtagelse. For egne produkter anvendes produktionsdato som sporbarhed.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Batch registrering, produktionsdato mærkning'
    },
    gag_tilbagetrækning: {
        type: 'GAG',
        title: 'Tilbagetrækningsprocedure',
        forklaring: 'Virksomheden skal have procedure for tilbagetrækning af usikre fødevarer. Der skal være kontaktoplysninger til relevante myndigheder. Personalet skal vide hvordan tilbagetrækning håndteres.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Tilbagetrækningsprocedure, kontaktliste'
    }
};

const VEDLIGEHOLD_OG_SKADEDYR = {
    gag_vedligehold_lokaler: {
        type: 'GAG',
        title: 'Vedligehold af lokaler',
        forklaring: 'Lokaler skal være hele, rene og i god stand. Vægge, gulve, lofter skal være jævne og afvaskelige. Revner og huller skal udbedres. Der føres vedligeholdelsesplan.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Vedligeholdelsesplan, årlig gennemgang'
    },
    gag_skadedyrssikring: {
        type: 'GAG',
        title: 'Skadedyrssikring og bekæmpelse',
        forklaring: 'Virksomheden skal være sikret mod skadedyr (mus, rotter, fluer, kakerlakker). Døre og vinduer skal være tætte. Riste på kloakker. Regelmæssig kontrol for tegn på skadedyr. Ved fund kontaktes professionel skadedyrsbekæmper.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Skadedyrskontrol, riste på kloakker, tætte døre/vinduer'
    },
    gag_termometer_kalibrering: {
        type: 'GAG',
        title: 'Termometre - kalibrering og kontrol',
        forklaring: 'Termometre skal vise korrekt temperatur. Termometre kontrolleres minimum årligt mod isvand (0°C) eller kogende vand (100°C). Defekte termometre udskiftes.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Årlig termometerkontrol'
    },
    gag_haandvask_faciliteter: {
        type: 'GAG',
        title: 'Håndvask faciliteter',
        forklaring: 'Der skal være tilstrækkelige håndvaske med varmt og koldt vand, sæbe og engangshåndklæder. Håndvaske skal være placeret strategisk ved indgange til produktionsområder.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Håndvask tilgængelighed, sæbe og håndklæder'
    },
    gag_affaldshåndtering: {
        type: 'GAG',
        title: 'Affaldshåndtering',
        forklaring: 'Affald skal opbevares i lukkede beholdere og fjernes regelmæssigt. Affaldsbeholdere skal være tydelig markeret og adskilt fra fødevareområder.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Affaldscontainere, tømningsfrekvens'
    },
    gag_ventilation: {
        type: 'GAG',
        title: 'Ventilation og luftkvalitet',
        forklaring: 'Tilstrækkelig ventilation skal sikre god luftkvalitet og forhindre kondens. Emhætter skal rengøres regelmæssigt.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Ventilationssystem, emhætter'
    },
    gag_belysning: {
        type: 'GAG',
        title: 'Belysning i produktionsområder',
        forklaring: 'Tilstrækkelig belysning skal sikre god synlighed ved tilberedning og kontrol. Lysarmaturer skal være beskyttet mod brud.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Lysniveau, beskyttede armaturer'
    },
    gag_vand_kvalitet: {
        type: 'GAG',
        title: 'Vandkvalitet',
        forklaring: 'Drikkevand skal bruges til fødevareproduktion. Ved egen boring skal vandet testes regelmæssigt.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Vandkvalitet, eventuel vandtest'
    },
    gag_is_produktion: {
        type: 'GAG',
        title: 'Is til drikkevarer',
        forklaring: 'Is skal produceres af drikkevand. Ismaskiner skal rengøres regelmæssigt. Isske skal opbevares hygiejnisk.',
        produkter: 'Drikkevarer med is',
        ingredienser: 'Isterninger',
        kontroller: 'Ismaskinens rengøring, hygiejnisk håndtering'
    },
    gag_emballage_opbevaring: {
        type: 'GAG',
        title: 'Opbevaring af emballage',
        forklaring: 'Emballage skal opbevares rent og tørt, beskyttet mod forurening. Beskadiget emballage må ikke bruges.',
        produkter: 'Alle emballerede produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Emballage opbevaring, inspektion'
    },
    gag_arbejdstøj: {
        type: 'GAG',
        title: 'Arbejdstøj og beskyttelsesudstyr',
        forklaring: 'Personale skal bære rent arbejdstøj. Ved behov skal der bruges handsker, hårnet og forklæde. Arbejdstøj må ikke bæres udenfor produktionsområder.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Arbejdstøj, beskyttelsesudstyr'
    },
    gag_gæste_besøgende: {
        type: 'GAG',
        title: 'Gæster og besøgende',
        forklaring: 'Gæster og besøgende skal følge samme hygiejneregler som personale. De skal instrueres i korrekt adfærd i produktionsområder.',
        produkter: 'Alle produkter',
        ingredienser: 'Alle ingredienser',
        kontroller: 'Gæsteinstruktion, overvågning'
    }
};

module.exports = {
    MIKROBIOLOGISKE_FARER_CCP,
    MIKROBIOLOGISKE_FARER_GAG,
    KEMISKE_FARER,
    KEMISKE_FARER_GAG_FORTSAET,
    FYSISKE_FARER,
    SPORBARHED_OG_LEVERANDØRER,
    VEDLIGEHOLD_OG_SKADEDYR
};
