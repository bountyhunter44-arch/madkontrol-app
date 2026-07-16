# Branching Strategy

## Default

- Use one branch per module or risk area.
- Keep feature branches small and verifiable.
- Do not mix cleanup/refactor work with feature work.
- Do not start a second module while the first module lacks verification.

## Branch Names

- `feature/menu-addons`
- `feature/recipes-v1`
- `fix/seo-package-deploy`
- `cleanup/platform-context`
- `hotfix/gateway-cache`

## Main Branch Rules

- `main` should represent deployable state.
- Merge only after verification is documented.
- Avoid giant unverified diff blobs.
- Prefer several scoped commits over one mixed commit.

## Refactor Branches

- Use dedicated cleanup/refactor branches.
- No feature behavior should be hidden inside a refactor branch.
- Run module smoke tests before and after the refactor.
