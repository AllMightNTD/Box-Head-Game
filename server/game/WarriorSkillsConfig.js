/**
 * @file WarriorSkillsConfig.js
 * @description Configuration for Warrior Stances (slots 1-2) and ARPG Skills (slots 3-8),
 * along with armor and ammo-reduction mechanics.
 */

'use strict';

/**
 * Secondary armor configuration for Warrior class.
 */
const WARRIOR_ARMOR_CONFIG = Object.freeze({
  MAX_ARMOR: 75,
  WAVE_CLEAR_RESTORE_RATIO: 0.5,
  REVIVE_RESTORE_RATIO: 0.5
});

/**
 * Cooldown reduction and ultimate bonus granted by AMMO pickups.
 */
const WARRIOR_AMMO_REDUCTION = Object.freeze({
  COOLDOWN_RATIO: 0.3,
  MIN_SECONDS: 1.5,
  ULT_CHARGE_BONUS: 15
});

/**
 * Full skill specifications for Warrior slots 1 through 8.
 */
const WARRIOR_SKILLS = Object.freeze({
  BERSERKER_STANCE: Object.freeze({
    id: 'BERSERKER_STANCE',
    slot: 1,
    name: 'Berserker Stance',
    unlockCombo: 1,
    damage: 42,
    fireDelay: 0.26,
    range: 80,
    arcRad: (90 * Math.PI) / 180,
    maxFuryStacks: 10,
    furyDuration: 4.0,
    atkSpeedPerStack: 0.03,
    moveSpeedPerStack: 0.02
  }),
  JUGGERNAUT_STANCE: Object.freeze({
    id: 'JUGGERNAUT_STANCE',
    slot: 2,
    name: 'Juggernaut Stance',
    unlockCombo: 5,
    damage: 58,
    fireDelay: 0.55,
    range: 125,
    arcRad: (130 * Math.PI) / 180,
    knockback: 260,
    frontalReduction: 0.2,
    frontalArcHalfRad: (70 * Math.PI) / 180,
    slowFactor: 0.7,
    slowDuration: 1.5
  }),
  BLADE_WHIRLWIND: Object.freeze({
    id: 'BLADE_WHIRLWIND',
    slot: 3,
    name: 'Blade Whirlwind',
    unlockCombo: 10,
    cooldown: 4.5,
    duration: 1.5,
    tickInterval: 0.25,
    totalTicks: 6,
    radius: 105,
    damage: 45,
    moveSpeedMultiplier: 0.7,
    windBladeDamage: 65,
    windBladeSpeed: 560,
    windBladeRange: 260,
    juggernautSlamRadius: 135,
    juggernautSlamDamage: 90,
    juggernautSlamKnockback: 240,
    juggernautStunDuration: 1.2,
    juggernautBossStunDuration: 0.8
  }),
  SHADOW_DASH_SLASH: Object.freeze({
    id: 'SHADOW_DASH_SLASH',
    slot: 4,
    name: 'Shadow Dash Slash',
    unlockCombo: 15,
    cooldown: 5.0,
    duration: 0.18,
    distance: 240,
    dashDamage: 55,
    markFuseTime: 0.5,
    markRadius: 115,
    markPullRadius: 160,
    markDamage: 75
  }),
  SEISMIC_SLAM: Object.freeze({
    id: 'SEISMIC_SLAM',
    slot: 5,
    name: 'Seismic Slam',
    unlockCombo: 20,
    cooldown: 8.0,
    rings: Object.freeze([
      Object.freeze({ delay: 0, minR: 0, maxR: 95, damage: 165, knockback: 200, stun: 0, bossStun: 0 }),
      Object.freeze({ delay: 0.12, minR: 95, maxR: 165, damage: 105, knockback: 300, stun: 2.0, bossStun: 1.2 }),
      Object.freeze({ delay: 0.24, minR: 165, maxR: 230, damage: 70, knockback: 380, stun: 2.5, bossStun: 1.5 })
    ]),
    fireballClearRadius: 230,
    fissureRadius: 210,
    fissureDuration: 4.0,
    fissureSlowFactor: 0.4,
    fissureTickInterval: 0.5,
    fissureTickDamage: 8
  }),
  WAR_CRY: Object.freeze({
    id: 'WAR_CRY',
    slot: 6,
    name: 'War Cry',
    unlockCombo: 30,
    cooldown: 10.0,
    tauntRadius: 900,
    tauntDuration: 4.0,
    fearRadius: 180,
    fearDuration: 1.5,
    armorRestoreRatio: 0.2,
    auraRadius: 200,
    auraDuration: 5.0,
    allyDamageBonus: 0.15
  }),
  COUNTER_SHIELD_BASH: Object.freeze({
    id: 'COUNTER_SHIELD_BASH',
    slot: 7,
    name: 'Counter Shield Bash',
    unlockCombo: 40,
    cooldown: 8.0,
    missCooldown: 4.0,
    duration: 1.5,
    frontalArcHalfRad: (70 * Math.PI) / 180,
    moveSpeedMultiplier: 0.75,
    stepDistance: 75,
    bashConeRad: (130 * Math.PI) / 180,
    bashRange: 130,
    bashDamage: 95,
    bashKnockback: 360,
    bashStunDuration: 2.2,
    bashBossStunDuration: 1.4,
    cleaveDamage: 120,
    cleaveRange: 125,
    cleaveConeRad: (130 * Math.PI) / 180
  }),
  AVATAR_OF_WAR: Object.freeze({
    id: 'AVATAR_OF_WAR',
    slot: 8,
    name: 'Avatar of War',
    unlockCombo: 50,
    cooldown: 60.0,
    duration: 10.0,
    damageMultiplier: 1.5,
    attackSpeedMultiplier: 1.3,
    moveSpeedMultiplier: 1.3,
    fireSlashDamage: 55,
    fireSlashSpeed: 750,
    fireSlashRange: 340,
    endExplosionRadius: 210,
    endExplosionDamage: 180,
    endExplosionKnockback: 350
  })
});

/**
 * Ordered keys for the 8 warrior skills corresponding to slots 1-8.
 */
const WARRIOR_SKILL_KEYS = Object.freeze([
  'BERSERKER_STANCE',
  'JUGGERNAUT_STANCE',
  'BLADE_WHIRLWIND',
  'SHADOW_DASH_SLASH',
  'SEISMIC_SLAM',
  'WAR_CRY',
  'COUNTER_SHIELD_BASH',
  'AVATAR_OF_WAR'
]);

/**
 * Pre-computed lookup map by slot index (1..8) for O(1) slot resolution.
 */
const WARRIOR_SLOT_MAP = new Map(
  Object.values(WARRIOR_SKILLS).map(skill => [skill.slot, skill])
);

/**
 * Retrieves a warrior skill configuration by slot index (1..8).
 * @param {number} slot - Slot number 1-8
 * @returns {object|null} Skill config object or null if invalid/unfound
 */
function getWarriorSkillBySlot(slot) {
  if (typeof slot !== 'number' || !Number.isInteger(slot)) {
    return null;
  }
  return WARRIOR_SLOT_MAP.get(slot) || null;
}

/**
 * Retrieves a warrior skill configuration by its string ID.
 * @param {string} id - Skill identifier
 * @returns {object|null} Skill config object or null if invalid/unfound
 */
function getWarriorSkillById(id) {
  if (typeof id !== 'string' || !id) {
    return null;
  }
  return WARRIOR_SKILLS[id] || null;
}

/**
 * Retrieves all warrior skills unlocked at or below the given combo count.
 * @param {number} combo - Current player combo count
 * @returns {Array<object>} List of unlocked skill configs
 */
function getUnlockedWarriorSkills(combo) {
  if (typeof combo !== 'number' || !Number.isFinite(combo)) {
    return [];
  }
  return Object.values(WARRIOR_SKILLS).filter(skill => combo >= skill.unlockCombo);
}

module.exports = {
  WARRIOR_ARMOR_CONFIG,
  WARRIOR_AMMO_REDUCTION,
  WARRIOR_SKILLS,
  WARRIOR_SKILL_KEYS,
  getWarriorSkillBySlot,
  getWarriorSkillById,
  getUnlockedWarriorSkills
};
