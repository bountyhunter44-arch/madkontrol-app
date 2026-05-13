# TASK_TEMPLATES REGENERATION GUIDE

## SYSTEM OVERSIGT

### Hvordan task_templates genereres

**Kilde:** `functions/admin/generateEgenkontrolFromRiskAnalysis.js`

**Proces:**
1. Læser `risk_analyses` collection for en given locationId
2. Grupperer risk control points efter **aggregatedCategory** (ny reduceret model)
3. Bygger ÉT aggregeret template per kategori (ikke 29 individuelle)
4. Gemmer i `task_templates` collection

**Aggregerede kategorier (15 i stedet for 29):**
- `temperature_cooling` - Temperaturkontrol af køl
- `temperature_freezing` - Temperaturkontrol af frost
- `temperature_heating` - Kontrol af varmholdelse og varmeudstyr
- `fryer_critical` - Kontrol af friture
- `ice_equipment_critical` - Kontrol af ismaskiner og softice
- `receiving_control` - Modtagekontrol af varer
- `equipment_cleaning` - Rengøring og vedligehold af udstyr
- `area_cleaning` - Rengøringskontrol af områder
- `drain_maintenance` - Kontrol og rengøring af afløb
- `allergen_control` - Kontrol af allergenhåndtering
- `staff_hygiene` - Personale hygiejne
- `closing_routine` - Lukkerutine
- `building_condition` - Kontrol af bygningsmæssig tilstand (månedlig)
- `pest_control` - Kontrol af skadedyrssikring (ugentlig)
- `verification` - Verifikation og dokumentation (ugentlig)

**Template typer:**
- `operational` - Daglige rutiner (vises i Start dag)
- `verification` - Periodiske kontroller (ikke daglige)
- `process` - Process tasks (nedkøling, genopvarmning - vises kun når aktive)

---

## REGENERATION TRIN-FOR-TRIN

### 1. VERIFICER AT RISK_ANALYSES FINDES

```bash
node public/scripts/check-risk-analyses.cjs
```

Hvis ingen risk_analyses findes, skal du først oprette dem via:
- Admin UI (hvis implementeret)
- Import script
- Manuel oprettelse i Firestore

### 2. KØR TEMPLATE REGENERATION

```bash
node public/scripts/regenerate-templates.cjs
```

**Dette script:**
- Læser risk_analyses for `onboarding_aroi-d`
- Kører `generateEgenkontrolFromRiskAnalysis({ locationId })`
- Aggregerer risk control points til færre templates
- Opretter/opdaterer task_templates i Firestore
- Viser antal oprettede templates

**Forventet output:**
```
🔄 REGENERERER TASK_TEMPLATES FRA RISK_ANALYSES
📍 Location: onboarding_aroi-d

📊 Fandt X risk_analyses dokumenter

📋 Risk analyses fundet:
  - [id]: [process] → [hazard] ([controlType])

🚀 Kører template-generering...

✅ RESULTAT:
  - Oprettet: 12 templates
  - Opdateret: 0 templates
  - Sprunget over: 0 templates
  - Total templates: 12
  - Risk analyses fundet: 29
  - Aktive risk analyses: 29

🔍 VERIFICERER OPRETTEDE TEMPLATES:

📊 Total task_templates i database: 12

📋 Templates oprettet:
  - Temperaturkontrol af køl (twice_daily, operational)
  - Temperaturkontrol af frost (twice_daily, operational)
  - Kontrol af varmholdelse og varmeudstyr (daily, operational)
  - Kontrol af friture (daily, operational)
  - Modtagekontrol af varer (per_delivery, operational)
  - Rengøring og vedligehold af udstyr (daily, operational)
  - Rengøringskontrol af områder (daily, operational)
  - Kontrol og rengøring af afløb (daily, operational)
  - Kontrol af allergenhåndtering (daily, operational)
  - Personale hygiejne (daily, operational)
  - Lukkerutine (closing, operational)
  - Kontrol af skadedyrssikring (weekly, verification)

✅ FÆRDIG - Templates er klar til Start dag
```

### 3. VERIFICER TEMPLATE COUNT

**Forventet antal:** 10-15 templates (IKKE 29)

**Hvorfor færre?**
- Gamle system: 1 template per risk control point = 29 templates
- Nyt system: 1 template per aggregeret kategori = 10-15 templates
- Eksempel: 5 køleenheder → 1 "Temperaturkontrol af køl" template

**Tjek i Firestore:**
```
Collection: task_templates
Filter: locationId == "onboarding_aroi-d"
Forventet: 10-15 dokumenter
```

### 4. KØR START DAG

**Via UI:**
1. Log ind som owner/admin
2. Gå til Dashboard
3. Klik "Start dag" knap
4. Verificer: "Oprettet X opgaver" (hvor X > 0)

**Via Cloud Function (hvis deployed):**
```javascript
// I browser console på dashboard
const startDayCallable = httpsCallable(functionsClient, "startDay");
const result = await startDayCallable({
  companyId: "onboarding_aroi-d",
  locationId: "onboarding_aroi-d"
});
console.log(result.data);
```

**Forventet resultat:**
```
{
  ok: true,
  created: 8,  // Antal operational templates der blev instantieret
  dateKey: "2026-03-24",
  message: "Oprettet 8 opgaver for 2026-03-24"
}
```

**Hvorfor ikke alle templates?**
- Kun `operational` templates instantieres ved Start dag
- `verification` templates (weekly/monthly) instantieres separat
- `process` templates (nedkøling/genopvarmning) instantieres on-demand

### 5. VERIFICER TASK_INSTANCES

```bash
node public/scripts/verify-task-instances.cjs
```

**Forventet:**
- 8-10 task_instances oprettet
- Alle har `dateKey` = i dag
- Alle har `status` = "pending"
- Alle har `templateType` = "operational"

---

## TROUBLESHOOTING

### Problem: "Oprettet 0 opgaver"

**Årsager:**
1. Ingen task_templates findes → Kør regenerate-templates.cjs
2. Templates har `isActive: false` → Tjek Firestore
3. Templates har forkert locationId → Tjek locationId match
4. Templates er alle `verification` type → Forventet (ikke daglige)

**Løsning:**
```bash
# 1. Tjek templates
node public/scripts/check-templates.cjs

# 2. Regenerer hvis nødvendigt
node public/scripts/regenerate-templates.cjs

# 3. Prøv Start dag igen
```

### Problem: "Ingen risk_analyses fundet"

**Løsning:**
Du skal først oprette risk_analyses dokumenter. Disse er kilden til templates.

**Muligheder:**
1. Import fra eksisterende data
2. Opret manuelt i Firestore
3. Brug admin UI (hvis implementeret)

### Problem: "For mange templates (29+)"

**Årsag:** Gamle ikke-aggregerede templates eksisterer stadig.

**Løsning:**
```bash
# Slet alle gamle templates
node public/scripts/delete-task-templates.cjs

# Regenerer med ny aggregeret model
node public/scripts/regenerate-templates.cjs
```

---

## SCRIPTS OVERSIGT

### Cleanup scripts (allerede kørt):
- ✅ `delete-task-instances.cjs` - Slet task_instances
- ✅ `delete-daily-runs.cjs` - Slet daily_runs
- ✅ `delete-task-templates.cjs` - Slet task_templates

### Regeneration scripts (kør nu):
- 🔄 `regenerate-templates.cjs` - Generer templates fra risk_analyses
- 🔍 `check-templates.cjs` - Verificer templates (skal oprettes)
- 🔍 `verify-task-instances.cjs` - Verificer instances efter Start dag (skal oprettes)

---

## FORVENTET FLOW

```
1. risk_analyses (29 dokumenter)
   ↓
2. generateEgenkontrolFromRiskAnalysis()
   ↓ (aggregering)
3. task_templates (10-15 dokumenter)
   ↓
4. Start dag
   ↓ (instantiering af operational templates)
5. task_instances (8-10 dokumenter per dag)
```

---

## NÆSTE SKRIDT

1. ✅ Cleanup færdig (task_instances, daily_runs, task_templates slettet)
2. 🔄 Kør: `node public/scripts/regenerate-templates.cjs`
3. 🔍 Verificer: 10-15 templates oprettet
4. ▶️ Kør: Start dag via UI
5. ✅ Verificer: 8-10 task_instances oprettet

**Målet:** Få systemet til at fungere med den nye aggregerede model (færre, smartere templates).
