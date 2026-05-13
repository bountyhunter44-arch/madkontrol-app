# 🎯 Customer Ready Checklist - Første Betalende Kunde

## ✅ Prioritet 1: Produktions-miljø (API & Billeder)

### Cloudinary Setup
- [x] **API Keys:** Cloudinary API keys håndteres via Cloud Functions
- [x] **Customer-specific folders:** Billeder gemmes i `{companyId}/{locationId}/` struktur
- [x] **Folder isolation:** Hver kunde får sin egen mappe automatisk
- [ ] **Verify:** Test at kunde kun ser sine egne billeder

**Implementation:**
```javascript
// I Cloud Functions (getCloudinarySignature)
folder: `${companyId}/${locationId}/egenkontrol`
```

**Cloudinary Folder Structure:**
```
madkontrollen-cloud/
├── comp_abc123/
│   ├── loc_xyz/
│   │   ├── egenkontrol/
│   │   │   ├── task_photos/
│   │   │   └── deviation_photos/
│   │   └── lager/
│   │       └── product_photos/
│   └── loc_def/
│       └── egenkontrol/
└── comp_def456/
    └── loc_123/
        └── egenkontrol/
```

### OpenAI API
- [x] **API Keys:** OpenAI keys håndteres via Cloud Functions
- [x] **Rate limiting:** Cloud Functions har automatisk rate limiting
- [x] **Customer context:** AI får kunde-specifik kontekst (companyId, locationId)
- [ ] **Verify:** Test at AI-analyser er kunde-specifikke

**Implementation:**
```javascript
// I Cloud Functions (analyzeCloudinaryAsset)
const prompt = `Analysér dette billede for ${companyId}...`;
```

---

## ✅ Prioritet 2: Modul-baseret Adgangskontrol

### User Profile Schema
```javascript
{
  userId: "user_123",
  email: "kunde@restaurant.dk",
  displayName: "Restaurant Ejer",
  role: "owner",
  companyId: "comp_abc123",
  locationId: "loc_xyz",
  
  // MODULE PERMISSIONS (KRITISK!)
  modules: {
    core: true,           // Egenkontrol (altid true)
    inventory: false,     // Lager & Stregkode (kun hvis købt)
    institutional: false, // Skoler (kun hvis købt)
    accounting: false,    // Regnskab (kun hvis købt)
    menu: false,          // Menu design (kun hvis købt)
    analytics: false      // Analytics (kun hvis købt)
  }
}
```

### Navigation Hiding Logic
- [x] **Created:** `core/navigation.js` med modul-baseret filtering
- [ ] **Implement:** Integrer navigation.js i alle sider
- [ ] **Test:** Verificer at Lager/Stregkode er skjult hvis `modules.inventory = false`

**Implementation:**
```javascript
import { initNavigation } from '/core/navigation.js';

// Efter login
initNavigation(userProfile, 'dashboard');
```

### UI Locking for Unpurchased Modules
- [ ] **Dashboard:** Vis "Opgrader" kort for ikke-købte moduler
- [ ] **Direct access:** Redirect til upgrade page hvis bruger prøver at tilgå ikke-købt modul
- [ ] **Links:** Fjern/skjul alle links til ikke-købte moduler

---

## ✅ Prioritet 3: Velkomst-data & Risikoanalyse

### Onboarding Risk Analysis
**Hvor gemmes det:**
- Collection: `haccp_snapshots` eller `risk_profiles`
- Document ID: `${companyId}_${locationId}`

**Hvad skal vises på dashboard:**
1. **AI-genereret risikoanalyse** fra onboarding
2. **Kritiske kontrolpunkter (CCP)**
3. **Anbefalede daglige rutiner**
4. **Compliance status**

### Dashboard Integration
- [ ] **Load risk analysis:** Hent fra Firestore ved login
- [ ] **Display professionally:** Vis i pænt kort på dashboard
- [ ] **AI summary:** Generer kort opsummering af risikoanalyse
- [ ] **Action items:** Vis næste skridt baseret på analyse

**Implementation:**
```javascript
// På dashboard.html
async function loadRiskAnalysis() {
  const riskDoc = await getDoc(doc(db, "haccp_snapshots", `${companyId}_${locationId}`));
  
  if (riskDoc.exists()) {
    const data = riskDoc.data();
    displayRiskSummary(data);
  }
}
```

---

## 🔒 Data Isolation Checklist

### Firestore Security
- [x] **Rules deployed:** Alle collections har companyId/locationId checks
- [x] **Multi-tenant:** Brugere kan KUN se deres egen virksomheds data
- [ ] **Test:** Opret test-bruger og verificer isolation

### Query Filtering
- [ ] **Audit all queries:** Sikr at ALLE queries filtrerer på companyId
- [ ] **Location scoping:** Sikr at queries også filtrerer på locationId
- [ ] **No global queries:** Ingen queries må hente data på tværs af virksomheder

**Example:**
```javascript
// ✅ CORRECT
const q = query(
  collection(db, "task_instances"),
  where("companyId", "==", userProfile.companyId),
  where("locationId", "==", userProfile.locationId)
);

// ❌ WRONG - No filtering!
const q = query(collection(db, "task_instances"));
```

---

## 🎨 Professional Welcome Flow

### First Login Experience
1. **Welcome modal:** "Velkommen til Madkontrollen Pro!"
2. **Quick tour:** Vis de vigtigste funktioner
3. **Risk analysis summary:** Vis deres risikoanalyse
4. **First task:** Guide til at oprette første rutine

### Dashboard Personalization
- [ ] **Company name:** Vis kundens virksomhedsnavn
- [ ] **Location:** Vis aktiv lokation
- [ ] **Personalized greeting:** "Velkommen tilbage, [Navn]!"
- [ ] **Status cards:** Vis dagens status

---

## 🧪 Testing Protocol

### Pre-Launch Tests
1. **Create test customer:**
   ```javascript
   {
     companyId: "test_customer_001",
     locationId: "test_loc_001",
     modules: { core: true, inventory: false }
   }
   ```

2. **Verify isolation:**
   - Login som test kunde
   - Verificer at INGEN data fra andre kunder vises
   - Verificer at Lager-modulet er skjult

3. **Test image upload:**
   - Upload billede
   - Verificer at det lander i `test_customer_001/test_loc_001/`
   - Verificer at AI-analyse virker

4. **Test navigation:**
   - Verificer at kun købte moduler vises
   - Verificer at direkte links til ikke-købte moduler redirecter

5. **Test risk analysis:**
   - Verificer at risikoanalyse vises på dashboard
   - Verificer at den er professionelt formateret

---

## 🚀 Deployment Steps

### 1. Environment Setup
```bash
# Ensure Cloud Functions have correct env vars
firebase functions:config:set \
  cloudinary.cloud_name="YOUR_CLOUD_NAME" \
  cloudinary.api_key="YOUR_API_KEY" \
  cloudinary.api_secret="YOUR_API_SECRET" \
  openai.api_key="sk-YOUR_KEY"
```

### 2. Deploy Everything
```bash
firebase deploy --only firestore:rules,hosting,functions
```

### 3. Create Customer Profile
```javascript
// In Firebase Console or via script
await setDoc(doc(db, "users", customerId), {
  userId: customerId,
  email: "kunde@restaurant.dk",
  displayName: "Restaurant Navn",
  role: "owner",
  companyId: "comp_kunde001",
  locationId: "loc_main",
  modules: {
    core: true,        // Egenkontrol (purchased)
    inventory: false,  // Not purchased yet
    institutional: false,
    accounting: false,
    menu: false,
    analytics: false
  },
  createdAt: serverTimestamp()
});
```

### 4. Send Welcome Email
```
Emne: Velkommen til Madkontrollen Pro!

Hej [Kunde Navn],

Velkommen til Madkontrollen Pro! Dit system er nu klar til brug.

Login oplysninger:
Email: kunde@restaurant.dk
Password: [Midlertidigt password]

Log ind her: https://madkontrollen.web.app

Første skridt:
1. Log ind og skift dit password
2. Gennemgå din risikoanalyse på dashboardet
3. Start dagens rutiner

Har du spørgsmål? Kontakt os på support@madkontrollen.dk

Med venlig hilsen,
Madkontrollen Team
```

---

## ✅ Final Checklist

**Før kunde får adgang:**
- [ ] Cloudinary folder structure verificeret
- [ ] OpenAI API virker stabilt
- [ ] Modul-permissions sat korrekt (kun Egenkontrol)
- [ ] Risikoanalyse vises professionelt på dashboard
- [ ] Data isolation testet og verificeret
- [ ] Navigation viser kun købte moduler
- [ ] Alle links virker
- [ ] Ingen test-data synlig
- [ ] Welcome email sendt
- [ ] Support kontakt klar

**Efter kunde login:**
- [ ] Monitor Cloudinary uploads
- [ ] Monitor OpenAI API usage
- [ ] Check for errors i Console
- [ ] Verificer at kunde er tilfreds
- [ ] Planlæg opfølgning efter 1 uge

---

## 🎯 Upsell Opportunities

**Når kunde er klar til at købe mere:**

1. **Lager & Stregkode modul:**
   - Opdater `modules.inventory = true`
   - Navigation vises automatisk
   - Profit-slider bliver tilgængelig

2. **Regnskab modul:**
   - Opdater `modules.accounting = true`
   - Regnskabs-funktioner låses op

**Implementation:**
```javascript
// Når kunde køber nyt modul
await updateDoc(doc(db, "users", userId), {
  "modules.inventory": true,
  updatedAt: serverTimestamp()
});

// Navigation opdateres automatisk ved næste page load
```

---

## 📞 Support Readiness

**Hvad skal du kunne svare på:**
1. "Hvordan uploader jeg billeder?" → Guide til kamera-knap
2. "Hvor er min risikoanalyse?" → Dashboard, øverst
3. "Kan jeg tilføje medarbejdere?" → Ja, under Personale
4. "Hvordan køber jeg Lager-modulet?" → Kontakt salg

**Kritiske kontakter:**
- Tech support: [Din email]
- Billing: [Billing email]
- Emergency: [Phone number]

---

**Status:** 🟡 In Progress
**Target:** 🎯 100% Customer Ready
**Priority:** 🔴 CRITICAL - Første betalende kunde!
