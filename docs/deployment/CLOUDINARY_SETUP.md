# Cloudinary Setup Guide

## Lokal Udvikling

1. **Opret en Cloudinary-konto** (gratis tier er tilstrækkelig):
   - Gå til https://cloudinary.com/users/register_free
   - Opret en konto

2. **Find dine credentials**:
   - Log ind på Cloudinary Dashboard
   - Gå til "Settings" → "API Keys"
   - Kopier:
     - Cloud Name
     - API Key
     - API Secret

3. **Opdater `functions/.env`**:
   ```env
   CLOUDINARY_CLOUD_NAME=din-cloud-name
   CLOUDINARY_API_KEY=din-api-key
   CLOUDINARY_API_SECRET=din-api-secret
   ```

4. **Genstart Firebase Emulator**:
   ```bash
   firebase emulators:start
   ```

## Production Deployment

For production skal credentials gemmes som Firebase Secrets (IKKE i kode):

```bash
# Sæt secrets i Firebase
firebase functions:secrets:set CLOUDINARY_CLOUD_NAME
firebase functions:secrets:set CLOUDINARY_API_KEY
firebase functions:secrets:set CLOUDINARY_API_SECRET

# Deploy functions med secrets
firebase deploy --only functions
```

## Sikkerhed

⚠️ **VIGTIGT**:
- `.env` filen er i `.gitignore` og må ALDRIG committes
- Brug kun `.env` til lokal udvikling
- Production bruger Firebase Secret Manager
- Del ALDRIG dine API secrets offentligt

## Test Upload

Efter setup kan du teste upload ved at:
1. Gå til rutiner.html
2. Åbn en rutine
3. Klik på kamera-ikonet
4. Upload et billede
5. Tjek at det uploader uden fejl

## Troubleshooting

**Fejl: "Cloudinary er ikke konfigureret"**
- Tjek at `functions/.env` eksisterer
- Tjek at alle 3 værdier er sat korrekt
- Genstart Firebase Emulator

**Fejl: "Invalid signature"**
- Tjek at API Secret er korrekt
- Ingen mellemrum før/efter værdier i `.env`

**Fejl: "Upload failed"**
- Tjek Cloudinary Dashboard for kvote-begrænsninger
- Tjek at Cloud Name er korrekt
