# Firestore Backup Setup Guide

## Kritisk: Automatisk daglig backup af Firestore data

### Hvorfor er backup vigtig?
- Beskytter mod datatab ved fejl eller sletning
- Lovkrav for fødevarevirksomheder (dokumentation skal gemmes i minimum 2 år)
- Disaster recovery ved systemfejl

---

## 1. OPSÆT AUTOMATISK DAGLIG EXPORT (ANBEFALET)

### A) Opret Cloud Storage Bucket

```bash
# Opret bucket til backups
gsutil mb -p madkontrollen -l europe-west1 gs://madkontrollen-firestore-backups

# Sæt lifecycle policy (slet backups ældre end 90 dage)
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://madkontrollen-firestore-backups
```

### B) Opret Cloud Scheduler Job

```bash
# Installer gcloud CLI hvis ikke allerede installeret
# https://cloud.google.com/sdk/docs/install

# Login
gcloud auth login

# Sæt projekt
gcloud config set project madkontrollen

# Opret scheduler job (kører hver nat kl. 02:00 CET)
gcloud scheduler jobs create http firestore-daily-backup \
  --schedule="0 2 * * *" \
  --time-zone="Europe/Copenhagen" \
  --uri="https://firestore.googleapis.com/v1/projects/madkontrollen/databases/(default):exportDocuments" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --oauth-service-account-email="madkontrollen@appspot.gserviceaccount.com" \
  --message-body='{
    "outputUriPrefix": "gs://madkontrollen-firestore-backups",
    "collectionIds": []
  }'
```

### C) Verificer backup fungerer

```bash
# Trigger backup manuelt for at teste
gcloud scheduler jobs run firestore-daily-backup

# Tjek at backup blev oprettet (efter 5-10 min)
gsutil ls -r gs://madkontrollen-firestore-backups
```

---

## 2. RESTORE FRA BACKUP (DISASTER RECOVERY)

### A) Find backup at restore fra

```bash
# List alle backups
gsutil ls -r gs://madkontrollen-firestore-backups

# Eksempel output:
# gs://madkontrollen-firestore-backups/2026-03-23T02:00:00_12345/
# gs://madkontrollen-firestore-backups/2026-03-22T02:00:00_12344/
```

### B) Restore til nyt projekt (ANBEFALET for test)

```bash
# Opret nyt test-projekt først i Firebase Console
# Derefter restore:

gcloud firestore import \
  gs://madkontrollen-firestore-backups/2026-03-23T02:00:00_12345 \
  --project=madkontrollen-test
```

### C) Restore til produktion (KUN VED KRITISK DATATAB)

⚠️ **ADVARSEL:** Dette overskriver ALLE data i Firestore!

```bash
# STOP alle writes til Firestore først!
# Disable alle Firebase Functions
# Disable frontend adgang

# Restore
gcloud firestore import \
  gs://madkontrollen-firestore-backups/2026-03-23T02:00:00_12345 \
  --project=madkontrollen

# Genaktiver Functions og frontend
```

---

## 3. ALTERNATIV: MANUEL BACKUP (IKKE ANBEFALET)

Hvis du ikke kan opsætte automatisk backup endnu:

```bash
# Manuel export (kør dette dagligt indtil automatisk backup er sat op)
gcloud firestore export gs://madkontrollen-firestore-backups/manual-$(date +%Y-%m-%d)
```

---

## 4. MONITORING AF BACKUPS

### Opsæt alerts hvis backup fejler

```bash
# Opret alert policy i Cloud Monitoring
# 1. Gå til Cloud Console > Monitoring > Alerting
# 2. Create Policy
# 3. Condition: Cloud Scheduler Job execution failed
# 4. Notification: Email til mn@aroid.dk (Support: 20 71 78 61)
```

---

## 5. TEST RESTORE PROCEDURE (VIGTIGT!)

**Test restore minimum 1 gang per måned:**

1. Opret test Firebase projekt
2. Restore seneste backup til test projekt
3. Verificer at data er korrekt
4. Dokumenter test resultat

---

## 6. BACKUP RETENTION POLICY

- **Daglige backups:** Gem i 90 dage
- **Månedlige backups:** Gem i 2 år (lovkrav)
- **Årlige backups:** Gem permanent

### Opsæt månedlige og årlige backups

```bash
# Månedlig backup (1. dag i måneden kl. 03:00)
gcloud scheduler jobs create http firestore-monthly-backup \
  --schedule="0 3 1 * *" \
  --time-zone="Europe/Copenhagen" \
  --uri="https://firestore.googleapis.com/v1/projects/madkontrollen/databases/(default):exportDocuments" \
  --http-method=POST \
  --oauth-service-account-email="madkontrollen@appspot.gserviceaccount.com" \
  --message-body='{
    "outputUriPrefix": "gs://madkontrollen-firestore-backups/monthly",
    "collectionIds": []
  }'

# Årlig backup (1. januar kl. 04:00)
gcloud scheduler jobs create http firestore-yearly-backup \
  --schedule="0 4 1 1 *" \
  --time-zone="Europe/Copenhagen" \
  --uri="https://firestore.googleapis.com/v1/projects/madkontrollen/databases/(default):exportDocuments" \
  --http-method=POST \
  --oauth-service-account-email="madkontrollen@appspot.gserviceaccount.com" \
  --message-body='{
    "outputUriPrefix": "gs://madkontrollen-firestore-backups/yearly",
    "collectionIds": []
  }'
```

---

## 7. OMKOSTNINGER

- **Cloud Storage:** ~$0.02 per GB per måned (ca. 50 kr/måned for 100GB)
- **Cloud Scheduler:** $0.10 per job per måned (ca. 2 kr/måned)
- **Firestore export:** Gratis (inkluderet i Firestore pricing)

**Total:** ~52 kr/måned for fuld backup løsning

---

## 8. TJEKLISTE FØR PRODUKTION

- [ ] Cloud Storage bucket oprettet
- [ ] Daglig backup scheduler job oprettet
- [ ] Månedlig backup scheduler job oprettet
- [ ] Årlig backup scheduler job oprettet
- [ ] Lifecycle policy sat (slet gamle backups)
- [ ] Alert policy oprettet (email ved fejl)
- [ ] Restore procedure testet
- [ ] Dokumentation gemt sikkert

---

## SUPPORT

Hvis du har problemer med backup setup:
- **Aroi-D Support:** mn@aroid.dk | Telefon: 20 71 78 61
- **Firma:** Aroi-D, CVR: 42405000
- Firebase Support: https://firebase.google.com/support
- Cloud Console: https://console.cloud.google.com/firestore/databases/-default-/import-export?project=madkontrollen

**VIGTIGT:** Opsæt backup INDEN du går i produktion!
