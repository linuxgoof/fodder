import { ALL_TROLL_IDS } from './trolls';
const NEMESIS_KEY = 'fodder_nemesis';
export function setNemesisTroll(t) {
    try {
        localStorage.setItem(NEMESIS_KEY, t);
    }
    catch {
        /* ignore */
    }
}
export function getNemesisTroll() {
    try {
        const v = localStorage.getItem(NEMESIS_KEY);
        if (!v)
            return null;
        return ALL_TROLL_IDS.includes(v) ? v : null;
    }
    catch {
        return null;
    }
}
