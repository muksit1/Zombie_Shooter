import { System } from "../engine/system.js";
import { getComponent } from "../engine/entity.js";

const THREE = window.THREE;

export class CombatSystem extends System {
    constructor() {
        super(50);
        this.raycaster = new THREE.Raycaster();
    }

    update(dt, ctx, entities) {
        if (ctx.state.shootCooldown > 0) ctx.state.shootCooldown -= dt;
        if (ctx.state.flashTimer > 0) ctx.state.flashTimer -= dt;

        ctx.gun.muzzleFlash.visible = ctx.state.flashTimer > 0;
        ctx.gun.group.position.z = ctx.state.flashTimer > 0 ? -0.06 : 0;

        if (!ctx.input.fireRequested) return;
        ctx.input.fireRequested = false;

        if (ctx.state.gameOver || !ctx.input.isLocked || ctx.state.shootCooldown > 0) return;

        ctx.state.shootCooldown = 0.14;
        ctx.state.flashTimer = 0.04;

        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), ctx.camera);
        const aliveZombieMeshes = entities
            .filter((e) => e.name === "zombie" && e.alive)
            .map((e) => getComponent(e, "mesh"));
        const hits = this.raycaster.intersectObjects(aliveZombieMeshes, true);
        if (hits.length === 0) return;

        let node = hits[0].object;
        while (node && !node.userData.entityId) {
            node = node.parent;
        }
        if (!node || !node.userData.entityId) return;

        const zombieEntity = entities.find((e) => e.id === node.userData.entityId);
        if (!zombieEntity) return;

        const zombie = getComponent(zombieEntity, "zombie");
        zombie.health -= 1;
        if (zombie.health <= 0 && zombie.fsm.state !== "dead") {
            zombie.fsm.state = "dead";
            zombie.fsm.deathTimer = 0.35;
            ctx.state.score += 15;
        }
    }
}
