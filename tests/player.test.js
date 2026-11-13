const test = require('node:test');
const assert = require('node:assert');
const { Player } = require('../server/game/Player.js');
const { GameMap } = require('../server/game/Map.js');

test('Player movement and map boundary collision', () => {
  const map = new GameMap();
  const player = new Player('p1', 'Alice', 'BAMBO', 200, 200);
  player.applyInput({ up: true, down: false, left: false, right: false, angle: 0 });
  player.update(0.1, map, []);
  assert.ok(player.y < 200, 'Player should have moved up');
});

test('Player combo increment, decay and weapon unlocking', () => {
  const map = new GameMap();
  const player = new Player('p1', 'Alice', 'BAMBO', 200, 200);
  assert.strictEqual(player.combo, 1);
  for (let i = 0; i < 9; i++) player.recordKill();
  assert.strictEqual(player.combo, 10);
  assert.ok(player.weapons.SHOTGUN.unlocked, 'Shotgun should be unlocked at combo 10');

  // Fast forward decay
  player.comboTimer = 0;
  player.update(0.1, map, []);
  assert.strictEqual(player.combo, 1, 'Combo should reset when timer reaches 0');
});

test('Player downed and revive logic', () => {
  const p1 = new Player('p1', 'Alice', 'BAMBO', 200, 200);
  const p2 = new Player('p2', 'Bob', 'BON', 210, 200);
  p1.takeDamage(100);
  assert.strictEqual(p1.isDowned, true);

  p2.startRevive(p1);
  p2.updateRevive(2.1); // revive takes 2.0s
  assert.strictEqual(p1.isDowned, false);
  assert.ok(p1.hp > 0);
});

test('Player can switch weapon while moving smoothly without losing momentum', () => {
  const map = new GameMap();
  const player = new Player('p1', 'Alice', 'BAMBO', 300, 300);
  player.weapons.UZI.unlocked = true;

  // Player starts moving up and left
  player.applyInput({ up: true, down: false, left: true, right: false, angle: 0 });
  assert.strictEqual(player.input.up, true);
  assert.strictEqual(player.input.left, true);

  // Switch weapon input arrives (with full or partial payload)
  player.applyInput({ weaponId: 'UZI' });
  assert.strictEqual(player.selectedWeapon, 'UZI');
  assert.strictEqual(player.input.up, true, 'Up movement input must be retained');
  assert.strictEqual(player.input.left, true, 'Left movement input must be retained');

  // Verify motion continues without stutter
  player.update(0.1, map, []);
  assert.ok(player.x < 300, 'Player should have moved left');
  assert.ok(player.y < 300, 'Player should have moved up');
});

test('Character classes (Human, Warrior, Mage) apply unique attributes', () => {
  const human = new Player('h1', 'HumanHero', 'HUMAN', 100, 100);
  assert.strictEqual(human.maxHp, 100);
  assert.strictEqual(human.speed, 160);
  assert.strictEqual(human.radius, 16);
  assert.strictEqual(human.ammoPickupBonus, 1.25);
  assert.strictEqual(human.reloadSpeedMultiplier, 1.15);

  const warrior = new Player('w1', 'WarriorHero', 'WARRIOR', 100, 100);
  assert.strictEqual(warrior.maxHp, 150);
  assert.strictEqual(warrior.speed, 144);
  assert.strictEqual(warrior.meleeResistance, 0.25);
  assert.strictEqual(warrior.knockbackImmune, true);

  // Test Warrior melee damage reduction
  warrior.takeDamage(40); // 40 - 25% = 30 dmg
  assert.strictEqual(warrior.hp, 120);

  const mage = new Player('m1', 'MageHero', 'MAGE', 100, 100);
  assert.strictEqual(mage.maxHp, 85);
  assert.strictEqual(mage.speed, 188);
  assert.strictEqual(mage.comboDecayMultiplier, 0.8);

  // Test serialization includes isMoving
  human.applyInput({ up: true });
  const serialized = human.serialize();
  assert.strictEqual(serialized.isMoving, true);
});

