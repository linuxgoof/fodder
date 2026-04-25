import { Application } from 'pixi.js';
import type { HandId, Vec2 } from './types';

export class Input {
  private cameraOffset: () => Vec2;

  mouseScreen: Vec2 = { x: 0, y: 0 };
  mouseWorld: Vec2 = { x: 0, y: 0 };
  gripping = false;
  activeHand: HandId = 'right';

  // Edge-triggered events, consumed once per frame.
  private _grippedThisFrame = false;
  private _releasedThisFrame = false;
  private _switchedThisFrame = false;

  constructor(app: Application, cameraOffset: () => Vec2) {
    this.cameraOffset = cameraOffset;

    const canvas = app.canvas;
    const setFrom = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseScreen.x = e.clientX - rect.left;
      this.mouseScreen.y = e.clientY - rect.top;
    };
    canvas.addEventListener('pointermove', (e) => {
      setFrom(e);
    });
    canvas.addEventListener('pointerdown', (e) => {
      setFrom(e);
      if (e.button === 0) {
        this.gripping = true;
        this._grippedThisFrame = true;
        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
          e.preventDefault();
        }
      } else if (e.button === 2) {
        this.toggleHand();
        e.preventDefault();
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 0) {
        this.gripping = false;
        this._releasedThisFrame = true;
      }
    });
    canvas.addEventListener('pointercancel', () => {
      this.gripping = false;
      this._releasedThisFrame = true;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.toggleHand();
        e.preventDefault();
      }
    });
  }

  /** On-screen or HUD “switch hand” (same as space / RMB). */
  switchHandFromUi() {
    this.toggleHand();
    this._switchedThisFrame = true;
  }

  private toggleHand() {
    this.activeHand = this.activeHand === 'right' ? 'left' : 'right';
    this._switchedThisFrame = true;
  }

  // Call once per frame to update derived state and clear edge flags.
  update() {
    const off = this.cameraOffset();
    this.mouseWorld.x = this.mouseScreen.x + off.x;
    this.mouseWorld.y = this.mouseScreen.y + off.y;
  }

  consumeGripped(): boolean {
    const v = this._grippedThisFrame;
    this._grippedThisFrame = false;
    return v;
  }

  consumeReleased(): boolean {
    const v = this._releasedThisFrame;
    this._releasedThisFrame = false;
    return v;
  }

  consumeSwitched(): boolean {
    const v = this._switchedThisFrame;
    this._switchedThisFrame = false;
    return v;
  }
}
