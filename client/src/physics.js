import Matter from 'matter-js';
export class Physics {
    engine;
    world;
    constructor() {
        this.engine = Matter.Engine.create({
            gravity: { x: 0, y: 1, scale: 0.001 },
        });
        this.world = this.engine.world;
    }
    /** Remove all bodies and constraints; reuse engine for a fresh run. */
    clearEngine() {
        Matter.World.clear(this.engine.world, false);
    }
    step(deltaMs) {
        // Clamp to avoid tunneling on big frame drops.
        const dt = Math.min(deltaMs, 1000 / 30);
        Matter.Engine.update(this.engine, dt);
    }
    add(body) {
        Matter.World.add(this.world, body);
    }
    remove(body) {
        Matter.World.remove(this.world, body);
    }
}
