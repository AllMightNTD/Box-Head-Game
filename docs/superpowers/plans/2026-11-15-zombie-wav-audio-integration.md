# Zombie WAV Audio Pack Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the 72 synthesized `.wav` zombie sound effects from `audio-zombie/zombie_audio.zip` across all 6 existing zombie types (`NORMAL`, `RUNNER`, `TANK`, `DEVIL`, `MUMMY`, `VAMPIRE`) and all 6 events (`idle`, `aggro`, `attack`, `hit`, `die`, `step`) through `SoundManager`'s spatial stereo, reverb, compressor, and mute pipeline.

**Architecture:** Extract the 72 `.wav` files into `client/assets/audio/zombies/<profile>/<event>_<n>.wav` so Express serves them statically. Add a dedicated `ZombieAudioBank` module (`client/js/zombieAudio.js`) responsible for configurable zombie-to-profile mapping (`ZOMBIE_AUDIO_MAP`), priority-ordered background fetching & Web Audio decoding, polyphony voice budgeting (`maxVoices = 24`), per-event cooldowns, 2D distance attenuation, and per-zombie movement/awareness tracking (`aggro`, `step`, `idle`). Emit `ZOMBIE_ATTACK` events from `server/game/GameRoom.js` on the exact attack tick, wire `ZombieAudioBank` into `SoundManager` (`client/js/audio.js`) with automatic procedural synth fallback when buffers are unloaded or running headless, and update `client/js/main.js` + `client/index.html`.

**Tech Stack:** Node.js (CommonJS), Express static serving, HTML5 Web Audio API (`AudioBufferSourceNode`, `StereoPannerNode`, `ConvolverNode`, `DynamicsCompressorNode`), `node:test` + `node:assert`.

**Spec:** User-confirmed design decisions:
- 1-to-1 configurable mapping (`ZOMBIE_AUDIO_MAP`): `NORMAL -> rotten`, `RUNNER -> ghoul`, `TANK -> mutant`, `DEVIL -> burned`, `MUMMY -> butcher`, `VAMPIRE -> boomer`.
- Full 6-event integration (`idle`, `aggro`, `attack`, `hit`, `die`, `step`) inside `SoundManager` (keeping `createSpatialBus`, `reverbNode`, `compressor`, `muted`, and procedural synth fallback), plus server `ZOMBIE_ATTACK` event in `server/game/GameRoom.js`.
- Source manifest: `audio-zombie/zombie_audio_manifest.json` (44.1 kHz mono 16-bit WAV, `pitch_jitter: [0.94, 1.06]`, per-event volumes `{ idle: 0.55, aggro: 1.0, attack: 0.9, hit: 0.8, die: 1.0, step: 0.45 }`).

---

## Global Constraints

- Do not delete or mutate source assets inside `audio-zombie/`; copy/extract runtime `.wav` files cleanly into `client/assets/audio/zombies/<profile>/<event>_<n>.wav`.
- Zero breaking changes to existing `SoundManager` method signatures (`playZombieHit`, `playZombieDie`, `playZombieGrowl`, `updateHorrorAmbience`, `stopHorrorAmbience`) or `createSpatialBus` / `computeStereoPan` / `computeDistanceGain` behavior.
- All Web Audio, `fetch`, `window`, and `performance` usage in `client/js/zombieAudio.js` and `client/js/audio.js` must guard against missing browser globals so Node.js unit tests run cleanly without mocking network sockets.
- Strict audio voice & RAM discipline: `maxVoices = 24` (ambient `step`/`idle` yield above `18` active voices), discard raw `ArrayBuffer`s immediately after `decodeAudioData`, deduplicate concurrent `preloadRaw` / `decodeAll` calls, and cap background fetches to concurrency `6`.
- Clean Code (`GEMINI.md`): Single-responsibility methods ideally under 30–40 lines, guard clauses (early returns), no empty `catch` blocks (log warnings with context and degrade cleanly to procedural synth).

## Review Focus

1. **Unloaded WAVs / Offline / Headless Node Fallback:** Calling `playZombieHit`, `playZombieDie`, `playZombieAttack`, `playZombieGrowl`, or `updateHorrorAmbience` when `fetch` or `AudioContext` is absent or buffers have not finished decoding must never throw and must fall back cleanly to procedural synthesis. (Pinned in Task 1 & Task 3)
2. **Multi-Hit / Multi-Kill Voice Saturation (Shotgun, Railgun, Explosions):** Triggering 30+ simultaneous `hit`/`die`/`step` calls must stay strictly `<= maxVoices` (`24`), respect cooldown throttles, and reserve headroom for high-priority events (`die`, `attack`, `aggro`) by dropping `step`/`idle` at `>= 18` active voices. (Pinned in Task 1 & Task 3)
3. **Unknown Zombie Types & Non-Finite Coordinates:** Passing `undefined`, `null`, unknown `zType`, or `NaN` / `Infinity` positions to `resolveProfile`, `compute2DDistanceGain`, or `playSample` must clamp safely to finite gains (`[0, 1]`) and default profile `'rotten'` without passing `NaN` into `AudioParam`. (Pinned in Task 1)
4. **Ghost Footsteps / Duplicate Aggro / Zombie State Leaks:** Frozen (`isFrozen`), stunned (`isStunned`), or teleporting (`dist > 150px`) zombies must never trigger `step` sounds; each zombie ID must trigger `aggro` at most once; dead/removed zombie IDs must be pruned each update and all state cleared on `stopHorrorAmbience()`. (Pinned in Task 1 & Task 3)
5. **Concurrent Preload & Partial Fetch Failure Resilience:** Calling `preloadRaw()` / `decodeAll()` multiple times must share one in-flight promise per phase, and a single 404 or `decodeAudioData` failure must log via `console.warn` without aborting the remaining 71 `.wav` files. (Pinned in Task 1)

## File Structure & Data Flow

| Action | Path | Responsibility |
| :--- | :--- | :--- |
| Create (extract) | `client/assets/audio/zombies/<profile>/<event>_<n>.wav` (72 files) | Runtime mono 44.1 kHz WAV assets served statically by Express at `/assets/audio/zombies/...`. |
| Create | `client/js/zombieAudio.js` | `ZOMBIE_AUDIO_MAP` config, manifest counts/volumes, `ZombieAudioBank` preloader/decoder, polyphony/cooldown limiter, 2D attenuation, and per-zombie `aggro`/`step`/`idle` tracker. |
| Modify | `server/game/GameRoom.js` | Emit `{ type: 'ZOMBIE_ATTACK', zombieId, zType, x, y, attackKind }` when `z.isAttacking` is true on `tick(dt)` (plus include `zombieId` on `HIT`). |
| Modify | `client/js/audio.js` | Integrate `ZombieAudioBank` into `SoundManager`: preload on `init()`, route WAV playback through `createSpatialBus`, add `playZombieAttack`/`playZombieAggro`/`playZombieStep`, upgrade `playZombieHit`/`playZombieDie`/`playZombieGrowl`/`updateAmbienceGrowls`/`stopHorrorAmbience` with synth fallback. |
| Modify | `client/index.html` | Load `<script src="js/zombieAudio.js"></script>` before `js/audio.js`. |
| Modify | `client/js/main.js` | Prefetch zombie WAVs on startup & `room:gameStarted`; handle `ZOMBIE_ATTACK`; pass 2D coordinates (`ev.y`, `listenerY`, `ev.zombieId`) to `SoundManager`. |
| Create | `tests/zombie_audio_bank.test.js` | Unit & asset verification tests for all 72 `.wav` files and `ZombieAudioBank` edge cases. |
| Modify | `tests/game_room.test.js` | Verify `ZOMBIE_ATTACK` emission for melee, Devil ranged fireball, and frozen/stunned suppression. |
| Modify | `tests/horror_vfx_audio.test.js` | Verify `SoundManager` WAV routing through spatial bus, mute/fallback, `ZOMBIE_ATTACK` in `main.js`. |
| Modify | `tests/server.test.js` | Verify Express serves `/assets/audio/zombies/rotten/idle_1.wav` with HTTP `200`. |

**Data Flow:**
- **Startup / Match Start:** `main.js` starts background `preloadZombieAudio()` (`preloadRaw`, max 6 concurrent fetches). On first user gesture / `room:gameStarted`, `SoundManager.init()` creates `AudioContext` and calls `zombieBank.decodeAll(ctx)` (priority order: `rotten`, `ghoul`, `mutant`, `burned`, `butcher`, `boomer`), freeing raw `ArrayBuffer`s as each file decodes.
- **Discrete Events (`HIT`, `ZOMBIE_DIE`, `ZOMBIE_ATTACK`):** `GameRoom.tick()` pushes events into `snapshot.events` -> `main.js` `handleGameEvent()` resolves local player `(listenerX, listenerY)` -> `SoundManager` routes decoded WAV (or synth fallback if not yet loaded) through `createSpatialBus(sourceX, listenerX, reverbSend)` -> `StereoPannerNode` -> `DynamicsCompressorNode` -> `masterGain` -> `ctx.destination`.
- **Continuous Per-Frame Events (`aggro`, `step`, `idle`):** `main.js` `gameLoop()` -> `SoundManager.updateHorrorAmbience(dt, state)` -> `ZombieAudioBank.updateZombies(dt, state, playCb)` evaluates distance (`<= maxDist`), movement delta, freeze/stun flags, and global/voice budgets.

**Performance & Risk Assessment:**
- *Memory:* 72 WAVs total ~6.2 MB uncompressed (~100 KB avg). Decoding directly and discarding `rawBuffers` prevents duplicate 12.4 MB retention.
- *Network:* Priority ordering loads Wave 1–2 zombies (`rotten`, `ghoul`) first over LAN (`<50ms` local), with seamless synth fallback while loading.
- *CPU/Audio Thread:* `canPlayEvent` runs **before** creating `GainNode`/`StereoPannerNode` so throttled hits/steps allocate zero Web Audio nodes.

---

### Task 1: Extract Runtime Zombie WAV Assets & Implement `ZombieAudioBank`

**Files:**
- Create (extract): `client/assets/audio/zombies/{rotten,ghoul,mutant,burned,butcher,boomer}/*.wav` (72 files from `audio-zombie/zombie_audio.zip`)
- Create: `client/js/zombieAudio.js`
- Test: `tests/zombie_audio_bank.test.js`

**Interfaces:**
- Consumes:
  - `audio-zombie/zombie_audio.zip` entries (`audio/<profile>/<event>_<n>.wav`)
  - `audio-zombie/zombie_audio_manifest.json` structure
- Produces (`client/js/zombieAudio.js`, exported via `module.exports` and attached to `window`):
  - `ZOMBIE_AUDIO_MAP`: `{ NORMAL: 'rotten', RUNNER: 'ghoul', TANK: 'mutant', DEVIL: 'burned', MUMMY: 'butcher', VAMPIRE: 'boomer' }`
  - `ZOMBIE_SFX_COUNTS`: `{ idle: 3, aggro: 1, attack: 2, hit: 2, die: 1, step: 3 }`
  - `ZOMBIE_SFX_VOLUMES`: `{ idle: 0.55, aggro: 1.0, attack: 0.9, hit: 0.8, die: 1.0, step: 0.45 }`
  - `ZOMBIE_STEP_STRIDE`: `{ NORMAL: 58, RUNNER: 48, TANK: 68, DEVIL: 60, MUMMY: 68, VAMPIRE: 52 }`
  - `ZOMBIE_EVENT_MAX_DIST`: `{ idle: 650, aggro: 680, attack: 900, hit: 1000, die: 1050, step: 460 }`
  - `class ZombieAudioBank`:
    - `constructor(options?: { basePath?: string, maxVoices?: number, nowFn?: () => number, fetchFn?: Function })`
    - `resolveProfile(zType?: string) -> string`
    - `getAllAssetEntries() -> Array<{ profile: string, event: string, index: number, key: string, url: string }>`
    - `preloadRaw(concurrency?: number) -> Promise<number>`
    - `decodeAll(ctx: AudioContext) -> Promise<number>`
    - `hasBuffer(zType: string, event: string) -> boolean`
    - `hasAnyBuffers() -> boolean`
    - `compute2DDistanceGain(sourceX?: number, sourceY?: number, listenerX?: number, listenerY?: number, maxDist?: number) -> number`
    - `canPlayEvent(event: string, zombieId?: string) -> boolean`
    - `playSample(ctx: AudioContext, destNode: AudioNode, zType: string, event: string, options?: { x?: number, y?: number, listenerX?: number, listenerY?: number, maxDist?: number, volume?: number, pitch?: number, zombieId?: string }) -> boolean`
    - `updateZombies(dt: number, state: { localPlayer?: object, zombies?: Array }, onTrigger: (zombie: object, event: string) => void) -> void`
    - `reset() -> void`

- [ ] **Step 1: Extract the 72 `.wav` files from `audio-zombie/zombie_audio.zip` into `client/assets/audio/zombies/`**

Extract every `audio/<profile>/<file>.wav` entry from `audio-zombie/zombie_audio.zip` stripping the leading `audio/` segment so files live at `client/assets/audio/zombies/<profile>/<file>.wav` (keeping `audio-zombie/zombie_audio.zip` intact):
```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("D:\Box-Head-Game\audio-zombie\zombie_audio.zip")
try {
  foreach ($entry in $zip.Entries) {
    if ($entry.FullName -like "audio/*.wav") {
      $rel = $entry.FullName.Substring(6)
      $dest = Join-Path "D:\Box-Head-Game\client\assets\audio\zombies" $rel
      $dir = Split-Path $dest -Parent
      if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true)
    }
  }
} finally {
  $zip.Dispose()
}
```

- [ ] **Step 2: Write the failing test suite in `tests/zombie_audio_bank.test.js`**

Create `tests/zombie_audio_bank.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ZombieAudioBank,
  ZOMBIE_AUDIO_MAP,
  ZOMBIE_SFX_COUNTS,
  ZOMBIE_SFX_VOLUMES
} = require('../client/js/zombieAudio.js');

test('All 72 zombie WAV files exist on disk under client/assets/audio/zombies matching manifest counts', () => {
  const expectedMap = {
    NORMAL: 'rotten',
    RUNNER: 'ghoul',
    TANK: 'mutant',
    DEVIL: 'burned',
    MUMMY: 'butcher',
    VAMPIRE: 'boomer'
  };
  assert.deepEqual(ZOMBIE_AUDIO_MAP, expectedMap);
  assert.deepEqual(ZOMBIE_SFX_COUNTS, { idle: 3, aggro: 1, attack: 2, hit: 2, die: 1, step: 3 });
  assert.deepEqual(ZOMBIE_SFX_VOLUMES, { idle: 0.55, aggro: 1.0, attack: 0.9, hit: 0.8, die: 1.0, step: 0.45 });

  let totalFiles = 0;
  for (const profile of Object.values(ZOMBIE_AUDIO_MAP)) {
    for (const [ev, count] of Object.entries(ZOMBIE_SFX_COUNTS)) {
      for (let i = 1; i <= count; i++) {
        const filePath = path.join(__dirname, '..', 'client', 'assets', 'audio', 'zombies', profile, `${ev}_${i}.wav`);
        assert.ok(fs.existsSync(filePath), `Missing WAV asset: ${filePath}`);
        const stat = fs.statSync(filePath);
        assert.ok(stat.size > 44, `WAV asset appears empty/corrupt: ${filePath}`);
        totalFiles++;
      }
    }
  }
  assert.equal(totalFiles, 72);
});

test('ZombieAudioBank.resolveProfile and compute2DDistanceGain handle invalid inputs safely', () => {
  const bank = new ZombieAudioBank();
  assert.equal(bank.resolveProfile('NORMAL'), 'rotten');
  assert.equal(bank.resolveProfile('runner'), 'ghoul');
  assert.equal(bank.resolveProfile('TANK'), 'mutant');
  assert.equal(bank.resolveProfile('DEVIL'), 'burned');
  assert.equal(bank.resolveProfile('MUMMY'), 'butcher');
  assert.equal(bank.resolveProfile('VAMPIRE'), 'boomer');
  assert.equal(bank.resolveProfile('UNKNOWN_BOSS'), 'rotten');
  assert.equal(bank.resolveProfile(null), 'rotten');
  assert.equal(bank.resolveProfile(undefined), 'rotten');

  assert.equal(bank.compute2DDistanceGain(undefined, undefined, 800, 600, 700), 1);
  assert.equal(bank.compute2DDistanceGain(NaN, 600, 800, 600, 700), 1);
  assert.equal(bank.compute2DDistanceGain(800, 600, 800, 600, 700), 1);
  assert.equal(bank.compute2DDistanceGain(800, 1600, 800, 600, 700), 0);
  assert.ok(Math.abs(bank.compute2DDistanceGain(1100, 1000, 800, 600, 1000) - 0.5) < 1e-6);
});

test('ZombieAudioBank.decodeAll deduplicates concurrent calls, frees rawBuffers, and survives partial failures', async () => {
  let fetchCount = 0;
  const mockFetch = async (url) => {
    fetchCount++;
    if (url.includes('boomer/die_1.wav')) {
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    }
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(16) };
  };
  const mockCtx = {
    decodeAudioData: async (buf) => {
      if (buf.byteLength === 0) throw new Error('empty');
      return { duration: 0.4, length: 17640 };
    }
  };

  const bank = new ZombieAudioBank({ fetchFn: mockFetch });
  const [count1, count2] = await Promise.all([bank.decodeAll(mockCtx), bank.decodeAll(mockCtx)]);

  assert.equal(fetchCount, 72);
  assert.equal(count1, 71);
  assert.equal(count2, 71);
  assert.equal(bank.rawBuffers.size, 0, 'rawBuffers must be cleared after decode to save RAM');
  assert.equal(bank.hasBuffer('NORMAL', 'hit'), true);
  assert.equal(bank.hasBuffer('VAMPIRE', 'die'), false);

  // Absent fetchFn in headless Node must resolve cleanly with 0
  const headlessBank = new ZombieAudioBank({ fetchFn: null });
  const headlessCount = await headlessBank.decodeAll(mockCtx);
  assert.equal(headlessCount, 0);
});

test('ZombieAudioBank.playSample enforces maxVoices, ambient headroom, cooldowns, and single voice decrement', () => {
  let now = 1000;
  const endedCallbacks = [];
  const createdSources = [];
  const mockCtx = {
    currentTime: 5,
    createBufferSource: () => {
      const node = {
        buffer: null,
        playbackRate: { value: 1 },
        onended: null,
        connect: () => node,
        start: () => { endedCallbacks.push(() => node.onended && node.onended()); }
      };
      createdSources.push(node);
      return node;
    },
    createGain: () => ({
      gain: { value: 1, setValueAtTime: function (v) { this.value = v; } },
      connect: () => {}
    })
  };
  const destNode = {};

  const bank = new ZombieAudioBank({ maxVoices: 4, nowFn: () => now });
  bank.buffers.set('rotten/hit', [{ duration: 0.2 }]);
  bank.buffers.set('rotten/step', [{ duration: 0.2 }]);
  bank.buffers.set('mutant/die', [{ duration: 1.0 }]);

  // Ambient step blocked when activeVoices >= floor(4 * 0.75) = 3
  bank.activeVoices = 3;
  assert.equal(bank.playSample(mockCtx, destNode, 'NORMAL', 'step', { x: 800, y: 600, listenerX: 800, listenerY: 600 }), false);
  // High-priority die still succeeds up to maxVoices = 4
  assert.equal(bank.playSample(mockCtx, destNode, 'TANK', 'die', { x: 800, y: 600, listenerX: 800, listenerY: 600 }), true);
  assert.equal(bank.activeVoices, 4);
  // Further playback blocked at maxVoices
  assert.equal(bank.playSample(mockCtx, destNode, 'NORMAL', 'hit', { x: 800, y: 600, listenerX: 800, listenerY: 600 }), false);

  // Calling onended twice only decrements once
  bank.activeVoices = 1;
  assert.equal(bank.playSample(mockCtx, destNode, 'NORMAL', 'hit', { x: 800, y: 600, listenerX: 800, listenerY: 600 }), true);
  assert.equal(bank.activeVoices, 2);
  const lastCb = endedCallbacks[endedCallbacks.length - 1];
  lastCb();
  lastCb();
  assert.equal(bank.activeVoices, 1);

  // Hit cooldown throttling (55ms)
  assert.equal(bank.playSample(mockCtx, destNode, 'NORMAL', 'hit', { x: 800, y: 600, listenerX: 800, listenerY: 600 }), false);
  now += 60;
  assert.equal(bank.playSample(mockCtx, destNode, 'NORMAL', 'hit', { x: 800, y: 600, listenerX: 800, listenerY: 600 }), true);

  // Pitch jitter strictly inside [0.94, 1.06]
  const rate = createdSources[createdSources.length - 1].playbackRate.value;
  assert.ok(rate >= 0.94 && rate <= 1.06, `Expected pitch in [0.94, 1.06], got ${rate}`);
});

test('ZombieAudioBank.updateZombies triggers aggro once, ignores frozen/stunned/teleport steps, and prunes dead zombies', () => {
  const bank = new ZombieAudioBank();
  const triggers = [];
  const onTrigger = (z, ev) => triggers.push({ id: z.id, ev });

  const localPlayer = { x: 500, y: 500 };

  // Frame 1: z1 enters aggro range (<= 680px), z2 is frozen
  bank.updateZombies(0.05, {
    localPlayer,
    zombies: [
      { id: 'z1', type: 'NORMAL', x: 600, y: 500, isFrozen: false, isStunned: false },
      { id: 'z2', type: 'RUNNER', x: 550, y: 500, isFrozen: true, isStunned: false }
    ]
  }, onTrigger);

  assert.equal(triggers.filter(t => t.id === 'z1' && t.ev === 'aggro').length, 1);
  assert.equal(triggers.filter(t => t.ev === 'step').length, 0);

  // Frame 2: z1 walks 60px (> stride 58px) -> emits step; z2 moves while frozen -> no step
  bank.updateZombies(0.05, {
    localPlayer,
    zombies: [
      { id: 'z1', type: 'NORMAL', x: 540, y: 500, isFrozen: false, isStunned: false },
      { id: 'z2', type: 'RUNNER', x: 480, y: 500, isFrozen: true, isStunned: false }
    ]
  }, onTrigger);

  assert.equal(triggers.filter(t => t.id === 'z1' && t.ev === 'aggro').length, 1, 'aggro must fire only once per zombie');
  assert.equal(triggers.filter(t => t.id === 'z1' && t.ev === 'step').length, 1);
  assert.equal(triggers.filter(t => t.id === 'z2' && t.ev === 'step').length, 0);

  // Frame 3: z1 teleports >150px -> ignored for step; z2 removed -> pruned
  bank.updateZombies(0.05, {
    localPlayer,
    zombies: [{ id: 'z1', type: 'NORMAL', x: 100, y: 500, isFrozen: false, isStunned: false }]
  }, onTrigger);
  assert.equal(triggers.filter(t => t.id === 'z1' && t.ev === 'step').length, 1);
  assert.equal(bank.zombieStates.has('z2'), false, 'Removed zombie must be pruned');

  bank.reset();
  assert.equal(bank.zombieStates.size, 0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/zombie_audio_bank.test.js`
Expected: FAIL with `Cannot find module '../client/js/zombieAudio.js'`.

- [ ] **Step 4: Implement `client/js/zombieAudio.js`**

Implement `client/js/zombieAudio.js` following the exact `Interfaces:` block:
- Define `ZOMBIE_AUDIO_MAP`, `ZOMBIE_SFX_COUNTS`, `ZOMBIE_SFX_VOLUMES`, `ZOMBIE_STEP_STRIDE`, `ZOMBIE_EVENT_MAX_DIST`, `ZOMBIE_PROFILE_ORDER = ['rotten', 'ghoul', 'mutant', 'burned', 'butcher', 'boomer']`, and `EVENT_COOLDOWNS_MS = { hit: 55, die: 50, attack: 70, aggro: 1200, idle: 1800, step: 140 }`.
- Implement `ZombieAudioBank`:
  - `preloadRaw(concurrency = 6)` runs a bounded worker pool over `getAllAssetEntries()`, caching `this.rawBuffers` only when `!this.buffers.has(...)` and logging failures with `console.warn`.
  - `decodeAll(ctx)` guards `!ctx || typeof ctx.decodeAudioData !== 'function'`, deduplicates via `this.decodePromise` when `this.decodeCtx === ctx` (resets only if a different `ctx` is passed), fetches/uses `rawBuffers` with bounded concurrency `6`, deletes each entry from `this.rawBuffers` immediately after `ctx.decodeAudioData(arr.slice ? arr.slice(0) : arr)`, stores decoded `AudioBuffer` into `this.buffers`, and returns count of decoded assets.
  - `playSample` checks `!ctx || !destNode || !this.hasBuffer(zType, event)` and `canPlayEvent`, calculates `2D` distance gain * volume, checks `gain >= 0.01`, creates buffer source + gain node with separate `src.connect(gainNode); gainNode.connect(destNode);` calls (compatible with non-chaining mock nodes), tracks `activeVoices` with an idempotent `ended` flag inside `src.onended`, and starts playback.
  - `updateZombies(dt, state, onTrigger)` returns early if `!state || !state.localPlayer`, tracks per-zombie `{ lastX, lastY, stepDist, idleTimer, hasAggroed, lastAttackAt }` in `this.zombieStates`, prunes dead/missing IDs, fires `aggro` once when entering `ZOMBIE_EVENT_MAX_DIST.aggro`, accumulates movement distance (`<= 150px` per tick, skipping frozen/stunned) for `step`, and ticks `idleTimer` (`3.5–8.5s` reset) for `idle`.
- Export `{ ZombieAudioBank, ZOMBIE_AUDIO_MAP, ZOMBIE_SFX_COUNTS, ZOMBIE_SFX_VOLUMES, ZOMBIE_STEP_STRIDE, ZOMBIE_EVENT_MAX_DIST }` on `module.exports` and attach to `window` when defined.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/zombie_audio_bank.test.js`
Expected: PASS (5 tests pass, 72 WAV assets verified).

- [ ] **Step 6: Commit**

```bash
git add client/assets/audio/zombies client/js/zombieAudio.js tests/zombie_audio_bank.test.js
git commit -m "feat(audio): extract 72 zombie WAV assets and implement ZombieAudioBank"
```

---

### Task 2: Emit Server `ZOMBIE_ATTACK` Events from `GameRoom`

**Files:**
- Modify: `server/game/GameRoom.js:494-502`
- Modify: `server/game/GameRoom.js:571-583`
- Test: `tests/game_room.test.js`

**Interfaces:**
- Consumes: `Zombie.prototype.isAttacking`, `Zombie.prototype.id`, `Zombie.prototype.type`, `Zombie.prototype.x`, `Zombie.prototype.y` set during `Zombie.prototype.update(...)` (`server/game/Zombie.js:139-286`).
- Produces in `room.eventsBuffer`:
  - `ZOMBIE_ATTACK`: `{ type: 'ZOMBIE_ATTACK', zombieId: string, zType: string, x: number, y: number, attackKind: 'ranged' | 'melee' }`
  - `HIT`: existing payload plus `zombieId: z.id`.

- [ ] **Step 1: Write the failing test in `tests/game_room.test.js`**

Append to `tests/game_room.test.js`:
```js
test('GameRoom emits ZOMBIE_ATTACK for melee and Devil ranged attacks and suppresses when frozen', (t) => {
  const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
  const room = new GameRoom('room-z-attack', 'Zombie Attack', mockIo);
  t.after(() => room.stop());

  const p = room.addPlayer('p1', 'Alice', 'HUMAN');
  room.startGame();
  p.x = 500;
  p.y = 500;

  const { Zombie } = require('../server/game/Zombie.js');
  const meleeZ = new Zombie('z_melee', 'NORMAL', 515, 500);
  meleeZ.attackCooldown = 0;
  const devilZ = new Zombie('z_devil', 'DEVIL', 750, 500);
  devilZ.attackCooldown = 0;
  const frozenZ = new Zombie('z_frozen', 'RUNNER', 515, 500);
  frozenZ.attackCooldown = 0;
  frozenZ.applyFreeze(2.0);
  room.zombies.push(meleeZ, devilZ, frozenZ);

  const snapshots = [];
  room.io = {
    to: () => ({ emit: (ev, data) => { if (ev === 'game:snapshot') snapshots.push(data); } })
  };

  room.tick(0.02);
  room.tick(0.02);

  const tick1Events = snapshots[0].events.filter(e => e.type === 'ZOMBIE_ATTACK');
  const tick2Events = snapshots[1].events.filter(e => e.type === 'ZOMBIE_ATTACK');

  const meleeEv = tick1Events.find(e => e.zombieId === 'z_melee');
  const devilEv = tick1Events.find(e => e.zombieId === 'z_devil');
  const frozenEv = tick1Events.find(e => e.zombieId === 'z_frozen');

  assert.ok(meleeEv, 'Expected melee ZOMBIE_ATTACK event');
  assert.strictEqual(meleeEv.zType, 'NORMAL');
  assert.strictEqual(meleeEv.attackKind, 'melee');
  assert.strictEqual(typeof meleeEv.x, 'number');
  assert.strictEqual(typeof meleeEv.y, 'number');

  assert.ok(devilEv, 'Expected devil ranged ZOMBIE_ATTACK event');
  assert.strictEqual(devilEv.zType, 'DEVIL');
  assert.strictEqual(devilEv.attackKind, 'ranged');

  assert.strictEqual(frozenEv, undefined, 'Frozen zombie must not emit ZOMBIE_ATTACK');
  assert.strictEqual(tick2Events.length, 0, 'Cooldown tick must not repeat ZOMBIE_ATTACK');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/game_room.test.js`
Expected: FAIL on `Expected melee ZOMBIE_ATTACK event`.

- [ ] **Step 3: Emit `ZOMBIE_ATTACK` and add `zombieId` to `HIT` in `server/game/GameRoom.js`**

1. In `GameRoom.prototype.tick` (`server/game/GameRoom.js` lines 494-501), add `zombieId: z.id` to the `HIT` event object.
2. In `GameRoom.prototype.tick` right after `z.update(dt, playersArr, this.barricades, this.map, newBulletsFromZombies);` (around line 579):
   If `z.isAttacking`, push `{ type: 'ZOMBIE_ATTACK', zombieId: z.id, zType: z.type, x: Math.round(z.x), y: Math.round(z.y), attackKind: z.type === 'DEVIL' ? 'ranged' : 'melee' }` onto `this.eventsBuffer`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/game_room.test.js`
Expected: PASS (all tests in `tests/game_room.test.js` pass).

- [ ] **Step 5: Commit**

```bash
git add server/game/GameRoom.js tests/game_room.test.js
git commit -m "feat(server): emit ZOMBIE_ATTACK events for zombie melee and Devil ranged attacks"
```

---

### Task 3: Integrate `ZombieAudioBank` into `SoundManager` (`client/js/audio.js`)

**Files:**
- Modify: `client/js/audio.js:1-93`
- Modify: `client/js/audio.js:371-498`
- Modify: `client/js/audio.js:702-802`
- Test: `tests/horror_vfx_audio.test.js`

**Interfaces:**
- Consumes: `ZombieAudioBank`, `ZOMBIE_EVENT_MAX_DIST` from `client/js/zombieAudio.js` (Task 1) via `require('./zombieAudio.js')` in CommonJS or `window` in browser.
- Produces on `SoundManager.prototype`:
  - `preloadZombieAudio() -> Promise<number>` (prefetches raw WAVs before `AudioContext` exists, or decodes into `this.ctx` once initialized)
  - `playZombieSample(zType: string, event: string, sourceX?: number, sourceY?: number, listenerX?: number, listenerY?: number, options?: { reverbSend?: number, zombieId?: string, volume?: number }) -> boolean`
  - `playZombieHit(zType?: string, weapon?: string, sourceX?: number, listenerX?: number, sourceY?: number, listenerY?: number, zombieId?: string) -> void`
  - `playZombieDie(zType?: string, sourceX?: number, listenerX?: number, sourceY?: number, listenerY?: number, zombieId?: string) -> void`
  - `playZombieAttack(zType?: string, sourceX?: number, listenerX?: number, sourceY?: number, listenerY?: number, zombieId?: string, attackKind?: string) -> boolean`
  - `playZombieAggro(zType?: string, sourceX?: number, listenerX?: number, sourceY?: number, listenerY?: number, zombieId?: string) -> boolean`
  - `playZombieStep(zType?: string, sourceX?: number, listenerX?: number, sourceY?: number, listenerY?: number, zombieId?: string) -> boolean`
  - `playZombieGrowl(zType?: string, sourceX?: number, listenerX?: number, sourceY?: number, listenerY?: number, zombieId?: string) -> boolean`

- [ ] **Step 1: Write the failing tests in `tests/horror_vfx_audio.test.js`**

Append to `tests/horror_vfx_audio.test.js`:
```js
test('SoundManager routes zombie WAV buffers through spatial bus and falls back to synth when unloaded', () => {
  let bufferSourcesStarted = 0;
  let oscillatorsStarted = 0;

  const baseCtx = createMockAudioContext();
  const origCreateBufSrc = baseCtx.createBufferSource;
  const origCreateOsc = baseCtx.createOscillator;
  baseCtx.createBufferSource = () => {
    const n = origCreateBufSrc();
    n.start = () => { bufferSourcesStarted++; };
    return n;
  };
  baseCtx.createOscillator = () => {
    const n = origCreateOsc();
    n.start = () => { oscillatorsStarted++; };
    return n;
  };

  const sm = new SoundManager();
  sm.ctx = baseCtx;
  sm.setupAudioGraph();
  sm.initialized = true;

  // 1. Unloaded WAVs -> synth fallback (no throws)
  assert.strictEqual(sm.playZombieAttack('DEVIL', 900, 800, 600, 600, 'z_d1', 'ranged'), true);
  assert.ok(oscillatorsStarted >= 1, 'Devil attack without WAV buffer should fall back to synth');

  // 2. Load mock decoded WAV buffers for all 6 events on TANK (mutant) & NORMAL (rotten)
  bufferSourcesStarted = 0;
  oscillatorsStarted = 0;
  for (const ev of ['idle', 'aggro', 'attack', 'hit', 'die', 'step']) {
    sm.zombieBank.buffers.set(`mutant/${ev}`, [{ duration: 0.5 }]);
    sm.zombieBank.buffers.set(`rotten/${ev}`, [{ duration: 0.5 }]);
  }

  sm.playZombieHit('TANK', 'PISTOL', 850, 800, 610, 600, 'z_t1');
  sm.playZombieDie('TANK', 850, 800, 610, 600, 'z_t1');
  assert.strictEqual(sm.playZombieAttack('TANK', 850, 800, 610, 600, 'z_t1', 'melee'), true);
  assert.strictEqual(sm.playZombieAggro('TANK', 850, 800, 610, 600, 'z_t1'), true);
  assert.strictEqual(sm.playZombieStep('TANK', 850, 800, 610, 600, 'z_t1'), true);
  sm.lastGrowlTime = -Infinity;
  assert.strictEqual(sm.playZombieGrowl('NORMAL', 850, 800, 610, 600, 'z_n1'), true);
  assert.strictEqual(sm.playZombieGrowl('NORMAL', 850, 800, 610, 600, 'z_n2'), false, 'Growl throttle must still apply with WAV');

  assert.strictEqual(bufferSourcesStarted, 6, 'All 6 zombie WAV events must play via AudioBufferSourceNode');
  assert.strictEqual(oscillatorsStarted, 0, 'Synth oscillators must not trigger when WAV buffers are present');

  // 3. Muted prevents WAV playback
  bufferSourcesStarted = 0;
  sm.muted = true;
  assert.strictEqual(sm.playZombieAttack('TANK', 850, 800, 610, 600, 'z_t2', 'melee'), false);
  assert.strictEqual(bufferSourcesStarted, 0);

  // 4. stopHorrorAmbience clears zombieBank tracking state
  sm.muted = false;
  sm.updateHorrorAmbience(0.05, {
    isInGame: true,
    wave: 2,
    localPlayer: { x: 800, y: 600, hp: 100, maxHp: 100 },
    zombies: [{ id: 'z_amb', type: 'NORMAL', x: 850, y: 600, isDead: false }]
  });
  assert.strictEqual(sm.zombieBank.zombieStates.has('z_amb'), true);
  sm.stopHorrorAmbience();
  assert.strictEqual(sm.zombieBank.zombieStates.size, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: FAIL with `sm.playZombieAttack is not a function`.

- [ ] **Step 3: Integrate `ZombieAudioBank` into `client/js/audio.js`**

1. Import `ZombieAudioBank` and `ZOMBIE_EVENT_MAX_DIST` at the top of `client/js/audio.js` cleanly for both Node (`require('./zombieAudio.js')`) and Browser (`window.ZombieAudioBank`).
2. In `SoundManager.constructor(options = {})`: instantiate `this.zombieBank = options.zombieBank || (ZombieAudioBank ? new ZombieAudioBank(options) : null);`.
3. In `SoundManager.init()`: call `this.preloadZombieAudio()` (fire-and-forget safe promise).
4. Add `preloadZombieAudio()` calling `decodeAll(this.ctx)` when `this.ctx` exists or `preloadRaw()` otherwise, logging warnings on rejection without throwing.
5. Add `playZombieSample(zType, event, sourceX, sourceY, listenerX, listenerY, extra = {})`:
   - Early return `false` if `this.muted`, no `this.zombieBank`, or `!this.zombieBank.hasBuffer(zType, event)`.
   - Call `this.ensureContext()`; early return `false` if `!this.ctx`.
   - Early return `false` if `!this.zombieBank.canPlayEvent(event, extra.zombieId)` (avoids creating unused spatial Web Audio nodes on throttled events).
   - Build spatial bus `this.createSpatialBus(sourceX, listenerX, extra.reverbSend ?? 0.2)`.
   - Delegate to `this.zombieBank.playSample(this.ctx, bus.input, zType, event, { x: sourceX, y: sourceY, listenerX, listenerY, maxDist: ZOMBIE_EVENT_MAX_DIST[event], zombieId: extra.zombieId, volume: extra.volume })`.
6. Update `playZombieHit`, `playZombieDie`, `playZombieGrowl` and add `playZombieAttack`, `playZombieAggro`, `playZombieStep`:
   - `playZombieHit`: if `hasBuffer(zType, 'hit')`, call `playZombieSample(..., 'hit', ..., { reverbSend: 0.16, zombieId })` and return (suppresses duplicate synth when throttled); otherwise run existing synth hit.
   - `playZombieDie`: if `hasBuffer(zType, 'die')`, call `playZombieSample(..., 'die', ..., { reverbSend: 0.28, zombieId })` and return; otherwise run existing FM groan synth.
   - `playZombieAttack`: if `this.muted` return `false`; if `hasBuffer(zType, 'attack')`, return `playZombieSample(..., 'attack', ..., { reverbSend: 0.18, zombieId })`; else if `zType === 'DEVIL' || attackKind === 'ranged'`, call `this.playDevilFireball()` and return `true`; else return `false`.
   - `playZombieAggro`: if `hasBuffer(zType, 'aggro')`, return `playZombieSample(..., 'aggro', ..., { reverbSend: 0.28, zombieId })`; else return `this.playZombieGrowl(zType, sourceX, listenerX)`.
   - `playZombieStep`: if `hasBuffer(zType, 'step')`, return `playZombieSample(..., 'step', ..., { reverbSend: 0.08, zombieId })`; else return `false`.
   - `playZombieGrowl`: keep existing `1800ms` cooldown check (`now - this.lastGrowlTime < 1800`); if `hasBuffer(zType, 'idle')`, update `this.lastGrowlTime = now` only when `playZombieSample(..., 'idle', ..., { reverbSend: 0.25, zombieId })` succeeds (or return `false` if blocked); otherwise run existing `synth*Growl`.
7. Update `updateAmbienceGrowls(dt, state)`:
   - When `this.zombieBank && this.zombieBank.hasAnyBuffers()`: run `this.zombieBank.updateZombies(dt, state, (z, ev) => ...)` dispatching `'aggro'` -> `playZombieAggro`, `'step'` -> `playZombieStep`, `'idle'` -> `playZombieGrowl`.
   - Otherwise keep existing nearest-zombie synth growl fallback.
8. Update `stopHorrorAmbience()`: call `if (this.zombieBank) this.zombieBank.reset();` cleanly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/horror_vfx_audio.test.js tests/zombie_audio_bank.test.js`
Expected: PASS (all tests in both suites pass).

- [ ] **Step 5: Commit**

```bash
git add client/js/audio.js tests/horror_vfx_audio.test.js
git commit -m "feat(audio): integrate ZombieAudioBank WAV playback and synth fallback into SoundManager"
```

---

### Task 4: Wire Script Tag, Preload, `ZOMBIE_ATTACK`, and HTTP Serving Verification

**Files:**
- Modify: `client/index.html:260-265`
- Modify: `client/js/main.js:1-10`
- Modify: `client/js/main.js:260-276`
- Modify: `client/js/main.js:367-413`
- Test: `tests/horror_vfx_audio.test.js`
- Test: `tests/server.test.js`

**Interfaces:**
- Consumes:
  - `ZOMBIE_ATTACK` event from `server/game/GameRoom.js` (Task 2)
  - `SoundManager.prototype.preloadZombieAudio`, `playZombieAttack`, `playZombieHit`, `playZombieDie` (Task 3)
- Produces:
  - Browser script loading order in `client/index.html`: `js/zombieAudio.js` loaded before `js/audio.js`
  - Client routing in `client/js/main.js` passing `(ev.y, listenerY, ev.zombieId)` and handling `ZOMBIE_ATTACK`

- [ ] **Step 1: Write the failing tests in `tests/horror_vfx_audio.test.js` and `tests/server.test.js`**

1. Append to the integration test (or add a dedicated test) in `tests/horror_vfx_audio.test.js`:
```js
test('Integration: handleGameEvent routes ZOMBIE_ATTACK and passes 2D coordinates to SoundManager', () => {
  const calls = { attack: [], hit: [], die: [] };
  const mockSoundManager = {
    playZombieAttack: (zType, x, lx, y, ly, zombieId, attackKind) =>
      calls.attack.push({ zType, x, lx, y, ly, zombieId, attackKind }),
    playZombieHit: (zType, weapon, x, lx, y, ly, zombieId) =>
      calls.hit.push({ zType, weapon, x, lx, y, ly, zombieId }),
    playZombieDie: (zType, x, lx, y, ly, zombieId) =>
      calls.die.push({ zType, x, lx, y, ly, zombieId })
  };
  const mockRenderer = {
    camera: { x: 800, y: 600 },
    addDirectionalBlood: () => {},
    addZombieCorpse: () => {}
  };
  const snapshot = {
    wave: 2,
    players: [{ id: 'p1', x: 400, y: 300 }],
    zombies: []
  };
  const ctx = { soundManager: mockSoundManager, renderer: mockRenderer, myPlayerId: 'p1' };

  handleGameEvent({ type: 'ZOMBIE_ATTACK', zombieId: 'z9', zType: 'DEVIL', x: 700, y: 350, attackKind: 'ranged' }, snapshot, ctx);
  handleGameEvent({ type: 'HIT', zombieId: 'z9', zType: 'DEVIL', weapon: 'bullet', x: 700, y: 350, angle: 0 }, snapshot, ctx);
  handleGameEvent({ type: 'ZOMBIE_DIE', zType: 'DEVIL', x: 700, y: 350, killAngle: 0 }, snapshot, ctx);

  assert.deepStrictEqual(calls.attack[0], {
    zType: 'DEVIL', x: 700, lx: 400, y: 350, ly: 300, zombieId: 'z9', attackKind: 'ranged'
  });
  assert.strictEqual(calls.hit[0].y, 350);
  assert.strictEqual(calls.hit[0].ly, 300);
  assert.strictEqual(calls.hit[0].zombieId, 'z9');
  assert.strictEqual(calls.die[0].y, 350);
  assert.strictEqual(calls.die[0].ly, 300);
});
```

2. Append to `tests/server.test.js`:
```js
test('Server statically serves zombie WAV audio assets and zombieAudio.js script', async (t) => {
  const { server, port } = await startServer(0);
  t.after(() => server.close());

  const wavRes = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/assets/audio/zombies/rotten/idle_1.wav`, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });

  assert.strictEqual(wavRes.statusCode, 200);
  assert.strictEqual(wavRes.body.subarray(0, 4).toString('ascii'), 'RIFF');

  const jsRes = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/js/zombieAudio.js`, (res) => {
      res.resume();
      res.on('end', () => resolve({ statusCode: res.statusCode }));
    }).on('error', reject);
  });
  assert.strictEqual(jsRes.statusCode, 200);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/horror_vfx_audio.test.js tests/server.test.js`
Expected: FAIL (`calls.attack[0]` is `undefined`; `/js/zombieAudio.js` returns `404`).

- [ ] **Step 3: Update `client/index.html` and `client/js/main.js`**

1. In `client/index.html` right before `<script src="js/audio.js"></script>` (line 263), add:
   `<script src="js/zombieAudio.js"></script>`
2. In `client/js/main.js`:
   - Near sprite preloading (`lines 4-8`), kick off background raw WAV prefetch when `isBrowser && window.soundManager && typeof window.soundManager.preloadZombieAudio === 'function'`: call `window.soundManager.preloadZombieAudio()`.
   - In `socket.on('room:gameStarted', ...)` right after `window.soundManager.ensureContext()`: also call `if (typeof window.soundManager.preloadZombieAudio === 'function') window.soundManager.preloadZombieAudio();`.
   - In `handleGameEvent(ev, snapshot, context = {})`:
     - Compute `const listenerY = localPlayer ? localPlayer.y : (rnd && rnd.camera ? rnd.camera.y : 0);`.
     - Extract a clean `handleZombieAudioAndVfx(ev, rnd, snd, listenerX, listenerY)` helper (keeping `handleGameEvent` compact under 40 lines) handling:
       - `HIT`: `if (snd) snd.playZombieHit(ev.zType, ev.weapon, ev.x, listenerX, ev.y, listenerY, ev.zombieId);` + `addDirectionalBlood(...)`
       - `ZOMBIE_DIE`: `if (snd) snd.playZombieDie(ev.zType, ev.x, listenerX, ev.y, listenerY, ev.zombieId);` + `addDirectionalBlood(...)` + `addZombieCorpse(ev)`
       - `ZOMBIE_ATTACK`: `if (snd && typeof snd.playZombieAttack === 'function') snd.playZombieAttack(ev.zType, ev.x, listenerX, ev.y, listenerY, ev.zombieId, ev.attackKind);`

- [ ] **Step 4: Run the full test suite to verify everything passes**

Run: `node --test tests/*.test.js`
Expected: PASS (all existing 59 tests + all new zombie WAV audio, server event, and HTTP static serving tests pass with 0 failures).

- [ ] **Step 5: Commit**

```bash
git add client/index.html client/js/main.js tests/horror_vfx_audio.test.js tests/server.test.js
git commit -m "feat(client): wire zombie WAV preload, ZOMBIE_ATTACK handling, and 2D spatial coords"
```
