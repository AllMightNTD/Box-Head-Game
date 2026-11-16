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
    const fullPath = fs.existsSync(entry.url)
      ? entry.url
      : path.join(__dirname, '../client/assets/audio', entry.url.replace(/^.*?assets\/audio\//, ''));
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

test('WeaponAudioBank - Preload, decode and playSample with mock AudioContext', async () => {
  const mockFetch = async (url) => {
    return {
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024)
    };
  };

  const bank = new WeaponAudioBank({ fetchFn: mockFetch, maxVoices: 2 });
  const preloadedCount = await bank.preloadRaw();
  assert.strictEqual(preloadedCount, 46);

  const mockCtx = {
    currentTime: 10,
    state: 'running',
    decodeAudioData: async (buf) => ({ duration: 0.5, length: 22050 }),
    createBufferSource: () => ({
      buffer: null,
      playbackRate: { setValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
      onended: null
    }),
    createGain: () => ({
      gain: {
        setValueAtTime: () => {},
        setTargetAtTime: () => {}
      },
      connect: () => {}
    }),
    createBiquadFilter: () => ({
      type: 'lowpass',
      frequency: { setValueAtTime: () => {} },
      connect: () => {}
    }),
    createStereoPanner: () => ({
      pan: { setValueAtTime: () => {} },
      connect: () => {}
    })
  };

  const decodedCount = await bank.decodeAll(mockCtx);
  assert.strictEqual(decodedCount, 46);
  assert.strictEqual(bank.hasAnyBuffers(), true);
  assert.strictEqual(bank.hasBuffer('pistol', 'fire'), true);
  assert.strictEqual(bank.hasBuffer('invalid', 'none'), false);

  const destNode = {};
  const played1 = bank.playSample(mockCtx, destNode, 'pistol', 'fire', { sourceX: 100, listenerX: 100 });
  assert.strictEqual(played1, true);
  assert.strictEqual(bank.activeVoices, 1);

  const played2 = bank.playSample(mockCtx, destNode, 'uzi', 'fire');
  assert.strictEqual(played2, true);
  assert.strictEqual(bank.activeVoices, 2);

  // Exceeding maxVoices (2) should reject
  const played3 = bank.playSample(mockCtx, destNode, 'shotgun', 'fire');
  assert.strictEqual(played3, false);

  // Rocket loop test
  const loop = bank.createRocketLoop(mockCtx, destNode, { sourceX: 200, listenerX: 0 });
  assert.ok(loop);
  assert.strictEqual(typeof loop.update, 'function');
  assert.strictEqual(typeof loop.stop, 'function');
  loop.update({ sourceX: 300, listenerX: 0 });
  loop.stop(0.05);

  bank.reset();
  assert.strictEqual(bank.hasAnyBuffers(), false);
  assert.strictEqual(bank.activeVoices, 0);
});

test('WeaponAudioBank - playSample catches src.start errors and prevents activeVoices leak', () => {
  const bank = new WeaponAudioBank({ maxVoices: 5 });
  bank.buffers.set('pistol/fire_1', { duration: 0.5 });

  const throwingCtx = {
    currentTime: 0,
    state: 'running',
    createBufferSource: () => ({
      buffer: null,
      playbackRate: { setValueAtTime: () => {} },
      connect: () => {},
      start: () => { throw new Error('AudioContext in invalid state'); },
      onended: null
    }),
    createGain: () => ({
      gain: { setValueAtTime: () => {} },
      connect: () => {}
    })
  };

  const played = bank.playSample(throwingCtx, {}, 'pistol', 'fire');
  assert.strictEqual(played, false);
  assert.strictEqual(bank.activeVoices, 0);
});
