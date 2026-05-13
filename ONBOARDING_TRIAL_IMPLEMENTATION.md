# Onboarding Trial & Welcome Email Implementation

## Oversigt

Implementeret funktionalitet:
1. ✅ 14 dages gratis prøveperiode via Stripe Checkout
2. ✅ Permanent onboarding summary gemt i Firestore
3. ✅ Welcome email (logged, klar til email provider)
4. ✅ Admin funktion til at læse onboarding summary
5. ✅ Billing info med trial tracking

---

## 1. Stripe Checkout med 14 Dages Trial

### Ændringer i `functions/index.js`

**Funktion:** `createOnboardingCheckoutSession` (linje 6508-6537)

**Tilføjet:**
```javascript
subscription_data: {
  trial_period_days: 14,
  metadata: {
    flow: "onboarding_trial",
    draftId: draftRef.id,
    companyId,
    locationId
  }
}
```

**Metadata opdateret:**
```javascript
metadata: {
  // ... existing fields
  trialDays: "14"
}
```

**Resultat:** Stripe opretter abonnement med 14 dages trial. Ingen betaling før trial udløber.

---

## 2. Onboarding Summary - Permanent Lagring

### Firestore Struktur

**Collection:** `companies/{companyId}/onboarding_summary/current`

**Struktur:**
```javascript
{
  companyId: string,
  locationId: string,
  draftId: string,
  createdAt: timestamp,
  updatedAt: timestamp,
  source: "onboarding",
  
  company: {
    name: string,
    cvr: string,
    address: string,
    zip: string,
    city: string,
    phone: string,
    email: string
  },
  
  location: {
    name: string,
    address: string
  },
  
  selectedSetup: {
    industry: string,
    hasCooling: boolean,
    hasHeating: boolean,
    hasHotHolding: boolean,
    hasDishwasher: boolean,
    hasFryer: boolean,
    fridgeCount: number,
    freezerCount: number,
    walkinCoolerCount: number,
    walkinFreezerCount: number,
    hasReceiving: boolean,
    equipment: [
      { type: string, count: number }
    ]
  },
  
  billing: {
    provider: "stripe",
    status: string,  // "trialing", "active", etc.
    trialDays: 14,
    trialEndsAt: ISO timestamp,
    checkoutSessionId: string,
    subscriptionId: string,
    priceId: string,
    plan: string  // "monthly" or "yearly"
  }
}
```

### Helper Funktion

**Funktion:** `buildDetailedOnboardingSummary` (linje 1010-1068)

Bygger detaljeret summary fra onboarding profile og billing info.

### Gemmes i `finalizeOnboardingCheckoutProvisioning`

**Linje:** 8274-8275

```javascript
await companyRef.collection("onboarding_summary").doc("current").set(detailedSummary, { merge: true });
console.log("[FINALIZE] Onboarding summary saved to companies/{companyId}/onboarding_summary/current");
```

---

## 3. Subscription Info Tracking

### Ændringer i `finalizeOnboardingCheckoutProvisioning`

**Linje:** 7764-7786

**Henter subscription fra Stripe:**
```javascript
if (checkoutSession.subscription) {
  subscriptionId = String(checkoutSession.subscription);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  subscriptionStatus = subscription.status;
  trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
  priceId = subscription.items?.data?.[0]?.price?.id || null;
}
```

**Gemmer i company document (linje 8111-8121):**
```javascript
subscription: {
  provider: "stripe",
  plan: billingPlan,
  status: subscriptionStatus || "active",
  subscriptionId: subscriptionId || null,
  priceId: priceId || null,
  trialDays: 14,
  trialEndsAt: trialEnd || null,
  startedAt: FieldValue.serverTimestamp(),
  stripeSessionId: sessionId
}
```

---

## 4. Welcome Email

### Helper Funktion

**Funktion:** `sendOnboardingWelcomeEmail` (linje 955-1008)

**Email Indhold (Dansk):**

**Emne:** "Velkommen til Madkontrollen – jeres egenkontrol er klar"

**Body:**
```
Hej [firma],

Jeres Madkontrollen-konto er nu oprettet.

Login:
Email: [loginEmail]
Adgangskode: Den adgangskode du valgte ved onboarding.

Valgt opsætning:
- Branche: [industry]
- Køl: [Ja/Nej] ([X] køleskabe, [Y] frysere)
- Opvarmning: [Ja/Nej]
- Varmholdelse: [Ja/Nej]
- Varemodtagelse: [Ja/Nej]
- Opvaskemaskine: [Ja/Nej]
- Udstyr: [equipment list]

Betaling:
I har 14 dages gratis prøveperiode.
Prøveperioden udløber: [date]
Efter prøveperioden starter abonnementet automatisk, medmindre I opsiger inden udløb.

Venlig hilsen
Madkontrollen
info@madkontrollen.dk
```

**Status:** Email content logges til console. Klar til email provider integration.

**Kaldes fra:** `finalizeOnboardingCheckoutProvisioning` (linje 8277-8291)

**Sikkerhed:**
- ✅ Sender IKKE password i email
- ✅ Bruger "Den adgangskode du valgte ved onboarding"
- ✅ Logger aldrig password

---

## 5. Admin Funktion - Læs Onboarding Summary

### Callable Function

**Funktion:** `getOnboardingSummary` (linje 8343-8386)

**Eksporteret som:** `exports.getOnboardingSummary`

**Input:**
```javascript
{
  companyId: string
}
```

**Output:**
```javascript
{
  ok: true,
  found: true,
  summary: {
    // Full onboarding summary object
  }
}
```

**Sikkerhed:**
- ✅ Kræver authentication
- ✅ Verificerer user har adgang til companyId
- ✅ Kun owner/admin for samme company kan læse

**Brug fra frontend:**
```javascript
const getOnboardingSummaryCallable = httpsCallable(functions, 'getOnboardingSummary');
const result = await getOnboardingSummaryCallable({ companyId: SETTINGS.companyId });
console.log(result.data.summary);
```

---

## 6. Firestore Security Rules

**Tilføj til `firestore.rules`:**

```javascript
match /companies/{companyId}/onboarding_summary/{summaryId} {
  allow read: if request.auth != null && 
    (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId ||
     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId == companyId);
  allow write: if false;  // Only backend can write
}
```

---

## 7. Deployment

### Ændrede Filer

1. ✅ `functions/index.js`
   - `createOnboardingCheckoutSession` - trial_period_days tilføjet
   - `finalizeOnboardingCheckoutProvisioning` - subscription tracking + onboarding summary + welcome email
   - `buildDetailedOnboardingSummary` - ny helper funktion
   - `sendOnboardingWelcomeEmail` - ny helper funktion
   - `getOnboardingSummary` - ny callable function

### Deploy Commands

**Functions:**
```bash
firebase deploy --only functions
```

**Firestore Rules (hvis opdateret):**
```bash
firebase deploy --only firestore:rules
```

---

## 8. Test Checklist

### Stripe Checkout
- [ ] Checkout session oprettes med trial_period_days: 14
- [ ] Metadata indeholder trialDays: "14"
- [ ] Subscription_data metadata indeholder flow: "onboarding_trial"

### Subscription Tracking
- [ ] Subscription ID gemmes i company.subscription.subscriptionId
- [ ] Trial end date gemmes i company.subscription.trialEndsAt
- [ ] Subscription status gemmes i company.subscription.status

### Onboarding Summary
- [ ] companies/{companyId}/onboarding_summary/current oprettes
- [ ] Indeholder company info (name, cvr, address, etc.)
- [ ] Indeholder selectedSetup (equipment, features)
- [ ] Indeholder billing info (trial, subscription)

### Welcome Email
- [ ] Email content logges til console
- [ ] Indeholder login email
- [ ] Indeholder "Den adgangskode du valgte ved onboarding"
- [ ] Indeholder trial info (14 dage)
- [ ] Indeholder trial end date
- [ ] Logger IKKE password

### Admin Function
- [ ] getOnboardingSummary kan kaldes fra frontend
- [ ] Kræver authentication
- [ ] Verificerer user har adgang til companyId
- [ ] Returnerer full onboarding summary

---

## 9. Næste Skridt

### Email Provider Integration

Når email provider er konfigureret (SendGrid, Mailgun, etc.), opdater `sendOnboardingWelcomeEmail`:

```javascript
// Replace console.log with actual email sending
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to,
  from: 'info@madkontrollen.dk',
  subject,
  text: body,
  html: body.replace(/\n/g, '<br>')
};

await sgMail.send(msg);
```

### Frontend Visning

Opret side til at vise onboarding summary:

**Eksempel:** `public/admin/onboarding-summary.html`

```javascript
const getOnboardingSummaryCallable = httpsCallable(functions, 'getOnboardingSummary');
const result = await getOnboardingSummaryCallable({ companyId: SETTINGS.companyId });

if (result.data.found) {
  const summary = result.data.summary;
  // Display summary.company, summary.selectedSetup, summary.billing
}
```

---

## 10. Logs at Overvåge

### Firebase Console → Functions → Logs

**Søg efter:**
- `[FINALIZE] Subscription retrieved:`
- `[FINALIZE] Onboarding summary saved`
- `[WELCOME_EMAIL] Would send email to:`
- `[FINALIZE] Welcome email sent/logged`

**Eksempel log output:**
```
[FINALIZE] Subscription retrieved: {
  subscriptionId: "sub_xxx",
  status: "trialing",
  trialEnd: "2026-05-24T22:00:00.000Z",
  priceId: "price_xxx"
}

[FINALIZE] Onboarding summary saved to companies/oxzE7wuc0KkurBqvQaks/onboarding_summary/current

[WELCOME_EMAIL] Would send email to: kunde@firma.dk
[WELCOME_EMAIL] Subject: Velkommen til Madkontrollen – jeres egenkontrol er klar
[WELCOME_EMAIL] Body: Hej Firma ApS, ...

[FINALIZE] Welcome email sent/logged to: kunde@firma.dk
```

---

## 11. Sikkerhed

### ✅ Implementeret
- Password sendes IKKE i email
- Password logges IKKE
- Onboarding summary kun læsbar af owner/admin
- Authentication krævet for getOnboardingSummary
- Company access verificeret

### ⚠️ Husk
- Opdater Firestore rules for onboarding_summary collection
- Konfigurer email provider secrets sikkert
- Test trial expiration webhook handling

---

## Support

Ved spørgsmål eller problemer, kontakt udvikler eller se Firebase Console logs.
