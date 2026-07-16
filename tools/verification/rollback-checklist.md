# Rollback Checklist

Use this when a deploy or feature breaks live behavior.

## Immediate Triage

- Identify impacted route, module, function, or service.
- Capture exact error text and timestamp.
- Check whether the issue is frontend, backend, Firestore rules, Hosting, VPS, DNS, or cache.
- Preserve current logs before restarting services.

## Git Rollback

- Run `git status --short`.
- Identify the last known-good checkpoint commit or tag.
- Never run broad destructive commands against a dirty worktree.
- Revert only the scoped commit when possible.
- If local dirty work exists, stash or patch-save only with explicit intent.

## Firebase Rollback

- For Hosting, use Firebase console release rollback or redeploy last verified state.
- For Functions, redeploy the last verified function source.
- Confirm callable/onRequest invocation type still matches frontend.

## VPS Rollback

- Restore the previous file from backup or git checkout on the VPS repo.
- Run `node --check` for changed server files.
- Restart only the affected PM2 app.
- Verify with curl and PM2 logs.

## Post-Rollback

- Document root cause.
- Document exact rollback command.
- Create a fix branch for the forward fix.
- Do not continue feature work until smoke tests are green.
