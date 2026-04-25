import Matter from 'matter-js';
import { Container, Graphics } from 'pixi.js';
import { getNemesisTroll } from './metaProgress';
import { ALL_TROLL_IDS } from './trolls';
import type { Hold, TrollId, Vec2 } from './types';
import type { Physics } from './physics';

// World coordinates: x=0 is wall left edge, y=0 is top of tower.
// Y grows DOWNWARD (standard screen coords), and the starting ledge is at
// a large Y value (near the bottom). The climber goes UP = toward y=0.
// Procedural chunks extend y to negative values forever.

/** Authoring width (px) for the hand-tuned hold X positions; wall scales to the real viewport. */
export const DESIGN_WALL_WIDTH = 800;
/** @deprecated use `Wall#worldWidth` / design width for layout reference */
export const WALL_WIDTH = DESIGN_WALL_WIDTH;
export const WALL_HEIGHT = 2800; // hand-authored floor + first route
export const START_Y = WALL_HEIGHT - 100;
/** Climber must be within this many px (world y) of the top to spawn more. */
const APPEND_PROXIMITY = 400;
const CHUNK_ROWS = 8;
const CHUNK_Y_STEP = 110;
const TROLL_SPAWN_MAX = 0.16; // ramped; base rate below
const X_PITCH = [0.2, 0.48, 0.76, 0.52, 0.3, 0.68, 0.4, 0.58];
/** Cull procedural holds this far (world y) below the climber. */
const CULL_BELOW = 2_200;

export class Wall {
  /** Current wall span in world pixels (matches browser content width at game start). */
  readonly worldWidth: number;
  container: Container;
  holds: Hold[] = [];
  private holdGraphics = new Map<string, Graphics>();
  private wallGfx: Graphics;
  private groundBody: Matter.Body;
  private physics: Physics;
  private upperWalls: Container;
  /**
   * Smallest y of any hold (highest on the wall). Grows more negative
   * as the tower is extended.
   */
  private proceduralTopY: number;
  private nextProceduralId = 0;
  /** Wall art: filled [voidWallYTop, 0) in world y, then lower is more. */
  private voidWallYTop = 0;
  private appendInProgress = false;
  /** How many infinite chunks have been appended (for troll rate + narration). */
  proceduralChunkCount = 0;
  /** Fires after each procedural segment is added. */
  onChunkAppended: (() => void) | null = null;

  constructor(physics: Physics, worldWidth: number) {
    this.physics = physics;
    this.worldWidth = Math.max(280, Math.min(worldWidth, 8192));
    const w = this.worldWidth;
    this.container = new Container();
    this.upperWalls = new Container();
    this.proceduralTopY = 0; // set after first holds

    // Wall background.
    this.wallGfx = new Graphics();
    this.wallGfx
      .rect(0, 0, w, WALL_HEIGHT)
      .fill({ color: 0x2a2a2e });
    // Subtle horizontal banding for visual reference while climbing.
    for (let y = 0; y < WALL_HEIGHT; y += 100) {
      this.wallGfx
        .moveTo(0, y)
        .lineTo(w, y)
        .stroke({ color: 0x1f1f22, width: 2 });
    }
    this.container.addChild(this.wallGfx);
    this.container.addChild(this.upperWalls);

    // Starting ledge — a floor the climber stands on at the bottom.
    const ledgeGfx = new Graphics();
    ledgeGfx
      .rect(0, START_Y, w, 40)
      .fill({ color: 0x1a1a1c });
    this.container.addChild(ledgeGfx);

    this.groundBody = Matter.Bodies.rectangle(
      w / 2,
      START_Y + 20,
      w,
      40,
      {
        isStatic: true,
        label: 'ground',
        friction: 0.9,      // sticky ledge — stops a sliding torso quickly
        restitution: 0.0,   // no bounce
      }
    );
    this.physics.add(this.groundBody);

    // Tall invisible containment (supports infinite height above y=0).
    const wallSpan = 32_000;
    const leftWall = Matter.Bodies.rectangle(
      -100, 0, 200, wallSpan,
      { isStatic: true, label: 'left-wall' }
    );
    const rightWall = Matter.Bodies.rectangle(
      w + 100, 0, 200, wallSpan,
      { isStatic: true, label: 'right-wall' }
    );
    // Safety net far below the ledge in case of any weirdness.
    const catchFloor = Matter.Bodies.rectangle(
      w / 2, START_Y + 600, w * 2, 100,
      { isStatic: true, label: 'catch-floor' }
    );
    this.physics.add(leftWall);
    this.physics.add(rightWall);
    this.physics.add(catchFloor);

    this.generateHolds();
    this.proceduralTopY = this.computeTopY();
  }

  private computeTopY(): number {
    if (this.holds.length === 0) return START_Y;
    return Math.min(...this.holds.map((h) => h.pos.y));
  }

  /** Called each frame. Adds more wall + holds when the climber nears the current top. */
  maybeAppendInfiniteClimb(climberY: number) {
    if (this.appendInProgress) return;
    if (climberY < this.proceduralTopY + APPEND_PROXIMITY) {
      this.appendProceduralChunk();
    }
  }

  private trollSpawnChance(): number {
    // Softer trolls at first procedural bands; more variety higher up.
    return Math.min(
      TROLL_SPAWN_MAX,
      0.055 + this.proceduralChunkCount * 0.0038
    );
  }

  /** When we already know this row is a troll, pick a kind. */
  private pickTrollKindNemesisOrRandom(): TrollId {
    if (Math.random() < 0.18) {
      const n = getNemesisTroll();
      if (n) {
        return n;
      }
    }
    return ALL_TROLL_IDS[
      (Math.random() * ALL_TROLL_IDS.length) | 0
    ] as TrollId;
  }

  private pickProceduralTroll(): TrollId | null {
    if (Math.random() > this.trollSpawnChance()) return null;
    return this.pickTrollKindNemesisOrRandom();
  }

  private appendProceduralChunk() {
    if (this.appendInProgress) return;
    this.appendInProgress = true;
    try {
      const w = this.worldWidth;
      const minYs: number[] = [];
      let trollsInChunk = 0;
      const chunkStartIdx = this.holds.length;
      for (let r = 0; r < CHUNK_ROWS; r++) {
        const y = this.proceduralTopY - CHUNK_Y_STEP * (r + 1);
        const edge = Math.max(20, w * 0.04);
        const nx = edge + (w - 2 * edge) * X_PITCH[r % X_PITCH.length];
        const xJ = (Math.random() * 2 - 1) * 22;
        const x = Math.max(edge, Math.min(w - edge, nx + xJ));
        const troll = this.pickProceduralTroll();
        if (troll) trollsInChunk += 1;
        const id = `p${this.nextProceduralId++}`;
        const h: Hold = {
          id,
          pos: { x, y },
          radius: 14,
          troll,
          driftDir: Math.random() < 0.5 ? 1 : -1,
          broken: false,
          hidden: false,
        };
        minYs.push(y);
        this.holds.push(h);
        this.drawHold(h);
      }
      if (this.proceduralChunkCount > 0 && trollsInChunk === 0) {
        const h = this.holds[chunkStartIdx + 3] ?? this.holds[chunkStartIdx + 0];
        if (h) {
          h.troll = this.pickTrollKindNemesisOrRandom();
        }
      }
      if (minYs.length === 0) return;
      const yMin = Math.min(...minYs);
      this.addWallTextureDownToY(yMin);
      this.proceduralTopY = Math.min(this.proceduralTopY, yMin);
      this.proceduralChunkCount += 1;
      this.onChunkAppended?.();
    } finally {
      this.appendInProgress = false;
    }
  }

  /**
   * After culling, the true highest (smallest y) procedural hold may be higher
   * (less negative) than the last append — `proceduralTopY` can point at a
   * deleted hold, so the tower stops extending and the climb turns into long
   * empty fair-hold runs. Re-sync from data.
   */
  private syncProceduralTopYFromHolds() {
    let minY: number | null = null;
    for (const h of this.holds) {
      if (h.broken) continue;
      if (!h.id.startsWith('p')) continue;
      if (h.pos.y < (minY ?? Number.POSITIVE_INFINITY)) {
        minY = h.pos.y;
      }
    }
    if (minY === null) return;
    this.proceduralTopY = minY;
  }

  private addWallTextureDownToY(newYMin: number) {
    if (newYMin >= this.voidWallYTop) return;
    const hPix = this.voidWallYTop - newYMin;
    const w = this.worldWidth;
    const g = new Graphics();
    g
      .rect(0, newYMin, w, hPix)
      .fill({ color: 0x2a2a2e });
    for (let y = newYMin; y < this.voidWallYTop; y += 100) {
      g.moveTo(0, y)
        .lineTo(w, y)
        .stroke({ color: 0x1f1f22, width: 2 });
    }
    this.upperWalls.addChild(g);
    this.voidWallYTop = newYMin;
  }

  private generateHolds() {
    // Hand-placed route. Ten fair holds are normal; every `troll` kind appears
    // at least once, plus the first-line lie + hidden bypasses.
    const defs: Array<{
      x: number;
      y: number;
      troll: TrollId | null;
      hidden?: boolean;
      driftDir?: 1 | -1;
    }> = [
      { x: 400, y: START_Y - 80, troll: null },
      { x: 360, y: START_Y - 150, troll: 'startle_jolt' },
      { x: 450, y: START_Y - 220, troll: null },
      { x: 400, y: START_Y - 300, troll: null },
      { x: 500, y: START_Y - 360, troll: null },
      { x: 400, y: START_Y - 420, troll: 'loose_spring' },
      { x: 340, y: START_Y - 500, troll: 'drift_lean', driftDir: 1 },
      { x: 400, y: START_Y - 600, troll: 'break_immediate' },
      { x: 580, y: START_Y - 450, troll: null, hidden: true },
      { x: 600, y: START_Y - 550, troll: 'creep_down', hidden: true },
      { x: 480, y: START_Y - 700, troll: null },
      { x: 400, y: START_Y - 800, troll: 'sag_line' },
      { x: 500, y: START_Y - 900, troll: 'fickle' },
      { x: 380, y: START_Y - 980, troll: 'break_after_short' },
      { x: 450, y: START_Y - 1080, troll: 'rot_stone' },
      { x: 400, y: START_Y - 1200, troll: 'weigh_down' },
      { x: 520, y: START_Y - 1320, troll: null },
      { x: 400, y: START_Y - 1450, troll: 'creep_down' },
      { x: 340, y: START_Y - 1560, troll: 'drift_lean', driftDir: -1 },
      { x: 440, y: START_Y - 1700, troll: null },
    ];

    const w = this.worldWidth;
    const xScale = w / DESIGN_WALL_WIDTH;
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const hold: Hold = {
        id: `h${i}`,
        pos: { x: d.x * xScale, y: d.y },
        radius: 14,
        troll: d.troll,
        driftDir: d.driftDir ?? 1,
        broken: false,
        hidden: d.hidden ?? false,
      };
      this.holds.push(hold);
      this.drawHold(hold);
    }
  }

  private drawHold(hold: Hold) {
    const g = new Graphics();
    this.redrawHold(g, hold);
    g.x = hold.pos.x;
    g.y = hold.pos.y;
    this.container.addChild(g);
    this.holdGraphics.set(hold.id, g);
  }

  private redrawHold(g: Graphics, hold: Hold) {
    g.clear();
    if (hold.hidden) {
      // Not drawn at all. The tower has not revealed this one.
      return;
    }
    if (hold.broken) {
      // A stump where the hold was.
      g.circle(0, 0, hold.radius * 0.4)
        .fill({ color: 0x101012 });
      return;
    }
    // Fair and troll holds use the same look. Tells are in behavior, not art.
    g.circle(0, 0, hold.radius)
      .fill({ color: 0x4a443c });
    g.circle(0, 0, hold.radius * 0.55)
      .fill({ color: 0x5c554a });
  }

  /** Move a hold (creep / drift trolls) and keep its sprite in sync. */
  nudgeHoldPos(holdId: string, dx: number, dy: number) {
    const hold = this.holds.find((h) => h.id === holdId);
    if (!hold) return;
    const w = this.worldWidth;
    const margin = Math.max(20, w * 0.035);
    hold.pos.x = Math.max(margin, Math.min(w - margin, hold.pos.x + dx));
    // Tower extends to negative y; trolls can creep far down, but not past ledge+margin.
    hold.pos.y = Math.max(-5e5, hold.pos.y + dy);
    const g = this.holdGraphics.get(holdId);
    if (g) {
      g.x = hold.pos.x;
      g.y = hold.pos.y;
    }
  }

  getHoldById(holdId: string): Hold | undefined {
    return this.holds.find((h) => h.id === holdId);
  }

  breakHold(holdId: string) {
    const hold = this.holds.find((h) => h.id === holdId);
    if (!hold) return;
    hold.broken = true;
    const g = this.holdGraphics.get(holdId);
    if (g) this.redrawHold(g, hold);
  }

  revealHold(holdId: string) {
    const hold = this.holds.find((h) => h.id === holdId);
    if (!hold || !hold.hidden) return;
    hold.hidden = false;
    const g = this.holdGraphics.get(holdId);
    if (g) this.redrawHold(g, hold);
  }

  // Reveal all hidden holds with a given tag, or just all of them. For v0
  // we have one hidden group so "reveal all hidden" is fine.
  revealAllHidden() {
    for (const h of this.holds) {
      if (h.hidden) this.revealHold(h.id);
    }
  }

  // Find the nearest unbroken, non-hidden hold within reach of a point.
  nearestHold(point: Vec2, maxDist: number): Hold | null {
    const preAabb = 140; // quick reject
    let best: Hold | null = null;
    let bestD = maxDist;
    for (const h of this.holds) {
      if (h.broken || h.hidden) continue;
      const rx = h.pos.x - point.x;
      const ry = h.pos.y - point.y;
      if (Math.abs(rx) > preAabb || Math.abs(ry) > preAabb) continue;
      const d = Math.hypot(rx, ry);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (best) return best;
    // Full scan if nothing in AABB (e.g. near edge).
    for (const h of this.holds) {
      if (h.broken || h.hidden) continue;
      const d = Math.hypot(h.pos.x - point.x, h.pos.y - point.y);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  /**
   * Remove procedural holds far below the climber to cap memory/CPU. Keeps
   * holds whose ids are in `keepGripping` (e.g. currently gripped).
   */
  cullDistantHolds(
    climberY: number,
    keepGripping: Set<string>
  ) {
    const cullY = climberY + CULL_BELOW;
    for (let i = this.holds.length - 1; i >= 0; i--) {
      const h = this.holds[i];
      if (keepGripping.has(h.id)) continue;
      if (!h.id.startsWith('p')) continue;
      if (h.pos.y <= cullY) continue;
      this.removeHoldByIndex(i);
    }
    this.syncProceduralTopYFromHolds();
  }

  private removeHoldByIndex(i: number) {
    const h = this.holds[i];
    this.holds.splice(i, 1);
    const g = this.holdGraphics.get(h.id);
    this.holdGraphics.delete(h.id);
    if (g) {
      this.container.removeChild(g);
      g.destroy();
    }
  }
}
