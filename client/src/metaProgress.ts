import type { TrollId } from './types';
import { ALL_TROLL_IDS } from './trolls';

const NEMESIS_KEY = 'fodder_nemesis';

export function setNemesisTroll(t: TrollId): void {
  try {
    localStorage.setItem(NEMESIS_KEY, t);
  } catch {
    /* ignore */
  }
}

export function getNemesisTroll(): TrollId | null {
  try {
    const v = localStorage.getItem(NEMESIS_KEY);
    if (!v) return null;
    return (ALL_TROLL_IDS as readonly string[]).includes(v) ? (v as TrollId) : null;
  } catch {
    return null;
  }
}
