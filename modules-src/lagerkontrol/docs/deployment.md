# Lagerkontrol Pro Hosting Foundation

Denne mappe er den isolerede staging-kilde for Lagerkontrol Pro som separat Firebase Hosting app.

## Firebase project

- Project: `madkontrollen-inventory`
- Hosting site: `madkontrollen-inventory`
- Public directory: `public`
- Primary custom domain: `lager.madkontrollen.dk`
- Firebase domains:
  - `madkontrollen-inventory.web.app`
  - `madkontrollen-inventory.firebaseapp.com`

## Scope

Denne release er read-only/foundation UI:

- Ingen Firestore writes.
- Ingen Storage upload/delete.
- Ingen callable functions.
- Ingen `httpsCallable` eller `getFunctions` i frontend.
- Ingen browser storage mutation.
- Ingen deploy til hovedprojektet `madkontrollen`.

## Preflight

Kør fra modulmappen:

```powershell
cd D:\madkontrol-app\modules-src\lagerkontrol

Get-Location
Test-Path .\firebase.json
Test-Path .\public\index.html
Test-Path .\public\assets\js\lagerkontrol.js
Test-Path .\public\assets\css\lagerkontrol.css

Get-ChildItem .\public -Filter *.html | Select-Object Name
```

Valider konfiguration og statiske filer:

```powershell
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('firebase.json','utf8')); JSON.parse(fs.readFileSync('module.json','utf8')); console.log('JSON OK')"
node --check .\public\assets\js\lagerkontrol.js
node --check .\src\routes\route-registry.js
node --check .\src\adapters\firestore-adapter.js
```

Safety scans:

```powershell
rg -n "setDoc|addDoc|updateDoc|deleteDoc|writeBatch|runTransaction|uploadBytes|uploadString|deleteObject" .
rg -n "httpsCallable|getFunctions" .\public .\src
rg -n "localStorage\.setItem|sessionStorage\.setItem|indexedDB" .\public .\src
```

De eneste tilladte callable-navne i denne fase er dokumenterede eller disabled metadata-referencer. De må ikke være aktive runtime-kald.

## Deploy

Deploy kun fra `D:\madkontrol-app\modules-src\lagerkontrol`.

Brug eksplicit project flag, så hovedprojektets root `.firebaserc` ikke bruges:

```powershell
cd D:\madkontrol-app\modules-src\lagerkontrol
$env:NODE_OPTIONS='--use-system-ca'
firebase.cmd deploy --only hosting --project madkontrollen-inventory --config firebase.json --non-interactive
```

Alternativt kan `.firebaserc.example` kopieres til `.firebaserc` inde i denne mappe, men det er ikke nødvendigt når `--project madkontrollen-inventory` bruges.

## Efter deploy

Tjek første release:

```powershell
curl.exe -I https://madkontrollen-inventory.web.app/
curl.exe -I https://madkontrollen-inventory.firebaseapp.com/
curl.exe -I https://lager.madkontrollen.dk/
```

Manuel smoke:

- `/`
- `/dashboard.html`
- `/varer.html`
- `/bilag.html`
- `/varemodtagelse.html`
- `/optaelling.html`

Alle sider skal loade foundation UI eller read-only/empty state uden crash og uden write/upload/callable flow.
