const { MAGE_SKILLS } = require('./MageSkillsConfig.js');

const ULT_CHARGE_CONFIG = {
  MAX_CHARGE: 100,
  HIT_BASE: 0.8,
  SHOTGUN_PELLET_HIT: 0.2,
  KILL_BASE: 4,
  COMBO_STEP_BONUS: 0.05,
  MAX_COMBO_MULTIPLIER: 2.0,
  REVIVE_BONUS: 15
};

const ULTIMATE_CONFIGS = {
  HUMAN: {
    id: 'TACTICAL_DRONE',
    name: 'Tactical Drone',
    duration: 8.0,
    auraRadius: 200,
    fireRate: 5.0,
    bulletDamage: 22,
    bulletSpeed: 1000,
    range: 480,
    knockback: 25
  },
  WARRIOR: {
    id: 'SEISMIC_SLAM',
    name: 'Seismic Slam',
    radius: 220,
    damage: 120,
    stunDuration: 2.5,
    bossStunDuration: 1.5,
    knockback: 520
  },
  MAGE: {
    id: 'METEOR_STORM',
    name: MAGE_SKILLS.METEOR_STORM.name,
    stormRadius: MAGE_SKILLS.METEOR_STORM.stormRadius,
    duration: MAGE_SKILLS.METEOR_STORM.duration,
    meteorCount: MAGE_SKILLS.METEOR_STORM.meteorCount,
    meteorImpactRadius: MAGE_SKILLS.METEOR_STORM.meteorImpactRadius,
    meteorDamage: MAGE_SKILLS.METEOR_STORM.meteorDamage,
    manaCost: MAGE_SKILLS.METEOR_STORM.manaCost,
    cooldown: MAGE_SKILLS.METEOR_STORM.cooldown
  }
};

function getUltimateConfigForClass(character) {
  return ULTIMATE_CONFIGS[character] || ULTIMATE_CONFIGS.HUMAN;
}

module.exports = {
  ULT_CHARGE_CONFIG,
  ULTIMATE_CONFIGS,
  getUltimateConfigForClass
};
