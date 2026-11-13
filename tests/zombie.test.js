const test = require('node:test');
const assert = require('node:assert');
const { Zombie } = require('../server/game/Zombie.js');
const { Player } = require('../server/game/Player.js');
const { GameMap } = require('../server/game/Map.js');

test('Zombie moves towards nearest alive player', () => {
  const map = new GameMap();
  const player = new Player('p1', 'Alice', 'BAMBO', 300, 200);
  const zombie = new Zombie('z1', 'NORMAL', 100, 200);

  zombie.update(0.1, [player], [], map, []);
  assert.ok(zombie.x > 100, 'Zombie should move right towards player');
});

test('Devil maintains distance and fires fireballs', () => {
  const map = new GameMap();
  const player = new Player('p1', 'Alice', 'BAMBO', 300, 200);
  const devil = new Zombie('d1', 'DEVIL', 200, 200);
  devil.attackCooldown = 0;

  const newBullets = [];
  devil.update(0.1, [player], [], map, newBullets);
  assert.strictEqual(newBullets.length, 1, 'Devil should shoot a fireball');
  assert.strictEqual(newBullets[0].isFireball, true);
});

test('Tank Zombie has high health and high damage', () => {
  const tank = new Zombie('t1', 'TANK', 100, 100);
  assert.strictEqual(tank.maxHp, 400);
  assert.strictEqual(tank.damage, 35);
});

test('Mummy Zombie has bullet resistance and explosion vulnerability', () => {
  const mummy1 = new Zombie('m1', 'MUMMY', 100, 100);
  assert.strictEqual(mummy1.maxHp, 140);
  assert.strictEqual(mummy1.speed, 55);
  assert.strictEqual(mummy1.radius, 25);

  // Bullet hit: 100 damage -> takes 70% = 70 damage -> 70 HP left
  mummy1.takeDamage(100, 'BULLET');
  assert.strictEqual(mummy1.hp, 70);

  // Explosion hit: 40 damage -> takes 150% = 60 damage -> 10 HP left
  mummy1.takeDamage(40, 'EXPLOSION');
  assert.strictEqual(mummy1.hp, 10);
});

test('Vampire Zombie has dash ability and lifesteal on melee hit', () => {
  const vampire = new Zombie('v1', 'VAMPIRE', 100, 100);
  assert.strictEqual(vampire.maxHp, 65);
  assert.strictEqual(vampire.speed, 130);
  assert.strictEqual(vampire.radius, 22);

  // Damage vampire down to 30 HP
  vampire.hp = 30;

  // Melee attack player
  const player = new Player('p1', 'Alice', 'HUMAN', 105, 100);
  vampire.attackCooldown = 0;
  vampire.update(0.1, [player], [], null, []);

  // Vampire should have dealt damage and recovered +15 HP (up to 45)
  assert.strictEqual(vampire.hp, 45, 'Vampire should heal 15 HP on melee hit');
  assert.strictEqual(player.hp, 100 - vampire.damage);
});
