const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "../../serviceAccountKey.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  console.log("Seeder control point templates...");

  const templates = [
    {
      id: "cp_cooler_temp",
      code: "cooler_temp_check",
      title: "Temperaturkontrol i køl",
      areaType: "walk_in_cooler",
      category: "temperature",
      controlType: "temperature",
      frequency: "daily",
      limitType: "max",
      limitValue: "5",
      limitUnit: "C",
      isCritical: true,
      requiresEvidence: false,
      description: "Kontroller at temperaturen i kølerummet er inden for grænsen.",
      instruction: "Mål og registrer aktuel temperatur.",
      deviationPrompt: "Beskriv hvad der blev gjort ved for høj temperatur.",
      guideTitle: "Guide til temperaturkontrol i køl",
      guideIntro: "Kontroller at kølerummet holder korrekt temperatur, og at varer opbevares sikkert.",
      guideAreas: [
        "Se på display eller mål med termometer",
        "Tjek at døren lukker korrekt",
        "Vurder om varer står så luften kan cirkulere"
      ],
      guideSteps: [
        "Aflæs eller mål temperaturen",
        "Indtast temperaturen i systemet",
        "Bekræft om værdien er inden for grænsen"
      ],
      guideApproval: [
        "Temperaturen er maks 5°C",
        "Der er ingen tegn på optøning eller temperaturfejl",
        "Varerne står forsvarligt i kølet"
      ],
      guideIfNotOk: [
        "Flyt varer til andet godkendt køl hvis nødvendigt",
        "Giv besked til ansvarlig med det samme",
        "Registrer afvigelse og beskriv handling"
      ],
      isActive: true,
      sortOrder: 10,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "cp_freezer_temp",
      code: "freezer_temp_check",
      title: "Temperaturkontrol i fryser",
      areaType: "walk_in_freezer",
      category: "temperature",
      controlType: "temperature",
      frequency: "daily",
      limitType: "max",
      limitValue: "-18",
      limitUnit: "C",
      isCritical: true,
      requiresEvidence: false,
      description: "Kontroller at fryserummet holder korrekt temperatur.",
      instruction: "Mål og registrer aktuel temperatur i fryserum.",
      deviationPrompt: "Beskriv hvad der blev gjort ved for høj frysetemperatur.",
      guideTitle: "Guide til temperaturkontrol i fryser",
      guideIntro: "Kontroller at fryseren holder frostvarer sikkert nedfrosne.",
      guideAreas: [
        "Aflæs display eller mål med termometer",
        "Se efter tegn på optøning",
        "Tjek om døren lukker tæt"
      ],
      guideSteps: [
        "Mål eller aflæs temperaturen",
        "Indtast værdien i systemet",
        "Vurder om temperaturen er korrekt"
      ],
      guideApproval: [
        "Temperaturen er maks -18°C",
        "Varer er gennemfrosne",
        "Ingen unormal isdannelse eller optøning"
      ],
      guideIfNotOk: [
        "Flyt følsomme varer hvis nødvendigt",
        "Informer ansvarlig straks",
        "Registrer afvigelse og handling"
      ],
      isActive: true,
      sortOrder: 20,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "cp_open_can",
      code: "open_can_check",
      title: "Kontrol for åbne dåser i køl",
      areaType: "walk_in_cooler",
      category: "storage",
      controlType: "checklist",
      frequency: "daily",
      limitType: "boolean",
      limitValue: "true",
      limitUnit: "",
      isCritical: false,
      requiresEvidence: false,
      description: "Tjek at der ikke står åbne dåser i køl.",
      instruction: "Gennemgå synlige varer og bekræft at åbne dåser ikke opbevares.",
      deviationPrompt: "Beskriv hvilke varer der blev flyttet til egnet beholder.",
      guideTitle: "Guide til åbne dåser i køl",
      guideIntro: "Åbnede dåser må ikke stå direkte i køleskab efter åbning.",
      guideAreas: [
        "Se efter åbne konservesdåser i køl",
        "Tjek om indhold er flyttet til beholder"
      ],
      guideSteps: [
        "Gennemgå alle synlige dåsevarer",
        "Bekræft at åbne dåser er fjernet",
        "Sørg for at indhold er overført til egnet beholder"
      ],
      guideApproval: [
        "Ingen åbne dåser står i køl",
        "Indhold er flyttet til godkendt beholder"
      ],
      guideIfNotOk: [
        "Flyt straks indholdet til beholder med låg",
        "Smid varen ud hvis kvalitet er tvivlsom",
        "Registrer afvigelse hvis nødvendigt"
      ],
      isActive: true,
      sortOrder: 30,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "cp_utensil",
      code: "utensil_check",
      title: "Kontrol for redskaber i opbevaret mad",
      areaType: "walk_in_cooler",
      category: "storage",
      controlType: "checklist",
      frequency: "daily",
      limitType: "boolean",
      limitValue: "true",
      limitUnit: "",
      isCritical: false,
      requiresEvidence: false,
      description: "Tjek at skeer og redskaber ikke ligger i madbeholdere.",
      instruction: "Gennemgå beholdere og opbevarede fødevarer i køl.",
      deviationPrompt: "Beskriv hvilke redskaber der blev fjernet.",
      guideTitle: "Guide til redskaber i maden",
      guideIntro: "Redskaber må ikke efterlades i beholdere med mad under opbevaring.",
      guideAreas: [
        "Se i åbne beholdere og bakker",
        "Kontroller om skeer eller tænger ligger i maden"
      ],
      guideSteps: [
        "Gennemgå køl og beholdere",
        "Fjern redskaber hvis de ligger i maden",
        "Opbevar redskaber separat"
      ],
      guideApproval: [
        "Ingen redskaber ligger i opbevaret mad",
        "Redskaber opbevares rent og separat"
      ],
      guideIfNotOk: [
        "Fjern redskabet straks",
        "Skift eller rengør redskabet hvis nødvendigt",
        "Registrer afvigelse hvis der er risiko for forurening"
      ],
      isActive: true,
      sortOrder: 40,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "cp_food_cover",
      code: "food_cover_check",
      title: "Kontrol af låg og tildækning",
      areaType: "walk_in_cooler",
      category: "storage",
      controlType: "checklist",
      frequency: "daily",
      limitType: "boolean",
      limitValue: "true",
      limitUnit: "",
      isCritical: false,
      requiresEvidence: false,
      description: "Tjek at fødevarer er tildækkede.",
      instruction: "Gennemgå beholdere og bakker i køl.",
      deviationPrompt: "Beskriv hvilke varer der blev dækket til.",
      guideTitle: "Guide til låg og tildækning",
      guideIntro: "Fødevarer i køl skal være tildækkede eller stå i lukkede beholdere.",
      guideAreas: [
        "Tjek bakker, skåle og beholdere",
        "Se efter varer uden låg eller afdækning"
      ],
      guideSteps: [
        "Gennemgå opbevarede varer i køl",
        "Bekræft at alt er tildækket",
        "Dæk varer til hvis noget mangler"
      ],
      guideApproval: [
        "Fødevarer er tildækkede",
        "Ingen åbne varer står ubeskyttet i køl"
      ],
      guideIfNotOk: [
        "Sæt låg på eller dæk varen til",
        "Vurder om varen stadig er brugbar",
        "Registrer afvigelse hvis der er risiko"
      ],
      isActive: true,
      sortOrder: 50,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "cp_label",
      code: "label_check",
      title: "Kontrol af datomærkning",
      areaType: "walk_in_cooler",
      category: "labeling",
      controlType: "checklist",
      frequency: "daily",
      limitType: "boolean",
      limitValue: "true",
      limitUnit: "",
      isCritical: false,
      requiresEvidence: false,
      description: "Tjek at åbnet eller klargjort mad er datomærket.",
      instruction: "Gennemgå beholdere og mærkninger.",
      deviationPrompt: "Beskriv hvilke varer der blev mærket.",
      guideTitle: "Guide til datomærkning",
      guideIntro: "Åbnede eller klargjorte fødevarer skal være mærket tydeligt med dato.",
      guideAreas: [
        "Se efter beholdere uden dato",
        "Tjek at mærkningen kan læses"
      ],
      guideSteps: [
        "Gennemgå kølevarer og beholdere",
        "Bekræft at dato fremgår tydeligt",
        "Mærk varer der mangler dato"
      ],
      guideApproval: [
        "Alle relevante varer er mærket med dato",
        "Mærkningen er tydelig og læsbar"
      ],
      guideIfNotOk: [
        "Mærk varen straks med korrekt dato",
        "Vurder om varen kan identificeres sikkert",
        "Registrer afvigelse hvis sporbarhed mangler"
      ],
      isActive: true,
      sortOrder: 60,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "cp_separation",
      code: "separation_check",
      title: "Kontrol af adskillelse mellem rå og færdige varer",
      areaType: "walk_in_cooler",
      category: "workflow",
      controlType: "checklist",
      frequency: "daily",
      limitType: "boolean",
      limitValue: "true",
      limitUnit: "",
      isCritical: true,
      requiresEvidence: false,
      description: "Tjek at rå og spiseklare varer er opbevaret adskilt.",
      instruction: "Kontroller placering og opbevaringsorden i køl.",
      deviationPrompt: "Beskriv hvilke varer der blev flyttet for korrekt adskillelse.",
      guideTitle: "Guide til adskillelse af rå og færdige varer",
      guideIntro: "Rå varer må ikke kunne forurene færdige eller spiseklare varer.",
      guideAreas: [
        "Se hvor rå kød- og fiskevarer står",
        "Tjek om færdigvarer står beskyttet og adskilt"
      ],
      guideSteps: [
        "Gennemgå køleskabets placering af varer",
        "Bekræft at rå varer står nederst eller separat",
        "Flyt varer hvis placeringen er forkert"
      ],
      guideApproval: [
        "Rå og spiseklare varer er tydeligt adskilt",
        "Ingen risiko for dryp eller krydskontaminering"
      ],
      guideIfNotOk: [
        "Flyt varerne straks til korrekt placering",
        "Rengør berørte områder ved behov",
        "Registrer afvigelse hvis der var risiko for forurening"
      ],
      isActive: true,
      sortOrder: 70,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "cp_cleaning",
      code: "cleaning_check",
      title: "Visuel rengøringskontrol",
      areaType: "hot_production",
      category: "cleaning",
      controlType: "visual",
      frequency: "daily",
      limitType: "boolean",
      limitValue: "true",
      limitUnit: "",
      isCritical: false,
      requiresEvidence: false,
      description: "Tjek at arbejdsområde og udstyr fremstår rent.",
      instruction: "Gennemgå borde, maskiner, redskaber og kontaktflader.",
      deviationPrompt: "Beskriv hvad der blev rengjort eller taget ud af drift.",
      guideTitle: "Guide til visuel rengøringskontrol",
      guideIntro: "Kontroller at arbejdsområdet fremstår rent og klar til sikker produktion.",
      guideAreas: [
        "Se på borde, maskiner og redskaber",
        "Tjek for madrester, fedt og snavs",
        "Vurder om området er klar til brug"
      ],
      guideSteps: [
        "Gennemgå området visuelt",
        "Bekræft at kontaktflader er rene",
        "Tag udstyr ud af drift hvis det ikke er rent"
      ],
      guideApproval: [
        "Området fremstår rent",
        "Ingen synlige madrester eller belægninger",
        "Udstyr er klar til sikker brug"
      ],
      guideIfNotOk: [
        "Rengør området med det samme",
        "Tag udstyr ud af brug hvis nødvendigt",
        "Registrer afvigelse hvis rengøring ikke kan gennemføres straks"
      ],
      isActive: true,
      sortOrder: 80,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "cp_handwash",
      code: "handwash_check",
      title: "Kontrol af håndvask",
      areaType: "handwash_station",
      category: "hygiene",
      controlType: "checklist",
      frequency: "daily",
      limitType: "boolean",
      limitValue: "true",
      limitUnit: "",
      isCritical: true,
      requiresEvidence: false,
      description: "Tjek at håndvask har vand, sæbe og papir.",
      instruction: "Kontroller funktion og udstyr ved håndvask.",
      deviationPrompt: "Beskriv hvad der blev fyldt op eller repareret.",
      guideTitle: "Guide til håndvaskekontrol",
      guideIntro: "Håndvask skal være klar til brug og korrekt udstyret hele dagen.",
      guideAreas: [
        "Tjek for varmt og koldt vand",
        "Tjek om der er sæbe",
        "Tjek om der er papir eller engangshåndklæder"
      ],
      guideSteps: [
        "Test at håndvasken virker",
        "Kontroller at sæbe og papir er fyldt op",
        "Bekræft at vasken er tilgængelig"
      ],
      guideApproval: [
        "Vand fungerer",
        "Sæbe er til stede",
        "Papir eller engangshåndklæder er til stede"
      ],
      guideIfNotOk: [
        "Fyld straks op med sæbe eller papir",
        "Meld fejl hvis vand eller vask ikke virker",
        "Registrer afvigelse hvis problemet ikke løses med det samme"
      ],
      isActive: true,
      sortOrder: 90,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "cp_receiving_temp",
      code: "receiving_temp_check",
      title: "Temperaturkontrol ved varemodtagelse",
      areaType: "receiving_area",
      category: "receiving",
      controlType: "temperature",
      frequency: "per_batch",
      limitType: "none",
      limitValue: "",
      limitUnit: "",
      isCritical: true,
      requiresEvidence: false,
      description: "Kontroller temperatur på relevante varer ved modtagelse.",
      instruction: "Mål temperatur på udvalgte køle- og frostvarer ved modtagelse.",
      deviationPrompt: "Beskriv hvilke varer der blev afvist eller håndteret.",
      guideTitle: "Guide til temperaturkontrol ved varemodtagelse",
      guideIntro: "Ved modtagelse skal du kontrollere at køle- og frostvarer leveres ved korrekt temperatur.",
      guideAreas: [
        "Udvælg relevante køle- eller frostvarer",
        "Se efter tegn på temperaturbrud eller beskadiget emballage"
      ],
      guideSteps: [
        "Mål temperatur på varen eller ved leverancen",
        "Vurder om varen er inden for acceptabel grænse",
        "Registrer resultatet i systemet"
      ],
      guideApproval: [
        "Varen leveres ved korrekt temperatur",
        "Emballage er intakt",
        "Ingen tegn på optøning eller fejl"
      ],
      guideIfNotOk: [
        "Afvis varen hvis den ikke er forsvarlig",
        "Tag kontakt til leverandør eller ansvarlig",
        "Registrer afvigelse og beskriv hændelsen"
      ],
      isActive: true,
      sortOrder: 100,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const template of templates) {
    const { id, ...data } = template;

    await db.collection("control_point_templates")
      .doc(id)
      .set(data, { merge: true });

    console.log(`Oprettet control point template: ${id}`);
  }

  console.log("Control point templates seed færdig ✅");
}

run().catch((error) => {
  console.error("Fejl i importControlPointTemplates:", error);
});