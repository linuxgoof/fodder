/**
 * One-word (or two very short) fragments for fall marks. Not progress — residue.
 */
const WHISPERS: readonly string[] = [
  'soft',
  'enough',
  'again',
  'nameless',
  'cold',
  'hollow',
  'still',
  'far',
  'low',
  'drift',
  'thin',
  'worn',
  'ache',
  'hush',
  'once',
  'gravity',
  'slower',
  'further',
  'unseen',
  'hungry',
];

export function pickFallWhisper(): string {
  return WHISPERS[(Math.random() * WHISPERS.length) | 0]!;
}
