// media — udtrukket fra functions/index.js.
// Følger DI-factory-mønsteret fra functions/egenkontrol/.
// Kode flyttet ORDRET; eneste ændring er `exports.` -> `api.`.

const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { sanitizeString, sanitizeStringList, sanitizeBoolean, toArray, toPositiveInt, toDocSafeId, toAsciiSlug, toLegacyId, getDateKey, addDays, daysBetween, normalizeDateKey, removeUndefinedFields, getWeekdayFromDateKey, sanitizeRelativePath, parsePageCount } = require("./lib/util");

module.exports = ({
  FUNCTIONS_CONFIG,
  FieldValue,
  OPENAI_API_KEY,
  assertStartDayAccess,
  db
}) => {
  const api = {};

function extractJsonBlock(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_error) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_errorInner) {
      return null;
    }
  }
}

function buildVisionPrompt({ moduleType, itemId, contextType, citizenProfile, taskTitle, taskCategory, autoRoute = false }) {
  const moduleLower = sanitizeString(moduleType || "egenkontrol", 80).toLowerCase();
  const contextLower = sanitizeString(contextType || "", 80).toLowerCase();
  const categoryLower = sanitizeString(taskCategory || "", 80).toLowerCase();

  const commonRules = [
    "Skriv kort, professionelt og juridisk egnet pÃ¥ dansk.",
    "Vurder kun det, der kan ses i billedet.",
    "UndgÃ¥ gÃ¦t om usynlige forhold.",
    "FOKUS: KoncentrÃ©r dig om det primÃ¦re objekt/omrÃ¥de i billedet â€“ ignorer rod, kaos eller stÃ¸j i baggrunden medmindre det er en direkte hygiejnerisiko.",
    "PROAKTIV SCANNING: Selv hvis du ikke er blevet bedt specifikt om det, skal du ALTID rÃ¥be op med '[AFVIGELSE]' hvis du ser: Ã¥bne beholdere uden lÃ¥g, redskaber (skeer, knive, sleev) placeret direkte i madvarer, udÃ¦kkede rÃ¥varer, spild eller dryp pÃ¥ hylder, datostempler der er overskredet, eller lignende konkrete hygiejnerisici. Forklar prÃ¦cist hvad der skal gÃ¸res.",
    "AI maa kun give et forslag til manuel vurdering. AI maa aldrig afgoere eller oprette en afvigelse alene.",
    "Skriv IKKE '[AFVIGELSE]' som kommando. Brug i stedet severity, confidenceScore og suggestedIssue til at beskrive mulig risiko.",
    "Hvis du ser mulig hygiejnerisiko, formuler det som et manuelt forslag brugeren skal bekraefte.",
    "Returner KUN gyldig JSON med de aftalte felter."
  ].join(" ");

  // AI-Router mode: Auto-categorize image type
  if (autoRoute) {
    return [
      "Du er en hygiejne-inspektÃ¸r og revisor for et professionelt kÃ¸kken-dokumentationssystem.",
      "AnalysÃ©r dette optimerede billede med kritisk blik og identificÃ©r hvad det viser:",
      "1. FAKTURA/BILAG: Hvis du ser tekst med belÃ¸b, leverandÃ¸rnavn, fakturanummer, eller regnskabsbilag â†’ kategori: 'finance'",
      "   - UdtrÃ¦k leverandÃ¸r, totalbelÃ¸b, momsbelÃ¸b (25%), fakturadato.",
      "   - Vurder om teksten er lÃ¦sbar til bogfÃ¸ring.",
      "2. EGENKONTROL (MASKINE/UDSTYR): Hvis du ser kÃ¸kkenudstyr (ovn, kÃ¸leskab, emhÃ¦tte, opvaskemaskine) â†’ kategori: 'egenkontrol'",
      "   - LED EFTER: Madrester, fedt, snavs, eller urenheder.",
      "   - Hvis det er et display: UdtrÃ¦k temperatur med prÃ¦cis vÃ¦rdi og enhed (f.eks. '+4Â°C' eller '-18Â°C').",
      "   - Hvis du finder fejl (synligt snavs, madrester, fedt, hÃ¸j temperatur >+8Â°C eller lav temperatur >-15Â°C), skal dit svar STARTE med '[AFVIGELSE]'.",
      "   - Beskriv hvad du ser (f.eks. 'Ovn rengjort, ingen restprodukter' eller '[AFVIGELSE] Synlige madrester i hjÃ¸rner, fedt pÃ¥ pakninger').",
      "3. MADANRETNING: Hvis du ser en tallerken med mad, dysfagi-kost, eller portion til borger â†’ kategori: 'institution'",
      "   - Vurder konsistens, tekstur, dysfagi-egnethed.",
      "Vurder billedets KLARHED (image_clarity): 'clear' hvis alle detaljer er synlige, 'unclear' hvis uskarpt/mÃ¸rkt/utydeligt.",
      commonRules,
      "Returner kategori baseret pÃ¥ hvad billedet FAKTISK viser, ikke hvad brugeren siger.",
      "Husk: Start beskrivelse med '[AFVIGELSE]' hvis du finder hygiejneproblemer eller temperaturafvigelser."
    ].join(" ");
  }

  // Specific module prompts (existing logic)
  if (moduleLower === "finance") {
    return [
      "Du analyserer et foto af et regnskabsbilag fra professionel foodservice-drift.",
      "UdtrÃ¦k leverandÃ¸rnavn, totalbelÃ¸b, momsbelÃ¸b og fakturadato, hvis synligt.",
      "Vurder om bilaget er lÃ¦sbart til bogfÃ¸ring.",
      commonRules,
      "Brug kategori: finance."
    ].join(" ");
  }

  if (moduleLower === "institution" || contextLower === "institution") {
    const citizenInfo = sanitizeString(citizenProfile || "", 300);
    return [
      "Du analyserer et billede af en anretning i institutionskÃ¸kken.",
      "Vurder konsistens ift. dysfagi/blÃ¸d kost, synlige klumper, tekstur og ensartethed.",
      citizenInfo ? `Borgerprofil: ${citizenInfo}.` : "Borgerprofil: Ikke angivet.",
      commonRules,
      "Brug kategori: institution."
    ].join(" ");
  }

  if (moduleLower === "commercial" || contextLower === "commercial") {
    return [
      "Du analyserer et rengÃ¸rings- eller udstyrsfoto fra et kommercielt kÃ¸kken.",
      "Vurder renhedsgrad for ovne, emhÃ¦tter, kÃ¸lediske og synlige filtre/tÃ¸mning.",
      commonRules,
      "Brug kategori: commercial."
    ].join(" ");
  }

  const scopedItem = sanitizeString(itemId || taskTitle || "udstyr", 180);
  const scopedItemLower = scopedItem.toLowerCase();

  // ADSKILLELSE / SEPARATION
  if (categoryLower.includes("adskillelse") || categoryLower.includes("separation") || categoryLower.includes("kryds") || scopedItemLower.includes("adskillelse") || scopedItemLower.includes("separation") || scopedItemLower.includes("kryds")) {
    return [
      "Du er en HACCP-inspektÃ¸r. AnalysÃ©r dette billede med fokus pÃ¥ ADSKILLELSE af rÃ¥varer og kryds-kontaminationsrisiko.",
      `Opgave: ${scopedItem}.`,
      "Tjek SPECIFIKT:",
      "1. FARVEKODER: Bruges de rigtige farver til skÃ¦rebrÃ¦tter/knive (rÃ¸d=rÃ¥t kÃ¸d, gul=fjerkrÃ¦, grÃ¸n=grÃ¸nt, blÃ¥=fisk, hvid=mejeriprodukter)?",
      "2. ADSKILLELSE: Er rÃ¥t kÃ¸d/fisk adskilt fra tilberedte varer med fysisk afstand, separat emballage, eller skillevÃ¦g?",
      "3. OPBEVARINGSHÃ˜JDE: Er rÃ¥t kÃ¸d/fisk placeret UNDER tilberedte varer (ikke over)?",
      "4. KONTAMINATIONSRISIKO: Er der dryp, spild, eller uhygiejnisk kontakt mellem produkttyper?",
      "Hvis du finder ADSKILLELSESPROBLEM: Start med '[AFVIGELSE]' og forklar risikoen (kryds-kontaminering = alvorlig Salmonella/E.coli-risiko).",
      "Hvis adskillelsen er korrekt: BekrÃ¦ft med kort professionel beskrivelse.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // TEMPERATUR KONTROL
  if (categoryLower.includes("temperatur") || categoryLower.includes("kÃ¸l") || categoryLower.includes("frost") || categoryLower.includes("varmt") || categoryLower.includes("varmhold") || scopedItemLower.includes("temp") || scopedItemLower.includes("kÃ¸l") || scopedItemLower.includes("frost") || scopedItemLower.includes("Â°c")) {
    return [
      "Du er en HACCP-temperaturekspert. AnalysÃ©r dette billede med FOKUS PÃ… TEMPERATUR.",
      `Udstyr/opgave: ${scopedItem}.`,
      "Hvis du ser et DISPLAY eller TERMOMETER:",
      "- AflÃ¦s temperaturen med PRÃ†CISION (f.eks. '-18.2Â°C' eller '+4.1Â°C').",
      "- Returner tallet med fortegn i temperature_value (f.eks. -18.2 eller 4.1).",
      "- GRÃ†NSEVÃ†RDIER: KÃ¸l â‰¤+5Â°C, Frost â‰¤-18Â°C, Varmholdelse â‰¥+65Â°C.",
      "- Er temperaturen INDEN FOR grÃ¦nsen? â†’ handling_udfort: true og bekrÃ¦ft.",
      "- Er temperaturen UDENFOR grÃ¦nsen? â†’ Start med '[AFVIGELSE]' og forklar risikoen (bakterievÃ¦kst, HACCP-brud).",
      "Hvis du IKKE kan se temperaturen tydeligt: Angiv image_clarity: 'unclear'.",
      "Tjek ogsÃ¥: Er udstyret lukket korrekt? Er der rim/is-dannelse (tegn pÃ¥ temperatursvingninger)?",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // OPBEVARING / STORAGE
  if (categoryLower.includes("opbevaring") || categoryLower.includes("storage") || categoryLower.includes("lager") || categoryLower.includes("hylde") || scopedItemLower.includes("opbevaring") || scopedItemLower.includes("lager") || scopedItemLower.includes("hylde")) {
    return [
      "Du er en hygiejnekonsulent. AnalysÃ©r dette billede med fokus pÃ¥ KORREKT OPBEVARING af fÃ¸devarer.",
      `OmrÃ¥de/opgave: ${scopedItem}.`,
      "Tjek SPECIFIKT:",
      "1. Ã…BNE BEHOLDERE: Er der beholdere, gryder, skÃ¥le eller pakker uden lÃ¥g/dÃ¦kning? En Ã¥ben beholder = kontaminationsrisiko (hÃ¥rhygiejne, insekter, luftbÃ¥rne bakterier). Forklar hvad der mangler (lÃ¥g, plastikfilm, dÃ¦kkende emballage).",
      "2. REDSKABER I MAD: Er der en ske, slev, kniv eller andet redskab placeret DIREKTE I en madbeholder? Det er en hygiejnerisiko (kryds-kontaminering, bakterievÃ¦kst pÃ¥ hÃ¥ndtaget). RÃ¥b op: forklar at redskabet skal fjernes og opbevares separat.",
      "3. EMBALLAGE: Er alle Ã¸vrige varer forsvarligt emballerede/dÃ¦kkede?",
      "4. DATOSTEMPLING: Er varer mÃ¦rket med Ã¥bningsdato/holdbarhed? Kan du se udlÃ¸bsdatoer?",
      "5. RÃ†KKEFÃ˜LGE (FIFO): Er Ã¦ldste varer placeret forrest (First In, First Out)?",
      "6. HYGIEJNE: Er hylder/enheder rene? Rester, spild eller kondensvand?",
      "7. ADSKILLELSE: Er rÃ¥varer og tilberedte varer adskilt korrekt (rÃ¥t under, tilberedt over)?",
      "Hvis du finder OPBEVARINGSFEJL: Start med '[AFVIGELSE]' og forklar den konkrete risiko.",
      "Hvis opbevaringen er korrekt: BekrÃ¦ft med kort professionel beskrivelse.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // MODTAGEKONTROL / VAREMODTAGELSE
  if (categoryLower.includes("modtagelse") || categoryLower.includes("levering") || categoryLower.includes("varemodtagelse") || scopedItemLower.includes("modtagelse") || scopedItemLower.includes("levering")) {
    return [
      "Du er en varekontrollÃ¸r. AnalysÃ©r dette billede med fokus pÃ¥ VAREMODTAGELSE.",
      `Ordre/vare: ${scopedItem}.`,
      "Tjek SPECIFIKT:",
      "1. TEMPERATUR: Er der synlig temperatur pÃ¥ mÃ¦rkat eller thermometer? KÃ¸dvarer â‰¤+5Â°C, Fisk â‰¤+2Â°C, Frost â‰¤-18Â°C.",
      "2. EMBALLAGE: Er emballagen hel, ren og ubeskadiget (ingen huller, misfarvning, kondensation)?",
      "3. SYNLIGE FEJL: Misfarvning, lugtproblemer (skriv 'kan ikke vurdere lugt fra billede'), beskadigelse?",
      "4. MÃ†RKNING: Er produktet korrekt mÃ¦rket (art, mÃ¦ngde, holdbarhed)?",
      "Hvis du finder FEJL ved modtagelsen: Start med '[AFVIGELSE]' â€“ varen skal AFVISES og returneres til leverandÃ¸ren.",
      "Hvis varen er OK: BekrÃ¦ft med 'Vare godkendt til modtagelse' og noter relevante observationer.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }

  // RENGÃ˜RING / CLEANING
  if (categoryLower.includes("rengÃ¸ring") || categoryLower.includes("rengoring") || categoryLower.includes("cleaning") || categoryLower.includes("hygiejne") || scopedItemLower.includes("rengÃ¸r") || scopedItemLower.includes("rengor")) {
    return [
      "Du er en hygiejneinspektÃ¸r. AnalysÃ©r dette billede med KRITISK blik pÃ¥ RENGÃ˜RINGSRESULTATET.",
      `OmrÃ¥de/udstyr: ${scopedItem}.`,
      "LED SPECIFIKT EFTER:",
      "1. MADRESTER: Synlige rester af mad, fedt, eller organisk materiale?",
      "2. OVERFLADERENHED: Er overflader rent og fri for fedtfilm?",
      "3. HJÃ˜RNER OG SAMLINGER: Er hjÃ¸rner, revner og samlinger rene (skjulesteder for bakterier)?",
      "4. DRIFTSSLID: Misfarvning i stÃ¥l, patina og normalt slid er IKKE hygiejnerisiko â€“ beskriv det som acceptabelt.",
      "Hvis du finder SYNLIG SNAVS eller MADRESTER: Start med '[AFVIGELSE]' og forklar risikoen.",
      "Hvis rengÃ¸ringen er tilfredsstillende: BekrÃ¦ft kort og professionelt.",
      commonRules,
      "Brug kategori: egenkontrol."
    ].join(" ");
  }
  if (scopedItemLower.includes("gulv") || scopedItemLower.includes("aflÃ¸b") || scopedItemLower.includes("rist") || scopedItemLower.includes("drain") || scopedItemLower.includes("floor")) {
    return [
      "Du er en erfaren kÃ¸kkenchef-mentor. AnalysÃ©r dette billede af et gulvaflÃ¸b eller en rist med FAGLIGT blik.",
      "VÃ¦r STRENG med hygiejne (madrester, organisk materiale), men REALISTISK med driftsslid (misfarvning i stÃ¥l, slid pÃ¥ pakninger).",
      "Tjek SPECIFIKT for:",
      "1. ORGANISK MATERIALE: Er der synlige madrester, fedtslam eller snavs i risten eller under koppen?",
      "2. VANDLÃ…S: Er der vand i vandlÃ¥sen (for at undgÃ¥ lugtgener)?",
      "3. RIST: Sidder risten korrekt pÃ¥ plads?",
      "Hvis du finder MADRESTER i aflÃ¸bet:",
      "- Dit svar skal STARTE med '[AFVIGELSE]'",
      "- Forklar HVORFOR det er et problem: 'Madrester fundet i aflÃ¸b. Dette tiltrÃ¦kker skadedyr (rotter, kakerlakker) og skaber bakterievÃ¦kst (Salmonella, E. coli). Skal fjernes straks.'",
      "- SÃ¦t handling_udfort til false",
      "Hvis aflÃ¸bet er RENT, men har misfarvning/patina:",
      "- Beskriv: 'AflÃ¸b rengjort. Ingen madrester. Misfarvning i stÃ¥l er normalt driftsslid, ikke hygiejnerisiko. Rist korrekt placeret.'",
      "- SÃ¦t handling_udfort til true",
      "Hvis aflÃ¸bet er RENT:",
      "- Beskriv: 'AflÃ¸b rengjort. Ingen madrester. Rist korrekt placeret. VandlÃ¥s OK.'",
      "- SÃ¦t handling_udfort til true",
      commonRules,
      "Brug kategori: egenkontrol.",
      "Husk: Forklar HVORFOR noget er et problem (risiko for skadedyr, bakterievÃ¦kst), ikke bare 'beskidt'. VÃ¦r realistisk om normal slid vs. hygiejnerisiko."
    ].join(" ");
  }

  return [
    "Du er en erfaren kÃ¸kkenchef-mentor. AnalysÃ©r dette optimerede billede fra et professionelt kÃ¸kken med FAGLIGT blik.",
    `Objekt/opgave: ${scopedItem}.`,
    "VÃ¦r STRENG med hygiejne (madrester, temperatur), men REALISTISK med driftsslid (misfarvning, slid pÃ¥ pakninger).",
    "LED EFTER: Madrester, fedt, snavs, urenheder, eller temperaturafvigelser.",
    "Hvis det er en maskine: Er den ren? Synlige madrester? Fedt pÃ¥ pakninger eller lister? Hvis du ser misfarvning i stÃ¥l eller normal slid, forklar at det er acceptabelt driftsslid.",
    "Hvis det er et DISPLAY (temperatur): Find temperaturen pÃ¥ displayet. Returner tallet med fortegn i temperature_value (f.eks. '-18.5' eller '+4.0').",
    "Hvis det er et filter: Er det tÃ¸mt? Synligt snavs?",
    "Hvis du finder HYGIEJNE-FEJL (madrester, fedt, temperaturafvigelser):",
    "- Dit svar skal STARTE med '[AFVIGELSE]'",
    "- Forklar HVORFOR det er et problem (f.eks. 'Madrester tiltrÃ¦kker skadedyr', 'Temperatur >8Â°C giver bakterievÃ¦kst', 'Fedt pÃ¥ pakninger skaber biofilm')",
    "- VÃ¦r SPECIFIK om risikoen, ikke bare 'beskidt'",
    "Hvis du ser NORMAL SLID (misfarvning, patina, slid pÃ¥ overflader):",
    "- Beskriv: 'Udstyr rengjort. Misfarvning/slid er normalt driftsslid, ikke hygiejnerisiko.'",
    "- SÃ¦t handling_udfort til true",
    "Skriv en kort, formel bekrÃ¦ftelse pÃ¥ dansk til en egenkontrol-rapport.",
    commonRules,
    "Brug kategori: egenkontrol.",
    "Husk: Forklar HVORFOR problemer er farlige. VÃ¦r realistisk om forskellen pÃ¥ hygiejnerisiko vs. normal slid. Du er en lÃ¦remester, ikke en politibetjent."
  ].join(" ");
}

function scoreStockPhoto(photo) {
  let score = 0;
  const w = photo.width || 0;
  const h = photo.height || 0;
  if (w > 0 && h > 0) {
    const ratio = w / h;
    if (ratio >= 1.6 && ratio <= 1.85) score += 30;
    else if (ratio >= 1.3) score += 15;
    else if (ratio < 1) score -= 30;
  }
  if (w >= 1920) score += 20;
  else if (w >= 1280) score += 10;
  if (photo.src && photo.src.large2x) score += 10;
  return score;
}

api.getCloudinarySignature = onCall({ region: "us-central1", secrets: ["FUNCTIONS_CONFIG_EXPORT"] }, async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Log ind for at uploade billeder.");
  }

  const crypto = require("crypto");
  let config = {};
  try {
    const secretConfig = FUNCTIONS_CONFIG.value();
    config = typeof secretConfig === "string"
      ? JSON.parse(secretConfig || "{}")
      : (secretConfig || {});
  } catch (_) {
    try { config = JSON.parse(process.env.FUNCTIONS_CONFIG_EXPORT || "{}"); } catch (_) {}
  }

  const cloudName =
    config?.cloudinary?.cloud_name ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    "";
  const apiKey =
    config?.cloudinary?.api_key ||
    process.env.CLOUDINARY_API_KEY ||
    "";
  const apiSecret =
    config?.cloudinary?.api_secret ||
    process.env.CLOUDINARY_API_SECRET ||
    "";

  console.log("[Cloudinary] Config check:", {
    hasCloudName: Boolean(cloudName),
    hasApiKey: Boolean(apiKey),
    hasApiSecret: Boolean(apiSecret),
    cloudNameSource: cloudName ? (config?.cloudinary?.cloud_name ? "FUNCTIONS_CONFIG_EXPORT" : "process.env") : "none",
    envVarsAvailable: {
      CLOUDINARY_CLOUD_NAME: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
      CLOUDINARY_API_KEY: Boolean(process.env.CLOUDINARY_API_KEY),
      CLOUDINARY_API_SECRET: Boolean(process.env.CLOUDINARY_API_SECRET)
    }
  });

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("[Cloudinary] Missing credentials. Check functions/.env file or Firebase secrets.");
    throw new HttpsError(
      "failed-precondition",
      "Cloudinary er ikke konfigureret. Kontakt administrator. Se CLOUDINARY_SETUP.md for instruktioner."
    );
  }

  const cleanMetaValue = (value, maxLen = 160) => String(value || "")
    .trim()
    .replace(/[|=\\]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, maxLen);

  const companyId = sanitizeString(data?.companyId || "", 120) || "unknown";
  const locationId = sanitizeString(data?.locationId || "", 120) || "unknown";
  const moduleType = cleanMetaValue(data?.moduleType || "Egenkontrol", 60) || "Egenkontrol";
  const itemId = cleanMetaValue(data?.itemId || "Dokumentation", 140) || "Dokumentation";
  const taskInstanceId = sanitizeString(data?.taskInstanceId || "", 140);
  const taskId = sanitizeString(data?.taskId || "", 140);
  const userId = request.auth.uid;

  const folder = `madkontrol/${companyId}/${locationId}/${toAsciiSlug(moduleType || "module", 40) || "module"}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${toAsciiSlug(userId, 60) || "user"}-${Date.now()}`;

  const tags = [
    `user_${toAsciiSlug(userId, 60) || "unknown"}`,
    `module_${toAsciiSlug(moduleType, 40) || "unknown"}`,
    `item_${toAsciiSlug(itemId, 80) || "unknown"}`,
    `company_${toAsciiSlug(companyId, 60) || "unknown"}`,
    `location_${toAsciiSlug(locationId, 60) || "unknown"}`
  ].join(",");

  const contextPairs = [
    `user_id=${cleanMetaValue(userId, 120)}`,
    `module_type=${cleanMetaValue(moduleType, 80)}`,
    `item_id=${cleanMetaValue(itemId, 160)}`,
    `company_id=${cleanMetaValue(companyId, 120)}`,
    `location_id=${cleanMetaValue(locationId, 120)}`,
    `task_instance_id=${cleanMetaValue(taskInstanceId, 140)}`,
    `task_id=${cleanMetaValue(taskId, 140)}`
  ].filter((pair) => !pair.endsWith("="));

  const contextValue = contextPairs.join("|");

  // Signature: alphabetically sorted params joined with &, then append api_secret, SHA1
  const paramsToSign = [
    `context=${contextValue}`,
    `folder=${folder}`,
    `public_id=${publicId}`,
    `tags=${tags}`,
    `timestamp=${timestamp}`
  ].join("&");
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + apiSecret)
    .digest("hex");

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
    publicId,
    tags,
    context: contextValue,
    moduleType,
    itemId,
    userId
  };
});

api.analyzeCloudinaryAsset = onCall(
  { secrets: [OPENAI_API_KEY], region: "us-central1" },
  async (request) => {
  const data = request.data;
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Log ind for at analysere billeder.");
  }

  const imageUrl = sanitizeString(data?.imageUrl || "", 2000);
  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const moduleType = sanitizeString(data?.moduleType || "egenkontrol", 80);
  const itemId = sanitizeString(data?.itemId || "", 180);
  const contextType = sanitizeString(data?.contextType || "", 80);
  const taskTitle = sanitizeString(data?.taskTitle || "", 220);
  const taskCategory = sanitizeString(data?.taskCategory || "", 80);
  const citizenProfile = sanitizeString(data?.citizenProfile || "", 320);

  if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
    throw new functions.https.HttpsError("invalid-argument", "imageUrl mangler eller er ugyldig.");
  }

  if (companyId && locationId) {
    await assertStartDayAccess({
      uid: request.auth.uid,
      email: request.auth.token?.email || "",
      companyId,
      locationId
    });
  }

  const openAiApiKey =
    OPENAI_API_KEY.value() ||
    process.env.OPENAI_API_KEY ||
    "";

  if (!openAiApiKey) {
    throw new HttpsError(
      "failed-precondition",
      "Vision AI API-noegle mangler. Saet OPENAI_API_KEY som function secret."
    );
  }

  const modelName =
    sanitizeString(process.env.OPENAI_VISION_MODEL || "", 120) ||
    "gpt-4o-mini";

  const promptText = buildVisionPrompt({
    moduleType,
    itemId,
    contextType,
    citizenProfile,
    taskTitle,
    taskCategory,
    autoRoute: true
  });

  const jsonShape = [
    "Returner JSON med disse felter:",
    "handling_udfort: boolean",
    "beskrivelse: string",
    "confidence: number mellem 0 og 1",
    "confidenceScore: number mellem 0 og 1",
    "severity: string ('low', 'medium', 'high' eller 'critical')",
    "suggestedIssue: string|null (kort forslag til hvad brugeren manuelt bÃ¸r kontrollere)",
    "kategori: string (finance, egenkontrol, eller institution)",
    "image_clarity: string ('clear' eller 'unclear')",
    "temperature_value: number|null (hvis display viser temperatur, returner tallet med fortegn, f.eks. -18.5 eller 4.0)",
    "has_fresh_fish: boolean (true hvis du ser fersk fisk pÃ¥ billedet)",
    "observationer: array af strings",
    "commercial: { cleanliness_score: number|null, filter_tomt: boolean|null }",
    "institution: { dysfagi_match: boolean|null, dysfagi_note: string }",
    "finance: { leverandor: string, total_belob: number|null, moms_belob: number|null, faktura_dato: string }",
    "risikoflag: array af strings"
  ].join("\n");

  let responseData;
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: "Du er fÃ¸devaresikkerheds-assistent for egenkontrol og dokumentation. Lever kun validerbar, sober vurdering."
          },
          {
            role: "user",
            content: [
              { type: "text", text: `${promptText}\n\n${jsonShape}` },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ]
      })
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`Vision API fejl (${resp.status}): ${errorText}`);
    }

    responseData = await resp.json();
  } catch (error) {
    console.error("Vision API kald fejlede:", error);
    throw new HttpsError("internal", "Kunne ikke gennemfÃ¸re billedanalyse.");
  }

  const rawText = String(
    responseData?.choices?.[0]?.message?.content || ""
  ).trim();

  const parsed = extractJsonBlock(rawText) || {};

  const handlingUdfort = parsed?.handling_udfort === true;
  const beskrivelse = sanitizeString(
    parsed?.beskrivelse || "Billedet er analyseret automatisk. VerificÃ©r resultatet manuelt fÃ¸r godkendelse.",
    1800
  );
  const confidenceRaw = Number(parsed?.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : 0.55;
  const confidenceScoreRaw = Number(parsed?.confidenceScore);
  const confidenceScore = Number.isFinite(confidenceScoreRaw)
    ? Math.max(0, Math.min(1, confidenceScoreRaw))
    : confidence;
  const severityCandidate = sanitizeString(parsed?.severity || "", 40).toLowerCase();
  const severity = ["low", "medium", "high", "critical"].includes(severityCandidate)
    ? severityCandidate
    : (Array.isArray(parsed?.risikoflag) && parsed.risikoflag.length ? "medium" : "low");
  const suggestedIssue = sanitizeString(
    parsed?.suggestedIssue ||
      (Array.isArray(parsed?.risikoflag) && parsed.risikoflag.length ? parsed.risikoflag[0] : "") ||
      "",
    360
  );

  // AI-Router: Extract image clarity and category
  const imageClarity = String(parsed?.image_clarity || "").toLowerCase();
  const aiCategory = sanitizeString(parsed?.kategori || "", 80).toLowerCase();
  const isUnclear = imageClarity === "unclear" || confidence < 0.4;
  
  // Determine routing based on AI analysis
  const detectedCategory = ["finance", "egenkontrol", "institution"].includes(aiCategory) 
    ? aiCategory 
    : "egenkontrol";

  const temperatureValue = Number.isFinite(Number(parsed?.temperature_value))
    ? Number(parsed.temperature_value)
    : null;
  const hasFreshFish = parsed?.has_fresh_fish === true;

  const result = {
    handling_udfort: handlingUdfort,
    beskrivelse,
    confidence,
    confidenceScore,
    severity,
    suggestedIssue,
    kategori: detectedCategory,
    image_clarity: imageClarity || (confidence >= 0.6 ? "clear" : "unclear"),
    is_unclear: isUnclear,
    routing_suggestion: detectedCategory,
    temperature_value: temperatureValue,
    has_fresh_fish: hasFreshFish,
    observationer: Array.isArray(parsed?.observationer)
      ? parsed.observationer.map((item) => sanitizeString(item, 220)).filter(Boolean).slice(0, 8)
      : [],
    commercial: {
      cleanliness_score: Number.isFinite(Number(parsed?.commercial?.cleanliness_score))
        ? Math.max(0, Math.min(100, Number(parsed.commercial.cleanliness_score)))
        : null,
      filter_tomt:
        typeof parsed?.commercial?.filter_tomt === "boolean"
          ? parsed.commercial.filter_tomt
          : null
    },
    institution: {
      dysfagi_match:
        typeof parsed?.institution?.dysfagi_match === "boolean"
          ? parsed.institution.dysfagi_match
          : null,
      dysfagi_note: sanitizeString(parsed?.institution?.dysfagi_note || "", 260)
    },
    finance: {
      leverandor: sanitizeString(parsed?.finance?.leverandor || "", 160),
      total_belob: Number.isFinite(Number(parsed?.finance?.total_belob))
        ? Number(parsed.finance.total_belob)
        : null,
      moms_belob: Number.isFinite(Number(parsed?.finance?.moms_belob))
        ? Number(parsed.finance.moms_belob)
        : null,
      faktura_dato: sanitizeString(parsed?.finance?.faktura_dato || "", 40)
    },
    risikoflag: Array.isArray(parsed?.risikoflag)
      ? parsed.risikoflag.map((item) => sanitizeString(item, 180)).filter(Boolean).slice(0, 6)
      : []
  };

  return {
    ok: true,
    model: modelName,
    result,
    routing: {
      suggested_module: detectedCategory,
      is_unclear: isUnclear,
      confidence,
      user_message: isUnclear 
        ? "Utydeligt billede â€“ prÃ¸v igen for korrekt dokumentation"
        : `Billede kategoriseret som: ${detectedCategory === "finance" ? "Faktura/Regnskab" : detectedCategory === "institution" ? "Madanretning/Institution" : "Egenkontrol"}`
    }
  };
});

api.getCloudinaryAssets = onCall({ region: "us-central1", secrets: ["FUNCTIONS_CONFIG_EXPORT"] }, async (request) => {
  const data = request.data;
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Log ind for at hente billeder.");
  }

  let config = {};
  try { config = JSON.parse(process.env.FUNCTIONS_CONFIG_EXPORT || "{}"); } catch (_) {}
  const cloudName = config?.cloudinary?.cloud_name || process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = config?.cloudinary?.api_key || process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = config?.cloudinary?.api_secret || process.env.CLOUDINARY_API_SECRET || "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpsError(
      "failed-precondition",
      "Cloudinary er ikke konfigureret. Kontakt administrator."
    );
  }

  const companyId = sanitizeString(data?.companyId || "", 120);
  const locationId = sanitizeString(data?.locationId || "", 120);
  const userId = request.auth.uid;
  const maxResults = Math.min(Math.max(1, Number(data?.maxResults) || 500), 500);

  // Build Cloudinary Admin API URL to search for resources
  const crypto = require("crypto");
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Build search expression for user's images
  let expression = `tags=user_${toAsciiSlug(userId, 60)}`;
  
  if (companyId) {
    expression += ` AND tags=company_${toAsciiSlug(companyId, 60)}`;
  }
  
  if (locationId) {
    expression += ` AND tags=location_${toAsciiSlug(locationId, 60)}`;
  }

  // Create signature for Admin API
  const paramsToSign = `expression=${expression}&max_results=${maxResults}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

  // Call Cloudinary Admin API
  const searchUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`;
  const formData = new URLSearchParams();
  formData.append("expression", expression);
  formData.append("max_results", String(maxResults));
  formData.append("timestamp", String(timestamp));
  formData.append("api_key", apiKey);
  formData.append("signature", signature);

  try {
    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudinary API fejl (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const resources = result.resources || [];

    // Transform to our format
    const assets = resources.map((resource) => ({
      id: resource.asset_id || resource.public_id,
      publicId: resource.public_id,
      secureUrl: resource.secure_url,
      optimizedUrl: resource.secure_url?.replace("/upload/", "/upload/f_auto,q_auto/") || resource.secure_url,
      format: resource.format,
      width: resource.width,
      height: resource.height,
      bytes: resource.bytes,
      createdAt: resource.created_at,
      tags: resource.tags || [],
      context: resource.context?.custom || {},
      resourceType: resource.resource_type
    }));

    return {
      ok: true,
      total: result.total_count || assets.length,
      assets
    };
  } catch (error) {
    console.error("Cloudinary fetch fejl:", error);
    throw new HttpsError(
      "internal",
      `Kunne ikke hente billeder fra Cloudinary: ${error.message}`
    );
  }
});

api.searchRestaurantImages = onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"], region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at sÃ¸ge billeder.");
    }

    const data = request.data;
    const query = sanitizeString(data?.query || "", 200);
    const perPage = Math.min(Math.max(1, Number(data?.perPage) || 15), 24);

    if (!query) {
      throw new HttpsError("invalid-argument", "SÃ¸geord mangler.");
    }

    let config = {};
    try { config = JSON.parse(process.env.FUNCTIONS_CONFIG_EXPORT || "{}"); } catch (_) {}
    const pexelsKey = config?.pexels?.api_key || process.env.PEXELS_API_KEY || "";
    const cloudName = config?.cloudinary?.cloud_name || process.env.CLOUDINARY_CLOUD_NAME || "";

    if (!pexelsKey) {
      throw new HttpsError(
        "failed-precondition",
        "Pexels API nÃ¸gle ikke konfigureret. KÃ¸r: firebase functions:config:set pexels.api_key=\"DIN_NÃ˜GLE\" og redeploy."
      );
    }

    const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
    const pexelsResp = await fetch(pexelsUrl, { headers: { Authorization: pexelsKey } });

    if (!pexelsResp.ok) {
      const errText = await pexelsResp.text().catch(() => "");
      throw new HttpsError("internal", `Pexels API fejlede: ${pexelsResp.status}. ${errText.slice(0, 200)}`);
    }

    const pexelsData = await pexelsResp.json();

    const photos = (pexelsData.photos || [])
      .map(p => ({
        id: String(p.id),
        url: p.src?.large2x || p.src?.large || p.src?.original || "",
        thumbUrl: p.src?.medium || p.src?.small || "",
        width: p.width || 0,
        height: p.height || 0,
        photographer: sanitizeString(p.photographer || "", 120),
        photographerUrl: sanitizeString(p.photographer_url || "", 300),
        source: "pexels",
        sourceUrl: sanitizeString(p.url || "", 300),
        alt: sanitizeString(p.alt || query, 200),
        _raw: p
      }))
      .filter(p => p.url)
      .sort((a, b) => scoreStockPhoto(b._raw) - scoreStockPhoto(a._raw))
      .map(({ _raw, ...rest }) => rest);

    return { photos, cloudName };
  }
);

api.saveRestaurantHeroImage = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at gemme billede.");
    }

    const data = request.data;
    const companyId = sanitizeString(data?.companyId || "", 120);
    const locationId = sanitizeString(data?.locationId || "", 120);
    const url = sanitizeString(data?.url || "", 1000);

    if (!companyId || !locationId || !url) {
      throw new HttpsError("invalid-argument", "companyId, locationId og url er pÃ¥krÃ¦vet.");
    }

    const docId = `${companyId}__${locationId}__hero_${Date.now()}`;
    await db.collection("seo_hero_images").doc(docId).set({
      companyId,
      locationId,
      url,
      thumbUrl: sanitizeString(data?.thumbUrl || "", 1000),
      enhancedUrl: sanitizeString(data?.enhancedUrl || "", 2000),
      category: sanitizeString(data?.category || "", 80),
      style: sanitizeString(data?.style || "", 80),
      source: sanitizeString(data?.source || "pexels", 40),
      sourceUrl: sanitizeString(data?.sourceUrl || "", 400),
      photographer: sanitizeString(data?.photographer || "", 120),
      photographerUrl: sanitizeString(data?.photographerUrl || "", 400),
      alt: sanitizeString(data?.alt || "", 200),
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      isActive: true
    });

    return { ok: true, docId };
  }
);

api.enhanceAndUploadRestaurantImage = onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT"], region: "us-central1" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Log ind for at behandle billeder.");
    }

    const data = request.data;
    const imageUrl = sanitizeString(data?.url || "", 2000);
    const style = sanitizeString(data?.style || "warm", 40);
    const companyId = sanitizeString(data?.companyId || "", 120);
    const locationId = sanitizeString(data?.locationId || "", 120);
    const category = sanitizeString(data?.category || "", 80);
    const thumbUrl = sanitizeString(data?.thumbUrl || "", 1000);
    const source = sanitizeString(data?.source || "pexels", 40);
    const sourceUrl = sanitizeString(data?.sourceUrl || "", 400);
    const photographer = sanitizeString(data?.photographer || "", 120);
    const photographerUrl = sanitizeString(data?.photographerUrl || "", 400);
    const alt = sanitizeString(data?.alt || "", 200);

    if (!imageUrl || !companyId || !locationId) {
      throw new HttpsError("invalid-argument", "url, companyId og locationId er pÃ¥krÃ¦vet.");
    }

    const SEO_HERO_TRANSFORMS = {
      warm:   "e_improve,e_vibrance:35,e_sharpen,ar_16:9,c_fill,w_1600,q_auto,f_auto",
      nordic: "e_improve,e_brightness:8,e_sharpen,ar_16:9,c_fill,w_1600,q_auto,f_auto",
      dark:   "e_improve,e_brightness:-25,e_contrast:25,ar_16:9,c_fill,w_1600,q_auto,f_auto",
      street: "e_improve,e_vibrance:55,e_sharpen:80,ar_16:9,c_fill,w_1600,q_auto,f_auto",
      clean:  "e_improve,e_sharpen,ar_16:9,c_fill,w_1600,q_auto,f_auto"
    };

    let config = {};
    try { config = JSON.parse(process.env.FUNCTIONS_CONFIG_EXPORT || "{}"); } catch (_) {}
    const cloudName = config?.cloudinary?.cloud_name || process.env.CLOUDINARY_CLOUD_NAME || "";
    const apiKey = config?.cloudinary?.api_key || process.env.CLOUDINARY_API_KEY || "";
    const apiSecret = config?.cloudinary?.api_secret || process.env.CLOUDINARY_API_SECRET || "";

    if (!cloudName || !apiKey || !apiSecret) {
      throw new HttpsError("failed-precondition", "Cloudinary er ikke konfigureret.");
    }

    const crypto = require("crypto");
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `madkontrol/${toAsciiSlug(companyId, 60)}/${toAsciiSlug(locationId, 60)}/seo_hero`;

    // Signature: sorted params excluding api_key, resource_type, file
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto.createHash("sha1").update(paramsToSign + apiSecret).digest("hex");

    let publicId = "";
    let originalCloudinaryUrl = imageUrl;
    let enhanced = false;

    try {
      const uploadParams = new URLSearchParams();
      uploadParams.append("file", imageUrl);
      uploadParams.append("folder", folder);
      uploadParams.append("timestamp", String(timestamp));
      uploadParams.append("api_key", apiKey);
      uploadParams.append("signature", signature);

      const uploadResp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: uploadParams.toString()
      });

      if (!uploadResp.ok) {
        const errText = await uploadResp.text().catch(() => "");
        throw new Error(`Cloudinary upload: ${uploadResp.status} â€” ${errText.slice(0, 200)}`);
      }

      const uploadResult = await uploadResp.json();
      publicId = uploadResult.public_id || "";
      originalCloudinaryUrl = uploadResult.secure_url || imageUrl;
      enhanced = true;
    } catch (uploadErr) {
      console.error("[enhanceAndUploadRestaurantImage] Upload fejlede, bruger original:", uploadErr.message);
    }

    const transforms = SEO_HERO_TRANSFORMS[style] || SEO_HERO_TRANSFORMS.warm;
    const enhancedUrl = (enhanced && publicId)
      ? `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`
      : imageUrl;

    const docId = `${companyId}__${locationId}__hero_${Date.now()}`;
    await db.collection("seo_hero_images").doc(docId).set({
      companyId, locationId,
      url: originalCloudinaryUrl,
      thumbUrl, enhancedUrl: enhanced ? enhancedUrl : "",
      category, style, source, sourceUrl, photographer, photographerUrl, alt,
      publicId, cloudName, enhanced,
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      isActive: true
    });

    // Push hero image to any already-published websites for this location
    try {
      const sitesSnap = await db.collection("websites")
        .where("companyId", "==", companyId)
        .where("locationId", "==", locationId)
        .where("status", "==", "published")
        .limit(5)
        .get();
      if (!sitesSnap.empty) {
        const siteBatch = db.batch();
        sitesSnap.docs.forEach(d => {
          siteBatch.set(d.ref, {
            heroImageUrl: enhanced ? enhancedUrl : imageUrl,
            heroThumbUrl: thumbUrl,
            heroImageStyle: style,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        });
        await siteBatch.commit();
      }
    } catch (siteErr) {
      console.warn("[enhanceAndUpload] Kunne ikke opdatere websites:", siteErr.message);
    }

    return { ok: true, docId, url: originalCloudinaryUrl, enhancedUrl, enhanced };
  }
);

  return api;
};
