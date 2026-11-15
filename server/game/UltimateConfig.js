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
    id: 'AVATAR_OF_WAR',
    name: 'Avatar of War',
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
  },
  MAGE: {
    id: 'BLINK_FROST_NOVA',
    name: 'Blink & Frost Nova',
    blinkDistance: 240,
    novaRadius: 140,
    damage: 75,
    freezeDuration: 3.0,
    bossFreezeDuration: 1.5,
    bossSlowDuration: 1.5,
    bossSlowFactor: 0.5
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
