# EGENKONTROL V2 - MODULÆR ARKITEKTUR INTEGRATION

## STATUS: KLAR TIL INTEGRATION (INGEN DATABASE WRITES ENDNU)

---

## NYE FILER OPRETTET

### Backend (Functions)

```
functions/egenkontrol/
├── registries/
│   ├── businessTypes.js       ✅ Branche-definitioner
│   ├── areaTypes.js           ✅ Område-typer
│   ├── equipmentTypes.js      ✅ Udstyr-typer
│   └── activityTypes.js       ✅ Aktivitets-typer
├── libraries/
│   ├── controlLibrary.js      ✅ Kontrol-bibliotek (datadrevet)
│   └── guideLibrary.js        ✅ Guide-bibliotek (backend)
├── builders/
│   └── templateBuilder.js     ✅ Template generator
├── generators/
│   └── taskGenerator.js       ✅ Task instance generator
├── adapters/
│   └── onboardingAdapter.js   ✅ Legacy onboarding adapter
├── utils/
│   └── registryHelpers.js     ✅ Helper funktioner
└── index.js                   ✅ Main export
```

### Frontend (Public)

```
public/modules/egenkontrol/
└── guideLibrary-v2.js         ✅ Frontend guide library
```

### Test & Dokumentation

```
functions/
└── test-egenkontrol-system.js ✅ Test script (NO DB WRITES)

EGENKONTROL_V2_INTEGRATION.md  ✅ Denne fil
```

---

## SYSTEMARKITEKTUR

### Dataflow

```
1. Onboarding/Risk Analysis
   ↓
2. adaptLegacyOnboardingToProfile()
   ↓
3. buildTemplatesFromProfile()
   → Genererer templates med:
     - guideKey (stable reference)
     - evidence (photo config)
     - measurementConfig (defaults, limits)
   ↓
4. generateTaskInstances()
   → Genererer tasks med:
     - guideKey (kopieret fra template)
     - defaultMeasurementValue (prefilled)
     - evidence (photo requirements)
   ↓
5. Frontend (rutiner.html)
   → Renderer task med:
     - Guide via guideKey lookup
     - Camera via evidence config
     - Temperature via measurementConfig
```

---

## KERNEFUNKTIONALITET

### 1. Control Library (Datadrevet)

Hver kontrol definerer:
- `controlKey`: Unik nøgle
- `guideKey`: Reference til guide
- `scope`: equipment/area/activity
- `taskType`: measurement/checklist
- `evidence`: Photo krav
- `measurementConfig`: Temperatur defaults og grænser
- `variants`: Gælder for hvilke targets

**Eksempel:**

```javascript
cold_storage_temperature: {
  controlKey: "cold_storage_temperature",
  guideKey: "guide_cold_storage_temperature",
  scope: "equipment",
  taskType: "measurement",
  evidence: {
    photoAllowed: true,
    photoRequired: false,
    captureLabel: "Tag evt. foto af temperaturvisning"
  },
  measurementConfig: {
    unit: "C",
    defaultValue: 3,
    criticalLimits: { max: 5 },
    prefillOnCreate: true
  },
  variants: {
    fridge: {
      appliesTo: ["fridge", "display_cooler"],
      limits: { max: 5, unit: "C" }
    }
  }
}
```

### 2. Guide Library (Stabil Reference)

Guides slås op via `guideKey`:

```javascript
const guide = getGuideByKeyV2(task.guideKey);
// Returns: { title, steps }
```

**Ingen string matching!**

### 3. Evidence Configuration

Photo krav er datadrevet:

```javascript
task.evidence = {
  photoAllowed: true,
  photoRequired: true,
  minPhotos: 1,
  maxPhotos: 3,
  photoTypes: ["overview", "surface", "issue"],
  captureLabel: "Tag foto af opskæringsområde"
}
```

Frontend:
```javascript
const canTakePhoto = !!task.evidence?.photoAllowed;
const mustTakePhoto = !!task.evidence?.photoRequired;
const captureLabel = task.evidence?.captureLabel || "Tag foto";
```

### 4. Measurement Configuration

Temperatur defaults er datadrevet:

```javascript
task.measurementConfig = {
  unit: "C",
  defaultValue: 3,
  step: 0.5,
  suggestedRange: { min: 2, max: 4 },
  criticalLimits: { max: 5 },
  prefillOnCreate: true
}

task.defaultMeasurementValue = 3; // Prefilled hvis enabled
```

Frontend:
```javascript
const inputValue = task.measurementValue ?? task.defaultMeasurementValue ?? "";
const unit = task.measurementConfig?.unit || "";
const max = task.measurementConfig?.criticalLimits?.max;
```

---

## INTEGRATION STEPS

### A. Backend Integration (Functions)

**Eksisterende fil der skal patches:**
`functions/admin/generateEgenkontrolFromRiskAnalysis.js`

```javascript
// TILFØJ IMPORT
const { buildTemplatesFromProfile } = require('../egenkontrol/builders/templateBuilder');
const { adaptLegacyOnboardingToProfile } = require('../egenkontrol/adapters/onboardingAdapter');

// I buildAggregatedTemplate() eller tilsvarende:
async function generateTemplatesFromRiskAnalysis(riskAnalysis) {
  // 1. Adapter legacy data
  const profile = adaptLegacyOnboardingToProfile({
    businessType: riskAnalysis.businessType,
    equipment: riskAnalysis.equipment || [],
    areas: riskAnalysis.areas || [],
    activities: riskAnalysis.activities || [],
    risks: riskAnalysis.risks || []
  });

  // 2. Build templates
  const { templates } = buildTemplatesFromProfile(profile);

  // 3. Return templates (INGEN DB WRITES ENDNU)
  return templates;
}
```

### B. Frontend Integration (rutiner.html)

**ALLEREDE PATCHED:**
- ✅ Import af guideLibrary-v2.js
- ✅ getSpecializedGuide() bruger guideKey først
- ✅ Fallback til old system for backward compatibility

**MANGLER ENDNU:**
- Camera button rendering baseret på `task.evidence`
- Temperature input rendering baseret på `task.measurementConfig`

---

## TESTRESULTATER

```bash
node functions/test-egenkontrol-system.js
```

**Output:**
```
✅ Templates generated: 14
✅ Tasks generated: 13
✅ Guide resolution: PASS
✅ Evidence configuration: PASS
✅ Measurement configuration: PASS
✅ NO DATABASE WRITES PERFORMED
```

**Fish Shop Profile Test:**
- Walk-in køler: ✅ Temperatur task med defaultValue=3°C
- Ismaskine: ✅ Checklist med photoRequired=true
- Opskæringsområde: ✅ Area hygiene med photoRequired=true
- Fiskehåndtering: ✅ Activity workflow med photo evidence
- Adskillelse råt/spiseklart: ✅ Activity med photoRequired=true

---

## NÆSTE SKRIDT (VENTER PÅ GODKENDELSE)

### 1. Patch Camera Rendering i rutiner.html

Find hvor camera button renderes og patch til:

```javascript
// SLET FRA HER (hardcoded camera logic)
const showCamera = task.title.includes("foto") || task.category === "cleaning";
// TIL HER

// TILFØJ:
const canTakePhoto = !!task.evidence?.photoAllowed;
const mustTakePhoto = !!task.evidence?.photoRequired;
const captureLabel = task.evidence?.captureLabel || "Tag foto";

if (canTakePhoto) {
  // Render camera button med captureLabel
  // Marker som required hvis mustTakePhoto === true
}
```

### 2. Patch Temperature Input Rendering

Find hvor temperature input renderes og patch til:

```javascript
// TILFØJ:
const measurementConfig = task.measurementConfig;
const inputValue = task.measurementValue ?? task.defaultMeasurementValue ?? "";

if (measurementConfig) {
  // Render input med:
  // - value: inputValue
  // - unit: measurementConfig.unit
  // - step: measurementConfig.step
  // - placeholder: `Optimal: ${measurementConfig.defaultValue}${measurementConfig.unit}`
  // - helper text: `Grænse: max ${measurementConfig.criticalLimits.max}${measurementConfig.unit}`
}
```

### 3. Database Migration (IKKE KØRT ENDNU)

Når systemet er verificeret:
1. Kør `repair-guide-mapping.cjs --apply` for at rette eksisterende data
2. Opdater `generateEgenkontrolFromRiskAnalysis.js` til at bruge nye builders
3. Regenerer task_instances med nye templates
4. Deploy

---

## BACKWARD COMPATIBILITY

✅ **Gamle tasks uden guideKey:**
- Fallback til string matching i getSpecializedGuide()
- Ingen crash

✅ **Gamle tasks uden evidence:**
- Defensiv rendering: `task.evidence?.photoAllowed`
- Ingen camera button hvis ikke defineret

✅ **Gamle tasks uden measurementConfig:**
- Defensiv rendering: `task.measurementConfig?.unit`
- Standard input hvis ikke defineret

---

## FORDELE VED NYE SYSTEM

### 1. Ingen String Matching
- ❌ Før: `if (title.includes("køl") || category === "temperatur")`
- ✅ Nu: `getGuideByKeyV2(task.guideKey)`

### 2. Datadrevet Photo Evidence
- ❌ Før: Hardcoded camera button baseret på title
- ✅ Nu: `task.evidence.photoRequired`

### 3. Optimal Temperature Defaults
- ❌ Før: Tom input, bruger skal skrive 3°C hver gang
- ✅ Nu: Prefilled med `defaultMeasurementValue: 3`

### 4. Færre Tasks
- ❌ Før: En task per hazard (mange overlappende)
- ✅ Nu: Aggregeret på control-niveau

### 5. Udvideligt
- ✅ Tilføj ny control: Opdater controlLibrary.js
- ✅ Tilføj ny guide: Opdater guideLibrary.js
- ✅ Tilføj ny branche: Opdater businessTypes.js

---

## EKSEMPEL: FISH SHOP WORKFLOW

**Input:**
```javascript
{
  businessType: "fish_shop",
  equipmentTypes: ["walk_in_cooler", "ice_machine"],
  areaTypes: ["cutting_area"],
  activityTypes: ["fish_handling", "raw_to_ready_separation"]
}
```

**Output Templates:**
1. Walk-in køler · temperatur (measurement, defaultValue=3°C)
2. Walk-in køler · placering (checklist, photo optional)
3. Ismaskine · hygiejne (checklist, photo required)
4. Opskæringsområde · hygiejne (checklist, photo required)
5. Fiskehåndtering · workflow (checklist, photo required)
6. Adskillelse råt/spiseklart (checklist, photo required)

**Hver task har:**
- ✅ Stabil guideKey
- ✅ Evidence config
- ✅ MeasurementConfig (hvis relevant)
- ✅ Ingen string matching nødvendig

---

## DEPLOYMENT CHECKLIST

- [ ] Patch camera rendering i rutiner.html
- [ ] Patch temperature input rendering i rutiner.html
- [ ] Test i browser med mock data
- [ ] Integrer i generateEgenkontrolFromRiskAnalysis.js
- [ ] Kør repair-guide-mapping.cjs --apply
- [ ] Regenerer task_instances
- [ ] Verificer guides vises korrekt
- [ ] Verificer camera buttons vises korrekt
- [ ] Verificer temperature defaults fungerer
- [ ] Deploy til production

---

## KONTAKT

Systemet er klar til integration.
Ingen database writes er foretaget.
Alt er testet in-memory.

Næste skridt: Patch camera og temperature rendering i rutiner.html.
