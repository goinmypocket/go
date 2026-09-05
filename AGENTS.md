# Working on Go

- Read `docs/game-spec.md`, `CONTEXT.md` and `docs/adr/0001-versioned-area-rules.md`.
- Keep the engine pure and immutable. Games never import from `platform/`.
- Use the existing platform `send`/`subscribe` transport; validate every incoming
  action and derive its color from the table participant's claimed seat.
- Keep game CSS scoped to `.go-game`, including resets and media rules.
- Run `npm --prefix go run typecheck`, `npm --prefix go test`, and
  `npm test -- tests/integration/go.test.ts` from the platform checkout. Also
  run the platform typecheck/build and inspect the UI through the platform.
- Saves replay canonical intents under an explicit ruleset/version. Never
  silently reinterpret old saves after a rules change.
- This is a separate private Git repository. Commit it before updating the
  platform's gitlink. Before publishing the platform, publish its referenced
  Go commit to the private remote. Do not deploy without authorization.
