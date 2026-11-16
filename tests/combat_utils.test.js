'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PICKUP_DROP_CONFIG,
  normalizeAngleDiff,
  maybeDropPickup,
  creditZombieKill,
  damageAndCreditZombie
} = require('../server/game/CombatUtils.js');
const { Zombie } = require('../server/game/Zombie.js');
const { Player } = require('../server/game/Player.js');

test('normalizeAngleDiff wraps arbitrary angles into [-Math.PI, Math.PI]', () => {
  assert.strictEqual(normalizeAngleDiff(0), 0);
  assert.ok(Math.abs(normalizeAngleDiff(3 * Math.PI) - Math.PI) < 1e-6);
  assert.ok(Math.abs(normalizeAngleDiff(-3 * Math.PI) - (-Math.PI)) < 1e-6);
  assert.ok(Math.abs(normalizeAngleDiff(2.5 * Math.PI) - 0.5 * Math.PI) < 1e-6);
  assert.ok(Math.abs(normalizeAngleDiff(-2.5 * Math.PI) - (-0.5 * Math.PI)) < 1e-6);
});

test('maybeDropPickup enforces 18% AMMO, 7% MEDKIT (25% total), forceDrop, and guards invalid args', () => {
  assert.strictEqual(PICKUP_DROP_CONFIG.AMMO_DROP_CHANCE, 0.18);
  assert.strictEqual(PICKUP_DROP_CONFIG.MEDKIT_DROP_CHANCE, 0.07);
  assert.strictEqual(PICKUP_DROP_CONFIG.TOTAL_DROP_CHANCE, 0.25);

  assert.strictEqual(maybeDropPickup(null, { x: 10, y: 20 }), null);
  assert.strictEqual(maybeDropPickup({ pickups: [] }, null), null);

  const room = { pickups: [] };
  const zombie = { x: 100.4, y: 200.6 };

  const forcedAmmo = maybeDropPickup(room, zombie, { forceDrop: true, forceType: 'AMMO' });
  assert.strictEqual(forcedAmmo.type, 'AMMO');
  assert.strictEqual(forcedAmmo.x, 100);
  assert.strictEqual(forcedAmmo.y, 201);

  const origRandom = Math.random;
  try {
    Math.random = () => 0.17;
    assert.strictEqual(maybeDropPickup(room, zombie).type, 'AMMO');
    Math.random = () => 0.24;
    assert.strictEqual(maybeDropPickup(room, zombie).type, 'MEDKIT');
    Math.random = () => 0.26;
    assert.strictEqual(maybeDropPickup(room, zombie), null);
  } finally {
    Math.random = origRandom;
  }
});

test('creditZombieKill and damageAndCreditZombie apply CC, credit score/unlocks, emit ZOMBIE_DIE, and respect dropPickup=false', () => {
  const player = new Player('p1', 'Hero', 'HUMAN', 100, 100);
  const tank = new Zombie('zt', 'TANK', 200, 200);
  const room = { eventsBuffer: [], pickups: [] };

  // Non-lethal hit with boss stun override & knockback
  const killed1 = damageAndCreditZombie(player, tank, 10, 'MELEE', room, {
    stun: 2.0,
    bossStun: 0.5,
    knockback: 100,
    knockAngle: 0
  });
  assert.strictEqual(killed1, false);
  assert.ok(tank.stunTimer > 0 && tank.stunTimer <= 0.5);

  // Lethal hit on normal zombie without pickup drop
  const normal = new Zombie('zn', 'NORMAL', 250, 250);
  const killed2 = damageAndCreditZombie(player, normal, 500, 'BULLET', room, {
    dropPickup: false,
    killAngle: 1.25
  });
  assert.strictEqual(killed2, true);
  assert.strictEqual(normal.isDead, true);
  assert.strictEqual(player.kills, 1);
  assert.ok(player.score > 0);
  assert.strictEqual(room.pickups.length, 0);

  const dieEv = room.eventsBuffer.find(e => e.type === 'ZOMBIE_DIE');
  assert.ok(dieEv);
  assert.strictEqual(dieEv.killAngle, 1.25);

  // Direct creditZombieKill helper
  const runner = new Zombie('zr', 'RUNNER', 300, 300);
  runner.takeDamage(500);
  creditZombieKill(player, runner, room, { forceDrop: true, forceType: 'MEDKIT' });
  assert.strictEqual(player.kills, 2);
  assert.strictEqual(room.pickups.length, 1);
  assert.strictEqual(room.pickups[0].type, 'MEDKIT');
});

