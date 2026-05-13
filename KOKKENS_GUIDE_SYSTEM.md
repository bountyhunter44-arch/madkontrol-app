# Kokkens Guide System - Harmoni mellem AI og Faglig Virkelighed

**Dato:** 22. marts 2026, 19:25  
**Status:** ✅ DEPLOYED

---

## 🎯 Formål

Skabe harmoni mellem AI'ens analyse og den faglige virkelighed ved at:
1. Give medarbejdere faglig vejledning direkte på rutine-kortene
2. Justere AI'ens "dømmekraft" til at være mentor-agtig, ikke politibetjent-agtig
3. Give kokke mulighed for at overstyre AI med faglig begrundelse

**Filosofi:** Systemet skal føles som en læremester, ikke en politibetjent.

---

## ✅ Implementering

### 1. **Kokkens Guide - Info-ikon på alle kort**

**Lokation:** `d:\madkontrol-app\public\modules\egenkontrol\rutiner.html` - Linje 1668-1688

**Før:**
```html
<button class="task-guide-toggle">
    <span>Se guide</span>
</button>
```

**Nu:**
```html
<button class="task-guide-toggle" title="Kokkens Guide - Klik for faglig vejledning">
    <svg width="20" height="20" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
    <span>Kokkens Guide</span>
</button>
```

**Fordele:**
- ✅ Info-ikon (ⓘ) er universelt genkendeligt
- ✅ "Kokkens Guide" signalerer hjælp, ikke kontrol
- ✅ Tooltip forklarer formålet

---

### 2. **Gulv/Afløb Guide - Specifik faglig vejledning**

**Lokation:** `d:\madkontrol-app\public\modules\egenkontrol\rutiner.html` - Linje 1559-1589

```javascript
// FLOOR AND DRAIN CLEANING GUIDE
const isFloorDrain = sourceText.includes("gulv") || sourceText.includes("afløb") || 
                     sourceText.includes("rist") || sourceText.includes("drain") || 
                     sourceText.includes("floor");

if (isFloorDrain) {
    return {
        title: "Gulv og afløb - kritisk rengøringskontrol",
        intro: "Afløb er et kritisk punkt for hygiejne. Madrester tiltrækker skadedyr og bakterier.",
        areas: [
            "Kontrollér risten: Ingen madrester, fedtslam eller synligt snavs.",
            "Kontrollér vandlåsen: Der skal være vand i vandlåsen for at undgå lugtgener.",
            "Kontrollér rist-placering: Risten skal sidde korrekt på plads og ikke være løs."
        ],
        steps: [
            "Løft risten op og tøm afløbskoppen for madrester og snavs.",
            "Afvask risten og afløbskoppen grundigt med varmt vand og rengøringsmiddel.",
            "Kontrollér at der er vand i vandlåsen, placer risten korrekt og tag dokumentationsfoto."
        ],
        approval: [
            "Ingen synlige madrester i rist eller afløbskoppe.",
            "Vandlås indeholder vand (forebygger lugt og skadedyr).",
            "Rist er korrekt placeret og gulvområdet er rent."
        ],
        ifNotOk: [
            "Hvis AI finder madrester: Tøm og rengør straks, tag nyt 'Efter-billede'.",
            "Hvis vandlås er tom: Fyld vand i vandlåsen (ca. 1 dl).",
            "Hvis gentagne problemer: Tjek om afløb er tilstoppet - kontakt tekniker."
        ]
    };
}
```

**Guide-struktur:**
- **Intro:** Forklarer HVORFOR det er vigtigt
- **Hvad skal kontrolleres:** Konkrete tjekpunkter
- **Sådan gør du:** Step-by-step instruktion
- **Hvornår er det godkendt:** Klare godkendelseskriterier
- **Hvis det ikke er ok:** Konkrete handlinger ved afvigelse

---

### 3. **AI Mentor-Prompt - Forklarende feedback**

**Lokation:** `d:\madkontrol-app\functions\index.js` - Linje 3594-3638

**Før (Politibetjent-stil):**
```javascript
"Du er en fødevareinspektør. Analysér med kritisk blik."
"Hvis du finder fejl, skal dit svar STARTE med '[AFVIGELSE]'."
```

**Nu (Mentor-stil):**
```javascript
"Du er en erfaren køkkenchef-mentor. Analysér med FAGLIGT blik."
"Vær STRENG med hygiejne (madrester, temperatur), men REALISTISK med driftsslid (misfarvning, slid på pakninger)."

"Hvis du finder HYGIEJNE-FEJL (madrester, fedt, temperaturafvigelser):"
"- Dit svar skal STARTE med '[AFVIGELSE]'"
"- Forklar HVORFOR det er et problem (f.eks. 'Madrester tiltrækker skadedyr', 'Temperatur >8°C giver bakterievækst', 'Fedt på pakninger skaber biofilm')"
"- Vær SPECIFIK om risikoen, ikke bare 'beskidt'"

"Hvis du ser NORMAL SLID (misfarvning, patina, slid på overflader):"
"- Beskriv: 'Udstyr rengjort. Misfarvning/slid er normalt driftsslid, ikke hygiejnerisiko.'"
"- Sæt handling_udfort til true"

"Husk: Forklar HVORFOR problemer er farlige. Vær realistisk om forskellen på hygiejnerisiko vs. normal slid. Du er en læremester, ikke en politibetjent."
```

**Nøgle-ændringer:**
1. ✅ **Forklarende feedback:** "HVORFOR" i stedet for bare "hvad"
2. ✅ **Realistisk vurdering:** Skelner mellem hygiejnerisiko og normal slid
3. ✅ **Specifik om risici:** "Tiltrækker skadedyr" i stedet for "beskidt"
4. ✅ **Mentor-tone:** "Læremester, ikke politibetjent"

---

### 4. **Manuel Override - Faglig begrundelse**

**Lokation:** `d:\madkontrol-app\public\modules\egenkontrol\rutiner.html` - Linje 3131-3261

**UI-flow:**

```
AI finder afvigelse
    ↓
🚨 AFVIGELSE FUNDET
"Madrester fundet i afløb..."
    ↓
[🧹 Rengør og tag nyt foto]  [👨‍🍳 Overstyr med faglig begrundelse]
    ↓
Klik "Overstyr"
    ↓
Textarea vises:
"Forklar hvorfor dette er fagligt acceptabelt
(f.eks. 'Misfarvning i stål, ikke snavs' eller 
'Normal driftsslid på pakning, ikke hygiejnerisiko')"
    ↓
[✓ Bekræft faglig vurdering]  [Annuller]
    ↓
Gemmes til database:
{
    aiOverride: {
        overridden: true,
        justification: "Misfarvning i stål, ikke snavs",
        originalAiResult: "Madrester fundet...",
        overriddenBy: "user_123",
        overriddenByName: "Peter Hansen",
        overriddenAt: timestamp
    }
}
    ↓
👨‍🍳 FAGLIG VURDERING GODKENDT
"AI's vurdering: Madrester fundet..."
"Faglig begrundelse: Misfarvning i stål, ikke snavs"
"Overstyrret af: Peter Hansen • 22-03-2026 19:15"
```

**Kode-eksempel:**

```javascript
// MANUAL OVERRIDE FUNCTIONALITY
const showOverrideBtn = deviationCard.querySelector(`[data-show-override="${instanceId}"]`);
const overrideForm = deviationCard.querySelector(`[data-override-form="${instanceId}"]`);
const confirmOverrideBtn = deviationCard.querySelector(`[data-confirm-override="${instanceId}"]`);
const justificationTextarea = deviationCard.querySelector(`[data-override-justification="${instanceId}"]`);

if (confirmOverrideBtn && justificationTextarea) {
    confirmOverrideBtn.addEventListener("click", async () => {
        const justification = justificationTextarea.value.trim();
        if (!justification) {
            alert("Du skal skrive en faglig begrundelse for at overstyre AI'ens vurdering.");
            return;
        }

        // Save override to task instance
        await setDoc(doc(db, "task_instances", instanceId), {
            aiOverride: {
                overridden: true,
                justification: justification,
                originalAiResult: aiResult.beskrivelse || "",
                overriddenBy: SETTINGS.createdBy,
                overriddenByName: SETTINGS.currentUserName || "Ukendt",
                overriddenAt: serverTimestamp(),
                overriddenAtClient: new Date().toISOString()
            },
            professionalOverride: true,
            overrideJustification: justification
        }, { merge: true });

        // Update media asset with override
        if (mediaAssetRef) {
            await updateDoc(mediaAssetRef, {
                professionalOverride: true,
                overrideJustification: justification,
                overriddenBy: SETTINGS.createdBy,
                overriddenAt: serverTimestamp()
            });
        }

        // Show success message
        deviationCard.innerHTML = `
            <div style="display:flex;gap:10px;">
                <span style="font-size:28px;">👨‍🍳</span>
                <div>
                    <div style="font-weight:800;color:#28a745;">FAGLIG VURDERING GODKENDT</div>
                    <div style="font-size:12px;color:#155724;">
                        <strong>AI's vurdering:</strong> ${aiResult.beskrivelse}<br>
                        <strong>Faglig begrundelse:</strong> ${justification}
                    </div>
                    <div style="font-size:11px;color:#6c757d;">
                        Overstyrret af: ${SETTINGS.currentUserName} • ${new Date().toLocaleString("da-DK")}
                    </div>
                </div>
            </div>
        `;
    });
}
```

**Database-struktur:**

```javascript
// task_instances/{instanceId}
{
    aiOverride: {
        overridden: true,
        justification: "Misfarvning i stål, ikke snavs",
        originalAiResult: "[AFVIGELSE] Madrester fundet i afløb...",
        overriddenBy: "user_abc123",
        overriddenByName: "Peter Hansen",
        overriddenAt: Timestamp,
        overriddenAtClient: "2026-03-22T19:15:00.000Z"
    },
    professionalOverride: true,
    overrideJustification: "Misfarvning i stål, ikke snavs"
}

// media_assets/{assetId}
{
    professionalOverride: true,
    overrideJustification: "Misfarvning i stål, ikke snavs",
    overriddenBy: "user_abc123",
    overriddenAt: Timestamp
}
```

---

## 📊 AI-Prompt Sammenligning

### Gulv/Afløb - Før vs. Nu

**Før (Streng inspektør):**
```
"Du er en fødevareinspektør. Analysér med KRITISK blik."
"Hvis du finder MADRESTER: Dit svar skal STARTE med '[AFVIGELSE]'"
"Beskriv: 'Madrester fundet i afløb. Risiko for bakterievækst og skadedyr.'"
```

**Nu (Erfaren mentor):**
```
"Du er en erfaren køkkenchef-mentor. Analysér med FAGLIGT blik."
"Vær STRENG med hygiejne, men REALISTISK med driftsslid."

"Hvis du finder MADRESTER:"
"- Forklar HVORFOR: 'Madrester fundet i afløb. Dette tiltrækker skadedyr (rotter, kakerlakker) og skaber bakterievækst (Salmonella, E. coli). Skal fjernes straks.'"

"Hvis afløbet er RENT, men har misfarvning/patina:"
"- Beskriv: 'Afløb rengjort. Ingen madrester. Misfarvning i stål er normalt driftsslid, ikke hygiejnerisiko.'"
```

**Forskelle:**
| Før | Nu |
|-----|-----|
| "Kritisk blik" | "Fagligt blik" |
| "Madrester fundet" | "Madrester tiltrækker skadedyr (rotter, kakerlakker)" |
| Ingen skelnen mellem slid og snavs | "Misfarvning er normalt driftsslid, ikke hygiejnerisiko" |
| Politibetjent-tone | Mentor-tone |

---

## 🧪 Test Scenarier

### Scenario 1: Rent afløb med patina

**AI's respons:**
```json
{
  "handling_udfort": true,
  "beskrivelse": "Afløb rengjort. Ingen madrester. Misfarvning i stål er normalt driftsslid, ikke hygiejnerisiko. Rist korrekt placeret. Vandlås OK.",
  "confidence": 0.88,
  "kategori": "egenkontrol"
}
```

**Resultat:** ✅ Godkendt uden afvigelse

---

### Scenario 2: Afløb med madrester

**AI's respons:**
```json
{
  "handling_udfort": false,
  "beskrivelse": "[AFVIGELSE] Madrester fundet i afløb. Dette tiltrækker skadedyr (rotter, kakerlakker) og skaber bakterievækst (Salmonella, E. coli). Skal fjernes straks.",
  "confidence": 0.92,
  "kategori": "egenkontrol",
  "risikoflag": ["madrester_i_afløb", "skadedyr_risiko", "bakterievækst"]
}
```

**Resultat:** ❌ Afvigelse - Kræver gen-rengøring ELLER faglig override

---

### Scenario 3: AI fejlvurderer patina som snavs

**AI's respons:**
```json
{
  "handling_udfort": false,
  "beskrivelse": "[AFVIGELSE] Synligt snavs i afløbsrist.",
  "confidence": 0.75
}
```

**Kok's handling:**
1. Klikker "👨‍🍳 Overstyr med faglig begrundelse"
2. Skriver: "Dette er misfarvning i rustfrit stål fra kalkaflejringer, ikke organisk snavs. Risten er rengjort og tør. Ingen hygiejnerisiko."
3. Bekræfter faglig vurdering
4. System gemmer override med begrundelse

**Resultat:** ✅ Faglig vurdering godkendt - Opgave kan lukkes

---

## 📁 Filer Opdateret

### Frontend (Hosting)
**Fil:** `d:\madkontrol-app\public\modules\egenkontrol\rutiner.html`

**Ændringer:**
1. **Linje 1559-1589:** Tilføjet gulv/afløb guide
2. **Linje 1668-1688:** Info-ikon og "Kokkens Guide" knap
3. **Linje 3131-3261:** Manuel override UI og logik

### Backend (Cloud Functions)
**Fil:** `d:\madkontrol-app\functions\index.js`

**Ændringer:**
1. **Linje 3594-3616:** Gulv/afløb mentor-prompt
2. **Linje 3619-3638:** Generel mentor-prompt med forklarende feedback

---

## 🎓 Bruger-guide

### For Medarbejdere:

**1. Brug Kokkens Guide**
- Klik på info-ikonet (ⓘ) "Kokkens Guide"
- Læs de 4 sektioner:
  - Hvad skal kontrolleres
  - Sådan gør du
  - Hvornår er det godkendt
  - Hvis det ikke er ok

**2. Hvis AI finder afvigelse**
- Læs AI's forklaring (f.eks. "Madrester tiltrækker skadedyr...")
- Vælg handling:
  - **Rengør:** Klik "🧹 Rengør og tag nyt foto"
  - **Overstyr:** Klik "👨‍🍳 Overstyr med faglig begrundelse"

**3. Faglig override**
- Skriv en klar begrundelse (f.eks. "Misfarvning i stål, ikke snavs")
- Bekræft faglig vurdering
- System gemmer din begrundelse til revision

---

### For Ledere/Revisorer:

**Tjek override-log:**
```javascript
// Hent task med override
const taskRef = doc(db, "task_instances", instanceId);
const taskSnap = await getDoc(taskRef);
const task = taskSnap.data();

if (task.professionalOverride) {
    console.log("AI's vurdering:", task.aiOverride.originalAiResult);
    console.log("Faglig begrundelse:", task.aiOverride.justification);
    console.log("Overstyrret af:", task.aiOverride.overriddenByName);
    console.log("Tidspunkt:", task.aiOverride.overriddenAt);
}
```

**Rapporter:**
- Alle overrides gemmes med timestamp og bruger-ID
- Kan bruges til revision og kvalitetssikring
- Identificer mønstre i AI-fejlvurderinger

---

## 🔍 Tekniske Detaljer

### AI Model
- **Model:** `gpt-4o-mini`
- **Temperature:** 0.2 (konsistent vurdering)
- **Max tokens:** 700
- **Tone:** Mentor-agtig, forklarende

### Override Validering
```javascript
const justification = justificationTextarea.value.trim();
if (!justification) {
    alert("Du skal skrive en faglig begrundelse...");
    return;
}
// Minimum 10 tegn anbefales for meningsfuld begrundelse
```

### Database Indexes
Anbefalet for hurtig søgning:
```javascript
// Firestore indexes
task_instances:
  - professionalOverride (ascending)
  - aiOverride.overriddenAt (descending)
  - companyId (ascending) + professionalOverride (ascending)
```

---

## ✅ Fordele ved Systemet

### For Medarbejdere:
1. ✅ **Læring:** Forstår HVORFOR noget er vigtigt
2. ✅ **Autonomi:** Kan overstyre AI med faglig begrundelse
3. ✅ **Vejledning:** Kokkens Guide hjælper med korrekt udførelse
4. ✅ **Respekt:** Systemet respekterer deres faglighed

### For Ledere:
1. ✅ **Kvalitet:** AI forklarer risici, ikke bare påpeger fejl
2. ✅ **Dokumentation:** Alle overrides logges med begrundelse
3. ✅ **Læring:** Kan identificere hvor AI fejlvurderer
4. ✅ **Fleksibilitet:** Balance mellem automation og menneskelig dømmekraft

### For Systemet:
1. ✅ **Harmoni:** AI og mennesker arbejder sammen
2. ✅ **Tillid:** Medarbejdere stoler på systemet
3. ✅ **Forbedring:** Override-data kan bruges til at træne AI
4. ✅ **Realisme:** Skelner mellem hygiejnerisiko og normal slid

---

## 📝 Eksempler på Gode Begrundelser

**Godkendt override:**
- ✅ "Misfarvning i rustfrit stål fra kalkaflejringer, ikke organisk snavs. Risten er rengjort."
- ✅ "Normal slid på gummipakning efter 2 års brug. Ingen revner eller hygiejnerisiko."
- ✅ "Patina på kobberrør er normal oxidering, ikke snavs. Ingen madrester."

**Ikke godkendt override:**
- ❌ "Det er fint nok" (ingen faglig begrundelse)
- ❌ "AI tager fejl" (forklarer ikke hvorfor)
- ❌ "Ser ok ud" (ikke specifik)

---

## 🚀 Deployment

**Status:** ✅ DEPLOYED

**URL:** https://madkontrollen.web.app

**Deployed:**
- ✅ Frontend: Kokkens Guide UI + Override funktionalitet
- ✅ Backend: Mentor-agtige AI prompts
- ✅ Database: Override-struktur

**Deployment tid:** ~3 minutter

---

## 🎯 Næste Skridt

**Anbefalinger:**

1. **Indsaml feedback**
   - Lad medarbejdere teste Kokkens Guide
   - Spørg: Føles det som en hjælper eller en kontrollør?

2. **Analyser override-mønstre**
   - Hvilke situationer overst yres oftest?
   - Kan AI-prompten forbedres baseret på dette?

3. **Udvid guide-indhold**
   - Tilføj guides for flere rutine-typer
   - Inkluder billede-eksempler af "godkendt" vs. "afvigelse"

4. **Træn AI**
   - Brug override-data til at forbedre AI's vurdering
   - Lær AI at skelne mellem slid og snavs

---

**Implementeret af:** Cascade AI  
**Dato:** 22. marts 2026, 19:25  
**Version:** 4.0.0 - Kokkens Guide System  
**Filosofi:** "En læremester, ikke en politibetjent"
