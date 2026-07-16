# Commit Conventions

Use short, scoped commit messages.

## Format

```text
type(scope): summary
```

## Types

- `feat`: new user-facing capability
- `fix`: bug fix
- `docs`: documentation/workflow only
- `refactor`: behavior-preserving code restructure
- `test`: verification or test changes
- `chore`: tooling, config, maintenance

## Examples

```text
feat(menu): add ordering add-ons foundation
fix(seo): deploy site package when package url exists
docs(workflow): add verification and checkpoint policy
test(menu): add smoke checklist for order mode
```

## Rules

- One module or concern per commit.
- Mention verification in the final handoff, not necessarily in the subject.
- Do not include secrets or customer data in commit messages.
