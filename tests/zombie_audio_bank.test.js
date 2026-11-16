const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ZombieAudioBank,
  ZOMBIE_AUDIO_MAP,
  ZOMBIE_SFX_COUNTS,
  ZOMBIE_SFX_VOLUMES,
  ZOMBIE_STEP_STRIDE,
  ZOMBIE_EVENT_MAX_DIST
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
  assert.deepEqual(ZOMBIE_STEP_STRIDE, { NORMAL: 58, RUNNER: 48, TANK: 68, DEVIL: 60, MUMMY: 68, VAMPIRE: 52 });
  assert.deepEqual(ZOMBIE_EVENT_MAX_DIST, { idle: 650, aggro: 680, attack: 900, hit: 1000, die: 1050, step: 460 });

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

test('ZombieAudioBank.getAllAssetEntries formats keys and paths correctly', () => {
  const bank = new ZombieAudioBank({ basePath: 'assets/audio/zombies/' });
  const entries = bank.getAllAssetEntries();
  assert.equal(entries.length, 72);
  const first = entries[0];
  assert.equal(first.profile, 'rotten');
  assert.equal(first.event, 'idle');
  assert.equal(first.index, 1);
  assert.equal(first.key, 'rotten/idle_1');
  assert.equal(first.url, 'assets/audio/zombies/rotten/idle_1.wav');
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
  assert.equal(bank.hasAnyBuffers(), false);
  const [count1, count2] = await Promise.all([bank.decodeAll(mockCtx), bank.decodeAll(mockCtx)]);

  assert.equal(fetchCount, 72);
  assert.equal(count1, 71);
  assert.equal(count2, 71);
  assert.equal(bank.rawBuffers.size, 0, 'rawBuffers must be cleared after decode to save RAM');
  assert.equal(bank.hasBuffer('NORMAL', 'hit'), true);
  assert.equal(bank.hasBuffer('VAMPIRE', 'die'), false);
  assert.equal(bank.hasAnyBuffers(), true);

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

test('ZombieAudioBank.decodeAll clears previous buffers when called with a new AudioContext', async () => {
  const mockFetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) });
  const createMockCtx = (id) => ({
    id,
    decodeAudioData: async () => ({ duration: 0.5, ctxId: id })
  });

  const ctx1 = createMockCtx('ctx-1');
  const ctx2 = createMockCtx('ctx-2');

  const bank = new ZombieAudioBank({ fetchFn: mockFetch });
  await bank.decodeAll(ctx1);
  const count1 = bank.buffers.get('rotten/idle').length;
  assert.equal(count1, 3);
  assert.equal(bank.buffers.get('rotten/idle')[0].ctxId, 'ctx-1');

  // Calling decodeAll with a new context must replace buffers, not append
  await bank.decodeAll(ctx2);
  const count2 = bank.buffers.get('rotten/idle').length;
  assert.equal(count2, 3, 'Buffer count should not accumulate across context resets');
  assert.equal(bank.buffers.get('rotten/idle')[0].ctxId, 'ctx-2');
});

test('ZombieAudioBank binds default fetch to window/globalThis, preventing illegal invocation', async () => {
  const originalWindow = global.window;
  try {
    const mockWindow = {
      fetch: function (url) {
        if (this !== mockWindow) {
          throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
        }
        return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) });
      }
    };
    global.window = mockWindow;

    const bank = new ZombieAudioBank();
    const count = await bank.preloadRaw(6);
    assert.equal(count, 72);
  } finally {
    global.window = originalWindow;
  }
});

test('ZombieAudioBank allows events immediately on first trigger with small nowFn (e.g. 10ms) without offset', () => {
  const bank = new ZombieAudioBank({ nowFn: () => 10 });
  assert.strictEqual(bank.canPlayEvent('hit'), true, 'First trigger must not be throttled even when now is small');
  assert.strictEqual(bank.canPlayEvent('attack'), true);
});

test('ZombieAudioBank.playSample validates src.start before incrementing activeVoices', () => {
  const mockCtx = {
    currentTime: 0,
    createBufferSource: () => ({
      buffer: null,
      playbackRate: { value: 1 },
      connect: () => {},
      // start is undefined
    }),
    createGain: () => ({
      gain: { value: 1, setValueAtTime: () => {} },
      connect: () => {}
    })
  };
  const bank = new ZombieAudioBank();
  bank.buffers.set('rotten/hit', [{ duration: 0.2 }]);
  const result = bank.playSample(mockCtx, {}, 'NORMAL', 'hit', { x: 800, y: 600, listenerX: 800, listenerY: 600 });
  assert.strictEqual(result, false, 'playSample must return false if src.start is missing');
  assert.strictEqual(bank.activeVoices, 0, 'activeVoices must remain 0 when src.start is missing');
});

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


