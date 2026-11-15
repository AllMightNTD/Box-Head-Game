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

const { handleGameEvent, gameLoop } = require('../client/js/main.js');

test('Integration: handleGameEvent and gameLoop route spatial audio, directional gore, screen shake, and horror ambience', () => {
  const calls = {
    playShoot: [],
    triggerScreenShake: [],
    addMuzzleFlash: [],
    playZombieHit: [],
    addDirectionalBlood: [],
    playZombieDie: [],
    addZombieCorpse: [],
    playExplosion: [],
    addExplosionParticles: [],
    playWaveStart: [],
    addFloatingText: [],
    stopHorrorAmbience: 0,
    resetSession: 0,
    updateVisuals: [],
    updateHorrorAmbience: [],
    render: [],
    updateHUD: []
  };

  const mockSoundManager = {
    playShoot: (w, x, lx) => calls.playShoot.push({ w, x, lx }),
    playZombieHit: (zt, w, x, lx) => calls.playZombieHit.push({ zt, w, x, lx }),
    playZombieDie: (zt, x, lx) => calls.playZombieDie.push({ zt, x, lx }),
    playExplosion: (scale, x, lx) => calls.playExplosion.push({ scale, x, lx }),
    playWaveStart: (wave) => calls.playWaveStart.push(wave),
    playGameOver: () => {},
    stopHorrorAmbience: () => { calls.stopHorrorAmbience++; },
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

  // 3. ZOMBIE_DIE: Normal zombie -> visceral dark red #7f0000
  handleGameEvent({ type: 'ZOMBIE_DIE', zType: 'NORMAL', x: 850, y: 600, killAngle: 1.2 }, snapshot, context);
  assert.strictEqual(calls.playZombieDie.length, 1);
  assert.strictEqual(calls.addDirectionalBlood[1].color, '#7f0000');
  assert.strictEqual(calls.addDirectionalBlood[1].isKill, true);
  assert.strictEqual(calls.addZombieCorpse.length, 1);

  // ZOMBIE_DIE: Devil zombie -> crimson red #c62828
  handleGameEvent({ type: 'ZOMBIE_DIE', zType: 'DEVIL', x: 850, y: 600, killAngle: 0.8 }, snapshot, context);
  assert.strictEqual(calls.addDirectionalBlood[2].color, '#c62828');

  // 4. EXPLOSION: large radius -> scale 1.4
  handleGameEvent({ type: 'EXPLOSION', x: 900, y: 600, radius: 150 }, snapshot, context);
  assert.strictEqual(calls.playExplosion[0].scale, 1.4);
  assert.strictEqual(calls.addExplosionParticles.length, 1);

  // EXPLOSION: standard radius -> scale 1.0
  handleGameEvent({ type: 'EXPLOSION', x: 900, y: 600, radius: 80 }, snapshot, context);
  assert.strictEqual(calls.playExplosion[1].scale, 1.0);

  // 5. WAVE_START
  handleGameEvent({ type: 'WAVE_START', wave: 4 }, snapshot, context);
  assert.strictEqual(calls.playWaveStart[0], 4);
  assert.strictEqual(calls.addFloatingText.length, 1);

  // 6. GAME_OVER & SESSION_RESET stop horror ambience
  handleGameEvent({ type: 'GAME_OVER' }, snapshot, context);
  assert.strictEqual(calls.stopHorrorAmbience, 1);
  handleGameEvent({ type: 'SESSION_RESET' }, snapshot, context);
  assert.strictEqual(calls.stopHorrorAmbience, 2);
  assert.strictEqual(calls.resetSession, 1);

  // 7. gameLoop bindings
  const loopContext = {
    interpolator: { getInterpolatedState: () => snapshot },
    renderer: mockRenderer,
    soundManager: mockSoundManager,
    ui: mockUI,
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
  assert.strictEqual(calls.render.length, 1);
  assert.strictEqual(calls.updateHUD.length, 1);

  // gameLoop when not in game
  loopContext.isInGame = false;
  gameLoop(2050, loopContext);
  assert.strictEqual(calls.updateVisuals.length, 2);
  assert.strictEqual(calls.updateVisuals[1].wave, 1, 'updateVisuals when out of game defaults wave to 1');
  assert.strictEqual(calls.render.length, 1, 'No render calls when not in game');
  assert.strictEqual(calls.updateHorrorAmbience.length, 1, 'No ambience updates when not in game');
});




