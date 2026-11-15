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


