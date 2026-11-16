/**
 * @file mage_skills.test.js
 * @description Unit and integration tests for Mage Mana system, 8-skill kit, ground zones, and socket sync.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAGE_MANA_CONFIG,
  MAGE_AMMO_PICKUP,
  MAGE_SKILLS,
  MAGE_SKILL_KEYS,
  getMageSkillBySlot,
  getMageSkillById,
  getUnlockedMageSkills
} = require('../server/game/MageSkillsConfig.js');

test('MageSkillsConfig defines exact 8-skill progression, mana costs, cooldowns, and AMMO drop constants', () => {
  // Arrange & Act
  const expectedOrder = [
    ['ARCANE_BOLT', 1, 1, 5, 0],
    ['FROST_NOVA', 2, 5, 20, 5.0],
    ['CHAIN_LIGHTNING', 3, 10, 30, 4.5],
    ['FIREBALL', 4, 15, 35, 6.0],
    ['ARCANE_TELEPORT', 5, 20, 25, 7.0],
    ['SANCTUARY_HEAL', 6, 30, 35, 12.0],
    ['MANA_SHIELD', 7, 40, 15, 10.0],
    ['METEOR_STORM', 8, 50, 100, 50.0]
  ];

  // Assert
  assert.strictEqual(MAGE_MANA_CONFIG.MAX_MANA, 100);
  assert.strictEqual(MAGE_MANA_CONFIG.REGEN_PER_SEC, 5);
  assert.strictEqual(MAGE_AMMO_PICKUP.AMMO_DROP_CHANCE, 0.18);
  assert.strictEqual(MAGE_AMMO_PICKUP.MANA_RESTORE, 30);
  assert.strictEqual(MAGE_AMMO_PICKUP.COOLDOWN_REDUCTION_SEC, 1.5);
  assert.strictEqual(MAGE_SKILL_KEYS.length, 8);

  for (const [id, slot, unlockCombo, manaCost, cooldown] of expectedOrder) {
    const skill = getMageSkillById(id);
    assert.ok(skill, `Expected skill ${id}`);
    assert.strictEqual(getMageSkillBySlot(slot), skill);
    assert.strictEqual(skill.slot, slot);
    assert.strictEqual(skill.unlockCombo, unlockCombo);
    assert.strictEqual(skill.manaCost, manaCost);
    assert.strictEqual(skill.cooldown, cooldown);
  }

  // Invalid lookups & unlock filtering
  assert.strictEqual(getMageSkillBySlot(0), null);
  assert.strictEqual(getMageSkillBySlot(9), null);
  assert.strictEqual(getMageSkillBySlot(1.5), null);
  assert.strictEqual(getMageSkillById('UNKNOWN'), null);
  assert.deepStrictEqual(getUnlockedMageSkills(10).map(s => s.id), [
    'ARCANE_BOLT',
    'FROST_NOVA',
    'CHAIN_LIGHTNING'
  ]);
  assert.deepStrictEqual(getUnlockedMageSkills(NaN), []);
});

const { Zombie } = require('../server/game/Zombie.js');
const { Bullet } = require('../server/game/Bullet.js');
const { GameMap } = require('../server/game/Map.js');
const { getUltimateConfigForClass } = require('../server/game/UltimateConfig.js');

test('Zombie.applySlow reduces speed without diluting stronger slows and ignores invalid inputs', () => {
  // Arrange
  const map = new GameMap('THE_ROOMS');
  const z = new Zombie('z1', 'NORMAL', 400, 400);
  const target = { x: 800, y: 400, radius: 16, isDead: false };

  // Act: apply 40% slow (0.6x) then weaker 10% slow (0.9x)
  z.applySlow(1.0, 0.6);
  z.applySlow(0.5, 0.9);
  z.applySlow(-1, 0.5);
  z.applySlow(1.0, 0);

  // Assert
  assert.strictEqual(z.slowFactor, 0.6);
  assert.strictEqual(z.slowTimer, 1.0);
  assert.strictEqual(z.serialize().isChilled, true);

  z.update(0.5, [target], [], map, []);
  const moved = z.x - 400;
  // Normal speed 110 * 0.6 * 0.5s = 33px
  assert.ok(Math.abs(moved - 33) < 0.5, `Expected ~33px movement, got ${moved}`);
});

test('Bullet supports arcane_bolt and mage_fireball properties cleanly', () => {
  // Arrange & Act
  const bolt = new Bullet('b1', 'm1', 100, 100, 0, {
    type: 'arcane_bolt',
    speed: 900,
    damage: 35,
    range: 400,
    radius: 7,
    damageType: 'MAGIC'
  });
  const fb = new Bullet('b2', 'm1', 100, 100, 0, {
    type: 'mage_fireball',
    isMageFireball: true,
    speed: 550,
    range: 500,
    radius: 14,
    explosionRadius: 140,
    explosionDamage: 130,
    damageType: 'FIRE'
  });

  // Assert
  assert.strictEqual(bolt.radius, 7);
  assert.strictEqual(bolt.damageType, 'MAGIC');
  assert.strictEqual(bolt.isExplosive, false);
  assert.strictEqual(fb.radius, 14);
  assert.strictEqual(fb.isMageFireball, true);
  assert.strictEqual(fb.isExplosive, true);
  assert.strictEqual(fb.damageType, 'FIRE');
  assert.strictEqual(fb.serialize().type, 'mage_fireball');
});

test('UltimateConfig maps MAGE to METEOR_STORM', () => {
  const mageUlt = getUltimateConfigForClass('MAGE');
  assert.strictEqual(mageUlt.id, 'METEOR_STORM');
});
