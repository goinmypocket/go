# Go

Go is a two-player game of surrounding area on a board of intersections.

## Language

**Intersection**: A point where board lines meet, occupied by at most one stone.
_Avoid_: Square, cell

**Stone**: A black or white playing piece placed on an intersection.

**Group**: A maximal set of same-color stones connected horizontally or vertically.
_Avoid_: Cluster

**Liberty**: An empty intersection horizontally or vertically adjacent to a group.

**Capture**: Removal of a group that has no liberties after an opponent's placement.

**Suicide**: A placement that leaves its own group without liberties after captures.

**Positional superko**: The prohibition on a placement recreating any earlier board position.

**Komi**: Points awarded to White to compensate for Black moving first.

**Dead group**: A group proposed for removal during score agreement because it cannot survive.

**Territory**: Empty intersections in a connected region bordered exclusively by one color.

**Area**: A player's surviving stones plus their territory.

**Score agreement**: The phase in which players identify dead groups and accept the resulting area scores.
