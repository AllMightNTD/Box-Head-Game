const test = require('node:test');
const assert = require('node:assert');
const { Player } = require('../server/game/Player.js');
const { GameMap } = require('../server/game/Map.js');

test('Player serialization includes all weapons unlock status and ammo', () => {
  const p = new Player('p1', 'Tester', 'BAMBO', 200, 200);
  const snap = p.serialize();

  assert.ok(snap.weapons, 'Serialized player must have weapons object');
  assert.strictEqual(snap.weapons.PISTOL.unlocked, true);
  assert.strictEqual(snap.weapons.UZI.unlocked, false);
  assert.strictEqual(snap.weapons.SHOTGUN.unlocked, false);

  // Score 4 kills -> combo = 5
  for (let i = 0; i < 4; i++) p.recordKill();
  assert.strictEqual(p.combo, 5);

  const snap5 = p.serialize();
  assert.strictEqual(snap5.weapons.UZI.unlocked, true, 'Uzi must be unlocked at combo 5');
  assert.ok(snap5.weapons.UZI.ammo > 0, 'Uzi must have initial ammo');
});

test('Re-reaching combo milestones awards bonus ammo', () => {
  const p = new Player('p1', 'Tester', 'BAMBO', 200, 200);
  // reach combo 5
  for (let i = 0; i < 4; i++) p.recordKill();
  const initialUziAmmo = p.weapons.UZI.ammo;

  // Let combo decay back to 1
  p.comboTimer = 0;
  p.update(0.1, new GameMap(), []);
  assert.strictEqual(p.combo, 1);

  // Uzi remains unlocked
  assert.strictEqual(p.weapons.UZI.unlocked, true);

  // Reach combo 5 again -> awards bonus ammo!
  for (let i = 0; i < 4; i++) p.recordKill();
  assert.strictEqual(p.combo, 5);
  assert.ok(p.weapons.UZI.ammo > initialUziAmmo, 'Re-reaching combo 5 should award bonus ammo');
});
