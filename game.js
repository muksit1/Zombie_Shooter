const canvas = document.getElementById("game-canvas");
const scoreEl = document.getElementById("score");
const healthEl = document.getElementById("health");
const waveEl = document.getElementById("wave");
const messageEl = document.getElementById("message");
const messageTitleEl = document.getElementById("message-title");
const messageSubtitleEl = document.getElementById("message-subtitle");

if (!window.THREE) {
    messageTitleEl.textContent = "Three.js not loaded";
    messageSubtitleEl.textContent = "Check internet connection for CDN script.";
    throw new Error("Three.js missing");
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1710);
scene.fog = new THREE.FogExp2(0x0b1710, 0.02);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    600
);
camera.position.set(0, 1.7, 8);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const hemiLight = new THREE.HemisphereLight(0x7fa287, 0x0d120f, 0.5);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xb7c28f, 0.75);
sun.position.set(18, 35, -20);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x1d2a21, roughness: 0.98, metalness: 0.02 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const obstacles = [];
const forestCrowns = [];
let mistField = null;
const pondSurfaces = [];
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3423, roughness: 0.93 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e5b34, roughness: 0.92 });
const rockMat = new THREE.MeshStandardMaterial({ color: 0x49514c, roughness: 0.95 });
const bushMat = new THREE.MeshStandardMaterial({ color: 0x2a4c2f, roughness: 0.95 });
const pondWaterMat = new THREE.MeshStandardMaterial({
    color: 0x1b3d46,
    roughness: 0.22,
    metalness: 0.12,
    transparent: true,
    opacity: 0.78
});
const pondEdgeMat = new THREE.MeshStandardMaterial({ color: 0x5a4c35, roughness: 0.94 });

for (let i = 0; i < 180; i += 1) {
    const x = (Math.random() - 0.5) * 280;
    const z = (Math.random() - 0.5) * 280;
    if (Math.abs(x) < 14 || Math.abs(z) < 14) continue;

    const tree = new THREE.Group();
    const trunkHeight = 2 + Math.random() * 4;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.28, trunkHeight, 8),
        trunkMat
    );
    trunk.position.y = trunkHeight / 2;
    const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1.2 + Math.random() * 1.2, 3 + Math.random() * 2, 10),
        leafMat
    );
    crown.position.y = trunkHeight + 1.1;
    crown.userData.baseRotZ = (Math.random() - 0.5) * 0.08;
    forestCrowns.push(crown);
    tree.add(trunk, crown);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    tree.castShadow = true;
    tree.receiveShadow = true;
    tree.traverse((n) => {
        if (n.isMesh) {
            n.castShadow = true;
            n.receiveShadow = true;
        }
    });
    scene.add(tree);
    obstacles.push(tree);
}

for (let i = 0; i < 80; i += 1) {
    const x = (Math.random() - 0.5) * 260;
    const z = (Math.random() - 0.5) * 260;
    if (Math.abs(x) < 10 || Math.abs(z) < 10) continue;
    const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.7 + Math.random() * 1.3, 0),
        rockMat
    );
    rock.position.set(x, 0.6 + Math.random() * 0.7, z);
    rock.scale.set(1 + Math.random(), 0.7 + Math.random() * 0.7, 1 + Math.random());
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    obstacles.push(rock);
}

for (let i = 0; i < 6; i += 1) {
    const x = (Math.random() - 0.5) * 220;
    const z = (Math.random() - 0.5) * 220;
    if (Math.abs(x) < 26 && Math.abs(z) < 26) continue;

    const radius = 2.8 + Math.random() * 3.6;
    const pondEdge = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 0.45, radius + 0.75, 0.24, 24),
        pondEdgeMat
    );
    pondEdge.position.set(x, 0.06, z);
    pondEdge.receiveShadow = true;
    scene.add(pondEdge);

    const pond = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 28),
        pondWaterMat.clone()
    );
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(x, 0.08, z);
    pond.receiveShadow = true;
    scene.add(pond);
    pondSurfaces.push({
        mesh: pond,
        baseY: 0.08,
        phase: Math.random() * Math.PI * 2
    });
}

for (let i = 0; i < 120; i += 1) {
    const x = (Math.random() - 0.5) * 270;
    const z = (Math.random() - 0.5) * 270;
    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
    const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.35 + Math.random() * 0.8, 8, 6),
        bushMat
    );
    bush.position.set(x, 0.22 + Math.random() * 0.25, z);
    bush.scale.set(1 + Math.random(), 0.6 + Math.random() * 0.6, 1 + Math.random());
    bush.castShadow = true;
    bush.receiveShadow = true;
    scene.add(bush);
}

{
    const count = 1300;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
        positions[i * 3] = (Math.random() - 0.5) * 290;
        positions[i * 3 + 1] = 0.2 + Math.random() * 7.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 290;
    }
    const mistGeo = new THREE.BufferGeometry();
    mistGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mistMat = new THREE.PointsMaterial({
        color: 0x9fb8aa,
        size: 0.18,
        transparent: true,
        opacity: 0.2,
        depthWrite: false
    });
    mistField = new THREE.Points(mistGeo, mistMat);
    scene.add(mistField);
}

const gun = new THREE.Group();
const metalMat = new THREE.MeshStandardMaterial({
    color: 0x2b2f34,
    roughness: 0.32,
    metalness: 0.78
});
const darkPolymerMat = new THREE.MeshStandardMaterial({
    color: 0x202327,
    roughness: 0.62,
    metalness: 0.1
});
const accentMat = new THREE.MeshStandardMaterial({
    color: 0x6d737b,
    roughness: 0.36,
    metalness: 0.66
});
const woodMat = new THREE.MeshStandardMaterial({
    color: 0x6e4326,
    roughness: 0.68,
    metalness: 0.05
});

const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.92), metalMat);
receiver.position.set(0.26, -0.25, -0.58);

const dustCover = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.82), accentMat);
dustCover.position.set(0.26, -0.17, -0.58);

const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.38), woodMat);
handguard.position.set(0.26, -0.25, -1.14);

const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.43, 14), accentMat);
gasTube.rotation.x = Math.PI / 2;
gasTube.position.set(0.26, -0.16, -1.14);

const grip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.3, 0.14), woodMat);
grip.position.set(0.24, -0.44, -0.34);
grip.rotation.x = -0.25;

const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 16), darkPolymerMat);
triggerGuard.position.set(0.24, -0.35, -0.46);
triggerGuard.rotation.x = Math.PI / 2;

const magCurve = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 8, 16, Math.PI * 0.62), metalMat);
magCurve.rotation.z = Math.PI / 2;
magCurve.rotation.x = 0.18;
magCurve.position.set(0.24, -0.47, -0.63);

const stock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.42), woodMat);
stock.position.set(0.26, -0.23, -0.08);

const stockButt = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.18, 0.05), darkPolymerMat);
stockButt.position.set(0.26, -0.23, 0.14);

const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 14), accentMat);
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0.26, -0.24, -1.47);

const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 12), metalMat);
muzzleBrake.rotation.x = Math.PI / 2;
muzzleBrake.position.set(0.26, -0.24, -1.86);

const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.05, 0.035), accentMat);
frontSight.position.set(0.26, -0.15, -1.67);

const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.05), accentMat);
rearSight.position.set(0.26, -0.15, -0.72);
const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcc66 })
);
muzzleFlash.position.set(0.26, -0.24, -1.9);
muzzleFlash.visible = false;
const muzzleLight = new THREE.PointLight(0xffb347, 0, 8, 2);
muzzleLight.position.set(0.26, -0.24, -1.86);
gun.add(muzzleLight);
gun.add(
    receiver,
    dustCover,
    handguard,
    gasTube,
    grip,
    triggerGuard,
    magCurve,
    stock,
    stockButt,
    barrel,
    muzzleBrake,
    frontSight,
    rearSight,
    muzzleFlash
);
camera.add(gun);
scene.add(camera);

const state = {
    score: 0,
    health: 100,
    wave: 1,
    gameOver: false,
    started: false,
    isLocked: false,
    keys: {},
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    zombies: [],
    spawnTimer: 0,
    shootCooldown: 0,
    flashTimer: 0,
    damageTick: 0,
    recoil: 0,
    cameraKick: 0,
    tracers: []
};

const WEAPON = {
    fireInterval: 0.095,
    baseSpread: 0.0012,
    maxSpread: 0.016,
    recoilPerShot: 0.24,
    recoilRecover: 2.1
};

const player = {
    speed: 8,
    radius: 0.7
};

const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const loader = window.THREE.GLTFLoader ? new THREE.GLTFLoader() : null;
let audioCtx = null;
let audioMasterGain = null;
let audioUnlocked = false;

const assets = {
    zombieModel: null,
    zombieClips: [],
    usingFallback: true
};

const modelCandidates = [
    "assets/models/zombie.glb",
    "assets/models/Zombie.glb.glb",
    "assets/models/zombie.gltf",
    "assets/models/zombie_walk.glb",
    "assets/models/zombie_walk.gltf"
];

function ensureAudio() {
    if (!window.AudioContext && !window.webkitAudioContext) return null;
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
        audioMasterGain = audioCtx.createGain();
        audioMasterGain.gain.value = 0.3;
        audioMasterGain.connect(audioCtx.destination);
    }
    return audioCtx;
}

function unlockAudio() {
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    audioUnlocked = true;
}

function playShootSound() {
    const ctx = ensureAudio();
    if (!ctx || !audioUnlocked) return;
    const now = ctx.currentTime;
    const pitchJitter = 1 + (Math.random() - 0.5) * 0.08;

    // Crack layer (high transient)
    const crack = ctx.createOscillator();
    const crackGain = ctx.createGain();
    crack.type = "square";
    crack.frequency.setValueAtTime(780 * pitchJitter, now);
    crack.frequency.exponentialRampToValueAtTime(180 * pitchJitter, now + 0.03);
    crackGain.gain.setValueAtTime(0.0001, now);
    crackGain.gain.exponentialRampToValueAtTime(0.55, now + 0.0025);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    crack.connect(crackGain);
    crackGain.connect(audioMasterGain);
    crack.start(now);
    crack.stop(now + 0.06);

    // Body layer (mid)
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = "sawtooth";
    body.frequency.setValueAtTime(250 * pitchJitter, now);
    body.frequency.exponentialRampToValueAtTime(88 * pitchJitter, now + 0.095);
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.34, now + 0.006);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    body.connect(bodyGain);
    bodyGain.connect(audioMasterGain);
    body.start(now);
    body.stop(now + 0.13);

    // Low thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "triangle";
    thump.frequency.setValueAtTime(120 * pitchJitter, now);
    thump.frequency.exponentialRampToValueAtTime(52 * pitchJitter, now + 0.12);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    thump.connect(thumpGain);
    thumpGain.connect(audioMasterGain);
    thump.start(now);
    thump.stop(now + 0.15);

    // Noisy blast + tiny tail echo
    const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.14), ctx.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) channel[i] = (Math.random() * 2 - 1) * 0.95;

    const blast = ctx.createBufferSource();
    const blastGain = ctx.createGain();
    blast.buffer = noiseBuffer;
    blastGain.gain.setValueAtTime(0.28, now);
    blastGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    blast.connect(blastGain);
    blastGain.connect(audioMasterGain);
    blast.start(now);
    blast.stop(now + 0.06);

    const tail = ctx.createBufferSource();
    const tailGain = ctx.createGain();
    tail.buffer = noiseBuffer;
    tailGain.gain.setValueAtTime(0.08, now + 0.055);
    tailGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    tail.connect(tailGain);
    tailGain.connect(audioMasterGain);
    tail.start(now + 0.055);
    tail.stop(now + 0.17);
}

function pickClipByName(nameHints) {
    if (!assets.zombieClips || assets.zombieClips.length === 0) return null;
    const lower = assets.zombieClips.map((c) => c.name.toLowerCase());
    for (const hint of nameHints) {
        const idx = lower.findIndex((name) => name.includes(hint));
        if (idx >= 0) return assets.zombieClips[idx];
    }
    return null;
}

function loadGltf(url) {
    return new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
    });
}

async function loadZombieModel() {
    if (!loader) return;
    for (const path of modelCandidates) {
        try {
            const gltf = await loadGltf(path);
            assets.zombieModel = gltf.scene;
            assets.zombieClips = gltf.animations || [];
            assets.usingFallback = false;
            assets.zombieModel.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    if (node.material) {
                        node.material.roughness = Math.min(1, (node.material.roughness ?? 0.8) + 0.08);
                        node.material.metalness = Math.max(0, (node.material.metalness ?? 0.1) * 0.35);
                    }
                }
            });
            return;
        } catch (_err) {
            // Try next path
        }
    }
    assets.usingFallback = true;
}

function createHumanLikeZombie() {
    const zombie = new THREE.Group();

    const skinPalette = [0x7a9567, 0x86a170, 0x748f61, 0x91aa7a];
    const clothPalette = [0x3f4654, 0x4b3f45, 0x4a5440, 0x3b4e56];
    const skinTone = skinPalette[Math.floor(Math.random() * skinPalette.length)];
    const clothTone = clothPalette[Math.floor(Math.random() * clothPalette.length)];

    const skinMat = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.92 });
    const clothMat = new THREE.MeshStandardMaterial({ color: clothTone, roughness: 0.95 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xb90022 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.36, 1.05, 10), clothMat);
    torso.position.y = 1.2;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), skinMat);
    head.position.set(0, 1.95, 0.05);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.16), skinMat);
    jaw.position.set(0, 1.75, 0.19);

    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.7, 10), skinMat);
    const armR = armL.clone();
    armL.position.set(-0.42, 1.28, 0.04);
    armR.position.set(0.42, 1.28, 0.04);
    armL.rotation.z = 0.28;
    armR.rotation.z = -0.28;

    const forearmL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.62, 10), skinMat);
    const forearmR = forearmL.clone();
    forearmL.position.set(-0.44, 0.95, 0.11);
    forearmR.position.set(0.44, 0.95, 0.11);

    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.78, 10), clothMat);
    const legR = legL.clone();
    legL.position.set(-0.17, 0.5, 0);
    legR.position.set(0.17, 0.5, 0);

    const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.72, 10), clothMat);
    const shinR = shinL.clone();
    shinL.position.set(-0.17, 0.14, 0.07);
    shinR.position.set(0.17, 0.14, 0.07);

    const eyeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.1, 1.98, 0.24);
    eyeR.position.set(0.1, 1.98, 0.24);

    zombie.add(
        torso, head, jaw, armL, armR, forearmL, forearmR, legL, legR, shinL, shinR, eyeL, eyeR
    );

    zombie.traverse((node) => {
        if (node.isMesh) node.castShadow = true;
    });

    return {
        mesh: zombie,
        rig: { torso, head, jaw, armL, armR, forearmL, forearmR, legL, legR, shinL, shinR }
    };
}


function createZombie() {
    let created = null;
    let zombie = null;
    if (assets.zombieModel) {
        const cloneFn = window.THREE.SkeletonUtils && window.THREE.SkeletonUtils.clone
            ? window.THREE.SkeletonUtils.clone
            : (obj) => obj.clone(true);
        zombie = cloneFn(assets.zombieModel);
        zombie.scale.setScalar(1.1);
        zombie.rotation.y = Math.random() * Math.PI * 2;
    } else {
        created = createHumanLikeZombie();
        zombie = created.mesh;
    }

    const angle = Math.random() * Math.PI * 2;
    const distance = 32 + Math.random() * 28;
    zombie.position.set(
        camera.position.x + Math.cos(angle) * distance,
        0,
        camera.position.z + Math.sin(angle) * distance
    );
    zombie.userData = {
        health: 2 + Math.floor(state.wave / 2),
        speed: 1.35 + Math.random() * 1 + state.wave * 0.15,
        gaitPhase: Math.random() * Math.PI * 2,
        gaitRate: 4.8 + Math.random() * 2.3,
        lean: 0.12 + Math.random() * 0.15,
        rig: created ? created.rig : null,
        mixer: null,
        actions: {},
        activeAction: null,
        animRate: 0.9 + Math.random() * 0.25
    };

    if (assets.zombieClips.length > 0) {
        const mixer = new THREE.AnimationMixer(zombie);
        const walkClip = pickClipByName(["walk", "run", "move"]) || assets.zombieClips[0];
        const attackClip = pickClipByName(["attack", "bite", "hit"]) || walkClip;
        zombie.userData.actions.walk = mixer.clipAction(walkClip);
        zombie.userData.actions.attack = mixer.clipAction(attackClip);
        zombie.userData.actions.walk.timeScale = zombie.userData.animRate;
        zombie.userData.actions.attack.timeScale = zombie.userData.animRate * 0.95;
        zombie.userData.actions.walk.play();
        zombie.userData.activeAction = "walk";
        zombie.userData.mixer = mixer;
    }
    scene.add(zombie);
    state.zombies.push(zombie);
}

function showOverlay(title, subtitle) {
    messageTitleEl.textContent = title;
    messageSubtitleEl.textContent = subtitle;
    messageEl.classList.remove("hidden");
}

function hideOverlay() {
    messageEl.classList.add("hidden");
}

function updateHud() {
    scoreEl.textContent = `${state.score}`;
    healthEl.textContent = `${Math.max(0, Math.floor(state.health))}`;
    waveEl.textContent = `${state.wave}`;
}

function resetGame() {
    for (const zombie of state.zombies) {
        scene.remove(zombie);
    }
    state.zombies.length = 0;
    state.score = 0;
    state.health = 100;
    state.wave = 1;
    state.gameOver = false;
    state.started = state.isLocked;
    state.spawnTimer = 0;
    state.shootCooldown = 0;
    state.flashTimer = 0;
    state.damageTick = 0;
    state.recoil = 0;
    state.cameraKick = 0;
    for (const t of state.tracers) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
    }
    state.tracers = [];
    camera.position.set(0, 1.7, 8);
    state.yaw = 0;
    state.pitch = 0;
    camera.rotation.set(0, 0, 0);
    hideOverlay();
    updateHud();
}

function setGameOver() {
    state.gameOver = true;
    showOverlay("Game Over", "Press R to restart. Click to re-lock mouse.");
}

function clampPlayerToArena() {
    const limit = 145;
    camera.position.x = Math.max(-limit, Math.min(limit, camera.position.x));
    camera.position.z = Math.max(-limit, Math.min(limit, camera.position.z));
}

function pushOutOfObstacles() {
    for (const obs of obstacles) {
        const halfX = obs.scale.x;
        const halfZ = obs.scale.z;
        const minX = obs.position.x - halfX - player.radius;
        const maxX = obs.position.x + halfX + player.radius;
        const minZ = obs.position.z - halfZ - player.radius;
        const maxZ = obs.position.z + halfZ + player.radius;

        if (
            camera.position.x > minX &&
            camera.position.x < maxX &&
            camera.position.z > minZ &&
            camera.position.z < maxZ
        ) {
            const dx = Math.min(camera.position.x - minX, maxX - camera.position.x);
            const dz = Math.min(camera.position.z - minZ, maxZ - camera.position.z);

            if (dx < dz) {
                camera.position.x += camera.position.x < obs.position.x ? -dx : dx;
            } else {
                camera.position.z += camera.position.z < obs.position.z ? -dz : dz;
            }
        }
    }
}

function shoot() {
    if (state.gameOver || !state.isLocked || state.shootCooldown > 0) return;

    state.shootCooldown = WEAPON.fireInterval;
    state.flashTimer = 0.045;
    state.recoil = Math.min(1, state.recoil + WEAPON.recoilPerShot);
    state.cameraKick = Math.min(0.03, state.cameraKick + 0.009);
    muzzleFlash.visible = true;
    muzzleLight.intensity = 2.8;
    playShootSound();

    const spread = WEAPON.baseSpread + WEAPON.maxSpread * state.recoil;
    const ndcX = (Math.random() - 0.5) * spread;
    const ndcY = (Math.random() - 0.5) * spread;
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const hits = raycaster.intersectObjects(state.zombies, true);

    const start = new THREE.Vector3();
    const end = new THREE.Vector3();
    start.setFromMatrixPosition(barrel.matrixWorld);

    if (hits.length === 0) {
        end.copy(raycaster.ray.direction).multiplyScalar(42).add(raycaster.ray.origin);
        spawnTracer(start, end, false);
        return;
    }
    end.copy(hits[0].point);
    spawnTracer(start, end, true);

    let zombieRoot = hits[0].object;
    while (zombieRoot && !state.zombies.includes(zombieRoot)) {
        zombieRoot = zombieRoot.parent;
    }
    if (!zombieRoot || !zombieRoot.userData) return;

    zombieRoot.userData.health -= 1;
    if (zombieRoot.userData.health <= 0) {
        state.score += 15;
        if (zombieRoot.userData.mixer) {
            zombieRoot.userData.mixer.stopAllAction();
        }
        scene.remove(zombieRoot);
        const idx = state.zombies.indexOf(zombieRoot);
        if (idx >= 0) state.zombies.splice(idx, 1);
    }
}

function spawnTracer(start, end, isHit) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({
        color: isHit ? 0xffd8a0 : 0x9bb8ff,
        transparent: true,
        opacity: 0.95
    });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    state.tracers.push({ line, life: isHit ? 0.055 : 0.035 });
}

function updateTracers(delta) {
    for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
        const t = state.tracers[i];
        t.life -= delta;
        t.line.material.opacity = Math.max(0, t.life * 20);
        if (t.life <= 0) {
            scene.remove(t.line);
            t.line.geometry.dispose();
            t.line.material.dispose();
            state.tracers.splice(i, 1);
        }
    }
}

function updatePlayer(delta) {
    const move = new THREE.Vector3();
    if (state.keys.w) move.z -= 1;
    if (state.keys.s) move.z += 1;
    if (state.keys.a) move.x -= 1;
    if (state.keys.d) move.x += 1;

    if (move.lengthSq() > 0) move.normalize();
    move.multiplyScalar(player.speed * delta);

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, state.yaw, 0, "YXZ"));
    const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, state.yaw, 0, "YXZ"));
    state.velocity.set(0, 0, 0);
    state.velocity.addScaledVector(forward, move.z);
    state.velocity.addScaledVector(right, move.x);

    camera.position.add(state.velocity);
    clampPlayerToArena();
    pushOutOfObstacles();
}

function updateZombies(delta) {
    let inDamageRange = 0;

    for (const zombie of state.zombies) {
        zombie.userData.gaitPhase += delta * zombie.userData.gaitRate;
        if (zombie.userData.mixer) {
            zombie.userData.mixer.update(delta);
        }

        const dx = camera.position.x - zombie.position.x;
        const dz = camera.position.z - zombie.position.z;
        const dist = Math.hypot(dx, dz) || 0.001;
        const nx = dx / dist;
        const nz = dz / dist;

        const shambleFactor = 0.82 + Math.sin(zombie.userData.gaitPhase) * 0.18;
        zombie.position.x += nx * zombie.userData.speed * shambleFactor * delta;
        zombie.position.z += nz * zombie.userData.speed * shambleFactor * delta;
        zombie.lookAt(camera.position.x, 1.1, camera.position.z);
        zombie.rotation.x = Math.sin(zombie.userData.gaitPhase) * 0.03 + zombie.userData.lean;

        const rig = zombie.userData.rig;
        if (rig) {
            const wave = Math.sin(zombie.userData.gaitPhase);
            const waveOpp = Math.sin(zombie.userData.gaitPhase + Math.PI);
            rig.armL.rotation.x = 0.45 + wave * 0.45;
            rig.armR.rotation.x = 0.42 + waveOpp * 0.45;
            rig.forearmL.rotation.x = 0.2 + wave * 0.25;
            rig.forearmR.rotation.x = 0.22 + waveOpp * 0.25;
            rig.legL.rotation.x = waveOpp * 0.42;
            rig.legR.rotation.x = wave * 0.42;
            rig.shinL.rotation.x = -waveOpp * 0.3;
            rig.shinR.rotation.x = -wave * 0.3;
            rig.torso.rotation.z = Math.sin(zombie.userData.gaitPhase * 0.8) * 0.04;
            rig.head.rotation.y = Math.sin(zombie.userData.gaitPhase * 0.35) * 0.1;
            rig.jaw.rotation.x = 0.05 + Math.sin(zombie.userData.gaitPhase * 0.9) * 0.04;
        }

        if (zombie.userData.actions.walk) {
            const targetAction = dist < 1.8 && zombie.userData.actions.attack ? "attack" : "walk";
            if (targetAction !== zombie.userData.activeAction) {
                const prev = zombie.userData.actions[zombie.userData.activeAction];
                const next = zombie.userData.actions[targetAction];
                if (prev) prev.fadeOut(0.12);
                if (next) next.reset().fadeIn(0.12).play();
                zombie.userData.activeAction = targetAction;
            }
        }

        if (dist < 1.6) inDamageRange += 1;
    }

    if (inDamageRange > 0) {
        state.damageTick += delta;
        if (state.damageTick > 0.1) {
            state.health -= inDamageRange * 1.8;
            state.damageTick = 0;
            if (state.health <= 0) {
                state.health = 0;
                setGameOver();
            }
        }
    } else {
        state.damageTick = 0;
    }
}

function updateWaveAndSpawning(delta) {
    const nextWave = 1 + Math.floor(state.score / 180);
    state.wave = nextWave;
    state.spawnTimer -= delta;

    if (state.spawnTimer <= 0 && state.zombies.length < 12 + state.wave * 2) {
        createZombie();
        const baseDelay = 1.4 - state.wave * 0.06;
        state.spawnTimer = Math.max(0.35, baseDelay);
    }
}

function updateEnvironment(delta) {
    const t = performance.now() * 0.001;
    for (let i = 0; i < forestCrowns.length; i += 1) {
        const c = forestCrowns[i];
        c.rotation.z = c.userData.baseRotZ + Math.sin(t * 1.2 + i * 0.37) * 0.045;
        c.rotation.x = Math.cos(t * 0.9 + i * 0.21) * 0.02;
    }

    if (mistField) {
        const pos = mistField.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 1) {
            let x = pos.getX(i);
            let y = pos.getY(i);
            let z = pos.getZ(i);
            x += Math.sin((t + i) * 0.015) * 0.015;
            z += 0.05 * delta;
            y += Math.sin((t + i * 0.11) * 0.4) * 0.0015;

            if (z > 145) z = -145;
            if (x > 145) x = -145;
            if (x < -145) x = 145;
            if (y < 0.2) y = 0.2;
            if (y > 8.0) y = 8.0;

            pos.setXYZ(i, x, y, z);
        }
        pos.needsUpdate = true;
    }

    for (let i = 0; i < pondSurfaces.length; i += 1) {
        const p = pondSurfaces[i];
        const ripple = Math.sin(t * 1.8 + p.phase) * 0.012;
        p.mesh.position.y = p.baseY + ripple;
        p.mesh.material.opacity = 0.72 + Math.sin(t * 1.3 + p.phase * 0.7) * 0.06;
    }
}

function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    updateEnvironment(delta);

    if (!state.gameOver && state.started) {
        updatePlayer(delta);
        updateZombies(delta);
        updateWaveAndSpawning(delta);
    }

    if (state.shootCooldown > 0) state.shootCooldown -= delta;
    state.recoil = Math.max(0, state.recoil - delta * WEAPON.recoilRecover);
    state.cameraKick = Math.max(0, state.cameraKick - delta * 0.08);
    updateTracers(delta);
    if (state.flashTimer > 0) {
        state.flashTimer -= delta;
        gun.position.z = -0.06;
        gun.position.y = -0.01;
    } else {
        muzzleFlash.visible = false;
        gun.position.z = 0;
        gun.position.y = 0;
    }
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - delta * 28);

    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch - state.cameraKick;
    gun.rotation.x = state.pitch * 0.08 + state.recoil * 0.12;
    gun.rotation.y = -state.recoil * 0.05;

    updateHud();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", onResize);
window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d"].includes(key)) state.keys[key] = true;
    if (key === "r") resetGame();
});
window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d"].includes(key)) state.keys[key] = false;
});

document.addEventListener("pointerlockchange", () => {
    state.isLocked = document.pointerLockElement === canvas;
    if (state.isLocked && !state.gameOver) {
        state.started = true;
        hideOverlay();
    }
    if (!state.isLocked && !state.gameOver) {
        showOverlay("Paused", "Click to continue. WASD move, click shoot.");
    }
});

canvas.addEventListener("click", () => {
    unlockAudio();
    if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
        return;
    }
    shoot();
});

messageEl.addEventListener("click", () => {
    unlockAudio();
    if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
    }
});

document.addEventListener("mousemove", (event) => {
    if (!state.isLocked || state.gameOver) return;
    const sensitivity = 0.0022;
    state.yaw -= event.movementX * sensitivity;
    state.pitch -= event.movementY * sensitivity;
    state.pitch = Math.max(-1.3, Math.min(1.3, state.pitch));
});

showOverlay("Zombie FPS", "Click to lock mouse and start. WASD move, click shoot, R restart.");
updateHud();
loadZombieModel();
animate();

setTimeout(() => {
    if (assets.usingFallback) {
        showOverlay(
            "Model Needed",
            "For real human zombie look, add assets/models/zombie.glb (or zombie.gltf). Click to play fallback."
        );
    }
}, 500);
