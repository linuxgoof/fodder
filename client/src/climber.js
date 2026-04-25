import Matter from 'matter-js';
import { Container, Graphics } from 'pixi.js';
import { TROLL } from './trolls';
// Reach budget from torso. When the other hand is gripped, the free arm
// can "extend" by up to ARM_EXTEND_MAX toward the target, modeling the arm
// reaching beyond the body center. This is what makes swings feel fair.
const REACH = 123;
const ARM_EXTEND_MAX = 55;
const TORSO_W = 18;
const TORSO_H = 32;
// Swing tuning. The torso is pulled toward the mouse by a spring-ish force
// proportional to distance. Iterate on these.
const SWING_FORCE = 0.0026; // per-frame force coefficient
const SWING_MAX_DIST = 180; // cap so extreme drags don't launch you to orbit
export class Climber {
    container;
    body;
    physics;
    wall;
    hands = {
        left: { grippedHoldId: null, constraint: null },
        right: { grippedHoldId: null, constraint: null },
    };
    torsoGfx;
    handsGfx;
    reachGfx;
    highlightGfx;
    constructor(physics, wall, startPos) {
        this.physics = physics;
        this.wall = wall;
        this.container = new Container();
        this.body = Matter.Bodies.rectangle(startPos.x, startPos.y, TORSO_W, TORSO_H, {
            density: 0.002,
            frictionAir: 0.02,
            label: 'climber',
        });
        physics.add(this.body);
        // Layers (back to front): highlight, reach, torso, hands.
        this.highlightGfx = new Graphics();
        this.container.addChild(this.highlightGfx);
        this.reachGfx = new Graphics();
        this.container.addChild(this.reachGfx);
        this.torsoGfx = new Graphics();
        this.container.addChild(this.torsoGfx);
        this.handsGfx = new Graphics();
        this.container.addChild(this.handsGfx);
    }
    get pos() {
        return { x: this.body.position.x, y: this.body.position.y };
    }
    get isFree() {
        return !this.hands.left.grippedHoldId && !this.hands.right.grippedHoldId;
    }
    hasAnyGrip() {
        return !!(this.hands.left.grippedHoldId || this.hands.right.grippedHoldId);
    }
    // Reach origin for a hand, given the point it's trying to reach. If the
    // OTHER hand is gripping, the arm can extend up to ARM_EXTEND_MAX from the
    // torso *toward the target*, directly helping lateral and downward moves
    // (not just the swing direction).
    reachOriginFor(hand, target) {
        const other = hand === 'left' ? 'right' : 'left';
        const torso = this.body.position;
        if (!this.hands[other].grippedHoldId) {
            return { x: torso.x, y: torso.y };
        }
        const dx = target.x - torso.x;
        const dy = target.y - torso.y;
        const d = Math.hypot(dx, dy);
        if (d < 1)
            return { x: torso.x, y: torso.y };
        const extend = Math.min(ARM_EXTEND_MAX, d);
        return {
            x: torso.x + (dx / d) * extend,
            y: torso.y + (dy / d) * extend,
        };
    }
    canReach(hand, point) {
        const origin = this.reachOriginFor(hand, point);
        const d = Math.hypot(point.x - origin.x, point.y - origin.y);
        return d <= REACH;
    }
    // Holds in grip range of a given hand. Renderer glows these.
    holdsInReach(hand) {
        return this.wall.holds.filter((h) => !h.broken && !h.hidden && this.canReach(hand, h.pos));
    }
    // Attempt to grip the nearest hold with the given hand, reaching toward
    // the target point. Returns the hold if grabbed, null otherwise.
    tryGrip(hand, target) {
        this.release(hand);
        const hold = this.wall.nearestHold(target, 40);
        if (!hold)
            return null;
        if (!this.canReach(hand, hold.pos))
            return null;
        const shoulderX = hand === 'left' ? -TORSO_W / 2 : TORSO_W / 2;
        const shoulderY = -TORSO_H / 3;
        const shoulderWorldX = this.body.position.x + shoulderX;
        const shoulderWorldY = this.body.position.y + shoulderY;
        const dist = Math.hypot(hold.pos.x - shoulderWorldX, hold.pos.y - shoulderWorldY);
        const loose = hold.troll === 'loose_spring';
        const constraint = Matter.Constraint.create({
            pointA: { x: hold.pos.x, y: hold.pos.y },
            bodyB: this.body,
            pointB: { x: shoulderX, y: shoulderY },
            length: Math.min(dist, REACH * 0.85),
            stiffness: loose ? TROLL.looseStiffness : 0.85,
            damping: loose ? TROLL.looseDamping : 0.15,
        });
        this.physics.add(constraint);
        this.hands[hand] = { grippedHoldId: hold.id, constraint };
        return hold;
    }
    release(hand) {
        const s = this.hands[hand];
        if (s.constraint) {
            this.physics.remove(s.constraint);
        }
        this.hands[hand] = { grippedHoldId: null, constraint: null };
    }
    releaseAll() {
        this.release('left');
        this.release('right');
    }
    // Hard reset: return to a clean standing position and zero velocities.
    // Used after a fall, after some settle time. Not a teleport effect —
    // caller is responsible for any fade.
    resetTo(pos) {
        this.releaseAll();
        Matter.Body.setPosition(this.body, { x: pos.x, y: pos.y });
        Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(this.body, 0);
        Matter.Body.setAngle(this.body, 0);
    }
    // Called every physics step. When gripping, pull torso toward the mouse.
    // This is what makes swinging feel like player action and not gravity theater.
    /** 1, or less when hanging from a `weigh_down` hold. */
    getSwingForceMultiplier() {
        for (const hand of ['left', 'right']) {
            const id = this.hands[hand].grippedHoldId;
            if (!id)
                continue;
            const h = this.wall.getHoldById(id);
            if (h?.troll === 'weigh_down')
                return TROLL.weighSwingMul;
        }
        return 1;
    }
    updateGripConstraintAnchors() {
        for (const hand of ['left', 'right']) {
            const id = this.hands[hand].grippedHoldId;
            if (!id)
                continue;
            const c = this.hands[hand].constraint;
            if (!c)
                continue;
            const hold = this.wall.getHoldById(id);
            if (hold) {
                c.pointA = { x: hold.pos.x, y: hold.pos.y };
            }
        }
    }
    /** Troll: brief impulse at pull onto the first hold, before rest counts. */
    startleJolt() {
        const f = (Math.random() * 2 - 1) * TROLL.joltJitter;
        const j = TROLL.joltY;
        const p = this.body.position;
        const m = this.body.mass;
        Matter.Body.applyForce(this.body, p, { x: f * m, y: j * m });
    }
    /**
     * Holds (de-duplicated by id) whose troll is one of `trolls` and that are
     * currently gripped.
     */
    trollKinematicsGripped(allowed) {
        const byId = new Map();
        for (const hand of ['left', 'right']) {
            const id = this.hands[hand].grippedHoldId;
            if (!id)
                continue;
            const hold = this.wall.getHoldById(id);
            if (hold && hold.troll && allowed.includes(hold.troll) && !hold.broken) {
                byId.set(hold.id, hold);
            }
        }
        return Array.from(byId.values());
    }
    applySwingForce(mouseWorld) {
        if (!this.hasAnyGrip())
            return;
        const mul = this.getSwingForceMultiplier();
        const p = this.body.position;
        const dx = mouseWorld.x - p.x;
        const dy = mouseWorld.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 1)
            return;
        const clamped = Math.min(d, SWING_MAX_DIST);
        const nx = dx / d;
        const ny = dy / d;
        const mag = SWING_FORCE * mul * clamped * this.body.mass;
        Matter.Body.applyForce(this.body, p, { x: nx * mag, y: ny * mag });
    }
    handleHoldBroken(holdId) {
        for (const h of ['left', 'right']) {
            if (this.hands[h].grippedHoldId === holdId) {
                this.release(h);
            }
        }
    }
    grippedHoldId(hand) {
        return this.hands[hand].grippedHoldId;
    }
    /** Ids of holds currently gripped (0–2) — for culling, etc. */
    grippingHoldIds() {
        const s = new Set();
        for (const hand of ['left', 'right']) {
            const id = this.hands[hand].grippedHoldId;
            if (id)
                s.add(id);
        }
        return s;
    }
    render(activeHand, mouseWorld) {
        const p = this.body.position;
        const angle = this.body.angle;
        // --- Highlights: glow all holds the active hand could grab right now.
        this.highlightGfx.clear();
        const reachable = this.holdsInReach(activeHand);
        for (const h of reachable) {
            this.highlightGfx.circle(h.pos.x, h.pos.y, 22)
                .fill({ color: 0xd4c89a, alpha: 0.18 });
            this.highlightGfx.circle(h.pos.x, h.pos.y, 16)
                .stroke({ color: 0xd4c89a, width: 1.5, alpha: 0.5 });
        }
        // --- Torso.
        this.torsoGfx.clear();
        this.torsoGfx.rect(-TORSO_W / 2, -TORSO_H / 2, TORSO_W, TORSO_H)
            .fill({ color: 0xb8b0a0 });
        this.torsoGfx.x = p.x;
        this.torsoGfx.y = p.y;
        this.torsoGfx.rotation = angle;
        // --- Reach indicator when active hand is free (choosing).
        this.reachGfx.clear();
        const activeGrippedHold = this.hands[activeHand].grippedHoldId;
        if (!activeGrippedHold) {
            const origin = this.reachOriginFor(activeHand, mouseWorld);
            this.reachGfx.circle(origin.x, origin.y, REACH)
                .stroke({ color: 0x444444, width: 1, alpha: 0.4 });
            const dx = mouseWorld.x - origin.x;
            const dy = mouseWorld.y - origin.y;
            const d = Math.hypot(dx, dy);
            const clamped = Math.min(d, REACH);
            const ex = origin.x + (dx / (d || 1)) * clamped;
            const ey = origin.y + (dy / (d || 1)) * clamped;
            this.reachGfx.moveTo(origin.x, origin.y).lineTo(ex, ey)
                .stroke({ color: 0x8a8270, width: 1, alpha: 0.6 });
        }
        // --- Hands.
        this.handsGfx.clear();
        for (const hand of ['left', 'right']) {
            const grippedId = this.hands[hand].grippedHoldId;
            let hx, hy;
            if (grippedId) {
                const hold = this.wall.holds.find((h) => h.id === grippedId);
                if (!hold)
                    continue;
                hx = hold.pos.x;
                hy = hold.pos.y;
            }
            else if (hand === activeHand) {
                const origin = this.reachOriginFor(hand, mouseWorld);
                const dx = mouseWorld.x - origin.x;
                const dy = mouseWorld.y - origin.y;
                const d = Math.hypot(dx, dy) || 1;
                const clamped = Math.min(d, REACH);
                hx = origin.x + (dx / d) * clamped;
                hy = origin.y + (dy / d) * clamped;
            }
            else {
                hx = p.x + (hand === 'left' ? -12 : 12);
                hy = p.y - 4;
            }
            const color = hand === activeHand ? 0xe8dfc6 : 0x9a927e;
            this.handsGfx.circle(hx, hy, 5).fill({ color });
            const shoulderX = p.x + (hand === 'left' ? -TORSO_W / 2 : TORSO_W / 2);
            const shoulderY = p.y - TORSO_H / 3;
            this.handsGfx.moveTo(shoulderX, shoulderY).lineTo(hx, hy)
                .stroke({ color: 0x6b6555, width: 2 });
        }
    }
}
