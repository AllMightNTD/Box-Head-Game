# Fix Zombie WAV Audio & SoundManager Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix total silence and zombie WAV playback failures on `feat/zombie-wav-audio` so all 6 zombie types (`NORMAL`, `RUNNER`, `TANK`, `DEVIL`, `MUMMY`, `VAMPIRE`) and all 6 events (`idle`, `aggro`, `attack`, `hit`, `die`, `step`) reliably unlock, decode, mix, and play in the browser alongside gunshots and horror ambience.

**Architecture:** Harden the client Web Audio lifecycle in three layers without breaking headless Node test compatibility or existing `SoundManager` / `ZombieAudioBank` public contracts: (1) eliminate the `preloadRaw()`/`decodeAll()` race, failed-decode lockout, suspended-context `activeVoices` leaks, premature `hasAggroed` suppression, and global-only cooldown collisions in `client/js/zombieAudio.js`; (2) add capture-phase multi-gesture `AudioContext` unlocking, defensive Web Audio node setup, a dedicated `zombieBusGain` submix + balanced `masterGain`/`compressor` staging, diagnostics (`getAudioDiagnostics()`), state subscriptions, and an explicit unlock confirmation chime in `client/js/audio.js` and `client/js/input.js`; (3) surface live `AudioContext` + WAV decode progress on the Lobby & Pause sound buttons in `client/js/ui.js` and wire lifecycle hooks in `client/js/main.js`.

**Tech Stack:** Node.js (`node:test`, `node:assert/strict`), Express static serving, HTML5 Web Audio API (`AudioContext`, `AudioBufferSourceNode`, `StereoPannerNode`, `ConvolverNode`, `DynamicsCompressorNode`, `GainNode`).

---

## Global Constraints

- Target branch: `feat/zombie-wav-audio` (currently checked out). Do not delete or mutate existing WAV assets under `client/assets/audio/zombies/` (`72` files across `rotten`, `ghoul`, `mutant`, `burned`, `butcher`, `boomer`).
- Preserve existing `SoundManager` method signatures (`playZombieHit`, `playZombieDie`, `playZombieAttack`, `playZombieAggro`, `playZombieStep`, `playZombieGrowl`, `updateHorrorAmbience`, `stopHorrorAmbience`, `createSpatialBus`), `ZOMBIE_SFX_VOLUMES`, `ZOMBIE_AUDIO_MAP`, `ZOMBIE_EVENT_MAX_DIST`, and `compute2DDistanceGain` contracts so all `75` existing tests continue to pass.
- All browser globals (`window`, `document`, `performance`, `fetch`, `AudioContext`, `webkitAudioContext`) must be guarded so `node --test tests/*.test.js` runs headlessly without a DOM or audio device.
- Keep `playZombieSample` checking `canPlayEvent` **before** calling `ensureContext()`, and treat mock `AudioContext` objects whose `.state` is `undefined` as playable in unit tests while strictly blocking scheduling when `ctx.state` is `'suspended'` or `'closed'`.
- Clean Code (`GEMINI.md`): Keep functions focused with early returns; never swallow errors in empty `catch` blocks (always `console.warn` and record diagnostic `lastError`).

## File Structure & Responsibilities

- `client/js/zombieAudio.js` — Fix default root-relative `/assets/audio/zombies` path, coordinate `preloadRaw()` with `decodeAll(ctx)`, clear failed/zero-decoded `decodePromise` so retries succeed, guard `playSample()` when `ctx.state !== 'running'`, key `hit`/`attack`/`step`/`aggro` cooldowns per `(event, zombieId)` when `zombieId` is provided, defer `zs.hasAggroed = true` until `onTrigger(z, 'aggro') !== false`, and expose `getDecodedCount()` / `getTotalAssetCount()` / `lastError`.
- `client/js/audio.js` — Add capture-phase gesture unlock bootstrap (`bindGestureUnlock()` / `unlockFromGesture()`), attach `ctx.onstatechange` listener + `subscribe()`/`_notifyStateChange()`, guard `createDynamicsCompressor` / `createConvolver` in `setupAudioGraph()`, add `zombieBusGain` (`1.65`) and tune `masterGain` (`0.55`) + `compressor` (`threshold: -10`, `ratio: 4`), block `playZombieSample()` when `ctx.state` is non-running, and implement `getAudioDiagnostics()` + `playUnlockTestChime()`.
- `client/js/input.js` — Route keyboard/mouse interaction through `window.soundManager.unlockFromGesture()` (falling back to `ensureContext()`).
- `client/js/ui.js` — Subscribe to `window.soundManager` state updates, show live status on `#btn-sound-toggle` and `#btn-pause-sound` (`Chờ kích hoạt`, `BẬT (WAV X/72)`, `TẮT`, or `Không hỗ trợ`), and make clicking while uninitialized/suspended unlock + decode + play a short confirmation chime instead of toggling straight to muted.
- `client/js/main.js` — Register global capture-phase audio unlock listeners on startup, pass `zombieBank.decodeAll` retry cleanly on `room:gameStarted`, and emit `console.info`/`console.warn` audio telemetry when `AudioContext` unlocks or WAV decode finishes with partial/zero buffers.
- `tests/zombie_audio_bank.test.js` — Add unit tests for `preloadRaw`/`decodeAll` coordination, zero-buffer retry, suspended-context guard without leaking `activeVoices`, per-zombie cooldown isolation, deferred `hasAggroed` retry, and telemetry counts.
- `tests/horror_vfx_audio.test.js` — Add unit/integration tests for `SoundManager.setupAudioGraph()` defensive node guards, `zombieBusGain` routing, `unlockFromGesture()`, `getAudioDiagnostics()`, `playUnlockTestChime()`, suspended `playZombieSample` guard, and all-6-zombie WAV playback verification.

## Data Flow & Risk Assessment

1. **Startup & Preload:** `main.js` registers `window.soundManager.bindGestureUnlock(window)` in capture phase and starts `preloadZombieAudio()` (`preloadRaw()`). Raw WAV bytes buffer once in `rawBuffers`.
2. **First Gesture / Button Click:** Any `pointerdown`, `mousedown`, `keydown`, `touchstart`, or `click` fires `unlockFromGesture()` synchronously in capture phase -> calls `init()`, creates `AudioContext`, wires `zombieBusGain -> compressor -> masterGain -> ctx.destination`, calls `ctx.resume()`, awaits `preloadPromise`, decodes all `72` WAVs into `buffers`, frees `rawBuffers`, and notifies UI buttons (`WAV 72/72`).
3. **In-Game Playback:**
   - Discrete server events (`HIT`, `ZOMBIE_DIE`, `ZOMBIE_ATTACK`) in `main.js` -> `SoundManager` -> `playZombieSample()` -> checks `hasBuffer`, `canPlayEvent(event, zombieId)`, `ensureContext()`, `ctx.state === 'running'` -> routes through `createSpatialBus(..., this.zombieBusGain)`.
   - Per-frame ambience (`gameLoop` -> `updateHorrorAmbience` -> `updateAmbienceGrowls`) -> `ZombieAudioBank.updateZombies()` emits `aggro`, `step`, `idle` only when zombie is alive, un-frozen, un-stunned, within `maxDist`, and marks `hasAggroed = true` only when `onTrigger` succeeds.
4. **Risks & Mitigations:**
   - *Risk:* Changing `ZOMBIE_SFX_VOLUMES` or `compute2DDistanceGain` breaks existing exact-float tests (`wavGainH === 0.4`). *Mitigation:* Keep `ZOMBIE_SFX_VOLUMES` and `compute2DDistanceGain` untouched; amplify via `this.zombieBusGain` (`1.65`) created inside `setupAudioGraph()`.
   - *Risk:* Existing unit test `createMockAudioContext()` or mock `ctx` in `tests/zombie_audio_bank.test.js` omits `ctx.state`. *Mitigation:* Check `if (ctx.state && ctx.state !== 'running')` so `undefined` `ctx.state` in headless unit mocks remains accepted while real `'suspended'` / `'closed'` contexts are safely gated.

---

### Task 1: Fix `ZombieAudioBank` Preload/Decode Race, Suspended-Context Voice Leak, and Per-Zombie Cooldown/Aggro Logic

**Files:**
- Modify: `client/js/zombieAudio.js:69-490`
- Test: `tests/zombie_audio_bank.test.js:240-280`

**Interfaces:**
- Consumes:
  - `AudioContext`: `{ state?: string, currentTime?: number, decodeAudioData(ArrayBuffer): Promise<AudioBuffer>, createBufferSource(), createGain() }`
  - `fetchFn(url: string): Promise<{ ok: boolean, status: number, arrayBuffer(): Promise<ArrayBuffer> }>`
- Produces (additions/updates on `ZombieAudioBank` in `client/js/zombieAudio.js`):
  - `default basePath = '/assets/audio/zombies'`
  - `this.lastError: string | null`
  - `getTotalAssetCount() -> number` (returns `72`)
  - `getDecodedCount() -> number` (returns count of decoded `AudioBuffer` items across `this.buffers`)
  - `preloadRaw(concurrency?: number) -> Promise<number>` (clears `this.preloadPromise` in `try/finally`)
  - `decodeAll(ctx: AudioContext) -> Promise<number>` (awaits pending `this.preloadPromise`, resets `this.decodePromise = null` when `decodedCount === 0` or on failure so retries work)
  - `canPlayEvent(event: string, zombieId?: string) -> boolean` (uses `${event}:${zombieId}` when `zombieId` is provided for `hit`, `attack`, `step`, `aggro`; falls back to `event` when `zombieId` is omitted)
  - `playSample(ctx, destNode, zType, event, options?) -> boolean` (rejects cleanly without mutating `activeVoices` or `lastEventTimes` when `ctx.state && ctx.state !== 'running'`)
  - `_updateSingleZombie(z, playerX, playerY, dt, onTrigger)` (sets `zs.hasAggroed = true` only when `onTrigger(z, 'aggro') !== false`)

- [ ] **Step 1: Write the failing unit tests in `tests/zombie_audio_bank.test.js`**

Append these tests to the end of `tests/zombie_audio_bank.test.js`:
```js
test('ZombieAudioBank defaults basePath to /assets/audio/zombies and exposes decoded/total counts', () => {
  const bank = new ZombieAudioBank();
  assert.equal(bank.basePath, '/assets/audio/zombies');
  assert.equal(bank.getTotalAssetCount(), 72);
  assert.equal(bank.getDecodedCount(), 0);

  bank.buffers.set('rotten/idle', [{ duration: 0.4 }, { duration: 0.5 }]);
  bank.buffers.set('mutant/hit', [{ duration: 0.2 }]);
  assert.equal(bank.getDecodedCount(), 3);
});

test('ZombieAudioBank.decodeAll awaits in-flight preloadRaw without duplicate fetches and allows retry after zero-decode failure', async () => {
  let fetchCount = 0;
  let shouldFailFetch = true;
  const mockFetch = async () => {
    fetchCount++;
    if (shouldFailFetch) {
      return { ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) };
    }
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(16) };
  };
  const mockCtx = {
    state: 'running',
    decodeAudioData: async () => ({ duration: 0.4 })
  };

  // 1. Initial decodeAll fails completely -> must allow retry on same AudioContext
  const retryBank = new ZombieAudioBank({ fetchFn: mockFetch });
  const firstCount = await retryBank.decodeAll(mockCtx);
  assert.equal(firstCount, 0);
  assert.ok(retryBank.lastError, 'lastError should record fetch failure');

  shouldFailFetch = false;
  const secondCount = await retryBank.decodeAll(mockCtx);
  assert.equal(secondCount, 72, 'decodeAll must retry and decode all 72 files after prior 0-count failure');

  // 2. Concurrent preloadRaw + decodeAll must reuse raw buffers without 144 fetches
  fetchCount = 0;
  let releaseFirstFetch;
  const firstFetchGate = new Promise((resolve) => { releaseFirstFetch = resolve; });
  const gatedFetch = async () => {
    fetchCount++;
    await firstFetchGate;
    return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(16) };
  };
  const coordBank = new ZombieAudioBank({ fetchFn: gatedFetch });
  const pPreload = coordBank.preloadRaw(6);
  const pDecode = coordBank.decodeAll(mockCtx);
  releaseFirstFetch();
  const [rawCount, decCount] = await Promise.all([pPreload, pDecode]);
  assert.equal(rawCount, 72);
  assert.equal(decCount, 72);
  assert.equal(fetchCount, 72, 'decodeAll must await preloadRaw instead of double-fetching');
  assert.equal(coordBank.rawBuffers.size, 0, 'rawBuffers must remain empty after coordinated decode');
});

test('ZombieAudioBank.playSample rejects suspended/closed AudioContext without burning activeVoices', () => {
  let resumeCalls = 0;
  const suspendedCtx = {
    state: 'suspended',
    currentTime: 0,
    resume: () => { resumeCalls++; },
    createBufferSource: () => { throw new Error('Should not create source while suspended'); },
    createGain: () => { throw new Error('Should not create gain while suspended'); }
  };
  const bank = new ZombieAudioBank();
  bank.buffers.set('rotten/hit', [{ duration: 0.3 }]);

  const played = bank.playSample(suspendedCtx, {}, 'NORMAL', 'hit', {
    x: 800, y: 600, listenerX: 800, listenerY: 600, zombieId: 'z1'
  });
  assert.equal(played, false);
  assert.equal(bank.activeVoices, 0);
  assert.equal(resumeCalls, 1);
  assert.equal(bank.lastEventTimes.size, 0, 'Failed suspended trigger must not enter cooldown');
});

test('ZombieAudioBank isolates per-zombie cooldowns when zombieId is passed and retries aggro if suppressed', () => {
  let now = 1000;
  const bank = new ZombieAudioBank({ nowFn: () => now });
  const mockCtx = {
    state: 'running',
    currentTime: 1,
    createBufferSource: () => ({
      buffer: null,
      playbackRate: { value: 1 },
      onended: null,
      connect: function () { return this; },
      start: () => {}
    }),
    createGain: () => ({
      gain: { value: 1, setValueAtTime: () => {} },
      connect: () => {}
    })
  };
  for (const profile of ['rotten', 'ghoul', 'mutant', 'burned', 'butcher', 'boomer']) {
    bank.buffers.set(`${profile}/aggro`, [{ duration: 0.4 }]);
    bank.buffers.set(`${profile}/hit`, [{ duration: 0.2 }]);
  }

  // Two different zombie types hitting and aggroing simultaneously must both play
  assert.equal(bank.playSample(mockCtx, {}, 'NORMAL', 'aggro', { x: 800, y: 600, listenerX: 800, listenerY: 600, zombieId: 'z_norm' }), true);
  assert.equal(bank.playSample(mockCtx, {}, 'TANK', 'aggro', { x: 820, y: 600, listenerX: 800, listenerY: 600, zombieId: 'z_tank' }), true);
  // Same zombie within cooldown is still throttled
  assert.equal(bank.playSample(mockCtx, {}, 'NORMAL', 'hit', { x: 800, y: 600, listenerX: 800, listenerY: 600, zombieId: 'z_norm' }), true);
  assert.equal(bank.playSample(mockCtx, {}, 'NORMAL', 'hit', { x: 800, y: 600, listenerX: 800, listenerY: 600, zombieId: 'z_norm' }), false);
  assert.equal(bank.playSample(mockCtx, {}, 'DEVIL', 'hit', { x: 820, y: 600, listenerX: 800, listenerY: 600, zombieId: 'z_devil' }), true);

  // If onTrigger returns false on aggro (e.g. voice cap or suspended), zombie must retry on next frame
  let allowAggro = false;
  let aggroAttempts = 0;
  const state = {
    localPlayer: { x: 500, y: 500 },
    zombies: [{ id: 'z_retry', type: 'VAMPIRE', x: 600, y: 500, isFrozen: false, isStunned: false }]
  };
  bank.updateZombies(0.05, state, (z, ev) => {
    if (ev === 'aggro') {
      aggroAttempts++;
      return allowAggro;
    }
    return true;
  });
  assert.equal(aggroAttempts, 1);
  assert.equal(bank.zombieStates.get('z_retry').hasAggroed, false);

  allowAggro = true;
  bank.updateZombies(0.05, state, (z, ev) => {
    if (ev === 'aggro') {
      aggroAttempts++;
      return allowAggro;
    }
    return true;
  });
  assert.equal(aggroAttempts, 2);
  assert.equal(bank.zombieStates.get('z_retry').hasAggroed, true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/zombie_audio_bank.test.js`
Expected: FAIL — `bank.basePath` is `'assets/audio/zombies'` instead of `'/assets/audio/zombies'`, `bank.getTotalAssetCount` is not a function, `secondCount` is `0`, `played` is `true` on suspended context, `z_tank` aggro returns `false`.

- [ ] **Step 3: Implement the fixes in `client/js/zombieAudio.js`**

Update `ZombieAudioBank` in `client/js/zombieAudio.js` (lines 69-490) with the following exact implementation:
```js
class ZombieAudioBank {
  constructor(options = {}) {
    const rawBasePath = typeof options.basePath === 'string' ? options.basePath : '/assets/audio/zombies';
    this.basePath = rawBasePath.replace(/\/+$/, '');
    this.maxVoices = typeof options.maxVoices === 'number' && Number.isFinite(options.maxVoices) ? options.maxVoices : 24;

    this.nowFn = typeof options.nowFn === 'function' ? options.nowFn : () => {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
      }
      return Date.now();
    };

    this.fetchFn = options.fetchFn !== undefined
      ? options.fetchFn
      : (typeof window !== 'undefined' && typeof window.fetch === 'function'
        ? window.fetch.bind(window)
        : (typeof fetch === 'function' ? fetch.bind(globalThis) : null));

    this.buffers = new Map();
    this.rawBuffers = new Map();
    this.activeVoices = 0;
    this.lastEventTimes = new Map();
    this.zombieStates = new Map();

    this.preloadPromise = null;
    this.decodePromise = null;
    this.decodeCtx = null;
    this.lastError = null;
  }

  resolveProfile(zType) {
    if (!zType || typeof zType !== 'string') {
      return 'rotten';
    }
    const upper = zType.toUpperCase();
    if (ZOMBIE_AUDIO_MAP[upper]) {
      return ZOMBIE_AUDIO_MAP[upper];
    }
    const lower = zType.toLowerCase();
    if (ZOMBIE_PROFILE_ORDER.includes(lower)) {
      return lower;
    }
    return 'rotten';
  }

  getAllAssetEntries() {
    const entries = [];
    for (const profile of ZOMBIE_PROFILE_ORDER) {
      for (const [event, count] of Object.entries(ZOMBIE_SFX_COUNTS)) {
        for (let i = 1; i <= count; i++) {
          const key = `${profile}/${event}_${i}`;
          const url = `${this.basePath}/${profile}/${event}_${i}.wav`;
          entries.push({ profile, event, index: i, key, url });
        }
      }
    }
    return entries;
  }

  getTotalAssetCount() {
    let perProfile = 0;
    for (const count of Object.values(ZOMBIE_SFX_COUNTS)) {
      perProfile += count;
    }
    return ZOMBIE_PROFILE_ORDER.length * perProfile;
  }

  getDecodedCount() {
    let total = 0;
    for (const list of this.buffers.values()) {
      if (Array.isArray(list)) {
        total += list.length;
      }
    }
    return total;
  }

  hasBuffer(zType, event) {
    if (!zType || !event) {
      return false;
    }
    const profile = this.resolveProfile(zType);
    const list = this.buffers.get(`${profile}/${event}`);
    return Array.isArray(list) && list.length > 0;
  }

  hasAnyBuffers() {
    for (const list of this.buffers.values()) {
      if (Array.isArray(list) && list.length > 0) {
        return true;
      }
    }
    return false;
  }

  compute2DDistanceGain(sourceX, sourceY, listenerX, listenerY, maxDist = 800) {
    if (sourceX === undefined || sourceY === undefined || listenerX === undefined || listenerY === undefined) {
      return 1;
    }
    if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY) || !Number.isFinite(listenerX) || !Number.isFinite(listenerY)) {
      return 1;
    }
    if (!Number.isFinite(maxDist) || maxDist <= 0) {
      return 1;
    }
    const dx = sourceX - listenerX;
    const dy = sourceY - listenerY;
    const dist = Math.hypot(dx, dy);
    const gain = 1 - dist / maxDist;
    return Math.max(0, Math.min(1, gain));
  }

  _getCooldownKey(event, zombieId) {
    if (zombieId !== undefined && zombieId !== null && zombieId !== '') {
      return `${event}:${zombieId}`;
    }
    return event;
  }

  canPlayEvent(event, zombieId) {
    if (!event || typeof event !== 'string') {
      return false;
    }
    if (this.activeVoices >= this.maxVoices) {
      return false;
    }
    const isAmbient = event === 'step' || event === 'idle';
    const ambientCap = Math.floor(this.maxVoices * 0.75);
    if (isAmbient && this.activeVoices >= ambientCap) {
      return false;
    }
    const cooldown = EVENT_COOLDOWNS_MS[event] || 0;
    if (cooldown > 0) {
      const now = this.nowFn();
      const cooldownKey = this._getCooldownKey(event, zombieId);
      const lastTime = this.lastEventTimes.has(cooldownKey) ? this.lastEventTimes.get(cooldownKey) : -Infinity;
      if (now - lastTime < cooldown) {
        return false;
      }
    }
    return true;
  }

  async preloadRaw(concurrency = 6) {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }
    if (!this.fetchFn) {
      return 0;
    }

    this.preloadPromise = (async () => {
      const entries = this.getAllAssetEntries();
      let loadedCount = 0;
      let idx = 0;
      const poolSize = typeof concurrency === 'number' && concurrency > 0 ? concurrency : 6;
      const workers = [];

      const worker = async () => {
        while (idx < entries.length) {
          const entry = entries[idx++];
          if (this.rawBuffers.has(entry.key) || this.hasBuffer(entry.profile, entry.event)) {
            continue;
          }
          try {
            const res = await this.fetchFn(entry.url);
            if (!res || !res.ok) {
              this.lastError = `Preload HTTP ${res ? res.status : 'no response'} for ${entry.url}`;
              console.warn(`[ZombieAudioBank] Preload failed (${res ? res.status : 'no response'}): ${entry.url}`);
              continue;
            }
            const buf = await res.arrayBuffer();
            if (buf && buf.byteLength > 0) {
              this.rawBuffers.set(entry.key, buf);
              loadedCount++;
            }
          } catch (err) {
            this.lastError = err ? String(err.message || err) : 'Preload fetch error';
            console.warn(`[ZombieAudioBank] Preload error for ${entry.url}:`, err);
          }
        }
      };

      try {
        const count = Math.min(poolSize, entries.length);
        for (let i = 0; i < count; i++) {
          workers.push(worker());
        }
        await Promise.all(workers);
        return loadedCount;
      } finally {
        this.preloadPromise = null;
      }
    })();

    return this.preloadPromise;
  }

  async decodeAll(ctx) {
    if (!ctx || typeof ctx.decodeAudioData !== 'function') {
      return 0;
    }
    if (this.decodePromise && this.decodeCtx === ctx) {
      return this.decodePromise;
    }
    if (this.decodeCtx !== ctx) {
      this.buffers.clear();
      this.decodeCtx = ctx;
      this.decodePromise = null;
    }

    const activePromise = (async () => {
      if (this.preloadPromise) {
        try {
          await this.preloadPromise;
        } catch (err) {
          console.warn('[ZombieAudioBank] Pending preloadRaw error before decodeAll:', err);
        }
      }

      const entries = this.getAllAssetEntries();
      let decodedCount = 0;
      let idx = 0;
      const poolSize = 6;
      const workers = [];
      this.lastError = null;

      const worker = async () => {
        while (idx < entries.length) {
          const entry = entries[idx++];
          let raw = this.rawBuffers.get(entry.key);
          if (!raw) {
            if (!this.fetchFn) {
              continue;
            }
            try {
              const res = await this.fetchFn(entry.url);
              if (!res || !res.ok) {
                this.lastError = `Fetch HTTP ${res ? res.status : 'no response'} for ${entry.url}`;
                console.warn(`[ZombieAudioBank] Fetch failed (${res ? res.status : 'no response'}): ${entry.url}`);
                continue;
              }
              raw = await res.arrayBuffer();
            } catch (err) {
              this.lastError = err ? String(err.message || err) : 'Fetch error';
              console.warn(`[ZombieAudioBank] Fetch error for ${entry.url}:`, err);
              continue;
            }
          }

          this.rawBuffers.delete(entry.key);
          if (!raw || raw.byteLength === 0) {
            continue;
          }

          try {
            const bufToDecode = raw.slice ? raw.slice(0) : raw;
            const decoded = await ctx.decodeAudioData(bufToDecode);
            if (decoded) {
              const bufKey = `${entry.profile}/${entry.event}`;
              let list = this.buffers.get(bufKey);
              if (!list) {
                list = [];
                this.buffers.set(bufKey, list);
              }
              list.push(decoded);
              decodedCount++;
            }
          } catch (err) {
            this.lastError = err ? String(err.message || err) : 'Decode error';
            console.warn(`[ZombieAudioBank] Decode error for ${entry.url}:`, err);
          }
        }
      };

      try {
        const count = Math.min(poolSize, entries.length);
        for (let i = 0; i < count; i++) {
          workers.push(worker());
        }
        await Promise.all(workers);
        if (decodedCount === 0 && this.decodePromise === activePromise) {
          this.decodePromise = null;
        }
        return decodedCount;
      } catch (err) {
        if (this.decodePromise === activePromise) {
          this.decodePromise = null;
        }
        this.lastError = err ? String(err.message || err) : 'decodeAll error';
        throw err;
      }
    })();

    this.decodePromise = activePromise;
    return this.decodePromise;
  }

  playSample(ctx, destNode, zType, event, options = {}) {
    if (!ctx || typeof ctx.createBufferSource !== 'function' || !destNode) {
      return false;
    }
    if (ctx.state && ctx.state !== 'running') {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        Promise.resolve(ctx.resume()).catch(err => {
          console.warn('[ZombieAudioBank] Failed to resume suspended AudioContext:', err);
        });
      }
      return false;
    }
    if (!this.hasBuffer(zType, event)) {
      return false;
    }
    if (!this.canPlayEvent(event, options.zombieId)) {
      return false;
    }

    const maxDist = typeof options.maxDist === 'number' && options.maxDist > 0 ? options.maxDist : (ZOMBIE_EVENT_MAX_DIST[event] || 800);
    const distGain = this.compute2DDistanceGain(options.x, options.y, options.listenerX, options.listenerY, maxDist);
    const baseVolume = ZOMBIE_SFX_VOLUMES[event] !== undefined ? ZOMBIE_SFX_VOLUMES[event] : 1.0;
    const optVolume = typeof options.volume === 'number' && Number.isFinite(options.volume) ? options.volume : 1.0;
    const totalGain = distGain * baseVolume * optVolume;

    if (totalGain < 0.01) {
      return false;
    }

    const profile = this.resolveProfile(zType);
    const bufferList = this.buffers.get(`${profile}/${event}`);
    if (!bufferList || bufferList.length === 0) {
      return false;
    }

    const bufferIndex = Math.floor(Math.random() * bufferList.length);
    const audioBuffer = bufferList[bufferIndex];

    let pitch = typeof options.pitch === 'number' && Number.isFinite(options.pitch) ? options.pitch : null;
    if (pitch === null) {
      pitch = 0.94 + Math.random() * (1.06 - 0.94);
    }

    const src = ctx.createBufferSource();
    if (!src || typeof src.start !== 'function') {
      return false;
    }
    src.buffer = audioBuffer;
    if (src.playbackRate) {
      src.playbackRate.value = pitch;
    }

    const gainNode = ctx.createGain();
    if (gainNode.gain) {
      if (typeof gainNode.gain.setValueAtTime === 'function' && typeof ctx.currentTime === 'number') {
        gainNode.gain.setValueAtTime(totalGain, ctx.currentTime);
      } else {
        gainNode.gain.value = totalGain;
      }
    }

    src.connect(gainNode);
    gainNode.connect(destNode);

    this.activeVoices++;
    let ended = false;
    src.onended = () => {
      if (!ended) {
        ended = true;
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      }
    };

    const cooldownKey = this._getCooldownKey(event, options.zombieId);
    this.lastEventTimes.set(cooldownKey, this.nowFn());

    try {
      src.start(0);
    } catch (err) {
      if (!ended) {
        ended = true;
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      }
      console.warn('[ZombieAudioBank] Failed to start audio source:', err);
      return false;
    }

    return true;
  }

  updateZombies(dt, state, onTrigger) {
    if (!state || !state.localPlayer || typeof onTrigger !== 'function') {
      return;
    }
    const zombies = Array.isArray(state.zombies) ? state.zombies : [];
    const playerX = state.localPlayer.x;
    const playerY = state.localPlayer.y;
    if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) {
      return;
    }

    const currentIds = new Set();
    for (const z of zombies) {
      if (z && z.id != null) {
        currentIds.add(z.id);
      }
    }

    for (const id of this.zombieStates.keys()) {
      if (!currentIds.has(id)) {
        this.zombieStates.delete(id);
      }
    }

    const delta = typeof dt === 'number' && Number.isFinite(dt) && dt > 0 ? dt : 0;

    for (const z of zombies) {
      if (!z || z.id == null) {
        continue;
      }
      if (z.isDead || z.dead || (z.hp !== undefined && z.hp <= 0)) {
        this.zombieStates.delete(z.id);
        continue;
      }

      this._updateSingleZombie(z, playerX, playerY, delta, onTrigger);
    }
  }

  _updateSingleZombie(z, playerX, playerY, dt, onTrigger) {
    let zs = this.zombieStates.get(z.id);
    const isNew = !zs;

    if (!zs) {
      zs = {
        lastX: z.x,
        lastY: z.y,
        stepDist: 0,
        idleTimer: 3.5 + Math.random() * 5.0,
        hasAggroed: false,
        lastAttackAt: 0
      };
      this.zombieStates.set(z.id, zs);
    }

    const distToPlayer = Math.hypot(z.x - playerX, z.y - playerY);

    if (!zs.hasAggroed && !z.isFrozen && !z.isStunned && distToPlayer <= ZOMBIE_EVENT_MAX_DIST.aggro) {
      const triggered = onTrigger(z, 'aggro');
      if (triggered !== false) {
        zs.hasAggroed = true;
      }
    }

    if (!isNew) {
      const dx = z.x - zs.lastX;
      const dy = z.y - zs.lastY;
      const moved = Math.hypot(dx, dy);

      if (!z.isFrozen && !z.isStunned && moved > 0 && moved <= 150) {
        zs.stepDist += moved;
        const stride = ZOMBIE_STEP_STRIDE[z.type] || ZOMBIE_STEP_STRIDE.NORMAL || 58;
        if (zs.stepDist >= stride) {
          zs.stepDist -= stride;
          if (distToPlayer <= ZOMBIE_EVENT_MAX_DIST.step) {
            onTrigger(z, 'step');
          }
        }
      } else if (moved > 150) {
        zs.stepDist = 0;
      }
    }
    zs.lastX = z.x;
    zs.lastY = z.y;

    if (!z.isFrozen && !z.isStunned && distToPlayer <= ZOMBIE_EVENT_MAX_DIST.idle) {
      zs.idleTimer -= dt;
      if (zs.idleTimer <= 0) {
        zs.idleTimer = 3.5 + Math.random() * 5.0;
        onTrigger(z, 'idle');
      }
    }
  }

  reset() {
    this.zombieStates.clear();
    this.lastEventTimes.clear();
    this.activeVoices = 0;
  }
}
```

- [ ] **Step 4: Run `tests/zombie_audio_bank.test.js` to verify all tests pass**

Run: `node --test tests/zombie_audio_bank.test.js`
Expected: PASS (all existing + 4 new tests pass; 0 failures).

- [ ] **Step 5: Commit Task 1**

```bash
git add client/js/zombieAudio.js tests/zombie_audio_bank.test.js
git commit -m "fix(audio): coordinate preload/decode retries, guard suspended contexts, and isolate per-zombie cooldowns"
```

---

### Task 2: Harden `SoundManager` Gesture Unlock, Submix Gain Staging, Diagnostics, and Test Chime

**Files:**
- Modify: `client/js/audio.js:23-235`, `client/js/audio.js:416-455`, `client/js/audio.js:840-965`
- Test: `tests/horror_vfx_audio.test.js:710-729`

**Interfaces:**
- Consumes:
  - `ZombieAudioBank` from Task 1 (`getDecodedCount()`, `getTotalAssetCount()`, `decodeAll()`, `preloadRaw()`, `playSample()`, `canPlayEvent()`, `hasBuffer()`, `hasAnyBuffers()`, `updateZombies()`, `reset()`)
- Produces (additions/updates on `SoundManager` in `client/js/audio.js`):
  - `this.masterGainLevel = 0.55`
  - `this.zombieBusGain: GainNode | null` (connected to `this.compressor || this.masterGain`, gain `1.65`)
  - `this.lastAudioError: string | null`
  - `subscribe(listener: (diag: object) => void) -> () => void`
  - `getAudioDiagnostics() -> { supported: boolean, initialized: boolean, muted: boolean, ctxState: string, decodedCount: number, totalCount: number, activeVoices: number, maxVoices: number, lastError: string | null }`
  - `bindGestureUnlock(target?: EventTarget) -> void` (attaches capture-phase listeners on `pointerdown`, `mousedown`, `keydown`, `touchstart`, `click`)
  - `unlockFromGesture() -> Promise<boolean>` (initializes/resumes `AudioContext`, triggers `preloadZombieAudio()` when buffers are empty, notifies subscribers, returns `true` if `ctx.state === 'running'` or `undefined`)
  - `playUnlockTestChime() -> boolean` (plays short 440Hz -> 660Hz unlock verification ping when `ctx` is running and unmuted)
  - `createSpatialBus(sourceX, listenerX, reverbSend = 0.2, enableDistanceGain = true, targetNode = null)`

- [ ] **Step 1: Write the failing unit tests in `tests/horror_vfx_audio.test.js`**

Append these tests to `tests/horror_vfx_audio.test.js`:
```js
test('SoundManager setupAudioGraph handles missing compressor/convolver, configures zombieBusGain, and exposes diagnostics', () => {
  const createdGains = [];
  const baseCtx = createMockAudioContext();
  const origCreateGain = baseCtx.createGain.bind(baseCtx);
  baseCtx.createGain = () => {
    const g = origCreateGain();
    createdGains.push(g);
    return g;
  };
  delete baseCtx.createDynamicsCompressor;
  delete baseCtx.createConvolver;

  const sm = new SoundManager();
  sm.ctx = baseCtx;
  assert.doesNotThrow(() => sm.setupAudioGraph());
  sm.initialized = true;

  assert.strictEqual(sm.masterGain.gain.value, 0.55);
  assert.strictEqual(sm.compressor, sm.masterGain);
  assert.strictEqual(sm.reverbNode, null);
  assert.ok(sm.zombieBusGain, 'zombieBusGain must be created for zombie submix');
  assert.strictEqual(sm.zombieBusGain.gain.value, 1.65);

  const diag = sm.getAudioDiagnostics();
  assert.strictEqual(diag.initialized, true);
  assert.strictEqual(diag.muted, false);
  assert.strictEqual(diag.ctxState, 'running');
  assert.strictEqual(diag.totalCount, 72);
  assert.strictEqual(diag.decodedCount, 0);
});

test('SoundManager.unlockFromGesture resumes suspended AudioContext, notifies subscribers, and playZombieSample skips suspended ctx', async () => {
  const mockCtx = createMockAudioContext();
  mockCtx.state = 'suspended';
  mockCtx.resume = async () => {
    mockCtx.state = 'running';
    if (typeof mockCtx.onstatechange === 'function') mockCtx.onstatechange();
  };

  let decodeCalls = 0;
  const sm = new SoundManager();
  sm.zombieBank.decodeAll = async () => {
    decodeCalls++;
    sm.zombieBank.buffers.set('rotten/hit', [{ duration: 0.3 }]);
    return 1;
  };
  sm.ctx = mockCtx;
  sm.setupAudioGraph();
  sm.initialized = true;

  const events = [];
  const unsub = sm.subscribe((d) => events.push(d.ctxState));

  // While suspended, playZombieSample must NOT schedule or mutate cooldowns
  sm.zombieBank.buffers.set('rotten/hit', [{ duration: 0.3 }]);
  assert.strictEqual(sm.playZombieSample('NORMAL', 'hit', 800, 600, 800, 600, { zombieId: 'z_susp' }), false);

  const unlocked = await sm.unlockFromGesture();
  assert.strictEqual(unlocked, true);
  assert.strictEqual(mockCtx.state, 'running');
  assert.ok(events.includes('running'));
  assert.strictEqual(sm.playUnlockTestChime(), true);

  // When buffer count was 0, unlockFromGesture triggers decodeAll
  sm.zombieBank.buffers.clear();
  await sm.unlockFromGesture();
  assert.strictEqual(decodeCalls, 1);

  unsub();
});

test('SoundManager capture-phase bindGestureUnlock unlocks on pointerdown/keydown/touchstart/click', async () => {
  const listeners = {};
  const mockTarget = {
    addEventListener: (ev, fn, opts) => {
      listeners[ev] = { fn, opts };
    },
    removeEventListener: (ev) => {
      delete listeners[ev];
    }
  };
  const sm = new SoundManager();
  let unlockCount = 0;
  sm.unlockFromGesture = async () => {
    unlockCount++;
    return true;
  };

  sm.bindGestureUnlock(mockTarget);
  for (const evName of ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'click']) {
    assert.ok(listeners[evName], `Expected ${evName} listener`);
    assert.strictEqual(listeners[evName].opts.capture, true, `${evName} must use capture phase`);
  }

  listeners.pointerdown.fn();
  assert.strictEqual(unlockCount, 1);
});

test('All 6 zombie types play WAV buffers across all 6 events through SoundManager', () => {
  let startedCount = 0;
  const ctx = createMockAudioContext();
  const origBufSrc = ctx.createBufferSource;
  ctx.createBufferSource = () => {
    const src = origBufSrc();
    src.start = () => { startedCount++; };
    return src;
  };

  const sm = new SoundManager({ nowFn: () => 5000 });
  sm.ctx = ctx;
  sm.setupAudioGraph();
  sm.initialized = true;

  const profiles = ['rotten', 'ghoul', 'mutant', 'burned', 'butcher', 'boomer'];
  const events = ['idle', 'aggro', 'attack', 'hit', 'die', 'step'];
  for (const p of profiles) {
    for (const ev of events) {
      sm.zombieBank.buffers.set(`${p}/${ev}`, [{ duration: 0.4 }]);
    }
  }

  const types = ['NORMAL', 'RUNNER', 'TANK', 'DEVIL', 'MUMMY', 'VAMPIRE'];
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const zid = `z_${t}_${i}`;
    sm.playZombieHit(t, 'PISTOL', 820, 800, 610, 600, zid);
    sm.playZombieDie(t, 820, 800, 610, 600, zid);
    assert.strictEqual(sm.playZombieAttack(t, 820, 800, 610, 600, zid, 'melee'), true);
    assert.strictEqual(sm.playZombieAggro(t, 820, 800, 610, 600, zid), true);
    assert.strictEqual(sm.playZombieStep(t, 820, 800, 610, 600, zid), true);
    sm.lastGrowlTime = -Infinity;
    assert.strictEqual(sm.playZombieGrowl(t, 820, 800, 610, 600, zid), true);
  }
  assert.strictEqual(startedCount, 36, 'All 6 zombie types x 6 events must play WAV samples');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: FAIL — `baseCtx.createDynamicsCompressor is not a function`, `sm.getAudioDiagnostics is not a function`, `sm.unlockFromGesture is not a function`, `sm.bindGestureUnlock is not a function`, and `startedCount` < 36 due to global cooldowns in the old bank (if tested independently) or missing methods.

- [ ] **Step 3: Update `client/js/audio.js`**

Modify `client/js/audio.js` in the following targeted sections:

1. In `constructor(options = {})` (lines 24-52), initialize `masterGainLevel`, `zombieBusGain`, `lastAudioError`, `stateListeners`, and `_gestureUnlockBound`:
```js
    this.masterGainLevel = 0.55;
    this.zombieBusGain = null;
    this.lastAudioError = null;
    this.stateListeners = new Set();
    this._gestureUnlockBound = false;
    this._gestureUnlockCleanup = null;
```

2. Replace `init()`, `preloadZombieAudio()`, `setupAudioGraph()`, `ensureContext()`, and `toggleMute()` (lines 54-138) and add `subscribe()`, `_notifyStateChange()`, `getAudioDiagnostics()`, `unlockFromGesture()`, `bindGestureUnlock()`, and `playUnlockTestChime()`:
```js
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  _notifyStateChange() {
    if (!this.stateListeners || this.stateListeners.size === 0) return;
    const diag = this.getAudioDiagnostics();
    for (const listener of this.stateListeners) {
      try {
        listener(diag);
      } catch (err) {
        console.warn('[SoundManager] State listener error:', err);
      }
    }
  }

  getAudioDiagnostics() {
    const supported = Boolean(
      this.ctx ||
      (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
    );
    const decodedCount = this.zombieBank && typeof this.zombieBank.getDecodedCount === 'function'
      ? this.zombieBank.getDecodedCount()
      : 0;
    const totalCount = this.zombieBank && typeof this.zombieBank.getTotalAssetCount === 'function'
      ? this.zombieBank.getTotalAssetCount()
      : 72;
    return {
      supported,
      initialized: Boolean(this.initialized),
      muted: Boolean(this.muted),
      ctxState: this.ctx ? (this.ctx.state || 'running') : 'uninitialized',
      decodedCount,
      totalCount,
      activeVoices: this.zombieBank ? this.zombieBank.activeVoices : 0,
      maxVoices: this.zombieBank ? this.zombieBank.maxVoices : 24,
      lastError: this.lastAudioError || (this.zombieBank ? this.zombieBank.lastError : null) || null
    };
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = typeof window !== 'undefined'
        ? (window.AudioContext || window.webkitAudioContext)
        : null;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.ctx.onstatechange = () => {
        this._notifyStateChange();
      };
      this.setupAudioGraph();
      this.initialized = true;
      this.lastAudioError = null;

      if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
        Promise.resolve(this.ctx.resume()).then(() => {
          this._notifyStateChange();
        }).catch(err => {
          this.lastAudioError = err ? String(err.message || err) : 'AudioContext resume blocked';
          console.warn('[SoundManager] AudioContext resume pending user gesture:', err);
          this._notifyStateChange();
        });
      }

      this.preloadZombieAudio().catch(e => {
        this.lastAudioError = e ? String(e.message || e) : 'init preload error';
        console.warn('[SoundManager] init preload error:', e);
      });
      this._notifyStateChange();
    } catch (e) {
      this.lastAudioError = e ? String(e.message || e) : 'Web Audio init error';
      console.warn('Web Audio not supported:', e);
      this._notifyStateChange();
    }
  }

  async preloadZombieAudio() {
    if (!this.zombieBank) return 0;
    try {
      let count = 0;
      if (this.ctx) {
        count = await this.zombieBank.decodeAll(this.ctx);
      } else {
        count = await this.zombieBank.preloadRaw();
      }
      this._notifyStateChange();
      return count;
    } catch (err) {
      this.lastAudioError = err ? String(err.message || err) : 'preloadZombieAudio error';
      console.warn('[SoundManager] preloadZombieAudio error:', err);
      this._notifyStateChange();
      return 0;
    }
  }

  setupAudioGraph() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime || 0;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterGainLevel, t);
    this.masterGain.connect(this.ctx.destination);

    if (typeof this.ctx.createDynamicsCompressor === 'function') {
      this.compressor = this.ctx.createDynamicsCompressor();
      if (this.compressor.threshold) this.compressor.threshold.setValueAtTime(-10, t);
      if (this.compressor.knee) this.compressor.knee.setValueAtTime(12, t);
      if (this.compressor.ratio) this.compressor.ratio.setValueAtTime(4, t);
      if (this.compressor.attack) this.compressor.attack.setValueAtTime(0.003, t);
      if (this.compressor.release) this.compressor.release.setValueAtTime(0.15, t);
      this.compressor.connect(this.masterGain);
    } else {
      this.compressor = this.masterGain;
    }

    this.zombieBusGain = this.ctx.createGain();
    if (this.zombieBusGain && this.zombieBusGain.gain) {
      this.zombieBusGain.gain.setValueAtTime(1.65, t);
    }
    this.zombieBusGain.connect(this.compressor || this.masterGain);

    if (typeof this.ctx.createConvolver === 'function') {
      this.reverbNode = this.ctx.createConvolver();
      const impulse = this.createReverbImpulse(1.1, 3.2);
      if (impulse && this.reverbNode) {
        this.reverbNode.buffer = impulse;
      }
    } else {
      this.reverbNode = null;
    }

    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.setValueAtTime(0.24, t);
    if (this.reverbNode) {
      this.reverbNode.connect(this.reverbGain);
    }
    this.reverbGain.connect(this.compressor);

    this.distortionCurve = this.createDistortionCurve(35);
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
      Promise.resolve(this.ctx.resume()).then(() => {
        this._notifyStateChange();
      }).catch(err => {
        console.warn('[SoundManager] ensureContext resume failed:', err);
      });
    }
  }

  async unlockFromGesture() {
    if (!this.initialized) this.init();
    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
      try {
        await this.ctx.resume();
      } catch (err) {
        this.lastAudioError = err ? String(err.message || err) : 'Gesture resume failed';
        console.warn('[SoundManager] Gesture resume error:', err);
      }
    }

    if (this.zombieBank && !this.zombieBank.hasAnyBuffers()) {
      this.preloadZombieAudio().catch(err => {
        console.warn('[SoundManager] Post-unlock preloadZombieAudio failed:', err);
      });
    }

    this._notifyStateChange();
    return !this.ctx.state || this.ctx.state === 'running';
  }

  bindGestureUnlock(target) {
    const evtTarget = target || (typeof window !== 'undefined' ? window : null);
    if (!evtTarget || typeof evtTarget.addEventListener !== 'function' || this._gestureUnlockBound) {
      return;
    }
    this._gestureUnlockBound = true;
    const events = ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'click'];
    const onGesture = () => {
      this.unlockFromGesture().then((isRunning) => {
        if (isRunning && this.zombieBank && this.zombieBank.hasAnyBuffers() && this._gestureUnlockCleanup) {
          this._gestureUnlockCleanup();
        }
      }).catch(err => {
        console.warn('[SoundManager] Gesture unlock error:', err);
      });
    };
    for (const ev of events) {
      evtTarget.addEventListener(ev, onGesture, { capture: true, passive: true });
    }
    this._gestureUnlockCleanup = () => {
      if (typeof evtTarget.removeEventListener === 'function') {
        for (const ev of events) {
          evtTarget.removeEventListener(ev, onGesture, { capture: true });
        }
      }
      this._gestureUnlockBound = false;
      this._gestureUnlockCleanup = null;
    };
  }

  playUnlockTestChime() {
    if (this.muted) return false;
    this.ensureContext();
    if (!this.ctx || (this.ctx.state && this.ctx.state !== 'running')) {
      return false;
    }
    const t = this.ctx.currentTime || 0;
    const target = this.masterGain || this.ctx.destination;
    [440, 660].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = t + idx * 0.05;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.005, start + 0.09);
      osc.connect(gain);
      gain.connect(target);
      osc.start(start);
      osc.stop(start + 0.09);
    });
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterGainLevel, this.ctx.currentTime || 0);
    }
    if (!this.muted) {
      this.unlockFromGesture().catch(err => {
        console.warn('[SoundManager] Unmute unlock error:', err);
      });
    } else if (this.droneActive) {
      this.stopHorrorAmbience();
    }
    this._notifyStateChange();
    return this.muted;
  }
```

3. Update `createSpatialBus` (`lines 193-226`) to accept an optional `targetNode` and update `playZombieSample` (`lines 416-447`) to guard against suspended `ctx.state` and route through `this.zombieBusGain`:
```js
  createSpatialBus(sourceX, listenerX, reverbSend = 0.2, enableDistanceGain = true, targetNode = null) {
    if (!this.ctx) return null;
    const t = this.ctx.currentTime || 0;
    const target = targetNode || this.compressor || this.masterGain || this.ctx.destination;

    const input = this.ctx.createGain();
    const distGain = enableDistanceGain ? this.computeDistanceGain(sourceX, listenerX) : 1.0;
    input.gain.setValueAtTime(distGain, t);

    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      const panVal = this.computeStereoPan(sourceX, listenerX);
      panner.pan.setValueAtTime(panVal, t);
      input.connect(panner);
      panner.connect(target);

      if (reverbSend > 0 && this.reverbNode) {
        const wetGain = this.ctx.createGain();
        wetGain.gain.setValueAtTime(reverbSend, t);
        panner.connect(wetGain);
        wetGain.connect(this.reverbNode);
      }
      return { input, panner };
    }

    input.connect(target);
    if (reverbSend > 0 && this.reverbNode) {
      const wetGain = this.ctx.createGain();
      wetGain.gain.setValueAtTime(reverbSend, t);
      input.connect(wetGain);
      wetGain.connect(this.reverbNode);
    }
    return { input, panner: null };
  }
```
And in `playZombieSample`:
```js
  playZombieSample(zType, event, sourceX, sourceY, listenerX, listenerY, extra = {}) {
    if (this.muted || !this.zombieBank || !this.zombieBank.hasBuffer(zType, event)) {
      return false;
    }
    if (!this.zombieBank.canPlayEvent(event, extra.zombieId)) {
      return false;
    }
    this.ensureContext();
    if (!this.ctx || (this.ctx.state && this.ctx.state !== 'running')) {
      return false;
    }

    const reverbSend = extra.reverbSend !== undefined ? extra.reverbSend : 0.2;
    const bus = this.createSpatialBus(sourceX, listenerX, reverbSend, false, this.zombieBusGain || null);
    if (!bus || !bus.input) {
      return false;
    }

    const distMap = ZOMBIE_EVENT_MAX_DIST || (typeof window !== 'undefined' ? window.ZOMBIE_EVENT_MAX_DIST : null) || DEFAULT_ZOMBIE_EVENT_MAX_DIST;
    const maxDist = (distMap && distMap[event]) || 800;

    return this.zombieBank.playSample(this.ctx, bus.input, zType, event, {
      x: sourceX,
      y: sourceY,
      listenerX,
      listenerY,
      maxDist,
      zombieId: extra.zombieId,
      volume: extra.volume
    });
  }
```

- [ ] **Step 4: Run `tests/horror_vfx_audio.test.js` and `tests/zombie_audio_bank.test.js`**

Run: `node --test tests/horror_vfx_audio.test.js tests/zombie_audio_bank.test.js`
Expected: PASS (all existing + new SoundManager/ZombieAudioBank tests pass).

- [ ] **Step 5: Commit Task 2**

```bash
git add client/js/audio.js tests/horror_vfx_audio.test.js
git commit -m "fix(audio): harden AudioContext gesture unlock, add zombie submix gain, and expose diagnostics"
```

---

### Task 3: Wire Capture-Phase Unlock, Sound Button Status/Chime, and Preload Telemetry in `input.js`, `ui.js`, and `main.js`

**Files:**
- Modify: `client/js/input.js:54-125`
- Modify: `client/js/ui.js:121-145`
- Modify: `client/js/main.js:9-21`, `client/js/main.js:280-287`
- Test: `tests/horror_vfx_audio.test.js`

**Interfaces:**
- Consumes:
  - `SoundManager.bindGestureUnlock`, `SoundManager.unlockFromGesture`, `SoundManager.subscribe`, `SoundManager.getAudioDiagnostics`, `SoundManager.toggleMute`, `SoundManager.playUnlockTestChime`, `SoundManager.preloadZombieAudio`
- Produces:
  - `UIController.initSoundToggle()` displays live audio state on `#btn-sound-toggle` and `#btn-pause-sound`:
    - `🔇 Âm thanh: TẮT` when `muted === true`
    - `⏳ Bấm để bật tiếng (${decodedCount}/${totalCount})` when `!muted` and `ctxState !== 'running'`
    - `🔊 Âm thanh: BẬT (${decodedCount}/${totalCount})` when `!muted` and `ctxState === 'running'`
    - `⚠ Web Audio không hỗ trợ` when `!supported`
  - Clicking `#btn-sound-toggle` or `#btn-pause-sound` while `ctxState !== 'running'` unlocks `AudioContext`, triggers WAV decode if needed, and plays `playUnlockTestChime()` **without** muting the game.

- [ ] **Step 1: Write the failing test in `tests/horror_vfx_audio.test.js`**

Append this test to `tests/horror_vfx_audio.test.js` verifying the UI sound button state machine logic without requiring a full browser DOM:
```js
test('Sound toggle state handling unlocks suspended AudioContext without muting and syncs WAV counts', async () => {
  const sm = new SoundManager();
  const mockCtx = createMockAudioContext();
  mockCtx.state = 'suspended';
  mockCtx.resume = async () => {
    mockCtx.state = 'running';
  };
  sm.ctx = mockCtx;
  sm.setupAudioGraph();
  sm.initialized = true;
  sm.zombieBank.decodeAll = async () => {
    sm.zombieBank.buffers.set('rotten/idle', [{ duration: 0.4 }]);
    return 1;
  };

  // Before unlock: suspended, unmuted, 0 decoded
  const before = sm.getAudioDiagnostics();
  assert.strictEqual(before.ctxState, 'suspended');
  assert.strictEqual(before.muted, false);
  assert.strictEqual(before.decodedCount, 0);

  // Explicit unlock action from button click must keep muted=false and decode WAVs
  const running = await sm.unlockFromGesture();
  assert.strictEqual(running, true);
  await sm.preloadZombieAudio();
  const after = sm.getAudioDiagnostics();
  assert.strictEqual(after.ctxState, 'running');
  assert.strictEqual(after.muted, false);
  assert.strictEqual(after.decodedCount, 1);
  assert.strictEqual(sm.playUnlockTestChime(), true);
});
```

- [ ] **Step 2: Run the test to check baseline**

Run: `node --test tests/horror_vfx_audio.test.js`
Expected: PASS (confirms contract with Task 2) before wiring `input.js`, `ui.js`, and `main.js`.

- [ ] **Step 3: Update `client/js/input.js`, `client/js/ui.js`, and `client/js/main.js`**

1. In `client/js/input.js` (`lines 51-125`), add a clean `unlockAudioFromInput()` helper on `InputHandler` and call it in both `keydown` and `mousedown` (`button === 0` and `button === 2`):
```js
  unlockAudioFromInput() {
    if (typeof window === 'undefined' || !window.soundManager) return;
    if (typeof window.soundManager.unlockFromGesture === 'function') {
      window.soundManager.unlockFromGesture();
    } else if (typeof window.soundManager.ensureContext === 'function') {
      window.soundManager.ensureContext();
    }
  }
```
Replace line 60 (`if (window.soundManager) window.soundManager.ensureContext();`) and lines 111-123 with:
```js
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      // Audio resume on first action
      this.unlockAudioFromInput();
```
and
```js
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.unlockAudioFromInput();
        this.mouse.isDown = true;
        this.keys.shoot = true;
      } else if (e.button === 2) {
        // Right-Click for Ultimate
        this.unlockAudioFromInput();
        if (typeof this.onUltimate === 'function') {
          this.onUltimate(this.mouse.angle);
        }
      }
    });
```

2. In `client/js/ui.js` (`lines 121-145`), update `initSoundToggle()`:
```js
  initSoundToggle() {
    const formatSoundLabel = (diag) => {
      if (!diag) return '🔊 Âm thanh: BẬT';
      if (!diag.supported) return '⚠ Web Audio không hỗ trợ';
      if (diag.muted) return '🔇 Âm thanh: TẮT';
      if (diag.ctxState !== 'running') {
        return `⏳ Bấm để bật tiếng (${diag.decodedCount}/${diag.totalCount})`;
      }
      return `🔊 Âm thanh: BẬT (${diag.decodedCount}/${diag.totalCount})`;
    };

    const syncLabels = (diagOverride) => {
      const sm = window.soundManager;
      const diag = diagOverride || (sm && typeof sm.getAudioDiagnostics === 'function'
        ? sm.getAudioDiagnostics()
        : { supported: true, muted: Boolean(sm && sm.muted), ctxState: 'running', decodedCount: 0, totalCount: 72 });
      const text = formatSoundLabel(diag);
      if (this.btnSoundToggle) this.btnSoundToggle.textContent = text;
      if (this.btnPauseSound) this.btnPauseSound.textContent = text;
    };

    const handleSoundButtonClick = async () => {
      const sm = window.soundManager;
      if (!sm) return;
      const diag = typeof sm.getAudioDiagnostics === 'function' ? sm.getAudioDiagnostics() : null;
      if (diag && !diag.muted && diag.ctxState !== 'running' && typeof sm.unlockFromGesture === 'function') {
        const running = await sm.unlockFromGesture();
        if (running && typeof sm.playUnlockTestChime === 'function') {
          sm.playUnlockTestChime();
        }
        syncLabels();
        return;
      }
      const isMuted = sm.toggleMute();
      if (!isMuted && typeof sm.playUnlockTestChime === 'function') {
        setTimeout(() => sm.playUnlockTestChime(), 20);
      }
      syncLabels();
    };

    if (window.soundManager && typeof window.soundManager.subscribe === 'function') {
      window.soundManager.subscribe((diag) => syncLabels(diag));
    }
    syncLabels();

    if (this.btnSoundToggle) {
      this.btnSoundToggle.addEventListener('click', handleSoundButtonClick);
    }
    if (this.btnPauseSound) {
      this.btnPauseSound.addEventListener('click', handleSoundButtonClick);
    }
  }
```

3. In `client/js/main.js` (`lines 9-16` and `281-286`), register `bindGestureUnlock(window)` at startup and log WAV decode summary on game start:
```js
  // Kick off background raw WAV prefetch and capture-phase AudioContext unlock
  if (isBrowser && window.soundManager) {
    if (typeof window.soundManager.bindGestureUnlock === 'function') {
      window.soundManager.bindGestureUnlock(window);
    }
    if (typeof window.soundManager.preloadZombieAudio === 'function') {
      const preloadPromise = window.soundManager.preloadZombieAudio();
      if (preloadPromise && typeof preloadPromise.catch === 'function') {
        preloadPromise.catch(err => console.warn('Zombie audio preload error:', err));
      }
    }
  }
```
And in `socket.on('room:gameStarted', ...)` (`lines 281-286`):
```js
    if (typeof window !== 'undefined' && window.soundManager) {
      window.soundManager.ensureContext();
      if (typeof window.soundManager.preloadZombieAudio === 'function') {
        window.soundManager.preloadZombieAudio()
          .then((count) => {
            if (count === 0 && window.soundManager.zombieBank && !window.soundManager.zombieBank.hasAnyBuffers()) {
              console.warn('[Audio] Zombie WAV bank decoded 0 buffers:', window.soundManager.getAudioDiagnostics());
            }
          })
          .catch(err => console.warn('[Audio] Failed to decode zombie audio on game start:', err));
      }
    }
```

- [x] **Step 4: Run syntax check and full Node test suite**

Run:
```bash
node --check client/js/zombieAudio.js && node --check client/js/audio.js && node --check client/js/input.js && node --check client/js/ui.js && node --check client/js/main.js && node --test tests/*.test.js
```
Expected: All syntax checks pass and all `tests/*.test.js` pass (`0` failures).

- [x] **Step 5: Commit Task 3**

```bash
git add client/js/input.js client/js/ui.js client/js/main.js tests/horror_vfx_audio.test.js
git commit -m "feat(audio): wire capture-phase AudioContext unlock and live WAV status UI"
```

---

### Task 4: End-to-End Runtime & Browser Verification (All 6 Zombie Types & Events)

**Files:**
- Verify (no edits expected unless bug found): `client/js/zombieAudio.js`, `client/js/audio.js`, `client/js/input.js`, `client/js/ui.js`, `client/js/main.js`, `server/game/GameRoom.js`

- [x] **Step 1: Run full automated test suite after all edits**

Run: `node --test tests/*.test.js`
Expected: 100% PASS with 0 failures and 0 skipped tests.

- [x] **Step 2: Start the local server and open in Google Chrome**

Run: `node server/server.js`
Open `http://localhost:3000` in Chrome (with DevTools Console & Network tabs open, or Chrome remote debugging enabled).

- [x] **Step 3: Verify Lobby audio unlock & 72/72 WAV preload**

1. Confirm `#btn-sound-toggle` transitions to `🔊 Âm thanh: BẬT (72/72)` after clicking anywhere (or clicking `#btn-sound-toggle` plays the 2-tone confirmation chime).
2. Confirm DevTools Network shows HTTP `200` for `/assets/audio/zombies/<profile>/<event>_<n>.wav` with zero `404` or `Illegal invocation` console errors.
3. Run in DevTools Console: `window.soundManager.getAudioDiagnostics()` -> expect `{ supported: true, initialized: true, muted: false, ctxState: "running", decodedCount: 72, totalCount: 72, lastError: null }`.

- [x] **Step 4: Verify all 6 zombie types & 6 events in gameplay**

1. Create a room and start Wave 1 (`NORMAL` / `RUNNER`): verify gunshots, `WAVE_START`, `aggro`, `step`, `idle`, `hit`, `ZOMBIE_ATTACK`, and `ZOMBIE_DIE` all play audibly.
2. Verify all 6 zombie types (`NORMAL -> rotten`, `RUNNER -> ghoul`, `TANK -> mutant`, `DEVIL -> burned`, `MUMMY -> butcher`, `VAMPIRE -> boomer`) via wave progression or DevTools test calls:
   ```js
   ['NORMAL', 'RUNNER', 'TANK', 'DEVIL', 'MUMMY', 'VAMPIRE'].forEach((t, i) => {
     setTimeout(() => {
       window.soundManager.playZombieAggro(t, 820, 800, 600, 600, `verify_${t}`);
       window.soundManager.playZombieAttack(t, 820, 800, 600, 600, `verify_${t}`, t === 'DEVIL' ? 'ranged' : 'melee');
       window.soundManager.playZombieHit(t, 'PISTOL', 820, 800, 600, 600, `verify_${t}`);
       window.soundManager.playZombieDie(t, 820, 800, 600, 600, `verify_${t}`);
     }, i * 500);
   });
   ```
   Expected: Every call returns `true` (except `playZombieHit` void) and produces distinct WAV audio for all 6 zombies with zero `activeVoices` leaks (`window.soundManager.getAudioDiagnostics().activeVoices === 0` after playback finishes).

- [x] **Step 5: Verify branch cleanliness**

Run: `git status -sb && git log --oneline -n 5`
Expected: Working tree clean on `feat/zombie-wav-audio`.
