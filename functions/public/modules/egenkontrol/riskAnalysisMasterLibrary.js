// SLET FRA HER

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean);
}

export const RISK_ANALYSIS_MASTER = [
  // =========================================================
  // MIKROBIOLOGISKE FARER
  // =========================================================

  {
    key: "receiving_chilled_goods",
    pageGroup: "microbiological",
    classification: "CCP",
    title: "Ved modtagelse af kølekrævende fødevarer",
    body: `
Ved modtagelse af kølekrævende fødevarer skal det sikres, at kølekæden ikke bliver brudt.
Som udgangspunkt skal kølekrævende fødevarer opbevares ved maksimalt 5°C (med mindre lavere
temperaturer er angivet i fødevarens mærkning). Virksomheden sikrer, at temperaturkrav for
kølekrævende fødevarer bliver overholdt ved varemodtagelsen.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Varmebehandlet kød, fisk, pålæg",
      "Pasteuriserede mælkeprodukter",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød"
    ],
    controlKeys: ["goods_receiving"],
    appliesWhen: {
      processesAny: ["receiving_goods"],
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "cold_storage",
    pageGroup: "microbiological",
    classification: "CCP",
    title: "Opbevaring af kølekrævende fødevarer",
    body: `
Når fødevarer bliver opbevaret koldt, hæmmes bakteriers vækst. Det skal derfor sikres at temperaturen i alle
køleenheder højst er den temperatur, der er oplyst i fødevarens mærkning, eller som gælder i fødevarelovgivningen.
Som udgangspunkt skal kølekrævende fødevarer opbevares ved 5° C eller koldere (med mindre lavere temperaturer
er angivet i fødevarens mærkning).
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Varmebehandlet kød, fisk, pålæg",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Pasteuriserede mælkeprodukter",
      "Råt kød"
    ],
    controlKeys: ["fridge_units"],
    appliesWhen: {
      equipmentAny: ["fridges"],
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "heat_treatment",
    pageGroup: "microbiological",
    classification: "CCP",
    title: "Opvarmning / varmebehandling af fødevarer",
    body: `
Risiko for tilstedeværelse af sygdomsfremkaldende bakterier pga. utilstrækkelig opvarmning. Det er især
Listeria monocytogenes, Salmonella, Bacillus cereus og Campylobacter der kan være risiko for. Bakterierne bliver
enten dræbt eller begrænset mest muligt ved at opvarme fødevarerne til minimum 75°C. Det sikres derfor, at
fødevarerne ved opvarmning opnår en kernetemperatur på minimum 75°C. Undtagelsen er stege som fx roastbeef
og svinekam, da hele kødstykker ikke behøver at blive gennemstegt da hele kødstykker normalt kun har
mikroorganismer på overfladen af kødet. Hele kødstykker fra fjerkræ skal dog også opvarmes til minimum 75°C.
Fisk er også undtaget fra kravet idet varmebehandling (f.eks. stegning, kogning, grilning og varmrøgning) til en
kernetemperatur minimum 60 °C i et minut dræber de fleste parasitter. Ved brug af indkøbte frosne råvarer og
ingredienser sikres det at de bliver varmebehandlet tilstrækkeligt, for at minimere risikoen for Listeria
monocytogenes i slutproduktet.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Rå æg",
      "Råt kød",
      "Frosne bær"
    ],
    controlKeys: ["heat_treatment", "reheating_food"],
    appliesWhen: {
      processesAny: ["cooking", "heating", "reheating"],
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop"]
    }
  },

  {
    key: "hot_holding",
    pageGroup: "microbiological",
    classification: "CCP",
    title: "Varmholdelse",
    body: `
Der er risiko for vækst af sygdomsfremkaldende bakterier i varmebehandlede produkter efter varmebehandling.
Det sikres derfor, at fødevarer der varmholdes bliver opbevaret ved en temperatur, der sikrer at alle dele af
produktet er mindst 65° C, indtil den bliver serveret. Hvis temperaturen falder til under 65° C, sikres det at
fødevaren er serveret, genopvarmet, kasseret eller lignende, inden der er gået 3 timer.
    `.trim(),
    products: [
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Rå æg",
      "Pasteuriserede æg",
      "Råt kød",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Frosne bær",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Frosne råvarer"
    ],
    controlKeys: ["hot_holding"],
    appliesWhen: {
      processesAny: ["hot_holding"],
      businessTypesAny: ["restaurant", "pizzeria", "institution", "canteen"]
    }
  },

  {
    key: "cooling",
    pageGroup: "microbiological",
    classification: "CCP",
    title: "Nedkøling af fødevarer",
    body: `
Der er risiko for vækst af sygdomsfremkaldende bakterier hvis ikke varmebehandlede fødevarer køles effektivt.
Det kan især være sporedannende bakterier som Colstridium perfringens, Clostridium botulinum og Bacillus cereus,
da sporerne kan overleve almindelig varmebehandling på +75 °C, og derfor vil kunne være tilstede efter
varmebehandlingen. Derfor skal det sikres, at varmebehandlede produkter nedkøles fra +65 °C til under +10 °C på
maksimalt 4 timer (lovkrav). Fødevarerne opbevares herefter på køl eller frost.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Ris, pasta og tørrede bønner",
      "Mel, korn og kornprodukter",
      "Pasteuriserede mælkeprodukter",
      "Vegetabilske fedtstoffer",
      "Frosne råvarer"
    ],
    controlKeys: ["cooling_food"],
    appliesWhen: {
      processesAny: ["cooling"],
      businessTypesAny: ["restaurant", "pizzeria", "institution", "canteen"]
    }
  },

  {
    key: "receiving_general_quality",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Kontrol af varer ved modtagelse",
    body: `
Når der modtages varer er der risiko for, at varerne er forkert mærket, er af dårlig kvalitet,
har overskredet holdbarhedsdatoen eller er beskadiget. Personalet skal derfor være opmærksom på
at kontrollere de varer, der modtages.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Kolde retter",
      "Kaffe",
      "Grønt tilbehør"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Nødder og frø",
      "Brød og brødprodukter",
      "Frosne råvarer",
      "Isterninger"
    ],
    controlKeys: ["goods_receiving"],
    appliesWhen: {
      processesAny: ["receiving_goods"],
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "frozen_storage",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Opbevaring af frostvarer",
    body: `
Når frostvarer bliver opbevaret eller modtaget, sikrer virksomheden at produkterne er frosne
og overholder temperaturkrav i relevant lovgivning. Virksomheden skal derfor have fokus på
korrekt temperatur og korrekt håndtering ved både modtagelse og opbevaring.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter"
    ],
    ingredients: [
      "Frosne råvarer",
      "Frosne bær"
    ],
    controlKeys: ["freezer_units", "goods_receiving"],
    appliesWhen: {
      equipmentAny: ["freezers"],
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "date_control_opened_goods",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Datokontrol og mærkning af opbevarede fødevarer",
    body: `
Der er risiko for vækst af sygdomsfremkaldende bakterier eller mug/skimmel hvis fødevarer
opbevares for længe eller forkert. Når råvarer åbnes, er det vigtigt at sikre korrekt efterfølgende
opbevaring og mærkning med åbningsdato eller fremstillingsdato, hvor relevant.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Kolde retter",
      "Grønt tilbehør"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Nødder og frø",
      "Pasteuriserede mælkeprodukter",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær"
    ],
    controlKeys: ["date_control"],
    appliesWhen: {
      processesAny: ["date_control"],
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "sale_without_cooling_3_hours",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Salg af varmebehandlede fødevarer uden køl/varme (3 timers regel)",
    body: `
Der er risiko for vækst af sygdomsfremkaldende bakterier, hvis letfordærvelige fødevarer
opbevares uden køl eller varmholdelse for længe. Det sikres derfor, at fødevarer der opbevares
uden køl eller varmholdelse, bliver serveret, nedkølet, genopvarmet eller kasseret inden 3 timer.
    `.trim(),
    products: [
      "Varme retter",
      "Gryderetter",
      "Supper",
      "Fisk",
      "Kylling"
    ],
    ingredients: [
      "Rå æg",
      "Pasteuriserede æg",
      "Råt kød",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød",
      "Grøntsager",
      "Ris",
      "Pasta",
      "Brød",
      "Pasteuriserede mælkeprodukter",
      "Frosne råvarer"
    ],
    controlKeys: ["sale_3_hour_rule"],
    appliesWhen: {
      processesAny: ["sale_without_cooling"],
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "canteen"]
    }
  },

  {
    key: "separation_storage",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Adskillelse under opbevaring og produktion",
    body: `
Der er risiko for forurening af fødevarer hvis ikke virksomheden sikrer tilstrækkelig adskillelse
mellem forskellige varer ved opbevaring og produktion. Varer skal opbevares på en måde så de
ikke forurener hinanden og aldrig direkte på gulvet.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Kolde retter",
      "Kaffe",
      "Grønt tilbehør",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Nødder og frø",
      "Brød og brødprodukter",
      "Rå æg",
      "Råt kød",
      "Frosne bær",
      "Isterninger"
    ],
    controlKeys: ["separation"],
    appliesWhen: {
      processesAny: ["separation"],
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "cross_contamination_raw_ready",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Forebyggelse af krydsforurening mellem rå og spiseklare fødevarer",
    body: `
Fødevarer kan blive forurenet med bakterier på flere måder, fx mellem rå og færdige produkter.
Virksomheden skal derfor sikre, at råvarer og spiseklare produkter holdes adskilt, og at knive,
maskiner, skærebrætter, klude, forklæder og lignende holdes rene og udskiftes hyppigt.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Kolde retter",
      "Grønt tilbehør",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Nødder og frø",
      "Rå æg",
      "Råt kød",
      "Frosne bær"
    ],
    controlKeys: ["separation", "cleaning_temperature_control"],
    appliesWhen: {
      processesAny: ["separation", "cooking", "cold_preparation"],
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "personal_hygiene",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Personlig hygiejne",
    body: `
En god personlig hygiejne er vigtig i en virksomhed der håndterer fødevarer.
Både sygdomsfremkaldende bakterier og virus kan forurene virksomhedens produkter,
hvis personalets personlige hygiejne ikke er god nok.

Det er vigtigt at vaske hænder ved skift mellem arbejdsprocesser og at syge medarbejdere
ikke arbejder med fødevarer.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Kolde retter",
      "Kaffe",
      "Grønt tilbehør"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Nødder og frø",
      "Pasteuriserede mælkeprodukter",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær",
      "Isterninger"
    ],
    controlKeys: ["personal_hygiene_program"],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "cleaning_disinfection",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Rengøring og desinfektion af udstyr og redskaber",
    body: `
Rengøring og desinfektion af produktionsudstyr og redskaber skal mindske risikoen
for krydskontaminering mellem forskellige fødevaregrupper.

Virksomheden skal have faste procedurer for rengøring, og maskiner som fx opvaskemaskine
skal fungere korrekt.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Kolde retter",
      "Grønt tilbehør",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Nødder og frø",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær"
    ],
    controlKeys: ["cleaning_temperature_control", "dishwasher_control"],
    appliesWhen: {
      processesAny: ["cleaning_control"],
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "machine_hygiene_ice_softice_coffee",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Rengøring af maskiner som isterningemaskiner, kaffe- og specialmaskiner",
    body: `
Maskiner til fx isterninger, kaffe, softice eller lignende skal rengøres og desinficeres
med en regelmæssig frekvens, der sikrer at risikoen for vækst af skimmelsvamp og
sygdomsfremkaldende bakterier minimeres.

For at opnå bedst mulig rengøring skal leverandørens anvisninger følges.
    `.trim(),
    products: [
      "Kaffe",
      "Drikkevarer",
      "Isterninger"
    ],
    ingredients: [
      "Isterninger"
    ],
    controlKeys: ["ice_machine_control"],
    appliesWhen: {
      equipmentAny: ["iceMachines"],
      businessTypesAny: ["restaurant", "cafe", "bar", "pizzeria", "canteen"]
    }
  },

  {
    key: "fridge_freezer_overfilling",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Undgå overfyldning af køle- og fryseskabe",
    body: `
Ved opbevaring af køle- og frostkrævende fødevarer er der risiko for nedsat luftcirkulation og køle/fryseevne,
hvis køle/fryseskabet overfyldes. Dette er der opmærksomhed på.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe",
      "Pasteuriserede mælkeprodukter",
      "Frosne råvarer",
      "Rå æg",
      "Råt kød",
      "Frosne bær"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "fruit_vegetable_storage",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Opbevaring af frugt og grønt",
    body: `
Der er lovmæssigt ikke et kølekrav på uforarbejdet frugt og grønt. Disse opbevares således, at kvaliteten
bibeholdes bedst muligt. Virksomheden ved, at så snart der sker behandling (såsom udskæring) af frugt og grønt,
så skal det opbevares ved maks. 5 grader.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "thawing_frozen_goods",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Optøning af frostvarer",
    body: `
Når produkter optøs vækkes evt. tilstedeværende bakterier af dvale, og der er risiko for opformering.
Optøning skal foregå i køleskab ved maks 5 grader (for fisk gælder 2 grader) for at hæmme denne potentielle
opformering, og produktet opbevares tildækket og på en sådan måde, at det ikke drypper på andre fødevarer i køleskabet.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Frosne råvarer"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "freezing_food",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Indefrysning af fødevarer",
    body: `
Der er risiko for vækst af sygdomsfremkaldende bakterier, hvis ikke fødevarer indfryses hurtigt.
Virksomheden sikrer derfor, at fødevarer, der skal indfryses, deles i passende portioner, og at der er
tilstrækkelig frysekapacitet i fryseenheder og at disse ikke overfyldes.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
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
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "washing_produce",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Skylning af frugt og grønt",
    body: `
Der er risiko for bakterier og virus på overfladen af frugt og grønt. Derfor skyller virksomheden alle frugt
og grøntsager, også salat, spirer og krydderurter. Virksomheden har kendskab til at fødevarestyrelsen anbefaler,
at frosne bær, babymajs og sukkerærter skal have et kort opkog.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Frugt",
      "Grøntsager",
      "Kartofler",
      "Svampe"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "pasteurized_eggs_raw_dishes",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Brug af pasteuriserede æg i rå retter",
    body: `
Ved produktion af fødevarer indeholdende æg, som ikke undergår varmebehandling, bruges der pasteuriserede æg,
pga. risiko for Salmonella og Campylobacter.
    `.trim(),
    products: [
      "Kolde retter",
      "Forretter",
      "Salater"
    ],
    ingredients: [
      "Pasteuriserede æg"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen"]
    }
  },

  {
    key: "minced_meat_warning",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Oplysning om hakket kød uden fuld varmebehandling",
    body: `
Serveres der hakket kød der ikke er varmebehandlet til min. +75 °C i centrum, og hvor der ikke er anvendt en
alternativ varmebehandling der sikrer tilsvarende bakteriedrab skal kunderne tydeligt gøres opmærksomme på dette.
Det kan eksempelvis gøres ved at skrive på menukortet at der anvendes en lempeligere varmebehandling med større
risiko for, at det serverede kød indeholder sygdomsfremkaldende bakterier.
    `.trim(),
    products: [
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
    ingredients: [
      "Råt kød"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen"]
    }
  },

  {
    key: "frozen_berries_norovirus",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Varmebehandling af frosne hindbær",
    body: `
Frosne hindbær kan indeholde Norovirus og andre sygdomsfremkaldende mikroorganismer. Derfor er virksomheden
opmærksom på at frosne hindbær indgår i retter, der bliver varmebehandlet tilstrækkeligt.
    `.trim(),
    products: [
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Frosne bær"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "bakery"]
    }
  },

  {
    key: "expiry_date_control",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Kontrol af holdbarhedsdato",
    body: `
Fødevarer må ikke være sundhedsskadelige eller uegnede til at spise, når virksomheden sælger eller anvender dem.
De fleste fødevarer er mærket med en dato for mindst holdbar til, som kan hjælpe virksomheden til at vurdere,
hvor længe fødevarerne er holdbare. Færdigpakkede fødevarer må som udgangspunkt ikke sælges hvis holdbarhedsdatoen
er overskredet.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Kaffe",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
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
    controlKeys: ["date_control"],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "mold_mildew_control",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Kontrol for mug og skimmel",
    body: `
Fødevarer med mugpletter er uønskede, da der kan være svampegifte og/eller svampemycelium i fødevaren,
undtaget er fødevarer, såsom blåskimmelost. Fødevarer med mug og skimmel bør derfor smides ud.
Virksomheden sikrer, at fødevarerne opbevares korrekt, da dette nedsætter risikoen for vækst mug og skimmel.
For eksempel skal tørvarer ikke opbevares fugtigt.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Kaffe",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
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
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "vibrio_fish_shellfish",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Vibrio i fisk og skaldyr",
    body: `
Vibrio findes i fisk, skaldyr og bløddyr (f.eks. muslinger) og kan give diarré, mavesmerter og opkast,
hvis fiskene / skaldyrene, ikke har været under tilstrækkelig varmebehandling. Virksomheden sikrer,
at fisk og skaldyr opvarmes tilstrækkelig inden servering.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Rå fisk og skaldyr"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop"]
    }
  },

  {
    key: "pickling_ph_control",
    pageGroup: "microbiological",
    classification: "GAG",
    title: "Syltning og pH-kontrol",
    body: `
Når der syltes er det vigtigt at følge en opskrift, for at sikre den rette sænkning af pH / vandaktivitet,
som gør at produktet opnår den rette konserverende effekt.
    `.trim(),
    products: [
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Frugt",
      "Grøntsager"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "institution", "canteen"]
    }
  },

  // =========================================================
  // KEMISKE FARER
  // =========================================================

  {
    key: "fish_receiving_histamine",
    pageGroup: "chemical",
    classification: "CCP",
    title: "Modtagelse og opbevaring af rå fersk fisk",
    body: `
Ved modtagelse og opbevaring af rå fersk fisk, skal det sikres, at fisken er 2 °C eller koldere, da for høje
temperaturer kan resultere i, at der bliver dannet store mængder histamin i fisken. Histamin kan give alvorlige
forgiftninger. Temperaturen kan også sikres ved at opbevare fisken på is.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Rå fisk og skaldyr"
    ],
    controlKeys: ["goods_receiving"],
    appliesWhen: {
      businessTypesAny: ["fish_shop", "restaurant", "cafe"],
      processesAny: ["receiving_goods"]
    }
  },

  {
    key: "allergens_information",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Oplysning om allergener og forebyggelse af allergenkontaminering",
    body: `
Der er risiko for både tilsigtet og utilsigtet indhold af allergene ingredienser i virksomhedens fødevarer.
Virksomheden sikrer derfor, at der kan gives korrekt oplysning om indhold af allergener, og at
krydskontaminering med allergener minimeres ved tilstrækkelig adskillelse, rengøring og korrekt håndtering.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Varme retter",
      "Kolde retter",
      "Salater",
      "Grønt tilbehør"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød",
      "Frugt",
      "Grøntsager",
      "Nødder og frø",
      "Brød og brødprodukter",
      "Pasteuriserede mælkeprodukter",
      "Rå æg",
      "Råt kød"
    ],
    controlKeys: ["allergen_control"],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "bakery", "fish_shop"]
    }
  },

  {
    key: "pah_formation_grilling",
    pageGroup: "chemical",
    classification: "GAG",
    title: "PAH ved stegning, grillning eller røgning",
    body: `
Ved stegning, grillning eller røgning af fisk og kød kan der dannes kræftfremkaldende stoffer (PAH).
Dannelsen af PAH kan minimeres ved at undgå at branke kødet og undgå for meget os, fx ved at fedt drypper ned på grillkullene.
PAH i røgede produkter kan styres ved at vælge egnet brændsel, at tilpasse indholdet af fedt i fødevaren,
at optimere afstanden mellem brændsel og fødevare samt ved hyppig rengøring af røgkammeret.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
      "Råt kød"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop"]
    }
  },

  {
    key: "acrylamide_formation",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Akrylamid ved stegning/ristning",
    body: `
Der er risiko for dannelse af akrylamid ved stegning/ristning af kulhydratholdige produkter, for eksempel kartofler,
ristet brød, bagt brød, kiks og knækbrød. Virksomheden kan minimere dannelsen af akrylamid ved at stege/riste ved
lavere temperatur og stege til gylden i stedet for mørk farve. Fødevarestyrelsen anbefaler, at temperaturen ved
fritering af pommes frites er under 175°C.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Kartofler",
      "Mel, korn og kornprodukter",
      "Brød og brødprodukter",
      "Frosne råvarer"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "bakery"]
    }
  },

  {
    key: "escolar_oily_fish",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Escolar og oliefisk/smørmakrel",
    body: `
Fiskene Escolar (Lepidocybium flavobrunneum) og oliefisk/smørmakrel (Ruvettus pretiosus) har et naturligt indhold af voksarter.
Disse fisk kan give diarré, hvis de ikke tilberedes korrekt. Det skyldes voksarterne (voksestre/ufordøjeligt fedt),
og effekten kan sammenlignes med virkningen af amerikansk olie. Hvis virksomheden tilbereder escolar og oliefisk/smørmakrel,
sikrer virksomheden, at fisken steger eller koger omhyggeligt, så olieindholdet og dermed voksarterne smelter ud af fisken.
Af samme grund sikrer virksomheden, at kogevand og stegefedt ikke anvendes til sovs eller anden madlavning.
Virksomheden ved, at disse fiskearter ikke må bruges til f.eks. sushi og andre serveringer med rå fisk.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Rå fisk og skaldyr"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "fish_shop"]
    }
  },

  {
    key: "mycotoxins_nuts_dried_fruit",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Mykotoksiner i nødder og tørrede frugter",
    body: `
Der er risiko for indhold af mykotoksiner i blandt andet nødder, frø og tørrede frugter fra tropiske og subtropiske egne
på grund af skimmelvækst under produktion. Mykotoksiner er giftige ved længere tids påvirkning. Virksomheden kan ikke
umiddelbart gøre noget for at minimere indholdet, men kan sikre, at der kun modtages varer fra registrerede leverandører,
der er underlagt myndighedskontrol. Nødder, frø og tørrede frugter produceret i f.eks. Danmark indeholder ikke mykotoksiner.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Nødder og frø"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "bakery"]
    }
  },

  {
    key: "bitter_almonds_cyanide",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Bitre mandler og cyanid",
    body: `
Bitre mandler indeholder store mængder cyanid, som er giftigt. Bitre mandler kan dog anvendes i meget begrænset omfang.
Abrikoskerner og solsikkefrø indeholder mindre mængder cyanid og kan derfor indtages i mindre mængder, men ikke ubegrænset.
Solsikkefrø og hørfrø indeholder desuden tungmetallet cadmium, der lagres i kroppen og kan på længere sigt skade især nyrerne.
Man skal derfor ikke indtage frøene i for store mængder.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Nødder og frø"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "bakery"]
    }
  },

  {
    key: "solanine_green_potatoes",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Solanin i grønne kartofler",
    body: `
Der er risiko for forøget indhold af solanin i grønne kartofler. Virksomheden sikrer derfor, at evt. spirede og grønne
kartofler smides ud. Grønne pletter på mindre end en 2-krone kan virksomheden dog nøjes med at skære væk. Har kartoflen
større pletter, sikrer virksomheden at kartoflen smides ud. Virksomheden har kendskab til, at de rå kartofler kan opbevares
mørkt for at undgå udvikling af grønne pletter.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Kartofler"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen"]
    }
  },

  {
    key: "phenylhydrazine_mushrooms",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Phenylhydrazin i champignon",
    body: `
Phenylhydrazin findes i champignon. Phenylhydraziner kan være kræftfremkaldende. Virksomheden har kendskab til,
at Fødevarestyrelsen anbefaler at koge/stege champignon, da tilberedning nedbringer indholdet af phenylhydrazin.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Svampe"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen"]
    }
  },

  {
    key: "cucurbitacins_squash",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Cucurbitaciner i squash/courgette/zucchini",
    body: `
Squash/courgette/zucchini har normalt en neutral smag, men cucurbitacinerne fra squash er nogle af de mest
bittertsmagende stoffer, der kendes. Man vil derfor kunne smage, hvis de findes i grøntsagen. Selv små mængder
af disse bittertsmagende stoffer kan give sygdom inden for få timer - uanset om squashen er rå eller tilberedt.
Der smages på squashen og den smides ud, hvis den smager bittert.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion"
    ],
    ingredients: [
      "Grøntsager"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen"]
    }
  },

  {
    key: "lectins_beans_elderberries",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Lektiner i tørrede bønner og hyldebær",
    body: `
Der er risiko for forgiftning med lektiner hvis ikke tørrede bønner og hyldebær behandles korrekt.
Tørrede bønner skal udblødes og koges i rigeligt rent vand, så bønnerne er helt dækkede. For at sikre at
bønnerne koges i tilstrækkelig tid følges producentens anvisning. Hyldebær skal koges i minimum 15 min.
Bemærk at grønne bønner (haricot verts) også indeholder lektiner og derfor skal blancheres.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion"
    ],
    ingredients: [
      "Frugt",
      "Ris, pasta og tørrede bønner"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen"]
    }
  },

  {
    key: "poisonous_mushrooms",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Giftige svampe",
    body: `
Svampegifte kan findes i giftige svampe og planter. Der er risiko for at tilberede giftige svampe, hvis man ikke kender
forskel. Derfor anvendes der kun svampe man helt sikkert kender, og kun de anerkendte spisesvampe.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter"
    ],
    ingredients: [
      "Svampe"
    ],
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen"]
    }
  },

  {
    key: "equipment_materials_chemical",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Stoffer fra redskaber og produktionsudstyr",
    body: `
Stoffer fra redskaber og produktionsudstyr kan overføres til virksomhedens fødevarer. Fødevarerne
sikres mod afsmitning fra redskaber og udstyr ved kun at anvende egnet udstyr og redskaber til de forskellige fødevarer.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
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
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "additives_usage",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Tilsætningsstoffer",
    body: `
Tilsætningsstoffer skal anvendes korrekt. Ved anvendelse af tilsætningsstoffer, sikres det at de
anvendte tilsætningsstoffer må anvendes i den pågældende fødevare. Virksomheden sikrer også at doseringen er korrekt.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
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
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "bakery"]
    }
  },

  {
    key: "cleaning_chemicals",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Opbevaring og brug af rengørings- og desinfektionsmidler",
    body: `
Stoffer fra virksomhedens rengørings- og desinfektionsmidler kan overføres til fødevarer.
Der anvendes derfor kun rengørings- og desinfektionsmidler, der er beregnet til brug i fødevarevirksomheder,
og de opbevares korrekt i originale emballager adskilt fra fødevarer.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Kaffe",
      "Grønt tilbehør",
      "Forudproduktion",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
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
    controlKeys: ["cleaning_temperature_control"],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "food_contact_materials",
    pageGroup: "chemical",
    classification: "GAG",
    title: "Brug af egnede fødevarekontaktmaterialer",
    body: `
Når fødevarer kommer i kontakt med emballage, plastfilm, redskaber og produktionsudstyr,
er der risiko for at kemikalier overføres til fødevaren. Dette minimeres ved kun at benytte
fødevarekontaktmaterialer, der er beregnet til formålet.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Varme retter",
      "Kolde retter",
      "Kaffe",
      "Grønt tilbehør"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød",
      "Frugt",
      "Grøntsager",
      "Nødder og frø",
      "Pasteuriserede mælkeprodukter",
      "Frosne råvarer",
      "Råt kød",
      "Isterninger"
    ],
    controlKeys: ["food_contact_materials"],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  // =========================================================
  // FYSISKE FARER
  // =========================================================

  {
    key: "broken_packaging_foreign_objects",
    pageGroup: "physical",
    classification: "GAG",
    title: "Kontrol af emballage og varer for fremmedlegemer",
    body: `
Der er risiko for, at materiale (metal, hård plastik, træ, glas mv.) fra ødelagt emballage kan ende i det færdige produkt,
og det kan være farligt for kunderne. Derfor sikres det, at emballagen på de varer, virksomheden modtager eller anvender,
ikke er gået i stykker.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Kaffe",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
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
    controlKeys: ["goods_receiving"],
    appliesWhen: {
      processesAny: ["receiving_goods"],
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "equipment_maintenance_physical",
    pageGroup: "physical",
    classification: "GAG",
    title: "Vedligeholdelse af inventar og udstyr",
    body: `
Der er risiko for, at materiale fra ødelagt udstyr eller inventar kan ende i den færdige fødevare, og det kan være farligt
for kunderne. Derfor sikres det, at virksomheden er hensigtsmæssigt indrettet, og at inventar og udstyr bliver kontrolleret
og vedligeholdt løbende.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Kaffe",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
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
    controlKeys: ["verification_maintenance"],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "storage_separation_physical",
    pageGroup: "physical",
    classification: "GAG",
    title: "Opbevaring og adskillelse for at undgå fremmedlegemer",
    body: `
Der er risiko for forurening med fremmedlegemer (metal, sten, glas, træ, hård plastik mv.) hvis ikke virksomheden
sikrer korrekt opbevaring, håndtering og adskillelse mellem forskellige varer ved opbevaring på lager, i køleenheder mv.
Alle varer skal således opbevares på en måde, så de ikke forurener hinanden og aldrig direkte på gulvet.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Kaffe",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
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
    controlKeys: [],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  },

  {
    key: "pest_control_physical",
    pageGroup: "physical",
    classification: "GAG",
    title: "Sikring mod skadedyr",
    body: `
Der er risiko for sygdomsoverførsel, hvis skadedyr (såsom gnavere og insekter) kommer i kontakt med fødevarer.
Derfor er der opmærksomhed på, at alle lokaler er sikret mod indtrængning, og der tjekkes løbende for tegn på skadedyr.
    `.trim(),
    products: [
      "Forudproduceret mad",
      "Rester",
      "Varme retter",
      "Gryderetter",
      "Forårsruller",
      "Nudler",
      "Risretter",
      "Supper",
      "Fisk",
      "Kylling",
      "Okse- og svinekød",
      "Kolde retter",
      "Forretter",
      "Salater",
      "Kaffe",
      "Varme retter",
      "Suppe",
      "Gryderetter",
      "Grønt tilbehør",
      "Forudproduktion",
      "Grøntsager",
      "Urter"
    ],
    ingredients: [
      "Pasteuriserede æg",
      "Rå fisk og skaldyr",
      "Varmebehandlet kød, fisk, pålæg",
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
    controlKeys: ["verification_maintenance"],
    appliesWhen: {
      businessTypesAny: ["restaurant", "cafe", "pizzeria", "institution", "canteen", "fish_shop", "bakery"]
    }
  }
];

export function getRiskBlockByKey(key) {
  return RISK_ANALYSIS_MASTER.find((item) => item.key === key) || null;
}

export function getRiskBlocksByPageGroup(pageGroup) {
  return RISK_ANALYSIS_MASTER.filter((item) => item.pageGroup === pageGroup);
}

export function listAllRiskKeys() {
  return RISK_ANALYSIS_MASTER.map((item) => item.key);
}

export function uniqueStrings(values) {
  return [...new Set(normalizeList(values))];
}

// TIL HER
