# fodder — design

## Identity

A Foddian troll game that is melancholy, beautiful, endless, and remembers you.
The rage is delivered through loss, not mockery. The tower doesn't laugh at the
climber. The tower is sad for them. And that's worse.

## Fixed design rules

These are not up for revision without deliberate discussion.

1. **No humor in the game's voice.** The player can laugh; the game cannot.
2. **No fourth-wall breaks.** All trolling stays inside the fiction.
3. **No voiced narrator.** Text only, ambiguous presence, sparing.
4. **No achievements, no progress bars, no percent complete.** The climb is not
   measurable.
5. **No true ending.** The tower goes forever. Recursions repeat with variation.
6. **Silence is a feature.** Music and narration are rare by default.
7. **The player is alone, but not the first.** Evidence of others is everywhere.
8. **Every troll has a tell in retrospect.** Unfair once; fair forever after.
9. **Cruelty budget is small.** Most failures are honest difficulty. The troll
   layer is occasional, patient, cumulative.
10. **The climber never dies, only falls.** Stopping is not an option the world
    offers.

## Troll layer ratios

- ~70% of failures: honest, learnable difficulty.
- ~25%: trolls the player can eventually learn.
- ~5%: pure unlearnable chaos, sprinkled to keep paranoia alive.

## Structural frame

**Recursive Tower + Climb That Remembers, merged.**

- The climber reaches a summit. The summit is revealed to be the top of a
  sub-tower inside a larger structure. This recurs indefinitely.
- The first recursion hits at roughly 90 minutes of good play.
- Subsequent recursions change the *nature* of scale, not just the magnitude.
  (Sideways towers, inverted towers, towers inside climbers, etc.)
- The tower records the player's behavior and subtly adapts: trust erosion,
  path closure, haunted rest points, ghost progress markers.
- Memory is also shared across all players via the backend. Falls, handprints,
  and rest points from other climbers appear in every player's game.

## Narrator

- Text only, small, bottom of screen, fades in and out.
- Register: old, formal, tired. Dark Souls item descriptions. Dear Esther.
- Never more than one or two lines at a time.
- Addresses sometimes "you", sometimes someone else. Ambiguous.
- Occasionally misremembers the player. Is the narrator confused, or is there
  another climber? Never resolved.
- Develops affection over time. The affection itself becomes a source of dread.
- Never makes jokes. Never winks. Never modern.

## Prototype scope (v0)

The current build target. Nothing more.

- One vertical wall, ~3 screens tall.
- Climber with two-hand grip physics (one physics body + hand targets).
- Mouse controls: move to aim a hand, click-and-hold to grip, release to let go;
  space or right-click switches active hand.
- Handful of holds, stone wall, simple art.
- Gravity, momentum, falling consequences.
- **Fall / reset:** when the climber is back on the starting ledge and still,
  they are moved to a fair stand position on the ledge (no separate slide
  animation; physics settle, then reset).
- **One troll**: one visually-identical hold that gives way on grip; alternate
  holds may stay hidden until that reveal.
- **Narrator (sparse, one line on screen at a time):** an opening line; after the
  first *meaningful* fall (or the treacherous line first, in which case the
  generic “first fall” line is skipped); plus short lines tied to the treacherous
  hold reveal. Still no tutorial voice and no winking tone.
- Backend: record falls, render other players' falls as faint marks; the client
  also refreshes marks periodically so in-session “ghosts” from others can
  appear without reloading.

Explicitly out of scope for v0: recursion, multi-wall, polish, sound, full
narrator system, full troll taxonomy, memory beyond fall coordinates, touch
controls.

## Post-v0 roadmap (separate milestone)

Planned as later work, not part of the v0 prototype. Order is flexible.

- **Recursion:** summit reveals a sub-tower; scale and nature of space shift over
  time (per *Structural frame* above).
- **Sound and music:** rare, intentional; still consistent with *Silence is a
  feature*.
- **Deeper memory:** trust erosion, path closure, haunted rest points, ghost
  progress — beyond fall coordinates.
- **Full troll taxonomy:** more holds and tells, while keeping the cruelty
  budget and ratio rules.
- **Touch / mobile** input if the experience should be playable off desktop.
- **Hardening:** deploy story (see repo `deploy/`), rate limits, and any DB
  scaling story if traffic grows.
