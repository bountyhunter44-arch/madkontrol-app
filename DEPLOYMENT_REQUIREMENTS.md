# Firebase Deployment Requirements

## ⚠️ KRITISK: Billing Krav

**Firebase billing SKAL være aktiveret** for at deploye 2nd generation Cloud Functions med Secret Manager.

### Aktiver Billing

1. Gå til: https://console.firebase.google.com/project/madkontrollen/settings/billing
2. Klik "Modify plan" eller "Set up billing"
3. Vælg Blaze (Pay as you go) plan
4. Tilføj betalingskort

### Hvorfor Billing er Påkrævet

Firebase 2nd gen functions bruger:
- **Secret Manager** - kræver billing for at gemme og tilgå secrets
- **Cloud Build** - kræver billing for at bygge functions
- **Cloud Run** - kræver billing for at køre 2nd gen functions

**UDEN billing:**
- ❌ Deployment fejler med: `403 Write access denied: please check billing account`
- ❌ Secret Manager API returnerer: `403 This API method requires billing to be enabled`
- ❌ Kan ikke deploye nye eller opdaterede functions

**MED billing:**
- ✅ Kan deploye functions
- ✅ Kan bruge Secret Manager
- ✅ Gratis tier dækker de fleste små projekter (2M invocations/måned gratis)

---

## 🔐 Required Secrets

Følgende secrets SKAL sættes via Firebase Secret Manager før deployment:

### 1. Cloudinary (Image Upload)

```bash
firebase functions:secrets:set CLOUDINARY_CLOUD_NAME
# Indtast: dngwouyuq

firebase functions:secrets:set CLOUDINARY_API_KEY
# Indtast: 518839552489852

firebase functions:secrets:set CLOUDINARY_API_SECRET
# Indtast: CHPD2QGzWtpa002acENy2zacmpc
```

### 2. OpenAI (AI Features)

```bash
firebase functions:secrets:set OPENAI_API_KEY
# Indtast din OpenAI API key (starter med sk-)
```

### 3. Stripe (Payments)

```bash
firebase functions:secrets:set FUNCTIONS_CONFIG_EXPORT
# Indtast JSON object med Stripe config:
{
  "stripe": {
    "secret_key": "sk_test_...",
    "price_monthly": "price_...",
    "price_yearly": "price_..."
  },
  "cloudinary": {
    "cloud_name": "dngwouyuq",
    "api_key": "518839552489852",
    "api_secret": "CHPD2QGzWtpa002acENy2zacmpc"
  }
}
```

---

## 🧪 Lokal Udvikling (Emulator)

For lokal udvikling bruges `.env` filen i stedet for Secret Manager:

### Setup

1. **Opret `functions/.env`** (allerede oprettet):
   ```env
   CLOUDINARY_CLOUD_NAME=dngwouyuq
   CLOUDINARY_API_KEY=518839552489852
   CLOUDINARY_API_SECRET=CHPD2QGzWtpa002acENy2zacmpc
   OPENAI_API_KEY=sk-your-key-here
   ```

2. **Start emulator**:
   ```bash
   firebase emulators:start
   ```

### Emulator Detection

Functions detekterer automatisk emulator via `process.env.FUNCTIONS_EMULATOR === "true"`:

- **Emulator:** Læser fra `functions/.env`
- **Production:** Læser fra Secret Manager

---

## 📦 Deployment Steps

### 1. Tjek at billing er aktiveret

```bash
# Tjek project info
firebase projects:list

# Tjek billing status på:
https://console.firebase.google.com/project/madkontrollen/settings/billing
```

### 2. Sæt secrets (kun første gang)

```bash
# Cloudinary
firebase functions:secrets:set CLOUDINARY_CLOUD_NAME
firebase functions:secrets:set CLOUDINARY_API_KEY
firebase functions:secrets:set CLOUDINARY_API_SECRET

# OpenAI
firebase functions:secrets:set OPENAI_API_KEY

# Stripe/Config
firebase functions:secrets:set FUNCTIONS_CONFIG_EXPORT
```

### 3. Valider syntax

```bash
cd functions
node --check index.js
```

### 4. Deploy

```bash
# Deploy alle functions
firebase deploy --only functions

# Eller deploy specifik function
firebase deploy --only functions:getCloudinarySignature
```

---

## 🚨 Troubleshooting

### Fejl: "403 billing required"

**Problem:** Billing er ikke aktiveret

**Løsning:**
1. Gå til https://console.firebase.google.com/project/madkontrollen/settings/billing
2. Aktiver Blaze plan
3. Vent 2-5 minutter
4. Prøv deployment igen

### Fejl: "Secret not found"

**Problem:** Secret er ikke sat i Secret Manager

**Løsning:**
```bash
# List alle secrets
firebase functions:secrets:access --list

# Sæt manglende secret
firebase functions:secrets:set SECRET_NAME
```

### Fejl: "Cloudinary secrets missing in production"

**Problem:** Secrets er sat, men function kan ikke læse dem

**Løsning:**
1. Tjek at function har `secrets: [CLOUDINARY_CLOUD_NAME, ...]` i options
2. Tjek at secret navne matcher præcist
3. Redeploy function

---

## 💰 Omkostninger

**Blaze Plan (Pay as you go):**

- **Gratis tier (måned):**
  - 2M function invocations
  - 400,000 GB-seconds compute
  - 200,000 CPU-seconds
  - 5 GB egress

- **Typisk forbrug for Madkontrollen:**
  - ~50,000 invocations/måned
  - **Estimeret kostnad: 0-5 DKK/måned**

**Secret Manager:**
- 6 secrets × 0.06 USD/secret/måned = ~0.36 USD (~2.50 DKK/måned)

**Total estimeret: 2-8 DKK/måned**

---

## ✅ Checklist

Før deployment, tjek:

- [ ] Billing er aktiveret på Firebase project
- [ ] Alle secrets er sat via `firebase functions:secrets:set`
- [ ] `node --check functions/index.js` returnerer exit code 0
- [ ] `functions/.env` eksisterer for lokal udvikling
- [ ] `.gitignore` indeholder `functions/.env`
- [ ] Ingen hardcoded secrets i kode

---

## 📚 Links

- Firebase Billing: https://console.firebase.google.com/project/madkontrollen/settings/billing
- Secret Manager: https://console.cloud.google.com/security/secret-manager?project=madkontrollen
- Functions Dashboard: https://console.firebase.google.com/project/madkontrollen/functions
- Pricing Calculator: https://firebase.google.com/pricing
