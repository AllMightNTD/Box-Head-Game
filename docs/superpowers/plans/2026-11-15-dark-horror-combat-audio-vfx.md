# Dark Horror Combat Audio & VFX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Box-Head-Game's combat feel with progressive wave darkness, tactical cooperative flashlights, glowing zombie eyes in the shadows, weapon-specific muzzle/tracer/casing/gore VFX, and a multi-layered spatial Web Audio horror soundscape.

**Architecture:** Enrich the authoritative server's `HIT` and `ZOMBIE_DIE` event payloads in `server/game/GameRoom.js` with bullet impact angles and weapon/zombie types. On the client, extend `Renderer` (`client/js/renderer.js`) with an offscreen `1600x1200` `darknessCanvas` using `destination-out` gradient cutouts, weapon-distinct muzzle flashes, ejecting shell casings, directional blood splatter, and glowing zombie eyes; upgrade `SoundManager` (`client/js/audio.js`) with a compressed/reverberant spatial stereo Web Audio pipeline, 3-layer gunshots, monster vocalizations, and a wave-scaling dark drone + low-HP heartbeat wired through `client/js/main.js`.

**Tech Stack:** Node.js (CommonJS), Socket.IO, HTML5 2D Canvas, Web Audio API, `node:test` + `node:assert`.

**Spec:** `docs/superpowers/specs/2026-11-15-dark-horror-combat-audio-vfx-design.md`

## Global Constraints

- World coordinate space is fixed at `1600x1200` across all 4 maps (`THE_ROOMS`, `DESERT`, `SNOW`, `VOLCANO`).
- Zero external audio asset files (`.mp3`, `.wav`, `.ogg`); all audio must be 100% procedural Web Audio API synthesis.
- Darkness alpha must start at `0.18` on Wave 1 and never exceed `0.88` (Wave 7+ cap).
- All DOM, Canvas, and Web Audio API usage in `client/js/renderer.js` and `client/js/audio.js` must guard against missing browser globals (`document`, `window`, `AudioContext`) so Node.js unit tests run cleanly.
- Strict FIFO particle caps: `shellCasings <= 80`, `gunSmoke <= 50`, `particles <= 180`, `corpses <= 60`.
- Clean Code (`GEMINI.md`): Single-responsibility helper functions ideally under 30–40 lines, early returns (guard clauses), no empty catch blocks.

## Review Focus

1. **Headless Node.js / Missing Browser Globals:** Instantiating `Renderer` or `SoundManager` and invoking `updateVisuals`, `render`, `addMuzzleFlash`, `addDirectionalBlood`, `playShoot`, or `updateHorrorAmbience` when `document` or `AudioContext` is absent must never throw. (Pinned in Task 2, Task 3, Task 4).
2. **Particle & Casing FIFO Cap Enforcement under Sustained Fire:** Firing 150 shots and 100 gore impacts in rapid succession must keep `shellCasings.length <= 80`, `gunSmoke.length <= 50`, and `particles.length <= 180`. (Pinned in Task 3).
3. **Wave Darkness Alpha Clamping on Invalid/Extreme Inputs:** `getTargetWaveDarkness(wave)` with `wave = 0`, `-5`, `undefined`, `NaN`, or `99` must clamp strictly within `[0.18, 0.88]`. (Pinned in Task 2).
4. **Spatial Stereo Pan Clamping on Out-of-Bounds / Non-Finite Coordinates:** `computeStereoPan(sourceX, listenerX)` with `NaN`, `undefined`, or coordinates far outside `[0, 1600]` must return `0` for non-finite inputs and clamp strictly to `[-0.88, 0.88]`. (Pinned in Task 4).
5. **Ambient Horror Drone Cleanup on Leave / Game Over / Reset:** Calling `stopHorrorAmbience()` or `updateHorrorAmbience(dt, { isInGame: false })` must immediately silence/stop the ambient drone so it never leaks into the lobby. (Pinned in Task 4 & Task 5).

---

### Task 1: Enrich Server `HIT` and `ZOMBIE_DIE` Event Payloads

**Files:**
- Modify: `server/game/GameRoom.js:317-325`
- Modify: `server/game/GameRoom.js:484-508`
- Test: `tests/game_room.test.js`

**Interfaces:**
- Consumes: `Bullet` (`b.angle`, `b.type`), `Zombie` (`z.x`, `z.y`, `z.type`, `z.angle`) in `server/game/GameRoom.js`.
- Produces:
  - `HIT` event object in `room.eventsBuffer`: `{ type: 'HIT', x: number, y: number, angle: number, weapon: string, zType: string }`
  - `ZOMBIE_DIE` event object in `room.eventsBuffer`: `{ type: 'ZOMBIE_DIE', x: number, y: number, zType: string, angle: number, killAngle: number }`

- [ ] **Step 1: Write the failing test in `tests/game_room.test.js`**

Append a new test to `tests/game_room.test.js`:
```js
test('GameRoom emits enriched HIT and ZOMBIE_DIE events with angle, weapon, and zType', (t) => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('room-hit-meta', 'Hit Meta', mockIo);
  t.after(() => room.stop());

  const p = room.addPlayer('p1', 'Alice', 'HUMAN');
  room.startGame();
  room.eventsBuffer = [];

  // Place a zombie directly in front of player p1
  p.x = 500;
  p.y = 500;
  p.angle = 0.5;
  const { Zombie } = require('../server/game/Zombie.js');
  const z = new Zombie('z_test', 'RUNNER', 530, 515);
  z.hp = 10; // Dies in 1 pistol shot (25 dmg)
  room.zombies.push(z);

  room.handleShoot('p1');
  // Advance tick until bullet hits zombie
  for (let i = 0; i < 5; i++) {
    const snap = room.getSnapshot();
    room.tick(0.02);
  }

  // Capture emitted events by intercepting emit on a fresh shot
  const emittedSnapshots = [];
  room.io = {
    to: () => ({
      emit: (evName, data) => {
        if (evName === 'game:snapshot') emittedSnapshots.push(data);
      }
    })
  };

  const z2 = new Zombie('z_test_2', 'TANK', 525, 500);
  z2.hp = 20;
  p.angle = 0.25;
  p.fireCooldown = 0;
  room.zombies.push(z2);
  room.handleShoot('p1');
  room.tick(0.02);

  const allEvents = emittedSnapshots.flatMap(s => s.events);
  const hitEv = allEvents.find(e => e.type === 'HIT');
  const dieEv = allEvents.find(e => e.type === 'ZOMBIE_DIE');

  assert.ok(hitEv, 'Expected HIT event to be emitted');
  assert.strictEqual(typeof hitEv.angle, 'number');
  assert.strictEqual(hitEv.weapon, 'bullet');
  assert.strictEqual(hitEv.zType, 'TANK');

  assert.ok(dieEv, 'Expected ZOMBIE_DIE event to be emitted');
  assert.strictEqual(dieEv.zType, 'TANK');
  assert.strictEqual(typeof dieEv.killAngle, 'number');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/game_room.test.js`
Expected: FAIL on `assert.strictEqual(typeof hitEv.angle, 'number')` (`undefined !== 'number'`).

- [ ] **Step 3: Update `HIT` and `ZOMBIE_DIE` event objects in `server/game/GameRoom.js`**

1. In `GameRoom.prototype.triggerExplosion` (`server/game/GameRoom.js` around line 322), include `killAngle: Number(knockAngle.toFixed(2))` on `ZOMBIE_DIE`.
2. In `GameRoom.prototype.tick` (`server/game/GameRoom.js` around line 487), update `HIT` to include `angle: Number((b.angle || 0).toFixed(2))`, `weapon: b.type || 'bullet'`, `zType: z.type`, and around line 506 update `ZOMBIE_DIE` to include `killAngle: Number((b.angle || 0).toFixed(2))`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/game_room.test.js`
Expected: PASS (all 4 tests in `tests/game_room.test.js` pass).

- [ ] **Step 5: Commit**

```bash
git add server/game/GameRoom.js tests/game_room.test.js
git commit -m "feat(server): enrich HIT and ZOMBIE_DIE events with impact angle, weapon, and zType"
```

---

### Task 2: Progressive Wave Darkness, Tactical Flashlights & Glowing Zombie Eyes

**Files:**
- Modify: `client/js/renderer.js:15-58`
- Modify: `client/js/renderer.js:230-419`
- Create: `tests/horror_vfx_audio.test.js`

**Interfaces:**
- Consumes: `gameState` (`wave`, `players`, `zombies`, `bullets`, `barricades`, `drones`), `map` (`width`, `height`, `theme.ambient`) in `client/js/renderer.js`.
- Produces on `Renderer.prototype`:
  - `getTargetWaveDarkness(wave: number) -> number` (returns `[0.18..0.88]`: Wave 1=`0.18`, Wave 2=`0.32`, Wave 3=`0.48`, Wave 4=`0.62`, Wave 5=`0.75`, Wave 6=`0.815`, Wave 7+=`0.88`)
  - `updateVisuals(dt: number, map?: object, wave?: number) -> void` (updates `this.targetDarknessAlpha` when `wave` is provided and lerps `this.currentDarknessAlpha` by `Math.min(1, dt * 1.5)`)
  - `drawDarknessAndLights(ctx: CanvasRenderingContext2D, gameState: object, localPlayerId: string, map?: object) -> void`
  - `drawZombieEyesInDark(ctx: CanvasRenderingContext2D, zombies: Array, players: Array) -> void`

- [ ] **Step 1: Write the failing tests for wave darkness, clamping, and lighting pipeline in `tests/horror_vfx_audio.test.js`**

Create `tests/horror_vfx_audio.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { Renderer } = require('../client/js/renderer.js');

function createMockCanvas() {
  const ctx = {
    save: () => {},
    restore: () => {},
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    bezierCurveTo: () => {},
    arc: () => {},
    ellipse: () => {},
    fill: () => {},
    stroke: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
     setLineDash: () => {},
    drawImage: () => {},
    fillText: () => {},
    strokeText: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    globalCompositeOperation: 'source-over',
    globalAlpha: 1
  };
  return {
    width: 1600,
    height: 1200,
    getContext: () => ctx,
    ctx
  };
}

test('Renderer.getTargetWaveDarkness follows progressive curve and clamps invalid/extreme inputs', () => {
  const mockCanvas = createMockCanvas();
  const renderer = new Renderer(mockCanvas);

  assert.strictEqual(renderer.getTargetWaveDarkness(undefined), 0.18);
  assert.strictEqual(renderer.getTargetWaveDarkness(0), 0.18);
  assert.strictEqual(renderer.getTargetWaveDarkness(-3), 0.18);
  assert.strictEqual(renderer.getTargetWaveDarkness(1), 0.18);
  assert.strictEqual(renderer.getTargetWaveDarkness(2), 0.32);
  assert.strictEqual(renderer.getTargetWaveDarkness(3), 0.48);
  assert.strictEqual(renderer.getTargetWaveDarkness(4), 0.62);
  assert.strictEqual(renderer.getTargetWaveDarkness(5), 0.75);
  assert.ok(renderer.getTargetWaveDarkness(6) > 0.75 && renderer.getTargetWaveDarkness(6) < 0.88);
  assert.strictEqual(renderer.getTargetWaveDarkness(7), 0.88);
  assert.strictEqual(renderer.getTargetWaveDarkness(50), 0.88);
});

test('Renderer smoothly interpolates darkness alpha and renders darkness/lights & zombie eyes safely in headless mode', () => {
  const mockCanvas = createMockCanvas();
  const renderer = new Renderer(mockCanvas);

  assert.strictEqual(renderer.currentDarknessAlpha, 0.18);
  renderer.updateVisuals(0.5, { width: 1600, height: 1200, theme: { ambient: 'normal' } }, 6);
  assert.ok(renderer.currentDarknessAlpha > 0.18, 'Darkness alpha should interpolate upward toward Wave 6 target');

  const sampleState = {
    wave: 6,
    players: [{ id: 'p1', x: 800, y: 600, angle: 0, hp: 100, maxHp: 100, selectedWeapon: 'PISTOL' }],
    zombies: [{ id: 'z1', type: 'DEVIL', x: 950, y: 600, angle: 3.14, hp: 250, maxHp: 250 }],
    bullets: [{ x: 850, y: 600, angle: 0, type: 'rocket' }],
    barricades: [{ x: 700, y: 600, type: 'barrel', hp: 40, maxHp: 40 }],
    drones: [{ x: 810, y: 610, angle: 0, auraRadius: 200 }],
    pickups: []
  };

  assert.doesNotThrow(() => {
    renderer.render(sampleState, 'p1', { width: 1600, height: 1200, walls: [], theme: { ambient: 'embers' } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: FAIL with `renderer.getTargetWaveDarkness is not a function`.

- [ ] **Step 3: Implement progressive wave darkness, offscreen light cutouts, and glowing zombie eyes in `client/js/renderer.js`**

1. In `Renderer.constructor`:
   - Initialize `this.currentDarknessAlpha = 0.18` and `this.targetDarknessAlpha = 0.18`.
   - Create `this.darknessCanvas` (`1600x1200`) and `this.darknessCtx` when `typeof document !== 'undefined'`; also ensure `resetSession()` resets `this.currentDarknessAlpha = 0.18` and `this.targetDarknessAlpha = 0.18` (and guards `if (this.bloodCtx)` when clearing `bloodCanvas` so headless Node calls without `document` never throw).
2. Add `getTargetWaveDarkness(wave)`:
   ```js
   getTargetWaveDarkness(wave) {
     if (typeof wave !== 'number' || !Number.isFinite(wave) || wave <= 1) return 0.18;
     const table = { 1: 0.18, 2: 0.32, 3: 0.48, 4: 0.62, 5: 0.75 };
     if (table[wave]) return table[wave];
     return Math.min(0.88, Number((0.75 + (wave - 5) * 0.065).toFixed(3)));
   }
   ```
3. In `updateVisuals(dt, map, wave)`:
   - If `typeof wave === 'number'`, set `this.targetDarknessAlpha = this.getTargetWaveDarkness(wave)`.
   - Lerp `this.currentDarknessAlpha += (this.targetDarknessAlpha - this.currentDarknessAlpha) * Math.min(1, dt * 1.5)`.
4. Implement `drawDarknessAndLights(ctx, gameState, localPlayerId, map)` and `drawZombieEyesInDark(ctx, zombies, players)` decompose cleanly into small helpers (`cutoutRadialLight`, `cutoutFlashlightCone`, `drawFlashlightWarmSheen`), and invoke them in `render(gameState, localPlayerId, map)` right after `drawParticles(ctx)` and before `drawFloatingTexts(ctx)` (also syncing `this.targetDarknessAlpha = this.getTargetWaveDarkness(gameState.wave)` if `gameState.wave` is present).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: PASS (2 tests pass).

- [ ] **Step 5: Commit**

```bash
git add client/js/renderer.js tests/horror_vfx_audio.test.js
git commit -m "feat(renderer): add progressive wave darkness, tactical flashlights, and glowing zombie eyes"
```

---

### Task 3: Weapon-Specific Muzzle Flashes, Shell Casings, Gun Smoke, Railgun Beams & Directional Gore

**Files:**
- Modify: `client/js/renderer.js:23-135`
- Modify: `client/js/renderer.js:295-340`
- Modify: `client/js/renderer.js:390-416`
- Modify: `client/js/renderer.js:1235-1353`
- Test: `tests/horror_vfx_audio.test.js`

**Interfaces:**
- Consumes: `ev.x`, `ev.y`, `ev.angle`, `ev.weapon`, `ev.killAngle`, `ev.zType`.
- Produces on `Renderer.prototype`:
  - `addMuzzleFlash(x: number, y: number, angle: number, weapon?: string) -> void` (adds weapon-typed muzzle flash with `lightRadius`, spawns `shellCasings` for `PISTOL`/`UZI`/`SHOTGUN` capped at 80, spawns `gunSmoke` capped at 50, and adds `railgunBeams` entry when `weapon === 'RAILGUN'`)
  - `addDirectionalBlood(x: number, y: number, impactAngle: number, weapon?: string, isKill?: boolean, color?: string) -> void` (paints directional splatter onto `bloodCtx` if present and pushes high-velocity gore droplets into `this.particles` capped at 180)
  - `drawShellCasings(ctx: CanvasRenderingContext2D) -> void`
  - `drawGunSmoke(ctx: CanvasRenderingContext2D) -> void`
  - `drawRailgunBeams(ctx: CanvasRenderingContext2D) -> void`

- [ ] **Step 1: Write the failing tests for weapon VFX, directional gore, and FIFO particle caps in `tests/horror_vfx_audio.test.js`**

Append to `tests/horror_vfx_audio.test.js`:
```js
test('Renderer creates weapon-specific muzzle flashes, shell casings, smoke, railgun beams, and enforces FIFO caps', () => {
  const mockCanvas = createMockCanvas();
  const renderer = new Renderer(mockCanvas);

  renderer.addMuzzleFlash(400, 300, 0.5, 'SHOTGUN');
  assert.strictEqual(renderer.muzzleFlashes.length, 1);
  assert.strictEqual(renderer.muzzleFlashes[0].weapon, 'SHOTGUN');
  assert.strictEqual(renderer.muzzleFlashes[0].lightRadius, 250);
  assert.ok(renderer.shellCasings.length >= 1, 'Shotgun should eject shell casing');
  assert.ok(renderer.gunSmoke.length >= 1, 'Shotgun should emit gun smoke');

  renderer.addMuzzleFlash(500, 300, 1.0, 'RAILGUN');
  assert.strictEqual(renderer.railgunBeams.length, 1);

  // Fire 150 times to verify FIFO caps (shellCasings <= 80, gunSmoke <= 50)
  for (let i = 0; i < 150; i++) {
    renderer.addMuzzleFlash(400, 300, 0, 'UZI');
  }
  assert.ok(renderer.shellCasings.length <= 80, `shellCasings exceeded cap: ${renderer.shellCasings.length}`);
  assert.ok(renderer.gunSmoke.length <= 50, `gunSmoke exceeded cap: ${renderer.gunSmoke.length}`);

  // Trigger 100 directional gore bursts to verify particles <= 180
  for (let i = 0; i < 100; i++) {
    renderer.addDirectionalBlood(600, 400, 0.75, 'SHOTGUN', true);
  }
  assert.ok(renderer.particles.length <= 180, `particles exceeded cap: ${renderer.particles.length}`);

  // Update & render without errors
  renderer.updateVisuals(0.05, { width: 1600, height: 1200, theme: { ambient: 'normal' } }, 4);
  assert.doesNotThrow(() => {
    renderer.drawShellCasings(mockCanvas.ctx);
    renderer.drawGunSmoke(mockCanvas.ctx);
    renderer.drawRailgunBeams(mockCanvas.ctx);
    renderer.drawMuzzleFlashes(mockCanvas.ctx);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: FAIL on `assert.strictEqual(renderer.muzzleFlashes[0].weapon, 'SHOTGUN')` (`undefined !== 'SHOTGUN'`).

- [ ] **Step 3: Implement weapon-specific muzzle flashes, shell casings, smoke, railgun beams, enhanced bullet tracers, and directional blood in `client/js/renderer.js`**

1. Initialize `this.shellCasings = []`, `this.gunSmoke = []`, and `this.railgunBeams = []` in `constructor` and clear them in `resetSession()`.
2. Upgrade `addMuzzleFlash(x, y, angle, weapon = 'PISTOL')`:
   - Lookup weapon flash config:
     - `PISTOL`: `{ life: 0.06, lightRadius: 170, smoke: 1, eject: 'brass' }`
     - `UZI`: `{ life: 0.045, lightRadius: 160, smoke: 1, eject: 'brass' }`
     - `SHOTGUN`: `{ life: 0.09, lightRadius: 250, smoke: 3, eject: 'shotgun' }`
     - `ROCKET`: `{ life: 0.11, lightRadius: 260, smoke: 3, eject: null }`
     - `RAILGUN`: `{ life: 0.14, lightRadius: 300, smoke: 2, eject: null }`
   - Push to `this.muzzleFlashes`, spawn casing into `this.shellCasings` (FIFO cap `80`), spawn smoke into `this.gunSmoke` (FIFO cap `50`), and if `weapon === 'RAILGUN'` push `{ x, y, angle, life: 0.25, maxLife: 0.25 }` to `this.railgunBeams`.
3. Implement `addDirectionalBlood(x, y, impactAngle = 0, weapon = 'bullet', isKill = false, color = '#8a0303')`:
   - Paint directional cone splatter onto `this.bloodCtx` (if `this.bloodCtx` exists) along `impactAngle ± 0.45 rad`.
   - Push high-velocity blood droplets and meat chunks into `this.particles` along `impactAngle ± 0.5 rad`, enforcing FIFO cap `this.particles.length <= 180` (also enforce cap in `addExplosionParticles`).
4. Update `updateVisuals(dt, map, wave)` to advance and expire `shellCasings` (with vertical `z`, `vz` gravity `420`, floor bounce `* -0.45`), `gunSmoke`, and `railgunBeams`.
5. Implement `drawShellCasings(ctx)`, `drawGunSmoke(ctx)`, `drawRailgunBeams(ctx)`, update `drawMuzzleFlashes(ctx)` with distinct shapes per `mf.weapon`, and enhance `drawBullets(ctx, bullets)` with tracer gradient tails and rocket flame plumes. Call `drawShellCasings(ctx)` after corpses, and `drawRailgunBeams(ctx)` + `drawGunSmoke(ctx)` near `drawMuzzleFlashes(ctx)` in `render()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: PASS (3 tests pass).

- [ ] **Step 5: Commit**

```bash
git add client/js/renderer.js tests/horror_vfx_audio.test.js
git commit -m "feat(renderer): add weapon-specific muzzle flashes, shell casings, smoke, railgun beams, and directional gore"
```

---

### Task 4: Multi-Layered Spatial Horror Audio Engine

**Files:**
- Modify: `client/js/audio.js:1-397`
- Test: `tests/horror_vfx_audio.test.js`

**Interfaces:**
- Produces on `SoundManager.prototype` (exported via `module.exports = { SoundManager }` and `window.soundManager = new SoundManager()` when `window` exists):
  - `computeStereoPan(sourceX?: number, listenerX?: number) -> number` (clamps `(sourceX - listenerX) / 550` to `[-0.88, 0.88]`; returns `0` if either input is not a finite number)
  - `computeDistanceGain(sourceX?: number, listenerX?: number, maxDist?: number) -> number` (returns `[0.18, 1.0]`; `1.0` if inputs are not finite)
  - `playShoot(weaponType?: string, sourceX?: number, listenerX?: number) -> void`
  - `playExplosion(scale?: number, sourceX?: number, listenerX?: number) -> void`
  - `playZombieHit(zType?: string, weapon?: string, sourceX?: number, listenerX?: number) -> void`
  - `playZombieDie(zType?: string, sourceX?: number, listenerX?: number) -> void`
  - `playZombieGrowl(zType?: string, sourceX?: number, listenerX?: number) -> boolean` (returns `true` if played, `false` if muted/throttled by `1.8s` cooldown)
  - `playWaveStart(wave?: number) -> void`
  - `playHeartbeatPulse(intensity?: number) -> void`
  - `updateHorrorAmbience(dt: number, state?: { isInGame?: boolean, wave?: number, localPlayer?: object, zombies?: Array }) -> void`
  - `stopHorrorAmbience() -> void`

- [ ] **Step 1: Write the failing tests for `SoundManager` spatial math, throttling, and horror ambience lifecycle in `tests/horror_vfx_audio.test.js`**

Append to `tests/horror_vfx_audio.test.js`:
```js
const { SoundManager } = require('../client/js/audio.js');

function createMockAudioContext() {
  const makeParam = (initVal = 0) => ({
    value: initVal,
    setValueAtTime: function (v) { this.value = v; },
    linearRampToValueAtTime: function (v) { this.value = v; },
    exponentialRampToValueAtTime: function (v) { this.value = v; },
    setTargetAtTime: function (v) { this.value = v; }
  });
  const makeNode = () => ({
    connect: () => makeNode(),
    disconnect: () => {},
    start: () => {},
    stop: () => {},
    frequency: makeParam(440),
    detune: makeParam(0),
    Q: makeParam(1),
    gain: makeParam(1),
    pan: makeParam(0),
    threshold: makeParam(-12),
    knee: makeParam(12),
    ratio: makeParam(4),
    attack: makeParam(0.005),
    release: makeParam(0.15),
    type: 'sine',
    buffer: null,
    curve: null
  });
  return {
    currentTime: 10,
    sampleRate: 44100,
    state: 'running',
    destination: makeNode(),
    resume: () => {},
    createGain: () => makeNode(),
    createOscillator: () => makeNode(),
    createBiquadFilter: () => makeNode(),
    createBufferSource: () => makeNode(),
    createConvolver: () => makeNode(),
    createDynamicsCompressor: () => makeNode(),
    createStereoPanner: () => makeNode(),
    createWaveShaper: () => makeNode(),
    createBuffer: (ch, len) => ({
      getChannelData: () => new Float32Array(len)
    })
  };
}

test('SoundManager.computeStereoPan and computeDistanceGain clamp extreme and non-finite coordinates', () => {
  const sm = new SoundManager();

  assert.strictEqual(sm.computeStereoPan(undefined, 800), 0);
  assert.strictEqual(sm.computeStereoPan(800, NaN), 0);
  assert.strictEqual(sm.computeStereoPan(800, 800), 0);
  assert.strictEqual(sm.computeStereoPan(5000, 800), 0.88);
  assert.strictEqual(sm.computeStereoPan(-5000, 800), -0.88);

  assert.strictEqual(sm.computeDistanceGain(undefined, 800), 1);
  assert.strictEqual(sm.computeDistanceGain(800, 800), 1);
  assert.strictEqual(sm.computeDistanceGain(5000, 800), 0.18);
});

test('SoundManager executes 3-layer gunshots, monster vocalizations, and manages horror ambience lifecycle safely', () => {
  const sm = new SoundManager();
  // Headless call without AudioContext must not throw
  assert.doesNotThrow(() => {
    sm.playShoot('SHOTGUN', 900, 800);
    sm.updateHorrorAmbience(0.1, { isInGame: true, wave: 4 });
    sm.stopHorrorAmbience();
  });

  // Inject mock AudioContext
  sm.ctx = createMockAudioContext();
  sm.setupAudioGraph();
  sm.initialized = true;

  assert.doesNotThrow(() => {
    sm.playShoot('PISTOL', 600, 800);
    sm.playShoot('UZI', 600, 800);
    sm.playShoot('SHOTGUN', 900, 800);
    sm.playShoot('ROCKET', 750, 800);
    sm.playShoot('RAILGUN', 1000, 800);
    sm.playZombieHit('TANK', 'SHOTGUN', 850, 800);
    sm.playZombieDie('DEVIL', 900, 800);
    sm.playWaveStart(5);
  });

  // Growl cooldown throttling check
  const firstGrowl = sm.playZombieGrowl('RUNNER', 700, 800);
  const immediateSecondGrowl = sm.playZombieGrowl('TANK', 700, 800);
  assert.strictEqual(firstGrowl, true);
  assert.strictEqual(immediateSecondGrowl, false, 'Second growl within cooldown must be throttled');

  // Ambience start & stop cleanup
  sm.updateHorrorAmbience(0.5, {
    isInGame: true,
    wave: 6,
    localPlayer: { x: 800, y: 600, hp: 25, maxHp: 100, isDowned: false },
    zombies: [{ id: 'z1', type: 'RUNNER', x: 850, y: 610, isDead: false }]
  });
  assert.strictEqual(sm.droneActive, true);

  sm.stopHorrorAmbience();
  assert.strictEqual(sm.droneActive, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: FAIL with `SoundManager is not a constructor` or `sm.computeStereoPan is not a function`.

- [ ] **Step 3: Implement the multi-layered spatial horror audio engine in `client/js/audio.js`**

1. Export `{ SoundManager }` when `typeof module !== 'undefined' && module.exports`, and only assign `window.soundManager = new SoundManager()` when `typeof window !== 'undefined'`.
2. In `SoundManager`:
   - Add `setupAudioGraph()` called by `init()`: creates `this.masterGain`, `this.compressor` (`createDynamicsCompressor`), `this.reverbNode` (`createConvolver` with `createReverbImpulse(1.1, 3.2)`), `this.reverbGain` (`0.24`), and `this.distortionCurve = this.createDistortionCurve(35)`.
   - Implement `computeStereoPan(sourceX, listenerX)` and `computeDistanceGain(sourceX, listenerX, maxDist = 1100)`, plus `createSpatialBus(sourceX, listenerX, reverbSend = 0.2)` returning `{ input, panner }` wired to both `this.compressor` (dry) and `this.reverbNode` (wet).
   - Upgrade `playShoot(weaponType = 'PISTOL', sourceX, listenerX)` with 3 layers:
     - Layer 1: Bandpass/lowpass noise burst through `WaveShaperNode` (`this.distortionCurve`).
     - Layer 2: Sub-bass pitch-dropping oscillator (`playWeaponBodyLayer`).
     - Layer 3: Throttled metallic shell casing clink (`playShellCasingClink`, max once per `75ms` via `this.lastShellClinkTime`).
   - Upgrade `playZombieHit(zType = 'NORMAL', weapon = 'bullet', sourceX, listenerX)` (wet flesh resonant bandpass noise sweep + bone crack transient) and `playZombieDie(zType = 'NORMAL', sourceX, listenerX)` (FM guttural sawtooth/sine death groan + wet splatter).
   - Implement `playZombieGrowl(zType = 'NORMAL', sourceX, listenerX)` with `1.8s` cooldown (`this.lastGrowlTime`) and distinct synthesis per type (`RUNNER` shriek, `TANK` sub-roar, `DEVIL`/`VAMPIRE` tritone snarl, `NORMAL`/`MUMMY` hollow groan).
   - Implement `playWaveStart(wave = 1)` (dread horn chord through reverb), `playHeartbeatPulse(intensity = 1)`, `updateHorrorAmbience(dt, state)` (manages continuous dark fifth drone `44Hz + 65.9Hz` with LFO filter, low-HP/surrounded heartbeat timer, and proximity zombie growl trigger every `2.6s`), and `stopHorrorAmbience()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: PASS (5 tests pass).

- [ ] **Step 5: Commit**

```bash
git add client/js/audio.js tests/horror_vfx_audio.test.js
git commit -m "feat(audio): upgrade SoundManager with spatial stereo, reverb, 3-layer gunshots, and horror soundscape"
```

---

### Task 5: Wire Client Event & Game Loop Integration in `client/js/main.js`

**Files:**
- Modify: `client/js/main.js:107-155`
- Modify: `client/js/main.js:221-376`
- Test: `tests/horror_vfx_audio.test.js`

**Interfaces:**
- Consumes:
  - Enriched `snapshot.events` (`SHOOT`, `HIT`, `ZOMBIE_DIE`, `EXPLOSION`, `WAVE_START`, `GAME_OVER`, `SESSION_RESET`) from `server/game/GameRoom.js` (Task 1).
  - `renderer.addMuzzleFlash`, `renderer.addDirectionalBlood`, `renderer.updateVisuals` from `client/js/renderer.js` (Task 2 & Task 3).
  - `soundManager.playShoot`, `soundManager.playZombieHit`, `soundManager.playZombieDie`, `soundManager.playExplosion`, `soundManager.playWaveStart`, `soundManager.updateHorrorAmbience`, `soundManager.stopHorrorAmbience` from `client/js/audio.js` (Task 4).

- [ ] **Step 1: Update `handleGameEvent`, room leave handlers, and `gameLoop` in `client/js/main.js`**

1. In `client/js/main.js` room leave handlers (`btnPauseLeave`, `btnLeaveRoom`, `btnBackLobby`) and `SESSION_RESET` / `GAME_OVER`:
   - Call `if (window.soundManager && typeof window.soundManager.stopHorrorAmbience === 'function') window.soundManager.stopHorrorAmbience();`
2. In `handleGameEvent(ev, snapshot)`:
   - Resolve `localPlayer = snapshot && snapshot.players ? (snapshot.players.find(p => p.id === myPlayerId) || snapshot.players[0]) : null` and `listenerX = localPlayer ? localPlayer.x : renderer.camera.x`.
   - `SHOOT`:
     - `if (snd) snd.playShoot(ev.weapon, ev.x, listenerX);`
     - `renderer.addMuzzleFlash(ev.x, ev.y, ev.angle, ev.weapon);`
     - If `ev.playerId === myPlayerId`, trigger subtle weapon recoil screen shake (`SHOTGUN`: `5`, `ROCKET`/`RAILGUN`: `8`, `UZI`/`PISTOL`: `1.5`).
   - `HIT`:
     - `if (snd) snd.playZombieHit(ev.zType, ev.weapon, ev.x, listenerX);`
     - `renderer.addDirectionalBlood(ev.x, ev.y, typeof ev.angle === 'number' ? ev.angle : 0, ev.weapon, false);`
   - `ZOMBIE_DIE`:
     - `if (snd) snd.playZombieDie(ev.zType, ev.x, listenerX);`
     - `const bloodColor = ev.zType === 'DEVIL' ? '#c62828' : '#7f0000';`
     - `renderer.addDirectionalBlood(ev.x, ev.y, typeof ev.killAngle === 'number' ? ev.killAngle : (ev.angle || 0), 'kill', true, bloodColor);`
     - `renderer.addZombieCorpse(ev);`
   - `EXPLOSION`:
     - `if (snd) snd.playExplosion(ev.radius > 120 ? 1.4 : 1.0, ev.x, listenerX);`
     - `renderer.addExplosionParticles(ev.x, ev.y, ev.radius);`
   - `WAVE_START`:
     - `if (snd && typeof snd.playWaveStart === 'function') snd.playWaveStart(ev.wave);`
     - `renderer.addFloatingText(\`WAVE \${ev.wave} BẮT ĐẦU!\`, renderer.camera.x, renderer.camera.y - 80, '#ff3d00', 38);`
3. In `gameLoop(now)`:
   - Retrieve `const state = isInGame ? interpolator.getInterpolatedState() : null;`
   - Call `renderer.updateVisuals(dt, currentMap, state ? state.wave : 1);`
   - If `isInGame && state`:
     - `const localPlayer = state.players ? (state.players.find(p => p.id === myPlayerId) || state.players[0]) : null;`
     - `if (window.soundManager && typeof window.soundManager.updateHorrorAmbience === 'function') { window.soundManager.updateHorrorAmbience(dt, { isInGame: state.state !== 'GAMEOVER', wave: state.wave || 1, localPlayer, zombies: state.zombies || [] }); }`
     - `renderer.render(state, myPlayerId, currentMap);`
     - `ui.updateHUD(state, myPlayerId);`

- [ ] **Step 2: Run the entire test suite to verify all existing and new tests pass**

Run: `node --test tests/*.test.js`
Expected: PASS (all existing 45 tests + 6 new tests = 51 tests passing with 0 failures).

- [ ] **Step 3: Commit**

```bash
git add client/js/main.js
git commit -m "feat(client): wire spatial horror audio, directional gore, and wave darkness into main game loop"
```
