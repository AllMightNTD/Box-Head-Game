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
    globalAlpha: 1,
    fillStyle: '#000000',
    shadowColor: '',
    shadowBlur: 0
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

test('Renderer.resetSession resets darkness alphas and handles absent bloodCanvas/darknessCanvas gracefully', () => {
  const mockCanvas = createMockCanvas();
  const renderer = new Renderer(mockCanvas);

  renderer.currentDarknessAlpha = 0.88;
  renderer.targetDarknessAlpha = 0.88;

  assert.doesNotThrow(() => {
    renderer.resetSession();
  });

  assert.strictEqual(renderer.currentDarknessAlpha, 0.18);
  assert.strictEqual(renderer.targetDarknessAlpha, 0.18);
});

test('Renderer.drawDarknessAndLights renders cutouts to darknessCanvas when available', () => {
  const mockCanvas = createMockCanvas();
  const renderer = new Renderer(mockCanvas);

  // Provide mock darknessCanvas
  renderer.darknessCanvas = createMockCanvas();
  renderer.darknessCtx = renderer.darknessCanvas.getContext('2d');

  renderer.currentDarknessAlpha = 0.75;
  renderer.muzzleFlashes.push({ x: 800, y: 600, angle: 0, life: 0.05, maxLife: 0.06, lightRadius: 180 });
  renderer.shockwaves.push({ x: 800, y: 600, radius: 50, alpha: 0.8 });

  const sampleState = {
    wave: 5,
    players: [
      { id: 'p1', x: 800, y: 600, angle: 0, isDead: false, isDowned: false },
      { id: 'p2', x: 700, y: 550, angle: 1.5, isDead: false, isDowned: true },
      { id: 'p3', x: 200, y: 200, angle: 0, isDead: true }
    ],
    bullets: [
      { x: 850, y: 600, isFireball: true },
      { x: 860, y: 600, type: 'rocket' },
      { x: 870, y: 600, type: 'bullet' }
    ],
    barricades: [
      { x: 750, y: 600, type: 'barrel' },
      { x: 700, y: 600, type: 'wall' }
    ],
    drones: [
      { x: 810, y: 610, auraRadius: 200 }
    ]
  };

  // Test across ambient themes (snow, embers, sand, normal)
  const themes = ['snow', 'embers', 'sand', 'normal'];
  for (const ambient of themes) {
    assert.doesNotThrow(() => {
      renderer.drawDarknessAndLights(mockCanvas.ctx, sampleState, 'p1', { theme: { ambient } });
    });
  }
});

test('Renderer.drawZombieEyesInDark draws twin eyes within 400px of alive players only', () => {
  const mockCanvas = createMockCanvas();
  const renderer = new Renderer(mockCanvas);

  let arcsDrawn = 0;
  mockCanvas.ctx.arc = () => { arcsDrawn++; };

  // Below 0.30 darkness -> should return early without drawing eyes
  renderer.currentDarknessAlpha = 0.20;
  renderer.drawZombieEyesInDark(
    mockCanvas.ctx,
    [{ id: 'z1', type: 'NORMAL', x: 850, y: 600, angle: 0, hp: 100 }],
    [{ id: 'p1', x: 800, y: 600, angle: 0, isDead: false }]
  );
  assert.strictEqual(arcsDrawn, 0, 'No eyes drawn when darkness < 0.30');

  // Darkness >= 0.30, zombie within 400px -> draws 2 arcs (twin eyes)
  renderer.currentDarknessAlpha = 0.65;
  renderer.drawZombieEyesInDark(
    mockCanvas.ctx,
    [{ id: 'z1', type: 'DEVIL', x: 850, y: 600, angle: 0, hp: 100 }],
    [{ id: 'p1', x: 800, y: 600, angle: 0, isDead: false }]
  );
  assert.strictEqual(arcsDrawn, 2, 'Should draw 2 eyes (twin arcs) for nearby zombie');

  // Zombie beyond 400px -> no new arcs
  arcsDrawn = 0;
  renderer.drawZombieEyesInDark(
    mockCanvas.ctx,
    [{ id: 'z2', type: 'VAMPIRE', x: 1400, y: 600, angle: 0, hp: 100 }],
    [{ id: 'p1', x: 800, y: 600, angle: 0, isDead: false }]
  );
  assert.strictEqual(arcsDrawn, 0, 'No eyes drawn when zombie is > 400px away');

  // Dead zombie or all players dead -> no new arcs
  arcsDrawn = 0;
  renderer.drawZombieEyesInDark(
    mockCanvas.ctx,
    [{ id: 'z3', type: 'MUMMY', x: 850, y: 600, angle: 0, hp: 0, isDead: true }],
    [{ id: 'p1', x: 800, y: 600, angle: 0, isDead: false }]
  );
  renderer.drawZombieEyesInDark(
    mockCanvas.ctx,
    [{ id: 'z4', type: 'TANK', x: 850, y: 600, angle: 0, hp: 500 }],
    [{ id: 'p1', x: 800, y: 600, angle: 0, isDead: true }]
  );
  assert.strictEqual(arcsDrawn, 0, 'No eyes drawn for dead zombies or when all players are dead');
});

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

test('Renderer handles all bullet types, shell casing physics bounces, explosion particle cap, and safe inner radius', () => {
  const mockCanvas = createMockCanvas();
  const renderer = new Renderer(mockCanvas);

  // Default weapon fallback in addMuzzleFlash
  renderer.addMuzzleFlash(100, 100, 0);
  assert.strictEqual(renderer.muzzleFlashes[0].weapon, 'PISTOL');

  // Verify explosion particles cap <= 180
  for (let i = 0; i < 10; i++) {
    renderer.addExplosionParticles(200, 200, 150);
  }
  assert.ok(renderer.particles.length <= 180, `Explosion particles exceeded cap: ${renderer.particles.length}`);

  // Test shell casing floor bounce physics
  renderer.shellCasings = [{
    x: 100, y: 100, z: 2, vx: 50, vy: 50, vz: -100, vRot: 5, rotation: 0, type: 'brass', life: 2.0, maxLife: 3.0
  }];
  renderer.updateVisuals(0.05, { width: 1600, height: 1200 }, 2);
  assert.strictEqual(renderer.shellCasings[0].z, 0, 'Casing should touch ground (z=0)');
  assert.ok(renderer.shellCasings[0].vz > 0, 'Casing should bounce upward (vz > 0)');

  // Test drawBullets across all bullet variants
  const bullets = [
    { x: 100, y: 100, angle: 0, isFireball: true },
    { x: 120, y: 100, angle: 0.5, type: 'rocket' },
    { x: 140, y: 100, angle: 1.0, type: 'railgun' },
    { x: 160, y: 100, angle: 1.5, type: 'shotgun' },
    { x: 180, y: 100, angle: 2.0, type: 'bullet' }
  ];
  assert.doesNotThrow(() => {
    renderer.drawBullets(mockCanvas.ctx, bullets);
  });

  // Test cutoutRadialLight with edge case innerR >= outerR
  assert.doesNotThrow(() => {
    renderer.cutoutRadialLight(mockCanvas.ctx, 100, 100, 150, 100, 1.0);
    renderer.cutoutRadialLight(mockCanvas.ctx, 100, 100, 0, 0, 1.0);
  });
});

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
    sm.playZombieHit('TANK', 'shotgun', 850, 800);
    sm.playZombieDie('DEVIL', 900, 800);
    sm.playWaveStart(5);
  });

  // Growl cooldown throttling check
  const firstGrowl = sm.playZombieGrowl('RUNNER', 700, 800);
  const immediateSecondGrowl = sm.playZombieGrowl('TANK', 700, 800);
  assert.strictEqual(firstGrowl, true);
  assert.strictEqual(immediateSecondGrowl, false, 'Second growl within cooldown must be throttled');

  // Ambience start & stop cleanup and wave scaling
  sm.updateHorrorAmbience(0.5, {
    isInGame: true,
    wave: 6,
    localPlayer: { x: 800, y: 600, hp: 25, maxHp: 100, isDowned: false },
    zombies: [{ id: 'z1', type: 'RUNNER', x: 850, y: 610, isDead: false }]
  });
  assert.strictEqual(sm.droneActive, true);
  assert.ok(sm.droneLfoGain, 'droneLfoGain should be active');
  assert.strictEqual(sm.droneGain.gain.value, 0.14, 'Wave 6 drone gain should scale to 0.14');

  sm.updateHorrorAmbience(0.1, {
    isInGame: true,
    wave: 1,
    localPlayer: { x: 800, y: 600, hp: 100, maxHp: 100, isDowned: false }
  });
  assert.strictEqual(sm.droneGain.gain.value, 0.04, 'Wave 1 drone gain should be 0.04');

  sm.stopHorrorAmbience();
  assert.strictEqual(sm.droneActive, false);
  assert.strictEqual(sm.droneLfoGain, null, 'droneLfoGain should be null after stopHorrorAmbience');
});

test('SoundManager weapon audio integration with procedural fallback', () => {
  const sm = new SoundManager();
  sm.init();

  assert.ok(sm.weaponBank, 'SoundManager should instantiate weaponBank');
  assert.ok(sm.rocketLoops instanceof Map, 'SoundManager should instantiate rocketLoops Map');

  // Headless call without AudioContext must not throw
  assert.doesNotThrow(() => {
    sm.playShoot('PISTOL', 100, 0);
    sm.playShoot('SHOTGUN', 100, 0);
    sm.playShoot('RAILGUN', 100, 0);
    sm.playShoot('ROCKET', 100, 0);
    sm.playShoot('GRENADE', 100, 0);
    sm.playExplosion(1.0, 100, 0, 'ROCKET');
    sm.playExplosion(1.0, 100, 0, 'GRENADE');
    sm.playExplosion(1.0, 100, 0, 'GENERIC');
    sm.playWeaponEmpty('PISTOL', 100, 0);
    sm.playWeaponReload('SHOTGUN', 100, 0);
    sm.playRailgunCharge(100, 0);
    sm.playRailgunImpact(100, 0);
    sm.updateRocketFlight([{ id: 'r1', x: 100 }], 0);
    sm.stopRocketLoops();
  });

  // Inject mock AudioContext
  sm.ctx = createMockAudioContext();
  sm.setupAudioGraph();
  sm.initialized = true;

  // When buffers not loaded, playShoot should not crash and should execute procedural fallback
  assert.doesNotThrow(() => {
    sm.playShoot('PISTOL', 100, 0);
    sm.playShoot('UZI', 100, 0);
    sm.playShoot('SHOTGUN', 100, 0);
    sm.playShoot('RAILGUN', 100, 0);
    sm.playShoot('ROCKET', 100, 0);
    sm.playShoot('GRENADE', 100, 0);
    sm.playExplosion(1.0, 100, 0, 'ROCKET');
    sm.playExplosion(1.0, 100, 0, 'GRENADE');
    sm.playExplosion(1.0, 100, 0, 'GENERIC');
    sm.playWeaponEmpty('PISTOL', 100, 0);
    sm.playWeaponReload('SHOTGUN', 100, 0);
    sm.playWeaponReload('ROCKET', 100, 0);
    sm.playWeaponReload('PISTOL', 100, 0);
    sm.playRailgunCharge(100, 0);
    sm.playRailgunImpact(100, 0);
  });

  // Verify rocket loop lifecycle
  let loopStarted = false;
  let loopUpdated = false;
  let loopStopped = false;
  sm.weaponBank.createRocketLoop = () => {
    loopStarted = true;
    return {
      update: () => { loopUpdated = true; },
      stop: () => { loopStopped = true; }
    };
  };

  sm.updateRocketFlight([{ id: 'r1', x: 200 }], 0);
  assert.strictEqual(loopStarted, true, 'createRocketLoop should be called for new rocket');
  assert.strictEqual(sm.rocketLoops.has('r1'), true);

  sm.updateRocketFlight([{ id: 'r1', x: 250 }], 0);
  assert.strictEqual(loopUpdated, true, 'RocketLoop.update should be called for active rocket');

  // Rocket removed -> stop called
  sm.updateRocketFlight([], 0);
  assert.strictEqual(loopStopped, true, 'RocketLoop.stop should be called when rocket removed');
  assert.strictEqual(sm.rocketLoops.size, 0);

  // stopHorrorAmbience also cleans up active rocket loops
  sm.updateRocketFlight([{ id: 'r2', x: 300 }], 0);
  assert.strictEqual(sm.rocketLoops.size, 1);
  sm.droneActive = true;
  sm.stopHorrorAmbience();
  assert.strictEqual(sm.rocketLoops.size, 0, 'stopHorrorAmbience must clear rocket loops');

  // Null guard: updateRocketFlight(null, 0) should not throw and should clean up loops
  sm.updateRocketFlight([{ id: 'r3', x: 100 }], 0);
  assert.strictEqual(sm.rocketLoops.size, 1);
  assert.doesNotThrow(() => {
    sm.updateRocketFlight(null, 0);
  });
  assert.strictEqual(sm.rocketLoops.size, 0);

  // Secondary shot sequencing guard: when playSample returns false, do not schedule secondary sounds
  const secondaryCalls = [];
  sm.weaponBank.hasBuffer = () => true;
  sm.weaponBank.playSample = (ctx, dest, weapon, event) => {
    secondaryCalls.push({ weapon, event });
    return false;
  };
  sm.playShoot('SHOTGUN', 100, 0);
  sm.playShoot('RAILGUN', 100, 0);
  sm.playShoot('PISTOL', 100, 0);
  assert.deepStrictEqual(secondaryCalls.map(c => c.event), ['fire', 'fire', 'fire']);
});

const { handleGameEvent, gameLoop } = require('../client/js/main.js');

test('Integration: handleGameEvent and gameLoop route spatial audio, directional gore, screen shake, and horror ambience', () => {
  const calls = {
    playShoot: [],
    triggerScreenShake: [],
    addMuzzleFlash: [],
    playZombieHit: [],
    playRailgunImpact: [],
    addDirectionalBlood: [],
    playZombieDie: [],
    addZombieCorpse: [],
    playExplosion: [],
    addExplosionParticles: [],
    playWaveStart: [],
    addFloatingText: [],
    stopHorrorAmbience: 0,
    stopRocketLoops: 0,
    resetSession: 0,
    updateVisuals: [],
    updateHorrorAmbience: [],
    updateRocketFlight: [],
    playWeaponReload: [],
    playWeaponEmpty: [],
    render: [],
    updateHUD: []
  };

  const mockSoundManager = {
    playShoot: (w, x, lx) => calls.playShoot.push({ w, x, lx }),
    playZombieHit: (zt, w, x, lx) => calls.playZombieHit.push({ zt, w, x, lx }),
    playRailgunImpact: (x, lx) => calls.playRailgunImpact.push({ x, lx }),
    playZombieDie: (zt, x, lx) => calls.playZombieDie.push({ zt, x, lx }),
    playExplosion: (scale, x, lx, source) => calls.playExplosion.push({ scale, x, lx, source }),
    playWaveStart: (wave) => calls.playWaveStart.push(wave),
    playGameOver: () => {},
    playPickup: () => {},
    playWeaponReload: (w, x, lx) => calls.playWeaponReload.push({ w, x, lx }),
    playWeaponEmpty: (w, x, lx) => calls.playWeaponEmpty.push({ w, x, lx }),
    stopHorrorAmbience: () => { calls.stopHorrorAmbience++; },
    stopRocketLoops: () => { calls.stopRocketLoops++; },
    updateRocketFlight: (rockets, lx) => calls.updateRocketFlight.push({ rockets, lx }),
    updateHorrorAmbience: (dt, state) => calls.updateHorrorAmbience.push({ dt, state })
  };

  const mockRenderer = {
    camera: { x: 500, y: 300 },
    addMuzzleFlash: (x, y, angle, weapon) => calls.addMuzzleFlash.push({ x, y, angle, weapon }),
    triggerScreenShake: (mag) => calls.triggerScreenShake.push(mag),
    addDirectionalBlood: (x, y, angle, weapon, isKill, color) => calls.addDirectionalBlood.push({ x, y, angle, weapon, isKill, color }),
    addZombieCorpse: (z) => calls.addZombieCorpse.push(z),
    addExplosionParticles: (x, y, r) => calls.addExplosionParticles.push({ x, y, r }),
    addFloatingText: (text, x, y, color, size) => calls.addFloatingText.push({ text, x, y, color, size }),
    resetSession: () => { calls.resetSession++; },
    updateVisuals: (dt, map, wave) => calls.updateVisuals.push({ dt, map, wave }),
    render: (state, myId, map) => calls.render.push({ state, myId, map })
  };

  const mockUI = {
    updateHUD: (state, myId) => calls.updateHUD.push({ state, myId })
  };

  const context = {
    soundManager: mockSoundManager,
    renderer: mockRenderer,
    myPlayerId: 'player_me'
  };

  const snapshot = {
    wave: 3,
    players: [
      { id: 'player_me', x: 800, y: 600 },
      { id: 'player_peer', x: 1200, y: 600 }
    ],
    zombies: [{ id: 'z1', type: 'NORMAL', x: 850, y: 600 }]
  };

  // 1. SHOOT: local player with SHOTGUN -> shake 5
  handleGameEvent({ type: 'SHOOT', weapon: 'SHOTGUN', x: 800, y: 600, angle: 0.5, playerId: 'player_me' }, snapshot, context);
  assert.strictEqual(calls.playShoot.length, 1);
  assert.strictEqual(calls.playShoot[0].w, 'SHOTGUN');
  assert.strictEqual(calls.playShoot[0].lx, 800);
  assert.strictEqual(calls.addMuzzleFlash[0].weapon, 'SHOTGUN');
  assert.strictEqual(calls.triggerScreenShake[0], 5);

  // SHOOT: local player with ROCKET -> shake 8
  handleGameEvent({ type: 'SHOOT', weapon: 'ROCKET', x: 800, y: 600, angle: 0, playerId: 'player_me' }, snapshot, context);
  assert.strictEqual(calls.triggerScreenShake[1], 8);

  // SHOOT: local player with PISTOL -> shake 1.5
  handleGameEvent({ type: 'SHOOT', weapon: 'PISTOL', x: 800, y: 600, angle: 0, playerId: 'player_me' }, snapshot, context);
  assert.strictEqual(calls.triggerScreenShake[2], 1.5);

  // SHOOT: local player with DRONE -> NO screen shake
  handleGameEvent({ type: 'SHOOT', weapon: 'DRONE', x: 800, y: 600, angle: 0, playerId: 'player_me' }, snapshot, context);
  assert.strictEqual(calls.triggerScreenShake.length, 3, 'Drone firing must not trigger screen shake');

  // SHOOT: peer player -> NO screen shake
  handleGameEvent({ type: 'SHOOT', weapon: 'RAILGUN', x: 1200, y: 600, angle: 0, playerId: 'player_peer' }, snapshot, context);
  assert.strictEqual(calls.triggerScreenShake.length, 3, 'Peer shooting must not trigger local screen shake');

  // 2. HIT: directional blood and zombie hit audio
  handleGameEvent({ type: 'HIT', zType: 'TANK', weapon: 'SHOTGUN', x: 860, y: 600, angle: 0.25 }, snapshot, context);
  assert.strictEqual(calls.playZombieHit.length, 1);
  assert.strictEqual(calls.playZombieHit[0].zt, 'TANK');
  assert.strictEqual(calls.addDirectionalBlood.length, 1);
  assert.strictEqual(calls.addDirectionalBlood[0].angle, 0.25);
  assert.strictEqual(calls.addDirectionalBlood[0].isKill, false);
  assert.strictEqual(calls.playRailgunImpact.length, 0);

  // HIT with railgun triggers playRailgunImpact (case-insensitive: 'railgun' and 'RAILGUN')
  handleGameEvent({ type: 'HIT', zType: 'NORMAL', weapon: 'railgun', x: 880, y: 600, angle: 0 }, snapshot, context);
  assert.strictEqual(calls.playRailgunImpact.length, 1);
  assert.strictEqual(calls.playRailgunImpact[0].x, 880);
  assert.strictEqual(calls.playRailgunImpact[0].lx, 800);

  handleGameEvent({ type: 'HIT', zType: 'DEVIL', weapon: 'RAILGUN', x: 920, y: 600, angle: 0 }, snapshot, context);
  assert.strictEqual(calls.playRailgunImpact.length, 2);
  assert.strictEqual(calls.playRailgunImpact[1].x, 920);
  assert.strictEqual(calls.playRailgunImpact[1].lx, 800);

  // 3. ZOMBIE_DIE: Normal zombie -> visceral dark red #7f0000
  handleGameEvent({ type: 'ZOMBIE_DIE', zType: 'NORMAL', x: 850, y: 600, killAngle: 1.2 }, snapshot, context);
  assert.strictEqual(calls.playZombieDie.length, 1);
  assert.strictEqual(calls.addDirectionalBlood[3].color, '#7f0000');
  assert.strictEqual(calls.addDirectionalBlood[3].isKill, true);
  assert.strictEqual(calls.addZombieCorpse.length, 1);

  // ZOMBIE_DIE: Devil zombie -> crimson red #c62828
  handleGameEvent({ type: 'ZOMBIE_DIE', zType: 'DEVIL', x: 850, y: 600, killAngle: 0.8 }, snapshot, context);
  assert.strictEqual(calls.addDirectionalBlood[4].color, '#c62828');

  // 4. EXPLOSION: large radius -> scale 1.4 with source forwarding
  handleGameEvent({ type: 'EXPLOSION', x: 900, y: 600, radius: 150, source: 'ROCKET' }, snapshot, context);
  assert.strictEqual(calls.playExplosion[0].scale, 1.4);
  assert.strictEqual(calls.playExplosion[0].source, 'ROCKET');
  assert.strictEqual(calls.addExplosionParticles.length, 1);

  // EXPLOSION: standard radius -> scale 1.0 with source
  handleGameEvent({ type: 'EXPLOSION', x: 900, y: 600, radius: 80, source: 'GRENADE' }, snapshot, context);
  assert.strictEqual(calls.playExplosion[1].scale, 1.0);
  assert.strictEqual(calls.playExplosion[1].source, 'GRENADE');

  // 5. WAVE_START
  handleGameEvent({ type: 'WAVE_START', wave: 4 }, snapshot, context);
  assert.strictEqual(calls.playWaveStart[0], 4);
  assert.strictEqual(calls.addFloatingText.length, 1);

  // PICKUP triggers playWeaponReload with active weapon
  handleGameEvent({ type: 'PICKUP' }, snapshot, context);
  assert.strictEqual(calls.playWeaponReload.length, 1);
  assert.strictEqual(calls.playWeaponReload[0].w, 'PISTOL');
  assert.strictEqual(calls.playWeaponReload[0].x, 800);
  assert.strictEqual(calls.playWeaponReload[0].lx, 800);

  // 6. GAME_OVER & SESSION_RESET stop horror ambience and rocket loops
  handleGameEvent({ type: 'GAME_OVER' }, snapshot, context);
  assert.strictEqual(calls.stopHorrorAmbience, 1);
  handleGameEvent({ type: 'SESSION_RESET' }, snapshot, context);
  assert.strictEqual(calls.stopHorrorAmbience, 2);
  assert.strictEqual(calls.stopRocketLoops, 1);
  assert.strictEqual(calls.resetSession, 1);

  // 7. gameLoop bindings
  snapshot.bullets = [
    { id: 'r1', type: 'rocket', x: 860, y: 600 },
    { id: 'b1', type: 'bullet', x: 880, y: 600 }
  ];
  const mockInput = {
    isShooting: () => true
  };
  snapshot.players[0].selectedWeapon = 'UZI';
  snapshot.players[0].weapons = { UZI: { ammo: 0 } };

  const loopContext = {
    interpolator: { getInterpolatedState: () => snapshot },
    renderer: mockRenderer,
    soundManager: mockSoundManager,
    ui: mockUI,
    input: mockInput,
    isInGame: true,
    myPlayerId: 'player_me',
    currentMap: { name: 'THE_ROOMS' }
  };

  gameLoop(2000, loopContext);
  assert.strictEqual(calls.updateVisuals.length, 1);
  assert.strictEqual(calls.updateVisuals[0].wave, 3, 'updateVisuals must receive current snapshot wave');
  assert.strictEqual(calls.updateHorrorAmbience.length, 1);
  assert.strictEqual(calls.updateHorrorAmbience[0].state.wave, 3);
  assert.strictEqual(calls.updateHorrorAmbience[0].state.isInGame, true);
  assert.strictEqual(calls.updateRocketFlight.length, 1, 'updateRocketFlight should be called for active rockets');
  assert.strictEqual(calls.updateRocketFlight[0].rockets.length, 1);
  assert.strictEqual(calls.updateRocketFlight[0].rockets[0].id, 'r1');
  assert.strictEqual(calls.updateRocketFlight[0].lx, 800);
  assert.strictEqual(calls.playWeaponEmpty.length, 1, 'playWeaponEmpty should be called when shooting with 0 ammo');
  assert.strictEqual(calls.playWeaponEmpty[0].w, 'UZI');
  assert.strictEqual(calls.playWeaponEmpty[0].x, 800);
  assert.strictEqual(calls.playWeaponEmpty[0].lx, 800);
  assert.strictEqual(calls.render.length, 1);
  assert.strictEqual(calls.updateHUD.length, 1);

  // gameLoop debounces playWeaponEmpty: calling within 300ms cooldown suppresses voice spam
  gameLoop(2100, loopContext); // 100ms later -> debounced
  assert.strictEqual(calls.playWeaponEmpty.length, 1, 'playWeaponEmpty should be debounced within 300ms');

  // gameLoop triggers playWeaponEmpty again after >= 300ms cooldown
  gameLoop(2350, loopContext); // 350ms later -> should fire
  assert.strictEqual(calls.playWeaponEmpty.length, 2, 'playWeaponEmpty should fire again after 300ms cooldown');

  // gameLoop when not in game
  loopContext.isInGame = false;
  gameLoop(2050, loopContext);
  assert.strictEqual(calls.updateVisuals.length, 4);
  assert.strictEqual(calls.updateVisuals[3].wave, 1, 'updateVisuals when out of game defaults wave to 1');
  assert.strictEqual(calls.render.length, 3, 'No render calls when not in game');
  assert.strictEqual(calls.updateHorrorAmbience.length, 3, 'No ambience updates when not in game');
});

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

test('SoundManager.createSpatialBus with enableDistanceGain=false eliminates compound double distance attenuation for zombie WAV audio', () => {
  const baseCtx = createMockAudioContext();
  const sm = new SoundManager();
  sm.ctx = baseCtx;
  sm.setupAudioGraph();
  sm.initialized = true;

  const createdGains = [];
  const origCreateGain = baseCtx.createGain.bind(baseCtx);
  baseCtx.createGain = () => {
    const g = origCreateGain();
    createdGains.push(g);
    return g;
  };

  const createdPanners = [];
  const origCreatePanner = baseCtx.createStereoPanner.bind(baseCtx);
  baseCtx.createStereoPanner = () => {
    const p = origCreatePanner();
    createdPanners.push(p);
    return p;
  };

  sm.zombieBank.buffers.set('mutant/hit', [{ duration: 0.5 }]);

  // Test 1: Horizontal zombie at (1000, 500), listener at (500, 500), maxDist = 1000
  createdGains.length = 0;
  createdPanners.length = 0;
  const resH = sm.playZombieSample('TANK', 'hit', 1000, 500, 500, 500, { zombieId: 'z_h', reverbSend: 0 });
  assert.strictEqual(resH, true);

  const busInputGainH = createdGains[0].gain.value;
  const wavGainH = createdGains[1].gain.value;
  const panH = createdPanners[0].pan.value;

  // Test 2: Vertical zombie at (500, 1000), listener at (500, 500), maxDist = 1000
  sm.zombieBank.lastEventTimes.delete('hit');
  createdGains.length = 0;
  createdPanners.length = 0;
  const resV = sm.playZombieSample('TANK', 'hit', 500, 1000, 500, 500, { zombieId: 'z_v', reverbSend: 0 });
  assert.strictEqual(resV, true);

  const busInputGainV = createdGains[0].gain.value;
  const wavGainV = createdGains[1].gain.value;
  const panV = createdPanners[0].pan.value;

  // Assertions:
  // 1. Equal Euclidean distance yields identical gain on WAV buffer gainNode (0.5 * baseVolume = 0.4)
  assert.strictEqual(wavGainH, 0.4, 'Horizontal zombie WAV gainNode should be 0.4');
  assert.strictEqual(wavGainV, 0.4, 'Vertical zombie WAV gainNode should be 0.4');
  assert.strictEqual(wavGainH, wavGainV, 'WAV gainNode gains must be identical at equal Euclidean distance');

  // 2. Spatial bus input gain must remain 1.0 (no 1D horizontal compounding)
  assert.strictEqual(busInputGainH, 1.0, 'bus.input.gain for horizontal zombie must be 1.0');
  assert.strictEqual(busInputGainV, 1.0, 'bus.input.gain for vertical zombie must be 1.0');

  // 3. Stereo panning: horizontal zombie pans right (> 0), vertical zombie is centered (0)
  assert.ok(panH > 0, `Horizontal zombie should pan right (> 0), got ${panH}`);
  assert.strictEqual(panV, 0, 'Vertical zombie pan should be 0');

  // 4. Backward compatibility: createSpatialBus defaults enableDistanceGain = true
  const defaultBus = sm.createSpatialBus(1000, 500);
  assert.ok(defaultBus.input.gain.value < 1.0, 'Default createSpatialBus must apply 1D distance attenuation');
  assert.strictEqual(defaultBus.input.gain.value, sm.computeDistanceGain(1000, 500));
});

test('SoundManager.playZombieSample checks canPlayEvent before ensureContext', () => {
  const sm = new SoundManager();
  let ensureContextCalled = 0;
  sm.ensureContext = () => { ensureContextCalled++; };
  sm.zombieBank.buffers.set('mutant/hit', [{ duration: 0.5 }]);

  sm.zombieBank.canPlayEvent = () => false;
  const res = sm.playZombieSample('TANK', 'hit', 1000, 500, 500, 500);
  assert.strictEqual(res, false);
  assert.strictEqual(ensureContextCalled, 0, 'ensureContext must not be called when canPlayEvent returns false');
});

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
    await Promise.resolve();
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
    src.start = () => {
      startedCount++;
      if (typeof src.onended === 'function') {
        src.onended();
      }
    };
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
  assert.strictEqual(sm.zombieBank.activeVoices, 0, 'Active voices must return to 0 when buffer playback ends');
});

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

test('SoundManager.updateAmbienceGrowls retries aggro after gesture unlock when initial playback returned false', async () => {
  let startedCount = 0;
  const mockCtx = createMockAudioContext();
  mockCtx.state = 'suspended';
  mockCtx.resume = async () => {
    await Promise.resolve();
    mockCtx.state = 'running';
  };
  const origCreateBufSrc = mockCtx.createBufferSource;
  mockCtx.createBufferSource = () => {
    const src = origCreateBufSrc();
    src.start = () => {
      startedCount++;
      if (typeof src.onended === 'function') {
        src.onended();
      }
    };
    return src;
  };

  const sm = new SoundManager();
  sm.ctx = mockCtx;
  sm.setupAudioGraph();
  sm.initialized = true;
  sm.zombieBank.buffers.set('rotten/aggro', [{ duration: 0.5 }]);

  sm.updateHorrorAmbience(0.05, {
    isInGame: true,
    wave: 1,
    localPlayer: { x: 800, y: 600, hp: 100, maxHp: 100 },
    zombies: [{ id: 'z_retry_sm', type: 'NORMAL', x: 850, y: 600, isFrozen: false, isStunned: false }]
  });

  assert.strictEqual(sm.zombieBank.zombieStates.get('z_retry_sm').hasAggroed, false);
  assert.strictEqual(startedCount, 0);

  await sm.unlockFromGesture();

  sm.updateHorrorAmbience(0.05, {
    isInGame: true,
    wave: 1,
    localPlayer: { x: 800, y: 600, hp: 100, maxHp: 100 },
    zombies: [{ id: 'z_retry_sm', type: 'NORMAL', x: 850, y: 600, isFrozen: false, isStunned: false }]
  });

  assert.strictEqual(startedCount, 1);
  assert.strictEqual(sm.zombieBank.zombieStates.get('z_retry_sm').hasAggroed, true);
});

