export const MODULE_SHOWCASE_ORDER = ["egenkontrol"];

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
