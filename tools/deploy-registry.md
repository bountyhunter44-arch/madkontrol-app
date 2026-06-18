# Deploy — Registry

## Hosting deploy
- **Use the clean-room `D:\mk-deploy-focused`** (NOT the dirty repo).
- Only copy/overlay **approved** files into the clean-room (baseline = clean HEAD `public` + overlay
  the specific changed files). Verify markers + `git diff --stat` vs HEAD-baseline before deploying.
- Hosting mirrors the whole `public/` — a folder with only a few files would DELETE the rest of the
  live site. The clean-room must be a complete, deployable site.
- **Command:**
  ```
  firebase deploy --only hosting:madkontrollen --project madkontrollen
  ```
  (When deploying the clean-room folder explicitly: `--public D:\mk-deploy-focused\public`.)

## Rules deploy
- **Requires a separate, explicit GO.**
- `firestore.rules` is deployed as the WHOLE file — it carries all local rules changes, not just the
  latest. Audit the full diff vs HEAD first (brace/paren balance + read/write impact).
- **Command (from `D:\madkontrol-app`):**
  ```
  firebase deploy --only firestore:rules --project madkontrollen
  ```

## Functions deploy
- **NO-GO if any hard-delete exists in runtime** (functions). Soft-archive only.
- Requires a separate audit (the repo HEAD `functions/index.js` has historically been stale vs the
  working tree — confirm what is actually being deployed).
- `node --check functions/index.js` + relevant module files must pass.
- **Command (from `D:\madkontrol-app`):**
  ```
  firebase deploy --only functions --project madkontrollen
  ```

## Order of operations for a focused release
1. Build/refresh `D:\mk-deploy-focused` (HEAD baseline + approved overlays). Verify markers + stat.
2. Hosting deploy (clean-room).
3. Rules deploy ONLY after separate GO + full rules audit.
4. Functions deploy ONLY after separate GO + hard-delete audit + node --check.

## Auth note
- The assistant's environment cannot run authenticated `firebase deploy` — **the user runs all deploys.**
  If a deploy fails with an auth error: `firebase login --reauth` (correct Google account), then retry.
