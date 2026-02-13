import { System } from "../engine/system.js";

export class SpawnSystem extends System {
    constructor() {
        super(30);
    }

    update(dt, ctx, entities) {
        if (ctx.state.gameOver) return;

        ctx.state.wave = 1 + Math.floor(ctx.state.score / 180);
        ctx.state.spawnTimer -= dt;

        const zombieCount = entities.filter((e) => e.name === "zombie" && e.alive).length;
        if (ctx.state.spawnTimer <= 0 && zombieCount < 12 + ctx.state.wave * 2) {
            ctx.factory.spawnZombie();
            const baseDelay = 1.4 - ctx.state.wave * 0.06;
            ctx.state.spawnTimer = Math.max(0.35, baseDelay);
        }
    }
}
