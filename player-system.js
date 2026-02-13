import { System } from "../engine/system.js";
import { getComponent } from "../engine/entity.js";

const THREE = window.THREE;

export class PlayerSystem extends System {
    constructor() {
        super(20);
    }

    update(dt, ctx, entities) {
        if (ctx.state.gameOver || !ctx.input.isLocked) return;

        const player = entities.find((e) => e.name === "player");
        if (!player) return;

        const playerComp = getComponent(player, "player");
        const camera = ctx.camera;
        const input = ctx.input;

        const move = new THREE.Vector3();
        if (input.keys.w) move.z -= 1;
        if (input.keys.s) move.z += 1;
        if (input.keys.a) move.x -= 1;
        if (input.keys.d) move.x += 1;
        if (move.lengthSq() > 0) move.normalize();

        const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, ctx.state.yaw, 0, "YXZ"));
        const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, ctx.state.yaw, 0, "YXZ"));

        const velocity = new THREE.Vector3();
        velocity.addScaledVector(forward, move.z * playerComp.speed * dt);
        velocity.addScaledVector(right, move.x * playerComp.speed * dt);
        camera.position.add(velocity);

        const limit = 145;
        camera.position.x = Math.max(-limit, Math.min(limit, camera.position.x));
        camera.position.z = Math.max(-limit, Math.min(limit, camera.position.z));
    }
}
