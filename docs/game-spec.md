# Go game specification

## 1. Architecture contract

Rules are deterministic and independent of presentation and transport. Players
request actions; the authoritative game validates them. All game information is
public. Accounts, table membership, spectators and saves belong to the host platform.

## 2. Entities

The [domain glossary](../CONTEXT.md) defines intersections, stones, groups,
liberties, captures, suicide, positional superko, komi, dead groups, territory,
area and score agreement. Two player seats represent Black and White. A move
is a placement or a pass. A result records the winner and whether victory was
by score or resignation.

## 3. Initialization

Use an empty 9×9, 13×13 or 19×19 board; default to 9×9. Seat 0 is Black,
seat 1 is White. Both seats must be claimed before starting. Black moves first.
White receives 7.5 komi. There are no handicap stones, clocks, bots or randomness
in this version. Captures and consecutive passes begin at zero. The initial
empty position is included in repetition history.

## 4. Flow

Phases are play, score agreement and finished. During play, alternate moves.
Two consecutive passes enter score agreement. Changing the proposed dead groups
invalidates both players' prior confirmations. Two confirmations of the same
proposal finish the game. Either player may resume play instead.

## 5. Actions

### Place

The player selects an empty intersection. Reject if the game is not in play,
it is not their turn, the intersection is outside the board, or it is occupied.
Place their stone on a candidate board, then remove every adjacent opposing
group with no liberties. Reject suicide after these removals. Reject if the
candidate board matches any position in repetition history (positional superko).
Only on success commit the position, increment captures and move number, record
the last move, clear consecutive passes and hand the turn to the other color.
Rejected actions leave all state unchanged.

### Pass

The player whose turn it is may pass, even if the position repeats. Increment
the move number and consecutive passes and switch turns. On the second
consecutive pass enter score agreement with no marked groups or confirmations.

### Mark dead / alive

During score agreement either player selects a stone to toggle its entire group
between proposed dead and alive. Proposals are shared. No stones are actually
removed from the playing board at this point. Reset both confirmations.

### Confirm score

During score agreement either player accepts the current proposal. Accepting
twice is rejected. After both accept, compute the result using §6 and finish.

### Resume play

During score agreement either player may resume. Restore play with the board
unchanged, all proposed removals and confirmations cleared, and consecutive
passes reset. The turn remains with the player who would move after the second
pass. Preserve all repetition history; resumption grants no ko exception.

### Resign

Either player may resign during play or score agreement, regardless of whose
turn it is. A deliberate confirmation is required in the presentation. The
other player wins immediately; no numeric margin is claimed.

## 6. Scoring and end of game

Use Chinese-style area scoring, with the positional superko choice specified
in §5. This is an explicitly defined online ruleset, not a claim of exact
conformance to all Chinese tournament regulations.

For scoring only, remove all groups marked dead. Count each surviving stone
as one point. Flood-fill every empty region using orthogonal adjacency. Award
its intersections to a color only when its bordering stones contain that color
and no opposing color. Mixed-border regions and a wholly empty board are neutral.
Board edges do not add a bordering color. Thus shared liberties in seki are
neutral; exclusively surrounded regions still count under area scoring.
Add komi to White. Captures are shown as information and are not added again.
The higher score wins by the difference; half-point komi prevents ties.

No automatic life-and-death adjudication is attempted. Players must agree on
dead groups or resume and settle disputed groups by play.

## 7. Canonical reminders

- Restatement of §5: capture before checking suicide; passing bypasses superko.
- Restatement of §6: captures are not extra area points.

## 8. Domain invariants

Every placement preserves at least one liberty for each remaining group.
Connections never define player identity. Only a seated player may act as that
seat's color. Spectators can see the public position but cannot change it.
Released or kicked seats can be reclaimed without resetting the position.
Saving and reloading preserves play, proposals, confirmations and ko history.
Loaded saves start in a lobby so accounts can reclaim seats before resuming.

## 9. Configuration

Board size is the only table option; komi and the ruleset are fixed in version 1.
Ruleset and save-format versions are persisted. Invalid options or save records
must be rejected rather than silently producing a different game.

## 10. Presentation framework

Use a board region and an adjacent status/action region; stack on narrow views.
All intersections are keyboard reachable by directional navigation. Labels and
visible focus convey location. Turn, dead markings and final results have text
or shape cues, not color alone. Keep controls usable at browser zoom.

## 11. Regions

- Board: numbered rows, lettered columns (skip I), star points, stones, last
  placement marker, dead-group crosses and territory markers during scoring.
- Players: color, display name, viewer identity, captures and connectivity.
- Actions: turn, move number, pass, confirmed resignation, scoring proposal,
  each player's confirmation, resume play and clear rejection messages.
- Rules: concise explanation of liberties, captures, suicide, repetition,
  passing, score agreement, area and komi.
- Lobby: board size/rules summary and Black/White seat mapping alongside the
  platform's existing seat and start controls.

## 12. Build order

Specify rules, implement and test the engine, adapt the session and persistence,
wire the platform, then implement and verify the rendered interface.

## 13. Verification checklist

- All sizes initialize correctly; invalid sizes fail.
- Capture single/multiple groups, edge groups, shared liberties and capture before suicide.
- Reject occupied points, bounds, suicide, immediate ko and older repetition.
- Pass is legal under repetition; placements reset passes; two passes begin scoring.
- Toggle whole groups; changes reset agreement; spectators and wrong-turn actors cannot act.
- Resume preserves the board, turn and ko history; either player can resign.
- Score live stones, enclosed regions, neutral regions and komi without double-counting captures.
- Save/load during play, scoring and finish; reject invalid versions and replay records.
- Platform create, join, start, reconnect, seat reclaim, save/load and finished autosave work.
- Desktop/mobile rendering, keyboard focus, actions, rejection messages and console health pass.

## Decisions and sources

On 2026-09-05 the user selected Chinese-style area scoring, the three board
sizes, 7.5 komi, two humans, mutual dead-group/score agreement with resumption,
and keeping Go in its own repository, linked by the platform. Default 9×9 and positional
superko are implementation defaults stated during the interview.

Rules cross-checks: [BGA introduction](https://www.britgo.org/intro/intro2.html)
for liberties and suicide, and [BGA rules comparison](https://media-iframe.britgo.org/rules/compare.html)
for area scoring and distinctions among superko rules. The preceding sections,
rather than those external documents, define this implementation completely.
