# Owner Dashboard Guide

## 🎯 Formål
Owner Dashboard giver dig som super-admin fuldt overblik over alle Madkontrollen instanser i Ringkøbing (og resten af Danmark).

## 🔐 Adgang

### Trin 1: Opret Super-Admin Bruger
1. Opret en bruger i Firebase Authentication med din email
2. Gå til Firestore og find din bruger i `users` collection
3. Sæt `role` feltet til `"super-admin"`

### Trin 2: Opdater Email Whitelist
Rediger følgende filer og udskift `'your-email@example.com'` med din rigtige email:

**Firestore Rules** (`firestore.rules`):
```javascript
function isSuperAdmin() {
  return signedIn() && 
    userRole() == 'super-admin' &&
    request.auth.token.email in [
      'din-email@example.com'  // <-- Udskift med din email
    ];
}
```

**Owner Dashboard** (`public/admin/owner-dashboard.html`):
```javascript
const SUPER_ADMIN_EMAILS = [
    'din-email@example.com'  // <-- Udskift med din email
];
```

### Trin 3: Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

## 📊 Funktioner

### 1. Master Dashboard
**URL:** `/admin/owner-dashboard.html`

Viser:
- ✅ Antal aktive virksomheder
- ✅ Brugere online nu (aktive sidste 24 timer)
- ✅ Åbne afvigelser på tværs af alle kunder
- ✅ System status (Cloudinary, OpenAI, Firebase)

### 2. Virksomhedsoversigt
Tabel med alle tilmeldte virksomheder:
- Virksomhedsnavn
- CVR-nummer
- Antal brugere
- Status (Aktiv/Inaktiv)
- **"Se som kunde"** knap for impersonation

### 3. Impersonation (Se-som funktion)
Klik på **"👁️ Se som kunde"** for at:
- Se deres dashboard præcis som de ser det
- Teste deres A-til-Å flow
- Identificere problemer proaktivt
- Give bedre support

**Sådan virker det:**
1. Klik på "Se som kunde" ved en virksomhed
2. Du bliver omdirigeret til deres dashboard
3. Lilla banner vises øverst: "Super-Admin Mode"
4. Klik "← Tilbage til Owner Dashboard" for at afslutte

### 4. Seneste Afvigelser
Viser de 10 seneste afvigelser på tværs af alle kunder:
- Virksomhedsnavn
- Beskrivelse af afvigelse
- Tid siden oprettelse

## 🔒 Sikkerhed

### Email Whitelist
Kun emails i whitelist kan få super-admin adgang, selv hvis `role` er sat til `"super-admin"`.

### Firestore Rules
Super-admin kan:
- ✅ Læse alle `users`, `companies`, `organizations`, `locations`
- ✅ Læse alle `deviations` på tværs af virksomheder
- ❌ **IKKE** skrive/slette data (kun læse)

### Impersonation
- Bruger sessionStorage (kun i browser-session)
- Ingen permanente ændringer
- Kan afsluttes når som helst

## 📱 Brug i Ringkøbing

### Proaktiv Support
1. Tjek Owner Dashboard hver morgen
2. Se antal aktive brugere
3. Gennemgå seneste afvigelser
4. Kontakt kunder der har problemer

### Onboarding Nye Kunder
1. Opret kunde via `/scripts/setup-customer.js`
2. Tjek i Owner Dashboard at de vises
3. Brug impersonation til at verificere deres setup
4. Guide dem gennem første dag

### Fejlfinding
1. Kunde rapporterer problem
2. Brug impersonation til at se deres view
3. Identificer problemet
4. Ret fejlen
5. Verificer løsning i deres view

## 🚀 Deployment

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy hosting (inkl. Owner Dashboard)
firebase deploy --only hosting
```

## 📋 Tjekliste: Før Første Brug

- [ ] Oprettet super-admin bruger i Firebase Auth
- [ ] Sat `role: "super-admin"` i Firestore users collection
- [ ] Opdateret email whitelist i `firestore.rules`
- [ ] Opdateret email whitelist i `owner-dashboard.html`
- [ ] Deployed Firestore rules
- [ ] Deployed hosting
- [ ] Testet adgang til `/admin/owner-dashboard.html`
- [ ] Testet impersonation funktion
- [ ] Verificeret at normale brugere IKKE kan tilgå Owner Dashboard

## 🎓 Best Practices

### Daglig Rutine
- **Morgen:** Tjek Owner Dashboard for nye afvigelser
- **Middag:** Se antal aktive brugere
- **Aften:** Gennemgå dagens statistik

### Kunde Support
- Brug impersonation FØR du ringer til kunden
- Tag screenshots af deres view
- Dokumenter problemer i deres context

### Sikkerhed
- Log altid ud efter impersonation
- Del ALDRIG super-admin credentials
- Brug kun impersonation til support/fejlfinding

## 🆘 Fejlfinding

### "Adgang Nægtet"
- Tjek at din email er i whitelist
- Verificer at `role: "super-admin"` i Firestore
- Prøv at logge ud og ind igen

### Virksomheder vises ikke
- Tjek at `companies` collection eksisterer
- Verificer Firestore rules er deployed
- Se browser console for fejl

### Impersonation virker ikke
- Tjek at `impersonation.js` er deployed
- Verificer at banner vises
- Prøv at clear browser cache

## 📞 Support

Hvis du har problemer med Owner Dashboard:
1. Tjek browser console for fejl
2. Verificer Firestore rules er korrekte
3. Test med en test-virksomhed først
4. Dokumenter fejlen med screenshots

---

**Held og lykke med dine kunder i Ringkøbing! 🚀**
