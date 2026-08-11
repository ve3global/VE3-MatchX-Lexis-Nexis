# Contributing

## Branch naming

`<type>/LN<ticket-id>-<short-slug>`, e.g. `feat/LN7-oauth-token-endpoint`,
`fix/LN17-soft-delete-cascade`. `<type>` is one of `feat`, `fix`, `chore`,
`docs`, `test`, `refactor`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `<type>(scope):
summary`, e.g. `feat(auth): issue bearer token on /oauth/token (LN7)`.
Reference the ticket ID in the body if not in the subject.

## Pull requests

- One epic/ticket per PR where practical.
- PR description links the ticket ID(s) and, for anything touching the
  documented wire contract, the relevant row in
  `planning/constitution.md`'s "Resolved conflicts" table.
- Before opening: `npm run lint`, `npm run typecheck`, `npm test` all pass
  locally (CI re-runs lint on every push and blocks merge on failure).
- Pre-commit hook (Husky + lint-staged) auto-fixes lint/format issues on
  staged files — don't bypass it with `--no-verify`.
