export const MODULE_SHOWCASE_ORDER = [
  "egenkontrol",
  "pos",
  "koerselskontrol",
  "lagerkontrol",
  "bogforing",
  "menu",
  "recipes",
  "seo",
  "podcast",
  "privacyScanner",
  "complianceRepair",
  "kalkulation",
  "crm",
  "ops-center"
];

export const MODULE_SHOWCASES = {
  seo: {
    key: "seo",
    appKey: "seo",
    activeKeys: ["seo"],
    name: "SEO Automatik",
    badge: "Vækst",
    category: "Vækst",
    image: "",
    imageAlt: "SEO-analyse med søgeord, ranking og landingssider",
    landingPage: "/modules/seo/index.html",
    entryUrl: "/modules/seo/generator.html",
    checkoutModuleKey: "seo",
    priceLabel: "49 kr./md. ekskl. moms",
    teaser: "Landingpages, lokal SEO og site-builder, der hjælper flere kunder med at finde virksomheden.",
    headline: "Bliv mere synlig lokalt uden at drukne i teknisk SEO.",
    subheading: "SEO Automatik samler lokal synlighed, landingssider og indhold i et workflow, der passer til travle virksomheder.",
    intro: "Madkontrollen SEO Automatik er bygget til lokale virksomheder, der gerne vil findes oftere på Google, men ikke har tid til at opbygge landingssider, tekster og lokal synlighed fra bunden hver uge. Modulet hjælper med at strukturere services, byer, tekster og landingssider, så markedsføringen bliver mere systematisk og mindre tilfældig.",
    value: "Du får et praktisk værktøj til at skabe sider, holde styr på kunder og arbejde med lokal SEO uden at skulle samle data i flere systemer.",
    features: ["Landingssider for service og by", "Lokal SEO og Google-fokus", "Site-builder med genbrug af virksomhedsdata", "Rapporter og overblik"],
    audience: ["Restauranter", "Caféer", "Catering", "Lokale servicevirksomheder", "Vækstvirksomheder"],
    integrations: ["menu", "opskrifter", "crm"],
    integrationText: "SEO kan bruge retter, menuer og kundedata til mere relevante landingssider."
  },
  podcast: {
    key: "podcast",
    appKey: "podcast",
    activeKeys: ["podcast"],
    name: "Podcast",
    badge: "Vækst",
    category: "Vækst",
    image: "",
    imageAlt: "Podcast, lydindhold og markedsføring",
    landingPage: "/quick-onboarding.html?module=podcast&selectedModules=podcast",
    entryUrl: "/quick-onboarding.html?module=podcast&selectedModules=podcast",
    checkoutModuleKey: "podcast",
    priceLabel: "efter abonnement",
    teaser: "AI-genereret lydindhold og markedsføring til virksomheden.",
    headline: "Gør historier og indhold til lyd.",
    subheading: "Podcast hjælper med at skabe lydindhold, som kan bruges i markedsføring.",
    intro: "Podcast-modulet er tænkt til virksomheder, der vil bruge lyd og fortællinger i deres markedsføring uden tung produktion.",
    value: "Du får en mere levende kanal til nyheder, fortællinger og synlighed.",
    features: ["AI-genereret lydindhold", "Markedsføring", "Kampagneindhold", "Publiceringsklar struktur"],
    audience: ["Restaurant", "Café", "Butik", "Lokale virksomheder"],
    integrations: ["seo"],
    integrationText: "Podcast kan bruges sammen med SEO og indholdssider."
  },
  privacyScanner: {
    key: "privacyScanner",
    appKey: "privacyScanner",
    activeKeys: ["privacyScanner", "privacyscanner", "privacy-scanner"],
    name: "Privacy Scanner",
    badge: "Compliance",
    category: "Compliance",
    image: "",
    imageAlt: "Privatlivsscanning af cookies og tracking",
    landingPage: "/quick-onboarding.html?module=privacyScanner&selectedModules=privacyScanner",
    entryUrl: "/quick-onboarding.html?module=privacyScanner&selectedModules=privacyScanner",
    checkoutModuleKey: "privacyScanner",
    priceLabel: "efter abonnement",
    teaser: "Scanner hjemmeside for cookies, tracking og privatlivsproblemer.",
    headline: "Find privacy-problemer før de bliver dyre.",
    subheading: "Privacy Scanner giver overblik over cookies, tracking og privatlivsrisici på hjemmesiden.",
    intro: "Privacy Scanner er til virksomheder, der vil have hurtig indsigt i cookies, tracking og synlige privatlivsproblemer.",
    value: "Modulet hjælper med at prioritere rettelser og dokumentation.",
    features: ["Cookie-scan", "Tracking-overblik", "Privatlivsrisici", "Rapport til opfølgning"],
    audience: ["Administration", "Marketing", "Webansvarlige"],
    integrations: ["seo", "complianceRepair"],
    integrationText: "Privacy Scanner kan danne grundlag for compliance-reparation."
  },
  complianceRepair: {
    key: "complianceRepair",
    appKey: "complianceRepair",
    activeKeys: ["complianceRepair", "compliancerepair", "compliance-repair"],
    name: "Compliance Repair",
    badge: "Compliance",
    category: "Compliance",
    image: "",
    imageAlt: "Reparation og dokumentation af compliance-fejl",
    landingPage: "/quick-onboarding.html?module=complianceRepair&selectedModules=complianceRepair",
    entryUrl: "/quick-onboarding.html?module=complianceRepair&selectedModules=complianceRepair",
    checkoutModuleKey: "complianceRepair",
    priceLabel: "efter abonnement",
    teaser: "Reparation og dokumentation af compliance-fejl.",
    headline: "Få styr på fejl, dokumentation og opfølgning.",
    subheading: "Compliance Repair samler rettelser og dokumentation, når noget skal bringes i orden.",
    intro: "Compliance Repair er til virksomheder, der har brug for en struktureret vej fra fundne fejl til dokumenteret rettelse.",
    value: "Du får bedre overblik over hvad der er rettet, hvornår og hvorfor.",
    features: ["Rettelsesplan", "Dokumentation", "Statusoverblik", "Opfølgningslog"],
    audience: ["Administration", "Compliance", "Webansvarlige"],
    integrations: ["privacyScanner", "seo"],
    integrationText: "Compliance Repair kan bruge fund fra Privacy Scanner og SEO."
  },
  pos: {
    key: "pos",
    appKey: "pos",
    activeKeys: ["pos"],
    name: "POS",
    badge: "Drift",
    category: "Drift",
    image: "/assets/modules/pos-hero.png",
    imageAlt: "Tablet-kasse med betaling, kvittering og salg",
    landingPage: "/modules/pos/presentation.html",
    entryUrl: "https://madkontrollen-pos.web.app/pos/index.html",
    checkoutModuleKey: "pos",
    priceLabel: "49 kr./md. ekskl. moms",
    teaser: "Kasse, salg, boner, moms og dagsrapporter til en moderne hverdag.",
    headline: "Et enkelt kassesystem til salg, boner og dagens rapport.",
    subheading: "POS samler produktsalg, betalingsreference, moms, kasseafstemning og revisorrapport i ét modul.",
    intro: "Madkontrollen POS er lavet til virksomheder, der vil have en enkel og cloudbaseret kasse uden at gøre bogholderiet tungere. Salg får bonnummer, momsberegning og betalingsoplysninger, så dagens drift og rapportering hænger bedre sammen.",
    value: "Modulet gør det lettere at betjene kunder, dokumentere salg og afstemme dagens omsætning, uanset om betalingen sker kontant, via MobilePay, Zettle/PayPal Reader eller anden betalingsvej.",
    features: ["Produkter og hurtig kasse", "Boner, kreditnota og dagsrapport", "Moms og betalingsafstemning", "Kasseafstemning til revisor"],
    audience: ["Restaurant", "Café", "Foodtruck", "Takeaway", "Butik"],
    integrations: ["lagerkontrol", "menu", "bogforing"],
    integrationText: "POS kan kobles til lager, menu og bogføring, så salg kan blive en del af den øvrige drift."
  },
  lagerkontrol: {
    key: "lagerkontrol",
    appKey: "lagerkontrol",
    activeKeys: ["lagerkontrol"],
    name: "Lagerkontrol",
    badge: "Drift",
    category: "Drift",
    image: "/assets/modules/lagerkontrol-hero.png",
    imageAlt: "Lagerhylder, varemodtagelse og scanner",
    landingPage: "/modules/lagerkontrol/presentation.html",
    entryUrl: "/modules/lagerkontrol/index.html",
    checkoutModuleKey: "lagerkontrol",
    priceLabel: "49 kr./md. ekskl. moms",
    teaser: "Varelager, optælling, varemodtagelse og svind med bedre overblik.",
    headline: "Få styr på varer, beholdning og varemodtagelse.",
    subheading: "Lagerkontrol giver overblik over råvarer, lagerbevægelser og optællinger, så indkøb og drift bliver mere præcise.",
    intro: "Lagerkontrol er til virksomheder, hvor råvarer, emballage og indkøb hurtigt kan blive uoverskuelige. Modulet samler varer, beholdning, optælling og varemodtagelse, så du kan reagere på svind, mangler og ændringer i tide.",
    value: "Når lageret er digitalt, bliver det lettere at se hvad der mangler, hvad der bruges, og hvor driften kan strammes op.",
    features: ["Varelager og beholdning", "Optælling og lagerstatus", "Varemodtagelse", "Svind og lagerbevægelser"],
    audience: ["Restaurant", "Café", "Catering", "Produktionskøkken", "Butik"],
    integrations: ["pos", "menu", "opskrifter", "kalkulation"],
    integrationText: "Lagerkontrol giver ekstra værdi sammen med POS, opskrifter og kalkulation."
  },
  egenkontrol: {
    key: "egenkontrol",
    appKey: "egenkontrol",
    activeKeys: ["egenkontrol"],
    name: "Egenkontrol",
    badge: "Compliance",
    category: "Compliance",
    image: "",
    imageAlt: "Køkkenkontrol med temperatur, checkliste og dokumentation",
    landingPage: "/",
    entryUrl: "/modules/egenkontrol/rutiner.html",
    checkoutModuleKey: "egenkontrol",
    priceLabel: "Inkluderet / efter abonnement",
    teaser: "Rutiner, temperaturer, kontrolpunkter og rapporter til fødevarekontrol.",
    headline: "Digital egenkontrol, der er nem at bruge i hverdagen.",
    subheading: "Hold styr på rutiner, temperaturer, afvigelser og dokumentation uden papirmapper.",
    intro: "Egenkontrolmodulet hjælper fødevarevirksomheder med at gøre dokumentation til en naturlig del af hverdagen. Personalet kan udføre rutiner, registrere temperaturer og håndtere afvigelser, mens ledelsen får bedre overblik.",
    value: "Modulet sparer tid, reducerer manglende registreringer og gør det nemmere at finde dokumentation ved kontrolbesøg.",
    features: ["Daglige rutiner", "Temperaturregistrering", "Afvigelser og opfølgning", "Myndighedsrapport"],
    audience: ["Restaurant", "Café", "Foodtruck", "Catering", "Institutionskøkken"],
    integrations: ["lagerkontrol", "pos"],
    integrationText: "Egenkontrol kan kobles til lager og drift, så dokumentation og daglige processer hænger sammen."
  },
  menu: {
    key: "menu",
    appKey: "menu",
    activeKeys: ["menu"],
    name: "Menu & Retter",
    badge: "Mad",
    category: "Mad",
    image: "",
    imageAlt: "Menukort med retter, kategorier og restaurantmenu",
    landingPage: "/modules/menu/index.html",
    entryUrl: "/modules/menu/menu.html",
    checkoutModuleKey: "menu",
    priceLabel: "efter abonnement",
    teaser: "Byg menukort, retter og beskrivelser, som kan bruges på tværs af platformen.",
    headline: "Saml retter og menukort ét sted.",
    subheading: "Menu & Retter gør det lettere at vedligeholde retter, beskrivelser og menukort uden dobbeltarbejde.",
    intro: "Menu & Retter er modulet til virksomheder, der vil have bedre struktur på retter, kategorier og menukort. Når menuen ligger digitalt, kan den bruges i POS, SEO og fremtidige bestillingsflows.",
    value: "Du undgår at vedligeholde de samme retter flere steder og får et stærkere grundlag for både salg og synlighed.",
    features: ["Retter og kategorier", "Menukort", "Tekster til kunder", "Klar til SEO og POS"],
    audience: ["Restaurant", "Café", "Takeaway", "Foodtruck", "Catering"],
    integrations: ["seo", "pos", "opskrifter", "lagerkontrol"],
    integrationText: "Menu kan bruges i SEO-landingssider, POS-salg og opskriftsflow."
  },
  recipes: {
    key: "recipes",
    appKey: "recipes",
    activeKeys: ["recipes", "opskrifter"],
    name: "Opskrifter",
    badge: "Køkken",
    category: "Mad",
    image: "",
    imageAlt: "Opskrift med ingredienser og køkkenproduktion",
    landingPage: "/modules/menu/recipes.html",
    entryUrl: "/modules/menu/recipes.html",
    checkoutModuleKey: "menu",
    priceLabel: "efter abonnement",
    teaser: "Opskrifter, ingredienser og køkkendata, som gør produktionen mere ensartet.",
    headline: "Gør opskrifter til et aktivt værktøj i køkkenet.",
    subheading: "Saml ingredienser, fremgangsmåder og retter, så køkkenet arbejder mere ensartet.",
    intro: "Opskrifter hjælper køkkenet med at fastholde kvalitet, struktur og gentagelighed. I stedet for løse noter kan opskrifterne kobles til retter, kostpriser og fremtidige lagerflows.",
    value: "Det gør oplæring nemmere, reducerer fejl og giver bedre grundlag for kalkulation og menuplanlægning.",
    features: ["Opskriftsstruktur", "Ingredienslister", "Køkkenforberedelse", "Kobling til retter"],
    audience: ["Restaurant", "Café", "Catering", "Produktionskøkken"],
    integrations: ["menu", "kalkulation", "lagerkontrol", "seo"],
    integrationText: "Opskrifter arbejder naturligt sammen med menu, lager og kalkulation."
  },
  kalkulation: {
    key: "kalkulation",
    appKey: "calculation",
    activeKeys: ["calculation", "kalkulation"],
    name: "Kalkulation",
    badge: "Økonomi",
    category: "Økonomi",
    image: "",
    imageAlt: "Kostpris, dækningsbidrag og graf over menuøkonomi",
    landingPage: "/modules/kalkulation/index.html",
    entryUrl: "/modules/kalkulation/index.html",
    checkoutModuleKey: "",
    priceLabel: "Tilføjes efter aftale",
    teaser: "Kostpriser, dækningsbidrag og bedre beslutninger om retter og menuer.",
    headline: "Kend kostprisen før retten rammer menukortet.",
    subheading: "Kalkulation giver overblik over råvarepris, margin og økonomi i dine retter.",
    intro: "Kalkulation er til virksomheder, der vil kende økonomien bag retter og menuer. Når ingredienser, mængder og priser bliver samlet, er det lettere at se hvilke retter der tjener penge, og hvor prisen skal justeres.",
    value: "Modulet giver et mere faktabaseret grundlag for prisændringer, menuudvikling og indkøb.",
    features: ["Kostpris pr. portion", "Dækningsbidrag", "Ingredienspriser", "Rapporter og snapshots"],
    audience: ["Restaurant", "Café", "Catering", "Køkkenchef", "Administration"],
    integrations: ["opskrifter", "menu", "lagerkontrol"],
    integrationText: "Kalkulation bliver stærkest sammen med opskrifter, menu og lagerdata."
  },
  crm: {
    key: "crm",
    appKey: "crm",
    activeKeys: ["crm"],
    name: "CRM",
    badge: "Vækst",
    category: "Vækst",
    image: "",
    imageAlt: "Kunder, leads og pipeline-overblik",
    landingPage: "/modules/crm/prospects.html",
    entryUrl: "/modules/crm/prospects.html",
    checkoutModuleKey: "",
    priceLabel: "Tilføjes efter aftale",
    teaser: "Prospects, kundedata, CVR-berigelse og bedre salgsarbejde.",
    headline: "Få styr på prospects og kundedata.",
    subheading: "CRM samler leads, CVR-data og kundeoverblik, så salgsarbejdet bliver mere struktureret.",
    intro: "CRM-modulet er til virksomheder, der arbejder aktivt med kunder, leads og opfølgning. Det hjælper med at samle prospects, berige data og skabe bedre overblik over hvem der skal kontaktes.",
    value: "Når CRM kobles med SEO og onboarding, bliver det nemmere at gå fra synlighed til konkret kundeemne.",
    features: ["Prospect-lister", "CVR-berigelse", "Kundesegmenter", "Opfølgningsgrundlag"],
    audience: ["Salg", "Administration", "Konsulenter", "Vækstvirksomheder"],
    integrations: ["seo", "egenkontrol"],
    integrationText: "CRM kan bruge SEO og virksomhedsdata til bedre segmentering og opfølgning."
  },
  bogforing: {
    key: "bogforing",
    appKey: "accounting",
    activeKeys: ["bogfoering", "bogforing", "bogføring", "accounting"],
    name: "Bogføringsappen",
    badge: "Økonomi",
    category: "Økonomi",
    image: "/assets/modules/bogforing-hero.png",
    imageAlt: "Bilag, faktura, moms og bankafstemning",
    landingPage: "/modules/accounting/presentation.html",
    entryUrl: "/modules/bogfoering/index.html",
    checkoutModuleKey: "bogfoering",
    priceLabel: "49 kr./md. ekskl. moms",
    teaser: "Bilag, banktransaktioner og bogføringsforslag til bedre økonomisk overblik.",
    headline: "Gør bilag og bogføring lettere at få styr på.",
    subheading: "Bogføring samler bilag, bank og forslag, så økonomiarbejdet bliver mere overskueligt.",
    intro: "Bogføring er til virksomheder, der vil have bedre styr på bilag og betalinger uden at miste overblikket. Modulet forbereder materialet, så bogholder eller revisor får et bedre grundlag.",
    value: "Når salg, bilag og bankdata kan hænge sammen, bliver afstemning og opfølgning mere rolig.",
    features: ["Bilag og dokumenter", "Banktransaktioner", "Bogføringsforslag", "Afstemning"],
    audience: ["Restaurant", "Café", "Butik", "Bogholder", "Administration"],
    integrations: ["pos", "lagerkontrol", "koerselskontrol"],
    integrationText: "Bogføring kan kobles til POS-salg, varekøb og kørselsrapporter."
  },
  koerselskontrol: {
    key: "koerselskontrol",
    appKey: "koerselskontrol",
    activeKeys: ["koerselskontrol", "koerekontrol", "kørekontrol", "kørselskontrol", "driving", "drivingControl", "koerebog"],
    name: "Kørselskontrol",
    badge: "Rapport",
    category: "Økonomi",
    image: "",
    imageAlt: "Kørebog med ture, kilometer og rapporter",
    landingPage: "/modules/koerselskontrol/index.html",
    entryUrl: "/modules/koerselskontrol/index.html",
    checkoutModuleKey: "koerselskontrol",
    priceLabel: "49 kr./md. ekskl. moms",
    teaser: "GPS-kørebog, kilometertæller og rapporter til kørsel og godtgørelse.",
    headline: "Dokumentér kørsel uden at miste overblikket.",
    subheading: "Kørselskontrol hjælper med ture, kilometer og rapporter, så kørselsdokumentation bliver lettere.",
    intro: "Kørselskontrol er til virksomheder, der skal dokumentere ture, kilometer og godtgørelse. Modulet er tænkt som en enkel vej fra registrering til rapport.",
    value: "Det gør kørselsrapportering mere ensartet og giver bedre dokumentation til administration og bogføring.",
    features: ["Ture og kilometer", "Kilometertæller", "Rapporter", "Godtgørelsesoverblik"],
    audience: ["Catering", "Servicevirksomheder", "Konsulenter", "Administration"],
    integrations: ["bogforing"],
    integrationText: "Kørselskontrol kan kobles til bogføring, så kørsel indgår i økonomiflowet."
  },
  "ops-center": {
    key: "ops-center",
    appKey: "ops-center",
    activeKeys: ["ops-center"],
    name: "Ops Center",
    badge: "Drift",
    category: "Drift",
    image: "",
    imageAlt: "Platform health, statuskort og overvågning",
    landingPage: "/admin/ops.html",
    entryUrl: "/admin/ops.html",
    checkoutModuleKey: "",
    priceLabel: "Tilføjes efter aftale",
    teaser: "Operationelt overblik, status og platformshændelser for avanceret drift.",
    headline: "Hold overblik over platformens drift.",
    subheading: "Ops Center er til administration, overvågning og operationelt overblik på tværs af systemet.",
    intro: "Ops Center er et administrativt modul til teams, der har brug for at følge status, hændelser og operationer på tværs af platformen. Det er ikke et dagligt køkkenmodul, men et styringsværktøj for drift og support.",
    value: "Modulet gør det lettere at se hvad der sker, reagere på hændelser og holde tekniske arbejdsgange samlet.",
    features: ["Driftsoverblik", "Status og hændelser", "Operationelle genveje", "Supportgrundlag"],
    audience: ["Administration", "Support", "Platformsejere", "Driftsansvarlige"],
    integrations: ["seo"],
    integrationText: "Ops Center kan bruges sammen med SEO og platformdrift, hvor status og publicering skal overvåges."
  }
};

export function getModuleShowcases() {
  return MODULE_SHOWCASE_ORDER
    .map((key) => MODULE_SHOWCASES[key])
    .filter(Boolean)
    .map((item) => ({ ...item, activeKeys: [...(item.activeKeys || [item.key])], integrations: [...(item.integrations || [])] }));
}

function normalizeShowcaseKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]/g, "");
}

export function getModuleShowcase(keyOrSlug) {
  const key = normalizeShowcaseKey(keyOrSlug);
  return Object.values(MODULE_SHOWCASES).find((item) => normalizeShowcaseKey(item.key) === key) || getModuleShowcases().find((item) => {
    return [item.appKey, item.checkoutModuleKey, item.name, ...(item.activeKeys || [])]
      .some((candidate) => normalizeShowcaseKey(candidate) === key);
  }) || null;
}

export function moduleIsActive(showcase, activeModules = []) {
  const active = new Set((Array.isArray(activeModules) ? activeModules : [])
    .map((key) => normalizeShowcaseKey(key))
    .filter(Boolean));
  return [showcase?.key, showcase?.appKey, showcase?.checkoutModuleKey, ...(showcase?.activeKeys || [])]
    .some((key) => active.has(normalizeShowcaseKey(key)));
}

export function getModulePurchaseUrl(showcase) {
  const key = showcase?.checkoutModuleKey || "";
  if (showcase?.landingPage) return showcase.landingPage;
  return key ? `/quick-onboarding.html?module=${encodeURIComponent(key)}&selectedModules=${encodeURIComponent(key)}` : "/quick-onboarding.html";
}
