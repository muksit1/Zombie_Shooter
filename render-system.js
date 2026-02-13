import { System } from "../engine/system.js";
import { getComponent } from "../engine/entity.js";

export class RenderSystem extends System {
    constructor() {
        super(1000);
    }

    update(_dt, ctx, entities) {
        const player = entities.find((e) => e.name === "player");
        if (player) {
            const health = getComponent(player, "health");
            ctx.state.health = health.value;
        }

        ctx.ui.scoreEl.textContent = `${ctx.state.score}`;
        ctx.ui.healthEl.textContent = `${Math.max(0, Math.floor(ctx.state.health))}`;
        ctx.ui.waveEl.textContent = `${ctx.state.wave}`;

        ctx.camera.rotation.y = ctx.state.yaw;
        ctx.camera.rotation.x = ctx.state.pitch;
        ctx.gun.group.rotation.x = ctx.state.pitch * 0.08;

        ctx.renderer.render(ctx.scene, ctx.camera);
    }
}
