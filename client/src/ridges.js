/**
 * Nameless "ridges" — not distance percent, just where you are in the climb.
 * Step in px between named bands (world climb from ledge).
 */
export const RIDGE_STEP_PX = 320;
const RIDGE_NAMES = [
    'the mouth',
    'the lip',
    'the band of cold',
    'the fold',
    'the overhang of forgetting',
    'the seam',
    'the false rest',
    'the narrow prayer',
    'the lip again',
    'the gray band',
    'the hollow',
    'the other mouth',
    'the thin place',
    'the last seam',
    'the cold again',
    'deeper hush',
];
const RIDGE_SAY = [
    'you leave the first silence.',
    'the air changes here.',
    'a little weight stays behind.',
    'it remembers someone else for a while.',
    'breathe as if the wall could hear you.',
    'one more nameless line.',
    'it does not care if you stop. it waits.',
    'a thin sound you cannot place.',
    'higher, and the ledge is only a thought.',
    'this band has no use for you — only hold.',
    'further, and the tower thins its patience.',
    'another breath and the stone forgets the last one.',
    'hush. the climb does not need your story.',
    'a ridge without reward — only the next hold.',
    'colder, or only your hands say so.',
    'depth without bottom — the ledge is far.',
];
export function ridgeBandForClimbed(climbedPx) {
    if (climbedPx < 0)
        return 0;
    return Math.floor(climbedPx / RIDGE_STEP_PX);
}
export function ridgeNameForBand(band) {
    if (band < 0)
        return RIDGE_NAMES[0];
    return RIDGE_NAMES[band % RIDGE_NAMES.length];
}
export function ridgeSayForBand(band) {
    if (band <= 0)
        return '';
    const idx = (band - 1) % RIDGE_SAY.length;
    return RIDGE_SAY[idx];
}
/** Subtle tints (multiply on world container) by band — cold, then warm dust. */
export const RIDGE_TINTS = [
    0xffffff, 0xf2f0ee, 0xeeeaf0, 0xe8eef2, 0xefe8e4, 0xeaecf0, 0xe8e6ea,
    0xedeaec, 0xe6e8ec, 0xeee6e2, 0xe8eaeb, 0xefece8, 0xeae6ee, 0xe2e6ea,
    0xebeee8, 0xe4e2e6,
];
export function worldTintForBand(band) {
    if (band < 0)
        return 0xffffff;
    return RIDGE_TINTS[band % RIDGE_TINTS.length];
}
