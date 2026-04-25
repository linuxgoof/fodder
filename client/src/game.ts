import { Application, Container } from 'pixi.js';
import Matter from 'matter-js';
import {
  playPlatformBonk,
  setAmbienceVolume,
  setFallWhooshState,
  startAmbienceOnUserIntent,
} from './audio/ambience';
import { Physics } from './physics';
import { proceduralMurmurs } from './proceduralMurmurs';
import { Wall, START_Y } from './wall';
import { Climber } from './climber';
import { Input } from './input';
import { Memory } from './memory';
import { Narrator } from './narrator';
import { TROLL, trollNarration } from './trolls';
import type { Hold, TrollId, Vec2 } from './types';
import { pickFallWhisper } from './fallWhispers';
import { setNemesisTroll } from './metaProgress';
import {
  ridgeBandForClimbed,
  ridgeNameForBand,
  ridgeSayForBand,
  worldTintForBand,
} from './ridges';

const MAIN_LIE_ID = 'h7';

const CREEPY_TROLLS: readonly TrollId[] = [
  'creep_down',
  'sag_line',
  'drift_lean',
];

function worldWidthFromApp(app: Application): number {
  const w = app.screen.width;
  if (w > 0) return w;
  if (typeof window !== 'undefined' && window.innerWidth > 0) {
    return window.innerWidth;
  }
  return 800;
}

export class Game {
  private app: Application;
  physics: Physics;
  private wall!: Wall;
  private climber!: Climber;
  private memory!: Memory;
  input: Input;
  private narrator: Narrator;

  private worldContainer: Container;
  private uiContainer: Container;
  private camera: Vec2 = { x: 0, y: 0 };

  private lastAirborne = false;
  private highestPoint = START_Y;
  /** Best height this "visit" to the run — for ridge / tint; not reset on a fall. */
  private sessionWallBestY = START_Y;
  private lastNarratedRidgeBand = -1;
  private firstFallSaid = false;
  private idleOnGroundMs = 0;
  private readonly IDLE_RESET_THRESHOLD_MS = 1200;

  private shakeT = 0;
  private shakeMag = 0;
  private shakeX = 0;
  private shakeY = 0;
  private prevOnGround = true;
  /**
   * Extra 9× gravity (≈10× total with world gravity) for one drop — random
   * when the climber first has both hands off, until the ledge / catch.
   */
  private extremeFall = false;
  private lastWhooshOn = false;

  private trollNarrationSpoken = new Set<TrollId>();
  private trollTimerByHold = new Map<string, Set<ReturnType<typeof setTimeout>>>();

  private paused = false;
  private rebuildLock = false;
  private cullN = 0;
  private tickerHandler: (t: { deltaMS: number }) => void;

  constructor(app: Application) {
    this.app = app;
    this.physics = new Physics();

    this.worldContainer = new Container();
    this.uiContainer = new Container();
    this.app.stage.addChild(this.worldContainer);
    this.app.stage.addChild(this.uiContainer);

    this.narrator = new Narrator();
    this.uiContainer.addChild(this.narrator.container);

    this.createWorldContent();

    this.input = new Input(this.app, () => this.camera);

    this.tickerHandler = (ticker: { deltaMS: number }) => {
      this.gameFrame(ticker.deltaMS);
    };
  }

  private createWorldContent() {
    this.memory = new Memory();
    this.worldContainer.addChild(this.memory.container);

    const playW = worldWidthFromApp(this.app);
    this.wall = new Wall(this.physics, playW);
    this.wall.onChunkAppended = () => this.onProceduralChunk();
    this.worldContainer.addChild(this.wall.container);

    this.climber = new Climber(this.physics, this.wall, {
      x: this.wall.worldWidth / 2,
      y: START_Y - 30,
    });
    this.worldContainer.addChild(this.climber.container);
  }

  private onProceduralChunk() {
    const c = this.wall.proceduralChunkCount;
    if (c > 0 && c % 5 === 0) {
      const idx = (Math.floor(c / 5) - 1) % proceduralMurmurs.length;
      this.narrator.say(proceduralMurmurs[idx]);
    }
  }

  private replaceNarrator() {
    this.narrator.container.removeFromParent();
    this.narrator.container.destroy();
    this.narrator = new Narrator();
    this.uiContainer.addChild(this.narrator.container);
  }

  private destroyWorldContent() {
    for (const ch of [...this.worldContainer.children]) {
      this.worldContainer.removeChild(ch);
      ch.destroy({ children: true });
    }
  }

  async start() {
    await this.memory.loadMarks();
    this.memory.startMarksPolling();
    this.narrator.say('reach, and hold. the rest will follow.');
    this.app.ticker.add(this.tickerHandler);
  }

  isPaused() {
    return this.paused;
  }

  isRebuildLocked() {
    return this.rebuildLock;
  }

  isSoundWanted() {
    return localStorage.getItem('fodder_sound') !== '0';
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) {
      setAmbienceVolume(0);
      setFallWhooshState(false);
      this.lastWhooshOn = false;
      return;
    }
    if (this.isSoundWanted()) {
      startAmbienceOnUserIntent();
      setAmbienceVolume(0.12);
    } else {
      setAmbienceVolume(0);
    }
  }

  togglePause() {
    this.setPaused(!this.paused);
  }

  getClimbedHeightPx() {
    return Math.max(0, Math.round(START_Y - this.climber.pos.y));
  }

  getRidgeName() {
    const h = Math.max(0, START_Y - this.sessionWallBestY);
    const b = ridgeBandForClimbed(h);
    return ridgeNameForBand(b);
  }

  private gameFrame(deltaMs: number) {
    if (this.rebuildLock) return;
    if (this.paused) {
      this.narrator.update(
        performance.now(),
        this.app.screen.width,
        this.app.screen.height
      );
      return;
    }
    this.tick(deltaMs);
  }

  async restartFromLedge() {
    if (this.rebuildLock) return;
    this.rebuildLock = true;
    this.setPaused(false);
    setAmbienceVolume(0);

    for (const s of this.trollTimerByHold.values()) {
      for (const t of s) clearTimeout(t);
    }
    this.trollTimerByHold.clear();

    this.memory.stopMarksPolling();
    await this.memory.clearAllMarksOnServerAndLocal();
    this.physics.clearEngine();
    this.destroyWorldContent();
    this.createWorldContent();
    this.replaceNarrator();
    this.resetRunState();
    this.camera = { x: 0, y: 0 };

    await this.memory.loadMarks();
    this.memory.startMarksPolling();
    this.narrator.say('reach, and hold. the rest will follow.');
    if (this.isSoundWanted()) {
      startAmbienceOnUserIntent();
      setAmbienceVolume(0.12);
    }
    this.rebuildLock = false;
  }

  private resetRunState() {
    this.lastAirborne = false;
    this.highestPoint = START_Y;
    this.sessionWallBestY = START_Y;
    this.lastNarratedRidgeBand = -1;
    this.firstFallSaid = false;
    this.idleOnGroundMs = 0;
    this.trollNarrationSpoken.clear();
    this.shakeT = 0;
    this.shakeMag = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.prevOnGround = true;
    this.extremeFall = false;
    this.lastWhooshOn = false;
    setFallWhooshState(false);
  }

  private addTimer(
    holdId: string,
    delayMs: number,
    onFire: () => void
  ) {
    if (!this.trollTimerByHold.has(holdId)) {
      this.trollTimerByHold.set(holdId, new Set());
    }
    const s = this.trollTimerByHold.get(holdId)!;
    const t = setTimeout(() => {
      s.delete(t);
      if (s.size === 0) this.trollTimerByHold.delete(holdId);
      onFire();
    }, delayMs) as ReturnType<typeof setTimeout>;
    s.add(t);
  }

  private clearTrollTimersForHold(holdId: string) {
    const s = this.trollTimerByHold.get(holdId);
    if (!s) return;
    for (const t of s) clearTimeout(t);
    this.trollTimerByHold.delete(holdId);
  }

  private speakTrollTypeOnce(t: TrollId, delayMs = 220) {
    if (this.trollNarrationSpoken.has(t)) return;
    this.trollNarrationSpoken.add(t);
    const line = trollNarration[t];
    if (!line) return;
    setTimeout(() => this.narrator.say(line), delayMs);
  }

  private onGripTroll(_hand: 'left' | 'right', hold: Hold) {
    if (!hold.troll) return;
    const { id, troll } = hold;
    if (troll === 'startle_jolt') {
      this.climber.startleJolt();
      this.speakTrollTypeOnce('startle_jolt');
    }
    if (troll === 'loose_spring') {
      this.speakTrollTypeOnce('loose_spring');
    }
    if (troll === 'weigh_down') {
      this.speakTrollTypeOnce('weigh_down');
    }
    if (CREEPY_TROLLS.includes(troll)) {
      this.speakTrollTypeOnce(troll, 300);
    }

    if (troll === 'break_immediate') {
      this.addTimer(id, TROLL.breakImmediateDelayMs, () => {
        this.firstFallSaid = true;
        if (id === MAIN_LIE_ID) {
          setNemesisTroll('break_immediate');
          this.wall.breakHold(id);
          this.climber.handleHoldBroken(id);
          this.trollNarrationSpoken.add('break_immediate');
          setTimeout(
            () => this.narrator.say(trollNarration.break_immediate),
            400
          );
          setTimeout(() => {
            this.wall.revealAllHidden();
            setTimeout(
              () => this.narrator.say('here. this path was here.'),
              1600
            );
          }, 1200);
        } else {
          this.runBreakHold(id, 'break_immediate', () =>
            this.speakTrollTypeOnce('break_immediate', 0)
          );
        }
      });
    }

    if (troll === 'break_after_short') {
      this.addTimer(id, TROLL.breakAfterShortMs, () => {
        this.runBreakHold(id, 'break_after_short', () =>
          this.speakTrollTypeOnce('break_after_short', 0)
        );
      });
    }

    if (troll === 'rot_stone') {
      this.addTimer(id, TROLL.rotStoneMs, () => {
        this.runBreakHold(id, 'rot_stone', () =>
          this.speakTrollTypeOnce('rot_stone', 0)
        );
      });
    }

    if (troll === 'fickle') {
      this.addTimer(id, TROLL.fickleAfterMs, () => {
        let released = false;
        for (const h of ['left', 'right'] as const) {
          if (this.climber.grippedHoldId(h) === id) {
            this.clearTrollTimersForHold(id);
            this.climber.release(h);
            released = true;
          }
        }
        if (released) {
          setNemesisTroll('fickle');
          this.speakTrollTypeOnce('fickle', 0);
        }
      });
    }
  }

  private runBreakHold(id: string, troll: TrollId, speak: () => void) {
    setNemesisTroll(troll);
    this.wall.breakHold(id);
    this.climber.handleHoldBroken(id);
    this.clearTrollTimersForHold(id);
    this.firstFallSaid = true;
    speak();
  }

  /** ~10× fall speed for one random drop; cleared on ledge. */
  private applyExtremeFall() {
    if (!this.extremeFall || !this.climber.isFree) return;
    const y = this.climber.pos.y;
    if (y > START_Y - 40) return;
    const b = this.climber.body;
    const g = this.physics.engine.gravity;
    const sc = (g as { scale?: number }).scale ?? 0.001;
    const extra = 9;
    Matter.Body.applyForce(b, b.position, { x: 0, y: b.mass * g.y * sc * extra });
  }

  private trollCreepKinematics(deltaMs: number) {
    const t = deltaMs / 1000;
    for (const h of this.climber.trollKinematicsGripped(CREEPY_TROLLS)) {
      if (!h.troll) continue;
      if (h.troll === 'creep_down') {
        this.wall.nudgeHoldPos(h.id, 0, TROLL.creepDownPerSec * t);
      } else if (h.troll === 'sag_line') {
        this.wall.nudgeHoldPos(h.id, 0, TROLL.sagCreepPerSec * t);
      } else if (h.troll === 'drift_lean') {
        this.wall.nudgeHoldPos(
          h.id,
          h.driftDir * TROLL.driftLeanPerSec * t,
          0
        );
      }
    }
    this.climber.updateGripConstraintAnchors();
  }

  private tick(deltaMs: number) {
    this.input.update();
    this.wall.maybeAppendInfiniteClimb(this.climber.pos.y);
    this.handleInput();
    this.trollCreepKinematics(deltaMs);
    this.climber.applySwingForce(this.input.mouseWorld);
    if (!this.paused) {
      this.applyExtremeFall();
    }
    this.physics.step(deltaMs);
    this.sessionWallBestY = Math.min(this.sessionWallBestY, this.climber.pos.y);
    this.updateRidgeMood();
    this.updateCamera(deltaMs);
    this.detectProgressAndFalls(deltaMs);
    this.climber.render(this.input.activeHand, this.input.mouseWorld);
    this.cullN += 1;
    if (this.cullN % 10 === 0) {
      this.wall.cullDistantHolds(
        this.climber.pos.y,
        this.climber.grippingHoldIds()
      );
    }
    this.narrator.update(
      performance.now(),
      this.app.screen.width,
      this.app.screen.height
    );
  }

  private handleInput() {
    if (this.input.consumeGripped()) {
      const hand = this.input.activeHand;
      const hold = this.climber.tryGrip(hand, this.input.mouseWorld);
      if (hold && hold.troll) {
        this.onGripTroll(hand, hold);
      }
    }
    if (this.input.consumeReleased()) {
      const hand = this.input.activeHand;
      const prev = this.climber.grippedHoldId(hand);
      if (prev) {
        this.clearTrollTimersForHold(prev);
      }
      this.climber.release(hand);
    }
    this.input.consumeSwitched();
  }

  private updateRidgeMood() {
    const h = Math.max(0, START_Y - this.sessionWallBestY);
    const band = ridgeBandForClimbed(h);
    this.worldContainer.tint = worldTintForBand(band);
    if (band > this.lastNarratedRidgeBand && h > 100) {
      this.lastNarratedRidgeBand = band;
      if (band >= 1) {
        const s = ridgeSayForBand(band);
        if (s) {
          this.narrator.say(s);
        }
      }
    }
  }

  private updateCamera(deltaMs: number) {
    const targetX = this.climber.pos.x - this.app.screen.width / 2;
    const targetY = this.climber.pos.y - this.app.screen.height / 2;
    this.camera.x += (targetX - this.camera.x) * 0.12;
    this.camera.y += (targetY - this.camera.y) * 0.12;
    const maxX = Math.max(0, this.wall.worldWidth - this.app.screen.width);
    this.camera.x = Math.max(0, Math.min(maxX, this.camera.x));
    if (this.shakeT > 0) {
      this.shakeT -= deltaMs;
      const k = Math.max(0, this.shakeT / 200);
      const m = this.shakeMag * k;
      this.shakeX = (Math.random() - 0.5) * 2 * m;
      this.shakeY = (Math.random() - 0.5) * 2 * m;
      if (this.shakeT <= 0) {
        this.shakeX = 0;
        this.shakeY = 0;
      }
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
    this.worldContainer.x = -this.camera.x + this.shakeX;
    this.worldContainer.y = -this.camera.y + this.shakeY;
  }

  private detectProgressAndFalls(deltaMs: number) {
    const y = this.climber.pos.y;
    if (y < this.highestPoint) {
      this.highestPoint = y;
    }
    const airborne = this.climber.isFree;
    const onGround = y > START_Y - 40;
    const v = this.climber.body.velocity;
    const speed = Math.hypot(v.x, v.y);
    const nearlyStill = speed < 0.3;

    if (onGround) {
      this.extremeFall = false;
    } else if (!this.lastAirborne && this.climber.isFree && !onGround) {
      if (Math.random() < 0.1) {
        this.extremeFall = true;
      }
    }

    if (this.lastAirborne && onGround && this.highestPoint < START_Y - 120) {
      this.recordFall();
      this.highestPoint = START_Y;
    }
    if (!this.prevOnGround && onGround) {
      if (speed > 0.45) {
        this.bumpOnLanding(speed);
        if (this.isSoundWanted()) {
          playPlatformBonk(speed);
        }
      }
    }
    this.prevOnGround = onGround;
    this.lastAirborne = airborne;

    const whooshOn =
      this.isSoundWanted() &&
      !this.paused &&
      this.climber.isFree &&
      !onGround;
    if (whooshOn !== this.lastWhooshOn) {
      setFallWhooshState(whooshOn);
      this.lastWhooshOn = whooshOn;
    }
    if (airborne && onGround && nearlyStill) {
      this.idleOnGroundMs += deltaMs;
      if (this.idleOnGroundMs >= this.IDLE_RESET_THRESHOLD_MS) {
        this.climber.resetTo({ x: this.wall.worldWidth / 2, y: START_Y - 30 });
        this.idleOnGroundMs = 0;
        this.highestPoint = START_Y;
        this.sessionWallBestY = START_Y;
        this.lastNarratedRidgeBand = -1;
      }
    } else {
      this.idleOnGroundMs = 0;
    }
    if (y > START_Y + 200) {
      this.climber.resetTo({ x: this.wall.worldWidth / 2, y: START_Y - 30 });
      this.idleOnGroundMs = 0;
      this.highestPoint = START_Y;
      this.sessionWallBestY = START_Y;
      this.lastNarratedRidgeBand = -1;
    }
  }

  private bumpOnLanding(impact: number) {
    this.shakeT = 160;
    this.shakeMag = Math.min(8, 1.6 + impact * 0.28);
  }

  private recordFall() {
    this.memory.recordFall(
      { x: this.climber.pos.x, y: this.climber.pos.y },
      pickFallWhisper()
    );
    if (!this.firstFallSaid) {
      this.firstFallSaid = true;
      this.narrator.say('the tower is patient.');
    }
  }
}
