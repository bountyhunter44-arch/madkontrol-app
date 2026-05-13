# Hostinger SMTP Email Implementation

## Oversigt

Implementeret Hostinger SMTP email via nodemailer til velkomstmail efter onboarding.

---

## ✅ Implementering

### 1. Firebase Secrets

**Secrets oprettet:**
```bash
firebase functions:secrets:set EMAIL_USER
firebase functions:secrets:set EMAIL_PASSWORD
```

**Secrets defineret i `functions/index.js` (linje 47-48):**
```javascript
const EMAIL_USER = defineSecret("EMAIL_USER");
const EMAIL_PASSWORD = defineSecret("EMAIL_PASSWORD");
```

---

### 2. Nodemailer SMTP Configuration

**Hostinger SMTP Settings:**
- **Host:** smtp.hostinger.com
- **Port:** 465
- **Secure:** true (SSL/TLS)
- **From:** "Madkontrollen" <info@madkontrollen.dk>

**Transporter initialiseres per-call (ikke globalt):**
```javascript
const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 465,
  secure: true,
  auth: {
    user: emailUser,
    pass: emailPassword
  }
});
```

---

### 3. Email Funktion

**Funktion:** `sendOnboardingWelcomeEmail` (linje 957-1115)

**Input:**
```javascript
{
  to: string,
  companyName: string,
  locationName: string,
  loginEmail: string,
  onboardingSummary: object,
  billing: object,
  emailUser: string,
  emailPassword: string
}
```

**Output:**
```javascript
{
  sent: boolean,
  messageId: string,  // hvis sent: true
  error: string,      // hvis sent: false
  to: string,
  subject: string
}
```

---

### 4. Email Indhold

**Emne:**
```
Velkommen til Madkontrollen – jeres egenkontrol er klar
```

**Text Body:**
```
Hej [firma],

Jeres Madkontrollen-konto er nu oprettet.

Login:
Email: [loginEmail]
Login-side: https://madkontrollen.web.app/login.html
Adgangskode: Den adgangskode du valgte ved onboarding. Hvis du har glemt den, kan du nulstille den via login-siden.

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

**HTML Body:**
- Responsivt design
- Styled med inline CSS
- Login link klikkbar
- Struktureret med info-bokse
- Professional layout

---

### 5. Integration i Provisioning Flow

**Funktion:** `finalizeOnboardingCheckoutProvisioning`

**Secrets tilføjet (linje 7957):**
```javascript
exports.finalizeOnboardingCheckoutProvisioning = functions.https.onCall(
  { secrets: ["FUNCTIONS_CONFIG_EXPORT", "EMAIL_USER", "EMAIL_PASSWORD"] },
  async (request, context) => {
```

**Email sendes efter provisioning (linje 8384-8400):**
```javascript
try {
  await sendOnboardingWelcomeEmail({
    to: actorEmail,
    companyName: companyDisplayName,
    locationName: locationDisplayName,
    loginEmail: actorEmail,
    onboardingSummary: detailedSummary,
    billing: detailedSummary.billing,
    emailUser: EMAIL_USER.value(),
    emailPassword: EMAIL_PASSWORD.value()
  });
  console.log("[FINALIZE] Welcome email sent to:", actorEmail);
} catch (emailErr) {
  console.error("[FINALIZE] Failed to send welcome email:", emailErr.message);
  // Don't throw - continue with provisioning even if email fails
}
```

---

## 🔒 Sikkerhed

### ✅ Implementeret

1. **Secrets ikke hardcoded:**
   - EMAIL_USER og EMAIL_PASSWORD gemmes i Firebase Secret Manager
   - Tilgås via `EMAIL_USER.value()` og `EMAIL_PASSWORD.value()`

2. **Password sendes IKKE i email:**
   - Tekst: "Den adgangskode du valgte ved onboarding"
   - Alternativ: "Hvis du har glemt den, kan du nulstille den via login-siden"

3. **Logging uden secrets:**
   - Logger email recipient, subject, company name
   - Logger IKKE email credentials
   - Logger IKKE password

4. **Error handling:**
   - Email fejl stopper ikke provisioning
   - Fejl logges men provisioning fortsætter
   - Ingen sensitive detaljer i error messages

---

## 📊 Logging

### Success Logs

```
[WELCOME_EMAIL] Preparing to send email to: kunde@firma.dk
[WELCOME_EMAIL] Subject: Velkommen til Madkontrollen – jeres egenkontrol er klar
[WELCOME_EMAIL] Company: Firma ApS
[WELCOME_EMAIL] Email sent successfully
[WELCOME_EMAIL] Message ID: <xxx@smtp.hostinger.com>
[WELCOME_EMAIL] Response: 250 2.0.0 OK
[FINALIZE] Welcome email sent to: kunde@firma.dk
```

### Error Logs

```
[WELCOME_EMAIL] Preparing to send email to: kunde@firma.dk
[WELCOME_EMAIL] Subject: Velkommen til Madkontrollen – jeres egenkontrol er klar
[WELCOME_EMAIL] Company: Firma ApS
[WELCOME_EMAIL] Failed to send email: Connection timeout
[WELCOME_EMAIL] Error code: ETIMEDOUT
[FINALIZE] Failed to send welcome email: Connection timeout
```

---

## 🚀 Deployment

### 1. Set Secrets (ALLEREDE GJORT)

```bash
firebase functions:secrets:set EMAIL_USER
# Enter: info@madkontrollen.dk

firebase functions:secrets:set EMAIL_PASSWORD
# Enter: [Hostinger SMTP password]
```

### 2. Deploy Functions

```bash
firebase deploy --only functions
```

**Deployede funktioner:**
- `finalizeOnboardingCheckoutProvisioning` (opdateret med EMAIL secrets)

---

## 🧪 Test

### Test Email Sending

1. **Gennemfør onboarding:**
   - Gå til onboarding flow
   - Udfyld firma info
   - Gennemfør Stripe checkout
   - Afvent provisioning

2. **Tjek Firebase Logs:**
   ```
   firebase functions:log --only finalizeOnboardingCheckoutProvisioning
   ```

3. **Verificer email modtaget:**
   - Tjek inbox for login email
   - Verificer subject line
   - Verificer email indhold
   - Verificer login link virker

### Test Email Content

**Verificer:**
- ✅ Firma navn korrekt
- ✅ Login email korrekt
- ✅ Login link: https://madkontrollen.web.app/login.html
- ✅ Valgt opsætning vises (køl, opvarmning, etc.)
- ✅ Equipment liste korrekt
- ✅ Trial info: 14 dage
- ✅ Trial udløbsdato korrekt
- ✅ Ingen password i email
- ✅ HTML formatering korrekt

---

## 📝 Ændrede Filer

### `functions/index.js`

**Linje 47-48:** Tilføjet EMAIL_USER og EMAIL_PASSWORD secrets
```javascript
const EMAIL_USER = defineSecret("EMAIL_USER");
const EMAIL_PASSWORD = defineSecret("EMAIL_PASSWORD");
```

**Linje 957-1115:** Opdateret `sendOnboardingWelcomeEmail` funktion
- Tilføjet nodemailer import
- Tilføjet Hostinger SMTP transporter
- Tilføjet HTML email template
- Tilføjet equipment type names (dansk)
- Tilføjet login URL
- Tilføjet robust error handling
- Tilføjet logging uden secrets

**Linje 7957:** Tilføjet EMAIL secrets til finalizeOnboardingCheckoutProvisioning
```javascript
{ secrets: ["FUNCTIONS_CONFIG_EXPORT", "EMAIL_USER", "EMAIL_PASSWORD"] }
```

**Linje 8393-8394:** Pass EMAIL secrets til sendOnboardingWelcomeEmail
```javascript
emailUser: EMAIL_USER.value(),
emailPassword: EMAIL_PASSWORD.value()
```

---

## 🔧 Troubleshooting

### Email ikke modtaget

1. **Tjek Firebase Logs:**
   ```bash
   firebase functions:log --only finalizeOnboardingCheckoutProvisioning
   ```

2. **Verificer secrets:**
   ```bash
   firebase functions:secrets:access EMAIL_USER
   firebase functions:secrets:access EMAIL_PASSWORD
   ```

3. **Tjek Hostinger SMTP status:**
   - Login til Hostinger
   - Verificer email konto aktiv
   - Tjek SMTP adgang aktiveret

### SMTP Connection Error

**Mulige årsager:**
- Forkert EMAIL_USER eller EMAIL_PASSWORD
- Hostinger SMTP port blokeret
- SSL/TLS certifikat problem
- Firewall blokerer port 465

**Løsning:**
1. Verificer credentials i Hostinger
2. Test SMTP connection lokalt
3. Tjek Firebase network policies

### Email i spam

**Løsning:**
- Verificer SPF record for madkontrollen.dk
- Tilføj DKIM signing
- Verificer DMARC policy
- Kontakt Hostinger support

---

## 📚 Dependencies

### Nodemailer

**Version:** 8.0.7 (allerede installeret)

**Package.json:**
```json
{
  "dependencies": {
    "nodemailer": "^8.0.7"
  }
}
```

**Ingen nye dependencies tilføjet** ✅

---

## 🎯 Næste Skridt

### Email Templates

Overvej at oprette email templates for:
- Password reset
- Subscription renewal reminder
- Trial ending reminder
- Payment failed notification
- New feature announcements

### Email Analytics

Implementer tracking for:
- Email delivery rate
- Open rate
- Click-through rate (login link)
- Bounce rate

### Email Provider Backup

Overvej backup email provider hvis Hostinger fejler:
- SendGrid
- Mailgun
- AWS SES

---

## Support

Ved problemer med email sending:
1. Tjek Firebase Console → Functions → Logs
2. Verificer Hostinger SMTP credentials
3. Test email sending manuelt via nodemailer
4. Kontakt Hostinger support hvis SMTP ikke virker
