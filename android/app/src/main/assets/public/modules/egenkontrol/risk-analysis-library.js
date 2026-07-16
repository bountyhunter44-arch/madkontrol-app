export const RISK_ANALYSIS_LIBRARY_PART_1 = [

  // =========================
  // CCP
  // =========================

  {
    id: "ccp_varemodtagelse_koel",
    type: "CCP",
    title: "Modtagelse af kølekrævende fødevarer",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Ved modtagelse af kølekrævende fødevarer skal det sikres, at kølekæden ikke bliver brudt. Som udgangspunkt skal kølekrævende fødevarer opbevares ved maksimalt 5 °C (med mindre lavere temperaturer er angivet i fødevarens mærkning). Virksomheden sikrer, at temperaturkrav for kølekrævende fødevarer bliver overholdt ved varemodtagelsen.",
    produkter: [
      "Forudproduceret mad", "Varme retter", "Gryderetter", "Forårsruller",
      "Nudler", "Risretter", "Supper", "Fisk", "Kylling", "Okse- og svinekød",
      "Kolde retter", "Forretter", "Salater", "Grønt tilbehør"
    ],
    ingredienser: [
      "Pasteuriserede æg", "Varmebehandlet kød", "Fisk", "Pålæg",
      "Pasteuriserede mælkeprodukter", "Frosne råvarer", "Rå æg", "Råt kød"
    ],
    kontrolType: "RECEIVING_ONLY",
    kilde: "0001",
    sikkerhed: "Høj"
  },

  {
    id: "ccp_opbevaring_koel",
    type: "CCP",
    title: "Kold opbevaring af fødevarer",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Når fødevarer bliver opbevaret koldt, hæmmes bakteriers vækst. Det skal derfor sikres at temperaturen i alle køleenheder højst er den temperatur, der er oplyst i fødevarens mærkning, eller som gælder i fødevarelovgivningen. Som udgangspunkt skal kølekrævende fødevarer opbevares ved 5 °C eller koldere (med mindre lavere temperaturer er angivet i fødevarens mærkning).",
    produkter: [
      "Forudproduceret mad", "Varme retter", "Gryderetter", "Forårsruller",
      "Nudler", "Risretter", "Supper", "Fisk", "Kylling", "Okse- og svinekød",
      "Kolde retter", "Forretter", "Salater", "Grønt tilbehør"
    ],
    ingredienser: [
      "Pasteuriserede æg", "Varmebehandlet kød", "Fisk", "Pålæg",
      "Frugt", "Grøntsager", "Kartofler", "Svampe",
      "Pasteuriserede mælkeprodukter", "Råt kød"
    ],
    kontrolType: "COOLING_UNITS",
    kilde: "0002",
    sikkerhed: "Høj"
  },

  {
    id: "ccp_opvarmning",
    type: "CCP",
    title: "Opvarmning og genopvarmning af fødevarer",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Risiko for tilstedeværelse af sygdomsfremkaldende bakterier pga. utilstrækkelig opvarmning. Det er især Listeria monocytogenes, Salmonella, Bacillus cereus og Campylobacter der kan være risiko for. Bakterierne bliver enten dræbt eller begrænset mest muligt ved at opvarme fødevarerne til minimum 75 °C. Det sikres derfor, at fødevarerne ved opvarmning opnår en kernetemperatur på minimum 75 °C. Undtagelsen er stege som fx roastbeef og svinekam, da hele kødstykker ikke behøver at blive gennemstegt. Hele kødstykker fra fjerkræ skal dog opvarmes til minimum 75 °C. Fisk er også undtaget kravet ved tilstrækkelig varmebehandling.",
    produkter: [
      "Forudproduceret mad", "Varme retter", "Gryderetter", "Forårsruller",
      "Nudler", "Risretter", "Supper", "Fisk", "Kylling", "Okse- og svinekød"
    ],
    ingredienser: [
      "Pasteuriserede æg", "Rå fisk og skaldyr", "Varmebehandlet kød",
      "Frugt", "Grøntsager", "Kartofler", "Svampe",
      "Nødder og frø", "Ris, pasta og tørrede bønner",
      "Pasteuriserede mælkeprodukter", "Vegetabilske fedtstoffer",
      "Rå æg", "Råt kød", "Frosne bær"
    ],
    kontrolType: "HEATING_PROCESS",
    kilde: "0003",
    sikkerhed: "Høj"
  },

  {
    id: "ccp_varmholdelse",
    type: "CCP",
    title: "Varmholdelse af fødevarer",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Der er risiko for vækst af sygdomsfremkaldende bakterier i varmebehandlede produkter efter varmebehandling. Det sikres derfor, at fødevarer der varmholdes bliver opbevaret ved en temperatur, der sikrer at alle dele af produktet er mindst 65 °C, indtil den bliver serveret. Hvis temperaturen falder til under 65 °C, sikres det at fødevaren er serveret, genopvarmet, kasseret eller lignende, inden der er gået 3 timer.",
    produkter: ["Varme retter", "Supper", "Gryderetter"],
    ingredienser: [
      "Rå æg", "Pasteuriserede æg", "Råt kød", "Rå fisk og skaldyr",
      "Varmebehandlet kød", "Frugt", "Grøntsager", "Kartofler", "Svampe",
      "Ris, pasta og tørrede bønner", "Pasteuriserede mælkeprodukter"
    ],
    kontrolType: "HOT_HOLDING",
    kilde: "0004",
    sikkerhed: "Høj"
  },

  {
    id: "ccp_nedkoeling",
    type: "CCP",
    title: "Nedkøling af varmebehandlede fødevarer",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Der er risiko for vækst af sygdomsfremkaldende bakterier hvis ikke varmebehandlede fødevarer køles effektivt. Det kan især være sporedannende bakterier som Clostridium perfringens, Clostridium botulinum og Bacillus cereus. Derfor skal det sikres, at varmebehandlede produkter nedkøles fra +65 °C til under +10 °C på maksimalt 4 timer (lovkrav). Fødevarerne opbevares herefter på køl eller frost.",
    produkter: ["Forudproduceret mad", "Rester"],
    ingredienser: [
      "Pasteuriserede æg", "Rå fisk og skaldyr", "Varmebehandlet kød",
      "Frugt", "Grøntsager", "Kartofler", "Svampe",
      "Ris, pasta og tørrede bønner",
      "Pasteuriserede mælkeprodukter", "Vegetabilske fedtstoffer",
      "Frosne råvarer"
    ],
    kontrolType: "COOLING_PROCESS",
    kilde: "0005",
    sikkerhed: "Høj"
  },

  {
    id: "gag_varemodtagelse_kontrol",
    type: "GAG",
    title: "Kontrol af varer ved modtagelse",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Når der modtages varer er der risiko for at varerne er forkert mærket, er af dårlig kvalitet, har overskredet holdbarhedsdatoen eller er beskadiget. Personalet er opmærksom på at kontrollere de varer, der modtages.",
    produkter: [
      "Forudproduceret mad", "Varme retter", "Gryderetter", "Forårsruller",
      "Nudler", "Risretter", "Supper", "Fisk", "Kylling", "Okse- og svinekød",
      "Kolde retter", "Forretter", "Salater", "Kaffe"
    ],
    ingredienser: [
      "Pasteuriserede æg", "Rå fisk og skaldyr", "Varmebehandlet kød",
      "Frugt", "Grøntsager", "Kartofler", "Svampe",
      "Nødder og frø", "Ris, pasta og tørrede bønner",
      "Pasteuriserede mælkeprodukter", "Vegetabilske fedtstoffer",
      "Frosne råvarer", "Rå æg", "Råt kød", "Frosne bær"
    ],
    kontrolType: "RECEIVING_ONLY",
    kilde: "0006",
    sikkerhed: "Middel"
  }

];

export const RISK_ANALYSIS_LIBRARY_PART_2 = [

  {
    id: "gag_opbevaring_koel_frost_overfyldning",
    type: "GAG",
    title: "Opbevaring i køle- og frost enheder uden overfyldning",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Ved opbevaring af køle- og frostkrævende fødevarer er der risiko for nedsat luftcirkulation og køle/fryseevne, hvis køle/fryseskabet overfyldes. Dette er der opmærksomhed på.",
    produkter: [
      "Forudproduceret mad", "Varme retter", "Gryderetter", "Forårsruller",
      "Nudler", "Risretter", "Supper", "Fisk", "Kylling", "Okse- og svinekød",
      "Kolde retter", "Forretter", "Salater"
    ],
    ingredienser: [
      "Pasteuriserede æg", "Rå fisk og skaldyr", "Varmebehandlet kød",
      "Frugt", "Grøntsager", "Kartofler", "Svampe",
      "Pasteuriserede mælkeprodukter"
    ],
    kontrolType: "COOLING_UNITS",
    kilde: "0007",
    sikkerhed: "Middel"
  },

  {
    id: "gag_frostvarer_temperatur",
    type: "GAG",
    title: "Opbevaring og modtagelse af frostvarer",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Når frostvarer bliver opbevaret eller modtaget sikrer virksomheden, at produkterne er frosne og overholder temperaturkrav i relevant lovgivning.",
    produkter: [
      "Forudproduceret mad", "Varme retter", "Gryderetter", "Forårsruller",
      "Nudler", "Risretter", "Supper", "Fisk", "Kylling", "Okse- og svinekød"
    ],
    ingredienser: [
      "Frosne råvarer", "Frosne bær"
    ],
    kontrolType: "FREEZER_UNITS",
    kilde: "0008",
    sikkerhed: "Høj"
  },

  {
    id: "gag_frugt_groent_opbevaring",
    type: "GAG",
    title: "Opbevaring af uforarbejdet frugt og grønt",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Der er lovmæssigt ikke et kølekrav på uforarbejdet frugt og grønt. Disse opbevares således, at kvaliteten bibeholdes bedst muligt. Virksomheden ved, at så snart der sker behandling (såsom udskæring) af frugt og grønt, så skal det opbevares ved maks. 5 grader.",
    produkter: [
      "Forudproduceret mad", "Varme retter", "Gryderetter",
      "Kolde retter", "Salater"
    ],
    ingredienser: [
      "Frugt", "Grøntsager", "Kartofler", "Svampe"
    ],
    kontrolType: "GENERAL_STORAGE",
    kilde: "0009",
    sikkerhed: "Lav"
  },

  {
    id: "gag_anbrud_dato_opbevaring",
    type: "GAG",
    title: "Mærkning og korrekt opbevaring efter åbning",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Der er risiko for vækst af sygdomsfremmende bakterier eller mug/skimmel hvis fødevarer opbevarer for længe eller forkert. Når ingredienser/råvarer åbnes, er det vigtigt at sikre, at de efterfølgende opbevares korrekt (f.eks. på køl) og at dato for anbrud angives. Dette gælder også, hvis varen overføres til en anden emballage.",
    produkter: [
      "Forudproduceret mad", "Varme retter", "Gryderetter",
      "Kolde retter", "Salater"
    ],
    ingredienser: [
      "Pasteuriserede æg", "Rå fisk og skaldyr", "Varmebehandlet kød",
      "Frugt", "Grøntsager", "Kartofler", "Svampe",
      "Nødder og frø", "Ris, pasta og tørrede bønner",
      "Pasteuriserede mælkeprodukter", "Vegetabilske fedtstoffer",
      "Frosne råvarer", "Rå æg", "Råt kød", "Frosne bær"
    ],
    kontrolType: "LABELING",
    kilde: "0010",
    sikkerhed: "Høj"
  },

  {
    id: "gag_tidsstyring_uden_koel",
    type: "GAG",
    title: "Tidsstyring af letfordærvelige fødevarer uden køl",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Der er risiko for vækst af sygdomsfremkaldende bakterier, hvis ikke letfordærvelige fødevarer bliver opbevaret tilstrækkeligt koldt eller varmt. Det sikres derfor, at alle letfordærvelige fødevarer, der i forbindelse med produktion, salg, servering eller lignende, opbevares uden køl eller varmholdelse, er serveret, nedkølet, genopvarmet eller kasseret inden 3 timer.",
    produkter: [
      "Varme retter", "Gryderetter", "Forårsruller",
      "Nudler", "Risretter", "Supper", "Fisk", "Kylling"
    ],
    ingredienser: [
      "Rå æg", "Pasteuriserede æg", "Råt kød",
      "Rå fisk og skaldyr", "Varmebehandlet kød",
      "Frugt", "Grøntsager", "Kartofler"
    ],
    kontrolType: "TIME_CONTROL",
    kilde: "0011",
    sikkerhed: "Høj"
  },

  {
    id: "gag_adskillelse_opbevaring",
    type: "GAG",
    title: "Adskillelse af fødevarer ved opbevaring",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Der er risiko for forurening af fødevarer hvis ikke virksomheden sikrer tilstrækkelig adskillelse mellem forskellige varer ved opbevaring på lager, i køleenheder mv. Alle varer skal således opbevares på en måde så de ikke forurener hinanden og aldrig direkte på gulvet.",
    produkter: [
      "Forudproduceret mad", "Varme retter", "Gryderetter",
      "Kolde retter", "Salater"
    ],
    ingredienser: [
      "Pasteuriserede æg", "Rå fisk og skaldyr", "Varmebehandlet kød",
      "Frugt", "Grøntsager", "Kartofler", "Svampe"
    ],
    kontrolType: "STORAGE_SEPARATION",
    kilde: "0012",
    sikkerhed: "Høj"
  },

  {
    id: "gag_optøning_koel",
    type: "GAG",
    title: "Optøning af fødevarer under kontrollerede forhold",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Når produkter optøs vækkes evt. tilstedeværende bakterier af dvale, og der er risiko for opformering. Optøning skal foregå i køleskab ved maks 5 grader (for fisk gælder 2 grader) for at hæmme denne potentielle opformering, og produktet opbevares tildækket og på en sådan måde, at det ikke drypper på andre fødevarer i køleskabet.",
    produkter: [
      "Forudproduceret mad", "Varme retter", "Gryderetter"
    ],
    ingredienser: [
      "Frosne råvarer"
    ],
    kontrolType: "COOLING_UNITS",
    kilde: "0013",
    sikkerhed: "Høj"
  }

];

export const RISK_ANALYSIS_LIBRARY_PART_3 = [

  {
    id: "gag_krydskontaminering",
    type: "GAG",
    title: "Adskillelse og krydskontaminering",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Fødevarer kan blive forurenet med bakterier på flere måder, fx. fra råvare til råvare og mellem rå og færdige produkter. Det er derfor vigtigt, at der ikke sker krydsforurening fra rå fødevarer til spiseklare produkter. Der undgås at sprede bakterier ved at tilberede og behandle råvarer hver for sig, hvor det er relevant, og holde dem adskilt fra spiseklare produkter. Virksomheden sikrer at f.eks. knive, maskiner og skærebrætter altid er rene og bliver gjort grundigt rene efter brug. Arbejdstøj, klude, viskestykker, forklæder og lignende kan sprede bakterier. Derfor sikres det, at de er rene og skiftes hyppigt.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter, forårsruller, nudler, risretter, supper, fisk, kylling, okse- og svinekød o.lign.",
      "Kolde retter, forretter, salater o.lign.",
      "Varme retter, suppe, gryderetter o.lign.",
      "Grønt tilbehør, forudproduktion",
      "Grøntsager, urter"
    ],
    ingredienser: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg o.lign.",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Rå æg",
      "Råt kød",
      "Frosne bær"
    ],
    kontrolType: "NONE",
    kilde: "0014",
    sikkerhed: "Høj"
  },

  {
    id: "gag_hurtig_indfrysning",
    type: "GAG",
    title: "Hurtig indfrysning i passende portioner",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Der er risiko for vækst af sygdomsfremkaldende bakterier, hvis ikke fødevarer indfryses hurtigt. Virksomheden sikrer derfor, at fødevarer, der skal indfryses, deles i passende portioner, og at der er tilstrækkelig frysekapacitet i fryseenheder og at disse ikke overfyldes.",
    produkter: [
      "Forudproduceret mad, rester"
    ],
    ingredienser: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg o.lign.",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Frosne råvarer"
    ],
    kontrolType: "FREEZER_UNITS",
    kilde: "0015",
    sikkerhed: "Middel"
  },

  {
    id: "gag_vask_frugt_groent",
    type: "GAG",
    title: "Skylning af frugt, grøntsager, salat, spirer og krydderurter",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Der er risiko for bakterier og virus på overfladen af frugt og grønt. Derfor skyller virksomheden alle frugt og grøntsager, også salat, spirer og krydderurter. Virksomheden har kendskab til at fødevarestyrelsen anbefaler, at frosne bær, babymajs og sukkerærter skal have et kort opkog.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter, forårsruller, nudler, risretter, supper, fisk, kylling, okse- og svinekød o.lign.",
      "Kolde retter, forretter, salater o.lign.",
      "Varme retter, suppe, gryderetter o.lign.",
      "Grønt tilbehør, forudproduktion",
      "Grøntsager, urter"
    ],
    ingredienser: [
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe"
    ],
    kontrolType: "NONE",
    kilde: "0016",
    sikkerhed: "Høj"
  },

  {
    id: "gag_pasteuriserede_aeg",
    type: "GAG",
    title: "Anvendelse af pasteuriserede æg i kolde retter",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Ved produktion af fødevarer indeholdende æg, som ikke undergår varmebehandling, bruges der pasteuriserende æg, pga. risiko for Salmonella og Campylobacter.",
    produkter: [
      "Kolde retter, forretter, salater o.lign."
    ],
    ingredienser: [
      "Pasteuriserede æg"
    ],
    kontrolType: "NONE",
    kilde: "0017",
    sikkerhed: "Høj"
  },

  {
    id: "gag_hakket_kod_oplysning",
    type: "GAG",
    title: "Oplysning til kunder ved servering af ikke gennemstegt hakket kød",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Serveres der hakket kød der ikke er varmebehandlet til min. +75 °C i centrum, og hvor der ikke er anvendt en alternativ varmebehandling der sikrer tilsvarende bakteriedrab skal kunderne tydeligt gøres opmærksomme på dette. Det kan eksempelvis gøres ved at skrive på menukortet at der anvendes en lempeligere varmebehandling med større risiko for, at det serverede kød indeholder sygdomsfremkaldende bakterier.",
    produkter: [
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød o.lign."
    ],
    ingredienser: [
      "Råt kød"
    ],
    kontrolType: "NONE",
    kilde: "0018",
    sikkerhed: "Høj"
  },

  {
    id: "gag_frosne_hindbaer",
    type: "GAG",
    title: "Varmebehandling af retter med frosne hindbær",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Frosne hindbær kan indeholde Norovirus og andre sygdomsfremkaldende mikroorganismer. Derfor er virksomheden opmærksom på at frosne hindbær indgår i retter, der bliver varmebehandlet tilstrækkeligt.",
    produkter: [
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød o.lign.",
      "Varme retter, suppe, gryderetter o.lign."
    ],
    ingredienser: [
      "Frosne bær"
    ],
    kontrolType: "HEATING_PROCESS",
    kilde: "0019",
    sikkerhed: "Høj"
  },

  {
    id: "gag_holdbarhed_faerdigpakkede",
    type: "GAG",
    title: "Kontrol af holdbarhedsdato på færdigpakkede fødevarer",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Fødevarer må ikke være sundhedsskadelige eller uegnede til at spise, når virksomheden sælger eller anvender dem. De fleste fødevarer er mærket med en dato for mindst holdbar til, som kan hjælpe virksomheden til at vurdere, hvor længe fødevarerne er holdbare. Færdigpakkede fødevarer må som udgangspunkt ikke sælges hvis holdbarhedsdatoen er overskredet.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter, forårsruller, nudler, risretter, supper, fisk, kylling, okse- og svinekød o.lign.",
      "Kolde retter, forretter, salater o.lign.",
      "Kaffe",
      "Varme retter, suppe, gryderetter o.lign.",
      "Grønt tilbehør, forudproduktion",
      "Grøntsager, urter"
    ],
    ingredienser: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg o.lign.",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær",
      "Isterninger"
    ],
    kontrolType: "NONE",
    kilde: "0020",
    sikkerhed: "Høj"
  },

  {
    id: "gag_mugpletter_skimmel",
    type: "GAG",
    title: "Kassation af fødevarer med mugpletter og skimmel",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Fødevarer med mugpletter er uønskede, da der kan være svampegifte og/eller svampemycelium i fødevaren, undtaget er fødevarer, såsom blåskimmelost o.lign. Fødevarer med mug og skimmel bør derfor smides ud. Virksomheden sikrer, at fødevarerne opbevares korrekt, da dette nedsætter risikoen for vækst mug og skimmel. For eksempel skal tørvarer ikke opbevares fugtigt.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter, forårsruller, nudler, risretter, supper, fisk, kylling, okse- og svinekød o.lign.",
      "Kolde retter, forretter, salater o.lign.",
      "Kaffe",
      "Varme retter, suppe, gryderetter o.lign.",
      "Grønt tilbehør, forudproduktion",
      "Grøntsager, urter"
    ],
    ingredienser: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg o.lign.",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær",
      "Isterninger"
    ],
    kontrolType: "NONE",
    kilde: "0021",
    sikkerhed: "Middel"
  },

  {
    id: "gag_personlig_hygiejne",
    type: "GAG",
    title: "Personlig hygiejne i fødevarehåndtering",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "En god personlig hygiejne er vigtig i en virksomhed der håndterer fødevarer. Både sygdomsfremkaldende bakterier og virus kan forurene virksomhedens produkter hvis personalets personlige hygiejne ikke er god nok. Det er vigtigt at vaske hænder ved skift mellem arbejdsprocesser. Virksomheden har kendskab til, at Statens Serum Institut anbefaler, at personale med mave/tarminfektion (f.eks. Norovirus) skal sygemeldes indtil 48 timer efter, at symptomerne er stoppet.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter, forårsruller, nudler, risretter, supper, fisk, kylling, okse- og svinekød o.lign.",
      "Kolde retter, forretter, salater o.lign.",
      "Kaffe",
      "Varme retter, suppe, gryderetter o.lign.",
      "Grønt tilbehør, forudproduktion",
      "Grøntsager, urter"
    ],
    ingredienser: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg o.lign.",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær",
      "Isterninger"
    ],
    kontrolType: "NONE",
    kilde: "0022",
    sikkerhed: "Høj"
  },

  {
    id: "gag_rengoering_udstyr",
    type: "GAG",
    title: "Rengøring og desinfektion af produktionsudstyr og redskaber",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Rengøring og desinfektion af produktionsudstyr og redskaber skal mindske risikoen for krydskontaminering mellem forskellige fødevaregrupper.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter, forårsruller, nudler, risretter, supper, fisk, kylling, okse- og svinekød o.lign.",
      "Kolde retter, forretter, salater o.lign.",
      "Varme retter, suppe, gryderetter o.lign.",
      "Grønt tilbehør, forudproduktion",
      "Grøntsager, urter"
    ],
    ingredienser: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg o.lign.",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær"
    ],
    kontrolType: "DISHWASHER_TEMP",
    kilde: "0023",
    sikkerhed: "Høj"
  }

];

export const RISK_ANALYSIS_LIBRARY_PART_4 = [

  {
    id: "gag_softice_maskine",
    type: "GAG",
    title: "Softicemaskine – rengøring, vedligeholdelse og hygiejne",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Softicemaskiner kan udgøre en særlig mikrobiologisk risiko, hvis maskinen ikke rengøres, adskilles og vedligeholdes korrekt. Der er risiko for bakterievækst og biofilm i maskinen samt i slidte eller beskadigede dele. Virksomheden sikrer derfor korrekt rengøring, vedligeholdelse og kontrol af maskinens stand, herunder pakninger, overflader og tegn på rust eller slitage.",
    produkter: [],
    ingredienser: [],
    kontroller: [
      "Rengøring og desinfektion",
      "Vedligeholdelse",
      "Kontrol af pakninger, overflader og rust"
    ],
    kontrolType: "NONE",
    kilde: "0024",
    sikkerhed: "Høj"
  },

  {
    id: "gag_fadoel_anlaeg",
    type: "GAG",
    title: "Fadølsanlæg – rengøring, vedligeholdelse og hygiejne",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Fadølsanlæg kan være kilde til bakterievækst og biofilm i slanger, koblinger og anlæg, hvis de ikke rengøres korrekt. Der kan samtidig opstå problemer ved slidte dele, overflader og pakninger. Virksomheden sikrer derfor rengøring, vedligeholdelse og kontrol af anlæggets stand.",
    produkter: [],
    ingredienser: [],
    kontroller: [
      "Rengøring af anlæg og slanger",
      "Vedligeholdelse",
      "Kontrol af pakninger, koblinger og overflader"
    ],
    kontrolType: "NONE",
    kilde: "0025",
    sikkerhed: "Middel"
  },

  {
    id: "gag_slushice_maskine",
    type: "GAG",
    title: "Slushicemaskine – rengøring, vedligeholdelse og hygiejne",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Slushicemaskiner kan udgøre en særlig risiko for bakterie-, gær- og mugvækst, hvis de ikke rengøres og vedligeholdes korrekt. Produktrester og fugtige overflader kan skabe gode vækstbetingelser for mikroorganismer. Virksomheden sikrer derfor korrekt rengøring, vedligeholdelse og kontrol af maskinens stand.",
    produkter: [],
    ingredienser: [],
    kontroller: [
      "Rengøring og desinfektion",
      "Vedligeholdelse",
      "Kontrol af pakninger, overflader og rust"
    ],
    kontrolType: "NONE",
    kilde: "0026",
    sikkerhed: "Middel"
  },

  {
    id: "gag_kaffemaskine_rengoering",
    type: "GAG",
    title: "Kaffemaskine – rengøring, vedligeholdelse og hygiejnisk drift",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Kaffemaskiner og tilhørende systemer kan indeholde bakterier og biofilm, hvis de ikke rengøres korrekt. Dette gælder især komponenter med vand, fugt og eventuelle mælkesystemer. Virksomheden sikrer derfor regelmæssig rengøring, vedligeholdelse og kontrol af maskinens stand.",
    produkter: [],
    ingredienser: [],
    kontroller: [
      "Rengøring",
      "Vedligeholdelse",
      "Kontrol af pakninger, slanger og overflader"
    ],
    kontrolType: "NONE",
    kilde: "0027",
    sikkerhed: "Lav"
  },

  {
    id: "gag_isterningemaskine",
    type: "GAG",
    title: "Isterningemaskine – rengøring, vedligeholdelse og hygiejne",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Isterningemaskiner kan forurenes, hvis maskinen ikke rengøres og vedligeholdes korrekt. Der er risiko for bakterievækst, biofilm og uhygiejniske overflader samt problemer med slidte pakninger, rust eller andre defekter. Virksomheden sikrer derfor korrekt rengøring, vedligeholdelse og kontrol af maskinens stand.",
    produkter: [],
    ingredienser: [],
    kontroller: [
      "Rengøring og desinfektion",
      "Vedligeholdelse",
      "Kontrol af pakninger, overflader og rust"
    ],
    kontrolType: "NONE",
    kilde: "0028",
    sikkerhed: "Høj"
  },

  {
    id: "gag_vandkvalitet",
    type: "GAG",
    title: "Vandkvalitet i fødevareproduktion",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Vand, der anvendes i fødevareproduktion, skal være af drikkevandskvalitet. Hvis vandet er forurenet, kan det medføre sygdom hos forbrugerne. Virksomheden sikrer, at vandet er egnet til formålet.",
    produkter: [
      "Kaffe",
      "Drikkevarer"
    ],
    ingredienser: [
      "Vand",
      "Isterninger"
    ],
    kontroller: [],
    kontrolType: "NONE",
    kilde: "0029",
    sikkerhed: "Middel"
  },

  {
    id: "gag_vibrio_fisk",
    type: "GAG",
    title: "Håndtering af fisk og skaldyr (Vibrio bakterier)",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Rå fisk og skaldyr kan indeholde Vibrio bakterier, som kan give sygdom. Risikoen reduceres ved korrekt opbevaring ved lave temperaturer og ved tilstrækkelig varmebehandling.",
    produkter: [
      "Fisk",
      "Skaldyr",
      "Varme retter",
      "Kolde retter"
    ],
    ingredienser: [
      "Rå fisk og skaldyr"
    ],
    kontroller: [
      "Køleopbevaring",
      "Tilstrækkelig varmebehandling"
    ],
    kontrolType: "NONE",
    kilde: "0030",
    sikkerhed: "Høj"
  },

  {
    id: "gag_syltning_ph",
    type: "GAG",
    title: "Syltning og kontrol af pH-værdi",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Ved syltning er det vigtigt at sikre korrekt pH-værdi, da for høj pH kan give risiko for bakterievækst. Virksomheden sikrer, at opskrifter følges, og at pH er tilstrækkeligt lav til at hæmme bakterier.",
    produkter: [
      "Syltede produkter",
      "Grøntsager"
    ],
    ingredienser: [
      "Frugt",
      "Grøntsager",
      "Eddike"
    ],
    kontroller: [
      "Kontrol af opskrift",
      "Kontrol af pH-værdi"
    ],
    kontrolType: "NONE",
    kilde: "0031",
    sikkerhed: "Middel"
  },

  {
    id: "gag_transport_opbevaring",
    type: "GAG",
    title: "Transport og opbevaring af fødevarer",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Under transport kan fødevarer blive udsat for temperaturændringer og forurening. Virksomheden sikrer derfor, at fødevarer transporteres under passende temperaturforhold og beskyttes mod forurening.",
    produkter: [],
    ingredienser: [],
    kontroller: [
      "Beskyttelse mod forurening",
      "Kontrol af temperaturforhold"
    ],
    kontrolType: "NONE",
    kilde: "0032",
    sikkerhed: "Middel"
  },

  {
    id: "gag_servering_hygiejne",
    type: "GAG",
    title: "Hygiejne ved servering",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Ved servering af fødevarer er der risiko for forurening fra personale og omgivelser. Virksomheden sikrer god hygiejne ved servering og korrekt håndtering af fødevarer.",
    produkter: [],
    ingredienser: [],
    kontroller: [
      "Hygiejnisk servering",
      "Korrekt håndtering af fødevarer"
    ],
    kontrolType: "NONE",
    kilde: "0033",
    sikkerhed: "Middel"
  }

];

export const RISK_ANALYSIS_LIBRARY_PART_5 = [

  {
    id: "gag_olier_fedtstoffer",
    type: "GAG",
    title: "Anvendelse og udskiftning af fritureolie og fedtstoffer",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Ved gentagen opvarmning af olie og fedtstoffer kan der dannes skadelige stoffer som fx akrylamid og nedbrydningsprodukter, der kan være sundhedsskadelige. Virksomheden sikrer, at olie og fedtstoffer udskiftes regelmæssigt og ikke anvendes ved for høje temperaturer eller i for lang tid.",
    produkter: [
      "Friterede produkter",
      "Kartoffelprodukter",
      "Kødretter",
      "Fisk"
    ],
    ingredienser: [
      "Vegetabilske fedtstoffer",
      "Olier"
    ],
    kontrolType: "NONE",
    kilde: "0034",
    sikkerhed: "Middel"
  },

  {
    id: "gag_krydderier_kontaminering",
    type: "GAG",
    title: "Håndtering af krydderier og tørvarer",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Krydderier og tørvarer kan være forurenet med bakterier, skimmel eller kemiske stoffer. Virksomheden sikrer korrekt opbevaring tørt og rent, samt at der ikke sker krydskontaminering under brug.",
    produkter: [
      "Alle retter",
      "Supper",
      "Saucer",
      "Marinader"
    ],
    ingredienser: [
      "Krydderier",
      "Nødder og frø",
      "Mel og tørvarer"
    ],
    kontrolType: "NONE",
    kilde: "0035",
    sikkerhed: "Middel"
  },

  {
    id: "gag_saucer_dressinger",
    type: "GAG",
    title: "Håndtering af saucer og dressinger",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Saucer og dressinger kan indeholde allergener og være udsat for bakterievækst, hvis de ikke opbevares korrekt. Virksomheden sikrer korrekt opbevaring, mærkning og håndtering.",
    produkter: [
      "Kolde retter",
      "Salater",
      "Dressinger",
      "Saucer"
    ],
    ingredienser: [
      "Nødder og frø",
      "Olie",
      "Æg",
      "Mælkeprodukter"
    ],
    kontrolType: "NONE",
    kilde: "0036",
    sikkerhed: "Middel"
  },

  {
    id: "gag_allergener",
    type: "GAG",
    title: "Håndtering af allergener",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Fødevarer kan indeholde allergener, som kan give alvorlige reaktioner hos følsomme personer. Virksomheden sikrer korrekt mærkning, adskillelse og information til kunder om allergener i fødevarer.",
    produkter: [
      "Alle retter",
      "Kolde retter",
      "Varme retter",
      "Bagværk"
    ],
    ingredienser: [
      "Nødder",
      "Gluten",
      "Mælk",
      "Æg",
      "Soja"
    ],
    kontrolType: "NONE",
    kilde: "0037",
    sikkerhed: "Høj"
  },

  {
    id: "gag_emballering",
    type: "GAG",
    title: "Egnet emballage til fødevarer",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Fødevarer skal opbevares i emballage, der er egnet til fødevarer. Forkert emballage kan afgive kemiske stoffer til fødevaren. Virksomheden sikrer brug af godkendt fødevareemballage.",
    produkter: [
      "Takeaway",
      "Færdigretter",
      "Opbevarede fødevarer"
    ],
    ingredienser: [
      "Alle ingredienser"
    ],
    kontrolType: "NONE",
    kilde: "0038",
    sikkerhed: "Høj"
  },

  {
    id: "gag_maerkning",
    type: "GAG",
    title: "Korrekt mærkning af fødevarer",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Forkert eller manglende mærkning kan føre til sundhedsrisici, fx ved allergener eller holdbarhed. Virksomheden sikrer korrekt mærkning af fødevarer.",
    produkter: [
      "Alle fødevarer",
      "Færdigpakkede varer"
    ],
    ingredienser: [
      "Alle ingredienser"
    ],
    kontrolType: "LABELING",
    kilde: "0039",
    sikkerhed: "Høj"
  },

  {
    id: "gag_vedligeholdelse",
    type: "GAG",
    title: "Vedligeholdelse af lokaler og udstyr",
    kategori: "Fysiske sundhedsfarer",
    beskrivelse: "Defekte overflader og udstyr kan føre til forurening af fødevarer med fremmedlegemer. Virksomheden sikrer løbende vedligeholdelse af lokaler og udstyr.",
    produkter: [
      "Alle fødevarer"
    ],
    ingredienser: [
      "Alle ingredienser"
    ],
    kontrolType: "NONE",
    kilde: "0040",
    sikkerhed: "Høj"
  },

  {
    id: "gag_skadedyr",
    type: "GAG",
    title: "Forebyggelse af skadedyr",
    kategori: "Fysiske sundhedsfarer",
    beskrivelse: "Skadedyr kan forurene fødevarer med bakterier og fremmedlegemer. Virksomheden sikrer forebyggelse, overvågning og bekæmpelse af skadedyr.",
    produkter: [
      "Alle fødevarer"
    ],
    ingredienser: [
      "Alle ingredienser"
    ],
    kontrolType: "NONE",
    kilde: "0041",
    sikkerhed: "Høj"
  },

  {
    id: "gag_affald",
    type: "GAG",
    title: "Håndtering af affald",
    kategori: "Fysiske sundhedsfarer",
    beskrivelse: "Affald kan tiltrække skadedyr og skabe risiko for forurening. Virksomheden sikrer korrekt håndtering og bortskaffelse af affald.",
    produkter: [
      "Alle fødevarer"
    ],
    ingredienser: [
      "Alle ingredienser"
    ],
    kontrolType: "NONE",
    kilde: "0042",
    sikkerhed: "Middel"
  },

  {
    id: "gag_rengoringsmidler",
    type: "GAG",
    title: "Opbevaring og anvendelse af rengøringsmidler",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Rengøringsmidler kan forurene fødevarer, hvis de ikke opbevares og anvendes korrekt. Virksomheden sikrer korrekt opbevaring adskilt fra fødevarer.",
    produkter: [
      "Alle fødevarer"
    ],
    ingredienser: [
      "Alle ingredienser"
    ],
    kontrolType: "NONE",
    kilde: "0043",
    sikkerhed: "Høj"
  }

];

export const RISK_ANALYSIS_LIBRARY_PART_6 = [

  {
    id: "ccp_histamin_fisk",
    type: "CCP",
    title: "Temperaturkontrol af rå fisk (histamin)",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Ved modtagelse og opbevaring af rå fersk fisk, skal det sikres, at fisken er 2 °C eller koldere, da for høje temperaturer kan resultere i, at der bliver dannet store mængder histamin i fisken. Histamin kan give alvorlige forgiftninger. Temperaturen kan også sikres ved at opbevare fisken på is.",
    produkter: [
      "Forudproduceret mad",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød"
    ],
    ingredienser: [
      "Rå fisk og skaldyr"
    ],
    kontrolType: "RECEIVING_ONLY",
    kilde: "0007",
    sikkerhed: "Høj"
  },

  {
    id: "gag_pah_stegning",
    type: "GAG",
    title: "Stegning, grillning og røgning (PAH)",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Ved stegning, grillning eller røgning af fisk og kød kan der dannes kræftfremkaldende stoffer (PAH). Dannelsen af PAH kan minimeres ved at undgå at branke kødet og undgå for meget os, fx ved at fedt drypper ned på grillkullene. PAH i røgede produkter kan styres ved at vælge egnet brændsel, tilpasse indholdet af fedt i fødevaren, optimere afstanden mellem brændsel og fødevarer samt ved hyppig rengøring af røgekammeret.",
    produkter: [
      "Forudproduceret mad",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød"
    ],
    ingredienser: [
      "Rå fisk og skaldyr",
      "Varmebehandlet kød",
      "Råt kød"
    ],
    kontrolType: "NONE",
    kilde: "0007",
    sikkerhed: "Middel"
  },

  {
    id: "gag_akrylamid",
    type: "GAG",
    title: "Stegning og ristning (akrylamid)",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Der er risiko for dannelse af akrylamid ved stegning/ristning af kulhydratholdige produkter, for eksempel kartofler, ristet brød, bagt brød, kiks og knækbrød. Virksomheden kan minimere dannelsen af akrylamid ved at stege/rist ved lavere temperatur og stege til gylden i stedet for mørk farve. Fødevarestyrelsen anbefaler, at temperaturen ved frittering af pommes frites er under 175 °C.",
    produkter: [
      "Forudproduceret mad",
      "Varme retter",
      "Gryderetter",
      "Brødprodukter"
    ],
    ingredienser: [
      "Kartofler",
      "Mel",
      "Korn og kornprodukter",
      "Brød og brødprodukter"
    ],
    kontrolType: "NONE",
    kilde: "0007",
    sikkerhed: "Middel"
  },

  {
    id: "gag_escolar_oliefisk",
    type: "GAG",
    title: "Håndtering af escolar og oliefisk",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Fiskene escolar og oliefisk/smørmakrel indeholder voksarter, som kan give diarré, hvis de ikke tilberedes korrekt. Virksomheden sikrer, at fisken steges eller koges omhyggeligt, så voksarterne smelter ud af fisken. Kogevand og stegefedt anvendes ikke til videre madlavning. Disse fisk må ikke anvendes til rå servering såsom sushi.",
    produkter: [
      "Varme retter",
      "Fiskeretter"
    ],
    ingredienser: [
      "Rå fisk og skaldyr"
    ],
    kontrolType: "NONE",
    kilde: "0007",
    sikkerhed: "Middel"
  },

  {
    id: "gag_mykotoksiner",
    type: "GAG",
    title: "Mykotoksiner i nødder og tørrede produkter",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Der er risiko for indhold af mykotoksiner i nødder, frø og tørrede frugter fra tropiske og subtropiske områder. Mykotoksiner er giftige ved længere tids påvirkning. Virksomheden kan ikke selv fjerne disse, men sikrer at der kun modtages varer fra godkendte leverandører.",
    produkter: [
      "Forudproduceret mad",
      "Varme retter",
      "Kolde retter"
    ],
    ingredienser: [
      "Nødder og frø"
    ],
    kontrolType: "RECEIVING_ONLY",
    kilde: "0008",
    sikkerhed: "Høj"
  },

  {
    id: "gag_cyanid_mandler",
    type: "GAG",
    title: "Cyanid i bitre mandler og frø",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Bitre mandler indeholder store mængder cyanid og kan være giftige. Abrikoskerner og solsikkefrø indeholder mindre mængder, men bør ikke indtages i store mængder. Virksomheden sikrer begrænset anvendelse og korrekt håndtering.",
    produkter: [
      "Forudproduceret mad",
      "Varme retter",
      "Bagværk"
    ],
    ingredienser: [
      "Nødder og frø"
    ],
    kontrolType: "NONE",
    kilde: "0008",
    sikkerhed: "Middel"
  },

  {
    id: "gag_solanin_kartofler",
    type: "GAG",
    title: "Solanin i kartofler",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Der er risiko for forhøjet indhold af solanin i grønne eller spirede kartofler. Virksomheden sikrer, at disse sorteres fra og ikke anvendes i produktionen.",
    produkter: [
      "Varme retter",
      "Kartoffelretter"
    ],
    ingredienser: [
      "Kartofler"
    ],
    kontrolType: "NONE",
    kilde: "0008",
    sikkerhed: "Middel"
  },

  {
    id: "gag_champignon_phenylhydrazin",
    type: "GAG",
    title: "Varmebehandling af champignon",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Champignon indeholder phenylhydrazin, som kan være kræftfremkaldende. Virksomheden følger anbefalingen om at varmebehandle champignon, da det reducerer indholdet.",
    produkter: [
      "Varme retter",
      "Gryderetter"
    ],
    ingredienser: [
      "Svampe"
    ],
    kontrolType: "NONE",
    kilde: "0008",
    sikkerhed: "Lav"
  },

  {
    id: "gag_cucurbitacin",
    type: "GAG",
    title: "Bitre squash og courgetter",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Squash og courgetter kan indeholde cucurbitaciner, som er bitre og giftige. Virksomheden sikrer, at bitre grøntsager ikke anvendes i produktionen.",
    produkter: [
      "Varme retter",
      "Grøntsagsretter"
    ],
    ingredienser: [
      "Grøntsager"
    ],
    kontrolType: "NONE",
    kilde: "0008",
    sikkerhed: "Middel"
  }

];
export const RISK_ANALYSIS_LIBRARY_PART_7 = [

  {
    id: "gag_lektiner_boenner",
    type: "GAG",
    title: "Tilberedning af tørrede bønner og bælgfrugter",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Der er risiko for forgiftning med lektiner hvis ikke tørrede bønner og hyldebær behandles korrekt. Tørrede bønner skal udblødes og koges i rigeligt vand, så de er helt dækkede. Producentens anvisninger følges. Hyldebær skal koges minimum 15 minutter. Grønne bønner (haricot verts) indeholder også lektiner og skal blancheres.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter, nudler, risretter, supper",
      "Grønt tilbehør, forudproduktion"
    ],
    ingredienser: [
      "Frugt",
      "Ris, pasta og tørrede bønner"
    ],
    kontrolType: "NONE",
    kilde: "0044",
    sikkerhed: "Høj"
  },

  {
    id: "gag_giftige_svamp",
    type: "GAG",
    title: "Anvendelse af svampe",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Svampegifte kan findes i giftige svampe. Derfor anvendes kun svampe man med sikkerhed kender, og kun anerkendte spisesvampe.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter"
    ],
    ingredienser: [
      "Svampe"
    ],
    kontrolType: "NONE",
    kilde: "0045",
    sikkerhed: "Høj"
  },

  {
    id: "gag_udstyr_afsmitning",
    type: "GAG",
    title: "Afsmitning fra redskaber og produktionsudstyr",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Stoffer fra redskaber og produktionsudstyr kan overføres til fødevarer. Der anvendes kun egnet udstyr til de forskellige fødevarer.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter, forårsruller, nudler, risretter, supper, fisk, kylling, okse- og svinekød o.lign.",
      "Kolde retter, forretter, salater o.lign.",
      "Grønt tilbehør, forudproduktion",
      "Grøntsager, urter"
    ],
    ingredienser: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg o.lign.",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær"
    ],
    kontrolType: "NONE",
    kilde: "0046",
    sikkerhed: "Middel"
  },

  {
    id: "gag_rengoeringsmidler_afsmitning",
    type: "GAG",
    title: "Afsmitning fra rengørings- og desinfektionsmidler",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Der anvendes kun rengørings- og desinfektionsmidler beregnet til fødevarevirksomheder. Midler opbevares korrekt og adskilt fra fødevarer.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter, forårsruller, nudler, risretter, supper, fisk, kylling, okse- og svinekød o.lign.",
      "Kolde retter, forretter, salater o.lign.",
      "Kaffe",
      "Grønt tilbehør, forudproduktion",
      "Grøntsager, urter"
    ],
    ingredienser: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg o.lign.",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær",
      "Isterninger"
    ],
    kontrolType: "NONE",
    kilde: "0047",
    sikkerhed: "Høj"
  },

  {
    id: "gag_emballage_kontakt",
    type: "GAG",
    title: "Materialer i kontakt med fødevarer",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Der kan overføres kemikalier fra emballage og redskaber til fødevarer. Derfor anvendes kun materialer beregnet til fødevarekontakt.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter, forårsruller, nudler, risretter, supper, fisk, kylling, okse- og svinekød o.lign.",
      "Kolde retter, forretter, salater o.lign.",
      "Kaffe",
      "Grønt tilbehør, forudproduktion",
      "Grøntsager, urter"
    ],
    ingredienser: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg o.lign.",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær",
      "Isterninger"
    ],
    kontrolType: "NONE",
    kilde: "0048",
    sikkerhed: "Høj"
  },

  {
    id: "gag_allergener_kontrol",
    type: "GAG",
    title: "Kontrol af allergener",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Virksomheden sikrer korrekt information, mærkning og adskillelse af allergener samt minimerer krydskontaminering.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter, forårsruller, nudler, risretter, supper, fisk, kylling, okse- og svinekød o.lign.",
      "Kolde retter, forretter, salater o.lign.",
      "Grønt tilbehør, forudproduktion"
    ],
    ingredienser: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg o.lign.",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær"
    ],
    kontrolType: "NONE",
    kilde: "0049",
    sikkerhed: "Høj"
  },

  {
    id: "gag_tilsaetningsstoffer",
    type: "GAG",
    title: "Korrekt anvendelse af tilsætningsstoffer",
    kategori: "Kemiske sundhedsfarer",
    beskrivelse: "Tilsætningsstoffer anvendes korrekt og i passende mængder i henhold til reglerne.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, gryderetter"
    ],
    ingredienser: [
      "Vegetabilske fedtstoffer",
      "Forarbejdede ingredienser"
    ],
    kontrolType: "NONE",
    kilde: "0050",
    sikkerhed: "Middel"
  },

  {
    id: "gag_fremmedlegemer_opbevaring",
    type: "GAG",
    title: "Forebyggelse af fremmedlegemer ved opbevaring",
    kategori: "Fysiske sundhedsfarer",
    beskrivelse: "Alle varer opbevares korrekt, så de ikke forurener hinanden og aldrig direkte på gulvet.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, kolde retter"
    ],
    ingredienser: [
      "Alle relevante ingredienser fra produktionen"
    ],
    kontrolType: "STORAGE_SEPARATION",
    kilde: "0053",
    sikkerhed: "Høj"
  },

  {
    id: "gag_skadedyr_kontrol",
    type: "GAG",
    title: "Kontrol og forebyggelse af skadedyr",
    kategori: "Fysiske sundhedsfarer",
    beskrivelse: "Lokaler sikres mod indtrængning af skadedyr og kontrolleres løbende.",
    produkter: [
      "Forudproduceret mad, rester",
      "Varme retter, kolde retter"
    ],
    ingredienser: [
      "Alle relevante ingredienser fra produktionen"
    ],
    kontrolType: "NONE",
    kilde: "0054",
    sikkerhed: "Høj"
  }

];
 export const RISK_ANALYSIS_LIBRARY_PART_8 = [

  {
    id: "gag_personlig_hygiejne",
    type: "GAG",
    title: "Personlig hygiejne",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Manglende personlig hygiejne kan medføre overførsel af sygdomsfremkaldende bakterier til fødevarer. Virksomheden sikrer derfor, at personalet har god personlig hygiejne, herunder korrekt håndvask og anvendelse af håndvaskeudstyr. Der skal altid være adgang til sæbe og papir ved håndvaske. Personalet anvender korrekt arbejdstøj og følger hygiejniske retningslinjer i produktionen.",
    produkter: [],
    ingredienser: [],
    kontroller: [
   "Håndvask",
   "Tilgængeligt håndvaskeudstyr (sæbe og papir)",
   "Korrekt arbejdstøj",
   "Hygiejnisk adfærd"
   ],
    kontrolType: "NONE",
    kilde: "0048",
    sikkerhed: "Høj"
  },

  {
    id: "gag_rengoering_lokaler",
    type: "GAG",
    title: "Rengøring af lokaler og overflader",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Utilstrækkelig rengøring af lokaler og overflader kan føre til bakterievækst og krydskontaminering. Virksomheden sikrer derfor systematisk rengøring og desinfektion af alle relevante områder.",
    produkter: [],
    ingredienser: [],
    kontroller: [
      "Rengøring",
      "Desinfektion",
      "Kontrol af rengøringsniveau"
    ],
    kontrolType: "NONE",
    kilde: "0049",
    sikkerhed: "Høj"
  },

  {
    id: "gag_vedligehold_lokaler",
    type: "GAG",
    title: "Vedligeholdelse af lokaler og udstyr",
    kategori: "Fysiske sundhedsfarer",
    beskrivelse: "Slidte eller beskadigede overflader og udstyr kan medføre fremmedlegemer i fødevarer samt vanskeliggøre rengøring. Virksomheden sikrer derfor løbende vedligeholdelse.",
    produkter: [],
    ingredienser: [],
    kontroller: [
      "Vedligeholdelse",
      "Kontrol af overflader",
      "Kontrol af skader og slitage"
    ],
    kontrolType: "NONE",
    kilde: "0050",
    sikkerhed: "Middel"
  },

  {
    id: "gag_affald_haandtering",
    type: "GAG",
    title: "Håndtering af affald",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Forkert håndtering af affald kan tiltrække skadedyr og medføre forurening. Virksomheden sikrer korrekt opbevaring og bortskaffelse af affald.",
    produkter: [],
    ingredienser: [],
    kontroller: [
      "Korrekt affaldshåndtering",
      "Adskillelse fra fødevarer",
      "Regelmæssig tømning"
    ],
    kontrolType: "NONE",
    kilde: "0051",
    sikkerhed: "Middel"
  },

  {
    id: "gag_skadedyr_forebyggelse",
    type: "GAG",
    title: "Forebyggelse af skadedyr",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Skadedyr kan overføre sygdomme og forurene fødevarer. Virksomheden sikrer derfor forebyggelse og kontrol af skadedyr.",
    produkter: [],
    ingredienser: [],
    kontroller: [
      "Kontrol for tegn på skadedyr",
      "Forebyggende foranstaltninger",
      "Sikring af lokaler"
    ],
    kontrolType: "NONE",
    kilde: "0052",
    sikkerhed: "Høj"
  },

  {
    id: "gag_opbevaring_adskillelse",
    type: "GAG",
    title: "Opbevaring og adskillelse af fødevarer",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Manglende adskillelse mellem rå og færdige fødevarer kan medføre krydskontaminering. Virksomheden sikrer korrekt opbevaring og adskillelse.",
    produkter: [
      "Råvarer",
      "Færdigretter",
      "Kolde retter",
      "Varme retter"
    ],
    ingredienser: [
      "Råt kød",
      "Rå fisk og skaldyr",
      "Grøntsager",
      "Varmebehandlet kød"
    ],
    kontroller: [
      "Adskillelse af rå og færdige varer",
      "Korrekt opbevaring"
    ],
    kontrolType: "NONE",
    kilde: "0053",
    sikkerhed: "Høj"
  },

  {
    id: "gag_datomaerkning",
    type: "GAG",
    title: "Datomærkning og holdbarhed",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Manglende eller forkert datomærkning kan føre til anvendelse af fødevarer, der ikke længere er sikre. Virksomheden sikrer korrekt mærkning og overholdelse af holdbarhed.",
    produkter: [
      "Forudproduceret mad",
      "Rester",
      "Kolde retter"
    ],
    ingredienser: [],
    kontroller: [
      "Kontrol af datomærkning",
      "Overholdelse af holdbarhed"
    ],
    kontrolType: "NONE",
    kilde: "0054",
    sikkerhed: "Høj"
  },

  {
    id: "gag_genopvarmning_rester",
    type: "GAG",
    title: "Genopvarmning af rester",
    kategori: "Mikrobiologiske sundhedsfarer",
    beskrivelse: "Utilstrækkelig genopvarmning kan medføre overlevelse af sygdomsfremkaldende bakterier. Virksomheden sikrer korrekt genopvarmning.",
    produkter: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter"
    ],
    ingredienser: [],
    kontroller: [
      "Genopvarmning til korrekt temperatur"
    ],
    kontrolType: "NONE",
    kilde: "0055",
    sikkerhed: "Høj"
  }

];

export const RISK_ANALYSIS_LIBRARY = [
  ...RISK_ANALYSIS_LIBRARY_PART_1,
  ...RISK_ANALYSIS_LIBRARY_PART_2,
  ...RISK_ANALYSIS_LIBRARY_PART_3,
  ...RISK_ANALYSIS_LIBRARY_PART_4,
  ...RISK_ANALYSIS_LIBRARY_PART_5,
  ...RISK_ANALYSIS_LIBRARY_PART_6,
  ...RISK_ANALYSIS_LIBRARY_PART_7,
  ...RISK_ANALYSIS_LIBRARY_PART_8,
];