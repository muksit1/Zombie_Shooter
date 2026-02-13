import { Engine } from "../engine/core.js";
import { addComponent, createEntity, getComponent } from "../engine/entity.js";
import { createZombieFSM } from "./zombie-fsm.js";
import { CombatSystem } from "../systems/combat-system.js";
import { PlayerSystem } from "../systems/player-system.js";
import { RenderSystem } from "../systems/render-system.js";
import { SpawnSystem } from "../systems/spawn-system.js";
import { ZombieAISystem } from "../systems/zombie-ai-system.js";

const THREE = window.THREE;

const canvas = document.getElementById("game-canvas");
const scoreEl = document.getElementById("score");
const healthEl = document.getElementById("health");
const waveEl = document.getElementById("wave");
const messageEl = document.getElementById("message");
const messageTitleEl = document.getElementById("message-title");
const messageSubtitleEl = document.getElementById("message-subtitle");

if (!THREE) {
    messageTitleEl.textContent = "Three.js not loaded";
    messageSubtitleEl.textContent = "Check internet connection for CDN script.";
    throw new Error("Three.js missing");
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f16);
scene.fog = new THREE.Fog(0x0b0f16, 30, 140);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 1.7, 8);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const hemiLight = new THREE.HemisphereLight(0xaec8ff, 0x202a2f, 0.55);
scene.add(hemiLight);
const sun = new THREE.DirectionalLight(0xfff3d6, 0.9);
sun.position.set(25, 30, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x2f3b3a, roughness: 0.95, metalness: 0.05 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const obstacleGeo = new THREE.BoxGeometry(1, 1, 1);
const obstacleMat = new THREE.MeshStandardMaterial({ color: 0x4d535a, roughness: 0.9 });
for (let i = 0; i < 36; i += 1) {
    const height = 1.2 + Math.random() * 5;
    const mesh = new THREE.Mesh(obstacleGeo, obstacleMat);
    mesh.position.set((Math.random() - 0.5) * 130, height / 2, (Math.random() - 0.5) * 130);
    mesh.scale.set(2 + Math.random() * 2, height, 2 + Math.random() * 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
}

const gun = new THREE.Group();
const gunBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.2, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.35 })
);
gunBody.position.set(0.22, -0.25, -0.55);
const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.45, 12),
    new THREE.MeshStandardMaterial({ color: 0x7d7d7d, roughness: 0.3 })
);
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0.22, -0.25, -0.98);
const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcc66 })
);
muzzleFlash.position.set(0.22, -0.25, -1.2);
muzzleFlash.visible = false;
gun.add(gunBody, barrel, muzzleFlash);
camera.add(gun);
scene.add(camera);

const input = {
    keys: { w: false, a: false, s: false, d: false },
    isLocked: false,
    fireRequested: false
};

const state = {
    score: 0,
    health: 100,
    wave: 1,
    gameOver: false,
    yaw: 0,
    pitch: 0,
    spawnTimer: 0,
    shootCooldown: 0,
    flashTimer: 0,
    damageTick: 0
};

const ui = {
    scoreEl,
    healthEl,
    waveEl,
    showOverlay(title, subtitle) {
        messageTitleEl.textContent = title;
        messageSubtitleEl.textContent = subtitle;
        messageEl.classList.remove("hidden");
    },
    hideOverlay() {
        messageEl.classList.add("hidden");
    }
};

const ctx = {
    scene,
    camera,
    renderer,
    input,
    state,
    ui,
    gun: { group: gun, muzzleFlash },
    factory: {
        spawnZombie: () => {}
    }
};

const engine = new Engine(ctx);

const player = addComponent(addComponent(createEntity("player"), "player", { speed: 8 }), "health", { value: 100 });
engine.addEntity(player);

function spawnZombie() {
    const zombieMesh = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.52, 1.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x5ea862, roughness: 0.8 })
    );
    body.position.y = 0.9;

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0x86be79, roughness: 0.75 })
    );
    head.position.y = 1.75;
    zombieMesh.add(body, head);
    zombieMesh.traverse((n) => {
        if (n.isMesh) n.castShadow = true;
    });

    const angle = Math.random() * Math.PI * 2;
    const distance = 32 + Math.random() * 28;
    zombieMesh.position.set(
        camera.position.x + Math.cos(angle) * distance,
        0,
        camera.position.z + Math.sin(angle) * distance
    );

    const zombieEntity = createEntity("zombie");
    addComponent(zombieEntity, "mesh", zombieMesh);
    addComponent(zombieEntity, "zombie", {
        health: 2 + Math.floor(state.wave / 2),
        speed: 1.35 + Math.random() * 1 + state.wave * 0.15,
        fsm: createZombieFSM()
    });
    zombieMesh.userData.entityId = zombieEntity.id;
    scene.add(zombieMesh);
    engine.addEntity(zombieEntity);
}

ctx.factory.spawnZombie = spawnZombie;

engine.addSystem(new PlayerSystem());
engine.addSystem(new SpawnSystem());
engine.addSystem(new ZombieAISystem());
engine.addSystem(new CombatSystem());
engine.addSystem(new RenderSystem());

function resetGame() {
    for (const entity of engine.entities) {
        if (entity.name === "zombie") {
            const mesh = getComponent(entity, "mesh");
            if (mesh) scene.remove(mesh);
            entity.alive = false;
        }
    }
    state.score = 0;
    state.health = 100;
    state.wave = 1;
    state.gameOver = false;
    state.spawnTimer = 0;
    state.shootCooldown = 0;
    state.flashTimer = 0;
    state.damageTick = 0;
    state.yaw = 0;
    state.pitch = 0;
    camera.position.set(0, 1.7, 8);
    camera.rotation.set(0, 0, 0);
    const health = getComponent(player, "health");
    health.value = 100;
    ui.hideOverlay();
}

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d"].includes(key)) input.keys[key] = true;
    if (key === "r") resetGame();
});

window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d"].includes(key)) input.keys[key] = false;
});

document.addEventListener("pointerlockchange", () => {
    input.isLocked = document.pointerLockElement === canvas;
    if (input.isLocked && !state.gameOver) ui.hideOverlay();
    if (!input.isLocked && !state.gameOver) {
        ui.showOverlay("Paused", "Click to continue. WASD move, click shoot.");
    }
});

canvas.addEventListener("click", () => {
    if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
        return;
    }
    input.fireRequested = true;
});

messageEl.addEventListener("click", () => {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
});

document.addEventListener("mousemove", (event) => {
    if (!input.isLocked || state.gameOver) return;
    const sensitivity = 0.0022;
    state.yaw -= event.movementX * sensitivity;
    state.pitch -= event.movementY * sensitivity;
    state.pitch = Math.max(-1.3, Math.min(1.3, state.pitch));
});

ui.showOverlay("Zombie FPS Engine", "Click to start. Architecture: Engine + Systems + Zombie FSM.");
engine.start();
