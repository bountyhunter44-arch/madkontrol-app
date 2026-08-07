export const MODULE_SHOWCASE_ORDER = ["egenkontrol", "pos", "accounting"];

export const MODULE_SHOWCASES = {
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
    integrations: [],
    integrationText: "Egenkontrol samler dokumentation og daglige processer i et samlet workflow."
  },
  // Verificeret-genoprettede selvstændige EWCP-moduler. landingPage/entryUrl er de
  // verificerede eksterne domæner, så "Se mere" (ikke-ejet) og "Åbn" (ejet) begge går til
  // modulets egen app — ALDRIG til Madkontrollen quick-onboarding/checkout. Bevidst INGEN
  // checkoutModuleKey. Ejerskab udledes generisk af activeModules (entitlement/module-state).
  pos: {
    key: "pos",
    appKey: "pos",
    activeKeys: ["pos"],
    name: "POS",
    badge: "Salg og kasse",
    category: "Salg og kasse",
    image: "",
    imageAlt: "Kassesystem med salg, betaling og kvitteringer",
    landingPage: "https://pos.madkontrollen.dk",
    entryUrl: "https://pos.madkontrollen.dk",
    priceLabel: "Selvstændigt modul",
    teaser: "Kassesystem til salg, betaling, kvitteringer og dagsopgørelse.",
    headline: "POS – kassesystem til din virksomhed.",
    subheading: "Sælg, tag betaling og hold styr på kvitteringer og dagsafslutning.",
    intro: "POS er Madkontrollens selvstændige kassesystem på pos.madkontrollen.dk. Adgang styres via dit eksisterende abonnement.",
    value: "Ét samlet kasseflow, der spiller sammen med resten af Madkontrollen.",
    features: ["Salg og betaling", "Kvitteringer", "Dagsopgørelse", "Åbnes som selvstændig app"],
    audience: ["Restaurant", "Café", "Foodtruck", "Kiosk"],
    integrations: [],
    integrationText: "POS åbnes som selvstændig applikation på pos.madkontrollen.dk."
  },
  accounting: {
    key: "accounting",
    appKey: "accounting",
    activeKeys: ["accounting", "bogforing"],
    name: "Regnskab",
    badge: "Økonomi",
    category: "Økonomi",
    image: "",
    imageAlt: "Bogføring med bilag, moms og bank",
    landingPage: "https://regnskab.ewcp.dk",
    entryUrl: "https://regnskab.ewcp.dk",
    priceLabel: "Selvstændigt modul",
    teaser: "Bogføring, bilag, moms og bank i én app.",
    headline: "Regnskab – bogføring uden bøvl.",
    subheading: "Bilagsscanning, moms, bank og SAF-T samlet ét sted.",
    intro: "Regnskab er Madkontrollens selvstændige bogføringsapp på regnskab.ewcp.dk. Adgang styres via dit eksisterende abonnement.",
    value: "Automatiseret bogføring, der reducerer manuelt arbejde.",
    features: ["Bilagsscanning", "Moms", "Bankafstemning", "Åbnes som selvstændig app"],
    audience: ["Restaurant", "Café", "Catering", "Detail"],
    integrations: [],
    integrationText: "Regnskab åbnes som selvstændig applikation på regnskab.ewcp.dk."
  },
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
