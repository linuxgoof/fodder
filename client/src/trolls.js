// Troll copy and tuning. TrollId lives in `types`.
/** All troll kinds (for weighted random on procedural holds). */
export const ALL_TROLL_IDS = [
    'break_immediate',
    'break_after_short',
    'rot_stone',
    'creep_down',
    'drift_lean',
    'sag_line',
    'loose_spring',
    'fickle',
    'weigh_down',
    'startle_jolt',
];
/** One spare line the tower might allow after you’ve met this troll (first time, once). */
export const trollNarration = {
    break_immediate: 'not all of them bear weight.',
    break_after_short: 'it waited. then it did not.',
    rot_stone: 'it was always leaving.',
    creep_down: 'the stone is tired. it goes where gravity pulls it.',
    drift_lean: 'it leans, as if the wall were deciding.',
    sag_line: 'this line sags. you feel it in the shoulder first.',
    loose_spring: 'a grip is not a promise, only pressure.',
    fickle: 'something lets go before you do.',
    weigh_down: 'the body learns what the hold already knew: weight.',
    startle_jolt: 'the wall shudders, once, and is still.',
};
// Tunables, kept in one place.
export const TROLL = {
    breakImmediateDelayMs: 80,
    breakAfterShortMs: 520,
    rotStoneMs: 2000,
    fickleAfterMs: 1500,
    creepDownPerSec: 14,
    driftLeanPerSec: 9,
    sagCreepPerSec: 24,
    looseStiffness: 0.28,
    looseDamping: 0.12,
    weighSwingMul: 0.38,
    joltY: 0.018, // body impulse scale (tuned to mass)
    joltJitter: 0.006,
};
