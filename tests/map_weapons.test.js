const test = require('node:test');
const assert = require('node:assert');
const { WEAPONS, getUnlockedWeapons, getWeaponById } = require('../server/game/WeaponsConfig.js');
const { GameMap } = require('../server/game/Map.js');

test('WeaponsConfig has correct combo unlock progression', () => {
  assert.strictEqual(WEAPONS.PISTOL.unlockCombo, 1);
  assert.strictEqual(WEAPONS.UZI.unlockCombo, 5);
  assert.strictEqual(WEAPONS.SHOTGUN.unlockCombo, 10);
  assert.strictEqual(WEAPONS.BARRICADE.unlockCombo, 15);
  assert.strictEqual(WEAPONS.BARREL.unlockCombo, 20);
  assert.strictEqual(WEAPONS.GRENADE.unlockCombo, 30);
  assert.strictEqual(WEAPONS.ROCKET.unlockCombo, 40);
  assert.strictEqual(WEAPONS.RAILGUN.unlockCombo, 50);

  const unlockedAt15 = getUnlockedWeapons(15);
  assert.ok(unlockedAt15.some(w => w.id === 'BARRICADE'));
  assert.ok(unlockedAt15.some(w => w.id === 'SHOTGUN'));
  assert.strictEqual(unlockedAt15.some(w => w.id === 'ROCKET'), false);

  const uzi = getWeaponById('UZI');
  assert.strictEqual(uzi.damage, 18);
});

test('GameMap detects wall and pillar collisions', () => {
  const map = new GameMap();
  assert.strictEqual(map.isWall(0, 0, 10), true); // Boundary wall
  assert.strictEqual(map.isWall(map.width / 2, map.height / 2, 10), false); // Open center
  
  // Pillars collision
  const pillar = map.walls.find(w => w.type === 'pillar');
  assert.ok(pillar, 'Map should have stone pillars');
  assert.strictEqual(map.isWall(pillar.x + pillar.w / 2, pillar.y + pillar.h / 2, 5), true);

  // Clamping
  const clamped = map.clampToBounds(-100, -100, 20);
  assert.ok(clamped.x >= 20);
  assert.ok(clamped.y >= 20);
});
