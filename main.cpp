#include <windows.h>
#include <windowsx.h>

#include <algorithm>
#include <cmath>
#include <ctime>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

namespace {

const int kWindowWidth = 960;
const int kWindowHeight = 640;
const float kPlayerSpeed = 330.0f;
const float kBulletSpeed = 700.0f;
const float kZombieMinSpeed = 55.0f;
const float kZombieMaxSpeed = 120.0f;
const float kBaseSpawnInterval = 1.15f;
const float kBossSpawnInterval = 1.85f;
const int kTargetFps = 60;
const int kMaxHealth = 5;
const bool kSoundEnabled = false;

enum WeaponType {
    WEAPON_PISTOL,
    WEAPON_RIFLE,
    WEAPON_BATTLE_RIFLE,
    WEAPON_SHOTGUN,
    WEAPON_COUNT
};

struct WeaponSpec {
    const char* name;
    int magazineSize;
    int reserveAmmoStart;
    float reloadDuration;
    float fireCooldown;
    int bulletDamage;
    int bulletCount;
    float spread;
};

const WeaponSpec kWeaponSpecs[WEAPON_COUNT] = {
    {"Pistol", 12, 72, 1.2f, 0.16f, 1, 1, 0.0f},
    {"AK-47", 24, 120, 1.45f, 0.09f, 1, 1, 0.0f},
    {"M4 Rifle", 30, 150, 1.35f, 0.08f, 1, 1, 0.03f},
    {"Shotgun", 6, 42, 1.65f, 0.52f, 1, 5, 0.22f},
};

enum ScreenState {
    SCREEN_MENU,
    SCREEN_PLAYING,
    SCREEN_GAME_OVER
};

enum SoundEffect {
    SOUND_SHOOT_PISTOL,
    SOUND_SHOOT_RIFLE,
    SOUND_SHOOT_SHOTGUN,
    SOUND_RELOAD,
    SOUND_PLAYER_HIT,
    SOUND_ZOMBIE_DOWN,
    SOUND_BOSS_DOWN,
    SOUND_WAVE_START,
    SOUND_WEAPON_SWITCH
};

const int kSoundQueueSize = 64;

struct Vec2 {
    float x;
    float y;
};

struct Bullet {
    Vec2 pos;
    Vec2 velocity;
    int damage;
    WeaponType weaponType;
    bool alive;
};

struct Zombie {
    Vec2 pos;
    float speed;
    float radius;
    int health;
    int maxHealth;
    int scoreValue;
    bool boss;
    bool alive;
};

struct Player {
    Vec2 pos;
    float radius;
    int health;
};

struct GameState {
    Player player;
    std::vector<Bullet> bullets;
    std::vector<Zombie> zombies;
    bool keys[256];
    bool mouseDown;
    bool pauseHeld;
    bool reloadHeld;
    bool weaponSwitchHeld[WEAPON_COUNT];
    POINT mousePos;
    float fireCooldown;
    float zombieSpawnTimer;
    float zombieSpawnInterval;
    float invulnerabilityTimer;
    float waveBannerTimer;
    float reloadTimer;
    int score;
    int highScore;
    int wave;
    int zombiesToSpawn;
    int zombiesSpawnedThisWave;
    int ammoInMagazine;
    int reserveAmmo;
    WeaponType currentWeapon;
    bool paused;
    bool reloading;
    bool bossWave;
    bool running;
    ScreenState screen;
};

GameState g_game = {};
const char* kHighScoreFile = "highscore.txt";
CRITICAL_SECTION g_soundLock;
HANDLE g_soundEvent = NULL;
HANDLE g_soundThread = NULL;
bool g_soundRunning = false;
SoundEffect g_soundQueue[kSoundQueueSize] = {};
int g_soundQueueHead = 0;
int g_soundQueueTail = 0;
DWORD g_lastSoundTicks[9] = {};

float Clamp(float value, float minValue, float maxValue) {
    return std::max(minValue, std::min(value, maxValue));
}

float Length(const Vec2& v) {
    return std::sqrt(v.x * v.x + v.y * v.y);
}

Vec2 Normalize(const Vec2& v) {
    float len = Length(v);
    if (len <= 0.0001f) {
        return {0.0f, 0.0f};
    }
    return {v.x / len, v.y / len};
}

float Distance(const Vec2& a, const Vec2& b) {
    return Length({a.x - b.x, a.y - b.y});
}

int RandomRange(int minValue, int maxValue) {
    return minValue + (rand() % (maxValue - minValue + 1));
}

float RandomRangeFloat(float minValue, float maxValue) {
    return minValue + static_cast<float>(rand()) / static_cast<float>(RAND_MAX) * (maxValue - minValue);
}

void PlaySoundNow(SoundEffect effect) {
    switch (effect) {
        case SOUND_SHOOT_PISTOL:
            Beep(820, 16);
            Beep(640, 12);
            return;
        case SOUND_SHOOT_RIFLE:
            Beep(880, 8);
            Beep(980, 6);
            return;
        case SOUND_SHOOT_SHOTGUN:
            Beep(460, 20);
            Beep(320, 35);
            return;
        case SOUND_RELOAD:
            Beep(520, 18);
            Beep(620, 18);
            Beep(820, 26);
            return;
        case SOUND_PLAYER_HIT:
            Beep(260, 40);
            Beep(180, 55);
            return;
        case SOUND_ZOMBIE_DOWN:
            Beep(350, 14);
            Beep(280, 18);
            return;
        case SOUND_BOSS_DOWN:
            Beep(260, 40);
            Beep(320, 40);
            Beep(420, 55);
            Beep(620, 80);
            return;
        case SOUND_WAVE_START:
            Beep(520, 20);
            Beep(660, 24);
            Beep(820, 32);
            return;
        case SOUND_WEAPON_SWITCH:
            Beep(700, 12);
            Beep(840, 14);
            return;
    }
}

DWORD WINAPI SoundThreadProc(LPVOID) {
    while (g_soundRunning) {
        WaitForSingleObject(g_soundEvent, INFINITE);

        while (true) {
            SoundEffect effect = SOUND_WEAPON_SWITCH;
            bool hasEffect = false;

            EnterCriticalSection(&g_soundLock);
            if (g_soundQueueHead != g_soundQueueTail) {
                effect = g_soundQueue[g_soundQueueHead];
                g_soundQueueHead = (g_soundQueueHead + 1) % kSoundQueueSize;
                hasEffect = true;
            } else {
                ResetEvent(g_soundEvent);
            }
            LeaveCriticalSection(&g_soundLock);

            if (!hasEffect) {
                break;
            }

            PlaySoundNow(effect);
        }
    }
    return 0;
}

DWORD SoundCooldownMs(SoundEffect effect) {
    switch (effect) {
        case SOUND_SHOOT_PISTOL:
            return 80;
        case SOUND_SHOOT_RIFLE:
            return 45;
        case SOUND_SHOOT_SHOTGUN:
            return 180;
        case SOUND_RELOAD:
            return 200;
        case SOUND_PLAYER_HIT:
            return 250;
        case SOUND_ZOMBIE_DOWN:
            return 45;
        case SOUND_BOSS_DOWN:
            return 400;
        case SOUND_WAVE_START:
            return 400;
        case SOUND_WEAPON_SWITCH:
            return 120;
    }
    return 0;
}

void StartSoundSystem() {
    if (!kSoundEnabled) {
        return;
    }
    InitializeCriticalSection(&g_soundLock);
    g_soundEvent = CreateEvent(NULL, TRUE, FALSE, NULL);
    g_soundRunning = true;
    g_soundThread = CreateThread(NULL, 0, SoundThreadProc, NULL, 0, NULL);
}

void StopSoundSystem() {
    if (!kSoundEnabled) {
        return;
    }
    if (!g_soundEvent) {
        return;
    }

    g_soundRunning = false;
    SetEvent(g_soundEvent);
    if (g_soundThread) {
        WaitForSingleObject(g_soundThread, 1000);
        CloseHandle(g_soundThread);
        g_soundThread = NULL;
    }
    CloseHandle(g_soundEvent);
    g_soundEvent = NULL;
    DeleteCriticalSection(&g_soundLock);
}

void PlaySoundAsync(SoundEffect effect) {
    if (!kSoundEnabled) {
        return;
    }
    DWORD now = GetTickCount();
    if (now - g_lastSoundTicks[effect] < SoundCooldownMs(effect)) {
        return;
    }
    g_lastSoundTicks[effect] = now;

    EnterCriticalSection(&g_soundLock);
    int nextTail = (g_soundQueueTail + 1) % kSoundQueueSize;
    if (nextTail != g_soundQueueHead) {
        g_soundQueue[g_soundQueueTail] = effect;
        g_soundQueueTail = nextTail;
        SetEvent(g_soundEvent);
    }
    LeaveCriticalSection(&g_soundLock);
}

int LoadHighScore() {
    std::ifstream input(kHighScoreFile);
    int value = 0;
    if (input >> value) {
        return std::max(0, value);
    }
    return 0;
}

void SaveHighScore() {
    std::ofstream output(kHighScoreFile, std::ios::trunc);
    if (output) {
        output << g_game.highScore;
    }
}

const WeaponSpec& CurrentWeapon() {
    return kWeaponSpecs[g_game.currentWeapon];
}

void ApplyWeaponAmmoDefaults(WeaponType weapon) {
    g_game.currentWeapon = weapon;
    g_game.ammoInMagazine = kWeaponSpecs[weapon].magazineSize;
    g_game.reserveAmmo = kWeaponSpecs[weapon].reserveAmmoStart;
    g_game.reloading = false;
    g_game.reloadTimer = 0.0f;
}

void SwitchWeapon(WeaponType weapon) {
    if (g_game.currentWeapon == weapon) {
        return;
    }
    ApplyWeaponAmmoDefaults(weapon);
    g_game.fireCooldown = 0.0f;
    PlaySoundAsync(SOUND_WEAPON_SWITCH);
}

void StartReload() {
    if (g_game.reloading || g_game.ammoInMagazine >= CurrentWeapon().magazineSize || g_game.reserveAmmo <= 0) {
        return;
    }
    g_game.reloading = true;
    g_game.reloadTimer = CurrentWeapon().reloadDuration;
}

void FinishReload() {
    int need = CurrentWeapon().magazineSize - g_game.ammoInMagazine;
    int amount = std::min(need, g_game.reserveAmmo);
    g_game.ammoInMagazine += amount;
    g_game.reserveAmmo -= amount;
    g_game.reloading = false;
    g_game.reloadTimer = 0.0f;
    PlaySoundAsync(SOUND_RELOAD);
}

void StartWave(int waveNumber) {
    g_game.wave = waveNumber;
    g_game.bossWave = waveNumber % 5 == 0;
    g_game.zombiesSpawnedThisWave = 0;
    g_game.zombiesToSpawn = g_game.bossWave ? 1 : 5 + (waveNumber - 1) * 3;
    g_game.zombieSpawnTimer = 0.0f;
    g_game.zombieSpawnInterval = g_game.bossWave
                                     ? kBossSpawnInterval
                                     : std::max(0.28f, kBaseSpawnInterval - waveNumber * 0.08f);
    g_game.waveBannerTimer = 2.2f;
    PlaySoundAsync(SOUND_WAVE_START);
}

void StartNewRun() {
    g_game.player = {{kWindowWidth / 2.0f, kWindowHeight / 2.0f}, 18.0f, kMaxHealth};
    g_game.bullets.clear();
    g_game.zombies.clear();
    g_game.mouseDown = false;
    g_game.fireCooldown = 0.0f;
    g_game.invulnerabilityTimer = 0.0f;
    g_game.reloadTimer = 0.0f;
    g_game.score = 0;
    g_game.paused = false;
    g_game.reloading = false;
    ApplyWeaponAmmoDefaults(WEAPON_PISTOL);
    g_game.screen = SCREEN_PLAYING;
    StartWave(1);
}

void ResetGame() {
    ZeroMemory(g_game.keys, sizeof(g_game.keys));
    g_game.mouseDown = false;
    g_game.pauseHeld = false;
    g_game.reloadHeld = false;
    ZeroMemory(g_game.weaponSwitchHeld, sizeof(g_game.weaponSwitchHeld));
    g_game.mousePos = {kWindowWidth / 2, kWindowHeight / 2};
    g_game.highScore = LoadHighScore();
    g_game.running = true;
    g_game.screen = SCREEN_MENU;
    g_game.paused = false;
    g_game.waveBannerTimer = 0.0f;
    StartNewRun();
    g_game.screen = SCREEN_MENU;
}

Zombie MakeZombie(bool boss) {
    Zombie zombie = {};
    int edge = RandomRange(0, 3);
    float waveBonus = static_cast<float>(g_game.wave - 1) * 8.0f;

    zombie.boss = boss;
    zombie.alive = true;
    if (boss) {
        zombie.speed = 48.0f + g_game.wave * 5.5f;
        zombie.radius = 42.0f;
        zombie.maxHealth = 14 + g_game.wave * 2;
        zombie.health = zombie.maxHealth;
        zombie.scoreValue = 160;
    } else {
        zombie.speed = RandomRangeFloat(kZombieMinSpeed + waveBonus, kZombieMaxSpeed + waveBonus);
        zombie.radius = static_cast<float>(RandomRange(16, 28));
        zombie.maxHealth = 1;
        zombie.health = 1;
        zombie.scoreValue = 10;
    }

    switch (edge) {
        case 0:
            zombie.pos = {static_cast<float>(RandomRange(0, kWindowWidth)), -60.0f};
            break;
        case 1:
            zombie.pos = {static_cast<float>(RandomRange(0, kWindowWidth)), static_cast<float>(kWindowHeight + 60)};
            break;
        case 2:
            zombie.pos = {-60.0f, static_cast<float>(RandomRange(0, kWindowHeight))};
            break;
        default:
            zombie.pos = {static_cast<float>(kWindowWidth + 60), static_cast<float>(RandomRange(0, kWindowHeight))};
            break;
    }

    return zombie;
}

void SpawnZombie() {
    bool spawnBoss = g_game.bossWave;
    g_game.zombies.push_back(MakeZombie(spawnBoss));
}

void ShootBullet() {
    Vec2 direction = Normalize({static_cast<float>(g_game.mousePos.x) - g_game.player.pos.x,
                                static_cast<float>(g_game.mousePos.y) - g_game.player.pos.y});
    if (Length(direction) <= 0.0001f) {
        return;
    }

    const WeaponSpec& weapon = CurrentWeapon();
    if (g_game.currentWeapon == WEAPON_PISTOL) {
        PlaySoundAsync(SOUND_SHOOT_PISTOL);
    } else if (g_game.currentWeapon == WEAPON_RIFLE) {
        PlaySoundAsync(SOUND_SHOOT_RIFLE);
    } else {
        PlaySoundAsync(SOUND_SHOOT_SHOTGUN);
    }

    for (int i = 0; i < weapon.bulletCount; ++i) {
        float spreadOffset = weapon.bulletCount == 1 ? 0.0f : RandomRangeFloat(-weapon.spread, weapon.spread);
        Vec2 spreadDirection = Normalize({direction.x + spreadOffset, direction.y + spreadOffset * 0.55f});

        Bullet bullet = {};
        bullet.pos = g_game.player.pos;
        bullet.velocity = {spreadDirection.x * kBulletSpeed, spreadDirection.y * kBulletSpeed};
        bullet.damage = weapon.bulletDamage;
        bullet.weaponType = g_game.currentWeapon;
        bullet.alive = true;
        g_game.bullets.push_back(bullet);
    }
}

void HandlePlayerHit() {
    if (g_game.invulnerabilityTimer > 0.0f) {
        return;
    }

    g_game.player.health -= 1;
    g_game.invulnerabilityTimer = 1.0f;
    PlaySoundAsync(SOUND_PLAYER_HIT);
    if (g_game.player.health <= 0) {
        g_game.player.health = 0;
        g_game.screen = SCREEN_GAME_OVER;
        g_game.highScore = std::max(g_game.highScore, g_game.score);
        SaveHighScore();
    }
}

void UpdateWaveState(float deltaTime) {
    g_game.zombieSpawnTimer += deltaTime;
    if (g_game.zombiesSpawnedThisWave < g_game.zombiesToSpawn &&
        g_game.zombieSpawnTimer >= g_game.zombieSpawnInterval) {
        g_game.zombieSpawnTimer = 0.0f;
        SpawnZombie();
        g_game.zombiesSpawnedThisWave += 1;
    }

    bool waveCleared = g_game.zombiesSpawnedThisWave >= g_game.zombiesToSpawn && g_game.zombies.empty();
    if (waveCleared) {
        g_game.score += g_game.bossWave ? 75 : 25;
        g_game.reserveAmmo += g_game.bossWave ? 18 : 8;
        StartWave(g_game.wave + 1);
    }
}

void UpdateReload(float deltaTime) {
    if (!g_game.reloading) {
        return;
    }

    g_game.reloadTimer = std::max(0.0f, g_game.reloadTimer - deltaTime);
    if (g_game.reloadTimer <= 0.0f) {
        FinishReload();
    }
}

void UpdateGame(float deltaTime) {
    if (!g_game.running) {
        return;
    }

    if (g_game.keys['P'] && !g_game.pauseHeld && g_game.screen == SCREEN_PLAYING) {
        g_game.paused = !g_game.paused;
        g_game.pauseHeld = true;
    }
    if (!g_game.keys['P']) {
        g_game.pauseHeld = false;
    }

    if (g_game.screen == SCREEN_MENU) {
        if (g_game.keys[VK_RETURN]) {
            ZeroMemory(g_game.keys, sizeof(g_game.keys));
            StartNewRun();
        }
        return;
    }

    if (g_game.screen == SCREEN_GAME_OVER) {
        if (g_game.keys['R']) {
            ZeroMemory(g_game.keys, sizeof(g_game.keys));
            StartNewRun();
        }
        if (g_game.keys[VK_ESCAPE]) {
            ZeroMemory(g_game.keys, sizeof(g_game.keys));
            g_game.screen = SCREEN_MENU;
        }
        return;
    }

    if (g_game.keys['R'] && !g_game.reloadHeld) {
        StartReload();
        g_game.reloadHeld = true;
    }
    if (!g_game.keys['R']) {
        g_game.reloadHeld = false;
    }

    if (g_game.paused) {
        return;
    }

    if (g_game.keys['1'] && !g_game.weaponSwitchHeld[WEAPON_PISTOL]) {
        SwitchWeapon(WEAPON_PISTOL);
        g_game.weaponSwitchHeld[WEAPON_PISTOL] = true;
    }
    if (!g_game.keys['1']) {
        g_game.weaponSwitchHeld[WEAPON_PISTOL] = false;
    }

    if (g_game.keys['2'] && !g_game.weaponSwitchHeld[WEAPON_RIFLE]) {
        SwitchWeapon(WEAPON_RIFLE);
        g_game.weaponSwitchHeld[WEAPON_RIFLE] = true;
    }
    if (!g_game.keys['2']) {
        g_game.weaponSwitchHeld[WEAPON_RIFLE] = false;
    }

    if (g_game.keys['3'] && !g_game.weaponSwitchHeld[WEAPON_BATTLE_RIFLE]) {
        SwitchWeapon(WEAPON_BATTLE_RIFLE);
        g_game.weaponSwitchHeld[WEAPON_BATTLE_RIFLE] = true;
    }
    if (!g_game.keys['3']) {
        g_game.weaponSwitchHeld[WEAPON_BATTLE_RIFLE] = false;
    }

    if (g_game.keys['4'] && !g_game.weaponSwitchHeld[WEAPON_SHOTGUN]) {
        SwitchWeapon(WEAPON_SHOTGUN);
        g_game.weaponSwitchHeld[WEAPON_SHOTGUN] = true;
    }
    if (!g_game.keys['4']) {
        g_game.weaponSwitchHeld[WEAPON_SHOTGUN] = false;
    }

    g_game.waveBannerTimer = std::max(0.0f, g_game.waveBannerTimer - deltaTime);
    g_game.invulnerabilityTimer = std::max(0.0f, g_game.invulnerabilityTimer - deltaTime);
    UpdateReload(deltaTime);

    Vec2 movement = {0.0f, 0.0f};
    if (g_game.keys['W'] || g_game.keys[VK_UP]) {
        movement.y -= 1.0f;
    }
    if (g_game.keys['S'] || g_game.keys[VK_DOWN]) {
        movement.y += 1.0f;
    }
    if (g_game.keys['A'] || g_game.keys[VK_LEFT]) {
        movement.x -= 1.0f;
    }
    if (g_game.keys['D'] || g_game.keys[VK_RIGHT]) {
        movement.x += 1.0f;
    }

    movement = Normalize(movement);
    g_game.player.pos.x += movement.x * kPlayerSpeed * deltaTime;
    g_game.player.pos.y += movement.y * kPlayerSpeed * deltaTime;
    g_game.player.pos.x = Clamp(g_game.player.pos.x, g_game.player.radius, kWindowWidth - g_game.player.radius);
    g_game.player.pos.y = Clamp(g_game.player.pos.y, g_game.player.radius, kWindowHeight - g_game.player.radius);

    g_game.fireCooldown -= deltaTime;
    bool wantsShoot = g_game.mouseDown || g_game.keys[VK_SPACE];
    if (wantsShoot && g_game.fireCooldown <= 0.0f && !g_game.reloading) {
        if (g_game.ammoInMagazine > 0) {
            ShootBullet();
            g_game.ammoInMagazine -= 1;
            g_game.fireCooldown = CurrentWeapon().fireCooldown;
            if (g_game.ammoInMagazine == 0) {
                StartReload();
            }
        } else {
            StartReload();
            g_game.fireCooldown = 0.18f;
        }
    }

    UpdateWaveState(deltaTime);

    for (std::size_t i = 0; i < g_game.bullets.size(); ++i) {
        Bullet& bullet = g_game.bullets[i];
        if (!bullet.alive) {
            continue;
        }

        bullet.pos.x += bullet.velocity.x * deltaTime;
        bullet.pos.y += bullet.velocity.y * deltaTime;

        if (bullet.pos.x < -10.0f || bullet.pos.x > kWindowWidth + 10.0f ||
            bullet.pos.y < -10.0f || bullet.pos.y > kWindowHeight + 10.0f) {
            bullet.alive = false;
        }
    }

    for (std::size_t i = 0; i < g_game.zombies.size(); ++i) {
        Zombie& zombie = g_game.zombies[i];
        if (!zombie.alive) {
            continue;
        }

        Vec2 direction = Normalize({g_game.player.pos.x - zombie.pos.x, g_game.player.pos.y - zombie.pos.y});
        zombie.pos.x += direction.x * zombie.speed * deltaTime;
        zombie.pos.y += direction.y * zombie.speed * deltaTime;

        if (Distance(zombie.pos, g_game.player.pos) <= zombie.radius + g_game.player.radius) {
            if (!zombie.boss) {
                zombie.alive = false;
            }
            HandlePlayerHit();
        }
    }

    for (std::size_t i = 0; i < g_game.bullets.size(); ++i) {
        Bullet& bullet = g_game.bullets[i];
        if (!bullet.alive) {
            continue;
        }

        for (std::size_t j = 0; j < g_game.zombies.size(); ++j) {
            Zombie& zombie = g_game.zombies[j];
            if (!zombie.alive) {
                continue;
            }

            if (Distance(bullet.pos, zombie.pos) <= zombie.radius + 4.0f) {
                bullet.alive = false;
                zombie.health -= bullet.damage;
                if (zombie.health <= 0) {
                    zombie.alive = false;
                    g_game.score += zombie.scoreValue;
                    PlaySoundAsync(zombie.boss ? SOUND_BOSS_DOWN : SOUND_ZOMBIE_DOWN);
                    if (g_game.score > g_game.highScore) {
                        g_game.highScore = g_game.score;
                        SaveHighScore();
                    }
                    if (zombie.boss) {
                        g_game.reserveAmmo += 24;
                    }
                }
                break;
            }
        }
    }

    g_game.bullets.erase(
        std::remove_if(g_game.bullets.begin(), g_game.bullets.end(),
                       [](const Bullet& bullet) { return !bullet.alive; }),
        g_game.bullets.end());

    g_game.zombies.erase(
        std::remove_if(g_game.zombies.begin(), g_game.zombies.end(),
                       [](const Zombie& zombie) { return !zombie.alive; }),
        g_game.zombies.end());
}

void DrawCircle(HDC hdc, int centerX, int centerY, int radius, COLORREF fillColor, COLORREF outlineColor) {
    HPEN pen = CreatePen(PS_SOLID, 2, outlineColor);
    HBRUSH brush = CreateSolidBrush(fillColor);
    HGDIOBJ oldPen = SelectObject(hdc, pen);
    HGDIOBJ oldBrush = SelectObject(hdc, brush);

    Ellipse(hdc, centerX - radius, centerY - radius, centerX + radius, centerY + radius);

    SelectObject(hdc, oldPen);
    SelectObject(hdc, oldBrush);
    DeleteObject(pen);
    DeleteObject(brush);
}

void FillRectColor(HDC hdc, int left, int top, int right, int bottom, COLORREF color) {
    RECT rect = {left, top, right, bottom};
    HBRUSH brush = CreateSolidBrush(color);
    FillRect(hdc, &rect, brush);
    DeleteObject(brush);
}

void DrawLine(HDC hdc, int x1, int y1, int x2, int y2, COLORREF color, int width) {
    HPEN pen = CreatePen(PS_SOLID, width, color);
    HGDIOBJ oldPen = SelectObject(hdc, pen);
    MoveToEx(hdc, x1, y1, NULL);
    LineTo(hdc, x2, y2);
    SelectObject(hdc, oldPen);
    DeleteObject(pen);
}

void DrawPlayerSprite(HDC hdc, const Player& player, const POINT& mousePos) {
    int x = static_cast<int>(player.pos.x);
    int y = static_cast<int>(player.pos.y);
    Vec2 aim = Normalize({static_cast<float>(mousePos.x) - player.pos.x, static_cast<float>(mousePos.y) - player.pos.y});
    int gunX = x + static_cast<int>(aim.x * 18.0f);
    int gunY = y + static_cast<int>(aim.y * 18.0f);
    int forwardX = static_cast<int>(aim.x * 22.0f);
    int forwardY = static_cast<int>(aim.y * 22.0f);

    FillRectColor(hdc, x - 9, y + 14, x - 1, y + 28, RGB(32, 52, 92));
    FillRectColor(hdc, x + 1, y + 14, x + 9, y + 28, RGB(32, 52, 92));
    FillRectColor(hdc, x - 13, y - 4, x + 13, y + 16, RGB(44, 112, 235));
    FillRectColor(hdc, x - 9, y - 18, x + 9, y - 2, RGB(243, 214, 172));
    FillRectColor(hdc, x - 11, y - 22, x + 11, y - 16, RGB(35, 44, 75));

    if (g_game.currentWeapon == WEAPON_RIFLE) {
        int stockX = x - static_cast<int>(aim.x * 12.0f);
        int stockY = y + 2 - static_cast<int>(aim.y * 12.0f);
        DrawLine(hdc, stockX, stockY, x + forwardX, y + forwardY, RGB(70, 76, 84), 5);
        DrawLine(hdc, x - static_cast<int>(aim.x * 3.0f), y + 1 - static_cast<int>(aim.y * 3.0f),
                 x + static_cast<int>(aim.x * 28.0f), y + static_cast<int>(aim.y * 28.0f), RGB(110, 116, 124), 3);
        FillRectColor(hdc, x - 20, y - 3, x - 10, y + 5, RGB(96, 62, 32));
        FillRectColor(hdc, gunX - 3, gunY - 2, gunX + 7, gunY + 2, RGB(96, 62, 32));
        FillRectColor(hdc, x - 1, y + 4, x + 5, y + 16, RGB(126, 84, 40));
        DrawLine(hdc, x + 2, y + 9, x + 7, y + 19, RGB(126, 84, 40), 4);
        DrawLine(hdc, x + static_cast<int>(aim.x * 28.0f), y + static_cast<int>(aim.y * 28.0f),
                 x + static_cast<int>(aim.x * 34.0f), y + static_cast<int>(aim.y * 34.0f), RGB(180, 190, 198), 2);
    } else if (g_game.currentWeapon == WEAPON_BATTLE_RIFLE) {
        int stockX = x - static_cast<int>(aim.x * 14.0f);
        int stockY = y + 1 - static_cast<int>(aim.y * 14.0f);
        DrawLine(hdc, stockX, stockY, x + static_cast<int>(aim.x * 24.0f), y + static_cast<int>(aim.y * 24.0f),
                 RGB(52, 56, 64), 5);
        DrawLine(hdc, x - static_cast<int>(aim.x * 4.0f), y - static_cast<int>(aim.y * 4.0f),
                 x + static_cast<int>(aim.x * 30.0f), y + static_cast<int>(aim.y * 30.0f), RGB(155, 160, 170), 3);
        FillRectColor(hdc, x - 20, y - 4, x - 9, y + 5, RGB(52, 56, 64));
        FillRectColor(hdc, x - 3, y + 4, x + 3, y + 16, RGB(70, 74, 82));
        FillRectColor(hdc, gunX - 3, gunY - 2, gunX + 9, gunY + 2, RGB(72, 76, 84));
        FillRectColor(hdc, x + 3, y - 7, x + 12, y - 2, RGB(44, 48, 56));
        FillRectColor(hdc, x + 11, y - 10, x + 14, y - 2, RGB(34, 38, 44));
        DrawLine(hdc, x + static_cast<int>(aim.x * 30.0f), y + static_cast<int>(aim.y * 30.0f),
                 x + static_cast<int>(aim.x * 36.0f), y + static_cast<int>(aim.y * 36.0f), RGB(200, 205, 215), 2);
        DrawLine(hdc, x + static_cast<int>(aim.x * 18.0f), y + static_cast<int>(aim.y * 18.0f),
                 x + static_cast<int>(aim.x * 18.0f), y + static_cast<int>(aim.y * 18.0f) - 7, RGB(28, 30, 36), 2);
    } else if (g_game.currentWeapon == WEAPON_SHOTGUN) {
        DrawLine(hdc, x - 15, y + 2, gunX, gunY, RGB(180, 220, 255), 5);
        FillRectColor(hdc, gunX - 4, gunY - 2, gunX + 6, gunY + 2, RGB(122, 78, 42));
    } else {
        DrawLine(hdc, x - 15, y + 2, gunX, gunY, RGB(180, 220, 255), 3);
        FillRectColor(hdc, gunX - 4, gunY - 2, gunX + 6, gunY + 2, RGB(70, 70, 82));
    }
    FillRectColor(hdc, x - 15, y - 2, x - 11, y + 12, RGB(44, 112, 235));
    FillRectColor(hdc, x + 11, y - 2, x + 15, y + 12, RGB(44, 112, 235));
}

void DrawZombieSprite(HDC hdc, const Zombie& zombie) {
    int x = static_cast<int>(zombie.pos.x);
    int y = static_cast<int>(zombie.pos.y);

    if (zombie.boss) {
        FillRectColor(hdc, x - 22, y + 18, x - 8, y + 46, RGB(78, 28, 28));
        FillRectColor(hdc, x + 8, y + 18, x + 22, y + 46, RGB(78, 28, 28));
        FillRectColor(hdc, x - 30, y - 6, x + 30, y + 26, RGB(130, 44, 44));
        FillRectColor(hdc, x - 24, y - 34, x + 24, y - 2, RGB(166, 182, 108));
        FillRectColor(hdc, x - 34, y + 0, x - 22, y + 24, RGB(130, 44, 44));
        FillRectColor(hdc, x + 22, y + 0, x + 34, y + 24, RGB(130, 44, 44));
        FillRectColor(hdc, x - 16, y - 18, x - 6, y - 10, RGB(190, 20, 20));
        FillRectColor(hdc, x + 6, y - 18, x + 16, y - 10, RGB(190, 20, 20));
        FillRectColor(hdc, x - 10, y - 8, x + 10, y - 2, RGB(88, 20, 20));
    } else {
        FillRectColor(hdc, x - 8, y + 10, x - 1, y + 25, RGB(34, 96, 42));
        FillRectColor(hdc, x + 1, y + 10, x + 8, y + 25, RGB(34, 96, 42));
        FillRectColor(hdc, x - 12, y - 2, x + 12, y + 14, RGB(70, 140, 76));
        FillRectColor(hdc, x - 9, y - 16, x + 9, y - 2, RGB(150, 186, 112));
        FillRectColor(hdc, x - 15, y + 0, x - 11, y + 14, RGB(70, 140, 76));
        FillRectColor(hdc, x + 11, y + 0, x + 15, y + 14, RGB(70, 140, 76));
        FillRectColor(hdc, x - 6, y - 10, x - 2, y - 6, RGB(255, 60, 60));
        FillRectColor(hdc, x + 2, y - 10, x + 6, y - 6, RGB(255, 60, 60));
    }
}

void DrawBulletSprite(HDC hdc, const Bullet& bullet) {
    int x = static_cast<int>(bullet.pos.x);
    int y = static_cast<int>(bullet.pos.y);
    if (bullet.weaponType == WEAPON_SHOTGUN) {
        FillRectColor(hdc, x - 2, y - 2, x + 4, y + 2, RGB(255, 180, 90));
    } else if (bullet.weaponType == WEAPON_BATTLE_RIFLE) {
        FillRectColor(hdc, x - 2, y - 1, x + 8, y + 1, RGB(160, 255, 190));
        FillRectColor(hdc, x + 8, y - 1, x + 11, y + 1, RGB(220, 255, 230));
    } else if (bullet.weaponType == WEAPON_RIFLE) {
        FillRectColor(hdc, x - 2, y - 1, x + 7, y + 1, RGB(180, 230, 255));
        FillRectColor(hdc, x + 7, y - 1, x + 10, y + 1, RGB(230, 250, 255));
    } else {
        FillRectColor(hdc, x - 2, y - 2, x + 6, y + 2, RGB(255, 228, 120));
        FillRectColor(hdc, x + 6, y - 1, x + 9, y + 1, RGB(255, 250, 210));
    }
}

void DrawCenteredText(HDC hdc, RECT rect, const std::string& text, COLORREF color, HFONT font) {
    SetBkMode(hdc, TRANSPARENT);
    SetTextColor(hdc, color);
    HGDIOBJ oldFont = SelectObject(hdc, font);
    DrawTextA(hdc, text.c_str(), -1, &rect, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    SelectObject(hdc, oldFont);
}

void DrawHud(HDC hdc) {
    SetBkMode(hdc, TRANSPARENT);

    HFONT font = CreateFontA(22, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                             OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                             VARIABLE_PITCH, "Segoe UI");
    HFONT smallFont = CreateFontA(18, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                  OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                  VARIABLE_PITCH, "Segoe UI");
    HGDIOBJ oldFont = SelectObject(hdc, font);

    SetTextColor(hdc, RGB(240, 240, 240));
    std::ostringstream ss;
    ss << "Score: " << g_game.score << "    High Score: " << g_game.highScore << "    Wave: " << g_game.wave;
    std::string hud = ss.str();
    TextOutA(hdc, 20, 16, hud.c_str(), static_cast<int>(hud.size()));

    for (int i = 0; i < kMaxHealth; ++i) {
        COLORREF fill = i < g_game.player.health ? RGB(220, 75, 75) : RGB(70, 40, 40);
        COLORREF outline = i < g_game.player.health ? RGB(255, 180, 180) : RGB(110, 70, 70);
        DrawCircle(hdc, 34 + i * 26, 58, 9, fill, outline);
    }

    std::ostringstream waveProgress;
    waveProgress << "Enemies left: "
                 << (g_game.zombiesToSpawn - g_game.zombiesSpawnedThisWave + static_cast<int>(g_game.zombies.size()));
    SelectObject(hdc, smallFont);
    std::string waveText = waveProgress.str();
    TextOutA(hdc, 20, 82, waveText.c_str(), static_cast<int>(waveText.size()));

    std::ostringstream ammoText;
    ammoText << "Gun: " << CurrentWeapon().name << "    Ammo: " << g_game.ammoInMagazine << "/" << g_game.reserveAmmo;
    std::string ammo = ammoText.str();
    TextOutA(hdc, 20, 106, ammo.c_str(), static_cast<int>(ammo.size()));

    if (g_game.reloading) {
        std::ostringstream reloadText;
        reloadText << "Reloading... " << static_cast<int>(std::ceil(g_game.reloadTimer * 10.0f) / 10.0f * 10) / 10.0f
                   << "s";
        std::string reloading = reloadText.str();
        TextOutA(hdc, 20, 130, reloading.c_str(), static_cast<int>(reloading.size()));
    }

    if (g_game.waveBannerTimer > 0.0f && g_game.screen == SCREEN_PLAYING && !g_game.paused) {
        HFONT bigFont = CreateFontA(38, 0, 0, 0, FW_HEAVY, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                    OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                    VARIABLE_PITCH, "Segoe UI");
        RECT rect = {0, 110, kWindowWidth, 180};
        std::ostringstream waveBanner;
        if (g_game.bossWave) {
            waveBanner << "Boss Wave " << g_game.wave;
        } else {
            waveBanner << "Wave " << g_game.wave;
        }
        DrawCenteredText(hdc, rect, waveBanner.str(), RGB(255, 225, 120), bigFont);
        DeleteObject(bigFont);
    }

    if (g_game.paused) {
        RECT overlay = {170, 180, kWindowWidth - 170, kWindowHeight - 180};
        HBRUSH overlayBrush = CreateSolidBrush(RGB(18, 24, 38));
        FillRect(hdc, &overlay, overlayBrush);
        DeleteObject(overlayBrush);
        FrameRect(hdc, &overlay, static_cast<HBRUSH>(GetStockObject(WHITE_BRUSH)));

        HFONT bigFont = CreateFontA(40, 0, 0, 0, FW_HEAVY, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                    OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                    VARIABLE_PITCH, "Segoe UI");
        RECT titleRect = {0, 220, kWindowWidth, 280};
        RECT helpRect = {0, 300, kWindowWidth, 340};
        DrawCenteredText(hdc, titleRect, "PAUSED", RGB(220, 230, 255), bigFont);
        DrawCenteredText(hdc, helpRect, "Press P to continue", RGB(200, 210, 230), font);
        DeleteObject(bigFont);
    }

    if (g_game.screen == SCREEN_MENU) {
        RECT titleRect = {0, 120, kWindowWidth, 220};
        RECT subtitleRect = {0, 235, kWindowWidth, 290};
        RECT controlsRect = {0, 330, kWindowWidth, 490};
        HFONT titleFont = CreateFontA(44, 0, 0, 0, FW_HEAVY, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                      OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                      VARIABLE_PITCH, "Segoe UI");
        HFONT mediumFont = CreateFontA(24, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                       OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                       VARIABLE_PITCH, "Segoe UI");
        DrawCenteredText(hdc, titleRect, "ZOMBIE SHOOTER", RGB(255, 215, 120), titleFont);
        DrawCenteredText(hdc, subtitleRect, "Press Enter to Start", RGB(220, 240, 255), mediumFont);

        SelectObject(hdc, smallFont);
        SetTextColor(hdc, RGB(210, 220, 220));
        DrawTextA(hdc,
                  "Move: WASD / Arrow Keys\nShoot: Left Click / Space\nReload: R\nSwitch Guns: 1 / 2 / 3 / 4\nEvery 5th wave is a boss wave",
                  -1, &controlsRect, DT_CENTER | DT_WORDBREAK);

        DeleteObject(titleFont);
        DeleteObject(mediumFont);
    }

    if (g_game.screen == SCREEN_GAME_OVER) {
        RECT overlay = {140, 170, kWindowWidth - 140, kWindowHeight - 140};
        HBRUSH overlayBrush = CreateSolidBrush(RGB(35, 10, 10));
        FillRect(hdc, &overlay, overlayBrush);
        DeleteObject(overlayBrush);
        FrameRect(hdc, &overlay, static_cast<HBRUSH>(GetStockObject(WHITE_BRUSH)));

        HFONT bigFont = CreateFontA(42, 0, 0, 0, FW_HEAVY, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                    OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                    VARIABLE_PITCH, "Segoe UI");
        RECT titleRect = {0, 215, kWindowWidth, 270};
        RECT scoreRect = {0, 290, kWindowWidth, 325};
        RECT helpRect = {0, 340, kWindowWidth, 400};
        DrawCenteredText(hdc, titleRect, "GAME OVER", RGB(255, 110, 110), bigFont);

        std::ostringstream scoreText;
        scoreText << "Final Score: " << g_game.score << "    Best: " << g_game.highScore;
        DrawCenteredText(hdc, scoreRect, scoreText.str(), RGB(235, 235, 235), font);
        DrawCenteredText(hdc, helpRect, "Press R to retry or Esc for menu", RGB(235, 235, 235), smallFont);
        DeleteObject(bigFont);
    }

    SelectObject(hdc, oldFont);
    DeleteObject(font);
    DeleteObject(smallFont);
}

void RenderGame(HWND hwnd) {
    PAINTSTRUCT ps;
    HDC hdc = BeginPaint(hwnd, &ps);
    RECT clientRect;
    GetClientRect(hwnd, &clientRect);

    HDC memoryDc = CreateCompatibleDC(hdc);
    HBITMAP backBuffer = CreateCompatibleBitmap(hdc, clientRect.right, clientRect.bottom);
    HGDIOBJ oldBitmap = SelectObject(memoryDc, backBuffer);

    HBRUSH background = CreateSolidBrush(RGB(21, 29, 24));
    FillRect(memoryDc, &clientRect, background);
    DeleteObject(background);

    HPEN gridPen = CreatePen(PS_SOLID, 1, RGB(30, 52, 41));
    HGDIOBJ oldPen = SelectObject(memoryDc, gridPen);
    for (int x = 0; x < kWindowWidth; x += 40) {
        MoveToEx(memoryDc, x, 0, NULL);
        LineTo(memoryDc, x, kWindowHeight);
    }
    for (int y = 0; y < kWindowHeight; y += 40) {
        MoveToEx(memoryDc, 0, y, NULL);
        LineTo(memoryDc, kWindowWidth, y);
    }
    SelectObject(memoryDc, oldPen);
    DeleteObject(gridPen);

    for (int i = 0; i < 18; ++i) {
        int treeX = 30 + i * 52;
        int treeY = 30 + (i % 5) * 118;
        FillRectColor(memoryDc, treeX, treeY + 18, treeX + 6, treeY + 34, RGB(70, 48, 22));
        DrawCircle(memoryDc, treeX + 3, treeY + 12, 12, RGB(38, 74, 44), RGB(25, 48, 28));
    }

    for (std::size_t i = 0; i < g_game.bullets.size(); ++i) {
        const Bullet& bullet = g_game.bullets[i];
        DrawBulletSprite(memoryDc, bullet);
    }

    for (std::size_t i = 0; i < g_game.zombies.size(); ++i) {
        const Zombie& zombie = g_game.zombies[i];
        DrawZombieSprite(memoryDc, zombie);

        if (zombie.boss) {
            RECT healthBar = {static_cast<int>(zombie.pos.x - 35), static_cast<int>(zombie.pos.y - zombie.radius - 16),
                              static_cast<int>(zombie.pos.x + 35), static_cast<int>(zombie.pos.y - zombie.radius - 8)};
            HBRUSH bgBrush = CreateSolidBrush(RGB(60, 20, 20));
            FillRect(memoryDc, &healthBar, bgBrush);
            DeleteObject(bgBrush);

            RECT hpRect = healthBar;
            hpRect.right = healthBar.left +
                           static_cast<LONG>((healthBar.right - healthBar.left) *
                                             (static_cast<float>(zombie.health) / zombie.maxHealth));
            HBRUSH hpBrush = CreateSolidBrush(RGB(230, 70, 70));
            FillRect(memoryDc, &hpRect, hpBrush);
            DeleteObject(hpBrush);
        }
    }

    bool playerVisible = g_game.invulnerabilityTimer <= 0.0f ||
                         static_cast<int>(g_game.invulnerabilityTimer * 12.0f) % 2 == 0;
    if (playerVisible || g_game.screen != SCREEN_PLAYING) {
        DrawPlayerSprite(memoryDc, g_game.player, g_game.mousePos);
    }

    HPEN aimPen = CreatePen(PS_SOLID, 1, RGB(255, 80, 80));
    oldPen = SelectObject(memoryDc, aimPen);
    MoveToEx(memoryDc, g_game.mousePos.x - 10, g_game.mousePos.y, NULL);
    LineTo(memoryDc, g_game.mousePos.x + 10, g_game.mousePos.y);
    MoveToEx(memoryDc, g_game.mousePos.x, g_game.mousePos.y - 10, NULL);
    LineTo(memoryDc, g_game.mousePos.x, g_game.mousePos.y + 10);
    SelectObject(memoryDc, oldPen);
    DeleteObject(aimPen);

    DrawHud(memoryDc);

    BitBlt(hdc, 0, 0, clientRect.right, clientRect.bottom, memoryDc, 0, 0, SRCCOPY);

    SelectObject(memoryDc, oldBitmap);
    DeleteObject(backBuffer);
    DeleteDC(memoryDc);
    EndPaint(hwnd, &ps);
}

LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
    switch (message) {
        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
        case WM_KEYDOWN:
            if (wParam < 256) {
                g_game.keys[wParam] = true;
            }
            return 0;
        case WM_KEYUP:
            if (wParam < 256) {
                g_game.keys[wParam] = false;
            }
            return 0;
        case WM_LBUTTONDOWN:
            g_game.mouseDown = true;
            return 0;
        case WM_LBUTTONUP:
            g_game.mouseDown = false;
            return 0;
        case WM_MOUSEMOVE:
            g_game.mousePos.x = GET_X_LPARAM(lParam);
            g_game.mousePos.y = GET_Y_LPARAM(lParam);
            return 0;
        case WM_PAINT:
            RenderGame(hwnd);
            return 0;
    }
    return DefWindowProc(hwnd, message, wParam, lParam);
}

}  // namespace

int WINAPI WinMain(HINSTANCE instance, HINSTANCE, LPSTR, int showCmd) {
    srand(static_cast<unsigned int>(time(NULL)));
    StartSoundSystem();
    ResetGame();

    const char* className = "ZombieShooterWindow";

    WNDCLASSA windowClass = {};
    windowClass.lpfnWndProc = WindowProc;
    windowClass.hInstance = instance;
    windowClass.lpszClassName = className;
    windowClass.hCursor = LoadCursor(NULL, IDC_CROSS);
    windowClass.hbrBackground = static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH));

    RegisterClassA(&windowClass);

    HWND hwnd = CreateWindowExA(
        0, className, "Zombie Shooter - C++ Win32",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
        CW_USEDEFAULT, CW_USEDEFAULT, kWindowWidth + 16, kWindowHeight + 39,
        NULL, NULL, instance, NULL);

    if (!hwnd) {
        return 0;
    }

    ShowWindow(hwnd, showCmd);
    UpdateWindow(hwnd);

    LARGE_INTEGER frequency = {};
    LARGE_INTEGER previousCounter = {};
    QueryPerformanceFrequency(&frequency);
    QueryPerformanceCounter(&previousCounter);

    MSG message = {};
    while (g_game.running) {
        while (PeekMessage(&message, NULL, 0, 0, PM_REMOVE)) {
            if (message.message == WM_QUIT) {
                g_game.running = false;
                break;
            }
            TranslateMessage(&message);
            DispatchMessage(&message);
        }

        LARGE_INTEGER currentCounter = {};
        QueryPerformanceCounter(&currentCounter);
        float deltaTime =
            static_cast<float>(currentCounter.QuadPart - previousCounter.QuadPart) / frequency.QuadPart;
        previousCounter = currentCounter;

        deltaTime = Clamp(deltaTime, 0.0f, 0.05f);
        UpdateGame(deltaTime);
        InvalidateRect(hwnd, NULL, FALSE);
        Sleep(1000 / kTargetFps);
    }

    StopSoundSystem();
    return 0;
}
