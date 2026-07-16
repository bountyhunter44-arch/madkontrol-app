# AI-Analyse Upgrade: Gulv og Afløb Rengøring

**Dato:** 22. marts 2026, 18:55  
**Status:** ✅ DEPLOYED

---

## 🎯 Opgave

Opgradere AI-analysen for rengøring af gulv og afløb med:
1. **Specifik AI-instruks** for afløbskontrol
2. **Afvigelses-logik** ved fund af madrester
3. **Opdateret rutine-tekst** med klare procedurer

---

## ✅ Implementering

### 1. **Specifik AI Vision Prompt (Afløb)**

**Lokation:** `d:\madkontrol-app\functions\index.js` - Linje 3594-3613

```javascript
// SPECIFIC PROMPT FOR FLOOR DRAIN CLEANING
if (scopedItemLower.includes("gulv") || scopedItemLower.includes("afløb") || 
    scopedItemLower.includes("rist") || scopedItemLower.includes("drain") || 
    scopedItemLower.includes("floor")) {
  return [
    "Du er en fødevareinspektør. Analysér dette billede af et gulvafløb eller en rist med KRITISK blik.",
    "Tjek SPECIFIKT for:",
    "1. ORGANISK MATERIALE: Er der synlige madrester, fedtslam eller snavs i risten eller under koppen?",
    "2. VANDLÅS: Er der vand i vandlåsen (for at undgå lugtgener)?",
    "3. RIST: Sidder risten korrekt på plads?",
    "Hvis du finder MADRESTER i afløbet:",
    "- Dit svar skal STARTE med '[AFVIGELSE]'",
    "- Beskriv: 'Madrester fundet i afløb. Risiko for bakterievækst og skadedyr.'",
    "- Sæt handling_udfort til false",
    "Hvis afløbet er RENT:",
    "- Beskriv: 'Afløb rengjort. Ingen madrester. Rist korrekt placeret.'",
    "- Sæt handling_udfort til true",
    commonRules,
    "Brug kategori: egenkontrol.",
    "Husk: Start beskrivelse med '[AFVIGELSE]' hvis du finder madrester, fedt eller snavs i afløbet."
  ].join(" ");
}
```

**Trigger-ord:**
- `gulv`
- `afløb`
- `rist`
- `drain`
- `floor`

**AI tjekker:**
1. ✅ **Organisk materiale** - Madrester, fedtslam, snavs
2. ✅ **Vandlås** - Vand til lugtforebyggelse
3. ✅ **Rist** - Korrekt placering

---

### 2. **Afvigelses-logik**

**Automatisk markering:**

```javascript
// Hvis AI finder madrester:
{
  handling_udfort: false,
  beskrivelse: "[AFVIGELSE] Madrester fundet i afløb. Risiko for bakterievækst og skadedyr.",
  confidence: 0.85,
  kategori: "egenkontrol",
  risikoflag: ["madrester_i_afløb", "bakterievækst_risiko", "skadedyr_risiko"]
}

// Hvis afløbet er rent:
{
  handling_udfort: true,
  beskrivelse: "Afløb rengjort. Ingen madrester. Rist korrekt placeret.",
  confidence: 0.90,
  kategori: "egenkontrol"
}
```

**Handling påkrævet ved afvigelse:**
1. Brugeren ser `[AFVIGELSE]` i beskrivelsen
2. System markerer opgaven som ikke udført
3. Brugeren skal:
   - Tømme risten
   - Rengøre afløbskoppen
   - Tage nyt "Efter-billede"

---

### 3. **Ny Rutine-skabelon**

**Lokation:** `d:\madkontrol-app\public\modules\egenkontrol\risikoanalyse.html` - Linje 1344-1367

```javascript
// Floor and drain cleaning - CRITICAL CONTROL
addTask(generated, {
    id: "floor-drain-cleaning-daily",
    title: "Rengøring af gulv og afløb",
    description: "Rengør gulv og riste. Tøm og afvask alle afløbskopper. Kontrollér at der ikke henligger madrester i riste eller afløb.",
    category: "rengøring",
    frequency: "daily",
    riskLevel: "high",
    controlPoint: "Gulv og afløb",
    formType: "check",
    requiresPhoto: true,  // KRÆVER BILLEDE
    fields: [
        { key: "floor", label: "Gulv rengjort", type: "checkbox", required: true },
        { key: "drains", label: "Afløbskopper tømt og afvasket", type: "checkbox", required: true },
        { key: "grates", label: "Riste rengjort - ingen madrester", type: "checkbox", required: true },
        { key: "waterTrap", label: "Vandlås kontrolleret", type: "checkbox", required: false },
        { key: "comment", label: "Kommentar", type: "textarea", required: false },
        { key: "deviationReason", label: "Årsag ved afvigelse", type: "textarea", required: false }
    ],
    alertRules: [
        { type: "boolean_false", field: "grates", severity: "critical", 
          message: "Madrester i afløb - risiko for bakterievækst og skadedyr" }
    ],
    sourceHazard: "Gulv og afløb"
});
```

**Rutine-detaljer:**
- **ID:** `floor-drain-cleaning-daily`
- **Frekvens:** Daglig
- **Risikoniveau:** Høj
- **Kræver foto:** ✅ Ja
- **Kritisk kontrol:** Ja

**Procedure-tekst:**
> "Rengør gulv og riste. Tøm og afvask alle afløbskopper. Kontrollér at der ikke henligger madrester i riste eller afløb."

---

## 🔬 AI-Analyse Flow

### Før-billede workflow:

```
1. Bruger tager foto af afløb
   ↓
2. Billede sendes til OpenAI Vision API
   ↓
3. AI analyserer med specifik prompt:
   - Tjekker for madrester
   - Tjekker vandlås
   - Tjekker rist-placering
   ↓
4a. RENT AFLØB:
    ✅ handling_udfort: true
    ✅ "Afløb rengjort. Ingen madrester."
    ↓
    Opgave kan godkendes
    
4b. MADRESTER FUNDET:
    ❌ handling_udfort: false
    ❌ "[AFVIGELSE] Madrester fundet i afløb..."
    ↓
    Bruger skal rengøre og tage nyt billede
```

### Efter-billede workflow:

```
1. Bruger rengør afløb
   ↓
2. Tager nyt "Efter-billede"
   ↓
3. AI analyserer igen
   ↓
4. Hvis rent:
   ✅ Opgave godkendes
   ✅ Dokumentation komplet
```

---

## 📊 AI Response Format

**JSON struktur fra OpenAI:**

```json
{
  "handling_udfort": false,
  "beskrivelse": "[AFVIGELSE] Madrester fundet i afløb. Risiko for bakterievækst og skadedyr.",
  "confidence": 0.85,
  "kategori": "egenkontrol",
  "image_clarity": "clear",
  "observationer": [
    "Synlige madrester i rist",
    "Fedtslam i afløbskoppen",
    "Rist korrekt placeret"
  ],
  "commercial": {
    "cleanliness_score": 45,
    "filter_tomt": null
  },
  "risikoflag": [
    "madrester_i_afløb",
    "bakterievækst_risiko",
    "skadedyr_risiko"
  ]
}
```

**Nøglefelter:**
- `handling_udfort`: `false` hvis madrester, `true` hvis rent
- `beskrivelse`: Starter med `[AFVIGELSE]` hvis problem
- `confidence`: 0-1 (typisk 0.8-0.95 for klare billeder)
- `observationer`: Liste af fund
- `risikoflag`: Specifikke risici

---

## 🧪 Test Instruktioner

### Test 1: Rent afløb

**Fremgangsmåde:**
1. Gå til: `https://madkontrollen.web.app/modules/egenkontrol/risikoanalyse.html`
2. Generér task-skabeloner
3. Find rutinen: "Rengøring af gulv og afløb"
4. Tag foto af et **rent** afløb
5. Upload billedet

**Forventet resultat:**
```
✅ AI-forslag (85-95%)
"Afløb rengjort. Ingen madrester. Rist korrekt placeret."
```

### Test 2: Afløb med madrester

**Fremgangsmåde:**
1. Tag foto af afløb med **synlige madrester**
2. Upload billedet

**Forventet resultat:**
```
❌ AI-forslag (80-90%)
"[AFVIGELSE] Madrester fundet i afløb. Risiko for bakterievækst og skadedyr."

Handling påkrævet:
- Tøm risten
- Rengør afløbskoppen
- Tag nyt "Efter-billede"
```

### Test 3: Før/Efter workflow

**Fremgangsmåde:**
1. Tag "Før-billede" af snavset afløb
2. Se AI-afvigelse
3. Rengør afløbet fysisk
4. Tag "Efter-billede"
5. Se AI-godkendelse

**Forventet resultat:**
```
Før:  ❌ "[AFVIGELSE] Madrester fundet..."
Efter: ✅ "Afløb rengjort. Ingen madrester."
```

---

## 📁 Filer Opdateret

### Cloud Functions
**Fil:** `d:\madkontrol-app\functions\index.js`
- **Funktion:** `buildVisionPrompt()` - Linje 3527-3628
- **Ændring:** Tilføjet specifik prompt for gulv/afløb (linje 3594-3613)

### Task Templates
**Fil:** `d:\madkontrol-app\public\modules\egenkontrol\risikoanalyse.html`
- **Funktion:** `generateTasksFromRiskAnalysis()` - Linje 1344-1367
- **Ændring:** Tilføjet ny rutine `floor-drain-cleaning-daily`

---

## 🚀 Deployment

**Status:** ✅ DEPLOYED

**Kommando:**
```bash
firebase deploy --only "functions,hosting"
```

**Deployed:**
- ✅ Cloud Functions (analyzeCloudinaryAsset)
- ✅ Hosting (risikoanalyse.html)

**URL:** https://madkontrollen.web.app

**Deployment tid:** ~2 minutter

---

## 🔍 Tekniske Detaljer

### AI Model
- **Model:** `gpt-4o-mini`
- **Temperature:** 0.2 (lav = konsistent)
- **Max tokens:** 700
- **Vision:** Ja

### Trigger Detection
```javascript
const scopedItemLower = scopedItem.toLowerCase();

if (scopedItemLower.includes("gulv") || 
    scopedItemLower.includes("afløb") || 
    scopedItemLower.includes("rist") || 
    scopedItemLower.includes("drain") || 
    scopedItemLower.includes("floor")) {
  // Brug specifik afløbs-prompt
}
```

### Afvigelses-detektion
```javascript
const beskrivelse = parsed?.beskrivelse || "";
const isDeviation = beskrivelse.startsWith("[AFVIGELSE]");

if (isDeviation) {
  // Marker som ikke udført
  handling_udfort = false;
  // Tilføj risikoflag
  risikoflag.push("madrester_i_afløb");
}
```

---

## ✅ Faglig Korrekthed

**Fødevaresikkerhed:**
- ✅ Fokus på **madrester** (bakterievækst)
- ✅ Tjek af **vandlås** (lugtgener)
- ✅ Kontrol af **rist-placering** (sikkerhed)

**HACCP-kompatibel:**
- ✅ Kritisk kontrolpunkt (CCP)
- ✅ Dokumentation med foto
- ✅ Afvigelses-håndtering
- ✅ Korrektiv handling (genrengøring)

**Skadedyrsbekæmpelse:**
- ✅ Fjernelse af madrester
- ✅ Forebyggelse af tiltrækningspunkter
- ✅ Daglig kontrol

---

## 📝 Næste Skridt

**Anbefalinger:**

1. **Test i produktion**
   - Lad køkkenpersonale teste rutinen
   - Indsaml feedback på AI-nøjagtighed

2. **Juster AI-prompt hvis nødvendigt**
   - Hvis AI overser madrester → Skærp prompt
   - Hvis AI er for streng → Juster tærskel

3. **Udvid til andre kritiske punkter**
   - Emhættefiltre
   - Kølediske
   - Opvaskemaskiner

4. **Træning af personale**
   - Vis eksempler på "rent" vs. "afvigelse"
   - Forklar før/efter workflow

---

## 🎓 Bruger-guide

**Sådan bruger du den nye funktion:**

1. **Gå til Rutiner**
   ```
   https://madkontrollen.web.app/modules/egenkontrol/rutiner.html
   ```

2. **Find "Rengøring af gulv og afløb"**
   - Daglig rutine
   - Kræver foto

3. **Tag foto af afløb**
   - Sørg for god belysning
   - Vis risten tydeligt
   - Inkluder afløbskoppen hvis muligt

4. **Upload og vent på AI-analyse**
   - AI analyserer på ~3-5 sekunder
   - Se resultat i preview

5. **Hvis afvigelse:**
   - Læs AI-beskrivelse
   - Rengør afløbet
   - Tag nyt "Efter-billede"

6. **Godkend opgave**
   - Kun når AI siger "rent"
   - Dokumentation gemt automatisk

---

**Implementeret af:** Cascade AI  
**Dato:** 22. marts 2026, 18:55  
**Version:** 3.0.0 - AI Gulv/Afløb Upgrade
