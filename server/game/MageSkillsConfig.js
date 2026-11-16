/**
 * @file MageSkillsConfig.js
 * @description Immutable configuration for Mage Mana resource rules, AMMO pickup synergy,
 * 18% AMMO drop constants, and all 8 Mage ARPG skills (slots 1-8).
 */

'use strict';

const MAGE_MANA_CONFIG = Object.freeze({
  MAX_MANA: 100,
  STARTING_MANA: 100,
  REGEN_PER_SEC: 5,
  WAVE_CLEAR_RESTORE_RATIO: 1.0,
  REVIVE_RESTORE_RATIO: 0.5
});

const MAGE_AMMO_PICKUP = Object.freeze({
  AMMO_DROP_CHANCE: 0.18,
  MEDKIT_DROP_CHANCE: 0.07,
  MANA_RESTORE: 30,
  COOLDOWN_REDUCTION_SEC: 1.5
});

const MAGE_SKILLS = Object.freeze({
  ARCANE_BOLT: Object.freeze({
    id: 'ARCANE_BOLT',
    slot: 1,
    name: 'Tia Ma Pháp',
    unlockCombo: 1,
    manaCost: 5,
    cooldown: 0,
    fireDelay: 0.25,
    speed: 900,
    range: 400,
    damage: 35,
    damageType: 'MAGIC',
    radius: 7,
    knockback: 45
  }),
  FROST_NOVA: Object.freeze({
    id: 'FROST_NOVA',
    slot: 2,
    name: 'Vòng Tròn Băng Giá',
    unlockCombo: 5,
    manaCost: 20,
    cooldown: 5.0,
    radius: 120,
    damage: 45,
    damageType: 'ICE',
    freezeDuration: 2.0,
    bossFreezeDuration: 1.0
  }),
  CHAIN_LIGHTNING: Object.freeze({
    id: 'CHAIN_LIGHTNING',
    slot: 3,
    name: 'Lôi Điện Liên Hoàn',
    unlockCombo: 10,
    manaCost: 30,
    cooldown: 4.5,
    castRange: 450,
    cursorSnapRadius: 90,
    coneHalfRad: (25 * Math.PI) / 180,
    damage: 70,
    damageType: 'LIGHTNING',
    maxBounces: 4,
    bounceRadius: 180,
    bounceDamageDecay: 0.15,
    stunDuration: 0.5
  }),
  FIREBALL: Object.freeze({
    id: 'FIREBALL',
    slot: 4,
    name: 'Hỏa Cầu Đại Nổ',
    unlockCombo: 15,
    manaCost: 35,
    cooldown: 6.0,
    speed: 550,
    range: 500,
    radius: 14,
    explosionRadius: 140,
    damage: 130,
    damageType: 'FIRE',
    knockback: 180,
    burnRadius: 140,
    burnDuration: 3.0,
    burnDamagePerSec: 15,
    burnTickInterval: 0.5
  }),
  ARCANE_TELEPORT: Object.freeze({
    id: 'ARCANE_TELEPORT',
    slot: 5,
    name: 'Dịch Chuyển Không Gian',
    unlockCombo: 20,
    manaCost: 25,
    cooldown: 7.0,
    maxDistance: 250,
    blastRadius: 110,
    blastDamage: 50,
    damageType: 'MAGIC',
    knockback: 260
  }),
  SANCTUARY_HEAL: Object.freeze({
    id: 'SANCTUARY_HEAL',
    slot: 6,
    name: 'Thánh Vực Hồi Phục',
    unlockCombo: 30,
    manaCost: 35,
    cooldown: 12.0,
    maxCastRange: 350,
    radius: 180,
    duration: 4.0,
    healPerSec: 25,
    healTickInterval: 0.2,
    cooldownSpeedMultiplier: 1.35,
    zombieSlowFactor: 0.6,
    zombieSlowRefresh: 0.4
  }),
  MANA_SHIELD: Object.freeze({
    id: 'MANA_SHIELD',
    slot: 7,
    name: 'Khiên Năng Lượng',
    unlockCombo: 40,
    manaCost: 15,
    cooldown: 10.0,
    duration: 5.0,
    manaPerDamage: 1
  }),
  METEOR_STORM: Object.freeze({
    id: 'METEOR_STORM',
    slot: 8,
    name: 'Thiên Thạch Hủy Diệt',
    unlockCombo: 50,
    manaCost: 100,
    cooldown: 50.0,
    maxCastRange: 450,
    stormRadius: 300,
    duration: 3.0,
    meteorCount: 5,
    meteorImpactRadius: 120,
    meteorDamage: 150,
    damageType: 'FIRE',
    meteorKnockback: 220,
    lavaRadius: 240,
    lavaDuration: 4.0,
    lavaDamagePerSec: 25,
    lavaTickInterval: 0.5,
    lavaSlowFactor: 0.7
  })
});

const MAGE_SKILL_KEYS = Object.freeze([
  'ARCANE_BOLT',
  'FROST_NOVA',
  'CHAIN_LIGHTNING',
  'FIREBALL',
  'ARCANE_TELEPORT',
  'SANCTUARY_HEAL',
  'MANA_SHIELD',
  'METEOR_STORM'
]);

const MAGE_SLOT_MAP = new Map(
  Object.values(MAGE_SKILLS).map(skill => [skill.slot, skill])
);

/**
 * Retrieves Mage skill configuration by slot index (1..8).
 * @param {number} slot
 * @returns {object|null}
 */
function getMageSkillBySlot(slot) {
  if (typeof slot !== 'number' || !Number.isInteger(slot)) {
    return null;
  }
  return MAGE_SLOT_MAP.get(slot) || null;
}

/**
 * Retrieves Mage skill configuration by string ID.
 * @param {string} id
 * @returns {object|null}
 */
function getMageSkillById(id) {
  if (typeof id !== 'string' || !id) {
    return null;
  }
  return MAGE_SKILLS[id] || null;
}

/**
 * Retrieves all Mage skills unlocked at or below the given combo count.
 * @param {number} combo
 * @returns {Array<object>}
 */
function getUnlockedMageSkills(combo) {
  if (typeof combo !== 'number' || !Number.isFinite(combo)) {
    return [];
  }
  return Object.values(MAGE_SKILLS).filter(skill => combo >= skill.unlockCombo);
}

module.exports = {
  MAGE_MANA_CONFIG,
  MAGE_AMMO_PICKUP,
  MAGE_SKILLS,
  MAGE_SKILL_KEYS,
  getMageSkillBySlot,
  getMageSkillById,
  getUnlockedMageSkills
};
