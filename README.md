# Go

A two-player Go implementation for In My Pocket. This private repository is
consumed as the platform's `go/` Git submodule and `@in-my-pocket/go` package.

Choose **Go** when creating a table. Pick 9×9 (default), 13×13 or 19×19.
Seat 1 plays Black, seat 2 plays White. Both players claim seats, then the host
starts. Select intersections to play, or use the arrow keys and Enter/Space.

The rules use Chinese-style area scoring, 7.5 komi, no suicide and positional
superko. After two passes, either player can mark dead groups; both must confirm
the same score. Resume play to resolve disagreements. Resignation requires a
confirmation. Spectators, reconnects and saves use the platform's existing controls.

Go is integrated with the platform's guest access. Open a shared `/table/<id>`
invitation without logging in and claim an open seat. Returning in the same
browser preserves the seat. **Player & recovery** creates a private recovery
link for restoring the same player, color, seats, saves and host ownership in
another browser. Share the table invitation with opponents; keep the recovery
link private.

## Development

From the populated platform repository:

```sh
npm ci
npm run dev
npm --prefix go run typecheck
npm --prefix go test
npm test -- tests/integration/go.test.ts
npm run typecheck
npm run build
```

The platform runs the browser and server. The package does not start another
server. Its React entry accepts the transport-neutral `PlatformGameContext`
(`send`/`subscribe`); another host can provide that same interface.

- `engine/`: pure immutable rules, groups, area scoring and coordinates.
- `server/GoSession.ts`: seats, account ownership, protocol validation, snapshots
  and versioned replay saves. Account identities never enter the rules engine.
- `shared/protocol.ts`: action and public-view contract. Revisions prevent stale
  moves and confirmations from accepting a newer proposal accidentally.
- `web/`: responsive SVG board, external-store subscription and action panel.
- `tests/`: rules, authorization, session lifecycle and persistence checks.
- [Game specification](docs/game-spec.md) and [glossary](CONTEXT.md): rules and vocabulary.

Add new rule actions to the action union, parser, reducer, specification and
tests before wiring a control. Preserve `area-psk-v1` replay semantics; introduce
an explicit migration or new ruleset for incompatible changes.

No AI opponent, clocks, handicap setup, undo or automatic life-and-death judgment
are included in this version. Players settle dead-group disagreements by play.
