// Shared types across modules.

export type TrollId =
  | 'break_immediate'
  | 'break_after_short'
  | 'rot_stone'
  | 'creep_down'
  | 'drift_lean'
  | 'sag_line'
  | 'loose_spring'
  | 'fickle'
  | 'weigh_down'
  | 'startle_jolt';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Hold {
  id: string;
  pos: Vec2;
  radius: number;
  /** Troll kind, or `null` for a fair hold. Visually trolls and fair holds look the same. */
  troll: TrollId | null;
  /** +1 / -1 for `drift_lean` trolls, set at layout time. */
  driftDir: 1 | -1;
  // If a hold has broken, it stays broken for this run.
  broken: boolean;
  // Some holds only appear after something in the tower happens.
  // Hidden holds aren't drawn and can't be gripped.
  hidden: boolean;
}

export interface FallMark {
  x: number;
  y: number;
  /** Optional one-word smear; older marks may be missing. */
  whisper?: string | null;
}

// Which hand is which.
export type HandId = 'left' | 'right';
