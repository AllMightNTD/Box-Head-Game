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

const { Player } = require('../server/game/Player.js');

test('Player initializes Mage Mana state, regenerates +5/s, and respects Sanctuary cooldown multiplier', () => {
  // Arrange
  const map = new GameMap('THE_ROOMS');
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 300);

  // Assert initial state
  assert.strictEqual(mage.maxHp, 85);
  assert.strictEqual(mage.speed, 188);
  assert.strictEqual(mage.maxMana, 100);
  assert.strictEqual(mage.mana, 100);
  assert.strictEqual(mage.selectedWeapon, 'ARCANE_BOLT');
  assert.ok(mage.mageState);
  assert.strictEqual(mage.mageState.skills.ARCANE_BOLT.unlocked, true);
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.unlocked, false);
  assert.strictEqual(mage.mageState.skills.METEOR_STORM.unlocked, false);

  // Act: spend mana and put skill on CD
  assert.strictEqual(mage.consumeMana(40), true);
  assert.strictEqual(mage.mana, 60);
  assert.strictEqual(mage.consumeMana(70), false);
  assert.strictEqual(mage.mana, 60);

  mage.mageState.skills.FROST_NOVA.cooldown = 5.0;
  mage.update(2.0, map, []);
  assert.strictEqual(mage.mana, 70); // 60 + 5 * 2
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.cooldown, 3.0);

  // Sanctuary buff speeds up cooldown recovery by 1.35x
  mage.hasSanctuaryBuff = true;
  mage.update(1.0, map, []);
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.cooldown, 1.65);
});

test('Mage recordKill skips gun unlocks & ultCharge, unlocks Mage skills by combo, and AMMO pickup restores +30 Mana & -1.5s CD', () => {
  // Arrange
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 300);
  mage.mana = 50;
  mage.mageState.skills.FROST_NOVA.cooldown = 4.0;
  mage.mageState.skills.CHAIN_LIGHTNING.cooldown = 1.0;

  // Act: 4 kills -> combo reaches 5 -> unlocks FROST_NOVA
  let unlocked = [];
  for (let i = 0; i < 4; i++) {
    unlocked = mage.recordKill(10);
  }

  // Assert
  assert.strictEqual(mage.combo, 5);
  assert.strictEqual(mage.ultCharge, 0, 'Mage must not accumulate ultCharge');
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.unlocked, true);
  assert.ok(unlocked.some(u => u.id === 'FROST_NOVA'));

  // Act: AMMO pickup
  mage.applyMageAmmoPickup();
  assert.strictEqual(mage.mana, 80);
  assert.strictEqual(mage.mageState.skills.FROST_NOVA.cooldown, 2.5);
  assert.strictEqual(mage.mageState.skills.CHAIN_LIGHTNING.cooldown, 0);
});

test('Mage Mana Shield absorbs 1:1 into Mana, overflows remainder to HP, and breaks early at 0 Mana', () => {
  // Arrange
  const mage = new Player('m1', 'Merlin', 'MAGE', 300, 300);
  mage.mana = 50;
  mage.mageState.manaShieldActive = true;
  mage.mageState.manaShieldTimer = 5.0;

  // Act 1: 30 damage fully absorbed
  const res1 = mage.takeDamage(30, 'MELEE');
  assert.strictEqual(res1.absorbedMana, 30);
  assert.strictEqual(res1.damage, 0);
  assert.strictEqual(res1.shieldBroken, false);
  assert.strictEqual(mage.mana, 20);
  assert.strictEqual(mage.hp, 85);
  assert.strictEqual(mage.mageState.manaShieldActive, true);

  // Act 2: 35 damage (> 20 remaining mana) -> absorbs 20, overflows 15 to HP, breaks shield
  const res2 = mage.takeDamage(35, 'MELEE');
  assert.strictEqual(res2.absorbedMana, 20);
  assert.strictEqual(res2.damage, 15);
  assert.strictEqual(res2.shieldBroken, true);
  assert.strictEqual(mage.mana, 0);
  assert.strictEqual(mage.hp, 70);
  assert.strictEqual(mage.mageState.manaShieldActive, false);
  assert.strictEqual(mage.mageState.manaShieldTimer, 0);

  // Serialization includes mana & mageState
  const snap = mage.serialize();
  assert.strictEqual(snap.mana, 0);
  assert.strictEqual(snap.maxMana, 100);
  assert.ok(snap.mageState);
  assert.strictEqual(snap.mageState.manaShieldActive, false);

  // Revive restores 50% Mana
  mage.isDowned = true;
  mage.hp = 0;
  mage.mana = 0;
  mage.revive();
  assert.strictEqual(mage.isDowned, false);
  assert.strictEqual(mage.hp, 40);
  assert.strictEqual(mage.mana, 50);
});

test('Non-Mage characters preserve legacy gun, weapon switch, and ult charge behavior', () => {
  const human = new Player('h1', 'Hero', 'HUMAN', 300, 300);
  assert.strictEqual(human.mana, 0);
  assert.strictEqual(human.maxMana, 0);
  assert.strictEqual(human.mageState, null);
  assert.strictEqual(human.selectedWeapon, 'PISTOL');
  assert.strictEqual(human.consumeMana(10), false);
  assert.strictEqual(human.restoreMana(10), 0);

  // Weapon switch works for Human
  human.weapons.SHOTGUN.unlocked = true;
  human.applyInput({ weaponId: 'SHOTGUN' });
  assert.strictEqual(human.selectedWeapon, 'SHOTGUN');

  // Kill unlocks guns and adds ult charge
  human.recordKill(10);
  assert.ok(human.ultCharge > 0);

  // Serialization for Human
  const snap = human.serialize();
  assert.strictEqual(snap.mana, 0);
  assert.strictEqual(snap.maxMana, 0);
  assert.strictEqual(snap.hasSanctuaryBuff, false);
  assert.strictEqual(snap.mageState, null);
});

