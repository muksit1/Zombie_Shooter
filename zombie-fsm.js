export function createZombieFSM() {
    return {
        state: "chase",
        attackCooldown: 0,
        deathTimer: 0.4
    };
}

export function updateZombieFSM(fsm, zombie, distanceToPlayer, dt) {
    if (zombie.health <= 0 && fsm.state !== "dead") {
        fsm.state = "dead";
        fsm.deathTimer = 0.35;
    }

    if (fsm.state === "dead") {
        return;
    }

    if (fsm.attackCooldown > 0) {
        fsm.attackCooldown -= dt;
    }

    if (distanceToPlayer < 1.7) {
        fsm.state = "attack";
    } else {
        fsm.state = "chase";
    }
}
