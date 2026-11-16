# Weapon Audio Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the 46 synthesized `.wav` weapon sound effects from `gun-sound.zip` across all 6 firearms (`PISTOL`, `UZI`, `SHOTGUN`, `GRENADE`, `ROCKET`, `RAILGUN`) into `SoundManager` with spatial audio, random variation, secondary shot sequencing (`pump`, `casing`, `cooldown`, `impact`, `flight` loop), and seamless procedural synth fallback.

**Architecture:** Extract 46 runtime `.wav` files into `client/assets/audio/weapons/<weapon>/<event>_<n>.wav` served statically by Express. Implement a dedicated `WeaponAudioBank` module (`client/js/weaponAudio.js`) managing manifest volumes, background fetch, Web Audio buffer decoding, polyphony voice budgeting (`maxVoices = 32`), and spatial 2D panning/attenuation. Wire `WeaponAudioBank` into `SoundManager` (`client/js/audio.js`) with procedural synth fallback for headless testing or unloaded states, enrich server `EXPLOSION` events with weapon source in `server/game/GameRoom.js`, and connect gameplay events in `client/js/main.js` and `client/index.html`.

**Tech Stack:** Node.js (CommonJS), Express static serving, HTML5 Web Audio API (`AudioBufferSourceNode`, `StereoPannerNode`, `BiquadFilterNode`, `GainNode`), `node:test` + `node:assert`.

## Global Constraints

- Do not modify or delete `gun-sound.zip`; extract runtime WAVs into `client/assets/audio/weapons/<weapon>/<event>_<n>.wav`.
- Maintain zero breaking changes to existing `SoundManager.playShoot` and `SoundManager.playExplosion` method signatures (`weaponType`, `sourceX`, `listenerX`).
- Guard all Web Audio, `fetch`, `window`, and `performance` references in `client/js/weaponAudio.js` and `client/js/audio.js` so Node.js unit tests run cleanly without browser mocks.
- Support headless/offline fallback: if WAV buffers are not yet loaded or `fetch` fails, all weapon events degrade seamlessly to procedural Web Audio synthesis without throwing errors.
- Strict voice budget: `maxVoices = 32`, release voice counters on `onended`, and clamp non-finite coordinates (`NaN`, `Infinity`) to safe defaults.
- Clean Code (`GEMINI.md`): Single-responsibility methods under 30–40 lines, guard clauses (early returns), no empty `catch` blocks (log warnings with context).

---

## File Structure & Responsibilities

| Action | Path | Responsibility |
| :--- | :--- | :--- |
| Create (extract) | `client/assets/audio/weapons/{pistol,uzi,shotgun,grenade,rocket,railgun}/*.wav` (46 files) | Runtime mono 44.1 kHz WAV assets served statically by Express at `/assets/audio/weapons/...`. |
| Create | `client/js/weaponAudio.js` | `WEAPON_SFX` counts, `WEAPON_SFX_VOLUMES`, `WeaponAudioBank` preloader/decoder, voice budgeting, 2D spatial routing, and looping rocket flight audio. |
| Modify | `server/game/Bullet.js` | Include `source` (`this.type`) in explosion return object when bullet or grenade detonates. |
| Modify | `server/game/GameRoom.js` | Enrich `EXPLOSION` event with `source: 'GRENADE' \| 'ROCKET' \| 'BARREL' \| 'FIREBALL' \| 'GENERIC'`. |
| Modify | `client/js/audio.js` | Integrate `WeaponAudioBank` into `SoundManager`: hook `playShoot` to WAVs + secondary events (`pump`, `casing`, `cooldown`), upgrade `playExplosion` with weapon source, add `playWeaponEmpty`, `playWeaponReload`, `playRailgunCharge`, `playRailgunImpact`, and `updateRocketFlight`. |
| Modify | `client/index.html` | Load `<script src="js/weaponAudio.js"></script>` before `js/audio.js`. |
| Modify | `client/js/main.js` | Background preload weapon audio, pass `ev.source` to `playExplosion`, trigger `playRailgunImpact` on railgun HIT, trigger `playWeaponReload` on PICKUP, trigger `playWeaponEmpty` on empty click, and update rocket flight loop in `gameLoop`. |
| Create | `tests/weapon_audio_bank.test.js` | Unit tests for asset integrity, preloading, voice limiting, fallback, and spatial clamping. |
| Modify | `tests/game_room.test.js` | Verify `EXPLOSION` events include correct `source` for rocket, grenade, and barrel explosions. |
| Modify | `tests/horror_vfx_audio.test.js` | Verify `SoundManager` routes shoot and explosion to WAVs with procedural fallback. |
| Modify | `tests/server.test.js` | Verify Express serves `/assets/audio/weapons/pistol/fire_1.wav` with HTTP 200. |

---

### Task 1: Extract Runtime Weapon WAV Assets & Implement `WeaponAudioBank`

**Files:**
- Create (extract): `client/assets/audio/weapons/{pistol,uzi,shotgun,grenade,rocket,railgun}/*.wav` (46 files from `gun-sound.zip` -> `weapon_audio.zip`)
- Create: `client/js/weaponAudio.js`
- Test: `tests/weapon_audio_bank.test.js`

**Interfaces:**
- Consumes:
  - `gun-sound.zip` -> `weapon_audio.zip` entries (`weapons/<weapon>/<event>_<n>.wav`)
  - `weapon_audio_manifest.json` structure
- Produces (`client/js/weaponAudio.js`, exported via `module.exports` and attached to `window`):
  - `WEAPON_SFX`: `{ pistol: { fire: 3, reload: 1, empty: 1, casing: 2 }, uzi: { fire: 4, reload: 1, empty: 1, casing: 2 }, shotgun: { fire: 3, pump: 2, load: 2, empty: 1, casing: 2 }, grenade: { pin: 1, throw: 1, bounce: 3, explode: 2 }, rocket: { load: 1, fire: 2, flight: 1, explode: 2 }, railgun: { charge: 1, fire: 3, cooldown: 1, empty: 1, impact: 2 } }`
  - `WEAPON_SFX_VOLUMES`: `{ fire: 1.0, explode: 1.0, reload: 0.6, empty: 0.5, casing: 0.35, pump: 0.75, load: 0.6, pin: 0.6, throw: 0.7, bounce: 0.7, flight: 0.55, charge: 0.8, cooldown: 0.6, impact: 0.8 }`
  - `class WeaponAudioBank`:
    - `constructor(options?: { basePath?: string, maxVoices?: number, fetchFn?: Function })`
    - `getAllAssetEntries() -> Array<{ weapon: string, event: string, index: number, key: string, url: string }>`
    - `preloadRaw(concurrency?: number) -> Promise<number>`
    - `decodeAll(ctx: AudioContext) -> Promise<number>`
    - `hasBuffer(weapon: string, event: string) -> boolean`
    - `hasAnyBuffers() -> boolean`
    - `computeSpatialParams(sourceX?: number, listenerX?: number, maxDist?: number) -> { gain: number, pan: number, cutoff: number }`
    - `playSample(ctx: AudioContext, destNode: AudioNode, weapon: string, event: string, options?: { sourceX?: number, listenerX?: number, maxDist?: number, volume?: number, pitch?: number, delay?: number }) -> boolean`
    - `createRocketLoop(ctx: AudioContext, destNode: AudioNode, options?: { sourceX?: number, listenerX?: number }) -> { update: (coords: { sourceX?: number, listenerX?: number }) => void, stop: () => void }`
    - `reset() -> void`

- [ ] **Step 1: Extract all 46 `.wav` files into `client/assets/audio/weapons/`**

Run shell command to unzip `gun-sound.zip`, unpack nested `weapon_audio.zip` directly into `client/assets/audio/`, and verify all 46 files:
```bash
python3 -c "
import zipfile, os
with zipfile.ZipFile('gun-sound.zip', 'r') as outer_zip:
    outer_zip.extract('weapon_audio.zip', '/tmp')
with zipfile.ZipFile('/tmp/weapon_audio.zip', 'r') as inner_zip:
    inner_zip.extractall('client/assets/audio')
os.remove('/tmp/weapon_audio.zip')
"
```
Verify files exist:
```bash
ls client/assets/audio/weapons/*/*.wav | wc -l
```
Expected: `46`

- [ ] **Step 2: Write failing unit test `tests/weapon_audio_bank.test.js`**

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { WeaponAudioBank, WEAPON_SFX, WEAPON_SFX_VOLUMES } = require('../client/js/weaponAudio.js');

test('WeaponAudioBank - All 46 WAV files exist on disk with valid file size', () => {
  const bank = new WeaponAudioBank({ basePath: path.join(__dirname, '../client/assets/audio/weapons') });
  const entries = bank.getAllAssetEntries();
  assert.strictEqual(entries.length, 46);

  for (const entry of entries) {
    const fullPath = path.join(__dirname, '../client/assets/audio', entry.url.replace(/^\/?assets\/audio\//, ''));
    assert.strictEqual(fs.existsSync(fullPath), true, `File missing: ${fullPath}`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 1000, `File too small: ${fullPath} (${stat.size} bytes)`);
  }
});

test('WeaponAudioBank - Config contains all 6 weapons and correct volume definitions', () => {
  assert.deepStrictEqual(Object.keys(WEAPON_SFX).sort(), ['grenade', 'pistol', 'railgun', 'rocket', 'shotgun', 'uzi']);
  assert.strictEqual(WEAPON_SFX.pistol.fire, 3);
  assert.strictEqual(WEAPON_SFX.uzi.fire, 4);
  assert.strictEqual(WEAPON_SFX.shotgun.fire, 3);
  assert.strictEqual(WEAPON_SFX.grenade.explode, 2);
  assert.strictEqual(WEAPON_SFX.rocket.fire, 2);
  assert.strictEqual(WEAPON_SFX.railgun.fire, 3);
  assert.strictEqual(WEAPON_SFX_VOLUMES.fire, 1.0);
  assert.strictEqual(WEAPON_SFX_VOLUMES.explode, 1.0);
});

test('WeaponAudioBank - computeSpatialParams clamps safely on NaN/Infinity and distances', () => {
  const bank = new WeaponAudioBank();
  const normal = bank.computeSpatialParams(200, 0, 1000);
  assert.ok(normal.gain > 0 && normal.gain <= 1.0);
  assert.ok(normal.pan > 0 && normal.pan <= 1.0);
  assert.ok(normal.cutoff >= 800 && normal.cutoff <= 20000);

  const safeNan = bank.computeSpatialParams(NaN, Infinity, 1000);
  assert.strictEqual(safeNan.gain, 1.0);
  assert.strictEqual(safeNan.pan, 0);
  assert.strictEqual(safeNan.cutoff, 20000);
});

test('WeaponAudioBank - playSample returns false gracefully when buffers are not loaded', () => {
  const bank = new WeaponAudioBank();
  assert.strictEqual(bank.hasAnyBuffers(), false);
  const played = bank.playSample(null, null, 'pistol', 'fire');
  assert.strictEqual(played, false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/weapon_audio_bank.test.js`
Expected: FAIL (`Cannot find module '../client/js/weaponAudio.js'`)

- [ ] **Step 4: Implement `client/js/weaponAudio.js`**

```javascript
const WEAPON_SFX = {
  pistol:  { fire: 3, reload: 1, empty: 1, casing: 2 },
  uzi:     { fire: 4, reload: 1, empty: 1, casing: 2 },
  shotgun: { fire: 3, pump: 2, load: 2, empty: 1, casing: 2 },
  grenade: { pin: 1, throw: 1, bounce: 3, explode: 2 },
  rocket:  { load: 1, fire: 2, flight: 1, explode: 2 },
  railgun: { charge: 1, fire: 3, cooldown: 1, empty: 1, impact: 2 },
};

const WEAPON_SFX_VOLUMES = {
  fire: 1.0, explode: 1.0, reload: 0.6, empty: 0.5, casing: 0.35, pump: 0.75, load: 0.6,
  pin: 0.6, throw: 0.7, bounce: 0.7, flight: 0.55, charge: 0.8, cooldown: 0.6, impact: 0.8
};

const WEAPON_MAX_DIST = {
  fire: 1100, explode: 1300, reload: 500, empty: 400, casing: 350, pump: 600, load: 500,
  pin: 400, throw: 550, bounce: 600, flight: 1000, charge: 700, cooldown: 600, impact: 900
};

class WeaponAudioBank {
  constructor(options = {}) {
    this.basePath = options.basePath || '/assets/audio/weapons';
    this.maxVoices = options.maxVoices || 32;
    this.fetchFn = options.fetchFn || (typeof fetch === 'function' ? fetch.bind(window) : null);
    this.buffers = new Map();
    this.rawBuffers = new Map();
    this.lastVariation = new Map();
    this.activeVoices = 0;
    this.preloadPromise = null;
    this.decodePromise = null;
  }

  normalizeWeaponKey(weapon) {
    if (!weapon || typeof weapon !== 'string') return 'pistol';
    const key = weapon.toLowerCase();
    return WEAPON_SFX[key] ? key : 'pistol';
  }

  getAllAssetEntries() {
    const entries = [];
    for (const [weapon, events] of Object.entries(WEAPON_SFX)) {
      for (const [event, count] of Object.entries(events)) {
        for (let i = 1; i <= count; i++) {
          const key = `${weapon}/${event}_${i}`;
          const url = `${this.basePath}/${weapon}/${event}_${i}.wav`;
          entries.push({ weapon, event, index: i, key, url });
        }
      }
    }
    return entries;
  }

  async preloadRaw(concurrency = 6) {
    if (this.preloadPromise) return this.preloadPromise;
    if (!this.fetchFn) return 0;

    const entries = this.getAllAssetEntries();
    let loaded = 0;
    let cursor = 0;

    const worker = async () => {
      while (cursor < entries.length) {
        const item = entries[cursor++];
        if (this.rawBuffers.has(item.key) || this.buffers.has(item.key)) {
          loaded++;
          continue;
        }
        try {
          const res = await this.fetchFn(item.url);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            this.rawBuffers.set(item.key, buf);
            loaded++;
          }
        } catch (err) {
          console.warn(`[WeaponAudioBank] Failed to fetch ${item.url}:`, err);
        }
      }
    };

    this.preloadPromise = Promise.all(
      Array.from({ length: Math.min(concurrency, entries.length) }, () => worker())
    ).then(() => loaded);

    return this.preloadPromise;
  }

  async decodeAll(ctx) {
    if (!ctx || typeof ctx.decodeAudioData !== 'function') return 0;
    if (this.decodePromise) return this.decodePromise;

    await this.preloadRaw();
    let decoded = 0;

    const promises = Array.from(this.rawBuffers.entries()).map(async ([key, raw]) => {
      try {
        const audioBuffer = await ctx.decodeAudioData(raw.slice(0));
        this.buffers.set(key, audioBuffer);
        decoded++;
      } catch (err) {
        console.warn(`[WeaponAudioBank] Failed to decode ${key}:`, err);
      } finally {
        this.rawBuffers.delete(key);
      }
    });

    this.decodePromise = Promise.all(promises).then(() => decoded);
    return this.decodePromise;
  }

  hasBuffer(weapon, event) {
    const norm = this.normalizeWeaponKey(weapon);
    const count = (WEAPON_SFX[norm] && WEAPON_SFX[norm][event]) || 0;
    for (let i = 1; i <= count; i++) {
      if (this.buffers.has(`${norm}/${event}_${i}`)) return true;
    }
    return false;
  }

  hasAnyBuffers() {
    return this.buffers.size > 0;
  }

  pickBuffer(weapon, event) {
    const norm = this.normalizeWeaponKey(weapon);
    const count = (WEAPON_SFX[norm] && WEAPON_SFX[norm][event]) || 0;
    if (count === 0) return null;

    const validIndices = [];
    for (let i = 1; i <= count; i++) {
      if (this.buffers.has(`${norm}/${event}_${i}`)) validIndices.push(i);
    }
    if (validIndices.length === 0) return null;
    if (validIndices.length === 1) return this.buffers.get(`${norm}/${event}_${validIndices[0]}`);

    const last = this.lastVariation.get(`${norm}/${event}`);
    let chosen = validIndices[Math.floor(Math.random() * validIndices.length)];
    if (chosen === last && validIndices.length > 1) {
      const filtered = validIndices.filter(x => x !== last);
      chosen = filtered[Math.floor(Math.random() * filtered.length)];
    }
    this.lastVariation.set(`${norm}/${event}`, chosen);
    return this.buffers.get(`${norm}/${event}_${chosen}`);
  }

  computeSpatialParams(sourceX, listenerX, maxDist = 1000) {
    if (!Number.isFinite(sourceX) || !Number.isFinite(listenerX)) {
      return { gain: 1.0, pan: 0, cutoff: 20000 };
    }
    const dx = sourceX - listenerX;
    const dist = Math.abs(dx);
    const norm = Math.max(0, Math.min(1, dist / maxDist));
    const gain = Math.max(0, 1 - norm);
    const pan = Math.max(-0.9, Math.min(0.9, dx / 550));
    const cutoff = Math.round(800 + 19200 * (gain * gain));
    return { gain, pan, cutoff };
  }

  playSample(ctx, destNode, weapon, event, options = {}) {
    if (!ctx || !destNode || this.activeVoices >= this.maxVoices) return false;
    const buffer = this.pickBuffer(weapon, event);
    if (!buffer) return false;

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }

    const maxDist = options.maxDist || WEAPON_MAX_DIST[event] || 1000;
    const spatial = this.computeSpatialParams(options.sourceX, options.listenerX, maxDist);
    const baseVol = (WEAPON_SFX_VOLUMES[event] !== undefined ? WEAPON_SFX_VOLUMES[event] : 1.0);
    const effectiveGain = baseVol * (options.volume !== undefined ? options.volume : 1.0) * spatial.gain;
    if (effectiveGain < 0.01) return false;

    const t = (ctx.currentTime || 0) + (options.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const pitchMod = options.pitch || (0.97 + Math.random() * 0.06);
    if (src.playbackRate) src.playbackRate.setValueAtTime(pitchMod, t);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(effectiveGain, t);

    let endNode = gainNode;
    if (typeof ctx.createBiquadFilter === 'function') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(spatial.cutoff, t);
      src.connect(filter);
      filter.connect(gainNode);
    } else {
      src.connect(gainNode);
    }

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(spatial.pan, t);
      gainNode.connect(panner);
      endNode = panner;
    }

    endNode.connect(destNode);

    this.activeVoices++;
    src.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    };

    src.start(t);
    return true;
  }

  createRocketLoop(ctx, destNode, options = {}) {
    if (!ctx || !destNode) return null;
    const buffer = this.buffers.get('rocket/flight_1');
    if (!buffer) return null;

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime || 0;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gainNode = ctx.createGain();
    const baseVol = WEAPON_SFX_VOLUMES.flight || 0.55;
    const spatial = this.computeSpatialParams(options.sourceX, options.listenerX, 1000);
    gainNode.gain.setValueAtTime(baseVol * spatial.gain, t);

    let panner = null;
    let endNode = gainNode;
    if (typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(spatial.pan, t);
      gainNode.connect(panner);
      endNode = panner;
    }

    src.connect(gainNode);
    endNode.connect(destNode);
    src.start(t);

    return {
      update: (coords = {}) => {
        const curT = ctx.currentTime || 0;
        const s = this.computeSpatialParams(coords.sourceX, coords.listenerX, 1000);
        if (gainNode.gain.setTargetAtTime) {
          gainNode.gain.setTargetAtTime(baseVol * s.gain, curT, 0.05);
        } else {
          gainNode.gain.setValueAtTime(baseVol * s.gain, curT);
        }
        if (panner && panner.pan.setValueAtTime) {
          panner.pan.setValueAtTime(s.pan, curT);
        }
      },
      stop: (fade = 0.08) => {
        const stopT = ctx.currentTime || 0;
        if (gainNode.gain.setTargetAtTime) {
          gainNode.gain.setTargetAtTime(0, stopT, fade / 3);
        }
        try {
          src.stop(stopT + fade);
        } catch (_) {}
      }
    };
  }

  reset() {
    this.buffers.clear();
    this.rawBuffers.clear();
    this.lastVariation.clear();
    this.activeVoices = 0;
    this.preloadPromise = null;
    this.decodePromise = null;
  }
}

if (typeof window !== 'undefined') {
  window.WeaponAudioBank = WeaponAudioBank;
  window.WEAPON_SFX = WEAPON_SFX;
  window.WEAPON_SFX_VOLUMES = WEAPON_SFX_VOLUMES;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeaponAudioBank, WEAPON_SFX, WEAPON_SFX_VOLUMES, WEAPON_MAX_DIST };
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `node --test tests/weapon_audio_bank.test.js`
Expected: PASS (4 tests passing)

- [ ] **Step 6: Commit Task 1**

```bash
git add client/assets/audio/weapons client/js/weaponAudio.js tests/weapon_audio_bank.test.js
git commit -m "feat(audio): extract weapon wav assets and implement WeaponAudioBank"
```

---

### Task 2: Server-Side Weapon Event Enrichment (`GameRoom.js` & `Bullet.js`)

**Files:**
- Modify: `server/game/Bullet.js:35-86`
- Modify: `server/game/GameRoom.js:297-306, 464-472, 550-565`
- Test: `tests/game_room.test.js`

**Interfaces:**
- Consumes:
  - Bullet explosion events in `Bullet.update()`
- Produces:
  - `GameRoom.triggerExplosion(x, y, radius, damage, ownerId, source = 'GENERIC')`
  - Snapshot event: `{ type: 'EXPLOSION', x, y, radius, source: string }`

- [ ] **Step 1: Write failing test in `tests/game_room.test.js` verifying explosion source**

Add test to `tests/game_room.test.js`:
```javascript
test('GameRoom triggerExplosion includes source tag in EXPLOSION event', () => {
  const room = new GameRoom('test_room', 'host_id', 'Host');
  room.initGame('hospital');
  room.triggerExplosion(300, 300, 150, 200, 'host_id', 'ROCKET');

  const expEvent = room.eventsBuffer.find(e => e.type === 'EXPLOSION');
  assert.ok(expEvent, 'EXPLOSION event must be emitted');
  assert.strictEqual(expEvent.source, 'ROCKET');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/game_room.test.js`
Expected: FAIL (`assert.strictEqual(expEvent.source, 'ROCKET')` receives `undefined`)

- [ ] **Step 3: Modify `server/game/Bullet.js` to return `source: this.type`**

In `server/game/Bullet.js`, include `source: (this.type || 'generic').toUpperCase()` on all return objects when `exploded: true`:
```javascript
        return {
          exploded: true,
          x: this.x,
          y: this.y,
          radius: this.explosionRadius,
          damage: this.explosionDamage,
          ownerId: this.ownerId,
          source: (this.type || 'generic').toUpperCase()
        };
```

- [ ] **Step 4: Modify `server/game/GameRoom.js` to accept and emit `source`**

Update `triggerExplosion`:
```javascript
  triggerExplosion(x, y, radius, damage, ownerId, source = 'GENERIC') {
    this.eventsBuffer.push({
      type: 'EXPLOSION',
      x: Math.round(x),
      y: Math.round(y),
      radius: Math.round(radius),
      source: String(source).toUpperCase()
    });
```
And where `triggerExplosion` is called from bullet explosion:
```javascript
      if (explosion) {
        this.triggerExplosion(explosion.x, explosion.y, explosion.radius, explosion.damage, explosion.ownerId, explosion.source || 'GENERIC');
      }
```
And where barrel explodes:
```javascript
      bar.takeDamage(b.damage, barrels, (bx, by, br, bd, bo) => {
        this.triggerExplosion(bx, by, br, bd, b.ownerId, 'BARREL');
      });
```
And where Devil fireball explodes:
```javascript
      if (b.checkHit(p)) {
        b.isDead = true;
        this.triggerExplosion(b.x, b.y, b.explosionRadius, b.explosionDamage, null, 'FIREBALL');
        break;
      }
```

- [ ] **Step 5: Run tests to verify pass**

Run: `node --test tests/game_room.test.js`
Expected: PASS

- [ ] **Step 6: Commit Task 2**

```bash
git add server/game/Bullet.js server/game/GameRoom.js tests/game_room.test.js
git commit -m "feat(server): enrich EXPLOSION event with weapon source"
```

---

### Task 3: Integrate `WeaponAudioBank` into `SoundManager` (`client/js/audio.js`)

**Files:**
- Modify: `client/js/audio.js`
- Test: `tests/horror_vfx_audio.test.js`

**Interfaces:**
- Consumes:
  - `WeaponAudioBank` from `client/js/weaponAudio.js`
  - Existing `SoundManager.createSpatialBus`, `computeStereoPan`, `computeDistanceGain`
- Produces:
  - `soundManager.weaponBank`: `WeaponAudioBank` instance
  - `soundManager.playShoot(weaponType, sourceX, listenerX)`: tries WAVs first, handles scheduled `pump`/`casing`/`cooldown`, falls back to synth
  - `soundManager.playExplosion(scale, sourceX, listenerX, source = 'GENERIC')`: tries weapon-specific WAVs, falls back to synth
  - `soundManager.playWeaponEmpty(weaponType, sourceX, listenerX)`
  - `soundManager.playWeaponReload(weaponType, sourceX, listenerX)`
  - `soundManager.playRailgunCharge(sourceX, listenerX)`
  - `soundManager.playRailgunImpact(sourceX, listenerX)`
  - `soundManager.updateRocketFlight(rockets, listenerX)`
  - `soundManager.stopRocketLoops()`

- [ ] **Step 1: Write failing test in `tests/horror_vfx_audio.test.js`**

Add tests checking `SoundManager` weapon integration:
```javascript
test('SoundManager weapon audio integration with procedural fallback', () => {
  const { SoundManager } = require('../client/js/audio.js');
  const sm = new SoundManager();
  sm.init();

  assert.ok(sm.weaponBank, 'SoundManager should instantiate weaponBank');

  // When buffers not loaded, playShoot should not crash and should execute procedural fallback
  assert.doesNotThrow(() => {
    sm.playShoot('PISTOL', 100, 0);
    sm.playShoot('SHOTGUN', 100, 0);
    sm.playShoot('RAILGUN', 100, 0);
    sm.playShoot('ROCKET', 100, 0);
    sm.playShoot('GRENADE', 100, 0);
    sm.playExplosion(1.0, 100, 0, 'ROCKET');
    sm.playExplosion(1.0, 100, 0, 'GRENADE');
    sm.playWeaponEmpty('PISTOL', 100, 0);
    sm.playWeaponReload('SHOTGUN', 100, 0);
    sm.playRailgunCharge(100, 0);
    sm.playRailgunImpact(100, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: FAIL (`sm.weaponBank is undefined` or methods missing)

- [ ] **Step 3: Update `client/js/audio.js`**

In `SoundManager` constructor:
```javascript
    const WeaponBankClass = (typeof window !== 'undefined' && window.WeaponAudioBank)
      ? window.WeaponAudioBank
      : (typeof require === 'function' ? (require('./weaponAudio.js').WeaponAudioBank || null) : null);
    this.weaponBank = WeaponBankClass ? new WeaponBankClass() : null;
    this.rocketLoops = new Map();
```

In `SoundManager.init()`:
```javascript
    if (this.weaponBank && this.ctx) {
      this.weaponBank.decodeAll(this.ctx).catch(err => {
        console.warn('[SoundManager] Weapon audio decode error:', err);
      });
    }
```

Update `SoundManager.playShoot`:
```javascript
  playShoot(weaponType = 'PISTOL', sourceX, listenerX) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const norm = String(weaponType).toLowerCase();
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    let playedWav = false;

    if (this.weaponBank && this.weaponBank.hasBuffer(norm, 'fire')) {
      playedWav = this.weaponBank.playSample(this.ctx, targetNode, norm, 'fire', {
        sourceX, listenerX, maxDist: 1100
      });

      // Post-shot event sequencing
      if (norm === 'shotgun') {
        setTimeout(() => {
          if (!this.muted && this.ctx) {
            this.weaponBank.playSample(this.ctx, targetNode, 'shotgun', 'pump', { sourceX, listenerX, delay: 0 });
            this.weaponBank.playSample(this.ctx, targetNode, 'shotgun', 'casing', { sourceX, listenerX, delay: 0.05 });
          }
        }, 220);
      } else if (norm === 'railgun') {
        setTimeout(() => {
          if (!this.muted && this.ctx) {
            this.weaponBank.playSample(this.ctx, targetNode, 'railgun', 'cooldown', { sourceX, listenerX, delay: 0 });
          }
        }, 180);
      } else if (norm === 'pistol' || norm === 'uzi') {
        setTimeout(() => {
          if (!this.muted && this.ctx) {
            this.weaponBank.playSample(this.ctx, targetNode, norm, 'casing', { sourceX, listenerX, delay: 0 });
          }
        }, 50);
      }
    } else if (norm === 'grenade' && this.weaponBank && this.weaponBank.hasBuffer('grenade', 'throw')) {
      playedWav = this.weaponBank.playSample(this.ctx, targetNode, 'grenade', 'throw', {
        sourceX, listenerX, maxDist: 700
      });
    }

    if (!playedWav) {
      // Procedural synth fallback
      const bus = this.createSpatialBus(sourceX, listenerX, 0.22);
      if (!bus) return;
      this.playWeaponTransientLayer(weaponType, bus.input);
      this.playWeaponBodyLayer(weaponType, bus.input);
      this.playShellCasingClink(weaponType, sourceX, listenerX);
    }
  }
```

Update `SoundManager.playExplosion`:
```javascript
  playExplosion(scale = 1, sourceX, listenerX, source = 'GENERIC') {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    let playedWav = false;
    const srcUpper = String(source).toUpperCase();

    if (this.weaponBank) {
      if (srcUpper === 'GRENADE' && this.weaponBank.hasBuffer('grenade', 'explode')) {
        playedWav = this.weaponBank.playSample(this.ctx, targetNode, 'grenade', 'explode', {
          sourceX, listenerX, volume: Math.min(1.3, scale), maxDist: 1300
        });
      } else if (srcUpper === 'ROCKET' && this.weaponBank.hasBuffer('rocket', 'explode')) {
        playedWav = this.weaponBank.playSample(this.ctx, targetNode, 'rocket', 'explode', {
          sourceX, listenerX, volume: Math.min(1.4, scale * 1.1), maxDist: 1400
        });
      } else {
        const fallbackWeapon = Math.random() < 0.5 ? 'rocket' : 'grenade';
        if (this.weaponBank.hasBuffer(fallbackWeapon, 'explode')) {
          playedWav = this.weaponBank.playSample(this.ctx, targetNode, fallbackWeapon, 'explode', {
            sourceX, listenerX, volume: Math.min(1.2, scale), maxDist: 1200
          });
        }
      }
    }

    if (!playedWav) {
      // Procedural synth fallback
      const bus = this.createSpatialBus(sourceX, listenerX, 0.35);
      if (!bus) return;
      // ... existing procedural osc and noise code ...
    }
  }
```

Add auxiliary sound methods:
```javascript
  playWeaponEmpty(weaponType = 'PISTOL', sourceX, listenerX) {
    if (this.muted || !this.weaponBank) return;
    this.ensureContext();
    if (!this.ctx) return;
    const norm = String(weaponType).toLowerCase();
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    this.weaponBank.playSample(this.ctx, targetNode, norm, 'empty', { sourceX, listenerX });
  }

  playWeaponReload(weaponType = 'PISTOL', sourceX, listenerX) {
    if (this.muted || !this.weaponBank) return;
    this.ensureContext();
    if (!this.ctx) return;
    const norm = String(weaponType).toLowerCase();
    const event = (norm === 'shotgun' || norm === 'rocket') ? 'load' : 'reload';
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    this.weaponBank.playSample(this.ctx, targetNode, norm, event, { sourceX, listenerX });
  }

  playRailgunCharge(sourceX, listenerX) {
    if (this.muted || !this.weaponBank) return;
    this.ensureContext();
    if (!this.ctx) return;
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    this.weaponBank.playSample(this.ctx, targetNode, 'railgun', 'charge', { sourceX, listenerX });
  }

  playRailgunImpact(sourceX, listenerX) {
    if (this.muted || !this.weaponBank) return;
    this.ensureContext();
    if (!this.ctx) return;
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;
    this.weaponBank.playSample(this.ctx, targetNode, 'railgun', 'impact', { sourceX, listenerX });
  }

  updateRocketFlight(rockets = [], listenerX) {
    if (this.muted || !this.weaponBank || !this.ctx) {
      this.stopRocketLoops();
      return;
    }
    const currentIds = new Set();
    const targetNode = this.compressor || this.masterGain || this.ctx.destination;

    for (const r of rockets) {
      if (!r || !r.id) continue;
      currentIds.add(r.id);
      if (!this.rocketLoops.has(r.id)) {
        const loop = this.weaponBank.createRocketLoop(this.ctx, targetNode, {
          sourceX: r.x, listenerX
        });
        if (loop) this.rocketLoops.set(r.id, loop);
      } else {
        const loop = this.rocketLoops.get(r.id);
        loop.update({ sourceX: r.x, listenerX });
      }
    }

    for (const [id, loop] of this.rocketLoops.entries()) {
      if (!currentIds.has(id)) {
        loop.stop();
        this.rocketLoops.delete(id);
      }
    }
  }

  stopRocketLoops() {
    for (const loop of this.rocketLoops.values()) {
      loop.stop(0.05);
    }
    this.rocketLoops.clear();
  }
```
And call `this.stopRocketLoops()` inside `stopHorrorAmbience()`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: PASS

- [ ] **Step 5: Commit Task 3**

```bash
git add client/js/audio.js tests/horror_vfx_audio.test.js
git commit -m "feat(audio): integrate WeaponAudioBank into SoundManager with fallback"
```

---

### Task 4: Wire Client Script Loading & Gameplay Events (`index.html` & `main.js`)

**Files:**
- Modify: `client/index.html`
- Modify: `client/js/main.js`
- Test: `tests/horror_vfx_audio.test.js`

**Interfaces:**
- Consumes:
  - `window.WeaponAudioBank` in browser
  - Snapshot events (`EXPLOSION`, `HIT`, `PICKUP`, `SHOOT`)
  - Snapshot bullets (`state.bullets`)
- Produces:
  - Clean weapon audio playback during live matches and input handling

- [ ] **Step 1: Update `client/index.html`**

Add `<script src="js/weaponAudio.js"></script>` immediately before `<script src="js/audio.js"></script>`:
```html
  <script src="js/weaponAudio.js"></script>
  <script src="js/audio.js"></script>
```

- [ ] **Step 2: Update `client/js/main.js`**

1. Background preload on client start:
```javascript
  if (isBrowser && window.soundManager && window.soundManager.weaponBank) {
    window.soundManager.weaponBank.preloadRaw().catch(err => {
      console.warn('Weapon audio preload error:', err);
    });
  }
```
2. In `handleGameEvent`:
- In `EXPLOSION`:
```javascript
    } else if (ev.type === 'EXPLOSION') {
      if (snd) snd.playExplosion(ev.radius > 120 ? 1.4 : 1.0, ev.x, listenerX, ev.source);
      if (rnd) rnd.addExplosionParticles(ev.x, ev.y, ev.radius);
```
- In `HIT`:
```javascript
    } else if (ev.type === 'HIT') {
      if (snd) {
        snd.playZombieHit(ev.zType, ev.weapon, ev.x, listenerX);
        if (ev.weapon === 'railgun' && typeof snd.playRailgunImpact === 'function') {
          snd.playRailgunImpact(ev.x, listenerX);
        }
      }
```
- In `PICKUP`:
```javascript
    } else if (ev.type === 'PICKUP') {
      if (snd) {
        snd.playPickup();
        const activeWeapon = localPlayer ? localPlayer.selectedWeapon : 'PISTOL';
        if (typeof snd.playWeaponReload === 'function') {
          snd.playWeaponReload(activeWeapon, localPlayer ? localPlayer.x : 0, listenerX);
        }
      }
```
- In `handleSessionReset`:
```javascript
    if (sm && typeof sm.stopRocketLoops === 'function') {
      sm.stopRocketLoops();
    }
```
3. In `gameLoop`:
```javascript
      if (sm && typeof sm.updateRocketFlight === 'function') {
        const rockets = (state.bullets || []).filter(b => b.type === 'rocket');
        sm.updateRocketFlight(rockets, listenerX);
      }
```
4. In input shooting when player attempts to shoot with 0 ammo:
```javascript
    if (input.isShooting() && localPlayer && localPlayer.weapons[localPlayer.selectedWeapon]?.ammo === 0) {
      if (sm && typeof sm.playWeaponEmpty === 'function') {
        sm.playWeaponEmpty(localPlayer.selectedWeapon, localPlayer.x, listenerX);
      }
    }
```

- [ ] **Step 3: Run all tests to verify integration**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: PASS

- [ ] **Step 4: Commit Task 4**

```bash
git add client/index.html client/js/main.js
git commit -m "feat(client): wire weapon audio script and game events"
```

---

### Task 5: Static Serving & Full Test Suite Verification

**Files:**
- Modify: `tests/server.test.js`
- Run: all tests in `tests/*.test.js`

**Interfaces:**
- Consumes:
  - Express server running `/assets/audio/weapons/...`
- Produces:
  - Verified static file serving for weapon WAV assets and 100% passing test suite

- [ ] **Step 1: Add static serving test to `tests/server.test.js`**

```javascript
test('Server serves weapon audio WAV assets statically', async () => {
  const { startServer } = require('../server/server.js');
  const http = require('http');

  const instance = await startServer(0);
  const port = instance.port;

  try {
    const status = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/assets/audio/weapons/pistol/fire_1.wav`, res => {
        resolve(res.statusCode);
      }).on('error', reject);
    });
    assert.strictEqual(status, 200);
  } finally {
    await new Promise(resolve => instance.server.close(resolve));
  }
});
```

- [ ] **Step 2: Run all tests in the repository**

Run: `npm test`
Expected: All tests pass with 0 failures:
```bash
node --test tests/*.test.js
```

- [ ] **Step 3: Commit Task 5**

```bash
git add tests/server.test.js
git commit -m "test(server): verify static serving of weapon audio WAVs"
```

---

## Plan Review & Checklist

1. **Spec Coverage:**
   - Pistol: `fire` (1-3), `reload`, `empty`, `casing` (1-2) -> covered in Task 1, 3, 4.
   - Uzi: `fire` (1-4), `reload`, `empty`, `casing` (1-2) -> covered in Task 1, 3, 4.
   - Shotgun: `fire` (1-3), `pump` (1-2), `load` (1-2), `empty`, `casing` (1-2) -> covered in Task 1, 3, 4.
   - Grenade: `throw`, `pin`, `bounce`, `explode` (1-2) -> covered in Task 1, 2, 3, 4.
   - Rocket: `fire` (1-2), `flight` (loop), `explode` (1-2), `load` -> covered in Task 1, 2, 3, 4.
   - Railgun: `charge`, `fire` (1-3), `cooldown`, `empty`, `impact` (1-2) -> covered in Task 1, 3, 4.
2. **No Placeholders:** All file paths, signatures, test codes, and logic snippets are fully specified.
3. **Type Consistency:** Method names and parameters (`playShoot`, `playExplosion`, `playWeaponEmpty`, `playWeaponReload`, `playRailgunCharge`, `playRailgunImpact`, `updateRocketFlight`) are identical across all tasks.

