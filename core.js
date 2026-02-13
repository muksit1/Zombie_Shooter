export class Engine {
    constructor(ctx) {
        this.ctx = ctx;
        this.entities = [];
        this.systems = [];
        this.running = false;
        this.lastTime = 0;
    }

    addEntity(entity) {
        this.entities.push(entity);
        return entity;
    }

    addSystem(system) {
        this.systems.push(system);
        this.systems.sort((a, b) => a.priority - b.priority);
        return system;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.tick(t));
    }

    tick(now) {
        if (!this.running) return;
        const dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;

        for (const system of this.systems) {
            system.update(dt, this.ctx, this.entities);
        }

        this.entities = this.entities.filter((e) => e.alive);
        requestAnimationFrame((t) => this.tick(t));
    }
}
