# Rutine-opdateringer - Fagligt korrekte procedurer

**Dato:** 22. marts 2026  
**Status:** ✅ DEPLOYED

---

## 🎯 Problemstilling

De oprindelige rutine-skabeloner havde faglige fejl:
- ❌ Fokus på "rumtemperatur" i stedet for produkttemperatur
- ❌ Blanding af rengøring og temperaturmålinger
- ❌ Manglende fokus på kernetemperatur ved tilberedning
- ❌ Ingen procedure for nedkøling med temperaturfall over tid

---

## ✅ Løsning - Opdaterede procedurer

### 1. **Tilberedning - Kernetemperatur**

**Ny rutine:** `cooking-core-temp-daily`

```javascript
{
    title: "Kernetemperatur ved tilberedning",
    description: "Mål kernetemperatur i produktet under tilberedning. Minimum 75°C for at dræbe bakterier.",
    fields: [
        { key: "product", label: "Produkt" },
        { key: "temperature", label: "Kernetemperatur °C" },
        { key: "time", label: "Tidspunkt" }
    ],
    alertRules: [
        { type: "temperature_min", value: 75, severity: "critical", 
          message: "Kernetemperatur er under grænseværdi (min. 75°C)" }
    ]
}
```

**Faglig korrekthed:**
- ✅ Fokus på **kernetemperatur** i produktet
- ✅ Minimum **75°C** for bakteriedrab
- ✅ Ikke rumtemperatur - måler i maden

---

### 2. **Varmholdning - Produkttemperatur**

**Opdateret rutine:** `hot-holding-check-daily`

```javascript
{
    title: "Produkttemperatur ved varmholdning",
    description: "Mål produkttemperatur på varmholdte fødevarer. Minimum 65°C for sikker varmholdning.",
    fields: [
        { key: "product", label: "Produkt" },
        { key: "temperature", label: "Produkttemperatur °C" },
        { key: "time", label: "Tidspunkt" }
    ],
    alertRules: [
        { type: "temperature_min", value: 65, severity: "critical", 
          message: "Produkttemperatur er under grænseværdi (min. 65°C)" }
    ]
}
```

**Ændringer:**
- ❌ Før: "Temperatur °C" (uklart)
- ✅ Nu: "Produkttemperatur °C" (klart)
- ✅ Minimum 65°C for varmholdning

---

### 3. **Nedkøling - Temperaturfall over tid**

**Ny rutine:** `cooling-product-temp-daily`

```javascript
{
    title: "Produkttemperatur ved nedkøling",
    description: "Mål produkttemperatur under nedkøling. Varen skal køles fra 60°C til 10°C inden for 4 timer.",
    fields: [
        { key: "product", label: "Produkt" },
        { key: "startTemp", label: "Starttemperatur °C" },
        { key: "endTemp", label: "Sluttemperatur °C" },
        { key: "duration", label: "Nedkølingstid (timer)" }
    ],
    alertRules: [
        { type: "cooling_time_exceeded", value: 4, severity: "critical", 
          message: "Nedkølingstid overskrides - risiko for bakterievækst" }
    ]
}
```

**Faglig korrekthed:**
- ✅ Måler **produkttemperatur** under nedkøling
- ✅ Tracker **temperaturfall over tid**
- ✅ 4-timers regel: 60°C → 10°C
- ✅ Fokus på bakterievækst-risiko

---

### 4. **Rengøring - Adskilt fra temperaturmåling**

**Opdateret rutine:** `cleaning-check-daily`

```javascript
{
    title: "Rengøring af køkken og udstyr",
    description: "Fysisk rengøring af kontaktflader, udstyr, lister, blæsere og hjørner. Dette er IKKE temperaturmåling.",
    fields: [
        { key: "zone", label: "Område" },
        { key: "surfaces", label: "Kontaktflader rengjort" },
        { key: "equipment", label: "Udstyr rengjort" },
        { key: "vents", label: "Blæsere og lister rengjort" },
        { key: "corners", label: "Hjørner og svært tilgængelige steder" }
    ]
}
```

**Ændringer:**
- ✅ Klart fokus på **fysisk rengøring**
- ✅ Specifik om hvad der skal rengøres:
  - Kontaktflader
  - Udstyr
  - Blæsere og lister
  - Hjørner
- ✅ Eksplicit: "Dette er IKKE temperaturmåling"

---

### 5. **Lukkerutine - Opdateret**

**Opdateret rutine:** `closing-check-daily`

```javascript
{
    title: "Lukkerutine",
    description: "Afsluttende kontrol ved lukketid. Bemærk: Produkttemperaturer måles løbende i separate rutiner.",
    fields: [
        { key: "cleaningDone", label: "Fysisk rengøring afsluttet" },
        { key: "wasteHandled", label: "Affald håndteret" },
        { key: "equipmentOff", label: "Udstyr slukket/sikret" },
        { key: "doorsLocked", label: "Døre og vinduer sikret" }
    ]
}
```

**Ændringer:**
- ❌ Før: "Temperaturer kontrolleret" (uklart)
- ✅ Nu: Bemærkning om at temperaturer måles løbende
- ✅ Fokus på fysisk sikring ved lukketid

---

## 📊 Sammenligning - Før vs. Nu

### Temperaturmåling

| Før | Nu |
|-----|-----|
| "Mål temperatur" | "Mål kernetemperatur i produktet" |
| Uklart hvad der måles | Klart: Produktets temperatur |
| Ingen tilberedningsprocedure | Tilberedning: Min. 75°C |
| Ingen nedkølingsprocedure | Nedkøling: 60°C → 10°C på 4 timer |
| Varmholdning: Uklar | Varmholdning: Min. 65°C produkttemp |

### Rengøring

| Før | Nu |
|-----|-----|
| "Rengøring udført" | Specifik: Kontaktflader, udstyr, lister, blæsere, hjørner |
| Blandet med temperatur | Adskilt fra temperaturmåling |
| Generel beskrivelse | Fagligt korrekt for køkkenpersonale |

---

## 🔬 Mikrobiologisk grundlag

### Tilberedning (75°C)
- **Salmonella:** Dræbes ved 70°C i 2 minutter
- **E. coli:** Dræbes ved 75°C
- **Listeria:** Dræbes ved 75°C
- **Sikkerhedsmargin:** 75°C anbefales

### Varmholdning (65°C)
- **Bakterievækst:** Stoppes ved >60°C
- **Sikkerhedsmargin:** 65°C anbefales
- **Farezone:** 5-60°C (bakterievækst)

### Nedkøling (4-timers regel)
- **Kritisk zone:** 60°C → 10°C
- **Maksimal tid:** 4 timer
- **Risiko:** Bakterievækst ved langsom nedkøling

---

## 📁 Filer opdateret

**Hovedfil:**
- `d:\madkontrol-app\public\modules\egenkontrol\risikoanalyse.html`

**Funktioner opdateret:**
- `generateTasksFromRiskAnalysis()` - Linje 1148-1365

**Nye rutiner:**
1. `cooking-core-temp-daily` - Kernetemperatur ved tilberedning
2. `cooling-product-temp-daily` - Produkttemperatur ved nedkøling

**Opdaterede rutiner:**
1. `hot-holding-check-daily` - Produkttemperatur ved varmholdning
2. `cleaning-check-daily` - Fysisk rengøring (adskilt fra temperatur)
3. `closing-check-daily` - Lukkerutine (opdateret beskrivelse)

---

## 🧪 Test og verifikation

**Sådan tester du:**

1. **Gå til risikoanalyse:**
   ```
   https://madkontrollen.web.app/modules/egenkontrol/risikoanalyse.html
   ```

2. **Generer nye rutiner:**
   - Klik "Generér task-skabeloner"
   - Se de nye rutiner i listen

3. **Verificer faglig korrekthed:**
   - ✅ Tilberedning: "Kernetemperatur °C" (min. 75°C)
   - ✅ Varmholdning: "Produkttemperatur °C" (min. 65°C)
   - ✅ Nedkøling: Start/slut temperatur + tid
   - ✅ Rengøring: Kontaktflader, udstyr, lister, blæsere, hjørner

4. **Gå til Rutiner:**
   ```
   https://madkontrollen.web.app/modules/egenkontrol/rutiner.html
   ```

5. **Udfyld en rutine:**
   - Vælg "Kernetemperatur ved tilberedning"
   - Indtast produkt: "Kyllingebryst"
   - Indtast kernetemperatur: "78°C"
   - Gem

---

## ✅ Faglig godkendelse

**Korrekt for køkkenpersonale:**
- ✅ Fokus på produktet, ikke lokalet
- ✅ Kernetemperatur ved tilberedning (75°C)
- ✅ Produkttemperatur ved varmholdning (65°C)
- ✅ Temperaturfall ved nedkøling (4-timers regel)
- ✅ Fysisk rengøring adskilt fra temperaturmåling

**Mikrobiologisk korrekt:**
- ✅ Baseret på bakteriedrab-temperaturer
- ✅ Sikkerhedsmarginer inkluderet
- ✅ Farezone (5-60°C) respekteret

**HACCP-kompatibel:**
- ✅ Kritiske kontrolpunkter (CCP)
- ✅ Grænseværdier defineret
- ✅ Overvågning og dokumentation

---

## 🚀 Deployment

**Status:** ✅ DEPLOYED

**URL:** https://madkontrollen.web.app

**Deployment dato:** 22. marts 2026, 18:42

**Filer deployed:**
- `public/modules/egenkontrol/risikoanalyse.html`

---

## 📝 Næste skridt

**Anbefalinger:**

1. **Test rutinerne i produktion**
   - Lad køkkenpersonale teste de nye rutiner
   - Indsaml feedback på klarhed

2. **Opdater eksisterende data**
   - Hvis der er gamle rutiner i databasen
   - Generer nye task-skabeloner

3. **Uddannelse**
   - Informer brugere om de nye procedurer
   - Forklar forskellen på produkt- vs. rumtemperatur

4. **Dokumentation**
   - Opdater bruger-manualer
   - Tilføj eksempler på korrekt udfyldelse

---

**Implementeret af:** Cascade AI  
**Dato:** 22. marts 2026, 18:42  
**Version:** 2.0.0 - Fagligt korrekte rutiner
