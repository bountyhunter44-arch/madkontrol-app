# Madkontrollen - Harmonisk Arkitektur & Workflow Redesign

## 📋 Nuværende Analyse

### Eksisterende Struktur (Kaotisk)
```
public/
├── modules/
│   ├── egenkontrol/      (15 filer - Core)
│   ├── lager/            (3 filer - Commercial)
│   ├── accounting/       (7 filer - Commercial)
│   ├── drift/            (7 filer - Commercial)
│   ├── kalkulation/      (4 filer - Commercial)
│   ├── menu/             (6 filer - Commercial)
│   ├── pos/              (0 filer - Commercial)
│   ├── skole/            (3 filer - Institutional)
│   ├── akademi/          (5 filer - Institutional)
│   ├── business/         (1 fil - Uklart)
│   ├── core/             (1 fil - Uklart)
│   ├── platform/         (3 filer - Uklart)
│   ├── admin/            (1 fil - Uklart)
│   └── [8+ andre mapper med spredt logik]
└── dashboard.html        (Hovedside uden klar struktur)
```

**Problemer:**
- ❌ Moduler "svæver" uden sammenhæng
- ❌ Ingen lineær brugerrejse
- ❌ Inkonsistent database-logik (user_id, userId, performedBy)
- ❌ Ingen automatiske overgange mellem moduler
- ❌ Profit-slider gemt væk i undermappe

---

## 🎯 Ny Harmonisk Struktur

### 1. Fil-Arkitektur (Logisk Opdeling)

```
public/
├── core/                          # Fælles infrastruktur
│   ├── auth.js                    # Unified authentication
│   ├── database.js                # Unified DB schema & helpers
│   ├── layout.js                  # Shared UI components
│   └── workflow.js                # Smart transitions engine
│
├── modules/
│   ├── 01-core/                   # EGENKONTROL (Lovpligtig)
│   │   ├── dashboard.html         # Hovedoverblik med Profit Slider
│   │   ├── modtagelse/            # FASE 1: Varemodtagelse
│   │   │   ├── scan-in.html       # Scan varer ind
│   │   │   ├── temp-check.html    # Temperaturkontrol
│   │   │   └── delivery-log.html  # Leveringslog
│   │   ├── produktion/            # FASE 2: Produktion
│   │   │   ├── nedkoeling.html    # Nedkølingslog
│   │   │   ├── varme.html         # Opvarmningslog
│   │   │   └── rutiner.html       # Daglige rutiner
│   │   ├── service/               # FASE 3: Service
│   │   │   ├── varmholdelse.html  # Varmholdelse
│   │   │   └── bordservice.html   # Bordbestilling
│   │   ├── luk-rapport/           # FASE 4: Afslutning
│   │   │   ├── luk-dag.html       # Luk dagens drift
│   │   │   ├── rengoring.html     # Rengøringslog
│   │   │   └── rapporter.html     # Arkivering
│   │   ├── afvigelser/            # Håndtering af fejl
│   │   │   ├── list.html          # Liste over afvigelser
│   │   │   └── detail.html        # Detaljevisning
│   │   └── risikoanalyse/         # HACCP
│   │       └── index.html
│   │
│   ├── 02-commercial/             # RESTAURANT & LAGER
│   │   ├── lager/                 # Intelligent lagerstyring
│   │   │   ├── scanner.html       # Mobil scanner
│   │   │   ├── inventory.html     # Lagerbeholdning
│   │   │   └── profit-balance.html # Økonomisk dashboard
│   │   ├── kalkulation/           # Prisberegning
│   │   ├── menu/                  # Menudesign
│   │   ├── drift/                 # Driftsøkonomi
│   │   └── accounting/            # Regnskab
│   │
│   └── 03-institutional/          # SKOLER & INSTITUTIONER
│       ├── skole/                 # Skolekøkkener
│       ├── akademi/               # Uddannelse
│       └── onboarding/            # Setup
│
├── assets/                        # Statiske filer
│   ├── images/
│   ├── css/
│   └── js/
│
└── index.html                     # Landing page
```

---

## 🔄 Lineær Workflow Navigation

### Workflow Menu (Venstre Sidebar)

```
┌─────────────────────────────────────┐
│ 💰 PROFIT-BALANCE: +42             │ ← Altid synlig øverst
│ ═══════════════════════════════════ │
│                                     │
│ 📦 FASE 1: MODTAGELSE              │
│   ├─ Scan ind                      │
│   ├─ Temperaturkontrol             │
│   └─ Leveringslog                  │
│                                     │
│ 🍳 FASE 2: PRODUKTION              │
│   ├─ Nedkøling                     │
│   ├─ Opvarmning                    │
│   └─ Daglige rutiner               │
│                                     │
│ 🍽️ FASE 3: SERVICE                 │
│   ├─ Varmholdelse                  │
│   └─ Bordbestilling                │
│                                     │
│ 🔒 FASE 4: LUK & RAPPORT           │
│   ├─ Luk dag                       │
│   ├─ Rengøring                     │
│   └─ Arkivering                    │
│                                     │
│ ═══════════════════════════════════ │
│ ⚠️ AFVIGELSER (2 åbne)             │ ← Rød hvis uløste
│ 📊 RISIKOANALYSE                   │
│ 📷 BILLEDARKIV                     │
└─────────────────────────────────────┘
```

**Logik:**
- Aktiv fase highlightes i grøn
- Næste skridt pulser med animation
- Uløste afvigelser låser navigation (rød banner)

---

## 🗄️ Unified Database Schema

### Konsistent Naming Convention

**ALLE collections bruger:**
```javascript
{
  // Identity (ALTID disse felter)
  id: "unique_id",              // Primary key
  userId: "user_abc123",        // Hvem udførte handlingen
  companyId: "comp_xyz",        // Hvilken virksomhed
  locationId: "loc_123",        // Hvilken lokation
  
  // Timestamps (ALTID disse felter)
  createdAt: Timestamp,         // Oprettet
  updatedAt: Timestamp,         // Sidst opdateret
  performedAt: Timestamp,       // Hvornår blev handlingen udført
  
  // Metadata
  performedBy: "user_abc123",   // Samme som userId (redundant for queries)
  performedByName: "John Doe",  // Display name
  
  // Status tracking
  status: "active" | "completed" | "archived",
  
  // Data...
}
```

### Collections Cleanup

**BEHOLD:**
```
users                      ✅ (Unified user profiles)
inventory_items            ✅ (Lager)
inventory_transactions     ✅ (Lager transaktioner)
inventory_alerts           ✅ (Udløbsadvarsler)
deviations                 ✅ (Afvigelser)
task_instances             ✅ (Rutiner)
daily_runs                 ✅ (Daglige kørsler)
reports                    ✅ (Rapporter)
media_assets               ✅ (Billeder)
```

**SLET/MERGE:**
```
test_*                     ❌ (Alle test-data)
temp_*                     ❌ (Midlertidige data)
old_*                      ❌ (Gamle versioner)
Dubletter med forskellig naming ❌
```

---

## 🤖 Smart Transitions (Automatisering)

### 1. Scan In → Temperaturkontrol

```javascript
// I scanner.html efter succesfuld scan-in
async function onScanInComplete(item) {
  // Vis success
  showSuccess(`✅ ${item.productName} scannet ind!`);
  
  // Smart transition prompt
  const shouldCheckTemp = await showSmartPrompt({
    title: "Næste skridt",
    message: "Vil du udføre varemodtagelses-tjek nu?",
    icon: "🌡️",
    actions: [
      { label: "Ja, tjek temperatur", value: "yes", primary: true },
      { label: "Spring over", value: "skip" }
    ]
  });
  
  if (shouldCheckTemp === "yes") {
    // Auto-navigate til temperaturkontrol med pre-filled data
    window.location.href = `/modules/01-core/modtagelse/temp-check.html?itemId=${item.itemId}&autoFill=true`;
  }
}
```

### 2. Afvigelse Fundet → Dashboard Lock

```javascript
// I afvigelser.html når ny afvigelse oprettes
async function createDeviation(deviationData) {
  await setDoc(doc(db, "deviations", deviationId), {
    ...deviationData,
    status: "open",
    requiresAction: true,
    createdAt: serverTimestamp()
  });
  
  // Trigger dashboard lock
  await setDoc(doc(db, "system_state", "dashboard_lock"), {
    locked: true,
    reason: "open_deviation",
    deviationId,
    message: "Handling kræves: Løs afvigelse før fortsættelse"
  });
  
  // Redirect til afvigelse
  window.location.href = `/modules/01-core/afvigelser/detail.html?id=${deviationId}`;
}
```

### 3. Dashboard Lock UI

```javascript
// I dashboard.html
onAuthStateChanged(auth, async (user) => {
  // Check for locks
  const lockDoc = await getDoc(doc(db, "system_state", "dashboard_lock"));
  
  if (lockDoc.exists() && lockDoc.data().locked) {
    showDashboardLock({
      message: lockDoc.data().message,
      actionUrl: `/modules/01-core/afvigelser/detail.html?id=${lockDoc.data().deviationId}`,
      actionLabel: "Løs afvigelse nu"
    });
  }
});
```

---

## 💰 Profit-Balance Slider (Dashboard Top)

### Ny Dashboard Layout

```html
<!-- dashboard.html -->
<main class="dashboard-container">
  <!-- 1. PROFIT SLIDER (Øverst - Altid synlig) -->
  <section class="profit-compass-section">
    <div class="profit-compass-card">
      <h2>💰 Økonomisk Kompas</h2>
      <div class="profit-slider-embed">
        <!-- Embedded profit slider -->
        <div class="profit-slider" id="main-profit-slider">
          <div class="slider-indicator" style="left: 65%">+42</div>
        </div>
        <div class="profit-metrics">
          <div class="metric">
            <span class="metric-label">Scanning</span>
            <span class="metric-value">85</span>
          </div>
          <div class="metric">
            <span class="metric-label">FIFO</span>
            <span class="metric-value">92</span>
          </div>
          <div class="metric">
            <span class="metric-label">Nul Afvigelser</span>
            <span class="metric-value">78</span>
          </div>
        </div>
        <a href="/modules/02-commercial/lager/profit-balance.html" class="btn-link">
          Se detaljeret analyse →
        </a>
      </div>
    </div>
  </section>

  <!-- 2. WORKFLOW STATUS -->
  <section class="workflow-status-section">
    <div class="workflow-phases">
      <div class="phase-card active">
        <h3>📦 MODTAGELSE</h3>
        <div class="phase-progress">3/5 opgaver</div>
      </div>
      <div class="phase-card next">
        <h3>🍳 PRODUKTION</h3>
        <div class="phase-progress">0/8 opgaver</div>
      </div>
      <div class="phase-card">
        <h3>🍽️ SERVICE</h3>
        <div class="phase-progress">0/3 opgaver</div>
      </div>
      <div class="phase-card">
        <h3>🔒 LUK & RAPPORT</h3>
        <div class="phase-progress">Ikke startet</div>
      </div>
    </div>
  </section>

  <!-- 3. ALERTS & ACTIONS -->
  <section class="alerts-section">
    <!-- Afvigelser, advarsler, etc. -->
  </section>

  <!-- 4. QUICK LINKS -->
  <section class="quick-links-section">
    <!-- Genveje til moduler -->
  </section>
</main>
```

---

## 📊 Implementation Plan

### Fase 1: Cleanup (Uge 1)
1. ✅ Opret ny mappestruktur
2. ✅ Migrer filer til nye placeringer
3. ✅ Opdater alle interne links
4. ✅ Slet test-data og dubletter fra Firestore

### Fase 2: Database Unification (Uge 1-2)
1. ✅ Implementer unified schema i `core/database.js`
2. ✅ Migrer eksisterende data til nyt format
3. ✅ Opdater alle Firestore queries til konsistent naming

### Fase 3: Workflow Navigation (Uge 2)
1. ✅ Byg workflow sidebar component
2. ✅ Implementer fase-tracking logik
3. ✅ Tilføj progress indicators

### Fase 4: Smart Transitions (Uge 2-3)
1. ✅ Implementer transition engine i `core/workflow.js`
2. ✅ Tilføj auto-prompts efter scan-in
3. ✅ Implementer dashboard lock ved afvigelser

### Fase 5: Dashboard Redesign (Uge 3)
1. ✅ Flyt Profit Slider til toppen
2. ✅ Tilføj workflow status cards
3. ✅ Implementer real-time updates

---

## 🎨 Visuel Harmoni

### Design Principles
- **Lineær flow:** Venstre til højre, top til bund
- **Farve-kodning:** Grøn (aktiv), Gul (næste), Grå (ikke startet), Rød (kræver handling)
- **Profit Slider:** Altid synlig som økonomisk kompas
- **Smart prompts:** Kontekstuelle forslag til næste handling
- **Progress tracking:** Visuel feedback på hver fase

### Color Palette
```css
:root {
  --phase-active: #10b981;      /* Grøn */
  --phase-next: #fbbf24;         /* Gul */
  --phase-pending: #9ca3af;      /* Grå */
  --phase-locked: #ef4444;       /* Rød */
  --profit-positive: #10b981;    /* Grøn */
  --profit-neutral: #fbbf24;     /* Gul */
  --profit-negative: #ef4444;    /* Rød */
}
```

---

## 🚀 Migration Strategy

### Step-by-Step
1. **Backup:** Eksporter alle Firestore data
2. **Create new structure:** Opret nye mapper
3. **Migrate files:** Flyt filer med opdaterede paths
4. **Update links:** Find/replace alle interne links
5. **Database migration:** Kør migration script
6. **Test:** Verificer alle flows virker
7. **Deploy:** Gradvis udrulning

### Rollback Plan
- Behold gamle filer i `_archive/` folder
- Database backup før migration
- Feature flag til at skifte mellem gammel/ny struktur

---

## ✅ Success Metrics

**Efter implementering skal:**
- ✅ Alle moduler følge lineær workflow
- ✅ 100% konsistent database naming
- ✅ Profit Slider synlig på dashboard
- ✅ Smart transitions mellem moduler
- ✅ Dashboard lock ved uløste afvigelser
- ✅ 0 test-data i production
- ✅ Alle links virker uden 404-fejl

---

**Konklusion:** Denne arkitektur skaber harmoni mellem teknisk struktur og kognitiv flow i en koks arbejdsdag. Moduler "svæver" ikke længere - de følger en naturlig progression fra modtagelse til rapport.
