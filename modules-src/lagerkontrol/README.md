# Lagerkontrol Modul - Staging

Dette er en staging-struktur for fremtidig lukket Lagerkontrol modul.

Den erstatter ikke live runtime i `public/modules/lagerkontrol` endnu.

## Formål

Lagerkontrol skal kunne blive et selvstændigt Madkontrollen-produkt med:

- egen web-runtime
- egen Android/Capacitor APK senere
- egne assets
- egne tests
- egen backendkontrakt
- integration til platformen via context, entitlements, API og events

## Nuværende live runtime

Live Lagerkontrol ligger stadig i:

```text
public/modules/lagerkontrol/
```

Relateret ældre lager-runtime ligger i:

```text
public/modules/lager/
```

Der er ikke lavet ændringer i de mapper i denne fase.

## Staging-regel

Filer i denne mappe må gerne beskrive fremtidig struktur, men må ikke kalde production Firebase, Firestore, Functions eller Storage direkte endnu.

Alle adapters er derfor stubber, indtil Fase 1B definerer en kontrolleret platform-adapter.

## Første integrationspunkt

Eksisterende callable:

```text
lagerProcessSupplierDocument
```

Fremtidige APIs er dokumenteret i `docs/api-contract.md`.
