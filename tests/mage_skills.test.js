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
