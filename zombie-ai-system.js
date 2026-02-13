import { System } from "../engine/system.js";
import { getComponent } from "../engine/entity.js";
import { updateZombieFSM } from "../game/zombie-fsm.js";

const THREE = window.THREE;

export class ZombieAISystem extends System {
    constructor() {
        super(40);
    }

    update(dt, ctx, entities) {
        if (ctx.state.gameOver) return;

        const player = entities.find((e) => e.name === "player");
        if (!player) return;

        const playerHealth = getComponent(player, "health");
        const playerPosition = ctx.camera.position;
        let attackers = 0;

        for (const entity of entities) {
            if (entity.name !== "zombie" || !entity.alive) continue;
            const zombie = getComponent(entity, "zombie");
            const mesh = getComponent(entity, "mesh");

            const dx = playerPosition.x - mesh.position.x;
            const dz = playerPosition.z - mesh.position.z;
            const dist = Math.hypot(dx, dz) || 0.001;
            updateZombieFSM(zombie.fsm, zombie, dist, dt);

            if (zombie.fsm.state === "dead") {
                mesh.rotation.z = THREE.MathUtils.lerp(mesh.rotation.z, -1.2, dt * 8);
                zombie.fsm.deathTimer -= dt;
                if (zombie.fsm.deathTimer <= 0) {
                    ctx.scene.remove(mesh);
                    entity.alive = false;
                }
                continue;
            }

            const nx = dx / dist;
            const nz = dz / dist;
            mesh.position.x += nx * zombie.speed * dt;
            mesh.position.z += nz * zombie.speed * dt;
            mesh.lookAt(playerPosition.x, 1.0, playerPosition.z);

            if (zombie.fsm.state === "attack" && zombie.fsm.attackCooldown <= 0) {
                attackers += 1;
                zombie.fsm.attackCooldown = 0.35 + Math.random() * 0.2;
            }
        }

        if (attackers > 0) {
            ctx.state.damageTick += dt;
            if (ctx.state.damageTick > 0.1) {
                playerHealth.value = Math.max(0, playerHealth.value - attackers * 1.8);
                ctx.state.health = playerHealth.value;
                ctx.state.damageTick = 0;
                if (playerHealth.value <= 0) {
                    ctx.state.gameOver = true;
                    ctx.ui.showOverlay("Game Over", "Press R to restart. Click to re-lock mouse.");
                }
            }
        } else {
            ctx.state.damageTick = 0;
        }
    }
}
