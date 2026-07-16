# Deployment Checklist

Use this before deploying any module, function, hosting, VPS service, or gateway change.

## Predeploy

- Confirm scope and expected deploy target.
- Run `git status --short`.
- Review `git diff` for scoped files.
- Confirm unrelated dirty files are not part of the deploy.
- Run syntax checks for changed JavaScript:
  - `node --check path/to/file.js`
- Run module-specific verification from `verification.md`.
- Confirm environment/config/secrets are not logged or committed.

## Hosting Deploy

- Use when only public frontend assets changed:
  - `firebase deploy --only hosting`
- Verify deployed route loads.
- Verify browser console has no module boot errors.
- Verify auth/context loading if the route requires it.

## Functions Deploy

- Use precise function targets:
  - `firebase deploy --only functions:functionName`
- Verify callable/request type still matches frontend invocation.
- Check function logs for expected checkpoints.
- Smoke-test from browser or curl as appropriate.

## VPS Deploy

- Run local syntax check first.
- Upload only the changed VPS file.
- Run syntax check on VPS.
- Restart only the impacted PM2 service.
- Tail logs and run curl smoke tests.

## Postdeploy

- Record deploy command.
- Record smoke-test commands and result.
- Record warnings.
- Run `git status --short`.
- Create checkpoint commit if this is a verified breakthrough.
