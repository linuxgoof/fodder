import { Container, Graphics, Text } from 'pixi.js';
import type { FallMark, Vec2 } from './types';

const WALL_ID = 'proto-wall-01';

/** How often to merge in falls from other climbers (ms). */
const MARKS_POLL_INTERVAL_MS = 20_000;

export class Memory {
  container: Container;
  private gfx: Graphics;
  private textLayer: Container;
  private marks: FallMark[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;

  constructor() {
    this.container = new Container();
    this.gfx = new Graphics();
    this.textLayer = new Container();
    this.container.addChild(this.gfx);
    this.container.addChild(this.textLayer);
  }

  /**
   * Periodically refetch marks so other players' falls can appear in-session
   * without a full page reload.
   */
  startMarksPolling(): void {
    if (this.pollTimer !== null) return;
    this.pollTimer = setInterval(() => {
      void this.loadMarks();
    }, MARKS_POLL_INTERVAL_MS);
  }

  stopMarksPolling(): void {
    if (this.pollTimer === null) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  async loadMarks() {
    if (this.pollInFlight) return;
    this.pollInFlight = true;
    try {
      const res = await fetch(`/api/marks?wall=${WALL_ID}`);
      if (!res.ok) return;
      const data = (await res.json()) as { marks: FallMark[] };
      this.marks = data.marks ?? [];
      this.redraw();
    } catch (e) {
      // Backend down is fine; the tower simply has no memory to offer.
      console.warn('could not reach the tower memory:', e);
    } finally {
      this.pollInFlight = false;
    }
  }

  /**
   * Clear the local smears and the server store for this wall (all players’
   * marks for this wall are removed).
   */
  async clearAllMarksOnServerAndLocal(): Promise<void> {
    this.marks = [];
    this.redraw();
    try {
      const res = await fetch('/api/clear_marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wall: WALL_ID }),
      });
      if (!res.ok) {
        console.warn('could not clear tower memory on server:', res.status);
      }
    } catch (e) {
      console.warn('clear marks request failed:', e);
    }
  }

  async recordFall(pos: Vec2, whisper: string) {
    this.marks.push({ x: pos.x, y: pos.y, whisper });
    this.redraw();
    try {
      await fetch('/api/fall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wall: WALL_ID,
          x: pos.x,
          y: pos.y,
          whisper,
        }),
      });
    } catch (e) {
      // Silent — the tower will not hear this one.
      console.warn('fall not recorded to backend:', e);
    }
  }

  private redraw() {
    this.gfx.clear();
    const old = this.textLayer.removeChildren();
    for (const c of old) c.destroy();
    for (const m of this.marks) {
      // Faint reddish-brown smear. Older climbers.
      this.gfx.circle(m.x, m.y, 6)
        .fill({ color: 0x5a2e28, alpha: 0.35 });
      this.gfx.circle(m.x, m.y, 3)
        .fill({ color: 0x3a1e18, alpha: 0.5 });
      const w = m.whisper?.trim();
      if (w) {
        const t = new Text({
          text: w,
          style: {
            fontFamily: 'Georgia, serif',
            fontSize: 7,
            fill: 0x4a3a32,
            fontStyle: 'italic' as const,
            letterSpacing: 0.2,
          },
        });
        t.anchor.set(0.5, 1);
        t.x = m.x;
        t.y = m.y - 4;
        t.alpha = 0.4;
        this.textLayer.addChild(t);
      }
    }
  }
}
