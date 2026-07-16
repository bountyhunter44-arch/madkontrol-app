# Checkpoint Policy

Use checkpoints when the project reaches a verified, useful state.

## Required Checkpoints

- Module UI works.
- Module data CRUD works.
- Mobile layout is verified.
- Publish/deploy pipeline works.
- Major bug is fixed and smoke-tested.
- Before starting another module.

## Checkpoint Steps

1. Run `git status --short`.
2. Run scoped `git diff -- path`.
3. Run verification commands.
4. Stage only scoped files.
5. Commit with a clear message.
6. Tag only stable milestones.

## Commit Safety

- Never commit unrelated dirty files.
- Never commit secrets, generated logs, raw API responses, or large blobs.
- If the worktree is dirty from previous work, either isolate the staged files or stop and report the risk.

## Stable Tags

Use tags only for milestones worth returning to:

- `menu-v1-verified`
- `seo-package-deploy-stable`
- `ops-center-v1-stable`

Tag command:

```bash
git tag -a menu-v1-verified -m "Menu v1 verified"
```
